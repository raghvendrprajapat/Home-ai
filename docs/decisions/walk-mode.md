# D56 — FR-026 walk mode

FR-026 / PH3-T06 (Should, C1 "after the collision proof"). Fourth task of Claude Code's D52 continuation. No D36 scope: nothing touches accounts, cloud, billing, phone testing or release work. The analytic and browser collision proof below is the "proof" the spec asks for; it is simulated and is **not** a device or independent verification.

**What the user gets.** In the 3D view a **Walk** button puts the camera at eye height (1.6 m) in the middle of the largest room. Desktop: W A S D (or Up/Down) walk, A D strafe, Left/Right arrows turn, drag the view to look, + and − change eye height (1.0–2.0 m in 100 mm steps), Esc exits. Touch: an on-screen joystick walks, dragging the view looks. **Exit walk mode is always on screen.** Leaving walk mode restores the exact orbit camera that was active before. English and Hindi.

**Nothing is written.** Walking is a transient camera. It never calls a command, never changes the model, never adds history and never triggers autosave. Orbit controls, picking and furniture gestures are off while walking. A project with no room refuses to start (message: draw a room first); 3D that is not ready yet refuses with a different message.

**Collision (§F.7, REN-002).**
- Obstacles are the derived wall footprint rectangles (`derived.footprints`), so walking uses exactly the geometry the 3D walls are built from. The world is rebuilt when the project generation changes.
- Capsule radius 250 mm. Motion is a **swept circle**: each move is cut into sub-steps of at most half a radius and the circle is pushed out of any rectangle it overlaps, so it cannot jump a wall of any thickness and slides along walls instead of sticking. A frame longer than 250 ms only advances 250 ms of walking.
- A **door or archway is a passage** only if its width is at least 2 × 250 + 50 = 550 mm, its sill is 0 and its height is at least 1800 mm (lintel above head). The passage cuts a gap of exactly the opening's width out of its host wall's footprint. Windows, narrow doors, low openings and raised sills stay solid.
- The walkable area is the plan's bounding box plus 5 m, so the camera cannot wander off to infinity.

**Deliberately not done.**
- Furniture is not an obstacle (the spec lists walls and doors only); stairs, gravity, steps and multiple floors do not exist yet.
- Desktop pointer lock is not used: the view is turned by dragging. This is simpler and works the same on touch.
- No walk bookmarks, no recording or "walkthrough" video, and no separate eye-height slider beyond the + and − steps.
- Walking through a closed door is allowed once it is a passage (doors are not animated).
- Frame-time behaviour on real phones, battery and heat are unmeasured (D36 gates).

Tests are Claude-authored analytic/property/browser checks, not independent fixtures. See [the verification record](../verification/fr-026-walk-mode.md).
