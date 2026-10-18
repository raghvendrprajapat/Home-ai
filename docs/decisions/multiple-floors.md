# D64 — FR-034 multiple floors

The owner moved FR-034 into the first release (D63, 2026-10-18). Walls stay at 0°/90°. This is Claude Code's D52 builder work.

**What the user gets.**
- **Floor bar** above the drawing: one tab per floor, plus **+ Add floor**. The checkbox "Copy outer walls of the top floor" is on by default.
- **This floor** settings: rename, or delete with a confirmation that names how many walls and furniture items go with it.
- **2D plan:** shows and edits **only the active floor**, including drawing, snapping, picking, selection, lists, furniture placement and wall snapping. New walls and furniture land on the active floor.
- **3D:** shows the whole house, each floor at its own height. While a lower floor is active, everything above it is **cut away**; "Show floors above" turns the cutaway off. Walk mode walks on the active floor. Switching floors ends a walk.
- **Header:** says "N floors". The editor footer names the active floor.
- **Limits:** 1–6 floors. Every change is one Undo.

**Model rules.**
- **Floor data:** `floors` already existed. Each floor has `{id, name, level, elevation, defaultWallHeight}`, and junctions, walls, rooms, furniture and lights carry `floorId`.
- **Validation (`floors` code):** 1–6 floors, distinct integer levels, and elevations strictly increasing with level. The old "exactly one floor" rule is removed.
- **New commands:**
  - `AddFloor { name, copyOutlineFrom? }` adds a floor on top. Its level is the top level + 1. Its elevation is the top floor's elevation plus that floor's wall height (3000 mm on the sample). Its wall height is copied from the top floor.
  - "Outline" means every wall that borders fewer than two rooms: the outer walls plus open chains, never interior partitions. Copied walls get new IDs and the new floor's wall height. Rooms are derived as usual.
  - `UpdateFloor { name, elevation, defaultWallHeight }` is validated as above.
  - `DeleteFloor` removes the floor and everything on it, including openings on its walls, in one atomic step. The last floor cannot be deleted.
- **Changed commands:** `AddWall`/`AddRectangle` take an optional `floorId` (default: the first floor, as before). Joining to existing walls only considers that floor.

**Geometry per floor.**
- `derivePlan` derives each floor as its own planar graph. Stacked floors never share footprints, faces or nesting checks.
- Room identity (`assignRooms`) only passes between rooms on the same floor, using that floor's walls for clear areas.
- Wall normalization was already floor-aware.
- 3D wall solids are built per floor at that floor's elevation. Floors, ceilings, thresholds and furniture use their own floor's elevation.
- Geometry-change invalidation never crosses floors.
- **One-floor projects derive exactly as before.** The property test checks this, and all existing tests and the PR #60 fixtures pass unchanged.

**How the 2D view is scoped.** `createFloorScope` wraps the project store, keeping the same identity. Its snapshots and previews are floor views, and it adds the active `floorId` to wall commands. Commands still run on the one canonical store. Saving, export, the 3D view, camera bookmarks, 3D images and header totals use the whole project. For a one-floor project the view is the full project, unchanged.

**Not done.**
- Floor slabs between levels: each floor shows its room floor planes only.
- Stairs and roofs: FR-035, next.
- Copying rooms or furniture between floors.
- Per-floor plan image selection: the 2D image exports the active floor.
- Premium-only extra floors: billing is still gated.

Tests are Claude-authored analytic/property/browser checks, not independent fixtures. See [the verification record](../verification/fr-034-floors.md).
