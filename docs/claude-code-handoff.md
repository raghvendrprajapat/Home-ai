# Codex → Claude Code development handoff

Owner instruction:2026-10-17. Repository:[raghvendrprajapat/Home-ai](https://github.com/raghvendrprajapat/Home-ai).

**Authoritative final checkpoint:[GitHub issue #98](https://github.com/raghvendrprajapat/Home-ai/issues/98).** Continue only when its status is FINAL; it records the exact merged main SHA, last PR/check heads, remaining work and no-overlap status. This document is included in the last already-running split-view PR; its own future merge SHA cannot be embedded here before merge.

**Codex stops after finishing that existing task and publishing the final checkpoint. No new wall-drag or other feature was started after the owner's stop request.** Claude starts only when the owner sends [the continuation prompt](claude-code-resume-prompt.md). D52 makes Claude the next sole builder for that delegated continuation and supersedes D16's earlier development/push ban for that work. Never run both builders concurrently. This is a development handoff, not final Claude review or permission to enter D36 scopes.

## Read in this order

1. Issue #98, including exact FINAL checkpoint and any later owner changes.
2. `AGENTS.md`; `docs/codex-start-here.md` §2, especially D11–D17/D36/D47–D52.
3. `docs/combined-research.md` (canonical tracked spec); `docs/build-process-guide.md` (D17/D36/D52 override older workflow examples).
4. `docs/verification/ph4-t04c.md` + JSON, `ph4-t05.md` + JSON and `ph3-t03-split.md` + JSON; related decisions linked there.
5. The actual current source/tests and open GitHub issues. An open issue often retains physical/external gates after code merged; it does not mean that its entire feature is unbuilt.

## What is implemented

| Area | Current implemented behavior | Evidence / practical limits |
|---|---|---|
| Foundation | Pinned TypeScript/React/Vite workspace, checked public package boundaries, schema/admission/migrations, Hindi/English shell/settings, CI and Capacitor Android debug app | Phase0/1 verification records. No release/store or physical-device completion claim |
| Geometry/model | Integer-mm orthogonal one-floor model, normalized shared L/T junctions, clear-face rooms/areas, atomic commands, explicit ambiguous-room identity, exact live Undo/Redo and monotonic async generations | Geometry/core-model tests and immutable PR #60 fixtures. No free-angle/X-crossing/multifloor support |
|2D editor | Canvas zoom/pan/pinch, touch hold/loupe, wall chains and rectangles, snapping/grid/units, typed lengths/properties with preview, room names/types/ceiling heights, door/window controls, shared selection/multi-select/dependent delete/furniture duplicate | PH2 verification. **Wall-segment dragging is implemented by the D53 task** (selected wall, sideways, collinear chain follows; see [decision](decisions/wall-segment-drag.md)); junction dragging and numeric wall edits also work |
|3D | Same canonical ProjectStore; worker-generated wall/opening/floor/threshold/ceiling geometry, stale-result fences, orbit/limits/bookmarks, quality/lighting, batches/instances, picking, actual GLB loading, resource ownership/context recovery and same-store2D fallback | PH3 and PH4 evidence. Existing tests include actual pixels/WebGL uploads/resources. Walkthrough is deferred C1 |
| Local projects | Create/open/rename/duplicate/trash/restore, transactional browser autosave/recovery, guarded native Filesystem mirror, strict JSON import/collision copies, JSON/system-picker export and2D/3D PNG capture | Local storage only. **Not accounts, cloud sync or persistent project version history.** Native-provider/kill/Low–Mid evidence remains pending |
| Furniture | Bilingual local category/search/paging/retry; exact asset/version placement, previews/Add/Cancel,2D/3D movement/rotation, uniform sizing, explicit alignment/nonblocking collision warnings, Undo/Redo/reopen | PH4-T01…T03. Perspective automatic wall snapping/two-finger furniture rotation and other issue #32 limits remain deferred |
| Surface colours | Independent wall-left/right and room-floor swatches, atomic local-library installation/paint, canonical2D/PNG colours, structural CPU/GPU buffer reuse and exact Undo/Redo | PRs #94–96; solid colours only. Patterns/textures, furniture colour variants and physical200ms validation are pending |
| Catalog breadth |30original nominal planning models/eight categories, source/provenance/rights, official GLB validation, bilingual metadata,256pxSVG thumbnails, immutable hashed versions | PR #97;30items/60blobs,0validator errors/warnings, max192triangles/3828bytes perGLB. Simple original box artwork, not manufacturer/photoreal assets |
| Wide split view | Explicit2D+3D on drawing panels ≥760CSSpx, one store/shared model-ID selection, committed-generation updates, transient previews, narrow-window2D fallback, native cross-pane cancellation/fresh recovery and final2D pointer mapping checks | The final split-view PR/checkpoint in issue #98. Browser simulation is not mobile optimization or real-phone testing |

Core2D/3D runs on the user's device. The current app requires **no backend GPU**; future accounts/sync can use a CPU backend. AI is excluded before first release; self-hosted AI/server photoreal rendering is not part of the implemented system.

## Latest completed checkpoints

| PR | Exact tested head | Required successful CI | Merge |
|---|---|---|---|
| #96 surface controls | `9aa6802dcb202706d2d36b3eeea7f748b04b8478` | Run38917764269; Check117029545343, Android117033346907; CLEAN before SHA-guarded merge | `e36336d860c08f098d19c6325c7969214389802f` |
| #97 original30item catalog | `dcb0d545dea508ee0c0cf588f0fea05560b325de` | Run38919696211; Check117036108665, Android117040554780; CLEAN before SHA-guarded merge | `7862dea5150e7fe7e524411fac6b0c7e658c3f8d` |
| Existing split-view task + this handoff | See FINAL issue #98 for the exact final head/jobs/main SHA | All required checks must be COMPLETED SUCCESS, not pending/skipped | Never infer a passing merge from this document alone |

Material heads6dd2c55 andea033d7 both failed CI at an exact unchanged-button-rectangle precondition before pointerup; neither was merged. The9aa6802 test waits for actual saved UI completion while holding the native pointer, retaining exact geometry/click/entity/Undo assertions. Its pinned CI passed. **Historical cause of the earlier CI movement is UNKNOWN**; the first driver-scroll hypothesis was insufficient. Do not weaken those assertions or claim proven historical causality.

Catalog:453product/65files+18tooling checks,8focused browser cases41.9s, full121case integrated runs8.6m and8.5m on localChromium151. Catalog debug BUILD SUCCESSFUL32s, APK8122614bytes SHA25697a6a659888145a036c75e327544b9eed88605ad789d505ef3128e21cbf1006e,74webfiles/60blobs/manifest byte-equal,0lint errors/15existing warnings,9cached native helper reports0fail/error/skip. The split task has its separate fresh evidence; never reuse an old APK hash as a new build result.

Split-view verification also caught a real regression before commit: the first full run126pass/2fail discarded property/placement drafts on view changes because changeView called cancelPrecision. The fix preserves those tagged shared drafts while renderer keys retire held pointers. Original assertions were retained; see its final focused/full/debug results. Do not reintroduce broad draft cancellation merely to cancel a physical gesture.

## Remaining work: resume without rebuilding completed features

**FR-008 wall-segment dragging was completed after the D52 handoff (D53).** It is one atomic `MoveJunctions` built by `wallMoves` (view2d.ts), previewed through `store.preview`; `MoveWall` is unchanged and equals the drag for walls without collinear neighbours (tested on sample w7 +100 mm: exact 21119175/15395175 mm²). Evidence and limits: [verification](verification/fr-008-wall-drag.md). The next eligible work is the optional editor list below; D36 scopes still need the owner's explicit permission.

Useful existing analytic reference: sample partitionw7+100mmX yields exact clear areas21119175/15395175mm²; original20642175/15872175mm². Rounded labels have separate tests. Existing junction drags and typed precision already cover related operations; inspect them rather than replacing them.

FR-003 starter templates (1 BHK, 2 BHK, single-room presets) were added by D54. Deferred/optional editor work includes material patterns/textures, furniture colour variants, perspective automatic back-wall snapping/two-finger rotation, richer art, furniture alignment/grouping and C1 walk mode (issue #29, only after proof). These are not claims of completed capabilities or blanket permission to expand L0.

### D36: explicit owner permission required BEFORE even preparatory implementation

- Accounts/authentication, cloud saving/sync, conflict resolution and project version history: issues #35–41, including future save-race fixture work.
- Mobile optimization/direct sharing/physical Low–Mid phone testing: issues #42–46 and retained phone gates in earlier tasks.
- Billing/subscriptions/paywalls/ads, security/privacy/deletion/release/store preparation and final Claude review: issues #47–55, plus corresponding older pending gates.

Do not treat “continue,” this handoff, the Claude builder role, debug CI or browser touch simulation as permission for those scopes. Ask the owner and wait for an explicit answer before starting each gated scope. Final Claude review is still gated; this builder's self-review is not independent certification.

AI remains after first release/spike (#56). No electrical/wiring features, marketing website, iOS, AR, real-time multiplayer, DWG/BIM, unauthorized proprietary assets/APIs or user3D uploads. Scope remains one floor/orthogonal walls and independent implementation.

## Non-negotiable technical invariants

- Commands are the only model writer; Konva/Three and Zustand UI are not project storage.2D/3D are adapters of the same store.
- Canonical coordinates/dimensions are integer mm; floats are derived/pointer previews only. PlanXeast/Ysouth/Zup maps toThree `(x/1000,z/1000,y/1000)` with negative yaw.
- D11 wall thickness50–1000mm inclusive. D12 every positive-clear-area closed face remains a room; warn below250000mm²; zero/negative rejects atomically, never silently drops rooms.
- `document.revision` stays server-confirmed; localGeneration increases on edit/Undo/Redo and is never reused. Async tags carry project/session/generation/dependency hash; stale results cannot publish.
- Opening offset is fromwall.a to its centre; reverse usesL−offset and togglesflipX; split through an opening rejects.
- Preserve accepted independent fixtures/expected values (PR #60). Self-authored tests stay attributed to their actual author. Any future independent provider's comment data must be copied exactly with provenance; disputed accepted values need owner resolution.
- Preserve catalog assetID/version/source/model/thumb bytes. Append a new version instead of modifying an accepted one. Flat2D RGB legitimately differs from lit3DPBR RGB while material IDs/side assignments remain shared.
- No new unrecorded dependency, GPL/AGPL/noncommercial asset or secret in code/logs/bundles. Never reset/clean/stash/add-all or silently stage owner files. Never merge red/skipped/pending CI or relax assertions/thresholds to pass.

## Environment and verification

- Node24.19.0; pnpm11.19.0; frozen lockfile. Run `pnpm check` before every commit; it includes schema/assets/version guards, lint/types/product/tooling tests. Run meaningful focused/full browser checks for UI/renderer changes, then required CI.
- Playwright1.64.0 pins Chromium156.0.8078.4/rev1248 in CI. This cloud checkout uses explicit `/usr/bin/chromium`151.0.7922.173/SwiftShader via `GHARPLAN_CHROMIUM_PATH` for local diagnosis. Keep evidence scopes separate. Pinned-browser download403 and direct GitHub job-log/artifact storage egress failures occurred; use approved policy/setup, do not bypass proxy/TLS or invent downloaded logs.
- `pnpm e2e` owns port4185, builds `dist-e2e` and runs one worker/zero retries. Do not switch/edit runtime source while its workers are running. Production `dist` is separate.
- `pnpm android:sync` and existing Gradle debug checks compile/lint/test helper code. JDK21/SDK36 paths/proxy details are environment-specific; see benchmark docs. Debug APK size is not a Play download/AAB size. No real emulator/phone or release packaging is verified by compilation.
- LinuxV8/SwiftShader/counted-resource results exclude whole-process/worker/native/GPU-driver memory and physical phones. No universal100% correctness, independent review,200ms/phone-performance or commercial-readiness claim.
- Preserve saved environment configuration/secret IDs/bindings. Existing dependency setup may already be configured; inspect rather than recreate credentials or network policy.

## Local workspace and no-conflict procedure

The final handoff issue records all outgoing development commits and whether any development PR remains open. Existing local owner inputs intentionally include deleted`.gitkeep`, untracked rootREADME, research/ and untracked research documents. They predate this work, are protected, and were not silently published.39protected inputs (including accepted fixtures) were checked by hashes with zero changes; sample schema validation passed. The canonical tracked combined-research/schema/verification documents are on GitHub.

Use a fresh checkout or carefully preserve existing local owner files. Fetch main, confirm the FINAL checkpoint is an ancestor/current reviewed state, inspect `git status` and open PRs, and create one new task branch from the current main. Never blindly overwrite another builder's branch or assume the old local branch is current. If the owner has restarted Codex or GitHub shows overlapping active work, stop that overlap before editing. Only one builder owns the next task.

Start with a short report of the actual checkout, completed/pending scope and intended FR-008 plan. Then work only under the owner's continuation prompt and D36 boundaries. Save each task in a separate reviewable PR and merge only the exact head with Check and Android debug completedSUCCESS/CLEAN. Do not manufacture percentages or device/independent-review evidence.
