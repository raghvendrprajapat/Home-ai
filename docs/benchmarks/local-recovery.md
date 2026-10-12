# Local save/recovery — Low and Mid phone procedure

PH0-T08 has Linux transaction/browser crash evidence and a compiled native plugin. Every physical result below is **Pending**. Issue #11 remains open. This is for a tester with USB/ADB access; the owner only changes visible controls and reports results. Use disposable test drawings in debug package **com.gharplan.app.debug**, never real work. Its launcher currently says **GharPlan**, so the tester should use the exact component below to avoid opening a separately installed release app.

## Before testing

1. Use [phase0.md](phase0.md) to download/install the current CI debug APK, record its artifact/build/SHA-256 and connect each Low/Mid phone. Preserve existing drawings first; a signing-key mismatch can require uninstalling the debug package, which deletes its data. Do not uninstall/clear another app or a user's real project.
2. Record phone model, Android/WebView version, available storage, date, battery/thermal state and exact APK. Close the performance lab; run `adb shell am force-stop com.gharplan.app.debug`, then `adb shell am start -n com.gharplan.app.debug/com.gharplan.app.MainActivity` without a perf extra.
3. The editable sample should appear. Wait for **Saved on this phone**. If it shows pending/failed phone backup, export first and record the message; this is not a durability pass.
4. Tap **Export drawing**. Native file download is not implemented yet: copy **all** complete JSON into a safe file on the test computer using the displayed copy action or USB browser inspection. Confirm it parses and validates before considering it a backup. If clipboard access fails, the complete selectable text remains. Do not clear application data until a verified external backup exists.

## Ten diagnostic cycles per phone

1. Set Corner X to **4600**, tap **Apply coordinates**, and wait for **Saved on this phone**. Record the value and timing.
2. Tester runs `adb shell am force-stop com.gharplan.app.debug`, then `adb shell am start -n com.gharplan.app.debug/com.gharplan.app.MainActivity`. Choose **Restore saved changes** when offered. The X value must be 4600; switch to 3D and confirm it opens, then back to 2D. Export/validate the restored project; screenshots alone do not prove geometry.
3. Alternate **4700** and **4600** through ten cycles. Some cycles should kill immediately after Apply, others before/while the save label changes, others after Saved. Keep monotonic timestamps of each accepted edit and kill.
4. Before Saved, the last durable old/new drawing is acceptable only if edit loss is within the specified ≤2 s gate. After Saved, the exact acknowledged version must return. Invalid geometry, absent/dangling journal entries, wrong IDs, missing old work or false Saved is a failure. Save debug logs without project contents or credentials.
5. For a recovery prompt, try **Leave saved files untouched**, reopen choices and restore. Cancellation must not overwrite the drawing. The new editor session has no prior undo history; canonical recovered geometry remains.

This diagnostic is not release acceptance. REL-002 requires **100/100 valid opens** per agreed device matrix, before/during/after writes, ≤2 s lost edits and no false Saved. Instrumented timing/disk-head evidence is required; visual manual timing alone cannot prove p95 ≤500 ms. The native I/O bridge must be exercised on a real WebView; Linux fault injection is insufficient.

## Storage failures and clearing

Use only dedicated disposable test profiles/devices. Do not fill a personal phone's disk or erase real work. Testers should prepare controlled low-space/quota/WebView-eviction scenarios and record warning, retained memory/export and retry after space is available. Full native application-data clear or uninstall deletes both IndexedDB and `Directory.Data`; the mirror is not an external backup. No cloud restore/full file-import UI exists yet, and this portion of REL-010 must wait for PH1-T04/PH5. Android/OEM transfer-exclusion compliance also requires device verification.

| Gate | Low phone | Mid phone | Evidence required |
|---|---|---|---|
| Ten diagnostic cycles | Pending | Pending | Build, exact coordinates and exports, edit/kill timestamps |
| REL-002 100-cycle gate | Pending | Pending | 100/100 validation results; before/during/after write; loss bound |
| p95 journal ≤500 ms / total ≤2 s | Pending | Pending | Monotonic instrumented timing and actual durable acknowledgments |
| Native mirror recovery after WebView-only loss | Pending | Pending | Original and recovered IDs/areas; separate-copy semantics |
| Native-full/private/storage-clear scenarios | Pending | Pending | Warning/export/restore evidence; import gate after implementation |
| OEM backup/transfer rules | Pending | Pending | Device/version and attempted transfer/backup result |

Report failures with the phone, build, last action, visible save message and exact reopened coordinate. Do not report a screen that looks right as a complete pass. Claude/specialist review and commercial release remain separate pending gates.
