# Home-ai — Planner 5D-inspired Home Planner: Research & Engineering Blueprint

Prepared 2026-10-10. These are planning documents only. **No app code exists yet.**

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

Examples: [`examples/sample-project.json`](examples/sample-project.json) (validated against [`examples/project.schema.json`](examples/project.schema.json)).

## Plain-language summary (for Raghvendr)

- **Planner 5D** is a mature product: a web and mobile editor (its job ads mention Three.js/WebGL), a 10,000+ item catalog, 4K renders, and AI features. Even its AI floor-plan reader uses **a human designer to check the result**. Copying all of it is not realistic for one person.
- **What you can realistically build:** a fast, accurate floor planner with live 3D for Android (and web), in Hindi and English, with **electrical point planning** (switch boards, fans, lights). None of the competitors researched here advertised electrical planning. That link to your electrical shop is the strongest idea in this plan, but it is unproven. Check it with your customers first.
- **Technology:** one TypeScript web app (React + Three.js), packaged for the Play Store with Capacitor. Supabase is the backend from v1.0. AI comes later and only through a server.
- **First step:** a small proof of concept (Phase 0) that shows that drawing walls, finding rooms and showing 3D works correctly and smoothly on two real Android phones.
- **Honest effort:** roughly 9–19 months part-time with Claude Code, plus some paid expert review. Expected cash cost before launch is about $500–5,000, mostly 3D furniture models and expert help. These are estimates, not guarantees.
- **Not yet verified:** live Planner 5D pages and Play Store data could not be opened from the research environment, and several prices come from third-party sites. Doc 1 §4 and Doc 9 §7 list what you should check yourself.
