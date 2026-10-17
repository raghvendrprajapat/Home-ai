# FR-019 — moving and turning a group in 3D

2026-10-17 · [D60](../decisions/furniture-group-3d.md) · [D57](../decisions/furniture-grouping.md) · [D58](../decisions/furniture-group-rotation.md) · [handoff](../claude-code-handoff.md).

Built by Claude Code under the owner's D52 continuation. **Status: complete locally; the required pinned-CI jobs for the exact PR head are reported in the PR, not here.**

## Evidence (local, Node 24.19.0, this sandbox's Chromium 141 / SwiftShader)

**Unit tests** (`furniture-gesture.test.ts`, 3 new cases, analytic). Sofa and TV are grouped; the pivot is (1725, 2475).
- **Move:** a pointer move of +130/−70 snaps the sofa to (1450, 4250), so the delta is (150, −50) and the TV goes to (2400, 350). Free mode keeps (130, −70). Without the group option the result is a single-item `UpdateFurniture`.
- **Rotate:** dragging from pivot+(1000, 0) to pivot+(0, 1000) gives +90°. Executing it moves the sofa to (−100, 2050), the same value as the D58 +90 case. 40° snaps to 45°, free keeps 40°, and a grab 0.5 mm from the pivot is refused.
- **Lone member:** a lone leftover member and an ungrouped item have no group.

**Browser tests:**
- `tests/e2e/furniture-group-3d.spec.ts`, 2 cases, using real mouse drags in the 3D view and an independent camera projection:
  - Move: +1000/+500 mm gives (1000, 500) and (3200, 500), and one Undo restores the exact document.
  - Rotate about pivot (1100, 0) by +90°: (1100, −1100) and (1100, 1100), both at 90°, and Undo restores.
- `tests/e2e/furniture-group.spec.ts` case 3 was **deliberately updated** for the D60 behaviour change: 3D Move is now enabled with the "whole group" note, where D57 expected it disabled. Nothing else was relaxed.
- All 7 grouping browser cases pass.

## Limits

- No physical phone, mobile-optimization or independent-review claim.
- No group snapping against walls.
- No advisories for a whole group.
- The Hindi strings were written by Claude and have had no native-speaker review.
- D36 scopes remain locked.
