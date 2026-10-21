# D84 gallery verification — 2026-10-21

Parent D83 correction head `b8ce1ed75369102c9149979a3cc203a98896cf14`. Codex-authored builder tests; no independent-fixture or external-review claim.

## Executed evidence

- Pure factory/validation suite: **11passed**, including exact command-built counts, native immutable pins, serialization/load/edit/Undo, imperial display metadata, missing-pin rejection, out-of-room/overlap/door/window/front-access/dining rejection, common bathroom access and20random integer translations. Analytic family room areas use independent inside-edge spans (outer half115/partition half57.5mm); third bedroom adds exactly11356900mm² without changing earlier room areas.
- Initial prototype correctly failed on a coffee table in a doorway, a bed blocking the original bedroom→bathroom door and an almirah against a window. Positions were corrected, the compact example's bathroom door moved to the utility by real commands, and the family window placed away from the almirah. No clearance check was removed or relaxed.
- New complete browser file: **6passed(46.9s)**. Every gallery project loads all exact-pinned real models; fresh session has no Undo; a real edit/Undo and save/reload are exact; original sample remains byte-identical after opening the new example. Previews make zero GLB requests; Cancel creates nothing; rapid double activation creates only one project, while repeated deliberate use has fresh IDs; HTTP503/retry and late-cancelled manifest cannot create/replace a drawing. Hindi360×780 simulated viewport has no dialog horizontal overflow and creates a localized3BHK. An initial Hindi test incorrectly looked for Projects outside the phone's File panel; the new test's setup was corrected to use existing navigation and actual translated3D label.
- Actual Medium software-WebGL frames: **1BHK114draw calls/35651581reported texture bytes;2BHK162/44040188;3BHK174/44040188**. All are≤200calls/64MiB. Counts come from real renderer/texture diagnostics after model readiness, not predicted asset totals. Texture values are estimates, not measured physical GPU memory/FPS.
- Production build: exit0; **239614initial gzip bytes**,4initial modules, crash hooks absent, under600000byte gate.
- Complete unchanged independent acceptance: **36passed,1existingfixme skipped(2.0m)**. Full pre-commit `pnpm check`: **104Vitest files/873tests passed +31Node tooling tests passed**, zero failures/skips. Exact-head CI is recorded after it actually completes. Pending is not a pass.

Local browser Chromium151.0.7922.173/SwiftShader. The pinned156browser download is blocked locally; CI uses its unchanged pinned version. No existing test, locked acceptance/manifest/enabled list, accepted geometry fixture or sample JSON is edited. No asset, rights record or dependency changes in this task.

A separate builder review checked canonical command ownership, integer saved coordinates, immutable pins, cancellation/session replacement, SVG axis/rotation mapping and branch scope. Original3D screenshots and the narrow Hindi card were visually inspected; executable checks remain the primary evidence. This is self-review, not independent validation.

## Owner steps — only after real-phone testing is authorised

1. On each Low/Mid phone, open the matching preview/debug APK. From the editor open **Project/File → Projects → Design gallery** (desktop Projects is also in the navigation).
2. Look through the three previews; close the gallery and confirm your existing drawing remains. Reopen and choose Compact1BHK, Family2BHK or Family3BHK.
3. Switch to3D; check furniture/doors, then move one piece, Undo, export and reopen. Return to Projects and open the previous drawing; it should still be there.
4. In Settings choose Hindi, reopen the gallery and repeat. Compare Low and Medium quality and note clipping/stutter or failed models.
5. These are instructions for a future authorised check. No physical-phone performance/usability, building-code suitability, external review, release readiness or final Claude review is certified.
