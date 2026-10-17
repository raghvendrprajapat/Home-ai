# D57 — FR-019 furniture grouping

FR-019 (Should, C1), the "group" part ("group transform = one undo"). It follows D55 alignment. Fifth task of Claude Code's D52 continuation. No D36 scope.

**What the user gets.**
- In the Selection panel, with two or more furniture items selected, **Group selected furniture** joins them into one group. **Ungroup** dissolves the group of any selected item.
- In the 2D plan:
  - Tapping or clicking any member selects the whole group, and the touched item stays the active one.
  - Dragging any member moves the whole group: one live preview, one commit, one Undo.
  - Arrow keys (Shift for 100 mm) nudge a selected group together.
- In 3D, single-item Move and Rotate are switched off for a grouped item, with a message that points to the 2D plan or Ungroup.
- Messages are in English and Hindi.

**Model.**
- Group membership is the optional `groupId` that the schema already had, stored on each furniture item. No schema change.
- There are three new atomic core-model commands. Each takes 1–500 different existing IDs (Group needs at least 2); anything else rejects the whole command and leaves the model unchanged:
  - `GroupFurniture { furnitureIds }`:
    - Gives the chosen items, plus every other member of any group they touch, one fresh `group_N` id that is never reused (groups merge).
    - Regrouping an exact existing group is a no-op with no history.
  - `UngroupFurniture { furnitureIds }` removes the `groupId` from the chosen items and from every member of their groups.
  - `MoveFurniture { furnitureIds, dx, dy }` moves the listed items by the same integer-mm delta. A result outside the ±100,000 mm domain rejects it.
- Duplicating furniture still drops `groupId` (copies are never silently added to a group). Project copies remap group IDs (existing recovery code).

**Drag snapping.** The touched member lands on the current zoom's snap grid unless Shift is held or snapping is off. Every member gets exactly that integer delta, so relative positions are preserved exactly. A group drag uses no wall/back-alignment snapping and no per-item clamping.

**Leftover single member.** Deleting members can leave one item with a `groupId`. The editor treats a group with fewer than two members as a single item: it picks, drags, rotates and moves in 3D on its own. The stored id is kept, which is harmless; Ungroup removes it.

**Deliberately not done.**
- Rotating a group as a whole.
- Moving a group in 3D (only 2D drag and arrow keys).
- Editing a group in the numeric furniture panel. That panel still edits only the active item, which lets you fine-tune one member without ungrouping.
- Nested groups and group names.

Box selection and the list checkboxes: a box expands each grouped item it catches to its whole group; the list checkboxes stay per item, so you can still pick one member explicitly.

Tests are Claude-authored analytic/property/browser checks, not independent fixtures. See [the verification record](../verification/fr-019-furniture-groups.md).
