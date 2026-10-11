> **Superseded (2026-10-11):** the combined Claude + Codex document [`combined-research.md`](combined-research.md) is now the main reference. This file is kept as history. Electrical planning has been removed from the product scope by owner decision.

# Document 2 — Product Requirements Document (PRD)

Working name: **GharPlan** (placeholder — check trademark/Play Store availability before use).
Status: Draft v0.1 · 2026-10-10 · Owner: Raghvendr

## 1. Product vision
A fast, honest, mobile-first home planner that lets an Indian homeowner or small contractor draw their house to real dimensions, furnish it, and see it in 3D on a ₹10–20k Android phone.

## 2. Target users & personas

| Persona | Description | Main job |
|---|---|---|
| P1 Homeowner "Sunita" | Building or renovating a 2–3 BHK; uses a mid-range Android phone; not technical | See if furniture fits, choose colours, show family |
| P2 Small contractor / interior designer "Imran" | Does interiors for local clients | Quick dimensioned plan + 3D view to share on WhatsApp |
| P3 Student / hobbyist | Likes design | Play with layouts, styles |

Market size: **not estimated in numbers.** Demand evidence from Google Play India (2026-10-11, Doc 1 §3.1): Planner 5D has 5 Cr+ installs and ranks #5 top-grossing in House & Home. Five other home-design apps have 1 Cr+ installs each. Install counts show interest; they are not a market-size or revenue estimate. Still needed: keyword volume and willingness-to-pay interviews (Doc 9 §7).

## 3. Jobs-to-be-done
- JTBD-1: "When I am planning a room, I want to check if my furniture fits so I don't buy the wrong size."
- JTBD-2: "When I discuss with family/contractor, I want a 3D picture so everyone imagines the same thing."
- JTBD-3: "When I change my plan on another phone, I don't want to lose my work."
- JTBD-4: "When I have a builder's plan image, I want it converted so I don't redraw it." (later, AI)

## 4. User problems (from research, Doc 1 §1.2 and §3.1: sync overwrites, shared-wall problems, paywall complaints, no Hindi)
Billing confusion, slow apps, lost work, steep learning curve, imperial-first tools.

## 5. Value proposition
Accurate plan in minutes · smooth 3D on budget phones · never lose work · clear pricing · Hindi.

## 6. Competitive positioning
Not competing on photoreal rendering or catalog size (10K+ items at Planner 5D). Competing on: speed, reliability, Indian context, price.

## 7. Product scope
Android app (Capacitor-wrapped web app) + same app on the web. One shared codebase.

## 8. MVP definition
MVP = **Must** requirements marked "MVP" below: draw walls/rooms with precise dimensions, doors/windows, ~100-item catalog, place/rotate furniture, wall/floor materials, live 3D orbit view, local autosave, project list, PNG export, onboarding, Play subscription for premium catalog/export. No AI, no cloud accounts in the very first MVP (local-only) — cloud sync is the next release.

## 9. Functional requirements

Format per row: ID · Requirement · Priority (MoSCoW) · Release · Dependencies · Acceptance criteria · Verification.
User story pattern: "As P1, I want …, so that …" is given where not obvious.

