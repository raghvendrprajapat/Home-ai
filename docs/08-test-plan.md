> **Superseded (2026-10-11):** the combined Claude + Codex document [`combined-research.md`](combined-research.md) is now the main reference. This file is kept as history. Electrical planning has been removed from the product scope by owner decision.

# Document 8 — Testing & Quality Assurance Plan

**Status:** No tests have been executed yet — this is the plan. Only the sample-project schema/integrity check (DM-01, partial) was run while writing these docs.

Columns: ID · Preconditions · Input · Expected · Auto/Manual · Pass threshold · Evidence.
Tooling: Vitest + fast-check (unit/property), Playwright (E2E, screenshots), perf harness page (Doc 7 T-0.6), real devices via Chrome remote debugging.

## 0. Test conventions (preconditions and evidence for every test)
Unless a row says otherwise:
- **Preconditions:** a clean app install (or fresh test DB) and the fixture `docs/examples/sample-project.json` loaded. Property tests use seeded random generators and must log the seed.
- **Automated tests:** run in CI (Vitest/Playwright). **Evidence** = CI log + JUnit report kept as a build artifact. A failure keeps its seed or fixture file.
- **Manual or device tests:** device model, RAM, Android version, WebView version, app build hash and date. **Evidence** = screen recording + the perf-harness JSON log (fps, p95 frame time, draw calls, heap) + a filled checklist, stored in `docs/benchmarks/`.
- **Thresholds:** the "Pass" column. A test with no numeric threshold passes only on exact equality or a 100% pass rate.
- **Reference devices:** Doc 4 §3.8 (Low = Samsung Galaxy A0x/Redmi A-series class, Mid = Samsung Galaxy A3x/A5x class, Desktop = 2020+ laptop with Chrome).

## 1. Data model (DM)
| ID | Pre | Input | Expected | A/M | Pass | Evidence |
|---|---|---|---|---|---|---|
| DM-01 | — | `fixtures/sample-project.json` | Schema + `validateProject` → 0 errors | A | 0 errors | CI log |
| DM-02 | DM-01 | load → serialize (canonical) | byte-identical to canonical input | A | exact | CI |
| DM-03 | DM-01 | `MoveJunction(j2, x=4600)` | living area ↑, bed area ↓ by exact computed amounts; both doors valid | A | exact to 1 mm² | CI |
| DM-04 | DM-03 | undo | canonical JSON equals original | A | exact | CI |

## 2. Geometry (GEO)
| ID | Input | Expected | A/M | Pass |
|---|---|---|---|---|
| GEO-01 | Chain of 5 points, close on first | 5 walls, 5 shared junctions, 1 room | A | exact |
| GEO-02 | Random planar grids (property, 10 000 cases); random wall deletions | faces == grid cells; deleting interior wall merges two rooms | A | 100% |
| GEO-03 | Rect rooms of random sizes/thickness | interior area == analytic value | A | ≤ 1 mm² |
| GEO-04 | Junctions with 2–5 walls, angles 1°–179°, mixed thickness | footprint polygons non-self-intersecting, union has no gaps (area check vs Clipper/union) | A | 100% |
| GEO-05 | Points within/outside snap tolerance at zoom levels | snapped to exact target iff within tolerance | A | 100% |
| GEO-06 | Type lengths (mm, cm, m, ft-in) | stored length equals parsed value | A | exact |
| GEO-07 | Add opening at valid offset | hosted, hole appears in derived geometry | A | exact |
| GEO-08 | Openings beyond ends / overlapping | command rejected with error code | A | 100% |
| GEO-09 | Drag junction across other wall | walls split at crossing, graph planar | A | invariant I4 holds |
| GEO-10 | Unit round-trip display↔parse; large coords; NaN input | stable; NaN rejected | A | 100% |
| GEO-11 | Furniture OBB pairs (fixtures) | overlap flags correct | A | 100% |
| GEO-12 | Stair fit (v1.2) | run/rise within limits for floor height | A | exact |
| GEO-13 | (Retired: electrical points removed from scope) | — | — | — |
| GEO-14 | Edits that keep/split/merge rooms | identity rules Doc 4 §2.7 hold; props preserved | A | 100% |
| GEO-15 | Furniture back-to-wall snap | back face within 1 mm of wall face | A | ≤ 1 mm |
| GEO-16 | §2.13 named failure scenarios (11 cases) | each handled as specified (split/merge/reject) | A | 100% |

