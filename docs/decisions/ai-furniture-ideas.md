# D73: AI features now, built and tested with an offline stand-in

Status: accepted by Claude Code on the owner's instruction, 2026-10-18. This overrides D9 ("AI only after the first Play release") and the AGENTS.md scope line "AI before the first release".

## Owner instruction (chat, 2026-10-18)
- Build AI features now. Where the app needs AI, test it first with Claude's own stand-in instead of a paid API. Choose a low-cost model later.
- Chosen features, in this order:
  1. **AI-1 furniture ideas** for a room (this change).
  2. **AI-2 layout suggestion**: arrange furniture in a room, applied as one undoable step.
  3. **AI-3 photo or sketch to plan**: stage 1 is a trace-over image without AI; a real vision model is a later step.

## What stays gated
- **Any real hosted model call.** It sends room data, or for AI-3 a photo, off the device. That needs the owner's explicit choice of provider, a monthly cost limit, a privacy-policy update and the provider's age terms (D9 noted that Gemini requires an 18+ audience).
- **The key never ships in the app** (AGENTS.md §4.7). A real model runs behind the app's server, for example a Supabase Edge Function that holds the key as a secret, with per-user rate limits.
- Billing, ads, subscriptions, analytics and release packaging stay gated as in D63.

## Design
- **One provider plug.** `AiProvider` (`apps/web/src/ai/furniture-suggest.ts`) has a `kind` (`stand-in` or `server`) and `suggestFurniture(brief, candidates, signal)`.
  - The brief is only the room type, the clear width and depth in mm, and the catalog IDs already in the room. No names, addresses or account data.
  - The answer is untrusted data. A server model later replaces only the provider.
- **The stand-in** (`apps/web/src/ai/stand-in.ts`) is a small, hand-written rule set that runs on the device and costs nothing.
  - Each room type has slots, for example bed, wardrobe, bedside table.
  - A slot lists alternatives from the biggest to the smallest. The first one that fits and stays within the floor budget is chosen.
  - The panel says "Test mode" whenever the stand-in is used.
- **Trust boundary.** `acceptSuggestions` filters every provider's answer the same way. It drops:
  - non-lists and malformed entries;
  - unknown catalog IDs, repeats, and items already in the room;
  - items that do not fit with a **600 mm walkway** in front, either way round;
  - anything past a floor budget of **50%** of the clear floor area.
  - It reads at most 50 entries and keeps at most **6** in the model's order.
  - Reasons are a known kind, or a text of at most 300 characters in both English and Hindi. React renders them as plain text.
- **Nothing is added automatically.** "Place in this room" opens the normal placement form at the centre of the room's clear rectangle (rounded to whole mm). The person then moves, turns or cancels it. Adding goes through the existing core-model command and undo.
- The catalog list comes from the same shared catalog request as the 3D view (`CatalogSource.catalog`), so asking for ideas does not download the manifest again.

## AI-2 layout suggestion
- **One command.** The new core-model command `AddFurnitureBatch` adds 1–20 items atomically (`MAX_FURNITURE_BATCH`).
  - The normal project validation checks every item. If one item is invalid, nothing is added.
  - A single Undo removes the whole layout.
- **Room facts** (`layoutRoom`) are read from the saved drawing:
  - The room's clear floor rectangles.
  - A keep-clear zone for each door: the door's width along the wall and the same width deep into the room, so its swing stays free. Both sides are kept clear, whichever way the leaf opens.
  - A keep-clear zone for each open passage: 600 mm deep.
  - Each window: a 100 mm strip with its sill height.
  - Existing furniture on the floor, as boxes.
- **Provider plug.** `AiProvider.suggestLayout(room, items, signal)` returns untrusted `{assetId, x, y, rotationDeg}` entries.
- **Trust boundary.** `acceptLayout` keeps an entry only when all of these hold:
  - It names a requested item, at most once.
  - Its coordinates are whole millimetres inside the drawing limits, and it is turned a quarter turn (0, 90, 180 or 270°).
  - It passes `placementProblem`, checked against the existing furniture and the items accepted before it:
    - **Floor:** the item is fully on the clear floor.
    - **Collisions:** it does not overlap existing furniture (flat rugs excepted) or another accepted item.
    - **Doors:** it stays out of every door swing and passage.
    - **Windows:** if it is taller than 500 mm and taller than the sill, it stays out of the window strip.
    - **Its walkway:** the 600 mm strip in front of it is on the floor, and nothing taller than 500 mm stands in it.
    - **Others' walkways:** if it is taller than 500 mm, it does not stand in the walkway of an item accepted before it.
  - Rugs only need to be on the floor.
- **Stand-in planner** (`planLayout`). It places items in the order the ideas list gives them, rugs last:
  - Beds and sofas: centred on a wall.
  - Bedside and side tables: next to the bed or sofa, at most 150 mm away; otherwise they are left out.
  - TV unit: facing the sofa, centred on it.
  - Coffee table: 400 mm in front of the sofa.
  - Dining sets: near the middle of the room, long side along the room's long side.
  - Rugs: under the coffee table.
  - Everything else: against a wall, as close to a corner as possible.
  - It tries spots 50 mm apart and checks every one with `placementProblem`, so its answers always pass `acceptLayout`. Items with no safe spot are listed as "no safe space".
- **Preview first.** "Arrange these in the room" draws a small top view: floor, door swings, windows, existing furniture, and the suggested pieces with their fronts drawn thicker.
  - Nothing is added until "Add this layout".
  - If the drawing changed after the preview, the person is asked to arrange again.

## Not done
- AI-3, any server provider, and cost or usage limits.
- The layout uses quarter turns and box shapes only. It does not plan circulation paths between rooms, and it does not move existing furniture.
- The stand-in knows only bedroom, living, hall, dining, study and balcony. Other room types get "no ideas".
- The ideas list (AI-1) does not look at doors, windows or existing furniture positions; the layout step (AI-2) does.
