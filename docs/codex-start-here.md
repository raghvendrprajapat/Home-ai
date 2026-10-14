# Start Here: project brief for Codex and Claude Code

**Date:** 2026-10-14 · **Owner:** Raghvendr · **Read with:** [`../AGENTS.md`](../AGENTS.md) (rules), [`combined-research.md`](combined-research.md) (spec), [`build-process-guide.md`](build-process-guide.md) (process).

This file carries **every decision made so far**, including decisions made in chat that are not in the other documents. Both agents get the same context from it. Update it when a decision changes; the owner asks an agent to do that.

**Current authorization (D17):** develop continuously, make routine decisions, audit/test/fix, and merge green PRs. Claude reviews after agreed development and Codex verification, before commercial release. This supersedes older per-task approval, pre-build independent-fixture, weekly/plan/deep-review and rescue pause instructions throughout these documents. Preserve accepted fixtures; record any unexecuted external/device checks honestly.

---

## 1. The project in 10 lines

- **What:** a Planner 5D-inspired home planner called "GharPlan" (placeholder name). The user draws rooms to real dimensions, adds doors, windows and furniture, and sees the result in 3D.
- **For whom:** Indian homeowners and small contractors/interior designers. Hindi + English. Must run on ₹10–20k Android phones.
- **Platform:** one TypeScript codebase. Web app + Android app via Capacitor. Google Play distribution.
- **Money:** freemium. Google Play Billing subscription, ads only outside the editor, optional rewarded unlock. AI credits only later.
- **Core promise:** measurements you can trust, 2D = 3D always, and your work is never lost.
- **Owner:** not a programmer. He tests on two phones (Low: Galaxy A0x/Redmi A; Mid: Galaxy A3x/A5x) and approves plans. Merge authority follows D15 below.
- **Current state:** Research/skeleton/workflow and geometry PR #63 are merged; canonical core-model PR #64 is merged. PH0-T04 provides interactive 2D editing; PH0-T05 adds synchronized Three.js 3D with structural openings, clear-area floors, door thresholds and dimensioned furniture placeholders. See [`verification/ph0-t04.md`](verification/ph0-t04.md) and [`verification/ph0-t05.md`](verification/ph0-t05.md) for executed checks and limitations. PH0-T06's performance lab/diagnostics are merged in PR #67; large-plan optimization and real-phone targets remain pending. PH0-T07 merged in PR #68 after both exact-head CI jobs passed; issue #10 retains its phone gate. PH0-T08 merged in PR #69 after both exact-head jobs passed; it adds transactional browser autosave, a packaged native Filesystem mirror, guarded recovery/copies and complete JSON export fallback; see [`verification/ph0-t08.md`](verification/ph0-t08.md). Linux browser faults/crash diagnostics are executed; physical Android kill, Low/Mid, OEM and filesystem power-loss results remain pending in issues #10/#11. PH1-T01 merged in PR #70 with tested import/manifest boundaries and both CI jobs passed. PH1-T02 merged in PR #71 with validated version/migration admission. PH1-T03 merged in PR #72 with local project-list/create/open/rename/duplicate/trash/restore and English/Hindi settings; its verification is recorded in verification/ph1-t03.md. Physical Hindi layouts remain pending. PH1-T04 merged in PR #73 after both exact-head CI checks passed; it adds strict JSON import/preview/collision copies and system-picker native export with verified byte readback. See verification/ph1-t04.md; actual native provider and lifecycle checks remain pending in issue #15. PH1-T05 merged in PR #74 after both exact-head CI jobs passed; it adds session-preserving render recovery, session-only optional fixed-code reporting, production build gates and browser E2E CI. PH2-T01 adds anchored multi-touch zoom/pan, hold-to-edit corner loupe, bounded spatial picking/cycling and stable canvas redraws; see verification/ph2-t01.md for executed browser/Android packaging evidence. PH2-T01 merged in PR #75 at reviewed head05b9a5afcfa21ab4716774c8309522be4cedaba8 after both required jobs completed SUCCESS/CLEAN; first-run E2E failure remains recorded with unknown cause and readable CI annotations now enabled. PH2-T02 implements wall-chain/rectangle tools, room properties, shared-wall reuse and explicit ambiguous-identity choices; see verification/ph2-t02.md. PH2-T02 merged in PR #76 at reviewed head5bfbcca5c49939909d69c4768ab9b57ed1770667 after both required jobs completed SUCCESS/CLEAN; merge057bfacc00940d9ed3fc3163a7353b834c3f914b. PH2-T03 implements strict measured units, prioritized sticky guides/grid/disable, wall dimensions with explicit endpoint preview/confirm and generation/lifecycle cancellation; see verification/ph2-t03.md. PH2-T03 merged in PR #77 at reviewed head3c2d0793652bc452fed8f30ea9360422ba7823a7 after Check/Android completed SUCCESS/CLEAN; merge282b7171ac2afb338748e3e21088cc116af01edc. PH2-T04 implements measured door/window preview/apply/edit/delete, reverse preservation, original swing symbols and A/B/centre host-length placement; verification/ph2-t04.md records evidence and pending gates. PH2-T04 merged in PR #78 at reviewed headec82b33c668d527ee38f43f86bf62ec9bbb8c6b3 after required Check/Android SUCCESS/CLEAN; merge428116d6fe495f7a60f450a8686a8e36f966c4a6. PH2-T05 adds model-ID multi-selection, contained marquee, explicit dependent batch deletion and furniture copies; see verification/ph2-t05.md. PH2-T05 merged in PR #79 at reviewed head00f2a792616c8a65fa1c9e9693babd1ba9d3cc43 after Check/Android SUCCESS/CLEAN; merge3a104bd7c436409950d4c121d8713dbe5037ddfc. PH2-T06 adds canonical whole-plan2000/1000pxPNG, exact labels/watermark, checked preview/failure recovery and guarded AndroidPNGsave; see verification/ph2-t06.md. PH2-T06 merged in PR #80 at reviewed head a1285b5adcd7054a0179c41fa010fcf72d94570c after Check/Android SUCCESS/CLEAN; merge6f0a74fab7c47e9a6b4637dc78644d6bfa00f01f. PH3-T01 adds clear-room downward ceilings, hidden-by-default visibility, unequal-height warnings and full furniture/ceiling bounds; see verification/ph3-t01.md. PH3-T01 merged in PR #81 at reviewed head41fc9998461f3f1779a78a91c3c6123ab6138d92 after required Check/Android SUCCESS/CLEAN; mergea85d4f3403fcb2559d961b0764bdd12ac80aad32. PH3-T02 adds request ownership, stale-error recovery and conservative scene dependencies; see verification/ph3-t02.md. Its separate green PR is required before PH3-T03. Future Claude fixtures remain deferred under D17. Catalog/full furniture editing/accounts and release gates remain incomplete. Interviews, specialist and external-service gates remain pending. Claude review and future independent-comment fixtures are deferred to the final development audit under D17; accepted data is unchanged.

