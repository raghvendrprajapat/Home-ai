# Document 11 — Audit & Traceability Matrix

This is a **self-audit by the same author** of Docs 1–10. It is not proof of correctness. External validation recommended in §4.

## 1. Automated cross-reference checks (run 2026-10-10)
A script parsed all documents and checked: every referenced test ID exists in Doc 8; every test in Doc 8 is referenced by a requirement or task; every `PRD-FR/NFR` reference exists in Doc 2; every ADR reference exists in Doc 10; every Must requirement has at least one test. Result: **0 dangling references**; 43 FRs, 16 NFRs, 83 test IDs, 17 ADRs. The sample project validated against `project.schema.json` with 0 errors and 0 referential-integrity problems; derived room areas 20.6422 m² and 15.8722 m².
Limitation: the script checks that IDs exist and are linked, not that the linked test really proves the requirement.

## 2. Audit findings

| # | Audit | Finding | Severity | Resolution |
|---|---|---|---|---|
| A-01 | Research vs sources | Direct page fetches were blocked; all Planner 5D claims rest on search snippets. Several sources conflict (catalog size, Smart Wizard platforms, render allowances). | Medium | Marked VERIFIED only when an official page snippet stated it; conflicts listed in Doc 1 §4. Human should open the live pages. |
| A-02 | Research vs sources | Pricing for Supabase, R2, image models, competitors comes from third-party snapshots. | Medium | Labelled as estimates everywhere; verification step in Doc 9 §7. |
| A-03 | PRD vs feature inventory | Planner 5D features not in our PRD: 360° panoramas, CAD export, 3D model upload, budget widget, live collaboration, 4K renders. | Info | Deliberate (PRD §18 exclusions / Won't). Budget widget could be a cheap Could item later — **missing requirement, added to backlog**. |
| A-04 | PRD vs feature inventory | Stairs/roof/terrain UNKNOWN in Planner 5D; we include stairs as Could, exclude roofs/terrain. | Info | OK |
| A-05 | TRD vs PRD | **Contradiction:** PRD says MVP is local-only (no backend), but PRD-FR-029 (subscriptions, release-must) needs server-side purchase verification (TRD §4, MON-04). | High | Resolution: v1.0 release includes a minimal backend (Supabase edge function for billing verification) even if cloud sync ships at the same time or later. Roadmap already orders Phase 5 before Phase 8. |
| A-06 | Data models vs editing operations | Electrical points are wall-hosted only, but ceiling lights/fans are ceiling-mounted. The sample uses a wall "fan feed" point as a workaround. | Medium | **Missing:** add `mount: 'wall'|'ceiling'` with `roomId + position` for ceiling points before Phase 2 of electrical (v1.1). |
| A-07 | Data models vs editing operations | No entity for light fixtures as lights (only furniture items with emissive materials). | Low | Consistent with Doc 4 §3.4 (visual-only lights in v1); revisit with renderer quality work. |
| A-08 | Data models vs editing operations | Stairs (PRD-FR-027) need cross-floor references; schema has none. | Low (Could) | Design when FR-027 is scheduled; schema bump v2 with migration. |
| A-09 | Data models vs editing operations | Templates (PRD-FR-028) storage not specified. | Low | Templates = fixture JSON files on CDN loaded through the same validator. |
| A-10 | Rendering vs geometry | Face-detection orientation sign under y-down coordinates is not proven in the doc (flagged "verify sign in tests"). | Medium | GEO-02 must include a hand-checked fixture; listed in Doc 7 §4 watch list. |
| A-11 | Rendering vs geometry | Mitered footprints are shared by 2D and 3D (good). Junction caps for ≥ 3 walls described but not specified precisely (convex hull may overfill concave configurations). | Medium | Specify in T-0.2: cap polygon = ordered corner points around junction (not hull); test GEO-04. |
| A-12 | Roadmap vs dependencies | Phase 3 can overlap Phase 2 after T-2.5; Phase 4 asset sourcing has long lead time. | Info | Start asset sourcing (T-4.9 licensing research) during Phase 2. |
| A-13 | Testing vs failure modes | WebView storage eviction (K-07) had no explicit test. | Medium | **Fixed during audit:** REL-07 added to Doc 8 and linked to NFR-007 below. |
| A-14 | Testing vs failure modes | Concurrent edits on two devices covered (REL-05); browser crash covered (REL-01 on Android, add desktop tab-kill variant). | Low | Extend REL-01 to desktop. |
| A-15 | Testing vs failure modes | AI thresholds (AI-03, AI-05) are intentionally undefined until a baseline exists. | Info | Phase 6 spike must set them before build. |
| A-16 | Unsupported assumption | Performance targets (NFR-001..006, TRD §10 budgets) are not measured. | High | Phase 0 exit gate. |
| A-17 | Unsupported assumption | Effort estimates (Doc 7) are judgment, not data. | Medium | Track actual time per phase; re-plan after Phase 0. |
| A-18 | Unsupported assumption | Electrical-layer demand is a hypothesis. | Medium | Customer interviews (Doc 9 §7). |
| A-19 | Legal | Google Play fee structure and tester requirements are from secondary sources / memory. | Medium | Verify in Play Console help before Phase 8. |

## 3. Traceability matrix (Evidence → Requirement → Design → Task → Test)

| Evidence (Doc 1) | Requirement (Doc 2) | Design (Docs 3–6) | Task (Doc 7) | Tests (Doc 8) |
|---|---|---|---|---|
| R-FP-01 | FR-002 draw walls | Doc 4 §2.2–2.4, §2.11 | T-0.2, T-0.4, T-2.1 | GEO-01, UX-03, UX-04 |
| R-FP-01 | FR-003 snapping | Doc 4 §2.9 | T-2.2 | GEO-05 |
| R-FP-02 | FR-004 precise lengths | Doc 4 §2.11, ADR-015 | T-2.3 | GEO-06 |
| R-FP-01 | FR-005 rectangle room | Doc 4 §2.6 | T-2.1 | GEO-03 |
| R-FP-03 | FR-006 room detection | Doc 4 §2.6–2.7 | T-0.2 | GEO-02, GEO-03 |
| R-FP-02 | FR-007 thickness/height | Doc 4 §2.5, §3.3 | T-0.2, T-3.2 | GEO-04, SYNC-01 |
| R-FP-07 | FR-008/009 openings | Doc 4 §2.8, §3.3 | T-0.3, T-2.5 | GEO-07, GEO-08, SYNC-03 |
| R-FP-01 | FR-010 select/move/delete | Doc 4 §2.4, §4.5 | T-0.3, T-2.6 | GEO-09, GEO-16, SYNC-01 |
| R-FP-09 (inferred) | FR-011 undo/redo | Doc 4 §4.2, ADR-004 | T-0.3 | SYNC-06, DM-04 |
| R-FP-04 | FR-012 units | Doc 4 §1, ADR-015 | T-2.8 | GEO-10 |
| — (standard) | FR-013 zoom/pan | Doc 4 §1 | T-0.4, T-2.7 | UX-05 |
| R-ID-01 | FR-014 catalog | Doc 4 §3.7, Doc 5 catalog tables | T-4.1–4.3, T-4.9 | AST-01..03 |
| R-ID-02/03 | FR-015/016 place & resize | Doc 4 §4.3, Doc 5 FurnitureItem | T-4.4 | SYNC-02 |
| R-ID-07 (unknown) | FR-017 collision | Doc 4 §2.10 | T-4.6 | GEO-11 |
| R-ID-04 | FR-018 materials | Doc 4 §3.4 | T-3.4, T-4.8 | SYNC-04 |
| R-3D-01 | FR-019 synchronized 3D | Doc 4 §4 | T-0.5, T-3.1 | SYNC-01..07 |
| R-3D-01 | FR-020 orbit | Doc 4 §3.6 | T-3.5 | REN-04 |
| R-3D-02 | FR-021 walk | Doc 4 §3.6 | T-3.6 | REN-05 |
| R-PM-02, sentiment "lost work" | FR-022 autosave/recovery | Doc 4 §5, Doc 5 §4 | T-0.8, T-5.1 | REL-01, REL-02 |
| R-PM-01 | FR-023 cloud sync | TRD §9, ADR-016, Doc 5 §5 | T-5.3–5.5 | REL-05 |
| R-PM-06 | FR-024 project list ops | Doc 5 §5 | T-5.2 | REL-03 |
| R-3D-03 (renders) → cheaper substitute | FR-025 PNG/PDF export | Doc 4 §7 F15 | T-2.10, T-3.10 | UX-08 |
| R-FP-05 | FR-026 multi-floor | Doc 5 Floor | (v1.1) | SYNC-08 |
| R-FP-08 (unknown) | FR-027 stairs | gap A-08 | (v1.2) | GEO-12 |
| R-AI-03 (Smart Wizard) | FR-028 templates | gap A-09 | (v1.0) | UX-02 |
| §1.6 pricing, sentiment billing | FR-029 subscription | ADR-011, Doc 5 subscriptions | T-8.1, T-8.2, T-8.4 | MON-01..04 |
| — | FR-030 ads | ADR-012 | T-8.3 | MON-05 |
| R-AI-01 | FR-031 AI plan import | Doc 6 §2 | T-6.3 | AI-01..05 |
| R-AI-02 | FR-032 AI restyle | Doc 6 §3–5 | T-6.2 | AI-06, AI-08 |
| R-AI-03 | FR-033 AI furnish | Doc 6 §3 solver | T-6.4 | AI-07 |
| §2.2 gap analysis | FR-034 electrical layer | Doc 4 §6, Doc 5 ElectricalPoint (gap A-06) | (v1.1) | GEO-13, UX-09 |
| R-PM-03 (partial) | FR-035 share link | Doc 5 project_shares | (v1.1) | SEC-03 |
| R-ID-07 | FR-036 multi-select/copy | Doc 4 §2.11 | T-2.6 | SYNC-06 |
| R-FP-06 | FR-037 room props/ceiling | Doc 4 §2.7 | T-2.9 | GEO-14 |
| sentiment "learning curve" | FR-038 onboarding | Doc 4 §7 F1 | T-1.2 (+ Phase 8 polish) | UX-12 |
| Play policy (to verify) | FR-039 deletion | Doc 5 §5 | T-5.7 | SEC-05 |
| R-ID-02 | FR-043 back-to-wall snap | Doc 4 §2.9 | T-4.5 | GEO-15 |
| RISK-02 | NFR-001..006, 016 | TRD §10, Doc 4 §3.5 | T-0.6, T-0.7, Phase 7 | PERF-01..07 |
| sentiment "lost work" | NFR-007 | Doc 4 §5 | T-0.8, T-7.6 | REL-01, REL-07 |
| RISK-06 | NFR-015 | Doc 4 §3 | T-3.8 | REN-07 |
| Doc 9 §5.1 | NFR-011/012 | TRD §12, Doc 6 §4.2 | T-5.3, T-6.1 | SEC-01..06 |
| — | NFR-009 accessibility | Doc 2 §13 | T-2.4, T-7.4 | UX-10 |
| — | NFR-013 Hindi | TRD §2 | T-1.3 | UX-11 |

## 4. Recommended external validation
1. **Geometry review** by an engineer with CAD/computational-geometry experience after Phase 0 (half to two days).
2. **Real-device benchmark** on at least 2 Android phones you physically own (Phase 0).
3. **Security review** of RLS policies and billing verification before production (Phase 8).
4. **License review** of the asset register (and the app's dependency list) before the first public release.
5. **User tests** with 5 homeowners and 5 electricians from Raghvendr's customer base (Phase 2 exit and before Phase 6).
6. Re-run this document's cross-reference script after every documentation change (keep it in `tools/` once the repo has code).
