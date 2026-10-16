# D45 — furniture advisories and owned drafts (PH4-T03 stage C2b)

2026-10-16 · Codex under D17, subject to D36. Depends on PR #91 exact `e7aa98df42f3eef0f793e9a26e09955ae0d44b54`, Check/Android SUCCESS in run38790884986; merge `2709f8d015f41c42e33723d61bf7a2cb29c0afa3`.

## User behavior

Selected furniture and valid placement/property/drag previews show a red, labelled overlap warning when their dimension box positively intersects actual wall solids or other furniture. Deliberate overlap remains allowed. Tangency is clear; openings retain real voids/sills/lintels. An unavailable advisory says so and leaves ordinary precise editing/Apply usable. A structural derivation failure is memoized by the same geometry signature until geometry changes, so furniture/paint-only previews cannot repeatedly restart the expensive failed derivation.

The **Align back to nearby wall** button adjusts only measured X/Y in a valid draft, with a200mm maximum translation. It preserves entered size scale, elevation and rotation. No implicit rotation: a cardinal back edge must oppose and fully fit an actual supported longitudinal wall side. No candidate explains the nearby/parallel requirement. Property Apply or placement Add creates one command/history step; Reset/Cancel/Escape/interruption discards it. Odd115mm faces yield integer centres and a verified≤1mm gap using D44's outward rounding.

During2D movement, semantic back-edge candidates are checked against the raw grabbed-offset position **before** grid rounding. Acquire≤8CSSpx and≤200mm; retain the same key≤12px and≤250mm; other keys receive only the acquisition radius. Shift or disabled drawing snapping bypasses both face and grid snapping. Returning exactly to the initial pointer clears the preview, sticky key and note. Final release recomputes its own candidate before clearing sticky ownership; an invalid ending cannot commit an earlier valid preview. Rotation retains D43's15degree/free behavior and3px pointer threshold.

## Preview ownership and view consistency

Furniture property edits acquire ownership on **explicit input intent**, including an incomplete '-' or empty value. An untouched/reset property form never publishes or steals a placement preview. Each active form has a unique token and current four-domain base tag. Its cleanup clears only its own `furniture-edit` token; catalog placement retains a distinct owner. Model/selection/cancel changes reset the form. Tool subscriptions react to actual mode transitions, not every drawing epoch; acquiring a property draft safely switches to Select without cancelling itself. Wall/rectangle acquisition cancels the property draft in the reverse direction.

A valid active property preview is visible in2D and as an excluded helper in3D; the underlying canonical scene is unchanged until Apply. Invalid drafts show an error and remove their old helper. Current visible preview drives the advisory in both views. The canonical selection outline may still mark the underlying object while a separate translucent draft box shows the proposal; its status follows the proposal. Selected-object and ghost warning colors change existing pooled materials, without new geometry or saved state. PNG capture excludes both helpers; exported JSON contains only canonical entities.

Controlled empty/multiple selection never falls back to a stale canvas pick for warnings. A furniture pointer intent is cancelled when its controlled selection no longer exactly matches the owned item, checked in effects **and synchronously at release**. Its own pointerdown selecting that same item remains valid. Full project/session/generation/dependency guards and all D43 interruptions remain.

## Scope and evidence

This stage integrates D44's math with2D pointers and shared2D/3D numeric/placement controls. It does **not** add actual3D move/rotation pointer modes; C3 follows. Selected two-finger rotation stays deferred. Dimension-box warnings are conservative envelopes, not triangle collision or building-code validation. No room-membership or clearance guarantee is implied.

See [verification](../verification/ph4-t03c2b.md). Fresh read-only Codex independently reproduced ownership, controlled-selection and return-origin faults before their fixes; its final7App/React probes and15focused cases passed, with no remaining source blocker. These are Codex probes, not Claude fixtures/review. Accepted geometry, schemas, published assets and owner research remain unchanged. D36 permission gates, real-phone/native-provider/accessibility/external checks and final Claude review remain pending.
