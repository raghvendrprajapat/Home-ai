# Document 12 — Master-prompt coverage check

**Question answered:** did the research deliver every piece of data the master research prompt asked for?
**Method:** each demand in the prompt (Parts A–Q, §3–§22) was matched to the place it is answered, after the round-2 updates of 2026-10-11. This is a self-check by the author, not an external audit (see Doc 11 §4).

Status key: **✅ Complete** · **🟡 Partial** (answered, with a stated gap) · **⛔ Blocked** (cannot be done without accounts, devices, code or interviews) · **— N/A**.

## Summary

| Part | Topic | Status | Remaining gap |
|---|---|---|---|
| A §3 | Product investigation sources & per-feature fields | 🟡 | Hands-on use of the editor, video tutorials and technical articles were not done. "User problem" and "performance expectation" are covered in PRD/NFR, not in each feature row |
| A §4 | Feature inventory (all listed items) | ✅ | 2 items still UNKNOWN in Planner 5D (3D camera collision; furniture collision behaviour). Status recorded |
| B §5 | Competitor benchmark | 🟡 | Official prices missing for HomeByMe, Live Home 3D and Floorplanner subscriptions. Measured performance comparison needs devices |
| C §6 | PRD (21 sections + field format) | ✅ | — |
| D §7 | TRD (19 areas + 11 decision fields) | ✅ | — |
| E §8 | 2D engine | ✅ | — |
| F §9 | 3D engine | ✅ | Performance targets unmeasured (⛔ until Phase 0) |
| G §10 | 2D/3D single source of truth | ✅ | Deeper concurrency rules (local generation vs server revision, stale worker results) exist in the Codex package — merge pending your decision |
| H §11 | Data models | 🟡 | The "serialize → load → edit → render" demonstration is only **specified** (DM-01..04). Schema and integrity checks were run; load/edit/render needs Phase 0 code (⛔) |
| I §12 | AI architecture | ✅ | Accuracy and latency figures intentionally not claimed (must be measured) |
| J §13 | User flows (16 × 8 fields) | ✅ | — |
| K §14 | Claude Code feasibility | ✅ | — |
| L §15 | Roadmap (9 phases × 11 fields) | ✅ | — |
| M §16 | Test strategy | ✅ | No test executed except the schema check (by design) |
| N §17 | Costs | 🟡 | AdMob India eCPM has no official source; INR store prices need an Indian device |
| O §18 | Security, legal, IP | ✅ | Legal review by a lawyer recommended before launch |
| P §19 | 10 documents | ✅ | Plus Doc 11 (audit) and this Doc 12 |
| Q §20–21 | Quality rules, audit, traceability | ✅ | External validation still recommended |
| §22 | Final recommendation | ✅ | — |

## Part A — §3 Planner 5D investigation

| Demand | Where | Status |
|---|---|---|
| Official website | Doc 1 §1 (P01, P02, P04) | ✅ |
| Official feature pages | Pricing and home feature lists (P01, P02); individual `/use/` marketing pages not all read | 🟡 |
| Documentation & help center | 246 help articles downloaded and searched (P03) | ✅ |
| Android listing | P05 (rating, installs, update date, data safety, reviews) | ✅ |
| iOS listing | P06 (rating, size, version, IAP, privacy, languages) | ✅ |
| Public tutorials & demonstrations | Help articles reference videos; videos not watched | 🟡 |
| Release notes / changelogs | App Store version history checked: only generic "Speed and functionality improvements" | ✅ (checked; low information) |
| Publicly accessible product interfaces | Editor not used hands-on (needs account; also kept out to avoid any terms issues) | ⛔ — do it yourself on your phone (Doc 9 §7) |
| Verified user reviews | Play and App Store reviews sampled; used for themes only, no invented averages | ✅ |
| Developer documentation | B2B API overview (P03u) | ✅ |
| Public technical articles | None found that describe the engine; job ads used instead (P07) | 🟡 |
| Competitor comparisons | Doc 1 §3 | ✅ |
| Both mobile and web | Platform differences recorded (floors 6 vs 3, grouping/lock web-only, history Android-only) | ✅ |
| Per-feature fields (name, problem, interaction, inputs/outputs, interface, controls, dependencies, edge cases, performance, difficulty, proposed implementation, acceptance) | Doc 1 §2 tables (behaviour, edge cases, approach + difficulty, acceptance IDs); problem/performance via PRD & NFR | 🟡 (condensed) |
| VERIFIED/OBSERVED/INFERRED/PROPOSED/UNKNOWN labels | Doc 1 §0 and every row | ✅ |
| Never present proposed architecture as Planner 5D's | Doc 1 header + §1.2 (INFERRED only) | ✅ |
| Source links & observation dates | `docs/research/source-log.md` (all 2026-10-11) | ✅ |

