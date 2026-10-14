# D28: wall/rectangle tools and room identity

PH2-T02, Codex under D17, 2026-10-13. No new dependency, canonical document field or schema migration. Accepted independent fixtures remain untouched.

## Editing contract

Select, wall-chain and rectangle modes are transient UI state. Rectangle creation supports pointer drag, two points and typed centreline W×D; the command remains one atomic AddRectangle. Each wall-chain endpoint commits one AddWall; closing on the initial point derives the room in that same command. Undo removes one committed segment or an entire rectangle. Done, Escape/double-click and cancellation discard only the remaining draft. Numeric wall/rectangle commands start independently; a measured wall cannot seed an unrelated rectangle or chain.

L0 pointer walls project to the dominant horizontal/vertical axis, acquire existing junctions within12CSSpx and perpendicular wall centrelines within8CSSpx, capped at250mm, then quantize once. T-junctions are normalized at commit. Shift disables acquisition but cannot enable unsupported angles. Full alignment/grid/dimension-unit/hysteresis behavior is PH2-T03. X/four-way crossings, non-orthogonal commands, too-short segments, nested loops, nonpositive clear rooms and out-of-domain/fractional canonical input reject atomically. Rectangle commands explicitly validate integers/domain before interval generation; NaN must never become a silent no-op.

Tool preview uses ProjectStore.preview and one requested frame, without persistence/history writes. Input carries model generation and a transient cancellation epoch. Mode changes, second/third fingers, hidden/blur, capture loss, scrolling and external edits cancel; pinch continues only as a viewport gesture. Remaining fingers cannot resume editing. Subscribe refreshes generation when2D returns after3D-only undo/redo. An ordinary model change while no draft exists does not claim a cancelled drag. Editing numeric inputs discards an unresolved older candidate before resubmission.

## Shared walls

AddRectangle splits candidate sides at existing collinear interval boundaries. Shared intervals reuse the original left/right finishes in the matching direction; reversal swaps sides, preserving world meaning. Existing topology/opening lineage still validates. Thickness/height mismatches reject instead of changing the original wall. The error exposes existing dimensions and a button fills the new tool values; resubmission remains explicit. This does not bypass L0 four-way rejection or split-through-opening constraints. Cache revision counters may increase for dependencies; entity IDs, orientation and opening geometry stay subject to normalizer lineage rules.

## Identity choices

Attached interior trees traverse bridge edges twice. Identity comparison strips immediate backtracks and redundant collinear vertices from its comparison cycle only. The actual saved face boundary/footprints still contain the partition, with exact clear area. This preserves the enclosing room's identity even when a thick stub lowers IoU below0.8; no face or small space is discarded.

Automatic split/merge rules remain conservative. Ambiguous commands reject unchanged and offer an explicit `roomChoices: [{roomId, point:[x,y]}]` command option. The owner chooses a prior overlapping room and an integer point strictly inside the intended new clear polygon. The room identity/properties remain at that face; other split pieces get new IDs with copied properties and a check-names hint. Choices cannot duplicate a source identity/target face, refer to nonexistent or nonoverlapping rooms, use fractional/domain-invalid coordinates or choose real boundaries/walls. Internal rectangle partition seams are valid interior points: validation uses union boundary polygons, not each rectangle's strict interior. Choices apply inside the same candidate transaction and undo restores exact prior names/IDs. They are command metadata, not saved document fields. Invalid choices retain the correction form; Cancel writes nothing.

## Room UI and limits

Existing room name/type/ceilingHeight/floorMaterial fields are editable through UpdateRoom; names max60 characters, ceiling1800–6000mm. Catalog/material creation is later. Areas are the geometry engine's exact clear regions, displayed separately with current metric/imperial rounding. Positive rooms below250000mm² remain with warnings even when their rounded label is0.25m². Open walls outside face cycles show not-closed feedback. Prospective rectangle labels distinguish centreline and clear sizes; touch loupe covers drawing and corner editing.

This is independently implemented L0 behavior. Physical Low/Mid touch, Hindi/TalkBack/usability, tape measurements, mobile performance, native lifecycle and final Claude/expert/security reviews remain pending. See ../verification/ph2-t02.md for actual tests and artifacts.
