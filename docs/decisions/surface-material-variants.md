# D82 — more surface finishes

Owner approved the D81→D82→D83 proposal and additional furniture work on 2026-10-21. This separate task adds four surface choices: walnut wood, terracotta 600 mm tile, charcoal marble and linen pinstripe wallpaper (150 mm stripe interval). All use the existing `ApplySurfaceMaterial` command, ordinary integer-mm UV scales and one Undo. 2D/Low retain their base colours; Mid/High show photographic detail.

## Source and delivery

Official ambientCG access was attempted and returned proxy403. No alternate route, paid download, live AI or asset scraping was used. `tools/textures/derive_variants.py` instead creates four NEW colour JPEGs from the already shipped/recorded CC0 WoodFloor051, Marble012 and PaintedPlaster017 images. It verifies the exact input hashes, preserves the 12 existing texture/HDRI files, and offers a read-only `--check` byte comparison. Derivation is colour grading and an original pinstripe layout, not a claim of four new scans/species. Source rights were recorded by D76 on 2026-10-19; this task does not claim a fresh online licence check.

Four new rights records specify source, author, CC0, derivation, date and output SHA256. The existing 12 records are preserved verbatim. The new colour maps reuse the corresponding original normal/roughness images. No new runtime dependency, external texture URL or change to immutable model versions. The generator uses the existing offline Pillow tooling; it is not an app runtime dependency.

## Loading correctness

The new offline regression exposed two existing issues: a failed photo texture showed white instead of the selected base colour, and switching from a roughness-map finish could leave the wrong roughness. The loader now retains the actual base colour while pending/failed, clears and disposes preceding maps on a texture-key change, uses the current definition for late completion, drops stale/forgotten results, and allows a later apply to retry failures. No old assertion is changed. A read-only live binding diagnostic reports actual map readiness and repeats for browser verification.

Eight surface sets share 15 image files (not 24 duplicated maps): at 1024 px colour/512 px normal/roughness with RGBA mipmaps, the static image estimate is about52MiB before the existing HDRI. This estimate excludes peak decode/process/driver memory; the locked Mid furnished-sample ≤64MiB and ≤200 draw-call checks remain binding. No physical-phone or broad mobile-optimisation claim.

## Verification and limits

Codex-authored loader/lifecycle and actual-browser checks supplement unchanged tests and locked acceptance. The first new loader run reproduced two failures before the fix; all seven targeted new+existing unit tests then passed. No appliance, new furniture model, electrical design feature, new schema, paid service or gated scope is bundled. Actual final command/CI evidence and phone instructions are in `docs/verification/d82-materials.md` and the PR. Real phones and final Claude review remain pending/gated.