| ID | Requirement & user story | Pri | Rel | Deps | Acceptance criteria | Verify |
|---|---|---|---|---|---|---|
| PRD-FR-001 | Create blank project with name, units | M | MVP | — | New project opens in ≤1 s; appears in list after app restart | E2E UX-02 |
| PRD-FR-002 | Draw walls by tapping/clicking successive points; double-tap/ Esc ends | M | MVP | FR-013 | Chain of N points creates N-1 walls sharing junctions; closing on first point creates closed loop | GEO-01, E2E UX-04 |
| PRD-FR-003 | Snapping: to existing junctions (≤ 12 px screen), to wall lines, to grid, angle snap 15° (toggle) | M | MVP | FR-002 | Snapped point equals target coordinate exactly (integer mm) | GEO-05 |
| PRD-FR-004 | Type exact wall length (and angle) during/after drawing | M | MVP | FR-002 | Entered 3 450 mm → stored length 3 450 ± 0 mm; connected walls stay joined | GEO-06 |
| PRD-FR-005 | Rectangle room tool (W × D) | M | MVP | FR-002 | Creates 4 walls + 1 room; area = W×D (interior per definition in Doc 4 §2.6) | GEO-03 |
| PRD-FR-006 | Automatic room detection from closed wall loops; show name + area | M | MVP | FR-002 | Any closed loop becomes a room within the same edit; removing a wall merges/removes rooms correctly | GEO-02, GEO-03 |
| PRD-FR-007 | Edit wall thickness (50–600 mm) and height (1 000–6 000 mm) | M | MVP | FR-002 | 3D wall updates; junction miters remain watertight | GEO-04, SYNC-01 |
| PRD-FR-008 | Place doors and windows on a wall from catalog | M | MVP | FR-002 | Opening attaches to host wall; visible as hole in 3D | GEO-07, SYNC-03 |
| PRD-FR-009 | Opening constraints: stays inside wall length, no overlap with other openings, width ≤ wall length − 2× min margin (50 mm) | M | MVP | FR-008 | Invalid drop is rejected with message; drag clamps to valid range | GEO-08 |
| PRD-FR-010 | Select, move, delete walls and junctions; dragging a junction moves all connected walls | M | MVP | FR-002 | Connected walls stay connected; dependent openings keep relative offset or are clamped | GEO-09, GEO-16, SYNC-01 |
| PRD-FR-011 | Undo/redo (≥ 100 steps) for every model edit | M | MVP | Command system | Undo after any sequence returns byte-identical model (canonical JSON) | SYNC-06 |
| PRD-FR-012 | Units: metric (mm/cm/m) and imperial (ft-in) display; internal mm | M | MVP | — | Round-trip display→parse→display stable | GEO-10 |
| PRD-FR-013 | 2D zoom/pan: mouse wheel/drag; touch pinch/two-finger pan | M | MVP | — | Zoom 1:1 000 range; pinch keeps focal point fixed (±2 px) | UX-05 |
| PRD-FR-014 | Furniture catalog: categories, search, thumbnails; free vs premium badge | M | MVP | Asset pipeline | ≥ 100 items at MVP, each with license record | AST-01 |
| PRD-FR-015 | Place, move, rotate (15° snap, free with modifier) furniture in 2D and 3D | M | MVP | FR-014 | Position/rotation identical in 2D and 3D (≤ 1 mm, ≤ 0.1°) | SYNC-02 |
| PRD-FR-016 | Edit furniture W/D/H (scales model) | S | MVP | FR-015 | Bounding box equals entered size ± 1 mm | SYNC-02 |
| PRD-FR-017 | Collision warning: furniture overlapping walls or other furniture is highlighted (not blocked) | S | v1.0 | FR-015 | Overlap detection on 2D footprints (OBB) correct for test fixtures | GEO-11 |
| PRD-FR-018 | Change wall-side paint/material, floor material; furniture colour variants | M (walls/floors), S (furniture) | MVP | Material library | Change visible in 3D in ≤ 200 ms; persisted | SYNC-04 |
| PRD-FR-019 | 3D view always reflects current model (split view on tablet/desktop, toggle on phone) | M | MVP | Doc 4 sync | After any edit, 3D state hash equals model-derived hash | SYNC-01..07 |
| PRD-FR-020 | 3D orbit camera: rotate, pan, zoom; touch gestures; camera cannot go below floor | M | MVP | FR-019 | Camera constraints hold in automated test | REN-04 |
| PRD-FR-021 | First-person walk mode (joystick on touch, WASD on desktop), eye height 1 600 mm, wall collision | S | v1.0 | FR-019 | Cannot pass through walls in test path; can pass through door openings | REN-05 |
| PRD-FR-022 | Local autosave ≤ 2 s after last edit; crash recovery on next launch | M | MVP | Storage | Kill-app test loses ≤ last 2 s of edits | REL-01, REL-02 |
| PRD-FR-023 | Account (Google sign-in) + cloud save/sync; last-write-wins with conflict copy | S | v1.0 | Backend | Conflicting edits create "conflicted copy", never silent overwrite | REL-05 |
| PRD-FR-024 | Project list: open, rename, duplicate, delete (with undo-able trash 30 days for cloud) | M | MVP | FR-022 | Duplicate produces new IDs for all entities; original unchanged | REL-03 |
| PRD-FR-025 | Export 2D plan as PNG/PDF with dimensions; 3D screenshot PNG | M | MVP | FR-019 | Exported PNG shows dimension labels matching model ±1 mm rounding | UX-08 |
| PRD-FR-026 | Multiple floors (add/remove/switch; copy outline of floor below) | S | v1.1 | Data model | Floors stack at correct elevation in 3D | SYNC-08 |
| PRD-FR-027 | Straight staircase object between floors | C | v1.2 | FR-026 | Stair fits floor-to-floor height | GEO-12 |
| PRD-FR-028 | Templates (1BHK, 2BHK, room presets) | S | v1.0 | FR-001 | Template opens as a new editable copy | UX-02 |
| PRD-FR-029 | Subscription via Google Play Billing: premium catalog, PDF export, ad-free, extra floors | M | v1.0 (release) | Billing | Entitlement granted ≤ 10 s after purchase; restored on reinstall; cancellation respected | MON-01..04 |
| PRD-FR-030 | Ads for free users: banner on project list only, never on the editor canvas; optional rewarded ad to unlock one premium item for a project | S | v1.0 | AdMob | No ad overlaps editor; ad-free for subscribers | MON-05 |
| PRD-FR-031 | AI floor-plan import: upload image → AI draft walls/openings → user correction screen → accept | C | v2 | Doc 6 | Output always valid geometry; user can fix every element | AI-01..05 |
| PRD-FR-032 | AI restyle image from 3D screenshot or room photo (visual only, clearly labelled) | C | v2 | Doc 6, credits | Image returned or clear error in ≤ 60 s; credits deducted only on success | AI-06, AI-08 |
| PRD-FR-033 | AI furnish suggestion: proposes furniture placement as editable objects | C | v2 | Doc 6 | All placed objects inside room, no overlaps, door swing clear | AI-07 |
| PRD-FR-034 | **Retired** — electrical layer removed: out of scope by owner decision (2026-10-11). ID not reused. | — | — | — | — | — |
| PRD-FR-035 | Share read-only web link | C | v1.1 | FR-023 | Link viewer cannot edit; owner can revoke | SEC-03 |
| PRD-FR-036 | Multi-select, copy/paste, duplicate furniture | S | v1.0 | FR-015 | Duplicates get new IDs, offset 200 mm | SYNC-06 |
| PRD-FR-037 | Room properties: name, type, ceiling height, floor material | M | MVP | FR-006 | Room props survive wall edits that keep the room (room identity rules Doc 4 §2.7) | GEO-14 |
| PRD-FR-038 | First-run onboarding (≤ 4 screens + interactive "draw your first room") | M | MVP | — | ≥ 60% of new users create a room in first session (analytics) | UX-12, Analytics |
| PRD-FR-039 | Account & data deletion in-app and via web URL | M (when accounts exist) | v1.0 | FR-023 | Deletion completes ≤ 30 days; confirmation shown | SEC-05 |
| PRD-FR-040 | Real-time multi-user collaboration | W | — | — | — | — |
| PRD-FR-041 | Photoreal path-traced rendering | W (v1) | — | — | — | — |
| PRD-FR-042 | DWG/DXF export | W (v1); C later (DXF only) | — | — | — | — |
| PRD-FR-043 | Snapping & alignment of furniture to walls (back-to-wall snap) | S | v1.0 | FR-015 | Back face within 1 mm of wall inner face after snap | GEO-15 |

