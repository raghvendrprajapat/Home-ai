# D60 — FR-019 moving and turning a furniture group in 3D

Follows D57 (grouping) and D58 (turning together). This is the eighth task of Claude Code's D52 continuation. No D36 scope.

**Change from D57.** D57 locked 3D Move/Rotate for grouped items, with a message pointing to the 2D plan. That lock is removed. A grouped item now has the normal 3D Move/Rotate tools, and they act on the whole group. The 3D panel shows "This item is in a group: Move and Rotate act on the whole group".

**Behaviour.**
- **Move:** dragging any member of the selected item's group moves the whole group. The touched (selected) item lands on the 50 mm grid (or free with Shift / the Free option), and every member gets exactly that integer delta through `MoveFurniture`. This is one preview, one commit and one Undo, the same as a single item.
- **Rotate:** the drag angle is measured about the group's turn pivot, which is the same rounded combined-box centre `RotateFurniture` (D58) uses. The pivot now comes from one shared function, `furnitureTurnPivot`, in core-model. The delta snaps to 15° steps (or is free with Shift), and `RotateFurniture` turns every member about that pivot. A grab closer than 12 px to the pivot on screen is refused, as for single items.
- **Opt-in only:** the existing 3D gesture code builds group commands only when the 3D pointer asks for them (`beginFurnitureGesture(..., { group: true })`).
  - The 2D handle and arrow keys for a single member, picked explicitly in the selection list, still edit that one item.
  - A lone leftover member (a group of fewer than two) still edits alone.

**Not done.**
- Free placement snapping of the group against walls.
- Collision or back-wall advisories for a whole group.
- Touch two-finger group rotation.

Tests are Claude-authored analytic/browser checks, not independent fixtures. See [the verification record](../verification/fr-019-group-3d.md).
