"""End-to-end check using a real browser, a built client and a temporary SQLite store."""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'test-results'
OUTPUT.mkdir(exist_ok=True)


def main():
    with tempfile.TemporaryDirectory() as folder, socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
        sock.close()
        env = os.environ.copy()
        env['TYCOON_DB'] = str(Path(folder) / 'browser.sqlite3')
        with open(Path(folder) / 'server.log', 'w+') as log:
            server = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'backend.app:app',
                                       '--host', '127.0.0.1', '--port', str(port)],
                                      cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
            try:
                url = f'http://127.0.0.1:{port}'
                for _ in range(60):
                    try:
                        with urllib.request.urlopen(url + '/api/health', timeout=1) as response:
                            assert json.load(response)['real_execution_enabled'] is False
                        break
                    except OSError:
                        time.sleep(0.2)
                else:
                    raise AssertionError('Test server failed to start')
                run_browser(url)
            finally:
                server.terminate()
                try:
                    server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait()
                if server.returncode not in (0, -15):
                    log.seek(0)
                    print(log.read())


def run_browser(url):
    errors = []
    with sync_playwright() as p:
        chromium = os.environ.get('TYCOON_CHROMIUM') or shutil.which('chromium')
        browser = p.chromium.launch(executable_path=chromium, headless=True,
                                    args=['--no-sandbox'] if os.name != 'nt' else [])
        page = browser.new_page(viewport={'width': 1512, 'height': 982}, device_scale_factor=1)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
        page.goto(url)
        expect(page.locator('.dept-nav')).to_have_count(6)
        expect(page.locator('#connection-text')).to_have_text('STATION SYSTEMS ONLINE')
        expect(page.locator('canvas')).to_have_count(1)
        page.wait_for_function('window.tycoonStation?.inspect().agents.length === 16')
        scene = 'window.tycoonStation.inspect()'
        initial_zoom = page.evaluate(f'{scene}.camera.zoom')
        idle_start = page.evaluate(f'{scene}.agents.map(a=>[a.x,a.y])')
        page.wait_for_timeout(700)
        assert idle_start == page.evaluate(f'{scene}.agents.map(a=>[a.x,a.y])'), 'Idle agents roamed'
        # Pick every rendered employee through the actual canvas, not only the roster.
        for agent in page.evaluate(f'{scene}.agents'):
            page.locator('#fit').click()
            page.wait_for_timeout(60)
            point = page.evaluate(f'''(()=>{{const s={scene}, c=s.camera;
              const a=s.agents.find(a=>a.id==={json.dumps(agent['id'])});
              return {{x:(a.x-c.worldView.x)*c.zoom,y:(a.y-c.worldView.y)*c.zoom}};}})()''')
            box = page.locator('canvas').bounding_box()
            assert 0 <= point['x'] <= box['width'] and 0 <= point['y'] <= box['height'], f"Agent offscreen: {agent['id']}"
            page.mouse.click(box['x']+point['x'], box['y']+point['y'])
            expect(page.locator(f'[data-agent="{agent["id"]}"].selected .agent-detail')).to_be_visible()
        page.locator('[data-department="arbitrage"]').click()
        page.locator('[data-tab="overview"]').click()
        page.locator('#fit').click()
        page.screenshot(path=str(OUTPUT / 'headquarters-desktop.png'), full_page=True)

        # Camera buttons, a genuine canvas drag, wheel zoom, and room picking.
        page.locator('#focus-dept').click()
        page.wait_for_timeout(650)
        assert page.evaluate(f'{scene}.camera.zoom') > initial_zoom
        page.locator('#fit').click()
        canvas = page.locator('canvas').bounding_box()
        x, y = canvas['x'] + canvas['width']/2, canvas['y'] + canvas['height']/2
        before = page.evaluate(f'{scene}.camera.scrollX')
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x+45, y+15, steps=8)
        page.mouse.up()
        assert abs(page.evaluate(f'{scene}.camera.scrollX') - before) > 20
        page.mouse.wheel(0, -100)
        page.wait_for_timeout(100)
        assert page.evaluate(f'{scene}.camera.zoom') > initial_zoom
        page.locator('#fit').click()
        page.wait_for_timeout(100)
        point = page.evaluate(f'''(()=>{{const s={scene}, c=s.camera;
          return {{x:(930-c.worldView.x)*c.zoom,y:(610-c.worldView.y)*c.zoom}};}})()''')
        page.mouse.click(canvas['x']+point['x'], canvas['y']+point['y'])
        expect(page.locator('#department-title')).to_have_text('Agent Headquarters')
        page.locator('[data-department="arbitrage"]').click()
        page.locator('#stake').fill('0')
        page.locator('#assign-task').click()
        assert len(page.request.get(url+'/api/state').json()['tasks']) == 0, 'Invalid stake was dispatched'
        page.locator('#stake').fill('100')
        page.locator('#assign-task').click()
        expect(page.locator('#assign-task')).to_be_disabled()
        page.wait_for_function(f'{scene}.agents.some(a=>a.id==="scout"&&a.state==="Moving")')
        moving_start = page.evaluate(f'({{x:{scene}.agents.find(a=>a.id==="scout").x,y:{scene}.agents.find(a=>a.id==="scout").y}})')
        page.wait_for_timeout(600)
        moving_end = page.evaluate(f'({{x:{scene}.agents.find(a=>a.id==="scout").x,y:{scene}.agents.find(a=>a.id==="scout").y}})')
        assert moving_start != moving_end, 'Assigned agent did not visibly move'
        page.screenshot(path=str(OUTPUT / 'agents-working.png'), full_page=True)
        page.wait_for_function(f'{scene}.tasks[0]?.status === "Completed"', timeout=45000)
        page.locator('[data-report]').first.click()
        expect(page.locator('#report-dialog')).to_be_visible()
        expect(page.get_by_text('SIMULATED OUTPUT · NO LIVE DATA · NO REAL INCOME')).to_be_visible()
        expect(page.get_by_text('RISK CHECK PASSED')).to_be_visible()
        expect(page.get_by_text('REJECTED', exact=True)).to_be_visible()
        page.locator('#paper-order').click()
        expect(page.locator('#paper-order')).to_have_text('Paper order recorded')
        expect(page.locator('#paper-order')).to_be_disabled()
        expect(page.locator('#capital')).to_contain_text('9,784')
        page.screenshot(path=str(OUTPUT / 'paper-scan-report.png'), full_page=True)
        page.locator('[data-close]').click()
        page.wait_for_function(f'{scene}.agents.filter(a=>a.department==="arbitrage").every(a=>a.state==="Idle")')
        page.reload()
        expect(page.locator('[data-report]')).to_have_count(1)
        assert len(page.request.get(url+'/api/state').json()['trades']) == 1

        # Another department executes a backend job using the selected worker.
        page.locator('[data-department="etsy"]').click()
        page.locator('#worker').select_option('loom')
        page.locator('#assign-task').click()
        page.wait_for_function(f'{scene}.tasks.some(t=>t.department==="etsy"&&t.status==="Completed")',timeout=20000)
        page.locator('[data-report]').click()
        expect(page.get_by_text('Local demonstration report · not real business research.')).to_be_visible()
        page.locator('[data-close]').click()
        page.locator('[data-tab="agents"]').click()
        page.locator('[data-agent="loom"]').click()
        expect(page.locator('.agent-detail')).to_be_visible()

        # A connection loss must be visible and must disable assignments, then recover.
        page.locator('[data-tab="overview"]').click()
        page.route('**/api/state', lambda route: route.abort())
        expect(page.locator('#connection-text')).to_have_text('BACKEND OFFLINE · RETRYING',timeout=10000)
        expect(page.locator('#assign-task')).to_be_disabled()
        page.unroute('**/api/state')
        expect(page.locator('#connection-text')).to_have_text('STATION SYSTEMS ONLINE',timeout=10000)
        # Intentionally aborted requests emit Chromium net::ERR_FAILED messages.
        errors = [e for e in errors if 'net::ERR_FAILED' not in e]

        for width, height in [(1024,768),(390,844)]:
            page.set_viewport_size({'width':width,'height':height})
            page.wait_for_timeout(400)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Horizontal overflow at {width}'
            page.locator('[data-department="retail"]').click()
            page.locator('#department-title').scroll_into_view_if_needed()
            expect(page.locator('#department-title')).to_have_text('Retail Arbitrage')
            page.screenshot(path=str(OUTPUT / f'headquarters-{width}.png'),full_page=True)
        page.locator('#help').click()
        expect(page.get_by_text('Welcome aboard, Commander.')).to_be_visible()
        page.keyboard.press('Escape')
        expect(page.locator('#report-dialog')).not_to_be_visible()
        assert not errors, f'Browser errors: {errors}'
        browser.close()
    print('PASS: canvas navigation, idle stability, task-driven animation, simulated scan, risk report, paper reservation, persistence, worker selection, offline recovery, responsive layout and help. Screenshots in test-results/.')


if __name__ == '__main__':
    main()
