# PH3-T03 / FR-024 follow-up — wide split view

2026-10-17 · [D51](../decisions/wide-split-view.md) · [results](ph3-t03-split-results.json) · [owner handoff](../claude-code-handoff.md) · [final checkpoint](https://github.com/raghvendrprajapat/Home-ai/issues/98).

Explicit2D+3D mode is available only on measured drawing panels≥760CSSpx. Both actual renderers read the same canonical store and share wall/room/furniture selection. Structural3D updates acknowledge applied generations; numeric/pointer previews stay transient until their original command commits. Narrowing returns2D and widening does not resurrect the mode. View changes retire pane owners.2D final pointer release rejects changed canvas mapping/window dimensions synchronously, before delayed resize/scroll delivery can produce an edit.

## Verification

The initial six-case browser run passed34.9s. Initial pnpm check failed only the new test fault wrapper's overloaded WebGLgetExtension typing. The wrapper now delegates unknown extensions via Reflect.apply with an explicit unknown/runtime function guard and overrides only WEBGL_lose_context; every original assertion remains. Corrected pnpm check passed453product/65files(35.34s)+18tooling. Seven focused browser cases then passed49.7s, adding actual cross-pane multi-touch cancellation and fresh native edit recovery. After the product draft-preservation fix,17affected/new browser cases passed1.7m and pnpm check453+18passed43.98s. Fresh debug BUILD SUCCESSFUL43s; APK SHA256cbfa8ee709dd5b87661a7e8bf9ac4b69f67716a299a53c0a8887b9938cfef873,74webfiles byte-equal, compiled registration/v2signature verified. The adjacent JSON freezes source hashes and unit/focused/debug evidence. Corrected full128case local and pinnedCI results are recorded after commit in the PR and FINAL issue #98; this document does not claim a still-pending check passed.

The first full128case run passed126andfailed2in9.2m. Existing furniture-advisory and placement regressions showed that the new shared changeView handler called cancelPrecision, which cleared tagged property/placement drafts on a2D/3D switch. No assertions were relaxed. View transitions and narrow fallback now preserve those existing drafts; keyed pane teardown still retires physical held-pointer intents. Both failing traces are retained locally. The original seven focused cases passed before this defect was found; only the new corrected affected/full runs and fresh rebuilt artifact can validate the fix.

The cases positively require two simultaneous non-overlapping live canvases≥360px, actual shared canonical wall paint/zeroCPUrebuild/onehistoryUndo/Redo, actual2Droom and projected3Dfurniture picks reflected in both panes, read-only geometry preview then structural Apply/Undo, narrow-layout fallback without model/history writes, and real stuckGPU loss preserving the same editable project/Undo. The viewport regression requires the same connected canvas node and exact unchanged rectangle while the actual window dimensions change; final release must reject. Cross-pane native touches keep edits blocked until every contact lifts; a fresh hold/move commits once and Undo restores exact JSON.

Full existing tests remain unchanged and required. No accepted fixture/schema/asset/dependency change. The CI Check job infrastructure budget changes10→15min because catalog CI already required9m25s before these additional seven cases. Individual30s deadlines, zero retries, assertions, fixtures and performance targets are unchanged. This is not a product performance relaxation.

## Limits and handoff

Local LinuxChromium151/SwiftShader and pinnedCIChromium156 evidence remain distinct. Browser390px simulations are ordinary regressions, not real phones or mobile optimization. GPU/resource/V8 lifetime evidence is scoped and excludes whole-process/native/worker/driver memory. Android checks compile existing debug targets and inspect actual packaged bytes; no release packaging, emulator/phone/provider execution or Play readiness is implied.15existing lint warnings and cached native helper tests remain disclosed.

Physical Low/Mid,200msmaterial timing, accessibility/novice/external/independent/finalClaude and every D36 gate remain pending. D52 requires Codex to finish this already-running task, publish issue #98's FINAL checkpoint and stop; no new wall-drag or other feature starts. Claude receives the owner's continuation prompt before becoming the next sole builder. Its own development review cannot be relabelled independent.

| Requirement | Evidence | Remaining |
|---|---|---|
| FR-024/SYNC-001/003/005 | Simultaneous actual renderers; shared selection, canonical paint and structural Apply/Undo generations | Physical/external measurement and remaining wall-drag Must |
| SYNC-006/UX-004 | Exact finalmapping/window fences; native cross-pane secondtouch cancellation/fresh recovery | Device/OEM/accessibility validation after D36 permission |
| REN-007/009 | Actual stuckGPU fallback with exact live project/history; full existing context/lifetime suite | Whole-device/driver memory and independent validation |

Only after separate explicit D36 permission, prospective phone steps are: use existing narrow2D/3D toggle; on a sufficiently wide tablet/window choose2D+3D, select in either view, paint one side, Apply a measured change and Undo; rotate/narrow the window, recover2D and reopen. Record hardware/OS/WebView/build/timings and observed faults. These are future instructions only, not executed or authorization.
