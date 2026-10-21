# D83 furniture verification — 2026-10-21

Parent D82 tested head `d5e93850d066a7c2339791d6151b2c682e9c4e21`; D82 merged as main `74b40dbb536f88c9db7095b17f3f909e3e167fc2`. New tests are Codex-authored builder checks, not independent fixtures or an independent review.

## Actual local results

- Explicit asset build/check: **87 versions**,0 validator errors/warnings,87 rights records;16 unchanged texture/HDRI records. Latest catalog has48items/nine categories/two24-card pages. No external model/texture download or new dependency.
- Direct comparison against current main: all78historical catalog entries and source files exact;155unique historical GLB/SVG blobs match their recorded hashes. Nine appended versions add15unique blobs/409322bytes. Old drawings keep their pinned versions. Repeated asset build passes without an old-version rewrite.
- New GLB/Hindi/packing unit suite: **15passed**. Hand-counted triangle totals use box12,12-sided-cylinder48,24-sided-cylinder96,rounded(seg2)300. Six exact nominal bounds/grounding/material counts/main finishes pass. Three bed comparisons retain every old triangle position/normal/colour while reducing10→5material meshes. Six Hindi queries find the intended IDs.
- Existing catalog/modern-furniture/sample/symbol cases: **106passed** in the initial focused run; assertions retained except allowed counts/newest pins. Dynamic no-floating-part cases include all new source parts.
- First full check stopped on the new consumer test's undeclared filesystem import. Only that exact `.test.ts` path was admitted for read-only shipped-file checks. No production/general filesystem allowance, old test edit or skipped check. Full corrected `pnpm check`: **103Vitest files/862tests passed;31Node tests passed**, zero failures/skips.
- Actual browser suite (new wave + existing catalog/model + Night): **11passed(1.6m)**. Final two presentation cases rerun: **2passed(25.4s)**. Every new ID is placed through the catalog into a fresh unfurnished living template at its exact pin/dimensions/integer position, reaches real-model ready, fits the Mid draw budget and survives exact Undo/Redo/save/reload. New thumbnails are all inspected; URL creation/revocation remains exact48/48.
- Furnished Mid Night sample: **135draw calls**, compared with145 measured at D81. Lamp-on/off pixel luminance48.93333424125323/39.1037604106379 (difference9.829573830615324). The bed geometry/colours are unchanged; this is software WebGL evidence, not physical-phone FPS.
- Complete unchanged local acceptance: **36passed,1existingfixme skipped(2.0m)**. Locked files/manifest/enabled list and accepted geometry/sample fixture remain unchanged.
- Production build: exit0; initial static graph236177gzip bytes (<600000), crash hooks absent. New model screenshots were visually inspected (including the almirah's front), as a supplement to executable checks.

Local browser: Chromium151.0.7922.173/SwiftShader; pinned156 download remains blocked locally. Required CI retains the pinned browser. Final pre-commit/main-sync checks and exact-head CI results are recorded in the PR once actually complete; pending is not a pass.

## CI diagnosis and permitted existing-test changes

- `catalog.test.ts`: versions78→87,items42→48,category counts,king/queen/double newest pins3.
- `starter-catalog.spec.ts`: versions/items/thumbnail totals and second-page count18→24; no assertion logic or paging actions changed.
- `modern-furniture.spec.ts` and `ai-furniture.spec.ts`: king bed newest pin2→3, forced by the new immutable packed version.
- CI run39568002124:180browser cases passed/16failed. Fifteen cases assumed the original demo desk was on the first24-card page; six new alphabetically sorted names moved it to page2. Four old setup helpers (`furniture-models`, `furniture-placement`, `furniture-advisories`, `furniture-finish`) now search its exact name before selecting it. Every original assertion, timeout, model, geometry, export, failure-injection and history check remains unchanged. The sixteenth case was the required newest king-bed pin. This was a real test-setup regression, not an environmental failure; production sorting/paging is unchanged. No automatic retry hides it. Targeted rerun of all five affected specs: **26passed(1.9m)** (Chromium151 locally); actual elapsed is retained in the PR logs.
- The sample factory uses king@3; no fixture or stored drawing is migrated. New sources are the six@1 IDs and three@3 beds named in the decision.

## Owner steps — after real-phone testing is authorised

1. On each Low/Mid phone, open this PR's preview/matching debug APK→Skip welcome→Furniture→Browse furniture.
2. Search cane lounge chair, compact recliner, storage ottoman, nesting tables, round pedestal dining table and compact almirah; add one at a time. Hindi search examples: बेंत, रिक्लाइनर, ओटोमन, नेस्टिंग, पेडेस्टल.
3. In3D inspect the woven chair back, recliner footrest, ottoman lid seam, paired tables, pedestal and two-door almirah. Rotate the view to see fronts; models are fixed poses, not opening/reclining animations.
4. Move/rotate a piece, Undo/Redo, then export/reopen. Old drawings should retain their old asset versions.
5. ChooseMedium and thenLow; note glitches/stutter. No real-device performance, designer review, release readiness or final Claude review has been certified.
