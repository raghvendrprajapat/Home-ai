# D29: snapping, measured input and wall precision

PH2-T03, Codex under D17, 2026-10-14. No new dependency, model/schema field or accepted-fixture change.

## Units and precision

Measured input uses a strict bounded grammar: bare numbers mean mm; explicit mm/cm/m/decimal ft/in or positive feet+inches pairs are supported, including prime symbols. Mixed inches must be below12. No eval, expression/coercion, hex, scientific notation, unknown/trailing units, NaN or infinity. Convert once to an integer mm; positive lengths cannot round to zero. Coordinates additionally allow zero/negative values within±100000mm; dimensions are bounded at200000mm, then the canonical command validates topology/property limits. Rectangle/wall entry and selected-wall precision use the parser. Existing corner coordinate fields remain explicitly integer-mm controls.

Metric labels display exact mm. Imperial editable labels truncate feet to5 decimal places before rendering, so a rounded label at the domain boundary cannot exceed it; error is below0.003048mm and integer roundtrip is tested. Project display units use the existing SetUnits command and persisted units metadata; geometry/entity values are never multiplied during a switch. Timestamp/history/display metadata can change, so verification compares every spatial entity rather than pretending the entire JSON is byte-identical.100 actual UI switches are tested. Saved fractional coordinates still reject; transient measured/pointer fractions quantize before commands under D14.

## Snapping

Candidate priority: junction12CSSpx, wall8CSSpx, alignment6CSSpx, then grid. Distances/ties use nearest candidate and stable binary ID order. Sticky targets release at1.5× acquisition distance; a newly acquired higher-priority target can preempt a lower one. Every acquire/held target stays within250mm of the constrained pointer. Held wall/guide points recompute along their unconstrained axis. Dragged junctions/incident walls are excluded from self acquisition. Orthogonal drawing locks the dominant axis before snapping; disable never permits free angles in L0.

Grid step is the smallest10/50/100/500/1000mm step with≥4CSSpx spacing, or1000mm at very small zoom. The background draws coarser powers-of-ten multiples for legibility; its snap-step label shows the actual step. Grid acquisition uses the nearest admissible point within the world cap. Shift or the touch-accessible Snapping checkbox disables all acquisition; rounding and L0 axis constraints remain. Marker/guide updates coalesce to one requested frame; every cancellation, idle mode/toggle and model-generation reset cancels pending marker work, avoiding late stale guides. Full real-phone feel is still a device gate.

## Numeric wall preview

The DOM wall list and canvas picks identify model wall IDs. Length changes explicitly choose moved endA, endB or both. Linked orthogonal groups use existing junctionMoves; independent changed axes merge, and conflicting requests reject. Both-end changes retain the exact centre only when the difference is even mm. An odd-mm symmetric change rejects with guidance to selectA/B or an even difference, rather than inventing fractional coordinates or silently shifting the centre.

Length and thickness/height forms each prepare one atomic core-model command. Preview is a generation/session/project-tagged, read-only candidate. The canvas and affected-area panel show it while saved data/history/header remain canonical. Confirmation rechecks tags and executes exactly that command; cancellation writes nothing. Input/entity/model changes, new pointer edits, Escape, blur/hidden or unmount discard drafts. Ambiguous-room errors can open the existing explicit identity-choice flow; input changes invalidate the old unresolved command. Existing opening/room/topology validation rejects unsafe shortening instead of deleting dependents. One Undo restores the exact committed drawing.

Centreline dimension labels are distinct from clear-area labels; short/offscreen walls omit canvas text, with the complete DOM wall list still available. The precision controls expose mm bounds and existing wall heights/thickness; no general CAD solver or free angles are introduced.

Physical Low/Mid touch/Hindi/TalkBack, novice usability, tape measurements, performance and native lifecycle/provider checks remain unexecuted release gates. Final Claude/expert/security reviews remain deferred under D17. Evidence: ../verification/ph2-t03.md.
