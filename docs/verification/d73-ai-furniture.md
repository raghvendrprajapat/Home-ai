# D73 AI-1 furniture ideas verification

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

## Not covered
- Real phones, a hosted model, cost limits, and how good the ideas look to a designer.
