# D31: transient selection and atomic batch editing

PH2-T05, Codex under D17,2026-10-14. No dependency/schema/accepted-fixture change. New tests/probes are Codex-authored; final Claude remains deferred.

## Eligibility and input

Editable batch selection is model IDs for walls/openings/furniture. Corners/rooms retain their own property controls; selecting them alone clears editable single selection and does not invent room/junction deletion. Selection/list/mode/marquee/highlights are transient, never saved. DOM checkboxes expose every eligible ID. Canvas single pick selects one; Shift-click and touch Multi-select toggle an eligible item, using existing overlap cycling. Desktop multi-select/Shift drag fully contains axis-aligned object bounds (rotated furniture uses exact analytic AABB; walls use their actual footprint union), stable ID order. Shift box adds; unmodified box replaces. Touch mode uses taps and existing two-finger pan/pinch, with corner drag disabled.

Marquee is CSS-screen transient, generation-owned and cannot write the drawing. Escape/blur/hidden/scroll/resize/mode/model-generation/new pointer/capture interruption cancels. View navigation is blocked while a box is active. Mode changes cancel while retaining currently held gesture IDs until all pointers end, avoiding a second finger becoming a new edit. New numeric/selection previews clear drawing and pointer candidates; renderer precedence therefore cannot show a different draft than the confirmation candidate. Clear selection removes editable highlights even if overlap-cycle pick metadata remains.

## Commands

DeleteSelection validates unique existing IDs, arrays and explicit boolean dependency consent; max500combined entities. Without consent, an unselected opening on any deleted wall rejects. With consent, selected walls and all their hosted openings delete together, along with explicitly selected other openings/furniture; geometry normalization/room identity/validation remain inside one transaction. Empty selection changes no model/history. No silent room-name fallback or partial deletion. Preview names every affected hosted opening (including already-selected ones) and gives before/after room counts when valid.

One explicit confirmation commits a valid deletion. Ambiguous merges require the clearly labelled **Confirm listed deletion, then choose retained room identity** plus committing-resolution notice before entering the existing identity flow. A valid retained-room point then applies the authorized deletion in one edit. An owned unresolved-command ID ensures Cancel/input/entity/generation/lifecycle/unmount also removes that identity request; an old canceled deletion cannot later be executed through the room form. This consent does not apply to unrelated commands.

DuplicateFurniture validates <=500unique existing IDs, creates globally unique IDs, clones owned properties/material overrides, offsets each centre+200mm X(east)/Y(south), sets independent revision and removes source groupId. Copies are deliberately ungrouped; group transforms are later scope. All originals remain. If any candidate exceeds coordinate/schema limits, the entire batch rejects unchanged. Empty duplicate is a no-op; batch duplicate/delete is one undo step and exact Undo/Redo.

Walls/openings/rooms cannot be duplicated here. Furniture moves/rotation/scaling/collision warning/catalog remain PH4 scope; this task works with existing dimensioned furniture placeholders. Confirmation fit/area guards are not construction-code approval.

## Verification and limitations

Analytic/property tests cover consent/dependency deletion, retained geometry versus dependent revision invalidation, invalid/duplicate/oversized IDs,100seeded copy transforms/IDs/exact undo, atomic bad-copy rollback, empty history, full/partial wall bounds and100rotated containment cases. Actual browser checks include full exported document comparisons, dependency notice/cancel/apply/undo/redo/save/reload/3D, copies, Shift/marquee/touch, held-pointer mode switching, explicit ambiguous consent/cancel/retry and drawing-draft preview takeover. Fresh Codex review found3issues above, all fixed with regressions. Evidence: ../verification/ph2-t05.md.

Physical Low/Mid/Hindi/TalkBack/tape/novice/performance/native lifecycle/provider and final Claude/expert/security checks remain pending. No release claim.
