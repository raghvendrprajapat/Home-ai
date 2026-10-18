# D62 — FR-019 group back-to-wall snapping in 2D

This follows D57/D60/D61. It is the tenth task of Claude Code's D52 continuation and is optional polish. No D36 scope.

**What the user gets.** Dragging a grouped item in the 2D plan now snaps the touched item's back flush against a nearby wall face, as single furniture already does (GEO-019). The "back aligned to wall" note appears. Every member moves by the same integer delta, so the group's layout is kept exactly. Shift, or snapping turned off, skips the snap and moves freely. Otherwise, with no wall in range, the touched item lands on the zoom grid as before.

**How.**
- The group drag sends the touched item's unquantized candidate position through the existing `FurnitureAdvisories.align`. The thresholds and hysteresis are the same as for single items: acquire within 8 px (max 200 mm), hold within 12 px (max 250 mm), with the snap key kept between frames.
- The snapped position, or else the grid position, gives the `MoveFurniture` delta.
- Only the touched item is tested against walls. Other members are not snapped and may end up overlapping a wall; the D61 group warning reports that.

**Not done.**
- Snapping other members.
- Choosing the best-fitting member.
- 3D group wall snapping.

Tests are Claude-authored browser checks, not independent fixtures. See [the verification record](../verification/fr-019-group-wall-snap.md).
