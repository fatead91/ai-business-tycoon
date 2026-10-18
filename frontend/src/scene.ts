import Phaser from "phaser";
import type { Agent, Department, Point, Snapshot } from "./types";

const colors = {
  hull: 0x39464b,
  edge: 0x637275,
  floor: 0x293132,
  tile: 0x333d3d,
  green: 0xb9f36b,
};
const hex = (value: string) => Number.parseInt(value.slice(1), 16);

export class Headquarters extends Phaser.Scene {
  dataSnapshot?: Snapshot;
  private tiles = new Map<
    string,
    {
      body: Phaser.GameObjects.Sprite;
      label: Phaser.GameObjects.Text;
      status: Phaser.GameObjects.Arc;
      glow: Phaser.GameObjects.Graphics;
      deskGlow: Phaser.GameObjects.Rectangle;
    }
  >();
  private outline?: Phaser.GameObjects.Graphics;
  private selected = "arbitrage";
  private ready = false;
  private fit = 1;
  private dragging = false;
  private dragDistance = 0;
  private last = new Phaser.Math.Vector2();
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private lastTouchDistance = 0;
  private pinchActive = false;
  private clockOffset = 0;
  onDepartment: (id: string) => void = () => {};
  onAgent: (id: string) => void = () => {};

  constructor() {
    super("headquarters");
  }

