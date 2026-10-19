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

## AI-1 choices (owner request "Part A", 2026-10-19)
- **Size preference** (`RoomBrief.size`): compact, balanced or spacious. The panel defaults to balanced.
  - Each slot's search starts at a different size and never goes bigger than that; it moves to smaller sizes when a piece does not fit:
    - spacious starts at the biggest;
    - balanced starts one size down;
    - compact starts two sizes down.
  - The stand-in fills at most 35% (compact), 45% (balanced) or 50% (spacious) of the clear floor.
  - The trust boundary's 50% cap and 6-idea limit are unchanged.
- **Why not budget or style:** the owner asked for budget and style choices. The catalog has no prices and only one (modern) style, and inventing prices would be dishonest, so size stands in for now. Price-based choice needs real price data, which belongs to the still-gated affiliate work.
- **Other options:** each idea carries `options`, the interchangeable pieces for the same place, biggest first.
  - `acceptSuggestions` keeps only options that are known, fit the room with a walkway, are new to the room and are not shown as another idea. The shown piece is always included.
  - "Show another option" (`swapSuggestion`) moves to the next option, wrapping round, whose area keeps all ideas within the 50% floor budget. The button is disabled when none does.
  - A swap clears any layout preview.
- **More interchangeable pieces:**
  - dining tables without chairs alongside the dining sets;
  - a shoe cabinet as an alternative to the sideboard and the console table;
  - a chest of drawers as an alternative to the bookcase.
  - The "biggest choice" reason now appears only when the shown piece is the biggest option that fits.
- **Tip line:** a one-line tip under the size choice says ideas are furniture only.

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

## AI-2 choices (owner request "Part A", 2026-10-19)
- **Several layouts.**
  - `suggestLayout` may answer `{layouts:[…]}`.
  - `acceptLayouts` checks each one (at most `MAX_LAYOUTS` = 3) with `acceptLayout`, and drops empty and repeated layouts.
  - The stand-in's `planLayouts` returns up to three layouts:
    1. as planned;
    2. with the bed or sofa on a wall across from the first one's;
    3. with it on the wall opposite the first.
  - A wall is avoided with a large score penalty, so if no other wall is free the layout repeats and is dropped.
  - The preview has "Layout 1/2/3" buttons.
- **Smaller option instead of nothing.**
  - The ideas' options go with the request.
  - A layout entry may name one of an idea's options with `for: <idea id>`. `acceptLayout` admits only that idea's own options, and each idea at most once.
  - The stand-in tries the idea first, then its smaller options in order.
  - The preview lists any smaller pieces used.
- **Adjusting a piece.**
  - Pick a piece (from a list, or by tapping it in the preview). "Turn 90°" turns it about its centre; the arrow buttons move it 100 mm (`NUDGE_MM`).
  - `adjustPlacement` checks the new spot with `placementProblem` against the room and every other piece. A refusal leaves the layout unchanged and names the reason: outside, overlap, door, window or walkway.
  - "Add this layout" adds the chosen, adjusted layout as one undoable step, as before.

## AI-3 photo or sketch to plan
- **Privacy.** The picture stays on the device.
  - It is read from the file into memory and never stored in the drawing, the local backup or the cloud.
  - The stand-in reads it on the device.
  - Sending a photo to a hosted vision model stays gated (see "What stays gated").
- **Stage 1, trace-over (no AI).** "Show under the plan" draws the picture under the 2D plan:
  - its top-left corner is at an X/Y position the person enters (default 0, 0; up to ±40 m), so it can be lined up with an existing plan;
  - its width is the real width the person enters (2–60 m);
  - its strength is 20–80%.
  - It is a renderer-only image: it is not hit-tested and never written to the model (AGENTS.md §4.1).
