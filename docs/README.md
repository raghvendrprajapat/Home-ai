# Home-ai — Planner 5D-inspired Home Planner: Research & Engineering Blueprint

Prepared 2026-10-10; **research completed with live internet access on 2026-10-11 (round 2)**. These are planning documents only. **No app code exists yet.**

## Documents

| # | Document | What it answers |
|---|---|---|
| 1 | [Research report](01-research-report.md) | What Planner 5D actually does (with evidence), competitors, risky assumptions, unknowns |
| 2 | [PRD](02-prd.md) | What we will build, for whom, with measurable acceptance criteria (PRD-FR/NFR IDs) |
| 3 | [TRD](03-trd.md) | System architecture, stack, backend, security, deployment |
| 4 | [2D/3D architecture](04-2d-3d-architecture.md) | Geometry algorithms, 3D pipeline, 2D↔3D sync, user flows |
| 5 | [Data models & APIs](05-data-models-api.md) | TypeScript types, JSON schema, SQL tables, API contracts, migrations |
| 6 | [AI architecture](06-ai-architecture.md) | AI floor-plan import, AI design, costs, limits |
| 7 | [Implementation roadmap](07-implementation-roadmap.md) | Phases 0–8, tasks, Claude Code prompts, exit gates |
| 8 | [Test plan](08-test-plan.md) | Every test ID, thresholds, release gates |
| 9 | [Cost, risk, feasibility](09-cost-risk-feasibility.md) | Costs at 100–100k users, risks, legal/IP, **final recommendation** |
| 10 | [Decision register](10-decision-register.md) | Why each technology was chosen |
| 11 | [Audit & traceability](11-audit-traceability.md) | Self-audit, gaps found, Evidence→Requirement→Design→Task→Test matrix |
| 12 | [Prompt coverage check](12-prompt-coverage-check.md) | Was every demand of the master prompt delivered? Complete / Partial / Blocked per item |
| — | [Source log](research/source-log.md) | Every page opened in round 2, with date and what it supported |

Examples: [`examples/sample-project.json`](examples/sample-project.json) (validated against [`examples/project.schema.json`](examples/project.schema.json)).

## Plain-language summary (for Raghvendr, updated after round 2)

- **Planner 5D is big and mature:**
  - 5 crore+ Android downloads and ★4.3 in India (#5 top-grossing in House & Home).
  - Native Android graphics (from their job ads).
  - 8,000–10,000 furniture items.
  - AI: plan recognition (takes 10 min–24 h), image AI Studio, and a "Copilot" that builds a project from a text description.
- **Its documented weak spots:**
  - Sync overwrites ("most recent version replaces older", no history except on Android).
  - Shared walls are awkward to edit.
  - Some features only work on web.
  - Free users complain about the paywall.
  - No Hindi.
- **Correction from round 1:** electrical planning alone is **not unique**. Planner 5D lets you place sockets and switches, and Homestyler auto-draws circuits. What we did not find is an India-first, Hindi app that turns a house plan into a **priced electrical bill of materials from your shop**. Check this with 5–10 of your electrician customers before building it.
- **Verified money facts:**
  - Google Play keeps **15%** of subscriptions in India (11% with alternative billing).
  - You need **12 testers for 14 days** before launch.
  - Supabase costs $25/month once live (its free plan pauses after a week of no use).
  - An AI room picture costs about **$0.034 per image** (Gemini).
- **Technology:** unchanged (web app + Three.js + Capacitor for Android), but the risk that 3D is slow on cheap phones inside a WebView is now rated higher. Phase 0 must test this first, and Document 10 ADR-007 has a backup plan.
- **Honest effort:** 9–19 months part-time with Claude Code plus some paid expert review. About $500–10,000 cash before launch, depending mostly on how much paid help and bought 3D models you use. Estimates, not guarantees.
- **What only you can do:** try Planner 5D/Homestyler on your phone, screenshot their INR prices, and talk to customers (Doc 12, last section).
