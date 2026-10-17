# D54 — FR-003 project templates

FR-003 (Should, C1). Second task of Claude Code's D52 continuation. No D36 scope: nothing touches accounts, cloud, billing, phone testing or release work.

**What the user gets.** The New project dialog has a "Start from" choice (default: Blank drawing). Options: 1 BHK home, 2 BHK home and four single-room presets (bedroom, living room, kitchen, bathroom). The result opens as the user's own ordinary project: named rooms in the chosen language, 230 mm outer and 115 mm inner walls, doors, windows and, in the 2 BHK, one wide archway. Everything can be edited, undone and deleted like a hand-drawn plan. Undo history starts empty and the project is saved immediately like any new project.

**Built through the real commands.** `createTemplateProject` (core-model/templates.ts) starts from `createBlankProject` and then runs `AddRectangle`, `AddWall`, `UpdateRoom` and `AddOpening` on a throw-away `ProjectStore`. A template therefore passes exactly the same validation, normalization and room detection as a drawn plan, and a template that ever became invalid throws instead of returning a half-built document. No schema, command or persistence change.

**Layout rules.**
- Coordinates are centreline integer mm. Layouts are fixed data in `TEMPLATES`; room and opening positions are given as world points, so wall splitting cannot move a door.
- Partitions are staggered where two rooms meet a shared wall (for example 3000 vs 3600 mm), so no junction ever has four walls (L0 allows L/T junctions only).
- An exactly even split asks the engine which half keeps the original room identity. Rooms are still unnamed at that stage, so the builder deterministically keeps the half west/north of the partition using the engine's own `roomChoices`.
- Room names come from the app's existing `room_*` labels (English/Hindi); repeated types are numbered ("Bedroom", "Bedroom 2").
- Doors/windows use the same placeholder asset IDs as the opening editor (`door_asset`, `window_asset`).

**Deliberately not done.** No furniture in templates (catalog items need pinned asset versions and real placement; adding them later is a data change). No template preview thumbnails, no user-saved templates, no imperial-specific dimensions (units only change display). Layout dimensions are plausible starting points, not a claim about any real flat or a design recommendation. Template names and hints were written by Claude and have had no native-speaker or user review.

Tests are Claude-authored analytic checks, not independent fixtures. See [the verification record](../verification/fr-003-templates.md).
