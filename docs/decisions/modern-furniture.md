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

## Bedroom set (second PR)
- **New versions:** king, queen, double and single beds, the two- and three-door wardrobes, the study table and the chest of drawers.
- **New items:** a sliding-door wardrobe, a bedside table and a dressing table with mirror.
- **Beds** have an upholstered base and headboard (the main colour), a white mattress, pillows and a blanket. Widths follow Indian mattress sizes plus the frame.
- **Wardrobes** share one colour for carcass and doors, so a furniture colour recolours both. Mirror doors keep their own glass colour.
- **Owner instruction (chat, 2026-10-18):** no fridge, toilet or other unnecessary models. Only furniture that people buy is added. Appliances and sanitaryware are not planned.
- [Rendered designs](../verification/images/d72-bedroom-designs.png).

## Dining and storage set (third PR)
- **New versions:** dining chair (upholstered), four- and six-seat dining tables, console table, shoe cabinet, upholstered bench, round pouffe (formerly the stool), bordered area rug, indoor plant in a pot, and sideboard (formerly the low cabinet).
- **New items:** four- and six-seat dining sets: one item each, with the table and chairs facing it.
  - The generator rotates axis-aligned chair parts by whole quarter turns, so no rotated geometry is needed.
  - Wood is the main colour, because the table and chair frames outweigh the cushions.
- **Tags:** the bench drops a "bedroom bench" tag, so that searching "bed" finds only beds and the bedside table.
- [Rendered designs](../verification/images/d72-dining-storage-designs.png).
- **Remaining version-1 items:** the demo desk, bunk bed, kitchen base/wall cabinets, kitchen island and bathroom vanity. Per the owner, no appliances or sanitaryware are added.

## Audit corrections (2026-10-19)
- New versions: six-seat dining set v2 (end chairs face the table), four-seat dining set v2 (chairs clear the table legs), dressing table v2 (mirror stands on the table), console and coffee table v3 (shelf reaches the legs), sideboard and study table v3 (handles touch). Sizes are unchanged; older versions stay for existing drawings. See the [verification](../verification/d72-modern-furniture.md).

## D77 decor pack (2026-10-20)

Status: accepted by Claude Code under D17 (furniture/catalog/3D work, no D36/D63 gated scope).

- **Why.** The owner compared the app with a professional planner; a reviewer found the furnished rooms "empty and boxy" (no curtains, lamps, pictures or real-looking plants; wardrobe, coffee table and armchair read as boxes). Owner: "Naye furniture models aur decor: parde, lamp, wall pictures, asli paudhe."
- **New original items** (same profile and rights record, checked 2026-10-20; nothing copied from Planner 5D or anywhere else): floor-length and window-length curtains with rod (a pair of folded linen panels, 2100 mm wide for 1200–1800 mm windows), a floor lamp and a table lamp (category `lighting`, labels already in English and Hindi), framed abstract wall art. Curtains and wall art are `decor`.
- **New versions:** a leafy plant (`a_l0_planter@3`: stems and 49 leaves in three greens), the coffee table (`@4`: wooden legs and frame, marble top, cane shelf), the armchair (`@3`: track arms, seat and back cushions, oak legs, a pillow) and the sliding wardrobe (`@2`: framed panels with oak insets, full-height handles, tracks). Catalog sizes are unchanged, so AI layouts and existing slots behave the same. Calm colours: linen, off-white, sage, terracotta, walnut, oak, brass and black metal.
- **Draw calls (opt-in `mergeByMaterial`).** Detailed models cost one draw call per part, and the furnished sample was already at 183 of the 200 allowed on mid (shadow pass included). A schemaVersion 3 source may now set `"mergeByMaterial": true`: parts with the same colour and finish are baked into one node (named after the first such part), so a model costs one draw call per material. Only sources that set it change; every earlier source compiles to the same bytes (all 68 earlier GLB and preview hashes are unchanged, checked by `pnpm assets:check`, `pnpm assets:versions` and a pipeline test). Previews are still painted part by part, so they are the same as without merging. `a_l0_sofa_3@3` is the version 2 design merged (14 parts, 2 meshes).
- **Main colour (FR-022).** The renderer still recolours the material with the largest total part box; for a merged source that is the merged node's box. Each new design's main colour is checked by hand in `modern-furniture.test.ts` (curtain fabric, lamp shades, the picture frame, the plant's light green, the coffee table's wood, the armchair fabric, the wardrobe body).
- **Furnished sample.** Adds curtains at both windows, a floor lamp, a table lamp on the bedside table, a picture in each room, a third plant and the improved pieces; the TV unit moves 155 mm forward to stand in front of the living-room curtains (its top, 440 mm, is below the 900 mm sill). Walls, rooms and openings are unchanged. Mid quality, default camera: **145 draw calls with low walls (the default), 173 with full walls** (was 183).
- **Height above the floor.** The drawing already stores `elevation` per furniture item: 3D lifts the model by it, the overlap warning compares heights, and placement and the selected-furniture form have a "Furniture elevation" field. Placement starts at 0 mm, so a picture is placed and then given its height (for example 1300 mm); no automatic wall height was added. The sample sets its pictures' heights directly.
- **Low walls.** In the low-wall overview a raised piece (elevation above 0) whose middle is above the cut would float above the cut walls, so it is left out of that view only, like the roofs (render-only; the drawing keeps it). Full walls and walk mode show it. Floor-standing pieces and things standing on furniture (the table lamp) stay.
- **Tests.** Pipeline tests for merging (hand-counted nodes and triangles, same vertices, same preview, every unmerged source byte-identical, only `true` accepted, a fast-check property). Decoder checks for each new design, the low-wall rule, and the sample (backs on wall faces, curtains spanning their windows, pictures at eye level on walls without openings, picture above the headboard and lamp on the table as the only new stacked pairs). Exact catalog totals and "newest version" pins in existing tests were updated to the new numbers only (see the D77 row in `codex-start-here.md`).
- [Full walls](../verification/images/d77-decor-full-walls.png) and [rooms from the north](../verification/images/d77-decor-bedroom-living.png) on mid.
- **Not done:** the wardrobe's new front faces away from the default camera (the sample keeps its back to the south wall); no default height when placing a picture; designer review and real-phone checks remain pending.

