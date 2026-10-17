# D58 — FR-019 turning furniture together (group rotation)

This follows D57 grouping. It is the sixth task of Claude Code's D52 continuation. No D36 scope.

**What the user gets.**
- In the Selection panel, with two or more furniture items selected (a group or any multi-selection), **Turn selection 90° left** and **Turn selection 90° right** turn them together about their shared centre. It is one command and one Undo.
- In the 2D plan, **Q / E** turn a selected whole group by 15°, matching the single-item keys.
- English and Hindi.

**One atomic command.** `RotateFurniture { furnitureIds, deltaDeg }` in core-model.
- It takes 1–500 different existing IDs and a finite angle within ±360°. Anything else rejects the whole command and leaves the model unchanged.
- An angle that is a multiple of 360° is a no-op with no history.

**Geometry.**
- **Direction:** positive degrees turn clockwise on screen (plan Y points down). This is the same convention as the furniture footprint (`right = (cos, sin)`) and the 3D yaw (`rotation.y = −θ`).
- **Pivot:** the centre of the items' combined axis-aligned bounding box, rounded to the nearest mm.
- **Each item:** its centre offset from the pivot is turned, `(dx, dy) → (dx·cos − dy·sin, dx·sin + dy·cos)`, and rounded to integer mm. Its `rotationDeg` gains the angle, normalized to [0, 360).
- **Accuracy:** multiples of 90° are exact (cos and sin are snapped to −1/0/1), so four quarter turns give back the same document. Other angles move each centre at most 0.5 mm per axis per turn.
- **Domain:** a result outside the ±100,000 mm drawing domain rejects the whole command.

**Not done.**
- Free-angle group rotation by dragging.
- Turning a group in 3D (3D single-item tools stay locked for grouped items, per D57).
- Rotating walls, openings or rooms.

Tests are Claude-authored analytic/property/browser checks, not independent fixtures. See [the verification record](../verification/fr-019-group-rotation.md).
