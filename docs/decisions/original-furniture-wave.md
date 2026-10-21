# D83 — original furniture wave and material-packed beds

Owner approved additional furniture on2026-10-21 under D80. This task precedes the ready-made gallery so the gallery can use the new pieces and bounded bed versions. No appliances/sanitaryware, third-party model, paid service, new dependency or mobile-optimisation work.

## New pieces

All six are original schema3 sources with `mergeByMaterial:true`, app-use rights records and retained owner rights. Canonical model coordinates are metres/Y-up/base0/centredXZ; authoring values are integer millimetres. They are fixed decorative models, not articulating/manufacturing drawings.

| ID (version1) | Nominal W×D×H mm | Triangles | Material meshes | Main finish target |
|---|---:|---:|---:|---|
| `a_l0_cane_lounge_chair` |760×800×900|1356|3|wood frame|
| `a_l0_compact_recliner` |900×1000×1040|1716|3|upholstery; fixed pose|
| `a_l0_storage_ottoman` |750×750×450|384|3|upholstery; closed lid|
| `a_l0_nesting_table` |950×650×480|528|3|metal legs/frame|
| `a_l0_round_dining_table` |1100×1100×750|384|2|wood top/base|
| `a_l0_compact_almirah` |900×500×1800|228|3|carcass; fixed sage doors|

The existing main-material heuristic uses merged primitive bounds. Finishes recolour that main material, not every part. No new per-part recolouring or interactive doors/reclining/lids. Hindi and English names/tags and existing top-view symbol rules are used.

## Append-only bed versions

`a_l0_king_bed@3`, `a_l0_queen_bed@3`, `a_l0_double_bed@3` reuse their v2 source geometry exactly and opt into material packing:10→5meshes,1944triangles unchanged. New sources/rights/GLBs are appended; every old version remains available. Decoder checks compare every triangle's positions, normals and colour against the old v2 files, not regenerated expectations. The furnished sample pins king@3; its dimensions/position and every other piece stay unchanged.

The catalog becomes **48 IDs /87 immutable versions**, nine categories, two24-card pages. Existing assertions are unchanged except permitted count updates and newest-version pins: catalog counts78→87/42→48, page2count18→24, category totals, king/queen/double latest pins3, and existing modern/AI bedroom e2e king pin2→3. Four existing demo-desk helpers gain setup-only exact-name search because the enlarged alphabetic catalog moves that item to page2; all their assertions stay unchanged. All exact dimensions/history/search/disposal checks remain.

## Verification boundaries

New Codex-authored GLB/design/Hindi-search and actual catalog placement/Undo/reload tests supplement the unchanged independent acceptance suite. One new test file needs the same narrowly named read-only `node:fs/promises` access as the existing five catalog consumers; its exact path is admitted, with no production/arbitrary-test exemption. No old architecture assertion is edited. The first full check correctly rejected this undeclared test import before the scoped admission.

Actual geometry rights/version/build/browser results are recorded in `docs/verification/d83-furniture.md` and the PR. Fixed-sample draw-call limits remain locked at≤200Mid; arbitrary large user scenes and physical-phone FPS are not certified. Designer review, real phones, release and final Claude review remain pending/gated. No reference-repository code or assets were adapted.
