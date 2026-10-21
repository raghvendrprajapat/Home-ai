# D84 — editable furnished 1/2/3BHK gallery

Owner approved the ready-made gallery under D80 on2026-10-21; the separately approved D83 furniture wave precedes it. Scope: three curated examples and a Projects → Design gallery entry. No paid service, live AI, dependency, schema migration, appliance/sanitaryware or gated work.

## Ownership and actual drawing construction

`apps/web/src/gallery/designs.ts` builds new documents in an ephemeral `ProjectStore`, using real wall/rectangle/room/opening/furniture/material commands. Renderers never write the document. The result serializes normally and starts a fresh editing session with no construction commands in its Undo history. Furniture uses exact published native dimensions/pins; missing pins fail the whole example instead of substituting placeholders.

- Compact1BHK:7200×6000mm centreline envelope, five spaces/nine pieces/one bedroom. Reuses the existing unfurnished1BHK starter privately, then deletes its bedroom→bathroom door and adds utility→bathroom access. The public starter, accepted fixtures and old drawings are unchanged. Bare kitchen cabinets only.
- Family2BHK:12000×9400mm envelope, seven spaces/16pieces/two bedrooms. Includes dining and a1085mm clear hallway with common bathroom/second-bedroom access. Orthogonal staggered partitions use L/T junctions only.
- Family3BHK: adds a3600×3600mm west bedroom wing to the family plan; eight spaces/18pieces/three bedrooms. Shared outer wall thickness230mm; its clear3370×3370mm floor adds exactly11356900mm². The former living west window becomes a door; all original family room areas remain exact.

Inside areas, furniture bounds, door-width-deep keep-clear zones, tall pieces at windows,600mm front strips for beds/seating/cabinets/TV, positive furniture overlaps and a600mm ring around the dining group are checked before returning a document. Tests include analytic room spans, rejected examples and random integer translations. These conservative bounding-box checks do **not** establish building-code compliance, accessible circulation throughout a home, optimal layouts or certified emergency egress. Examples are editable starting points, not construction drawings.

## Side-effect boundaries

Opening the dialog fetches only the relative, bounded shipped catalog manifest through the existing `CatalogApi` (2MiB/15s/abort). All three preview documents are temporary. Original SVG previews draw the actual room floor rectangles, wall/opening positions and furniture footprints; no third-party artwork, model requests, WebGL contexts or storage writes. The card states spaces/items/clear floor area in the user's metric/imperial preference, using the existing area formatter.

Only **Use design** creates a document with fresh IDs/current time/localized names. The normal AppShell single-flight `perform`/`canLeave`/`createWorkspace` path flushes the current drawing, creates a separate device project and only then switches sessions. Cancellation, failed metadata, retries and late completion after closing cannot overwrite/create a drawing. Existing defaults/New project options remain unchanged.

The gallery UI loads lazily; the ordinary project schema/materials/storage/renderers are reused. Native dialog Escape/focus restoration, a top Close button,48px controls and responsive three-column/one-column cards use the existing shell. Simulated360px Hindi coverage is browser evidence, not real-phone optimization/testing.

## Review and release limits

All new tests/review are Codex's own builder verification, not independent fixtures or Claude review. Existing tests and locked acceptance remain untouched. Mid examples must fit≤200draw calls/≤64MiB reported texture estimates with real GLBs. Actual results and honest pending gates are in `docs/verification/d84-gallery.md` and the PR. Real Low/Mid devices, expert/designer review, live external services, release packaging and final Claude review remain pending under their owner gates. No reference-repository code/models/textures were adapted.
