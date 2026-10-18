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

## Not done
- AI-2, AI-3, any server provider, and cost or usage limits.
- The stand-in knows only bedroom, living, hall, dining, study and balcony. Other room types get "no ideas".
- It does not look at doors, windows or where existing furniture stands. AI-2 adds collision checks.
