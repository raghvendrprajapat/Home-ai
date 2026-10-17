# D53 — FR-008 wall-segment dragging

FR-008 / PH2 follow-up. First task of Claude Code's D52 continuation. Authorized core editor Must; no D36 scope is touched (no accounts, cloud, phone testing, billing, security/privacy/release work).

**What the user gets.** Select one wall (tap or click), then press it and drag sideways. A horizontal wall moves up/down, a vertical wall moves left/right. Release applies one command; Escape, pointer cancel, a changed generation or a changed selection cancels with no history entry. Panning is unchanged: pressing an *unselected* wall still pans, and on touch the usual 150 ms hold is required before an edit.

**One command, no new geometry rules.** The drag issues one atomic `MoveJunctions` through the existing `store.preview`/`store.execute`, exactly like junction dragging. The helper `wallMoves` (view2d.ts) reuses the same connected-component rule as `junctionMoves`. Collinear walls joined end-to-end move with the dragged wall; perpendicular neighbours stretch or shrink; hosted openings stay on their wall. For a wall that has no collinear neighbour the result is byte-for-byte what the existing `MoveWall` command produces (tested on the sample w7 +100 mm). `MoveWall` itself is unchanged: moving only a wall's two corners would turn a collinear neighbour diagonal, which L0 rejects, so the drag cannot use it for walls in a straight run (for example the sample's top wall w1+w2).

**Axis rule.** Motion along the wall's own length is ignored. It would only make every perpendicular neighbour diagonal, and L0 forbids that. Non-orthogonal walls cannot exist in a valid L0 model; `wallDrag` still throws for one rather than guessing.

**Snapping.** `snapLine` (snapping.ts) snaps the dragged line on its one axis: another corner's row/column (6 px acquire, priority 3) before the grid (priority 5), 1.5× release hysteresis, the 250 mm world cap, Shift or the snapping toggle disables it. Corners that move with the wall are excluded so the wall cannot stick to its own start. A press-and-slide along the wall (no sideways motion) never snaps an off-grid wall.

**Rejections stay atomic.** Impossible drags (a neighbour under 10 mm, a crossing, an opening that no longer fits, a room with no usable inside) leave the canonical model unchanged and show the existing validation message; no preview is drawn. Integer-mm admission, shared junction IDs, D12 small-room handling and one-command Undo are inherited from the command, not re-implemented.

**Input safety (inherited from the existing drag).** Canvas rectangle and window size are re-validated at preview and release; a project/session/generation change cancels; a selection change cancels in controlled mode; the wall must still exist.

**Deliberately not done.**
- Dragging only part of a collinear run (that needs new jog walls) and free angles stay out of L0.
- Openings keep their offset from end A of each stretched wall (the existing `openingPlacement` default). A user-chosen A/B/centre option for drags is not added.
- Always-armed dragging of unselected walls was rejected: wall hit areas are wide (half the thickness plus 4 px) and would turn mouse panning into accidental edits. This can be revisited with owner feedback after real-phone testing.
- No mobile-optimization, physical-phone or independent-review claim.

Tests are Claude-authored analytic/property/browser checks, not independent fixtures. See [the verification record](../verification/fr-008-wall-drag.md).