## Part A — §4 Feature inventory

| Group | Items demanded | Where (Doc 1) | Status |
|---|---|---|---|
| Floor planning (14) | room creation, wall drawing, joining/snapping, thickness/height, measurements, grid/rulers, resizing, multiple rooms, multi-floor, doors/windows, stairs, floor materials, ceiling/roof, undo/redo | R-FP-01…12, R-ID-04 | ✅ |
| Interior design (13) | catalog, drag-drop, rotate/scale, dimensions, collision, materials, colours, grouping, copy, alignment, snapping, lighting objects, decorations | R-ID-01…09 | ✅ (collision behaviour UNKNOWN; lights only as render lighting/objects) |
| 3D (11) | 2D→3D, live updates, orbit, first person, room navigation, camera collision, lights/shadows, materials, realistic viz, scene export, image rendering | R-3D-01…05, R-PM-05 (no 3D export) | ✅ (camera collision UNKNOWN) |
| AI (8) | room design, furnishing, image redesign, plan recognition, layout generation, style recs, image generation, AI editing | R-AI-01…06 | ✅ |
| Project management (8) | save/load, sync, templates, duplication, export, sharing, collaboration, version history | R-PM-01…07 | ✅ |
| Monetization (6) | free vs premium, subscriptions, paid rendering, catalog limits, AI credits, commercial licensing | Doc 1 §1.1 | ✅ |
| "Mark unsupported items as potential features" | e.g. electrical wiring (not supported), version history on web/iOS (not supported) → our FR-034, FR-023 | ✅ |

## Part B — §5 Competitors

| Demand | Where | Status |
|---|---|---|
| Floorplanner, HomeByMe, RoomSketcher, Sweet Home 3D, Homestyler, Live Home 3D | Doc 1 §3.2 (+ Play stats §3.1, + Indian/electrical apps) | 🟡 official prices missing for 3 (C01, C07) |
| Compare editor, 2D/3D sync, furniture, rendering, AI, ease of use, platforms, pricing, export, performance, complexity | Doc 1 §3.2 columns + §2 | 🟡 ease of use and performance not measured (needs hands-on/devices) |
| Minimum useful feature set | Doc 1 §3.3 | ✅ |
| Essential vs expensive enhancements | Doc 1 §3.3, PRD §17–18, Doc 9 §2 "highest marginal costs" | ✅ |

## Part C — §6 PRD
All 21 sections present in Doc 2 (§1–§19 + Appendix A user stories). Each FR has ID, description, priority (MoSCoW), dependencies, acceptance, verification; user stories in Appendix A. Vague terms converted to numbers (NFR table). **✅**

## Part D — §7 TRD
All 19 areas are in Doc 3 §2–§18. All 11 decision fields are present for each of the 17 ADRs in Doc 10; a script check found 0 missing fields after round 2. **✅**

## Part E — §8 2D engine
Library evaluation (Canvas, SVG, Konva, Fabric, PixiJS, custom) in Doc 4 §2.1. Geometry: all 13 topics in §1 and §2.2–2.8. Editing: all 12 topics in §2.9–2.11.2 (shortcuts and constraint handling added in round 2). Advanced problems (7) in §2.3–2.4 and §2.13. Algorithms, pseudocode, data structures and failure scenarios included. Custom vs library in §2.12. **✅**

## Part F — §9 3D engine

| Demand | Where | Status |
|---|---|---|
| Compare Three.js, Babylon, R3F, Unity, Godot, others | Doc 4 §3.1; native Filament option in ADR-007 | ✅ |
| Criteria (browser, Android perf, mobile GPU, assets, quality, complexity, licensing, Claude Code, scalability) | Doc 4 §3.1, ADR-006/007 | ✅ |
| Scene construction (10), rendering (12), navigation (6), asset pipeline (8) | Doc 4 §3.2–3.7 | ✅ |
| Realistic targets with stated hardware | PRD §10, Doc 4 §3.8 (named device classes), TRD §10 budgets | ✅ specified; ⛔ unmeasured until Phase 0 |
| No photoreal promise on low-end | Doc 4 §3.4, PRD-FR-041 Won't | ✅ |

## Part G — §10 Synchronization
All 15 topics, the 8-step wall-drag example, a sequence diagram, pseudocode and consistency guarantees are in Doc 4 §4–§5 and Doc 5 §6. **✅** (see summary note about the Codex concurrency details)

## Part H — §11 Data models

