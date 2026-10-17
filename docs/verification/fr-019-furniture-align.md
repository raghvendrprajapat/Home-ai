# FR-019 — furniture alignment

2026-10-17 · [D55](../decisions/furniture-alignment.md) · [handoff](../claude-code-handoff.md) · [final Codex checkpoint](https://github.com/raghvendrprajapat/Home-ai/issues/98).

Built by Claude Code under the owner's D52 continuation. `AlignFurniture` aligns the bounding boxes of 2–500 selected furniture items (left, right, top, bottom, two centre lines) as one atomic command with one Undo; the Selection panel has the six buttons in English and Hindi. **Grouping is not done.** **Status: in progress. The whole-suite browser result is added before merge.**

## Evidence so far (local, Node 24.19.0, this sandbox's Chromium 141 / SwiftShader)

- Unit (Claude-authored, analytic): `furniture-align.test.ts`, 7 cases on the H.6 sample footprints (hand-derived bounding boxes: sofa x300..2300, tv x1350..3150, bed x5550..7350 and y200..2200, wardrobe y4200..4800). All four edge alignments and both centre lines match hand-derived centres (for example left → tv and bed x = 1200 with a sofa reference of 300; centreY of sofa+wardrobe → 4325 for both). Also: only chosen items move and only on the aligned axis; a 90° rotation swaps width and depth; a 150-run property over every integer angle and random sizes keeps results integer and within 0.5 mm of the exact edge; one Undo restores the exact document and a repeated alignment is a no-op without history; invalid selections, unknown ids, bad modes and an out-of-domain result reject atomically.
- Browser (`tests/e2e/furniture-align.spec.ts`, 3 cases, 15 s): buttons disabled until two furniture items are selected, exact left alignment and one Undo; centre alignment and a no-op repeat; a selection containing a wall stays disabled.
- `pnpm check` under Node 24.19.0: 66 files, 467 product tests, 18 tooling tests passed.

## Failures and fixes recorded honestly

- The first draft of the command recomputed the reference edge inside the loop after earlier items had already moved, which would have given order-dependent results. Found while writing the tests; the reference lines are now fixed from the original positions before any item moves.
- Test-authoring mistakes found while running, fixed in the new tests only: command IDs must match `[A-Za-z0-9_-]{2,80}` (a random decimal ID was rejected), and a message key (`furnitureAligned`) already existed for back-wall alignment, so this task uses `selectionAligned` / `selectionAlignUnchanged`.
- `assets:check` still needs the pinned Node 24.19.0 (this sandbox defaults to Node 22); see the FR-008 record.

## Limits

No physical phone, mobile-optimization or independent-review claim. Alignment aligns bounding boxes, not rotated outlines, and it can create overlaps (non-blocking warnings still apply). No distribute-evenly and no grouping. Hindi strings were written by Claude and have had no native-speaker review. D36 scopes remain locked.
