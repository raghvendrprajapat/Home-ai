# FR-019 — furniture grouping

2026-10-17 · [D57](../decisions/furniture-grouping.md) · [handoff](../claude-code-handoff.md) · [final Codex checkpoint](https://github.com/raghvendrprajapat/Home-ai/issues/98).

Built by Claude Code under the owner's D52 continuation.

- New core-model commands: `GroupFurniture`, `UngroupFurniture` and `MoveFurniture`.
- 2D: tapping a member selects the whole group, dragging moves the group, and arrow keys nudge it.
- 3D: single-item Move and Rotate are locked for grouped items.
- Group and Ungroup buttons, in English and Hindi.

**Status: complete locally; the required pinned-CI jobs for the exact PR head are reported in the PR, not here.**

## Evidence (local, Node 24.19.0, this sandbox's Chromium 141 / SwiftShader)

- **Unit** (Claude-authored, analytic): `furniture-group.test.ts`, 7 cases on the H.6 sample.
  - Grouping sofa + tv gives both `group_1`, and one Undo restores the exact document.
  - Adding the bed merges everything into a fresh `group_2`, and regrouping the same set is a no-op without history.
  - Ungroup through one member dissolves the whole group.
  - `MoveFurniture` by (+100, −50) gives sofa (1400, 4250) and tv (2350, 350) by hand.
  - A property test keeps relative offsets exact for random integer deltas.
  - Invalid, duplicate, unknown, too-few, too-many, fractional and out-of-domain inputs reject atomically.
  - Duplicates carry no group.
- **Browser** (`tests/e2e/furniture-group.spec.ts`, 4 cases):
  - Group buttons stay disabled until valid; the group id is written; a tap selects both members; an ungrouped item stays single; one Undo restores the document.
  - A real mouse drag of one member gives both members the same integer delta (about +500/−200 mm within one grid step), while the others are unchanged, and one Undo restores the document.
  - Arrow and Shift+Arrow nudges move both members by exactly +10 / +100 mm. 3D Move is disabled with the lock message while grouped and enabled after Ungroup, and the item then picks singly.
  - Deleting one of two members leaves a single item that picks singly and can move in 3D.
- Related browser suites re-run with the change (`selection`, `picking-furniture`, `furniture-align`): all passed (19/19 together with the new spec).

## Failures and fixes recorded honestly

- The first browser test expected the Ungroup button while the 3D view was open. The selection panel exists only beside the 2D plan, so the test (and the 3D lock message) now say "ungroup it there", meaning in the 2D plan.
- A lone leftover member (after deleting the others) first stayed locked in 3D. The editor now treats a group with fewer than two members as a single item, and a browser case covers this.

## Limits

- No physical phone, mobile-optimization or independent-review claim.
- No group rotation, no 3D group move, and no group editing in the numeric panel.
- The Hindi strings were written by Claude and have had no native-speaker review.
- D36 scopes remain locked.
