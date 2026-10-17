# D59 — FR-022 furniture colour variants (finishes)

PRD-FR-022 asks for materials on wall sides, floors (done, D47–D49) and **furniture colour variants** (Should). This is the seventh task of Claude Code's D52 continuation. No D36 scope.

**What the user gets.**
- In the Selection panel, with one or more furniture items selected (a group included), a **Furniture colour** row offers eight original solid finishes plus **Original colours**: teak, walnut, white, charcoal, sage green, navy, terracotta and mustard.
- One tap recolours every selected item's **main colour**, as one command with one Undo. The chosen swatch shows as pressed.
- The 2D plan and the plan PNG fill the item with that colour.
- In 3D the real catalog model is drawn with its main material recoloured; small parts (legs, handles, pillows) keep their own colours.
- English and Hindi.

**Model.**
- **Command:** `SetFurnitureFinish { furnitureIds, material | null }`, atomic.
  - It takes 1–500 different existing IDs.
  - A material is installed once into `document.materials`. An ID that already has a different definition is rejected; definitions are never overwritten.
  - Each item's `materialOverrides` becomes `{ main: <materialId> }`, or `{}` for null.
  - Repeating the same finish is a no-op with no history.
- **Slot:** `main` (`FURNITURE_FINISH_SLOT`) is the one slot the app understands. There is no schema change: `materialOverrides` already allowed any key, and the validator already requires existing material IDs.
- **Main material:** the model material covering the largest total part volume, measured from the decoded part bounding boxes; the first one wins a tie. Every catalog model is built from coloured boxes, so this is the body, seat, top or frame.
- **Other overrides:** any other override (another key, more than one key, or a missing material, as in the sample's `frame` override) is still "finish not supported". The 3D view shows the measured fallback box and the model list says so, as before.

**Renderer.**
- 3D displays are grouped per asset **and** finish colour, so items with the same colour still share instancing.
- The finish recolours a per-display **clone** of the main material, keeping the shared shader hook. The decoded shared material is never changed.
- The clone is disposed with its display. Leases still count by asset entry, so a displayed finish keeps its decoded model alive.

**Deliberately not done.**
- Textures or patterns.
- Per-part colour choice.
- A custom colour picker.
- Recolouring the fallback box. A model that has not loaded, or failed, still shows the neutral box.

Tests are Claude-authored analytic/browser checks, not independent fixtures. See [the verification record](../verification/fr-022-furniture-finishes.md).