## D91 catalog wave (2026-10-27)

Status: accepted by Claude Code under D17 (catalog/3D work, no D36/D63 gated scope).

- **Why.** Fill obvious gaps for Indian homes with original pieces: living (diwan, baithak gadda with masnad, rocking chair, shoe-rack bench, square floor cushion), storage (TV wall unit with fluted panel and open towers, crockery unit with glass doors, study wall shelf, kids' wardrobe, pooja unit), beds (single bed with storage drawers, baby cot), tables (kids' study table with hutch, drop-leaf folding dining table, computer desk), decor (round wall mirror, wall clock, tall indoor plant) and rugs (round, runner). 48 → 68 catalog items, 87 → 107 published versions. Full list with sizes: [catalog index](../catalog/starter-catalog.md#d91-catalog-wave-2026-10-27).
- **Profile.** All twenty are new version-1 schemaVersion 3 sources with `mergeByMaterial: true` (2–6 meshes each, 84–2752 triangles), integer millimetres, front −Z, every part resting on the floor through touching parts. No existing version changed (`pnpm assets:check` and `pnpm assets:versions`).
- **Owner rules kept.** No fans, switches or other electrical items, no appliances, TV sets or sanitaryware. The pooja unit is a plain wooden unit (doors, niche, step, stepped top), with no religious imagery. Nothing is added to the furnished sample, so the locked draw-call count of the default sample is unchanged.
- **Main colour.** The renderer still recolours the material with the largest merged part box. That is the upholstery for the diwan (mustard) and baithak (maroon masnad), the wood for the shoe bench, rocking chair, crockery unit, wall shelf, pooja unit, storage bed, cot and folding table, the white body for the TV wall unit, kids' wardrobe, kids' study table and computer desk, the brass frame for the mirror, the rim for the clock, dark leaves for the plant and the border for both rugs. Each is checked by hand in `catalog-wave-d91.test.ts`.
- **2D symbols.** New ids get non-generic top views. New symbol kinds: `round_rug` (round border, field and medallion, drawn under everything) and `cushion` (puffy square with stitching and a button). New id words: `baithak` (sofa), `pooja`/`puja`/`mandir` (cabinet), `cushion`/`gaddi` (cushion), and `round`/`circle` on a rug.
- **AI furniture ideas and Copilot.** Only ids were added to existing slot lists, with no logic change: dining (folding dining table as the smallest table; crockery unit between sideboard and shoe cabinet), study (computer desk after the study table), hall (shoe-rack bench between console table and shoe cabinet), balcony (tall plant before the small plant; floor cushion before the pouffe). Bedroom and living plans are unchanged (their exact results are pinned by existing tests). There is no new plan for a pooja room.
- **Search.** The diwan carries no "bed" tag, so searching "bed" still finds only beds and the bedside table.
- **Existing tests changed (counts, newest-version lists and search counts only, all forced by the new assets):** `catalog.test.ts` (87→107 versions, 48→68 items, category totals, the sorted "bed" result gains the baby cot and storage single bed, "मेज़" 8→11); `furniture-symbols.test.ts` (expected-kind map gains the 20 ids); `tests/e2e/starter-catalog.spec.ts` (87→107, 48→68, "68 items", 24/24 → 24/24/20 pages, so a third Next page step inspects the last 20 cards with the same checks; URLs created/revoked 48→68; "bed" 6→8, "मेज़" 8→11, "पलंग" 6→8). `scripts/architecture-boundaries.mjs` admits the one new test file's read-only `node:fs/promises` import, the same way as D83.
- **New tests.** A pipeline test compiles the twenty sources and checks hand-counted material nodes and triangle totals, untransformed nodes and zero validator errors or warnings. `catalog-wave-d91.test.ts` decodes each shipped GLB and checks size, floor contact, centring, hand-counted triangles, merged primitive names, main colour, front/back parts, categories, Hindi names, rights records and English/Hindi search. The bed's headboard pad has its radius equal to half its thickness, so the rounded-box generator merges two sample rows: 260 triangles, not 300 (written in the tests).
- **Not done:** designer review and real-phone checks; no automatic wall height for the mirror, clock and shelf (type the elevation); the folding table is one fixed folded model; no pooja-room AI plan.

## Not done
- Textures (wood grain, fabric weave): need real-phone performance checks, which are gated.
- Affiliate links or any Amazon integration (gated monetization).
- Aesthetic review by a designer, and phone tests.

Tests are Claude-authored analytic/property/browser checks, not independent fixtures. See [the verification record](../verification/d72-modern-furniture.md).