  create() {
    const g = this.add.graphics();
    // A seeded star field avoids any random agent motion; only ambient stars shimmer.
    let seed = 42;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    g.fillStyle(0x080e11).fillRect(-3000, -3000, 7500, 7500);
    for (let i = 0; i < 900; i++) {
      const x = random() * 3600 - 1000,
        y = random() * 2800 - 700;
      g.fillStyle(i % 9 === 0 ? 0x98b5ac : 0x435856, random() * 0.5 + 0.15);
      g.fillRect(x, y, i % 13 === 0 ? 3 : 1.5, i % 13 === 0 ? 3 : 1.5);
    }
    // Distant orbital tracks give the station a place in space without an image backdrop.
    g.lineStyle(1, 0x223535, 0.25);
    for (let r = 600; r < 1500; r += 170) g.strokeCircle(730, 550, r);
    this.drawCorridor(g, 680, 180, 100, 750, true);
    for (const y of [190, 520, 850])
      this.drawCorridor(g, 560, y, 340, 65, false);
    for (const y of [222, 552, 882]) {
      g.fillStyle(0x263738).fillRoundedRect(657, y - 42, 146, 84, 15);
      g.lineStyle(3, 0x50605e).strokeRoundedRect(657, y - 42, 146, 84, 15);
      g.lineStyle(1, 0x72916c).strokeCircle(730, y, 24);
      g.fillStyle(0xa5c482, 0.2).fillCircle(730, y, 18);
      this.add
        .text(730, y, "+", {
          fontFamily: "monospace",
          fontSize: "30px",
          color: "#b9f36b",
        })
        .setOrigin(0.5);
    }
    this.add
      .text(730, 65, "O R B I T A L   S T A T I O N   0 1", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#6b827d",
      })
      .setOrigin(0.5);
    this.add
      .text(730, 1050, "A I   B U S I N E S S   T Y C O O N", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#516762",
      })
      .setOrigin(0.5);
    this.outline = this.add.graphics().setDepth(5);
    this.ready = true;
    if (this.dataSnapshot) this.buildRooms(this.dataSnapshot);
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0 && pointer.button !== 1) return;
      this.dragging = true;
      this.dragDistance = 0;
      this.last.set(pointer.x, pointer.y);
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || this.pinchActive) return;
      const dx = pointer.x - this.last.x,
        dy = pointer.y - this.last.y;
      this.dragDistance += Math.abs(dx) + Math.abs(dy);
      this.cameras.main.scrollX -= dx / this.cameras.main.zoom;
      this.cameras.main.scrollY -= dy / this.cameras.main.zoom;
      this.last.set(pointer.x, pointer.y);
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      const clicked =
        this.dragging && this.dragDistance < 8 && !this.pinchActive;
      this.dragging = false;
      if (!clicked || !this.dataSnapshot) return;
      const p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const agent = this.dataSnapshot.agents.find((a) => {
        const visual = this.tiles.get(a.id)?.body;
        return (
          visual &&
          Phaser.Math.Distance.Between(p.x, p.y, visual.x, visual.y) < 20
        );
      });
      if (agent) {
        this.onAgent(agent.id);
        return;
      }
      const room = this.dataSnapshot.departments.find(
        (d) =>
          p.x >= d.x &&
          p.x <= d.x + d.width &&
          p.y >= d.y &&
          p.y <= d.y + d.height,
      );
      if (room) this.onDepartment(room.id);
    });
    this.input.on(
      "wheel",
      (_p: unknown, _o: unknown, _dx: number, dy: number) =>
        this.zoom(dy > 0 ? -0.12 : 0.12),
    );
    this.input.addPointer(1);
    this.keys = this.input.keyboard?.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT",
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.scale.on("resize", () => this.resetView());
    this.resetView();
  }

  private drawCorridor(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    vertical: boolean,
  ) {
    g.fillStyle(0x101a1e).fillRect(x - 6, y - 6, w + 12, h + 20);
    g.fillStyle(colors.hull).fillRect(x, y, w, h);
    g.lineStyle(3, colors.edge).strokeRect(x, y, w, h);
    g.fillStyle(0x242f30).fillRect(x + 9, y + 9, w - 18, h - 18);
    for (let t = 16; t < (vertical ? h : w) - 10; t += 22) {
      g.lineStyle(1, 0x41504e);
      if (vertical) g.lineBetween(x + 10, y + t, x + w - 10, y + t);
      else g.lineBetween(x + t, y + 10, x + t, y + h - 10);
    }
    g.fillStyle(0x91b583, 0.6);
    if (vertical) {
      g.fillRect(x + 4, y + 10, 2, h - 20);
      g.fillRect(x + w - 6, y + 10, 2, h - 20);
    } else {
      g.fillRect(x + 10, y + 4, w - 20, 2);
      g.fillRect(x + 10, y + h - 6, w - 20, 2);
    }
  }

  private buildRooms(snapshot: Snapshot) {
    this.generateCharacters();
    const g = this.add.graphics().setDepth(1);
    for (const d of snapshot.departments) {
      this.drawRoom(g, d);
      for (let i = 0; i < 6; i++)
        this.desk(
          g,
          d.x + 98 + (i % 3) * 140,
          d.y + 101 + Math.floor(i / 3) * 91,
          hex(d.color),
        );
      this.add
        .text(d.x + 26, d.y + 23, `${d.code} / ${d.name.toUpperCase()}`, {
          fontFamily: "monospace",
          fontSize: "15px",
          fontStyle: "bold",
          color: d.color,
        })
        .setDepth(6);
      this.add
        .text(d.x + 450, d.y + 24, "●", { fontSize: "12px", color: d.color })
        .setDepth(6);
      for (let i = 0; i < 3; i++) {
        const x = d.x + 446,
          y = d.y + 80 + i * 43;
        g.fillStyle(0x1b272b).fillRect(x, y, 19, 30);
        g.lineStyle(1, 0x59696a).strokeRect(x, y, 19, 30);
        for (let j = 0; j < 3; j++)
          g.fillStyle(j === 0 ? hex(d.color) : 0x425451).fillRect(
            x + 4,
            y + 5 + j * 6,
            3,
            2,
          );
      }
      this.plant(g, d.x + 28, d.y + 218);
      this.plant(g, d.x + 448, d.y + 218);
    }
    for (const agent of snapshot.agents) {
      const glow = this.add.graphics().setDepth(8);
      const deskGlow = this.add
        .rectangle(
          agent.station[0],
          agent.station[1] - 38,
          34,
          21,
          hex(agent.color),
          0,
        )
        .setDepth(4);
      const body = this.add
        .sprite(...agent.position, `worker-${agent.department}-0`)
        .setOrigin(0.5, 0.85)
        .setDepth(10);
      const label = this.add
        .text(agent.position[0], agent.position[1] + 12, agent.name, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#c6d4c9",
          backgroundColor: "#182323",
          padding: { x: 3, y: 2 },
        })
        .setOrigin(0.5)
        .setDepth(12);
      const status = this.add.circle(0, 0, 3, 0x829c8a).setDepth(12);
      this.tiles.set(agent.id, { body, label, status, glow, deskGlow });
    }
    this.select(this.selected);
  }

  private drawRoom(g: Phaser.GameObjects.Graphics, d: Department) {
    const { x, y, width: w, height: h } = d,
      c = hex(d.color);
    g.fillStyle(0x000000, 0.45).fillRoundedRect(
      x - 12,
      y + 5,
      w + 24,
      h + 24,
      18,
    );
    g.fillStyle(0x182328).fillRoundedRect(x - 10, y - 10, w + 20, h + 28, 18);
    g.fillStyle(0x425053).fillRoundedRect(x - 5, y - 5, w + 10, h + 15, 14);
    g.lineStyle(2, 0x7a8885).strokeRoundedRect(
      x - 5,
      y - 5,
      w + 10,
      h + 15,
      14,
    );
    g.fillStyle(colors.floor).fillRect(x + 9, y + 14, w - 18, h - 19);
    for (let tx = x + 10; tx < x + w - 10; tx += 23)
      for (let ty = y + 42; ty < y + h - 8; ty += 23) {
        g.fillStyle(
          (Math.floor((tx - x) / 23) + Math.floor((ty - y) / 23)) % 2
            ? 0x303a39
            : 0x2b3433,
        ).fillRect(tx, ty, 22, 22);
        g.fillStyle(0x47504a, 0.28).fillRect(tx + 3, ty + 3, 2, 2);
      }
    g.fillStyle(0x202d30).fillRect(x + 9, y + 10, w - 18, 31);
    g.fillStyle(c, 0.7).fillRect(x + 26, y + 42, 130, 2);
    // Wall panels, braces, floor warning stripes and an open airlock to the shared corridor.
    for (let i = 0; i < 12; i++) {
      g.fillStyle(0x697577).fillRect(x + 14 + i * 38, y - 4, 25, 7);
      g.fillStyle(0x25383a).fillRect(x + 18 + i * 38, y + 1, 17, 2);
      g.fillStyle(0x263438).fillRect(x + 12 + i * 38, y + h + 2, 27, 10);
      g.fillStyle(0x6e7a79).fillRect(x + 18 + i * 38, y + h + 4, 3, 3);
    }
    const doorX = x < 700 ? x + w - 3 : x - 5;
    g.fillStyle(0x324143).fillRect(doorX, y + 100, 8, 64);
    g.fillStyle(c)
      .fillRect(doorX + 2, y + 102, 4, 6)
      .fillRect(doorX + 2, y + 154, 4, 6);
    g.fillStyle(0x7d8063).fillRect(x + 32, y + h - 19, 35, 3);
    for (let i = 0; i < 3; i++)
      g.fillStyle(0x283231).fillRect(x + 37 + i * 10, y + h - 19, 4, 3);
  }

  private desk(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    color: number,
  ) {
    g.fillStyle(0x151e20, 0.7).fillRect(x - 40, y - 37, 81, 37);
    g.fillStyle(0x606b62).fillRect(x - 39, y - 43, 78, 24);
    g.fillStyle(0x7a8578).fillRect(x - 38, y - 43, 76, 3);
    g.fillStyle(0x414d49).fillRect(x - 37, y - 19, 74, 8);
    g.fillStyle(0x879180)
      .fillRect(x - 35, y - 14, 5, 6)
      .fillRect(x + 30, y - 14, 5, 6);
    g.fillStyle(0x182426).fillRect(x - 18, y - 57, 36, 24);
    g.lineStyle(2, 0x83918a).strokeRect(x - 18, y - 57, 36, 24);
    g.fillStyle(0x34554d).fillRect(x - 14, y - 53, 28, 16);
    g.fillStyle(color, 0.7)
      .fillRect(x - 11, y - 50, 12, 2)
      .fillRect(x - 11, y - 45, 20, 1)
      .fillRect(x - 11, y - 41, 15, 1);
    g.fillStyle(0x1c2e2b).fillRect(x - 11, y - 28, 24, 7);
    g.fillStyle(0xa8b5a0).fillRect(x + 25, y - 34, 5, 6);
    g.fillStyle(0x263235).fillRect(x - 11, y + 3, 22, 14);
    g.fillStyle(0x58675f).fillRect(x - 12, y + 2, 24, 8);
    g.fillStyle(0x7a8978).fillRect(x - 9, y + 3, 18, 2);
  }

  private plant(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x27302e).fillRect(x - 9, y - 2, 18, 13);
    g.fillStyle(0x7b8572).fillRect(x - 10, y - 4, 20, 5);
    g.fillStyle(0x4a775c)
      .fillRect(x - 6, y - 21, 8, 18)
      .fillRect(x + 2, y - 17, 8, 13);
    g.fillStyle(0x7aa070)
      .fillRect(x - 8, y - 24, 6, 13)
      .fillRect(x + 2, y - 20, 5, 10);
  }

  private generateCharacters() {
    (this.dataSnapshot?.departments || []).forEach(({ id, color }) => {
      for (let frame = 0; frame < 4; frame++) {
        const g = this.make.graphics({ x: 0, y: 0 });
        g.fillStyle(0x000000, 0.3).fillEllipse(12, 30, 22, 6);
        g.fillStyle(0x23343a)
          .fillRect(7, 23, 5, 7 + (frame === 1 ? 1 : 0))
          .fillRect(14, 23, 5, 7 - (frame === 1 ? 2 : 0));
        g.fillStyle(0x8c9e92).fillRect(6, 29, 6, 3).fillRect(14, 29, 6, 3);
        g.fillStyle(hex(color)).fillRect(5, 13, 16, 12);
        g.fillStyle(0x53725b).fillRect(5, 22, 16, 3);
        g.fillStyle(0x1c3332).fillRect(10, 14, 5, 8);
        g.fillStyle(0xc6a480)
          .fillRect(3, 15 + (frame === 1 ? 2 : 0), 3, 8)
          .fillRect(20, 15 + (frame === 3 ? 2 : 0), 3, 8);
        g.fillStyle(0x212a2b).fillRect(7, 1, 12, 12);
        g.fillStyle(0xd2b38d).fillRect(8, 5, 10, 8);
        g.fillStyle(0x343d39).fillRect(6, 2, 14, 5);
        g.fillStyle(0x9adacc).fillRect(9, 7, 9, 3);
        g.generateTexture(`worker-${id}-${frame}`, 26, 34);
        g.destroy();
      }
    });
  }

  sync(snapshot: Snapshot) {
    const first = !this.dataSnapshot;
    this.dataSnapshot = snapshot;
    this.clockOffset = snapshot.server_time - Date.now() / 1000;
    if (first && this.ready) this.buildRooms(snapshot);
  }

  select(id: string, focus = false) {
    this.selected = id;
    const room = this.dataSnapshot?.departments.find((d) => d.id === id);
    if (!room || !this.outline) return;
    this.outline
      .clear()
      .lineStyle(2, hex(room.color), 0.8)
      .strokeRoundedRect(
        room.x - 13,
        room.y - 13,
        room.width + 26,
        room.height + 36,
        20,
      );
    if (focus) {
      this.cameras.main.pan(room.x + 240, room.y + 125, 500, "Sine.easeInOut");
      this.cameras.main.zoomTo(
        Math.min(this.scale.width / 650, this.scale.height / 390, 1.8),
        500,
      );
    }
  }

  resetView() {
    if (!this.ready) return;
    this.fit = Math.min(this.scale.width / 1520, this.scale.height / 1130);
    this.cameras.main.setZoom(this.fit).centerOn(730, 550);
  }
  zoom(delta: number) {
    if (!this.ready) return;
    this.cameras.main.setZoom(
      Phaser.Math.Clamp(this.cameras.main.zoom + delta, this.fit * 0.65, 2.5),
    );
  }

  /** Read-only coordinates and states for local diagnostics and browser regression checks. */
  inspect() {
    const c = this.cameras.main;
    return {
      ready: this.ready,
      camera: {
        zoom: c?.zoom,
        scrollX: c?.scrollX,
        scrollY: c?.scrollY,
        worldView: { x: c?.worldView.x, y: c?.worldView.y },
      },
      agents: (this.dataSnapshot?.agents || []).map((a) => ({
        id: a.id,
        department: a.department,
        state: a.state,
        x: this.tiles.get(a.id)?.body.x,
        y: this.tiles.get(a.id)?.body.y,
      })),
      tasks: (this.dataSnapshot?.tasks || []).map((t) => ({
        id: t.id,
        department: t.department,
        status: t.status,
      })),
    };
  }

  update(_time: number, delta: number) {
    if (!this.ready) return;
    const pointers = this.input.manager.pointers.filter((p) => p.isDown);
    if (pointers.length >= 2) {
      const distance = Phaser.Math.Distance.Between(
        pointers[0].x,
        pointers[0].y,
        pointers[1].x,
        pointers[1].y,
      );
      if (this.lastTouchDistance)
        this.zoom((distance - this.lastTouchDistance) * 0.003);
      this.lastTouchDistance = distance;
      this.pinchActive = true;
      this.dragging = false;
    } else {
      this.lastTouchDistance = 0;
      this.pinchActive = false;
    }
    const k = this.keys,
      cam = this.cameras.main;
    // Do not steal keyboard input while a form field or dialog is in use.
    const tag = document.activeElement?.tagName;
    if (
      k &&
      !["INPUT", "SELECT", "TEXTAREA"].includes(tag || "") &&
      !document.querySelector("dialog[open]")
    ) {
      const step = (delta * 0.55) / cam.zoom;
      if (k.W.isDown || k.UP.isDown) cam.scrollY -= step;
      if (k.S.isDown || k.DOWN.isDown) cam.scrollY += step;
      if (k.A.isDown || k.LEFT.isDown) cam.scrollX -= step;
      if (k.D.isDown || k.RIGHT.isDown) cam.scrollX += step;
    }
    const now = Date.now() / 1000 + this.clockOffset;
    for (const agent of this.dataSnapshot?.agents || []) {
      const t = this.tiles.get(agent.id);
      if (!t) continue;
      const p = this.position(agent, now);
      const moving = agent.state === "Moving";
      const active = ["Working", "Reviewing"].includes(agent.state);
      const frame = moving
        ? Math.floor(now * 8) % 4
        : active
          ? Math.floor(now * 2) % 2
          : 0;
      t.body
        .setPosition(p[0], p[1])
        .setTexture(`worker-${agent.department}-${frame}`);
      t.label
        .setPosition(p[0], p[1] + 13)
        .setVisible(cam.zoom > 0.62 || agent.department === this.selected);
      const c =
        agent.state === "Error"
          ? 0xf28b82
          : agent.state === "Idle"
            ? 0x7a9183
            : hex(agent.color);
      t.status.setPosition(p[0] + 15, p[1] - 22).setFillStyle(c);
      t.glow.clear();
      if (active)
        t.glow
          .lineStyle(2, c, 0.4 + Math.sin(now * 3) * 0.2)
          .strokeEllipse(p[0], p[1] - 1, 32, 13);
      t.deskGlow.setAlpha(active ? 0.12 + Math.sin(now * 3) * 0.05 : 0);
    }
  }

  private position(agent: Agent, now: number): Point {
    if (!agent.route) return agent.position;
    const points = agent.route.points;
    let lengths = points
      .slice(1)
      .map((p, i) =>
        Phaser.Math.Distance.BetweenPoints(
          { x: p[0], y: p[1] },
          { x: points[i][0], y: points[i][1] },
        ),
      );
    let remaining =
      lengths.reduce((a, b) => a + b, 0) *
      Phaser.Math.Clamp(
        (now - agent.route.started) / agent.route.duration,
        0,
        1,
      );
    for (let i = 0; i < lengths.length; i++) {
      if (remaining <= lengths[i] || i === lengths.length - 1) {
        const f = lengths[i] ? Math.min(1, remaining / lengths[i]) : 1;
        return [
          Phaser.Math.Linear(points[i][0], points[i + 1][0], f),
          Phaser.Math.Linear(points[i][1], points[i + 1][1], f),
        ];
      }
      remaining -= lengths[i];
    }
    return agent.position;
  }
}

export function createHeadquarters(parent: string) {
  const scene = new Headquarters();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#080e11",
    pixelArt: true,
    antialias: false,
    scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
    input: { activePointers: 3 },
    scene: [scene],
    render: { roundPixels: true },
    audio: { noAudio: true },
  });
  Object.defineProperty(window, "tycoonStation", {
    value: Object.freeze({ inspect: () => scene.inspect() }),
  });
  return { scene, game };
}
