# D66: FR-035 straight stairs and simple roofs

Status: accepted by Claude Code under the D52 continuation and the owner's D63 permission (2026-10-18).
Builds on D64 (multiple floors). The spec has no stair or roof schema and no stair dimension rules, so this records
the design. The app states: **"Planning tool only, not construction, structural or building-code advice."**

## Model (schema 1, two optional arrays)
- `stairs?: Stair[]` (at most 50):
  - Fields: `{id, floorId, position{x,y}, rotationDeg 0|90|180|270, width 600–2000, length 1000–8000, height 500–6000, steps 2–30, material, rev}`.
  - `position` is the centre of the footprint. `rotationDeg` is the climb direction, clockwise on screen: 0 means up the plan.
  - The stair climbs `height` in `steps` equal risers over `length`. Riser = height / steps; tread = length / steps.
  - The stair's whole footprint must stay inside the ±100 m drawing limits.
- `roofs?: Roof[]` (at most one per floor, at most 6):
  - Fields: `{id, floorId, kind flat|gable, pitchDeg 5–60, overhang 0–1000, ridgeAxis x|y, material, rev}`.
  - The roof covers its floor's outer wall rectangle (each wall's centreline widened by half its thickness) plus the overhang.
  - It rests on that floor's tallest wall.
  - A flat roof is drawn as a 150 mm slab. A gable rises half-span × tan(pitch) to a central ridge along `ridgeAxis`.
- **Why optional arrays in schema 1 instead of schema 2:**
  - The product has not been released, so no older app exists that would need a "please update" message.
  - Existing documents, the H.6 sample and the accepted fixtures stay valid and byte-identical, because the arrays are left out when empty. Commands remove an emptied array.
  - The cloud database (D65) checks only the nine required arrays, so it accepts these documents.
  - Once a release exists, any further schema change must follow the D23 migration rules.
- **Commands (atomic, undoable):**
  - `AddStair` and `SetRoof` install their finish material exactly like `ApplySurfaceMaterial`. A different definition under the same id is refused.
  - `UpdateStair` and `DeleteStair`.
  - `SetRoof` with `null` removes the roof.
  - `DeleteFloor` also removes that floor's stairs and roof.
  - The recovery copy renames stair and roof ids, floors and materials.

## Display
- **2D (active floor only):**
  - Each stair is drawn as its footprint, one line per riser and an arrow up the climb.
  - The roof edge is a dashed outline.
  - Neither can be picked or dragged on the canvas; it is edited in the "Stairs and roof" panel.
- **3D:**
  - Each stair is a closed solid of stacked step boxes.
  - The roof is a closed solid: either a slab, or two slopes plus two gable ends and a soffit.
  - Each has its own material slot, so a colour change only rebinds.
  - A wall or floor change redraws the roofs.
  - Neither can be picked yet.
- **Panel defaults:** a new stair climbs to the floor above (or the wall height), using round(height / 175) steps and 250 mm treads. It is centred on the floor's outer rectangle.

## Not done
- No floor slabs or stair openings in an upper floor.
- No L, U or spiral stairs, and no railings.
- No hip roofs, roofs over non-rectangular outlines, or per-room roofs.
- No dragging stairs on the canvas, and no clash warnings with furniture or walls.
- No phone test.
