# D30: doors/windows and host placement

PH2-T04, Codex under D17, 2026-10-14. Accepted PR60 fixtures and project schema1 are unchanged. Future Claude comment fixtures remain deferred; new analytic/property/browser/mesh cases are explicitly Codex-authored.

## Model and host rules

Add/Update/DeleteOpening and ReverseWall remain canonical atomic commands. Offset is the centre distance from host end A, integer mm; widths/heights/sills use strict measured parsing. Doors have sill0; windows require nonnegative sill and sill+height<=wall height. L0 rejects interval overlap even when vertical bands differ; touching intervals are allowed. End guard is50mm plus perpendicular junction/free-cap half-thickness (zero added thickness at collinear continuations), shown for both ends. This is an editor geometry rule, not construction-code approval. Explicit reverse swaps ends/side materials, maps offset toL-offset and toggles flipX.

MoveJunctions accepts optional command-only openingPlacement: a(default), b or centre. For every hosted wall whose length changes, shift centre offset by0, deltaLength or deltaLength/2 before normalization/lineage rehosting. Centre means preserve the previous signed distance to the wall midpoint, rather than snapping an off-centre opening to the midpoint. A fractional-mm shift rejects the whole command; no rounded/deleted opening. Invalid metadata on other commands rejects. The numeric wall panel exposes these choices and states that all affected length-changing hosts are included. Pointer edits retain defaultA. No schema field is persisted.

A split rehosts only if an opening's full interval lies in one lineage child, then rechecks the child's new end guards. Through-splits reject. An opening outside a resized host's extent reports clearance rather than falsely describing a split. Existing overlaps/guards/vertical validators reject shortening or thickening that makes any opening invalid; normalization and undo remain atomic.

## UI and rendering

Choose wall in the wall panel for new openings; choose an existing opening in its DOM list or canvas pick for editing its immutable host/kind. New door/window defaults are explicit measured fields. The controls show host ID, endpoint guards and wall height, offer hinge/swing controls for doors, and prepare save/delete/reverse without changing history/saving. Confirmation rechecks project/session/generation and executes once. Input/entity/unit/generation changes, new pointer edits, Escape, blur/hidden and unmount discard drafts. Preview ownership isolates wall/opening cancellation so clearing a sibling cannot erase the active candidate; preparing one cancels the other.

Original parametric 2D swing symbols derive centre/hinge/leaf/17-point quarter arc from the same model. The oriented normal includes flipX as well as flipY: reversing tangent/normal and flipX therefore preserves hinge and swing world geometry. No Planner5D assets or external catalog files are used. door_asset/window_asset are existing placeholder metadata IDs, not a claim that detailed licensed catalog GLBs exist. Applied 3D remains the existing structural void/threshold/sill pipeline; switching view does not commit a draft. Detailed door leaves/window frames belong to the later asset phase.

## Verification and limits

Codex cases use analytic endpoint/interval/height/delta expectations, seeded reverse/delete/placement/symbol properties and exact undo. Mesh tests compare independent wall volume7782000000mm³ for a4000×3000,t200,h3000 rectangle with900×2100 door and1000×1200 window, verify ray holes/solid sill and reverse/delete/reload. Browser tests inspect complete exported documents, invalid-preview controls, cross-panel cancellation and explicit restore after reload. Evidence: ../verification/ph2-t04.md.

Real Low/Mid, Hindi keyboards/fonts, TalkBack, native lifecycle/provider, performance/tape/novice and final Claude/expert/security checks remain pending. Symbols are plan annotations; fit guards are not building safety certification.