## 10. Non-functional requirements (measurable)

Reference devices (named device classes in Doc 4 §3.8; record exact models): **Low** = Android with 3 GB RAM, Mali-G52 class GPU; **Mid** = 6 GB RAM, Adreno 6xx/Mali-G57 class; **Desktop** = any laptop with integrated GPU from 2020+ in Chrome.

| ID | Requirement | Threshold | Verify |
|---|---|---|---|
| PRD-NFR-001 | 2D editor frame rate while dragging a junction, 200-wall plan | ≥ 45 fps Mid, ≥ 30 fps Low | PERF-01 |
| PRD-NFR-002 | 3D frame rate, sample project (6 rooms, 60 furniture items), orbiting | ≥ 30 fps Mid, ≥ 24 fps Low, ≥ 60 fps Desktop | PERF-02 |
| PRD-NFR-003 | Edit-to-3D latency (wall drag commit → mesh visible) | p95 ≤ 100 ms Mid | PERF-03 |
| PRD-NFR-004 | Cold start to project list | ≤ 4 s Mid, ≤ 7 s Low | PERF-04 |
| PRD-NFR-005 | Install size (AAB download) | ≤ 40 MB; catalog assets streamed + cached | PERF-05 |
| PRD-NFR-006 | Texture memory budget | ≤ 256 MB Mid, ≤ 128 MB Low (quality tier switch) | PERF-06 |
| PRD-NFR-007 | Durability | No project loss in 100 forced-kill cycles; ≤ 2 s edit loss | REL-01 |
| PRD-NFR-008 | Geometric precision | Integer mm storage; derived values computed in float64; displayed rounding documented | GEO-10 |
| PRD-NFR-009 | Accessibility | WCAG 2.1 AA contrast for UI chrome; touch targets ≥ 48 dp; every canvas edit also possible via numeric property panel; TalkBack labels on all buttons | UX-10 |
| PRD-NFR-010 | Offline | All MVP features work in airplane mode | REL-04 |
| PRD-NFR-011 | Security | No secret keys in app bundle; row-level security on all user tables | SEC-01, SEC-02, SEC-06 |
| PRD-NFR-012 | Privacy | AI uploads deleted ≤ 30 days; explicit consent before upload | SEC-04 |
| PRD-NFR-013 | Localization | English + Hindi strings; no hard-coded UI text | UX-11 |
| PRD-NFR-014 | Stability | Crash-free sessions ≥ 99.5% (Play Console vitals) | Post-launch metric |
| PRD-NFR-015 | WebGL context loss | Recovers ≤ 3 s, no model data loss | REN-07 |
| PRD-NFR-016 | Project size | Load 500-wall / 1 000-object project ≤ 3 s Mid | PERF-07 |