## 2. Owner decisions (binding)

| # | Decision | Where in spec |
|---|---|---|
| D1 | **No electrical/wiring features.** The app and the owner's electrical shop are separate businesses | combined-research header, §C.1 |
| D2 | **No marketing website now.** Only the Play-required privacy-policy page and account-deletion page | FR-047, §O.3 |
| D3 | Web + Android (Capacitor), mobile-first | ADR-001, ADR-009 |
| D4 | First release (L0) = one floor, walls at 0°/90° only, L/T junctions | §C.1, §E.4 |
| D5 | Stack: TypeScript, React + Vite, Zustand (UI only), Konva (2D display only), custom `geometry` + `core-model` with Immer patches, Three.js WebGL2, Supabase (Postgres JSONB snapshots, Auth, RLS, RPC), Cloudflare R2, Play Billing, AdMob, Vitest + fast-check + Playwright | Part D, §D.25 |
| D6 | **Codex = main builder; Claude Code = review-only second checker** under D16 (Claude's usage limit is lower) | AGENTS.md §2; D16 |
| D7 | **2-level Claude check:** ⭐ tasks get a deep Claude review before merge; normal tasks get a weekly batch review | build-process-guide §6 |
| D8 | Independent cases and expected answers come from Claude before Codex implements the matching risky module. PH0-T02a geometry is complete in PR #60, authored before D16. Future PH2-T04a openings and PH5-T03a save races use Claude's PR-comment data, copied exactly by Codex under D16; merge each fixture PR before the matching implementation. | build-process-guide §7; D16; PR #60 |
| D9 | AI features only after the first Play release, and only if a spike shows value; Gemini terms require an 18+ audience | Part I, §O.3 |
| D10 | Never copy Planner 5D code, assets, UI or private APIs | §O.1 |
| D11 | **Wall thickness: 50–1000 mm, inclusive, stored as integer mm.** The sample schema maximum is 1000, matching FR-007, §D.4 and §E.12.2; values outside the range are rejected. | Owner instruction; FR-007, §D.4, §E.12.2; project.schema.json |
| D12 | **Small closed rooms:** keep every bounded face whose clear (inside) area is positive. If clear area is < 0.25 m², keep the room and show a warning such as "very small space — shaft/niche?"; at exactly 0.25 m² no small-space warning is needed. Zero or negative clear area is an invalid drawing: reject the command with a clear error and leave the model unchanged. Never silently discard a small valid room. | Owner instruction; §E.7; GEO-021 |
| D13 | **Area tests:** use unrounded clear-area mm² with existing tolerances; m² labels are formatted and tested separately. Initial sample 20642175/15872175 mm²; moved partition 21119175/15395175 mm². | Owner approval; §H.6; DM-003 |
| D14 | **Raw input and canonical validation:** the 0.4 mm case is transient pointer/preview input before snapping/quantization to an integer-mm command. Fractional canonical project/command coordinates are rejected unchanged. Test the stages separately. | §E.1, §E.13; GEO-016 |
| D15 | **Merge delegation (2026-10-11; formerly D13):** the owner said, "mere next instructions tak pr tum khud merge karoge". Until he changes this instruction, Codex may merge prepared PRs after all applicable CI, review and task acceptance gates pass. This changes only who clicks Merge; plan approval, real phone testing, Claude checks and unresolved specification decisions remain required where applicable. Older owner-merge examples in the guide are superseded by this decision. | Owner instruction; AGENTS.md §2 |
| D16 | **Claude review-only (2026-10-11):** Claude Code does no development work and never pushes to the repository. Claude only reviews (⭐ deep reviews, weekly batch review, security review and rescue diagnosis), replying in PR comments or chat. For independent fixtures PH2-T04a and PH5-T03a, Claude writes the cases and expected values as text in a PR comment; Codex copies them into `tests/fixtures/independent/` exactly as given, without changing any value, and links the source comment in the PR. This supersedes older instructions permitting Claude development, file authoring, fixture PRs or rescue implementation. | Owner instruction; AGENTS.md §2/§5; build-process-guide C1/C3/§7.1 |
| D17 | **Continuous development and final Claude review (2026-10-11):** owner authorized Codex to continue through agreed app development, decide routine ambiguities using best judgement, audit and verify the work, and merge checked PRs. Claude reviews only after development and Codex verification; no Claude development/push. This supersedes D7/D8/D15/D16's earlier review timing and per-task owner-approval/pause gates. Existing accepted fixtures remain unchanged. Future Claude fixture comments are deferred; Codex tests must be explicitly attributed. CI, security, real-device and external-service release requirements remain; do not describe unexecuted checks as verified or claim universal "100%" correctness. | Latest owner instruction and "Okey do it"; AGENTS.md §2/§5 |
| D18 | **Free wall caps (Codex implementation decision under D17):** an unconnected end extends its rectangular footprint by thickness/2 beyond the centreline endpoint (a conventional square cap). L/T junction extensions use the perpendicular wall half-thickness to close the corner without double-counting union area. Room clear area subtracts these actual footprints, including dead-end stubs. Existing independent fixtures contain no free-cap expectation and remain untouched. | §E.6 ambiguity; independent geometry README open question; geometry implementation/tests |
| D19 | **3D proof safeguards (Codex under D17):** height-band solid union removes actual opening voids before assigning ownership, cancels internal faces and compacts coplanar fragments. Exact exposed-surface/shared-edge dependencies reuse unchanged mesh buffers; full union analysis remains conservative on geometry edits, to profile in PH0-T06. PH0 preview budgets: 500000 vertices, 100000 raw surface fragments, 2000000 guarded work operations, 10-second worker watchdog. Exceeding them reports a 3D-only error with the canonical drawing unchanged; these are prototype safety limits, not proven Low/Mid performance tiers or silent room filters. | §F.3 cell-method alternative; §G.4; PH0-T05 verification |
| D20 | **Android debug baseline (Codex under D17, 2026-10-12):** Capacitor 8.5.3 / JDK 21 / SDK 24–36 / AGP 8.13.0 / checksum-pinned Gradle 8.14.3; private local HTTPS assets, separate `.debug` application ID, native build-flag debugging, cleartext/mixed-content/backup disabled, cache-only export provider. Compile/lint/signature/manifest/assets are local evidence; physical performance and OEM transfer/release policy are separate gates. Native lab JSON download is explicitly pending, with USB inspection fallback. | ADR-009; PH0-T07; benchmarks/phase0.md; verification/ph0-t07.md |
| D21 | **Local durability proof (Codex under D17, 2026-10-12):** storage epoch + monotonic disk sequence are distinct from runtime generation/server revision. Browser checkpoint/journal/meta updates use strict transactional CAS; SHA-256 detects corruption, not authenticity. Edits coalesce after 250 ms; full checkpoints follow 50 events or 30 s of activity. Android full-copy/ready-marker writes are serialized independently; a 1500 ms diagnostic watchdog warns without blocking subsequent browser journals or claiming I/O cancellation. Native rename/fsync/power-loss semantics are not guaranteed. Bounded recovery validates before opening; damaged/unsupported originals remain, and repair/divergence uses new-ID copies. Explicit Android backup/transfer exclusions compile; OEM, physical 100-kill, ≤2 s loss and p95 timing gates remain pending. | TRD-013; ADR-014; PH0-T08; REL-001/002/003/010; verification/ph0-t08.md |
| D22 | **Package admission (Codex under D17, 2026-10-12):** retain only needed geometry/core-model/persistence/web packages; keep adapters app-owned until extraction is needed. Repository-local ESLint enforces downward public imports, pure geometry/model boundaries, renderer/storage separation and bounded test-only JSON/library exceptions. Runtime/optional/peer manifest dependencies obey the same reviewed matrix. Generated AJV is reproducibility-checked separately. No new dependencies or empty scaffolding; static lint is not a mutation/security sandbox proof. | TRD-003; PH1-T01; decisions/package-boundaries.md |
| D23 | **Version admission/migrations (Codex under D17, 2026-10-12):** production remains schema 1; no historical format is invented. Version-aware parsing preserves exact canonical content, rejects newer versions with an update-app error and admits only reviewed adjacent transforms. Registry-local plain-JSON/depth/work/size guards, owned copies, frozen inputs and every-boundary/final validators prevent lossy transforms from replacing original data. Prototype callbacks are explicitly retained. Synthetic test schemas exercise the framework only; real future migrations require preserved schemas and golden expectations before support is advertised. Detailed import/version UI follows PH1-T04. | H.8; REL-001/005; PH1-T02; decisions/schema-migrations.md |
| D24 | **Local collection and bilingual shell (Codex under D17, 2026-10-12):** UI-only Zustand stores routes/preferences, never drawing data. Blank creation and duplication use validated independent IDs; rename uses core commands. Bounded local listing, validated open/activation CAS and reversible trash retain canonical checkpoints/journals/native files. Database version 2 closes v1 connections and rejects old cached v1 writers; project schema/storage envelope remain 1. Unsaved/error/conflict memory cannot be replaced by project switching. English/Hindi UI and new-drawing unit preferences never rewrite existing content. Static JSX localization lint has documented limits; real Hindi phones remain pending. | FR-002; NFR-015; UX-002/011; PH1-T03; decisions/project-shell.md |
| D25 | **Project files (Codex under D17, 2026-10-12):** plain UTF-8 versioned JSON only, hard cap 10 MiB inclusive; invalid/newer/unknown/fractional files reject before model writes. Import preview/cancel has no side effects; IDs/content are preserved when absent, while existing/trashed/native-history/unknown identities require an explicit remapped copy. Collision is rechecked before creation; initialization remains atomic/no-overwrite. Parsing is worker-isolated with read/worker watchdogs and stale-token/abort handling. Android uses an app-owned system document picker and bounded checksum-verified stream/readback, small path/hash/count IPC and private cache source; no added permissions, persistent URI grants or new runtime package. Success acknowledges verified destination content, not cloud/provider durability. Original data/complete JSON remain available on failure/cancellation; physical provider/lifecycle gate stays open. | FR-028; REL-001/003/005/010; SEC-007; PH1-T04; decisions/project-files.md |
| D26 | **Crash/diagnostics/browser CI (Codex under D17,2026-10-13):** retain canonical session above the inner render boundary; export latest memory and require explicit backup/reload confirmation. Optional hosted-public-DSN Sentry is session-consent gated and defaults off every reload. Only fixed codes/generated IDs/time and fixed SDK no-IP-inference settings pass two allowlists; no automatic integrations, project content, attachments, identity or raw exceptions. Revocation gates sends; already sent requests cannot be recalled. Production builds reject test crash hooks and initial static JS>600000bytes gzip. Six browser scenarios run in required Check CI; actual phone/live service and local pinned-browser policy gates remain pending. | FR-030; UX-001; REL-001/003; PH1-T05; decisions/crash-diagnostics-e2e.md |
| D27 | **2D interactions (Codex under D17,2026-10-13):** viewport/picks/loupe remain transient; anchored pinch and hold150ms/early-pan6px arbitrate touch. Second/third fingers, stale edits and lifecycle interruption cancel; release commits once. Persistent Konva canvas preserves native touch streams. Bounded spatial hash has broad fallback and stable overlap cycling; 48CSSpx controls are browser-tested, not physical Android proof. Full drawing, multi-selection/delete and phone gates remain pending. | PH2-T01; GEO-008/012; UX-004; decisions/editor-interactions.md |
| D28 | **Wall/room tools (Codex under D17,2026-10-13):** atomic rectangle and per-segment wall chains; canonical commands only, generation/epoch-owned drafts. Preserve shared-side finishes/orientation and reject t/h mismatch with actionable existing-value controls. Strip bridge backtracks only for enclosing room identity comparisons; explicit command roomChoices retain prior properties at an integer inside point when ambiguous, accepting real clear-union interior seams and rejecting actual boundaries/duplicates. Room properties/areas/warnings remain canonical/derived; physical measurements/phones and full PH2-T03 snapping are pending. | PH2-T02; FR-004/005/009/010; GEO-001/003…006/010/011/021; decisions/wall-room-tools.md |
| D29 | **Snapping/precision/units (Codex under D17,2026-10-14):** strict explicit-unit grammar, one integer-mm conversion; display-unit metadata never converts spatial entities. Junction12/wall8/guide6CSSpx,1.5 hysteresis and250mm cap; adaptive grid and Shift/touch disable are transient. Numeric wall length chooses A/B/both, with odd-mm symmetric differences rejected; connected changed axes merge. Tagged preview is read-only and must be confirmed; lifecycle/input/generation changes cancel it. Pending marker frames are cancelled on all resets. | PH2-T03; FR-006/007/014; GEO-002/007/009; UX-005; decisions/snapping-precision-units.md |

| D30 | **Opening controls (Codex under D17,2026-10-14):** measured wall-hosted doors/windows, explicit tagged preview/apply/delete/reverse and original 2D symbols. Command-only MoveJunctions openingPlacement defaultsA; B adds length delta, centre adds half while retaining prior midpoint-relative position; fractional shifts reject. All changed hosts revalidate guards/overlap/height/lineage. Reverse preserves centre/hinge/swing. No schema/accepted fixture change; phone and final Claude gates pending. | PH2-T04; FR-011; GEO-013…015; SYNC-002; decisions/opening-controls.md |

| D31 | **Selection/batch edits (Codex under D17,2026-10-14):** transient wall/opening/furniture IDs, DOM/Shift/touch/marquee; max500unique entities per atomic delete/copy. Dependency notice and explicit deletion confirmation, including ambiguous-room identity consent; cancellation removes the owned unresolved request. Furniture copies have new IDs,+200mm XY and no group coupling; invalid batches reject unchanged. Held touch IDs stay blocked on mode changes; preview ownership cancels competing drafts. | PH2-T05; FR-012/019; GEO-012; SYNC-009; decisions/selection-batch-editing.md |

| D32 | **Plan PNG (Codex under D17,2026-10-14):** capture current canonical snapshot; whole-plan2000/1000px, exact wall/clear-area labels and original watermark; bounded geometry/PNG/decode/nonblank checks, retry retains original capture. Browser acknowledges download request; Android explicitpng/private-cache/MIME/hash/readback delivery preserves existingJSON. API24-safe parser; no schema/dependency/accepted fixture edits. Direct share sheet/PDF/3Dscreenshot and physical gates remain pending. | PH2-T06; FR-029; REN-006; UX-009; decisions/plan-png-export.md |

| D33 | **Scene surfaces (Codex under D17,2026-10-14):** ceiling per positive clear room at floor elevation+room height, downward normals/winding, neutral category-owned material; default hidden and transient toggle. Unequal adjacent heights warn, never average; warning list is focusable/scrollable. Height edits replace only the affected ceiling; rotated furniture decorates cached structural bounds without geometry rebuild. | PH3-T01; §F.2–F.4; SYNC-002/004; decisions/scene-builder-ceilings.md |

| D34 | **Worker/dependencies (Codex under D17,2026-10-14):** one request ID/captured+current four-domain tags; duplicates cannot alter deadlines, terminal failures detach/terminate once. Retained previous scene stays labelled stale with no current-generation/performance success, including context restoration. Old/new dependency graph is advisory; exact projected inputs/full union/surface cache govern correctness. Metadata skips scene construction, full topology validation remains; baked UV changes rebuild dependent buffers. | PH3-T02; §G.4–G.5; SYNC-001/006; decisions/worker-scene-dependencies.md |

## 3. Which model for which job (benchmark-based, 2026-10-11)

These are independent Vals.ai results at **max effort**. Your app's default settings may differ, and small gaps (2–3%) are noise.

| Benchmark | Claude Opus 5.5 | GPT-6.1 Sol | Meaning for us |
|---|---|---|---|
| Vals Index (overall) | 66.97% (#3), $32.14/test | 61.15% (#8), $3.24/test | Opus a bit stronger; Sol ~10× cheaper per test |
| Terminal-Bench 4.0 (long coding tasks) | 65.15% (#1) | 55.05% (#6) | Opus for the hardest multi-step work |
| ProgramBench (build a whole program) | 18.50% (#1) | 3.00% | Opus |
| Vibe Code Bench v1.1 (build apps) | 90.29% | 88.93% | About equal, so use Sol (cheaper) |
| Code Migration | 66.65% | 65.12% | About equal |
| SRE Bench (fix build/ops problems) | 33.59% | 50.76% (#2) | Sol |
| CyberBench (security) | 55.36% | 39.29% | Opus for security review |

**Use:**

| Model | Jobs |
|---|---|
| **GPT-6.1 Sol in Codex** | All building, UI, catalog, i18n, export, Android/Capacitor, CI and build problems, normal reviews |
| **Claude Opus 5.5** | Review-only: ⭐ plan/deep reviews (geometry, undo/sync, openings, saving, RLS, billing), independent case/expected-value PR comments, rescue diagnosis, security review |
| **Claude Sonnet** | The weekly batch review of normal PRs (saves Claude usage) |

Sources: vals.ai model pages for both models (fetched 2026-10-11), and Artificial Analysis for GPT-6.1 Sol.

## 4. How every task runs

1. **Codex:** communicate plan → code + tests → `pnpm check` → fresh review → PR with Owner summary, under D17's standing authorization.
2. **GitHub Actions** must be green; merge only the verified PR head.
3. **Codex:** fix findings, record evidence and pending device/external checks, merge under D15/D17, then continue the next task.
4. **Final review/release:** Claude reviews the completed work; Codex fixes findings. Owner/external testers execute required Low/Mid phone and service checks before commercial release.

Stop rules:
- Diagnose repeated failures, add regression coverage, document unresolved risks and continue unaffected work. Obtain external expertise where needed without claiming the blocked gate has passed.
- Never merge red CI or weaken accepted fixtures. D17 supersedes older automatic pause rules.

## 5. Task order

Full details, prompts and "you check" steps are in `build-process-guide.md` §7. Specs come from `combined-research.md` §L.2. ⭐ = Claude deep check.

| Phase | Tasks |
|---|---|
| 0 Proofs | PH0-T01 repo + CI · PH0-T02a ⭐ independent geometry fixtures (**merged PR #60, before D16**) · PH0-T02 ⭐ geometry core · PH0-T03 ⭐ core-model + undo · PH0-T04 2D view · PH0-T05 ⭐ 3D view · PH0-T06 perf page · PH0-T07 Android build + phone benchmark · PH0-T08 ⭐ local save + kill test → **expert review** |
| 1 Foundation | PH1-T01…T05 |
| 2 2D editor | PH2-T01…T03, PH2-T04a ⭐ fixtures, PH2-T04 ⭐ doors/windows, PH2-T05, PH2-T06 |
| 3 3D | PH3-T01, PH3-T02 ⭐ worker/stale guard, PH3-T03…T06 |
| 4 Furniture | PH4-T01…T05 |
| 5 Cloud | PH5-T01 ⭐ RLS, PH5-T02, PH5-T03a ⭐ fixtures, PH5-T03 ⭐ save protocol, PH5-T04…T06 |
| 7 Mobile | PH7-T01…T06 (T06 ⭐ security) |
| 8 Release | PH8-T01 ⭐ billing … PH8-T08 ⭐ release |
| 6 AI | After the first release only |

## 6. What NOT to do

- Do not begin an unrelated scope change; communicate plans and proceed under D17 for the agreed development.
- Do not build features outside the current task, especially electrical features, website pages, AI, multiplayer or iOS.
- Do not save Konva or Three.js state as project data.
- Do not alter independent cases/expected values to make code pass. D16 permits Codex's initial exact copy from Claude's source PR comment for PH2-T04a/PH5-T03a, with the comment linked in the fixture PR; disputed corrections require owner resolution and a corrected Claude source comment.
- Do not weaken or delete tests.
- Do not put secrets in code or chat.
- Do not add GPL/AGPL code or unlicensed assets.
- Do not tell the owner something works without test output and phone steps.

## 7. ID glossary

| Prefix | Meaning |
|---|---|
| PHx-Tyy | Roadmap task (Part L) |
| PRD-FR / PRD-NFR | Requirement (Part C) |
| ADR | Technology decision (§D.25) |
| TRD | Technical requirement (Part D) |
| DM, GEO, SYNC, REN, PERF, AST, REL, SEC, UX, AI, MON | Test IDs (Part M) |
| F-xx | Planner 5D feature evidence (Part A) |
| §X.n | Section in combined-research.md |

---

## 8. Prompts for the owner to paste

**Prompt 1: onboarding.** Paste this first, in a new Codex task, with repo `Home-ai` and branch `claude/planner5d-reverse-engineering-lvgvo9` (or `main` after the merge).
```text
You are the main builder for this project. Read AGENTS.md, docs/codex-start-here.md,
docs/build-process-guide.md and docs/combined-research.md (focus on Parts 0, C, D, E, F, G, H, L, M).
Do NOT write code yet. Reply in simple English (I am not a programmer):
1) What we are building and for whom, in 5 lines.
2) The rules you must follow (top 10).
3) The Phase 0 tasks in order, and which ones need Claude's deep check.
4) Any contradictions, unclear points or risks you found in the documents, with file + section.
5) What you need from me (accounts, phones, decisions) before PH0-T01.
```

**Prompt 2: repository setup.** Run after Prompt 1 looks right.
```text
Task: repository setup (no app code).
1) Open a pull request that merges branch claude/planner5d-reverse-engineering-lvgvo9 into main.
2) After I merge it, create one GitHub issue per task listed in docs/build-process-guide.md Part 7
   (title "PHx-Tyy short name", body = the task's specific instruction + "You check" text),
   labels: phase-N, and "star" for ⭐ tasks.
3) Give me click-by-click steps to protect the main branch (require PR + passing checks).
Show me the plan first and wait for my OK.
```

**Prompt 3: first build task.**
```text
Task PH0-T01: Repo skeleton + CI. Follow AGENTS.md and docs/build-process-guide.md §7.2 (PH0-T01 row).
pnpm monorepo with only packages/geometry, packages/core-model, apps/web (React + Vite, TypeScript strict);
GitHub Actions running lint, typecheck and tests on every PR; docs/decisions/dependencies.md; pin Node LTS and pnpm;
fill the commands section of AGENTS.md. Show the plan first and wait for my OK. Then implement on branch
ph0-t01-skeleton, run pnpm check, open a PR with actual output and an Owner summary.
```

After that, use the task prompt template in `build-process-guide.md` §7.1 for every task.

**Claude Code prompts.** Use claude.ai/code connected to the same repo; it reads AGENTS.md too. D16 applies to every Claude session: review only, no development/file edits/commits/pushes; reply in a PR comment or chat. Independent cases/expected values must be supplied in a PR comment.

⭐ **Deep review (Opus):**
```text
Read AGENTS.md and docs/codex-start-here.md. Review ONLY the diff of PR #[N] (task [PHx-Tyy]) against the
combined-research sections it names. Max 10 real problems, most serious first: file + line, why wrong,
a concrete failing test. Also list important cases the tests do not cover. Reply in a PR comment or chat.
Do not develop, edit files, commit or push (D16).
```

**Weekly batch review (Sonnet: run `/model sonnet` first):**
```text
Read AGENTS.md. Review ONLY the diffs of PRs merged this week: #[N1], #[N2], ... Max 10 real problems overall,
most serious first: PR, file + line, why wrong, failing test idea. Keep it short; reply in a PR comment or chat.
Do not develop, edit files, commit or push (D16).
```

**Independent cases (Opus, before PH2-T04/PH5-T03):** use the Claude C1 comment prompt in `build-process-guide.md` §7.1, then give its source-comment URL to Codex's transcription prompt. Claude never writes fixture files or opens/pushes a fixture PR. PH0-T02a's existing PR #60 remains unchanged.
