# Document 1 — Planner 5D Research Report

**Observation date for all sources:** 2026-10-10
**Method:** Web search result snippets (the research environment's network policy blocked direct page fetches of `planner5d.com`, `tool.planner5d.com` and `play.google.com`, so pages could not be opened in full). Everything below is limited by that. Items that need a human to open the live page are listed in §8.

## 0. Evidence labels

| Label | Meaning |
|---|---|
| **VERIFIED** | Stated by an official Planner 5D page/help article (seen via search snippet) |
| **OBSERVED** | Seen in a public listing/review page (third party) |
| **INFERRED** | Reasonable engineering hypothesis, not confirmed |
| **PROPOSED** | Our recommendation for the new product |
| **UNKNOWN** | Could not be established |

> Nothing in this document describes Planner 5D's internal source code. We have no access to it. The only stack hint is a public job posting (§3).

---

## 1. Planner 5D feature inventory

### 1.1 Floor planning

| ID | Feature | Status in Planner 5D | Evidence | Notes for our build |
|---|---|---|---|---|
| R-FP-01 | Draw rooms / walls in 2D | VERIFIED | Help center: walls, doors, windows added with drag-and-drop tools in 2D mode [S5] | Core MVP |
| R-FP-02 | Precise dimensions by typing W/D/H | VERIFIED | "click on it and set the appropriate width, depth and height in the settings line at the bottom of the screen" [S6] | Core MVP |
| R-FP-03 | Edit one wall vs whole room | VERIFIED | Selecting one wall changes that wall; selecting room applies to all its walls [S6] | Implies a room ↔ wall relationship in the data model (INFERRED) |
| R-FP-04 | Measurement units (metric/imperial) | VERIFIED | Help article "How to change dimensions and measurement units" [S7] | MVP |
| R-FP-05 | Multiple floors | VERIFIED | Floors menu on macOS/Android [S8] | Old Android article mentions a 3-floor limit with workaround; may be outdated (UNKNOWN today) |
| R-FP-06 | Ceiling height per room | VERIFIED | "These dimensions are only applied to a chosen room" [S6] | Room-level property, not building-level |
| R-FP-07 | Doors & windows | VERIFIED | [S5] | MVP |
| R-FP-08 | Staircases, roofs, terrain | UNKNOWN | Search did not return documentation | Treat as "Should/Could" for us |
| R-FP-09 | Undo/redo | INFERRED (standard in editors) | Not confirmed by a snippet | MVP regardless |
| R-FP-10 | Floor plan upload (trace or recognize) | VERIFIED | Pricing: Premium includes "floor plan upload" [S1] | See AI section |

### 1.2 Interior design

| ID | Feature | Status | Evidence |
|---|---|---|---|
| R-ID-01 | Furniture catalog | VERIFIED | Pricing: "full 10K+ furniture catalog" on Premium [S1]. Third parties report 5000+, 8400+ and 10K+ at different dates [S14]. Free tier: "150+" items on one store listing [S14], "about 50%" per an aggregator [S2]. **Conflicting – exact free-tier size UNKNOWN.** |
| R-ID-02 | Drag-and-drop placement | VERIFIED | [S5] |
| R-ID-03 | Resize furniture | VERIFIED (with plan restrictions conflicting across articles) [S6] |
| R-ID-04 | Custom textures/materials | OBSERVED | Free mode "5 custom textures" (third-party summary of store listing) [S9] |
| R-ID-05 | Upload own 3D models (.obj, .fbx, .blend, .stl) | VERIFIED | Professional tier [S1] |
| R-ID-06 | Budget widget | VERIFIED | Premium tier [S1] |
| R-ID-07 | Collision, snapping, grouping, alignment | UNKNOWN | Not found in snippets |
| R-ID-08 | Text search for furniture ("just type what you need") | OBSERVED | Planner 5D AI-list page title [S14] |

### 1.3 3D visualization

| ID | Feature | Status | Evidence |
|---|---|---|---|
| R-3D-01 | Instant 2D → 3D switch | VERIFIED (core product promise; reviewers praise "sketch a room and see it in 3D" quickly) [S9] |
| R-3D-02 | Eye-level / first-person navigation with WASD + mouse, height setting | VERIFIED | Help: "3D navigation and camera controls (web)" [S12] |
| R-3D-03 | Rendered images (Standard, HD, 4K) | VERIFIED | Premium: Standard renders; Professional: unlimited 4K [S1]; blog: regular subscription had five 4K renders with option to buy more [S10] |
| R-3D-04 | 360° panoramas / walkthroughs | VERIFIED | Professional tier [S1] |
| R-3D-05 | Camera collision on stairs/walls | UNKNOWN |

### 1.4 AI features

| ID | Feature | Status | Evidence |
|---|---|---|---|
| R-AI-01 | AI floor plan recognition (image/PDF/DWG → editable 3D) | VERIFIED | Furniture Today 2021: recognizes walls, doors, windows, objects from scans/blueprints/hand drawings [S3]; B2B API page: accepts JPEG, PNG, PDF, DWG, DXF; **async; AI completes in ~1–3 min, then a human designer reviews; full turnaround usually within one business day** [S11] |
| R-AI-02 | Design Generator (photo → styled room images) | VERIFIED | Upload a photo, pick room type; "built on the Stable Diffusion AI model and Planner 5D's proprietary algorithms"; output count conflicting (6 vs up to 20) [S4] |
| R-AI-03 | Smart Wizard (room type + shape + size + style → furnished layout) | VERIFIED | [S4]; platform availability conflicting (desktop-only vs iOS article) |
| R-AI-04 | AI Design Generator in Professional plan | OBSERVED | Aggregator [S2] |

**Key finding (important for us):** Planner 5D's own B2B recognition workflow includes **a human designer review step** [S11]. This is strong evidence that fully automatic floor-plan-to-CAD conversion is not reliable enough to ship without human correction, even for a company that has worked on it since at least 2021.

### 1.5 Project management

| ID | Feature | Status | Evidence |
|---|---|---|---|
| R-PM-01 | Cloud sync across devices | VERIFIED | Help article; warns opening the same project on two devices can cause conflicts and lost changes [S13] |
| R-PM-02 | Offline editing | VERIFIED with caveat | Offline edits saved after reconnect; another device's edits can overwrite them [S13] |
| R-PM-03 | Real-time collaboration (web) | VERIFIED | Collaboration page + help article "Live collaboration tool (web)" [S13]; FAQ says link shares are view-only by default |
| R-PM-04 | Version history | UNKNOWN | Only one third-party mention |
| R-PM-05 | CAD export (DWG) | VERIFIED | "Export to CAD" page; Professional tier [S1][S10] |
| R-PM-06 | Unlimited projects on free tier | VERIFIED | Pricing page [S1] |

### 1.6 Monetization (official pricing page, via snippet) [S1]

| Tier | Price | Notable inclusions |
|---|---|---|
| Free | $0 | Unlimited projects, cross-device, partial catalog |
| Premium | $19.99/mo or $4.99/mo billed annually | Full 10K+ catalog, standard renders, floor plan upload, budget widget |
| Professional | $49.99/mo or $33.33/mo billed annually | Unlimited 4K renders, 3D model upload, 360° walkthroughs, CAD export, specs organizer, AI Design Generator |
| Enterprise | Contact sales | — |

A support article uses different tier names (Basic / Premium / PRO) and says allowances vary by platform [S1]. App Store listing shows yearly and lifetime purchases up to $89.99 (third-party summary) [S9]. Prices are USD; Indian Play Store prices are likely localized (UNKNOWN).

### 1.7 Platforms and technology hints

- Platforms: Web, iOS, Android, Windows, macOS (job posting) [S15]. Chrome Web Store listing also exists [S9].
- **Only technology evidence:** a Planner 5D job posting for a "WebGL/Three.js Developer" lists "native Javascript, JQuery (legacy code), Typescript, Three.js, SVG, Canvas, WebGL, Webpack" and says the team develops "our interior editor using Three.js and WebGL" [S15]. Status: **OBSERVED (job ad)**. It tells us Three.js is a proven choice for this product category; it does **not** tell us how their mobile apps render.

### 1.8 User sentiment (what to do better)

| Theme | Evidence | Opportunity for us |
|---|---|---|
| Billing/trial complaints, hard cancellation | Trustpilot reviews and company replies; Trustpilot ~2.5 vs G2/Capterra ~4.5–4.7 (aggregator) [S16] | Transparent paywall, cancel-in-one-tap via Play subscriptions, no dark patterns |
| Slow performance / navigation difficulty | Trustpilot summary [S16] | Strict performance budgets (Doc 8) |
| Lost work | Individual reviews [S16]; sync conflict warning in official help [S13] | Local-first autosave + version snapshots (Doc 4 §5) |
| Fast 2D→3D praised | [S9] | Keep instant 3D as a core promise |

Review counts and download numbers from third parties conflict heavily (e.g. 63 vs 474K reviews; "2 million downloads" claim in App Store listing) [S9]. **We do not cite a user count.** A "100 million users" figure appears on an aggregator but was not found in official sources → UNKNOWN.

---

## 2. Competitor benchmark

Prices from aggregators unless stated; all must be re-checked on official pages before any business decision.

| Product | Platforms | 2D/3D | AI | Pricing (as found) | Open source? | Evidence |
|---|---|---|---|---|---|---|
| Planner 5D | Web, iOS, Android, Win, Mac | Live 2D/3D | Recognition, Design Generator, Smart Wizard | Free / $19.99 / $49.99 mo | No | §1 |
| Floorplanner | Web | 2D/3D | Not confirmed | Basic $0, Plus $5/mo, Pro $29/mo + credits (Capterra) | No | [S17] |
| RoomSketcher | Web, apps | 2D/3D, live 3D, 360 | Not confirmed | Pro ~$144/user/yr or $24/mo (aggregators, conflicting) | No | [S18] |
| Sweet Home 3D | Desktop (Java), JS online version | 2D/3D | No | Free (GPL) | **Yes, GPL v2+** — cannot be used inside a closed-source app; its default catalog models are licensed for commercial redistribution | [S19] |
| HomeByMe | Web | 2D/3D, realistic images | Not confirmed | Subscriptions + packs of projects/images/videos (third-party guide) | No | [S20] |
| Homestyler | Web, apps | 2D/3D, renders | AI assistance (review) | Conflicting ($4.9–$9.9/mo; homestyler.ai $19–$299/mo) | No | [S20][S21] |
| Live Home 3D | Win, Mac, iOS | 2D/3D | Not confirmed | From $19.99, free plan (aggregator) | No | [S21] |
| blueprint3d (palm) | Web | 2D/3D (Three.js) | No | Free | Yes; license file present — **believed MIT, must verify LICENSE.txt** | [S22] |

### 2.1 Minimum useful product (derived)

Every competitor shares the same core: **draw walls → rooms with dimensions → doors/windows → place furniture from a catalog → see in 3D → save/share**. AI and photoreal rendering are differentiators layered on top, and both carry per-use cost. Our MVP is therefore that core only (see Doc 2 §8).

### 2.2 Gap / positioning opportunity for Raghvendr (PROPOSED)

- India-focused: metric by default, Hindi UI, Indian room types (pooja room, balcony, utility), INR pricing.
- **Electrical layout layer** (switch boards, fan points, light points, wiring runs, load estimate) — none of the competitors above advertise this (search did not show it; treat as UNKNOWN but promising). This links directly to Raghvendr's electrical retail business and could become the differentiator and a lead source for the shop.
- Honest billing (answers the #1 complaint).

---

## 3. Most technically risky assumptions (ranked)

| # | Assumption | Why risky | How we validate (Doc 7 Phase 0) |
|---|---|---|---|
| RISK-01 | Wall junctions, room detection and openings stay correct under arbitrary edits | Geometry edge cases (T-junctions, collinear overlap, near-zero lengths, floating-point drift) are where AI-written code most often looks right and is wrong | Property-based tests + golden fixtures (Doc 8 GEO-*) |
| RISK-02 | Three.js inside an Android WebView (Capacitor) is fast enough on mid/low phones | Community reports say WebView WebGL can miss 60 fps even on simple scenes and varies by device [S23] | Phase 0 benchmark on 3 real devices, 30 fps target (not 60) |
| RISK-03 | We can obtain a legal, optimized furniture catalog | Assets are a licensing + money problem, not a coding problem | Start with CC0 sources + Sweet Home 3D catalog models (commercial use allowed per their license page) — verify per-model license |
| RISK-04 | AI floor plan recognition gives editable, accurate geometry | Planner 5D itself uses human review [S11] | Ship as "AI draft + user correction", measure correction time |
| RISK-05 | AI image costs fit inside subscription revenue | Image models cost ~$0.02–$0.24/image (third-party pricing, unverified) [S24] | Credit system; cost tracking per user |
| RISK-06 | WebGL context loss on mobile | Known Three.js forum topic [S23] | Context-loss recovery test (Doc 8 REN-07) |
| RISK-07 | A beginner can maintain a geometry + 3D codebase built by AI | Debugging needs domain knowledge | Strict test gates, small phases, external review budget |

---

## 4. Uncertainty register

| ID | Question | Status | How to resolve |
|---|---|---|---|
| U-01 | Exact free-tier catalog size | Conflicting (150+ vs ~50%) | Open the app |
| U-02 | Stairs / roof / terrain support | UNKNOWN | Open the app / help center |
| U-03 | Version history | UNKNOWN | Help center |
| U-04 | Current Google Play rating, installs | Not fetched (blocked) | Open play.google.com listing |
| U-05 | Mobile rendering tech (native vs WebView) | UNKNOWN | Not knowable publicly; not needed |
| U-06 | INR pricing in Play Store | UNKNOWN | Check on an Indian device |
| U-07 | blueprint3d license | Believed MIT | Read LICENSE.txt |
| U-08 | CubiCasa5k dataset license for commercial use | UNKNOWN [S25] | Read repo license before any training use |
| U-09 | Collision/snapping behavior of furniture | UNKNOWN | Hands-on test |

---

## 5. Sources (all accessed 2026-10-10 via search)

- [S1] Planner 5D Pricing — https://planner5d.com/pricing ; Subscription types — https://support.planner5d.com/en/articles/15128965-planner-5d-subscription-types
- [S2] Aggregators — https://www.xpay.sh/saas-pricing/planner-5d/ , https://capterra.com/p/164022/Planner-5D/
- [S3] Furniture Today — https://www.furnituretoday.com/technology/planner5d-launches-automatic-floor-plan-recognition
- [S4] Design Generator / Smart Wizard — https://planner5d.com/blog/design-generator-ai-interior-design-solution/ , https://planner5d.com/smart-wizard , https://support.planner5d.com/en/articles/9304764-design-generator-your-ai-tool-for-home-renovation
- [S5] https://planner5d.com/use/free-floor-plan-creator ; https://support.planner5d.com/en/articles/5876772-how-to-navigate-through-planner-5d
- [S6] https://support.planner5d.com/en/articles/5876845-changing-dimensions-web
- [S7] https://support.planner5d.com/en/articles/16963387-how-to-change-dimensions-and-measurement-units
- [S8] https://support.planner5d.com/en/articles/6132001-adding-a-fourth-floor-android
- [S9] App Store listing https://apple.co/2UO1Sws ; https://planner5d.com/reviews ; Uptodown listing
- [S10] https://planner5d.com/blog/de/neue-hd-renderings-mit-planner-5d/ ; https://planner5d.com/pro/exportcad
- [S11] https://tool.planner5d.com/b2b-floor-plan-recognition ; https://support.planner5d.com/en/articles/15189751-planner-5d-b2b-api-technical-overview
- [S12] https://support.planner5d.com/en/articles/13161059-3d-navigation-and-camera-controls-web
- [S13] https://support.planner5d.com/en/articles/5876734-how-to-synchronize-projects-across-devices ; https://support.planner5d.com/en/articles/15156440-how-to-save-projects ; https://planner5d.com/collaboration-tool
- [S14] https://www.trustradius.com/products/planner-5d ; https://apps.microsoft.com/detail/9nblggh4mp71
- [S15] Job posting — https://jobs.lever.co/planner5d/794488a5-d929-47d3-bc3e-da8867745143
- [S16] https://www.trustpilot.com/review/planner5d.com ; https://checkthat.ai/brands/planner-5d/reviews
- [S17] https://www.capterra.co.uk/reviews/164017/floorplanner
- [S18] https://capterra.com/p/164021/RoomSketcher/ ; https://www.xpay.sh/saas-pricing/roomsketcher/
- [S19] https://www.sweethome3d.com/license/
- [S20] https://unanswered.io/guide/is-homebyme-free-pricing-breakdown ; https://www.capterra.com/p/10016145/Homestyler/
- [S21] https://www.unite.ai/homestyler-review ; https://www.saasworthy.com/product-alternative/6131/live-home-3d
- [S22] https://github.com/palm/blueprint3d
- [S23] https://discourse.threejs.org/t/how-to-fix-context-lost-android-iphone-ios/56829 ; https://capgo.app/blog/ultimate-guide-to-animation-performance-in-capacitor-apps/
- [S24] https://intuitionlabs.ai/articles/ai-image-generation-pricing-google-openai (third-party)
- [S25] https://arxiv.org/abs/1904.01920 (CubiCasa5K)
