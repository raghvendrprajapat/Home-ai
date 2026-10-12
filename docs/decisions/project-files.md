# PH1-T04 — JSON admission and verified native file export

D25, 2026-10-12, under D17. FR-028; REL-001/003/005/010 and SEC-007. Project schema/storage envelope remain1; database remains2. No new runtime dependency or accepted-fixture change.

## Admission and identity

Only plain UTF-8 JSON, raw size1…10MiB inclusive, is supported. Outer gzip/ZIP is unsupported; the separate internal checkpoint codec may still compress. Persistence's platform codec performs fatal UTF-8 decode (UTF-8 BOM permitted), then core's reviewed version/schema/plain-JSON/geometry validation. Core stays free of browser/DOM types. Newer schema has a localized update-app message; invalid/malformed/unknown/fractional files reject without changing source bytes, active model or stored data.

The file read and parse worker each have a10-second watchdog. Token matching, abort cleanup, error handlers and worker termination stop obsolete results from becoming admissions. Underlying File/OS reads cannot universally be cancelled. The worker validates data, not image/CAD recognition; no upload/network request occurs. Tree-shaken import worker129.51kB serves existing validation/geometry code.

Preview displays stored name/units/room count. Cancel writes nothing. With an absent local/native identity, original IDs, dates, revision and canonical content round-trip unchanged. Existing metadata, trash, empty/damaged native directories or unknown/unavailable history require an explicitly named **new-ID copy**. Unknown scans are conservative; native directory inspection is bounded1000 and a1500ms diagnostic limit converts unresolved presence to copy-only. Identity is rechecked when accepting; atomic initialize refuses collisions that happen afterwards. It never overwrites/undeletes originals. A race/initial save failure may leave the admitted drawing in memory with truthful warning/export, rather than erase another head. File revision is metadata from the backup, not authenticated cloud acknowledgement; no cloud-save label is produced.

Switching first flushes the current session. Error/conflict/memory work cannot be replaced, even after a file preview. Full canonical state still belongs only to core commands/new-document constructors, never the UI store or renderer state. Derived-room repair is not automatically applied to imports.

## Native destination

```mermaid
sequenceDiagram
  participant UI as Export click
  participant Cache as Private Cache/exports
  participant Plugin as ProjectFiles native bridge
  participant Picker as Android system Save picker
  participant Provider as Selected content provider
  UI->>UI: Capture canonical UTF-8 snapshot
  UI->>UI: Attempt current save flush
  UI->>Cache: Unique UUID JSON + exact readback
  UI->>Plugin: path, byte count, SHA-256 only
  Plugin->>Cache: Canonical-path/size/hash check
  Plugin->>Picker: ACTION_CREATE_DOCUMENT application/json
  Picker-->>Plugin: Selected content URI or cancellation
  Plugin->>Provider: Bounded stream; flush and close
  Plugin->>Provider: Read back; exact count/hash
  Plugin-->>UI: Verified receipt or explicit failure
  UI->>Cache: Remove this settled transport source only
```

Native pluginCall/Android activity state holds small path/hash/count, never the full project payload. An app-owned executor keeps provider reads/writes off main/Capacitor/autosave queues. Only generated `exports/gharplan-[32 lowercase hex].json` inside the canonical private cache directory is admitted; directory/file symlinks, traversal, arbitrary filenames/nonfiles and invalid count/hash reject. Source streaming and destination readback both enforce exact byte count and SHA-256, max10MiB. The standard reference SHA-256 of `abc` is also tested. A content URI comes from the system picker; no persistent URI grant, new storage permission, broad FileProvider path or public-file URI is added.

Private cache is transport only, distinct from native canonical Directory.Data mirrors. The JS adapter verifies cache text and destination receipt, and deletes only its own unique source after the native call settles. Cleanup runs separately and cannot hold a verified/cancelled/failed acknowledgement; failure or stall retains an orphan; production refuses new sources at32 existing cache entries. Provider stalls remain possible; they do not block browser autosave and the complete JSON copy remains accessible. Export is a **click-time snapshot**; later edits require another export. Cancellation/failure never acknowledges a verified file. A partly written external destination can remain; it is not automatically deleted. Initial cache failure can still fall back to complete JSON. Files/data on providers can change later or depend on remote sync; SHA is corruption detection, not authenticity or cloud durability. App-data clearing/uninstall can remove canonical stores and temporary sources, not user-managed external backups.

Alternatives: official MIT `@capacitor/share8.0.3` was inspected with official registry/integrity/API evidence but not installed: a share result is a chooser acknowledgement, not verified destination content. Web Share availability varies in Android WebView; broad external-storage paths/permissions increase maintenance/privacy risk. Direct system save needs custom native glue and real-device/provider testing, but has a narrow owned interface and no added runtime package. Confidence: medium until Low/Mid/Downloads/Drive/cancel/process-death gates run. Native recipient sharing is separate; this task provides a real Save-file workflow.

CI runs Java helper tests, compiles/lints a debug APK, disassembles MainActivity registration and verifies app-owned classes/import-worker/package/assets. These are not a native picker/provider execution test. Issue15 retains physical export→fresh app storage→import/lifecycle evidence; issues10/11/14 and specialist/final Claude/security/release gates remain open.
