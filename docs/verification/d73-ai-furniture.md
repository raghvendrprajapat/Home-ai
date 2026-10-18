# D73 AI furniture ideas and layout verification

These checks are Claude-authored. They are not independent fixtures, not a phone test, and not a test of any real hosted model; no hosted model is connected.

## Unit tests: `apps/web/src/ai/furniture-suggest.test.ts` (14 tests)
Every expected list and number was worked out by hand from the rules:
- 600 mm walkway;
- 50% floor budget;
- at most 6 ideas.

### fitsRoom
- **Five hand cases.** For example, 2000×900 fits a 1900×3000 room when turned. A 1000×400 item fits a 1000×1000 room exactly, but not a 1000×999 room.
- **Property test:**
  - an item that fits also fits any larger room;
  - an item that is wider and deeper than the room never fits.

### acceptSuggestions
- **Budget case:** a 3000×2000 room has a budget of 3,000,000 mm².
  - Kept: 1,800,000, then 720,000.
  - Dropped: 640,000, because only 480,000 is left.
  - Kept: 240,000.
- **Dropped entries:** unknown IDs, repeats, items already in the room, items that do not fit, and malformed entries.
- **Answers that are not a list** give no ideas.
- **Limits:** at most 6 ideas, and only the first 50 entries are read.
- **Reasons:** a reason is kept only when it is a known kind or valid two-language text.
- **Property test:** accepted items are always:
  - known, unique and new to the room;
  - fitting with a walkway;
  - at most half the floor area in total.

### roomBrief
- The sample living room's clear area of 4327.5 × 4770 becomes 4327 × 4770 (rounded down).

### Offline stand-in
Furniture sizes are copied by hand from the catalog.

| Room | Floor budget | Ideas |
|---|---|---|
| Sample living room, 4327 × 4770 | 10,319,895 mm² | L-shape sofa, TV unit, coffee table, armchair, side table, rug. The plant is cut by the 6-idea limit. |
| Sample bedroom, 3327 × 4770 | 7,934,895 mm² | King bed, sliding wardrobe, bedside table, dressing table, study table |
| Small bedroom, 2400 × 3000 | 3,600,000 mm² | Queen bed only. The king bed needs 4,085,000; after the queen bed's 3,483,000 only 117,000 is left. |

- A room that already has a king bed and a bedside table gets the queen bed instead and no second bedside table.
- A bathroom gets no ideas.
- A request that was already cancelled is rejected.

### Mutation check
Each of these code changes was made separately and made at least one test fail; the file was then restored:
- floor share changed to 1;
- walkway changed to 500 mm;
- the "already in the room or repeated" check removed;
- the limit raised to 7;
- rounding changed from down to nearest;
- the 50-entry read limit removed.

## Browser tests: `tests/e2e/ai-furniture.spec.ts` (2 tests)
- **The panel shows "Test mode".**
- **Bedroom ideas:** the five bedroom ideas appear in the expected order. The first idea shows "1900 × 2150 mm" and the "biggest choice" reason.
- **Asking for ideas does not change the drawing.**
- **Placing an idea:** "Place in this room" opens the normal form at the bedroom's clear centre, (6221, 2500) mm. Adding saves king bed version 2 at that position.
- **Living room:** switching to the living room clears the old list. Asking again gives the six living-room ideas.
- **Hindi:** the panel, its button and "इस कमरे में रखें" work in Hindi.

## AI-2 layout: `apps/web/src/ai/layout.test.ts` (12 tests), `packages/core-model/src/furniture-batch.test.ts` (3 tests)
These checks are Claude-authored. Every expected position below was worked out by hand. In the stated geometry, 0° faces north (−Y), 90° east, 180° south and 270° west, matching the app's furniture footprint (`back = (−sin θ, cos θ)`).

### AddFurnitureBatch
- Three items are added in order with rev 0.
- One Undo gives back the exact saved document; Redo adds the items again.
- A batch is rejected as a whole, with the model unchanged, when any of these holds:
  - it is empty, or has 21 items;
  - an ID is repeated or already used;
  - a coordinate is fractional or outside the drawing;
  - the floor or material does not exist;
  - an entry is null, or the list is not a list.
- A property test with 60 runs: any batch of 1–20 valid items is added exactly and undone exactly.

### Geometry
Footprints and walkways at all four turns.
- Touching boxes do not overlap.
- On an L-shaped floor, only boxes covered by the clear rectangles count as on the floor.

### placementProblem
Room: 3000 × 4000 mm.
- Door swing: [0,1000,900,1900].
- Window: [1000,0,2000,100], sill 900.
- Existing pieces: a 700 mm tall item at [2500,3500,3000,4000], and a flat rug.

