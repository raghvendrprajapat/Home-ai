# PH4-T03 stage C2b — furniture warnings, snapping and owned drafts

2026-10-16 · [D45](../decisions/furniture-advisories.md) · [machine-readable results](ph4-t03c2b-results.json). Base PR #91 exacte7aa98d passed Check/Android in run38790884986 and merged2709f8d. Issue32 remains open for actual3D pointer transforms.

## Result and verification scope

Selected/current furniture and valid previews have nonblocking red dimension-box overlap status. Explicit draft alignment translates a supported parallel back edge≤200mm;2D pointer snapping acquires8px/200mm and retains12px/250mm before grid. Property and placement drafts have separate owner tokens; incomplete input takes ownership, tools transfer in both directions, and controlled selection changes cancel held intents before release. Both views use the visible preview's advisory. Materials for red selection/ghost helpers are reused; helpers do not appear in canonical JSON or3DPNG.

| Check | Actual result |
|---|---|
| Final resumed `pnpm check` |**410product tests/60files passed**,22.41s; **18actual tooling tests passed**,0fail/skip; schema/artifacts/immutable versions/lint/boundaries/types passed |
| Complete final browser |**94passed (6.3m)**,0skip, on the entire final source after all selection/return-origin fixes; interrupted earlier run not counted |
| Fresh read-only Codex |**7independent App/React probes passed6.30s**, **15focused cases/4files passed5.16s**, no remaining source blocker. No repository edits; not Claude-authored fixtures |
| New permanent product tests |6service cases (raw-before-grid/offset/Undo;8/12hysteresis/world caps;100free quantization properties; deliberate overlap/selfID; optional failure;100failed-cache previews then structural recovery),1React unavailable-assistance Apply/Undo,2pooled-color/resource cases |
| Five native browser cases |Odd115mm measured alignment/exact Undo/Redo/reload/both tool directions; actualpointer acquire→origin clear→reacquire→held10px→release/Shift; incomplete-input property↔placement ownership and2D/3D switches; deliberate collision/controlled-clear status/PNG exclusion; held pointer with cleared/changed selection |
| Production |initialgzip173024bytes/1module,600000gate; crash hooks absent |
| Android debug |Preserved final-runtime build **BUILD SUCCESSFUL in52s**,170tasks40executed130up-to-date, executed2026-10-15.9unchanged/cached native helperJUnit reports0failure/error/skip; lint0errors/15existingwarnings. Reconnect does not make this fresh device execution |
| Same-build APK |8114378bytes; SHA256`1af574a0f0fc4b272bcdbca4034efdf60dc038b704397aa095ca579d3820c4eb`;16production webfiles byte-equal. Freshly revalidated decoded manifest/compiled registration/v2signature after reconnect |
| Protected inputs |39hashes unchanged/0mismatches; sample Draft2020-12 schema0errors |

Local browser is Chromium151.0.7922.173/SwiftShader, distinct from pinnedCI156. No physical phone, native-provider, thermal or real accessibility result is implied. No new dependency/schema/publishedasset/acceptedfixture changed. Full exact-head Check/Android CI must pass before merge.

## Actual failures and corrections

Fresh review independently reproduced: furniture draft not cancelled by Wall; reverse Wall→property draft cancelling itself on an old-mode drawing epoch; incomplete input not acquiring ownership; canonical3Dclear status contradicting a red property ghost; stale local canvas pick resurrecting a controlled-clear advisory; held old-item movement committing after controlled selection changed; and return-to-origin leaving a stale snap note/key. Mode-edge cancellation, explicit input-intent acquisition, current visible advisory, controlled fallback restrictions, synchronous selection fences and stationary reset address these. Final7/7read-only probes passed; source/test gates are separate evidence.

New-test corrections remain distinct from source bugs: core Undo/Redo return booleans, not `{ok:true}`; testing-library role queries have no `exact` option; the actual tool button is `Select`, not an invented `Select / pan` label. Initial native hysteresis test ended only **2.5095238095238px** from its starting pointer (trace308.30952380952385→310.81904761904764), correctly a tap under the retained3px rule, so it produced no command. The new case includes100mm tangent travel and expects exact(2100,−358)mm, while preserving all old thresholds/fixtures. Early focused runs16pass/1fail and3pass/1fail are retained in temporary logs; later4native cases passed27.3s before the final selection/return-origin regressions.

Environment resumption interrupted the first94-case run after25reported passes and a later check after Vitest started; no terminal result, so neither counts as passed. The retry first ran zero browser tests because the owned orphaned e2e preview still occupied4185. Verified its PID/cwd/command, stopped only that process, then restarted the complete final-source browser suite. The completed resumed check is reported above. No production code was changed to resolve that setup issue.

## Remaining scope / prospective device instructions

C3actual3D pointer modes remain next; shared numeric/button/alignment controls already work in3D. Selected two-finger rotation stays deferred. Materials/catalog breadth, split view and other eligibleL0 gaps remain. All D36 accounts/cloud/history/mobileoptimization/sharing/realphone/billing/security/privacy/release/finalClaude work remains permission-gated.

**Only after explicit owner D36permission**, prospective Low/Mid steps: select an object, try a wall/furniture overlap and confirm it is a warning; align a parallel back edge, Apply/Undo, test draft Cancel/Escape, start a placement while an old object is selected, type an incomplete property value, change tools/selection, switch views and reopen. Record phone/OS/WebView/build and Hindi layout. These instructions were not executed and grant no permission. Physical/external/final-review release gates remain pending; no universal correctness or commercial-readiness claim.

Retained Linux lifecycle evidence:36warm-up +50measured view toggles, main-frame V8growth5.131505% against10%threshold, actual GPUrecovery464.900ms. Owned base pools/worker/RAF/keyboard and GPU counters return as asserted. These are sample fallback-pin diagnostics; worker/native/driver/wholeprocess/phone memory and loaded-catalog/thermal behavior are outside their measurement.