## 11. User journeys (summary; detailed flows in Doc 4 §7 / Doc 7 Phase 2–8)
J1 First-run → draw first room → add door → add bed → view 3D → autosaved.
J2 Return → open project → change wall colour → export PNG → share on WhatsApp.
J3 Hit premium item → paywall → subscribe → item unlocked.
J4 (v2) Upload builder plan image → AI draft → correct → furnish.

## 12. Feature dependencies
```mermaid
graph LR
  Model[Canonical model + commands] --> Walls[FR-002..010]
  Walls --> Rooms[FR-006,037]
  Walls --> Openings[FR-008,009]
  Model --> Undo[FR-011]
  Rooms --> Furniture[FR-014..017,043]
  Model --> ThreeD[FR-019..021]
  Model --> Save[FR-022,024]
  Save --> Cloud[FR-023,035,039]
  Furniture --> Billing[FR-029,030]
  Walls --> AIimport[FR-031]
  Rooms --> AIfurnish[FR-033]
```

## 13. Mobile usability requirements
- One-hand reachable primary toolbar at bottom; property sheet as bottom drawer.
- Touch: tap = select, long-press = context menu, drag on empty = pan, pinch = zoom, two-finger rotate disabled in 2D (prevents accidental rotation).
- Drawing on touch uses an **offset cursor/loupe** above the finger so the point being placed is visible.
- Numeric keypad for dimension entry.

