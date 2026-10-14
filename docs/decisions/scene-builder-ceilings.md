# D33: complete canonical scene surfaces

PH3-T01, Codex under D17,2026-10-14. No dependency, schema or accepted-fixture change.

Retain structural union surfaces, opening voids/reveals, clear-area floors and door-owned thresholds. Add one ceiling per positive room, using the same derived clear rectangles at floor.elevation + room.ceilingHeight. Downward normals/winding, neutral original white material, category-owned DoubleSide rendering. Thresholds never enter ceiling or room area. This is the ground-clear projection, not a physical slab/roof or architecture certification.

Ceilings are hidden in orbit by default; Show ceilings is transient and never changes the drawing/history. Shared boundary walls identify adjacent rooms with different heights; warn with both exact heights, never average. Warnings are deduplicated per room pair, scrollable by touch/mouse/keyboard, localized and focusable. No ceiling-height change modifies the wall height or neighboring ceiling.

Cached plane signatures include height/winding. A room-height edit replaces only that ceiling. Furniture bounds decorate cached structural bounds separately; transform-only edits report no rebuilt structural geometry. Bounds include oriented furniture/elevation and ceilings for camera fitting. Existing scene work/vertex safety budgets remain; budgets are not phone performance guarantees.

Analytic/property tests use independent exact areas, triangle winding and transformed four-corner bounds, translated/odd-thickness/nonzero-elevation cases, concave empty-quadrant ray tests, partition edits/reverse/Undo/reload, warning adjacency and old-geometry disposal. Browser tests verify actual draw calls, current generation, one affected replacement, save/reload and narrow warning scrolling with unchanged JSON. All are attributed to Codex; Claude's final review remains deferred under D17.

Quality tiers, complete material ownership/context recovery and 3D picking follow PH3-T02…T05. GLB catalog, direct PNG share follow-up, cloud/billing and physical Low/Mid/TalkBack/performance/provider tests remain incomplete. No physical Android, photorealism or commercial acceptance is claimed. Evidence: ../verification/ph3-t01.md.