Each refusal reason gets one case:
- **outside:** a bedside table at x 2900; its box reaches x 3125.
- **overlap:** a bedside table on the 700 mm item.
- **door:** a bedside table turned 90° at (500, 1400); its box [300,1175,700,1625] meets the swing.
- **window:** a 2100 mm wardrobe under the 900 mm sill.
- **allowed under the sill:** an 800 mm cabinet under the same sill is accepted.
- **walkway:**
  - a wardrobe on the south wall facing the wall;
  - a bedside table whose walkway, y 3100–3700, meets the 700 mm item.
- **flat rug:** may lie on the existing rug.

With a king bed at (1500, 1075, 180°), whose walkway is y 2150–2750:
- a 450 mm coffee table in that walkway is allowed;
- a 520 mm bedside table there is refused;
- a bedside table on the bed overlaps.

### acceptLayout
- Order is kept.
- These are dropped:
  - unknown IDs, repeats (including a repeat at a free spot), fractions, strings, null;
  - an overlapping bedside table;
  - 360° and '0' turns (a 270° turn at the same spot is accepted).

### Stand-in layouts

| Room | Expected layout (x, y, turn) |
|---|---|
| 3000 × 4000 bedroom | King bed (1500, 1075, 180°), centred on the north wall. Bedside table (325, 200, 180°), touching the bed's west side at x 550. Sliding wardrobe (900, 3675, 0°), in the south-west corner; the north wall is taken. |
| 4000 × 5000 living room, door swing [0,3600,900,4500] | 3-seat sofa (2000, 430, 180°). TV unit (2000, 4800, 0°), facing it. Coffee table (2000, 1560, 180°), a 400 mm gap from the sofa front at y 860. Rug (2000, 1550, 0°), the 50 mm grid point nearest the table centre (2000, 1560). |
| 4000 × 3500 dining room | Six-seat set at (2000, 1750, 0°) |
| 3500 × 4000 dining room | Six-seat set at (1750, 2000, 90°) |
| 2000 × 4000 room | King bed (1000, 1075, 180°). The bedside table is left out: no spot within 150 mm of the bed (x 50–1950) is outside the bed's walkway. |
| 2400 × 2000 room | The king bed is left out, because 2150 + 600 > 2400 and 2150 > 2000. The bedside table goes to (225, 200, 180°). |

- **Property test** (40 random rooms with 0–2 doors and random item sets): every stand-in answer passes acceptLayout unchanged.

### layoutRoom on the sample plan
- **Bedroom:**
  - Floor: [4557.5,115,7885,4885].
  - Door swing from the partition (offset 1000, width 900, partition centreline x 4500, half-thickness 57.5): [4557.5,550,5457.5,1450].
  - East window: [7785,1900,7885,3100], sill 900.
  - Existing bed: [5550,200,7350,2200]. Existing wardrobe: [5350,4200,7150,4800].
- **Living room:**
  - Main door, measured from j5 (4500, 5000) toward j6 (0, 5000), so its centre is at x 3000: [2500,3885,3500,4885].
  - Bedroom door on this side: [3542.5,550,4442.5,1450].
  - North window: [1500,115,3000,215].

### Mutation check
Each of these rules was removed separately, and at least one test then failed. The file was restored afterwards.
- door;
- window;
- walkway on the floor;
- existing tall item in the walkway;
- tall item in another item's walkway;
- flat-obstacle exception;
- quarter-turn check;
- repeat check;
- door zones on the far side of a wall;
- the "on the floor" check.
- the 150 mm "beside" limit for bedside and side tables (in the stand-in).

## Browser test: AI-2 (`tests/e2e/ai-furniture.spec.ts`, third test)
The test uses the sample bedroom, which already has a bed and a wardrobe.
1. Suggest the five ideas, then press "Arrange these in the room".
2. The preview pieces are read back and checked against the hand-derived values above:
   - each is inside the bedroom floor;
   - none touches the door swing, the existing bed or wardrobe, or another piece.
3. The preview leaves the drawing unchanged.
4. "Add this layout" adds exactly these pieces, at those positions and turns, and the panel reports the count.
5. One Undo gives back the exact earlier drawing.

![AI layout preview for the sample bedroom](images/d73-ai-layout-preview.png)

In the sample bedroom, the king bed is placed against the west wall, clear of the existing bed, wardrobe and door swing. The dressing table goes on the east wall below the window. The sliding wardrobe, bedside table and study table get "no safe space".

## Not covered
- Real phones, a hosted model, cost limits, and how good the ideas look to a designer.