## 14. Project saving and recovery
Local-first: IndexedDB (web) / Capacitor filesystem-backed storage on Android; journal of commands since last snapshot; recovery dialog on launch if journal is newer than snapshot.

## 15. Monetization requirements
- Free: unlimited projects, basic catalog, PNG export with small watermark, banner ads on non-editor screens, **rewarded ad to unlock one premium item for 72 h** (Planner 5D used this model in 2020 per a Play review; Doc 1 §3.1). Note: Planner 5D gives a PDF report to all plans (Doc 1 R-PM-05), so a free watermarked PDF plan export should be considered.
- Premium (monthly/yearly via Play Billing): full catalog, no ads, PDF export without watermark, multi-floor.
- Credits (v2): AI features consume credits; Premium includes a monthly allowance; extra credit packs as in-app products.
- Price points: **to be decided after research**; do not copy Planner 5D USD prices — Indian price sensitivity is different.
- Google Play fee (VERIFIED, Play Console Help, 2026-10-11): **India is still on the old structure: 15% for auto-renewing subscriptions.** Alternative billing in India costs the Play fee minus 4%, i.e. 11%. The new 10%/20% structure applies only to EEA/UK/US (from 30 Jun 2026) and AU/JP (from 30 Sep 2026) for now.
- Competitor reference prices (USD, official pages): Planner 5D Premium $19.99/mo or $59.99/yr; Homestyler Pro+ $6.8/mo; RoomSketcher Pro $24/mo or $144/yr. Indian prices: UNKNOWN (Doc 1 U-06).

## 16. Analytics & success metrics
Activation: % new users who create ≥ 1 room in session 1 (target ≥ 60%). Engagement: D7 retention (target set after first cohort; no invented benchmark). Monetization: free→paid conversion, ARPDAU from ads. Quality: crash-free ≥ 99.5%, ANR rate below Play "bad behavior" threshold.
Events: `project_created`, `wall_drawn`, `room_closed`, `furniture_placed`, `view_3d_opened`, `export_done`, `paywall_shown`, `purchase_completed`, `ai_job_*`.

## 17. Prioritization summary
Must (MVP): FR-001–015, 018–020, 022, 024, 025, 037, 038; release-must: FR-029, FR-039 (with accounts).
Should: FR-016, 017, 021, 023, 026, 028, 030, 036, 043. (FR-034 retired.)
Could: FR-027, 031, 032, 033, 035.
Won't (v1): FR-040, 041, 042.

## 18. Explicit exclusions (v1)
Real-time collaboration, path-traced photoreal rendering, DWG export, user-uploaded 3D models, roof generator, terrain/landscaping, iOS app, VR/AR.

## 19. Release acceptance criteria (v1.0 to Play Store)
1. All Must FR acceptance criteria pass in Doc 8 automated suites.
2. PRD-NFR-001..007, 015 pass on the Low and Mid reference devices (recorded evidence).
3. Billing tested with Play license testers: purchase, restore, cancel, grace period.
4. Data safety form, privacy policy, account deletion URL complete.
5. No P0/P1 open bugs; closed test with **≥ 12 testers opted in continuously for 14 days** (VERIFIED rule for personal accounts created after 13 Nov 2023; Play Console Help).

## Appendix A — User story for every functional requirement
Personas: P1 homeowner, P2 contractor/interior designer, P3 hobbyist (§2).

