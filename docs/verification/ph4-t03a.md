# PH4-T03 stage A — exact-version placement

Executed2026-10-15, base PR87 merge69484fc9d2a80b26fa0c865f49f11bd27efc2340. [D41](../decisions/furniture-placement.md) defines scope. This stage adds Place in drawing → staged values/preview → Add/Cancel; issue32 remains open for GLB lifecycle and gestures/advisory geometry. No completed full furniture journey or real-phone acceptance is claimed.

## Executed checks

```text
pnpm check:361product tests/53files passed,31.44s;18tooling passed,0failure/skip.
GHARPLAN_CHROMIUM_PATH=/usr/bin/chromium pnpm e2e:72passed(5.4m),0skipped.
Focused transform/placement/ghost:11passed734ms, including two100-case analytic properties.
assets:check:1original asset,0official validator errors/warnings,1rights record.
assets:versions:PR87 baseline69484fc9d2a80b26fa0c865f49f11bd27efc2340;1historical version unchanged.
Protected owner/spec/accepted fixture integrity:39files,0mismatches.
sample-project.json Draft202012:valid,0errors.
Production:165449initialgzip bytes/1module,600000limit,crashhooksabsent.
Gradle debug assemble/lint/unit:BUILD SUCCESSFUL in28s;170tasks40executed130up-to-date.
DebugAPK:8114378bytes,16production files byte-equal,v2signature verified.
SHA256:9f28eb58f012099f1a7dcaa23bf32ead459aeda87be6ee7b019bd4d7d39c0e1a.
Fresh decodedmanifest/dex confirms existing plugin registration.
Native9unchanged cached reports:0failure/error/skip;lint0errors/15existingwarnings.
```

The [results JSON](ph4-t03a-results.json) records the full retained browser result, resource evidence and actual recovery timing. Linux installed Chromium151/SwiftShader differs from pinnedCI156 and is not a phone. No new dependency, schema, original asset artifact or accepted fixture changed.

| Contract | Evidence |
|---|---|
| Native pin / command | Actual1200×600×750 native size; measured1.5→1800×900×1125mm,37°,300mm elevation; exact version1 retained even if source DTO changes. Preview leaves full canonical JSON/history unchanged, Addone, duplicate submit refused, oneUndo/Redo and parse/reload byte-equivalent. |
| Invalid / stale | Far viewport centre2000000/−2000000 remains editable and is not clamped. Invalid numbers, negative elevation, zero sizes and out-of-domain values reject; changing project/session/generation/hash invalidates. Inputs can recover to valid. |
| Analytic scaling |100generated sizes, independent integer formula floor((3n+1)/2), unique draft IDs and no history. Existing measured-adjustment tests retained after shared rounding helper extraction. |
| Three geometry | Actual Three mesh at1.2/1.0625/1.5m with floor200/elevation300,37°yaw,1.8×1.125×.9scale; worldbounds bottom.5/top1.625m.100generated rotated projections match independent cosine/sine rectangle extents, no model mutations. |
| Helper ownership | Validtwoleases, updates retain allocations, invalid/cancel clears tozero, fresh retry allocates new owned resources, close exactlyonce; forced attribute allocation fails with geometry disposed and empty owner. Stale/pending tags allocate no helper. |
| Browser workflow | Native catalog Choose, focused measured inputs, refresh survives its own drawing.clear epoch; Cancel/Escape no history, actual double-click Addone, Undo/Redo and explicit Restore saved changes preserve exact JSON/pins; existing3Dview uses same values. |
| Lifecycle | Browser blur, competingWall mode and modelgeneration change cancel.3D validhelper→invalid→valid→Cancel releases resources; CPUrenderedgeneration stays0. Independent reviewer switches session and sends duplicate submit while controls deliberately remain mounted. |
| Capture / views | Actual GPU draw count increases byone with validhelper. Same camera/model PNG bytes with and withouthelper match; helper restores aftercapture.2Dswitch shows detached oldview resources0, returning3D retains the37°draft and recreates helper; Cancel clears it. |

## Fresh review and diagnosis

Fresh read-only Codex review ran11focused tests997ms and2independent temporary React probes1.29s. Duplicate submits commit exactlyonce, Undo restores fullJSON, invalidscale neverwrites, switchedsession cancels, and unmount clears preview/removes Escape/blur listeners. No concrete source blocker remained. Its requested PNG evidence was added and reviewed. Claude was not invoked.

The first targeted browser run passed3/4. The reload assertion expected the editor immediately, but the actual UI correctly showed the existing Restore your drawing dialog; the new test now explicitly chooses Restore saved changes, matching the established recovery flow, and still compares complete JSON. The subsequent five targeted cases passed23.5s. The capture case was then strengthened with actual extra-draw evidence for the retained run; no existing assertion/fixture or retry policy was weakened.

## Remaining scope and prospective phone steps

Current3Dfurniture representation is still dimensioned boxes. StageB adds exact-version GLBs, loading/failure/retry/resource lifetime; stageC adds drag/rotation/nudge/snap/collision. Only the original desk ships; materials and larger catalog follow. Linux scalar resource checks are not whole-device/GPU-byte/thermal/OEM/TalkBack/Hindi layout/native provider proof. Cached native tests are not fresh Android execution.

D36 scopes remain unstarted and require explicit permission first. Prospective protocol only:

1. After permission, back up a disposable drawing and safely install the reviewed debug build on Low/Mid.
2. Browse furniture → Place in drawing; change explicit-unit coordinates/rotation/scale. Cancel and verify no object. Repeat → Add; verify exactlyone item and oneUndo/Redo.
3. Save/reopen, verify desk version/size/position. Toggle2D/3D, then try another unconfirmed placement and Cancel. Record device/WebView/build, layout/touch errors and actual timings; this PR alone does not prove phone suitability.