| Demand | Where | Status |
|---|---|---|
| 21 entities | Users (profiles), Projects, Floors, Rooms, Walls, Junctions, Doors+Windows (Opening), Furniture, Transforms (position/rotation/size), Materials, Textures (TextureAsset), Lighting (Light), Cameras (CameraPreset), Assets (CatalogAsset), Asset catalogs (catalog.json + catalog_assets), Project versions, Subscriptions, AI requests (ai_jobs), Rendering jobs (render_jobs/RenderJob), Sharing permissions (project_shares/SharingPermission) — Doc 5 §2–3 | ✅ (Light, TextureAsset, SharingPermission roles, RenderJob added in round 2) |
| ER diagram, TS interfaces, JSON Schema, SQL tables, relationships, validation, indexes, versioning, migration | Doc 5 §2–§6, `examples/project.schema.json` | ✅ |
| Storage split (relational / JSON / object / device) | Doc 5 §1 | ✅ |
| Complete example project | `examples/sample-project.json` (2 rooms, 7 walls, 2 doors, 2 windows, 4 furniture, 4 electrical points, 2 lights) — validated: 0 schema errors, 0 integrity problems; interior areas 20.6422 m² and 15.8722 m² | ✅ |
| Demonstrate serialize → load → edit → render | Specified as DM-01..04 and SYNC-07; needs Phase 0 code | ⛔ |

## Part I — §12 AI
- Recognition pipeline: all 9 items in Doc 6 §2.
- Interior design: all 7 items in §3.
- Visual vs structural: §1.
- Technology selection: §4, with the verified license table §4.0.
- API vs self-hosted: §4.
- Cost (verified prices), latency targets, reliability, privacy, rate limits, failure handling and human correction: §4.1–§4.2.
- No invented accuracy: §2.3, §6.

**✅** (latency and accuracy must be measured in the Phase 6 spike)

## Part J — §13 User flows
All 16 flows have entry, screens, actions/response, loading, error/recovery and success (Doc 4 §7, rewritten in round 2). Responsive layouts and touch vs mouse are covered in Doc 4 §7 end and §2.11, and PRD §13. **✅**

## Part K — §14 Claude Code feasibility
The classification of every listed subsystem is in Doc 9 §6. The review process and the plausible-but-wrong list are in Doc 7 §4. The risk mitigation plan is in Doc 9 §5 and Doc 7 §2.1. **✅**

## Part L — §15 Roadmap
Phases 0–8 have objectives, dependencies, deliverables, tasks, repo structure (§1), Claude Code prompts (Phase 0 detailed; §2.0 starter prompts for 1–8), tests, acceptance/exit gates, effort (E and B), and key risks (§2.1). **✅**

## Part M — §16 Tests
- Geometry (7 demanded): GEO-01..16.
- Consistency (6): SYNC-01..08.
- Rendering (7): REN/PERF.
- AI (6): AI-01..08.
- Reliability (6): REL-01..07.
- Test-ID, preconditions, input, expected, automated/manual, pass threshold and evidence: table columns plus Doc 8 §0 conventions.
- Unit, integration, E2E, performance, visual regression (REN-01) and real-device tests: all covered.

**✅**

## Part N — §17 Costs
All 12 cost items are in Doc 9 §1–1a. The 4 MAU scenarios with assumptions are in §2. Fixed vs variable costs and the highest-marginal-cost items are in §2. The model comparison is in §4. Vendor prices were verified (V01–V09); everything else is labelled as an estimate. **🟡** (AdMob India eCPM and INR store prices unverified)

## Part O — §18 Security, legal, IP
All 12 topics are in Doc 9 §5.1, Doc 3 §12 and Doc 6 §4.0–4.2, with Play policies verified (V03–V06). **✅**

## Part P — §19 Deliverables
Docs 1–10 present, plus Doc 11 (audit and traceability) and Doc 12 (this check). **✅**

## Part Q — §20–21 Quality control
- Anti-hallucination rules: followed (labels, sources, no invented numbers). Round-1 errors were found and corrected openly (Doc 1 §6).
- The 7 audits and the traceability matrix are in Doc 11 §2–§3a.
- Executable checks: the cross-reference script and the schema/integrity script, re-run after round 2.

**✅**

## §22 Final recommendation
All 8 questions answered in Doc 9 §8 and updated with the round-2 correction about differentiation. **✅**

## What only you can close (⛔ items)
1. Use Planner 5D and Homestyler hands-on on your phone (free vs paid, smoothness, Homestyler's electrical tool).
2. Screenshot INR prices on the paywalls.
3. Interview 5–10 electricians/contractors and 5 homeowners.
4. Phase 0 code: this produces the load/edit/render demonstration and the first real performance numbers.