| ID | User story |
|---|---|
| PRD-FR-001 | As P1, I want to start a named project in metres so that my plan matches my real house. |
| PRD-FR-002 | As P1, I want to tap corner points to draw walls so that I can trace my real layout. |
| PRD-FR-003 | As P1, I want walls to snap to corners and lines so that they join without gaps. |
| PRD-FR-004 | As P2, I want to type exact wall lengths so that the plan is as accurate as my tape measure. |
| PRD-FR-005 | As P1, I want to create a room by entering width × depth so that simple rooms take seconds. |
| PRD-FR-006 | As P1, I want rooms and their areas to appear automatically so that I know carpet area without maths. |
| PRD-FR-007 | As P2, I want to set wall thickness and height so that 230 mm brick and 115 mm partitions look right. |
| PRD-FR-008 | As P1, I want to drop doors and windows on walls so that the plan shows openings. |
| PRD-FR-009 | As P1, I want the app to stop me placing a door that doesn't fit so that I don't get impossible plans. |
| PRD-FR-010 | As P1, I want to drag a corner and have connected walls follow so that editing stays tidy. |
| PRD-FR-011 | As P1, I want undo/redo so that I can experiment without fear. |
| PRD-FR-012 | As P3, I want feet-inches or metres so that I can use the unit I know. |
| PRD-FR-013 | As P1, I want to pinch-zoom and pan so that I can work on a small phone screen. |
| PRD-FR-014 | As P1, I want to browse and search furniture so that I find a bed or sofa quickly. |
| PRD-FR-015 | As P1, I want to move and rotate furniture so that I can try arrangements. |
| PRD-FR-016 | As P1, I want to set furniture size so that it matches the item I plan to buy. |
| PRD-FR-017 | As P1, I want overlaps highlighted so that I notice when things don't fit. |
| PRD-FR-018 | As P1, I want to change wall colours and floor tiles so that I can choose finishes with family. |
| PRD-FR-019 | As P1, I want the 3D view to match my 2D edits so that I can trust what I see. |
| PRD-FR-020 | As P1, I want to rotate and zoom the 3D view so that I understand the space. |
| PRD-FR-021 | As P1, I want to walk through the house at eye height so that it feels real. |
| PRD-FR-022 | As P1, I want my work saved automatically so that a crash never loses it. |
| PRD-FR-023 | As P2, I want my projects on phone and web so that I can show clients anywhere. |
| PRD-FR-024 | As P2, I want to duplicate and rename projects so that I can make versions for clients. |
| PRD-FR-025 | As P2, I want to export a dimensioned plan image/PDF so that I can share it on WhatsApp. |
| PRD-FR-026 | As P1, I want several floors so that I can plan a G+1 house. |
| PRD-FR-027 | As P1, I want stairs between floors so that the 3D model is complete. |
| PRD-FR-028 | As P1, I want 1BHK/2BHK templates so that I start from something close to my home. |
| PRD-FR-029 | As P1, I want to subscribe in Google Play so that paying and cancelling are simple and trusted. |
| PRD-FR-030 | As P1 (free user), I want ads only outside the editor and an ad-to-unlock option so that I can use the app without paying. |
| PRD-FR-031 | As P2, I want to convert a builder's plan image so that I don't redraw it. |
| PRD-FR-032 | As P1, I want a styled AI picture of my room so that I get decoration ideas. |
| PRD-FR-033 | As P1, I want furniture suggestions placed for me so that I get a starting layout. |
| PRD-FR-034 | (Retired: electrical planning out of scope.) |
| PRD-FR-035 | As P2, I want a view-only link so that a client can see the plan without installing the app. |
| PRD-FR-036 | As P1, I want to copy furniture so that I can repeat chairs quickly. |
| PRD-FR-037 | As P1, I want to name rooms (incl. pooja room, balcony) and set ceiling height so that the plan is clear. |
| PRD-FR-038 | As a new user, I want a short guided first room so that I learn in a minute. |
| PRD-FR-039 | As any user, I want to delete my account and data so that I control my privacy. |
| PRD-FR-040 | (Won't v1) As P2, I want to edit live with a client. |
| PRD-FR-041 | (Won't v1) As P1, I want photoreal renders. |
| PRD-FR-042 | (Won't v1) As P2, I want DWG/DXF for AutoCAD. |
| PRD-FR-043 | As P1, I want furniture to snap to walls so that it sits flush. |
