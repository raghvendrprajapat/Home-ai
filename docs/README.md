# Home-ai — Planner 5D-inspired Home Planner: Research & Engineering Blueprint

Research rounds: 2026-10-10 (round 1), 2026-10-11 (round 2, live sources), 2026-10-11 (**combined Claude + Codex document**). These are planning documents only. **No app code exists yet.**

## Main document

**[`combined-research.md`](combined-research.md)** is the single combined reference. For each section it takes the stronger version from the Claude research and the Codex research, adds the other side's unique verified facts, and shows conflicts openly. Codex-only facts were re-checked live (RV-1…RV-13).

| Part | Contents |
|---|---|
| 0 | How to read it, evidence labels, **what was taken from where**, plain Hinglish summary |
| A–B | Planner 5D research (features, prices, legal, reviews) and competitors (official prices, Play India data) |
| C | PRD: 47 functional and 22 non-functional requirements, user stories (Appendix B) |
| D | TRD and 22 technology decisions (11 fields each) |
| E–G | 2D geometry engine, 3D engine, single source of truth / synchronization |
| H | Data models, SQL, save protocol, complete example project |
| I | AI architecture, verified prices and provider terms |
| J–L | 16 user flows, Claude Code feasibility, phased roadmap |
| M | Test plan (103 test IDs) and release gates |
| N–P | Cost at 100/1k/10k/100k MAU, security/legal/IP, risk register |
| Q | Traceability matrix, checks done, prompt coverage, **final recommendation** |

**Owner decisions applied:**
- **No electrical/wiring features.** The app and the electrical shop are separate businesses.
- **No marketing website for now.** Only the two Play-required pages: privacy policy and account deletion.
- **Web + Android (Capacitor), mobile-first.**

Examples: [`examples/sample-project.json`](examples/sample-project.json), validated against [`examples/project.schema.json`](examples/project.schema.json) with 0 errors.

## Build process

**[`build-process-guide.md`](build-process-guide.md)**: how to build the app step by step with Claude Code (main builder) and Codex (reviewer and independent tests). It covers setup, rule files, the task cycle, ready prompts for every task, phone testing, safety rules, when to hire experts, and the timeline.

## Older documents (history)

The round-1/round-2 documents `01`–`12` and [`research/source-log.md`](research/source-log.md) are kept for history. Each has a "Superseded" note at the top. Electrical content has been removed from them as well.

## Plain-language summary (Hinglish)

- **Planner 5D:** bada aur purana product hai.
  - Play India par 5 crore+ downloads, ★4.27, top-grossing.
  - 8–10 hazaar furniture.
  - AI features hain: plan recognition 10 min–24 h leta hai, image AI, aur text se project banane wala Copilot.
- **Uski kamzoriyan (official help se):**
  - Sync mein purana kaam overwrite ho jaata hai; version history sirf Android par hai.
  - Grouping, lock aur round walls sirf web par.
  - Paywall ki shikayatein hain, aur Hindi nahi hai.
  - Kai competitors mein phone par editing hi nahi hai (RoomSketcher: "not available on phones").
- **Hum kya banayenge:** ek chhota, bharosemand app, Android + web par.
  - Seedhi aur 90° wali deewarein, kamre aur carpet area.
  - Darwaze aur khidkiyan.
  - ~30 se 100 furniture.
  - 3D view aur undo.
  - Kaam kabhi na khona.
  - Hindi.
- **Paise ke facts (verified):**
  - Google Play India mein subscription par 15% leta hai.
  - Launch se pehle 12 testers 14 din chahiye.
  - Supabase $25/mahina.
  - AI image ~$0.034.
  - Stripe India sirf invite par milta hai, isliye Play Billing use karenge.
  - Gemini API ki shart: app 18+ users ke liye ho.
- **Mehnat aur paisa (estimate, vaada nahi):**
  - Part-time 9–19 mahine.
  - Launch tak cash $500–10,000.
  - Server ~$25/mahina, hazaaron users tak.
- **Ab sirf aap kya kar sakte hain:**
  - 10 logon se baat karna.
  - INR prices ke screenshots lena.
  - Planner 5D/Homestyler ko apne phone par 30 minute chala kar dekhna.

  Details Part Q.4 mein hain.
