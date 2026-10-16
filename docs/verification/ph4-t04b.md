# PH4-T04 stage B — GPU material bindings

2026-10-16 · [D48](../decisions/material-gpu-bindings.md) · [results](ph4-t04b-results.json).

A same-scale paint change now retains structural GPU geometry and attributes in both existing renderer paths. Batched geometry keeps its triangle order and picking ownership while current material groups can split or merge. Actual UV and shape changes still replace dependent geometry. Visible wall-side palette and complete 2D material presentation remain pending; this does not complete FR-022/SYNC-005 or its device timing gate.

## Evidence

The JSON records actual final check/browser/build counts, measured pixels, upload calls, resource lifetime diagnostics, debug APK bytes/signature admission and protected inputs. Eight new GPU cases cover both rendering paths: 20 split/coalesce cycles each, every visible triangle's analytically expected colour, retained mesh/geometry/attribute identities, exact changed descriptor IDs, unchanged allocation counts, actual UV/shape rebuilds, first and late acquisition failure, corrupt coverage and complete disposal. Two additional batch cases include 100 seeded properties with nonzero source offsets, split intervals, category/ID collisions and coalescing, plus malformed ownership/source coverage rejection. Accepted fixtures are unchanged.

The focused actual-browser material run passed all 3 cases, including the retained CPU/neighbor/Undo test. Actual WebGL2 bufferData is instrumented independently of adapter diagnostics: initial uploads must be positive, then paint and Undo must cause no additional bufferData calls. PNG floor pixels change and restore exactly. Low-path calls stayed 31; mid-path calls stayed 45. Low pixels white[234,233,231,255]→blue[217,225,228,255]→the same white; mid pixels white[210,210,209,255]→blue[180,195,205,255]→the same white. These are Linux software-GPU observations, not physical-phone performance results. bufferSubData updates of unrelated instance matrices are outside this claim.

The final whole-app suite passed all108cases together in8.2m; pnpm check passed445product/64files in34.45s plus18tooling cases. Android debug BUILD SUCCESSFUL in41s;16packaged web files were byte-equal and actual manifest/compiled plugin registration/v2signature checks passed. APK SHA256:5d664b5bfd950bd2e45be9a8408d647b91e9b33d9331698f2587a20e88a52231. Full results follow in the adjacent JSON. Resource diagnostics measure the tested renderer's main-frame V8/owned resources; they do not measure whole-process, worker, native or GPU-driver memory. Android compilation and packaging are existing debug checks, with cached native helper reports; no emulator, physical phone or release artifact is claimed.

## Failures and audit

Before implementation, the new GPU regression file reported 4 failures and 2 passes: paint replaced existing geometry in both paths. After rebinding, the original 6 cases passed; late-acquisition/coverage failures and source-interval properties were then added. The first full check rejected the browser probe's TypeScript overload signature for bufferData, even though its actual browser run passed. A variadic unknown-argument wrapper forwards the untouched call with Reflect.apply and accepts every DOM overload; no product type, test assertion or runtime threshold was loosened. The subsequent full check is recorded in the JSON.

The stage-A exact changed-ID test remains unchanged. A changed descriptor is still reported as replaced; actual retained buffer identity is verified separately. Audit checked geometry-first lease ownership for structural objects/batches, acquire-before-release semantics, retained sourceStart and face-index mapping, legal __ceiling name isolation, UV/structural rebuild triggers and full pool closure after failures. This self-audit is not external certification.

## Traceability and pending gates

| Requirement | Executable evidence | Remaining |
|---|---|---|
| FR-022 / SYNC-005 | Stable CPU bindings plus retained GPU attributes; per-side/floor/threshold colours; exact Undo and unchanged neighbor | Visible palette, complete 2D fills, measured editing cadence |
| REN-003 / REN-008 | Every sample triangle assignment, interval properties, no new actual bufferData uploads, real UV rebuilds | Broader asset/texture corpus and physical-device targets |
| SYNC-001/003/006/008 | Existing complete worker/picking/gesture/retained-scene/Undo browser corpus | External/native-provider/device gates |
| Resource correctness | Identity/disposal tests, first/late material-failure closure, real renderer lifecycle/context recovery | Whole-process/driver/device memory validation |

Only after separate explicit D36 permission, prospective phone steps are: open two rooms, paint one shared-wall side and one floor, check the other room unchanged, Undo/Redo, reopen and compare 2D/3D in Hindi. Record device/OS/WebView/build and timing. These steps are not executed and grant no permission. All D36 scopes remain unstarted. The next authorized materials stage is visible per-side/floor controls and material presentation.