## 3. 2D/3D consistency (SYNC)
| ID | Input | Expected | A/M | Pass |
|---|---|---|---|---|
| SYNC-01 | Random sequence of 200 wall edits (property) | after each commit: hash(3D wall geometry) == hash(derived footprints extruded) | A (headless WebGL or geometry-only mode) | 100% |
| SYNC-02 | Furniture move/rotate/resize | 3D object matrix matches model (≤ 1 mm, ≤ 0.1°) | A | 100% |
| SYNC-03 | Add/move/delete openings | wall mesh hole bounds equal opening rect | A | ≤ 1 mm |
| SYNC-04 | Material change | mesh material id == model material; no geometry rebuild | A | 100% |
| SYNC-05 | Room resize | floor/ceiling meshes rebuilt; area label equals derived | A | exact |
| SYNC-06 | Random command sequences + random undo/redo (property, 1 000 runs) | final canonical JSON equals replayed expectation; 3D hash equals fresh rebuild hash | A | 100% |
| SYNC-07 | Save → reload | fresh scene hash equals pre-save scene hash | A | exact |
| SYNC-08 | Multi-floor (v1.1) | floor groups at correct elevation | A | exact |

## 4. Rendering (REN) & performance (PERF)
Reference devices: Doc 4 §3.8 (named device classes) and §0 above. Record device model + Android + WebView version. Add one comparison run per PERF test in **Chrome on the same phone**, to separate WebView overhead from our code.

| ID | Scenario | Measure | A/M | Pass |
|---|---|---|---|---|
| REN-01 | Sample project visual | Playwright screenshot vs baseline (desktop Chrome, SwiftShader/GPU fixed) | A | pixel diff ≤ 0.5% |
| REN-02 | All catalog items render | no load errors, bbox == metadata dims ± 1% | A | 100% |
| REN-03 | Quality tier selection | Low device gets Low tier | M | correct tier |
| REN-04 | Orbit limits | camera never below floor / beyond distance limits under scripted input | A | 100% |
| REN-05 | Walk collision | scripted path: blocked by walls, passes doors | A | 100% |
| REN-06 | Memory leak | open/close project 50× | `renderer.info.memory` returns to baseline; heap growth ≤ 10% | A/M | thresholds |
| REN-07 | WebGL context loss (`WEBGL_lose_context`) | scene restored ≤ 3 s, model unchanged | A + M on device | both |
| PERF-01 | 2D drag, 200 walls | fps | M (device) | NFR-001 |
| PERF-02 | 3D orbit, sample project | fps, p95 frame time | M | NFR-002 |
| PERF-03 | Wall commit → 3D updated | latency p95 | A (instrumented) on device | NFR-003 |
| PERF-04 | Cold start | time to project list | M | NFR-004 |
| PERF-05 | AAB size | bytes | A (CI) | NFR-005 |
| PERF-06 | Texture memory | estimated bytes from loaded textures | A | NFR-006 |
| PERF-07 | 500-wall/1 000-object load | time | M | NFR-016 |

## 5. Assets (AST)
| ID | Expected | A/M | Pass |
|---|---|---|---|
| AST-01 | Every catalog entry has license source/url/type | A (CI) | 100% |
| AST-02 | glTF-Validator 0 errors; tri counts ≤ LOD budgets; textures ≤ max size | A | 100% |
| AST-03 | Origin/orientation convention (bbox min z = 0, centred) | A | 100% |

