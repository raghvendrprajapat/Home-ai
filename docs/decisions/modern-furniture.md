# D72: modern original furniture designs

Status: accepted by Claude Code under D17 (furniture/catalog work, no D36/D63 gated scope), 2026-10-18.

## Owner goal
- Customers should see furniture that looks like current, modern products, in typical Indian sizes and colours.
- After launch, the owner wants a "buy something similar on Amazon" affiliate link.
  - That link is monetization and stays gated (D63: billing/ads). Nothing affiliate-related is built here.
  - Item names and search tags are written so a later link can search by type, size and colour (for example "l shaped sofa 5 seater fabric grey").

## Choices considered
| Option | Why it was not chosen |
|---|---|
| Free CC0 models (Kenney Furniture Kit 2.0, Poly Haven) | Kenney is a cartoon game style. Poly Haven is mostly antique/gothic/props and heavy textured scans. Neither matches "latest design" for Indian homes. |
| Paid model packs, AI-generated models | Licence checks per model, cost, file size on budget phones. Not chosen by the owner. |
| Blender | GPL tool: its scripts in this repository would break the "no GPL code" rule, and CI cannot rebuild models with it. Everything it would add here (rounded edges, cushions, round legs) fits in the existing pipeline. |

The owner chose original designs made by Claude Code (chat, 2026-10-18).

## Modern original profile (source schemaVersion 3)
- **Still original and reproducible.** Integer-mm JSON sources compile in `pnpm assets:build`/`assets:check` like schema 1. They carry the same `project-original-app-use` record. No texture, download or third-party art.
- **Parts.** Each part has a `shape` and a `finish`:
  - `box`: the schema 1 box.
  - `rounded`: a box whose edges and corners are quarter circles of `radius`, with 1–3 `segments`. The outer size stays exact.
  - `cylinder`: an elliptic cylinder along `x`, `y` or `z` with 8, 12, 16 or 24 sides, used for legs, stems and round tops.
  - `finish`: `matte`, `satin`, `gloss` or `metal`.
- **One untransformed node per part.** The FR-022 main-material rule (largest total part volume) still measures real parts.
  - A sofa's frame and cushions share one fabric, so one furniture colour recolours the whole upholstery.
  - Legs, handles and books keep their own colours.
- **Finishes** are [metallic, roughness]: matte [0, 0.85], satin [0, 0.5], gloss [0, 0.25], metal [0.35, 0.4].
  - The 3D view has no reflection map, so a fully metallic surface would render almost black. `metal` stays partly metallic.
- **Previews.** Thumbnails come from the triangles in the same front-right view as before.
  - Every part is convex, so parts are painted far to near with one path per shade. This keeps the SVG under the 128 KiB limit (sofas are about 45–60 KB).
- **Limits.** The existing limits are unchanged: 3,000 triangles per model, the decoder's flat untextured profile, exact bounds. The largest new model is 2,800 triangles.
- **Unchanged.** Schema 1 sources compile byte-for-byte as before; `assets:versions` checks the 30 published versions.

## Catalog change
- **New versions** of `a_l0_sofa_3`, `a_l0_sofa_2`, `a_l0_armchair`, `a_l0_coffee_table`, `a_l0_side_table` and `a_l0_bookcase`.
- **New items:** `a_l0_sofa_l` (L-shape, 5 seats) and `a_l0_tv_unit`.
- The catalog shows the newest version of each ID (32 items). Version 1 stays published, so existing drawings keep their exact pinned models.
- Sizes are typical for furniture sold in India, chosen by Claude Code, not measured from a specific product.
- Front is −Z as before. Every design was checked from the front in a Three.js render using the app's exact lights and exposure: [image](../verification/images/d72-living-room-designs.png).

## Not done
- Bedroom, dining and storage redesigns (beds with upholstered headboards, wardrobes, dining sets): next.
- Textures (wood grain, fabric weave): need real-phone performance checks, which are gated.
- Affiliate links or any Amazon integration (gated monetization).
- Aesthetic review by a designer, and phone tests.

Tests are Claude-authored analytic/property/browser checks, not independent fixtures. See [the verification record](../verification/d72-modern-furniture.md).
