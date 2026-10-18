# D68: FR-032 conflict choices and version history

Status: accepted by Claude Code under D52 + the owner's D63 permission (2026-10-18). Builds on D65 and D67.

## Conflict (another device saved first)
Cloud saving pauses and the local drawing is kept (D67). The panel then offers the three §H.5 choices. It never merges.
1. **Open the cloud version as a separate copy.** The cloud head is loaded, checked by the normal parser and opened as a new device drawing with a fresh id. That copy is not saved to the cloud. Neither drawing changes.
2. **Save my version as a new cloud project.** This device's drawing is opened under a fresh id and saved as cloud version 1. The other device's project is untouched.
3. **Replace the cloud version with mine…** A confirmation names the cloud version being replaced and says the older one stays in history.
   - On "Yes", one save goes on top of that reviewed head. The request's base and the document's revision are that head.
   - The server stores it as head + 1. The app then moves only `document.revision`, using the new `store.adoptServerRevision`.
   - If the cloud moved again in the meantime, it is another conflict.

## Version history
- "Version history" lists the kept versions, newest first. The server keeps the newest 20 (D65).
- **Open as a copy:** loads that version, checks it, and opens it as a separate device drawing. Nothing else changes.
- **Restore:** offered only while everything here is saved in the cloud, and only after a confirmation that names the new version number.
  - The server makes the old version the new head (head + 1; the head never moves backwards, and nothing is deleted).
  - The app loads that head and replaces this drawing with it using the new `store.replaceFromServer`.
  - Because the old undo/redo steps belong to the replaced drawing, they are cleared and the edit generation advances.
  - If anything was edited here while the restore ran, the drawing is not replaced. Cloud saving pauses as a conflict instead, so no local work is ever thrown away.

## Store additions (core-model)
- `adoptServerRevision(expectedCurrent, confirmed)` moves `document.revision` forward. It needs `confirmed > expectedCurrent` and the current revision to match; geometry and history are unchanged.
- `replaceFromServer(document)` takes only a valid, newer revision of the same project id. It sets the content exactly (including removing optional fields the head lacks), clears undo/redo and advances the generation. It refuses anything else without change.

## Not done
- A side-by-side comparison view; the "inspect" choice opens a separate copy instead.
- Version labels.
- Premium retention of 100 versions (billing is still gated).
- Android sign-in.
- Phone tests.