- **Stage 2, reading rooms.** `AiProvider.planFromImage(pixels, realWidthMm, signal)` returns untrusted room rectangles relative to the picture's top-left corner; after `acceptSketch` they are moved to the picture's X/Y position. The picture is read at most 480 px across.
- **Trust boundary** (`acceptSketch`):
  - It reads at most 50 entries and keeps at most 12 rooms.
  - Each room must be 1.2–15 m along each side, inside ±50 m.
  - Unknown room types become "other".
  - Shapes of the wrong size are dropped *before* edges are merged, so they cannot pull good edges.
  - Edges within 300 mm of each other are merged onto their mean, on a 50 mm grid.
  - Overlapping rooms are dropped.
  - Four-way crossings are not allowed in L0. Where one would appear, the line east of the crossing moves 150 mm south for the rooms touching it, which leaves two T junctions.
  - Doors (at most 40):
    - 600–1500 mm wide, rounded to 50 mm.
    - Each is moved onto the nearest final room edge of the same direction within 300 mm that holds the whole door.
    - The same door read from both rooms of a shared wall is kept once.
- **Building** (`createRoomsProject`, core-model, next to the templates):
  - Each room becomes a 200 mm-wall `AddRectangle`, then `UpdateRoom` sets its name and type through the real commands. Shared edges merge into one wall.
  - A room already closed by its neighbours is only named.
  - Doors are added with `AddOpening` (2100 mm high) on the one wall whose centreline passes through them. A door is moved inward if needed to stay 50 mm plus half a crossing wall from the wall ends; a door that still does not fit is counted and left out.
  - A room the L0 rules reject is left out and counted, and the preview says so before anything opens.
  - The result opens as a **new** project; the current drawing stays saved.
- **Stand-in reader** (`readSketch`). It is honest test mode, not a vision model, and needs clean dark lines on light paper with closed rooms:
  1. Finds the ink with Otsu's threshold, kept between 60 and 200.
  2. Thickens the lines by 500 mm, which closes door gaps up to about 1 m.
  3. Takes each light area that does not touch the picture edge and is at least 60% rectangular as a room.
  4. Undoes the thickening and adds 100 mm to reach a 200 mm wall's centreline.
  5. Guesses room types: the largest room is the living room, rooms under 4.5 m² are bathrooms, and the rest are bedrooms. The person can change the types later.
  6. Reports a door wherever a 600–1000 mm stretch of a room's side has no ink in the 3 pixels just outside it. Smaller pen breaks are ignored, and wider gaps are not closed by the thickening, so those rooms already read as one.

## AI-3 choices (owner request "Part A", 2026-10-19)
- **The picture stays for the session.**
  - The chosen picture and its width, position, strength and "show" setting are kept in memory for this app session only. They are never saved, backed up or uploaded.
  - So after "Create a new drawing" the new project opens with the picture still under the plan, at the same place. Its rooms line up with it, even if the picture was hidden before.
  - "Remove photo" or choosing another picture forgets it and releases the old picture.
- **Scale by marking a wall** (`scaleFromMarks`):
  - Tap both ends of a wall on the picture, then enter their real length.
  - The picture's real width becomes the length × the picture's width in pixels ÷ the marked distance, rounded to whole mm.
  - The marks must be at least 10 px apart, the length 500–30,000 mm and the result 2–60 m. Otherwise the scale is refused with a message and the width is unchanged.
  - Marks are measured inside the picture's border, in the picture's own pixels.

## Not done
- Any server provider, and cost or usage limits.
- Photo reading in test mode works only on clean line drawings. It reads door gaps, but not windows, door swing directions, text or measurements written on the paper.
- The trace-over picture is kept only for the app session (not after a restart), and is positioned by numbers rather than by dragging.
- The layout uses quarter turns and box shapes only. It does not plan circulation paths between rooms, and it does not move existing furniture.
- The stand-in has plans for bedroom, living, hall, dining, study, balcony, kitchen (island, base cabinet), bathroom (vanity) and utility (shoe cabinet, sideboard). Per the owner, it never suggests appliances or sanitaryware. Pooja and "other" rooms get "no ideas".
- The ideas list (AI-1) does not look at doors, windows or existing furniture positions; the layout step (AI-2) does.
