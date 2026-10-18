# D61 — FR-019 overlap warnings for a whole furniture group

Follows D57/D60. This is the ninth task of Claude Code's D52 continuation, and optional polish after the owner's "Continue" without new D36 permission. No D36 scope.

**What the user gets.** In the 2D plan, when a whole group is selected, the existing non-blocking overlap warning covers the whole group. This holds while dragging it and after placing it: "Overlap warning: N wall(s), M other object(s). Placement is still allowed." Every member is outlined in red. Before this change, the warning only ever looked at a single item, so a group showed nothing.

**Rule.** `FurnitureAdvisories.checkGroup(document, ids)` collects:
- the walls touching **any** member, using the same wall-solid test as single items;
- the furniture outside the group touching any member.

Members overlapping each other are deliberately **not** reported, for example chairs pushed under their own table. Like every advisory, it never blocks or changes an edit. If it cannot be computed (for example, a member is missing), it reports "unavailable" instead of throwing.

**Not done.**
- Group snapping against walls.
- A group warning in the 3D panel. The 3D tools still show the selected item's single advisory.

Tests are Claude-authored analytic/browser checks, not independent fixtures. See [the verification record](../verification/fr-019-group-advisories.md).
