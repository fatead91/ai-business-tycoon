# Reference study

Source: `AI_Business_Tycoon_Reference_Under32MB.mp4`, supplied by the user, approximately 2 minutes 59 seconds, portrait recording of a monitor. Inspected a full-duration contact sheet and more closely sampled the opening 40 seconds before implementation. The reference is filmed at an angle, so small text and individual animation frames are not consistently legible. No claim of exact pixel or motion reproduction is made.

## Observed visual characteristics

- Opening: an overhead space station against a very dark star field. Large rectangular rooms occupy the corners, with smaller central rooms, narrow corridors and airlocks connecting them.
- The rooms have substantial silver/grey wall rims, industrial patterned floors, modular desks, individual computer monitors and small coloured employees.
- The map can be viewed as a whole or zoomed into a room. Around 4–24 seconds, closer views show employees distributed among rows of workstations.
- The surrounding application uses dark panels, thin neon-green outlines and compact green terminal text. Side panels contain agent information and job messages.
- Later sections show task/pipeline configuration, an inbox and steps that need agents, followed by marketplace service pages. Text inside the recording is reference content, not an instruction to execute or reproduce those external workflows.

## Applied to the prototype

The six requested departments replace the reference's larger collection of rooms. Modular metal wall edges, gridded floors, computer rows, plants, equipment racks, connecting corridors, lit junctions and generated pixel characters create the same broad spatial feel. The interface uses a less saturated green for readable labels, with a brighter green for active controls.

Phaser draws the entire navigable world rather than placing hotspots over a screenshot. Department selection, camera focus, zoom, pan and agent inspection are interactive. All art is generated from simple shapes, requiring no licensed sprite packs, remote assets or runtime CDN access.

The user's explicit purposeful-movement requirement determines behaviour: only assigned tasks create movement routes. Workers gather fixture data, pass it to risk management, then to the controller. Workstations glow during work. Idle employees do not roam. The source video alone is insufficient to establish its underlying movement logic; this implementation follows the user's requested semantics.
