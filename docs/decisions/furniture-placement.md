# PH4-T03 stage A — exact-version furniture placement

D41, 2026-10-15, under D17 subject to D36. Base PR87 merge `69484fc9d2a80b26fa0c865f49f11bd27efc2340`. PH4-T03 is staged to avoid coupling placement ownership, asynchronous GLB resources and pointer arbitration in one first change. Issue32 remains open: stageB supplies actual model loading/fallback/retry/instances, stageC supplies gestures and advisory snapping/collision. This stage is placement and shared measured-command behavior, not full FR-017/018/020/021 acceptance.

## User behavior and ownership

Catalog **Place in drawing** closes the native dialog and opens a staged position/elevation/rotation/uniform-scale form. The initial centre comes from the actual2Dviewport or3Dcamera target, converted once to integer mm. Far-panned out-of-domain centres remain visible editable errors; no silent clamp or formatting exception. Explicit Add creates one furniture ID, one AddFurniture command and one Undo entry; Cancel leaves no item/history. The existing measured furniture form works after creation in both views.

The immutable intent owns a unique <=40-character furniture/draft ID, project/session/generation/dependency hash, floor ID, exact asset version and copied native dimensions. Source metadata mutations cannot change that intent. Every prepare/apply checks the current tag; no live edit or Undo reuses the old generation. The uniform factor applies to native dimensions using shared exact decimal-rational half-up rounding once per dimension. No per-axis resizing or saved fractional coordinates are introduced. Existing furniture-transform semantics retain their tests.

Core preview computes a derived drawing without writing. Valid drafts publish the existing2Dprecision preview and a separate3Dhelper; invalid values hide the helper, explain the failure and disable Add. Apply rechecks ownership and uses only the core command. Duplicate submission is guarded locally as well as by core baseGeneration. After Add, selection resolves to the new model ID; Undo/Redo and local saved/reloaded JSON retain exact pin/transform values.

Escape, window blur, hidden document, a changed model/session, picking another object or choosing a competing drawing/precision tool discards placement. View toggling retains the draft while the old renderer closes. Opening the catalog starts a new choice and clears competing drafts. Cancel returns focus to Browse when the document is active. The placement lifecycle listens to actual drawing mode changes, not every DrawingTool epoch: PlanCanvas's own external-preview cleanup calls drawing.clear(), so reacting to all epochs would cancel its own refreshed draft.

## Renderer helper contract

The3Dhelper is an independent translucent MeshBasicMaterial box, outside SceneAdapter/structural pipeline/picking/framing. Its dimensions and mapping follow the same integer-mm canonical item; source data is never mutated. Two pooled leases allocate only for a valid current preview, update without reallocating, and release on invalidation/cancel/view close/fallback. Partial allocation rollback releases owned geometry; independent cleanup continues if one disposer throws. The material creates no extra PBR shader-LUT ownership.

Scene pending/stale/lost conditions clear the helper. A helper cannot acknowledge CPU geometry or turn a stale scene current. PNG capture temporarily hides both selection and placement helpers, restores them safely, and invalidates the live view. Actual rendered draw count increases by one with a helper while the exported PNG bytes equal the same canonical view without it. Physical GPU/device memory is not inferred from these checks.

## Alternatives, scope and evidence

Immediate addition on catalog tap would remove the explicit cancel/preview boundary. Saving renderer/preview data or creating a special fake store would break the canonical source of truth. The existing core preview plus a separately owned helper gives a bounded first step, at the cost of full preview validation on input changes; large-scene preview timings remain to be measured. Native GLB loading deliberately follows in a separate PR with its own asynchronous resource proof; dimensioned boxes are still the current3Drepresentation.

See [verification](../verification/ph4-t03a.md). No dependency, canonical schema, original asset version/blob or accepted independent fixture changes. No Claude invocation. D36 cloud/accounts/history, mobile optimization/direct sharing/real phone testing, billing/security/privacy/release/final review remains unstarted.