## 6. Reliability (REL)
| ID | Scenario | Expected | A/M | Pass |
|---|---|---|---|---|
| REL-01 | Force-kill app during edits ×100 | project opens; ≤ 2 s edits lost | M (scripted adb) | 100/100 |
| REL-02 | Corrupt journal tail | recovers last good state, keeps broken file | A | 100% |
| REL-03 | Duplicate project | all new ids, original unchanged | A | exact |
| REL-04 | Airplane mode full MVP flow | works; sync queued | M | pass |
| REL-05 | Two devices edit same project offline then sync | conflicted copy created, no silent loss | A (2 clients) | 100% |
| REL-06 | Schema migration fixtures | v(n) fixture → v(n+1) expected | A | 100% |
| REL-07 | WebView storage cleared / device low on storage | App detects missing local data or failed write, warns user, offers cloud restore or exported-file import; no crash | M (adb `pm clear`, fill storage) | pass |

## 7. UX
| ID | Flow (Doc 4 §7) | A/M | Pass |
|---|---|---|---|
| UX-01 | App shell routes load | A | pass |
| UX-02 | Create project / template | A (Playwright) | pass |
| UX-03 | Draw walls with mouse | A | pass |
| UX-04 | Draw walls with touch (emulated + real) | A + M | pass |
| UX-05 | Pinch zoom focal point stability | A (emulated touch) | ≤ 2 px drift |
| UX-06 | Doors/windows flow | A | pass |
| UX-07 | Furniture flow | A | pass |
| UX-08 | Export PNG labels correct | A (OCR-free: compare render-model labels list) | pass |
| UX-09 | (Retired: electrical points removed from scope) | — | — |
| UX-10 | Accessibility: axe-core on non-canvas screens; touch targets ≥ 48 dp; TalkBack walkthrough | A + M | 0 critical axe issues |
| UX-11 | No hard-coded strings (lint), Hindi layout check | A + M | pass |
| UX-12 | First-time user test: 5 people draw 2-room plan + furnish | M | median ≤ 10 min (target to revisit) |

## 8. AI (Phase 6)
| ID | Expected | A/M | Pass |
|---|---|---|---|
| AI-01 | Structured outputs validate against schema | A | 100% after ≤ 1 repair retry, else graceful fail |
| AI-02 | Recognition output always passes `validateProject` | A | 100% |
| AI-03 | Metrics on eval set (Doc 6 §2.3) recorded | A | recorded (no fixed threshold until baseline) |
| AI-04 | Correction time vs manual drawing | M (5 users) | AI path faster (median) to ship |
| AI-05 | Prompt robustness: 20 paraphrases/languages (en/hi) of NL commands | A | ≥ agreed % correct, rest ask clarification — threshold set after spike |
| AI-06 | Provider error/timeout/refusal | A (mocked) | no credit charged, user message |
| AI-07 | Furnish solver: no overlaps, door swings clear | A | 100% |
| AI-08 | Cost logging per job | A | cost recorded for 100% jobs |

## 9. Security (SEC) & Monetization (MON)
| ID | Expected | A/M |
|---|---|---|
| SEC-01 | Every table has RLS enabled (SQL test) | A |
| SEC-02 | User A cannot read/write B's projects/storage (API tests) | A |
| SEC-03 | Share link is view-only; revoked link 404 | A |
| SEC-04 | AI uploads deleted after 30 days (scheduled job test) | A |
| SEC-05 | Account deletion removes rows + storage objects | A |
| SEC-06 | No secrets in APK (scan with grep for key patterns) | A (CI) |
| MON-01 | Purchase with license tester → entitlement ≤ 10 s | M |
| MON-02 | Reinstall → restore | M |
| MON-03 | Cancel / expire → entitlement removed at period end | M (test subscriptions renew fast) |
| MON-04 | Forged purchase token rejected server-side | A |
| MON-05 | Ads never shown in editor or to subscribers | A + M |

## 10. Release gates
| Gate | Requires |
|---|---|
| Merge to main | lint, typecheck, unit, property, E2E green; bundle budget |
| Internal track | + manual device checklist on Low & Mid |
| Closed testing | + REL-01, REL-04, MON-01..03, SEC-01..06 |
| Production | PRD §19 complete; crash-free ≥ 99.5% in closed test |
