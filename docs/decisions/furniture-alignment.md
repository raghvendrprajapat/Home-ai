# D55 — FR-019 furniture alignment

FR-019 (Should, C1), the "align" part. Third task of Claude Code's D52 continuation. No D36 scope. **Grouping is deliberately not part of this task** (see below).

**What the user gets.** In the Selection panel, with two or more furniture items selected (multi-select, list or Shift-click), six buttons align their left edges, right edges, top edges, bottom edges, or centre lines (left-to-right, top-to-bottom). It is one command and one Undo. Selecting anything other than furniture, or fewer than two items, keeps the buttons disabled. Aligning something already aligned does nothing and adds no history. Messages are English and Hindi.

**One atomic command.** `AlignFurniture { furnitureIds, mode }` in core-model, like every other edit: 2 to 500 different existing furniture IDs, a known mode, otherwise the whole command is rejected and the model is unchanged. Moved items keep their other coordinate, rotation, size, materials and ID.

**Geometry.** Each footprint's axis-aligned bounding box is computed from its size and rotation (half-extents `(|cos|·w + |sin|·d)/2` and `(|sin|·w + |cos|·d)/2`). The reference line comes from the original positions before anything moves: left = smallest left edge, right = largest right edge, top/bottom likewise, centre = middle of the combined box. Positions are integer mm, so each centre is rounded to the nearest mm: an item at 0°, 90°, 180° or 270° lands exactly, other angles within 0.5 mm of the exact edge. A result outside the ±100,000 mm drawing domain rejects the whole command.

**Not blocked.** Alignment can make items overlap each other or walls; the existing non-blocking collision warnings still apply.

**Deliberately not done.**
- **Grouping/ungrouping** (FR-019 "group transform = one undo"). The model already carries an optional `groupId` and duplicates drop it, but a real group needs group-aware move/rotate in 2D drag, 3D drag, arrow keys and the property panel. That is a larger change to the gesture stack and is left for a separate task.
- Distribute evenly, align to a wall or room, and aligning openings or walls.
- Rotation-aware alignment of the rotated outline (the box, not the outline, is aligned).

Tests are Claude-authored analytic/property/browser checks, not independent fixtures. See [the verification record](../verification/fr-019-furniture-align.md).
