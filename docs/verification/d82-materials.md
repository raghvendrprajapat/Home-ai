# D82 — surface-material verification

Date: 2026-10-21. Parent D81 head `23a7b4690acfe9a348cc4a2632a1f1d305766e36`; no D81 code change except the read-only live texture-binding diagnostic. D82 has its own branch/PR. New tests are Codex-authored builder tests, not independent fixtures.

## Completed evidence

- `python3 -I tools/textures/derive_variants.py` followed by `--check`: four reproducible 1024×1024 JPEG colour variants, **380744 bytes** total. Four CC0 input hashes are checked before derivation; existing different output bytes are refused rather than overwritten.
- Direct byte comparison against the parent Git tree: all **12 existing texture/HDRI files** match their recorded hashes and all **12 rights records** are preserved verbatim. Four new records bring the shipped-file total to16. No immutable GLB/catalog source or dependency lockfile changed.
- `pnpm assets:check`:78 models,0 validator errors/warnings,78 rights records; texture rights16files.
- First new loader unit run:2 failed/2 passed. Failures reproduced white-on-photo-failure and stale roughness. After the loader fix, new+existing texture tests: **7 passed**.
- First full `pnpm check`:840 passed/1 failed (841 total), because the old ten-swatch API now returned14 choices. The original test and its assertions were kept byte-identical. The ten-swatch API remains compatible, with a separate texture extension explicitly supplied by the real app UI. The unchanged surface-model tests plus texture tests then gave **14 passed**.
- Initial actual-browser suite: **12 passed (57.3s)**, including all10 existing surface-control cases unchanged and two new material/fallback cases. Four texture maps were fetched locally, bound to real materials at their expected repeats, applied through normal commands, undone/saved/reopened, and stayed within Mid64MiB/200draw limits. Low made no texture requests/bindings. The final case applies wallpaper to a wall rather than a floor; final rerun: **2 passed(24.7s)**. Final full check: **102 Vitest files/841 tests passed,31 Node tests passed**. Production build exited0:236182initialgzip bytes against600000limit; crash hooks absent. Complete unchanged local acceptance: **36 passed,1 existing fixme skipped(2.0m)**.
- The four derived colour maps were visually inspected. They are grades/patterns derived from existing source scans, not four independently photographed material scans. Shared image memory estimates and source/derivation limitations are in the decision record.

Official ambientCG source/license/download requests returned proxy403; the source-rights basis remains the existing D76 records checked2026-10-19. No fresh online rights verification, new external download or policy bypass is claimed. Local browser is Chromium151.0.7922.173/SwiftShader because the pinned156 download was blocked. CI uses its unchanged pinned browser.

## Pending gates and merge

Exact-head required CI is still a separate gate; the PR records its actual results. Local passes above are not CI or real-phone evidence. Check, Acceptance (independent), Cloud database and Android debug must each be COMPLETED SUCCESS on the exact head before SHA-guarded squash merge. Physical phones, FPS/thermal behaviour, live cloud/AI, expert and final Claude reviews remain pending/gated; none are represented by browser simulation.

## Owner phone steps — after real-phone testing is authorised

1. On each Low/Mid phone, open this PR's preview or matching debug APK → Skip welcome.
2. Materials → Surface to paint → Living floor. Try Wood - walnut, Tile - terracotta600×600 and Marble - charcoal. Each tap should create one Undo step; Undo restores the earlier finish.
3. Choose a wall side and Wallpaper - linen stripe. The opposite side and neighbouring room should keep their finishes.
4. Open3D → Project → qualityMedium; inspect grain, tile joints and wall stripes. ChooseLow: base colours remain, texture detail disappears by design.
5. Export/reopen the drawing and confirm the selected finish stays. These are prepared steps, not an executed physical-phone check.
