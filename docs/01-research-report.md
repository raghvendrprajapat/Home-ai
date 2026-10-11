# Document 1 — Planner 5D Research Report (round 2, live sources)

**Evidence date:** 2026-10-11 (pages opened directly). Round 1 (2026-10-10) used search snippets only; every round-1 claim was rechecked and **corrections are listed in §6**.
**Source IDs** (P01…, C01…, V01…) refer to `docs/research/source-log.md`.

## 0. Evidence labels

| Label | Meaning |
|---|---|
| **VERIFIED** | Stated on an official Planner 5D page or help article opened on 2026-10-11 (quote/paraphrase with source ID) |
| **OBSERVED** | Seen in a public listing (Google Play/App Store page, user review text) |
| **INFERRED** | Engineering hypothesis from several observations; not confirmed |
| **PROPOSED** | Our design for our product |
| **UNKNOWN** | Not found in official sources |

> No proprietary code, private API or login-only interface was used. Statements about Planner 5D's internal engine are INFERRED at most.

---

## 1. What Planner 5D is today (snapshot)

| Item | Value | Status / source |
|---|---|---|
| Platforms | Web, iOS/iPadOS, Android, Windows, macOS (M1+), visionOS | VERIFIED P01, P06 |
| Scale claims | "100M+ homeowners and pros … over 540M homes" (home page); "Trusted by 120M+" (pricing); "400M+ interior design projects" (App Store) | VERIFIED as **company claims** — not independently audited; the numbers differ between pages |
| Google Play (India) | ★ 4.27 from 582,492 ratings; **5 Cr+ downloads**; updated 7 Oct 2026; "#5 top grossing house & home" | OBSERVED P05 |
| App Store (US) | ★ 4.4 from 42K ratings; v5.11.1; **963.4 MB**; iOS 17+; 24 UI languages — **no Hindi** | OBSERVED P06 |
| Catalog size | "more than 8,000 items" (home), "10K+" (pricing), "8,400+" (App Store), "6,723 elements" (Play description) | VERIFIED but **inconsistent across official pages** |
| Free catalog | "Access to 50% of the furniture catalog" (pricing) vs "150+ decor item catalog" (App Store free version) | VERIFIED but **inconsistent**; free status "is determined separately for each platform" (P03h) |
| Company | Planner5D UAB, Vilnius, Lithuania | VERIFIED P02 |

### 1.1 Pricing (US list prices, P02)

| Plan | Price | Includes (quoted/paraphrased) |
|---|---|---|
| Free | $0 | Unlimited projects, web + mobile, 50% of catalog, Design Battles (win Premium) |
| Premium | $19.99/mo or $59.99/yr (shown as $4.99/mo) | Full 10K+ catalog, **AI floor-plan recognition** (upload plan → 3D), 3D models from photos, standard renders, Budget Widget, **100 AI Studio credits/month (1,200/yr)** |
| Professional | $49.99/mo or $399.99/yr ($33.33/mo) | Unlimited watermark-free 4K renders, upload .obj/.fbx/.blend/.stl, 360° panorama & walkthrough, **CAD export**, Specs & Docs, Price Estimator, branded profile, **1,000 AI credits/month (12,000/yr)** |
| Enterprise | Custom | White-label planner, own catalog, product configurator, APIs (cart/CRM/ERP) |

- App Store in-app purchases (P06): $7.99 weekly, $9.99/mo (description), $19.99 monthly "House design", $29.99–$119.99 yearly variants, $6.99 "full catalog for 30 days", $15.99 "full catalog 1 year", PRO $399.99/yr. **Prices differ by platform and region** (P03h).
- Trials (P03h): 3-day yearly Premium trial (iOS, macOS); 7-day PRO trial (Web, iOS, Android, Windows); one trial per person; **no partial or full refunds** per refund policy.
- INR prices on Google Play: **UNKNOWN** (the listing shows only "In-app purchases"; the price list needs a signed-in Indian device).
- AI credits (P02, P03l): image, video and Agent generation draw on one balance. "100 credits can create about 50 Nano Banana 2 images at 1K or about 12 standard five-second AI video clips". Credits **expire every 30 days**.
- Models named on the pricing page (P02): Nano Banana 1/2, GPT Image 1.5/2, Seedream 5 Lite; video: Seedance, FLUX 3, Kling, Veo 3.1, Luma Ray 2; editing: FLUX Fill Pro, Fast Inpaint, Real-ESRGAN. **Planner 5D resells third-party generative models** inside its own workflow.
- Terms (P04): personal accounts may use designs and watermarked renders only for **non-commercial** purposes; commercial use needs a commercial account.

### 1.2 Technology hints (all INFERRED)
- **Android app is native.** The current Android Team Lead job asks for Kotlin/Java and "2D/3D graphics (Canvas, OpenGL, Vulkan, or Google Filament)", and mentions "CRDT" (P07). → Planner 5D does **not** appear to use a WebView for its Android 3D. The round-1 Three.js job ad now returns 404.
- **The data model is probably room-centric, not a shared wall graph.** Evidence:
  - Help says "always create each room separately… Do not create one big space… That leads to layer conflicts" (P03, adding-a-room-web).
  - Walls have "join points" that must be "stacked on top of each other" to avoid textures showing through (P03t).
  - A user review says "When you abut 2 rooms to have a common wall, you cannot work with the common wall segment as a single wall" (P06 review).
  - Changing thickness on a room changes "all walls in a room" (P03u).

  → Our proposed **shared-wall graph** (Doc 4) addresses a weakness that Planner 5D users report.
- **Sync is last-write-wins with no server history.** P03c says "The most recent local version replaces older versions… we do not store previous versions". Android alone has a History tab (P03e).
- **The iOS app is very large (963 MB)**, likely because assets are bundled (INFERRED). Our plan streams assets (NFR-005).

---

## 2. Feature inventory (behavioural, per prompt §3)

Columns condensed: **Status** · **How it behaves in Planner 5D** (interaction, inputs → outputs, controls, platform limits) · **Edge cases / limits observed** · **Our approach (PROPOSED) & difficulty 1–10** · **Our acceptance (PRD/test IDs)**.

### 2.1 Floor planning

| ID | Feature | Status | Planner 5D behaviour | Edge cases / limits | Our approach · difficulty | Acceptance |
|---|---|---|---|---|---|---|
| R-FP-01 | Room creation & wall drawing | VERIFIED P03 (adding-a-room-web, partition-wall) | Predefined room shapes or a pencil tool: tap each corner and close on the first point; the pencil can split a room or draw a partition wall (double-click ends it). Drag a wall or type a length to resize | Help warns against rooms-inside-rooms ("layer conflicts"). Round walls need a workaround: split a wall many times (P03s) | Shared wall graph with automatic room detection (Doc 4 §2) · 8 | PRD-FR-002, FR-005, FR-006; GEO-01..03 |
| R-FP-02 | Precise dimensions | VERIFIED P03u, changing-dimensions-web | Select an object and type W/D/H in the bottom bar; room-level thickness applies to all of its walls; the ruler tool measures; "Object Distance" setting shows gaps | Older article ties dimension changes to Premium/PRO; newer one allows editing **free** items' dimensions on Basic (P03h) — policy changed over time | Integer-mm model, numeric panel · 4 | FR-004, FR-012; GEO-06, GEO-10 |
| R-FP-03 | Single wall vs whole room | VERIFIED P03u | Selecting a room applies thickness to all its walls; selecting a wall changes one wall | — | Same, via commands on wall set · 3 | FR-007 |
| R-FP-04 | Units | VERIFIED P06 ("Switch between Metric and Imperial") | Toggle | — | Metric default (India) · 2 | FR-012 |
| R-FP-05 | Multiple floors | VERIFIED P03b | Floor menu; **Web up to 6 floors, apps up to 3**; 6-floor projects don't sync to the apps (Windows excepted); upper floor based on highest point of floor below | Cross-platform mismatch | Floors with elevation (Doc 5) · 6 | FR-026; SYNC-08 |
| R-FP-06 | Ceiling height per room | VERIFIED P03 (adjusting-ceiling-height-web) | Per room only; "pick each room… one by one" | No bulk edit | Room property + "apply to all rooms" action · 2 | FR-037 |
| R-FP-07 | Doors & windows | VERIFIED P03 (how-to-add-windows, changing-dimensions) | Catalog items dropped on walls; width editable | App Store review: "A door's representation in 2D and 3D often do not match" (OBSERVED P06) | Wall-hosted parametric openings, holes from the same geometry in 2D/3D (Doc 4 §2.8, §3.3) · 6 | FR-008/009; GEO-07/08, SYNC-03 |
| R-FP-08 | Stairs, roofs, terrain | VERIFIED P03s | Stairs: place the object, then on the floor above draw a small room and switch its floor **off** (manual workaround). Roofs: catalog objects you resize manually ("Magic Cube" for custom parts). Terraces/balconies/facades: articles exist | Review: stairs through ceilings render as if the ceiling is transparent (P06) | Stairs = Could (FR-027); roofs excluded v1 · 8 | FR-027; GEO-12 |
| R-FP-09 | Undo/redo | VERIFIED P03r | Ctrl/Cmd+Z, system menu (macOS article) | Redo not documented | Patch-based undo/redo · 5 | FR-011; SYNC-06 |
| R-FP-10 | Floor plan upload (AI recognition) | VERIFIED P03f, P03g | **Paid plans only.** Formats: JPG/PNG/PDF/DWG/DXF and more; one floor per image; perspective photos, hand sketches and "artistic" plans are **not supported**; web supports multi-page PDF with a floor assigned per page; **10 min – 24 h** processing with an email when done; cannot be cancelled by the user once started | Long processing time + B2B page mentioning designer review (round 1) ⇒ likely human-in-the-loop (INFERRED) | Doc 6: CV + human-correction screen · 9 | FR-031; AI-01..05 |
| R-FP-11 | Grid & snapping | VERIFIED P03 (grid-scale-web, align-objects-android) | Web grid: large square 0.5 m, small 0.1 m; Android: "Snap to points", "Snap to rulers" toggles | No snap-to-wall documented | Adaptive grid + priority snapping (Doc 4 §2.9) · 5 | FR-003; GEO-05 |
| R-FP-12 | Home Scan (video → plan) | VERIFIED P03o | Phone video of the room → processed 2D/3D plan. Basic scan: walls/doors and generic furniture; Full scan: catalog-matched furniture, **sockets, AC units**, textures; credits-based | Processing time not stated in the read excerpt | Excluded v1 (needs CV/LiDAR pipeline) · 10 | — |

### 2.2 Interior design

| ID | Feature | Status | Behaviour | Edge cases | Our approach · difficulty | Acceptance |
|---|---|---|---|---|---|---|
| R-ID-01 | Furniture catalog | VERIFIED P01/P02/P06 | 6.7K–10K+ items (inconsistent counts); free subset per platform; search; image search (AI Studio) | Free users complain items are locked (P05 reviews) | ~100 licensed items at MVP · 6 (mostly assets/licensing) | FR-014; AST-01..03 |
| R-ID-02 | Place / move | VERIFIED P03 (catalogue-menu-web) | Click or drag from the catalog; editable in 2D and 3D | "levitating objects" articles exist (objects floating) | Floor-snapped by default · 4 | FR-015 |
| R-ID-03 | Resize furniture | VERIFIED P03h | Basic: free items' dimensions editable; Premium: all items | — | W/D/H fields · 3 | FR-016 |
| R-ID-04 | Materials/textures/colours | VERIFIED P03h, P06 | 600+ colours/textures in free; custom texture upload "without limits" (Basic); copy texture from object (web) | Texture conflicts at misaligned wall joins (P03t) | Material library + per-side wall paint · 4 | FR-018 |
| R-ID-05 | Upload own 3D models | VERIFIED P02, P03u | Premium: from image/URL; PRO: .obj/.fbx/.blend/.stl; conversion up to 15 min | Texture support depends on the model | Excluded v1 · 7 | — |
| R-ID-06 | Budget widget / price estimator | VERIFIED P02 | Premium budget widget; PRO price estimator | — | **Electrical BOQ list (FR-034)** is our analogue · 4 | FR-034 |
| R-ID-07 | Collision, grouping, alignment, lock | VERIFIED P03q | Grouping **web only**; Lock Furniture **web only**; align via snapping (Android); "3-axis rotation", "slant items"; hide objects | Platform gaps; review asks for "layering/stacking order" and "rotate a whole room" | Multi-select, group, lock in shared core (all platforms same code) · 5 | FR-017, FR-036, FR-043 |
| R-ID-08 | Item search by text/image | VERIFIED P03 (search-for-items-using-an-image) | AI Studio image search; text search | — | Text search only v1 · 2 | FR-014 |
| R-ID-09 | Electrical items | VERIFIED P03a | "does not support creating full electrical layouts… can't design electrical wiring, cables, or connections"; you **can place** "Power sockets, Light switches, Other electrical fixtures" | — | Our differentiator must go beyond placing symbols (see §2.6) · 5 | FR-034 |

### 2.3 3D visualization

| ID | Feature | Status | Behaviour | Edge cases | Our approach · difficulty | Acceptance |
|---|---|---|---|---|---|---|
| R-3D-01 | 2D↔3D switch | VERIFIED P03 (how-to-use-3d-mode) | Toggle on web, 3D button on iOS; editable in 3D | Old review: crash/black screen when switching (since fixed, per the same reviewer) | Single model, two views (Doc 4 §4) · 7 | FR-019; SYNC-* |
| R-3D-02 | Camera & first person | VERIFIED P03r | Left-drag rotate, right-drag pan, wheel zoom, **WASD** walk, +/− height; eye-level by zooming in | Collision behaviour UNKNOWN | Orbit + walk with 2D collision · 6 | FR-020/021; REN-04/05 |
| R-3D-03 | Renders | VERIFIED P03p | Draft 1–2 min (no slot used), HD 2–15 min, Full HD/QHD (web) ~30 min, 4K ~30 min, 360° panorama/walkthrough 30 min–24 h; queued; server-side | Long queues; render slots by plan | **Excluded v1**; in-app 3D screenshot only (cost) · 9 | FR-025; FR-041 (Won't) |
| R-3D-04 | Graphics quality setting | VERIFIED P03u (Windows) | Low/Medium/High | — | Auto quality tiers + manual override · 4 | NFR-002, REN-03 |
| R-3D-05 | AR | VERIFIED P06, P05 | "AR Room visualization", AR try-on (iOS), wallpaper try-on | — | Excluded v1 · 8 | — |

### 2.4 AI features

| ID | Feature | Status | Behaviour | Our note |
|---|---|---|---|---|
| R-AI-01 | AI floor-plan recognition | VERIFIED P03f/g, P02 | Paid; 10 min–24 h; image/PDF/DWG; editable 3D result | Structural AI; slow ⇒ likely human QA (INFERRED) |
| R-AI-02 | AI Studio (visual) | VERIFIED P02, P03l | Canvas workspace: improve render, edit image, swap material, generate/clean floor-plan **images**, inpaint, upscale, populate people, video; Compose & Agent modes; credits | Visual AI built on **third-party models** (P02 list) |
| R-AI-03 | Smart Wizard | VERIFIED P03n | Pick room shape, size, type and style → furnished room; Web, iOS, Android | Structural, rule/template-based (INFERRED) |
| R-AI-04 | AI Designer (magic wand) | VERIFIED P03 (ai-designer-design-with-ai-web) | Choose a room → room type + style → shuffle results → "Save Result" | Furnishes existing room — structural |
| R-AI-05 | **Copilot** | VERIFIED P03m | Text instructions **create or restyle an editable project** ("Create a two-story house with three bedrooms…"); shows a description of changes and previews; separate paid credits | Natural-language structural editing **exists in a competitor** — reduces novelty of our FR-033 |
| R-AI-06 | Home Scan | VERIFIED P03o | Video → plan, credits | Excluded for us |

### 2.5 Project management

| ID | Feature | Status | Behaviour | Our note |
|---|---|---|---|---|
| R-PM-01 | Cloud sync | VERIFIED P03c | Same account, online; **most recent local version replaces older**; warns that the same project open on two devices may lose changes; **no previous versions stored** | Our conflicted-copy design (ADR-016) is a real improvement |
| R-PM-02 | Offline | VERIFIED P03d | Offline edits sync on reconnect; can be overwritten; **projects created without an account cannot be saved/restored** | Our local-first storage works without an account |
| R-PM-03 | Collaboration | VERIFIED P02 vs P03k (**conflict**) | Pricing page: every plan, including Free, has shared editing and real-time work. Help: live collaboration on **Web and iOS**; shared links **view-only by default**; editing via share "soon" on web; comments; Spaces | Excluded v1 (FR-040) |
| R-PM-04 | Version history | VERIFIED P03e | **Android only** (History tab by date); not on Web/iOS/Windows/macOS | We plan versions on all platforms (FR-023) |
| R-PM-05 | Export | VERIFIED P03i/j | **PDF report for all plans** (home report, blueprint, 2D plan, renders, elevation); DWG/DXF **PRO only, 2D only** | Our PDF = Premium (revisit: competitor gives PDF free — see PRD §15) |
| R-PM-06 | Projects | VERIFIED P02 | Unlimited projects on Free; folders/Spaces; duplicate; merge projects | Same |
| R-PM-07 | Account deletion | VERIFIED P03u | In-app (web/Android) and other platforms; data deleted within 30 days; subscription must be cancelled separately | Matches Play policy (V05) |

### 2.6 Electrical planning — the competitive picture (important correction)

| Product | What it does with electrical | Source |
|---|---|---|
| Planner 5D | Place sockets/switches/fixtures as objects; **no wiring/circuits** | VERIFIED P03a |
| Homestyler | **Plumbing & Electrical tool**: place panels, **Auto Layout** generates circuits/pipes, manual editing, 3D diagram; in Pro+ ($6.8/mo) | VERIFIED C03; tool behaviour from official forum guide C04 (via search) |
| Electrical House Wiring (Aink Studio, Play) | Learning app: Indian-style diagrams (MCB/RCCB/DB, inverter, geyser), calculators; **not a floor-plan tool** | OBSERVED C06 (1 L+ installs, ★4.48) |
| ArcSite, magicplan | Professional field drawing/estimating apps (paid, global) | OBSERVED C06 |
| India-specific "house plan + electrical points + BOQ" app in Hindi | **Not found** in Play searches for "house wiring plan", "electrical floor plan", "ghar ka naksha" | OBSERVED C06 (absence in search results is not proof of absence) |

**Implication (PROPOSED):** "electrical layer" alone is **not** unique. Our positioning has to be specific:
- Indian conventions: modular switch boards (e.g. 6/8/12-module), fan/light/socket/AC/geyser/inverter points, DB/MCB.
- Points list → **bill of quantities priced from Raghvendr's shop**.
- Hindi UI.
- Works on cheap phones.
- No auto-routing or load calculation in v1, for liability reasons (Doc 4 §6).

---

## 3. Competitive benchmark (official pages + Google Play India, 2026-10-11)

### 3.1 Google Play India snapshot (OBSERVED C06/P05)

| App | Developer | ★ | Ratings | Installs | Updated |
|---|---|---|---|---|---|
| Planner 5D | Planner 5D | 4.27 | 582,492 | 5 Cr+ | 7 Oct 2026 |
| Home Planner AI / Room Planner | Room Planner Ltd | 4.37 | 240,744 | 1 Cr+ | 8 Oct 2026 |
| Floor Plan Creator | Marcin Lewandowski | 4.12 | 132,569 | 1 Cr+ | 25 Aug 2026 |
| magicplan | Sensopia | 4.34 | 128,128 | 1 Cr+ | 6 Oct 2026 |
| Homestyler | HomestylerApp | 3.42 | 91,296 | 1 Cr+ | 27 Aug 2026 |
| Home Design 3D | HOME DESIGN 3D SRL | 4.01 | 46,935 | 1 Cr+ | 17 Sep 2026 |
| HomeByMe | Dassault Systèmes | 4.31 | 26,060 | 10 L+ | 29 Sep 2026 |
| Live Home 3D | Belight Software | 4.30 | 2,345 | 10 L+ | 10 Oct 2026 |
| Sweet Home 3D (mobile) | AI Photo Editor Lab srl | 3.63 | 2,693 | 5 L+ | 25 Nov 2025 |
| ArcSite | ArcSite | 4.55 | 2,960 | 5 L+ | 24 Sep 2026 |
| Shree Naksha Ghar (Indian) | nakshaghar.in | 4.42 | 223 | 50K+ | 9 Sep 2025 |
| Electrical House Wiring (learning) | Aink Studio | 4.48 | 825 | 1 L+ | 13 Aug 2026 |

Notes:
- Room Planner advertises **Asian Paints** colours (OBSERVED), an Indian brand tie-up model worth copying with local brands.
- Planner 5D Play reviews from Indian users complain about features moving behind the paywall. They also say Planner 5D **used to let users unlock furniture by watching ads, for 72 hours** (OBSERVED P05 review, 2020, with a developer reply) — evidence for a rewarded-ads unlock model.

### 3.2 Capability & pricing comparison

| Product | Platforms | 2D/3D | AI | Electrical | Pricing (source) | Export |
|---|---|---|---|---|---|---|
| Planner 5D | Web, iOS, Android, Win, Mac, visionOS | Live 2D/3D, renders server-side | Recognition, AI Studio, Smart Wizard, AI Designer, **Copilot**, Home Scan | Place sockets/switches only | Free / $19.99 / $49.99 mo (P02) | PDF all; DWG/DXF PRO |
| RoomSketcher | Web, apps | 2D/3D, live 3D, 360 | 1 free AI floor-plan conversion, AI render | Not found | Free; Pro $24/mo or $144/yr; Team $70/mo or $420/yr; credits (C02) | Print to scale |
| Floorplanner | Web | 2D/3D | Not found on pricing page | Not found | Free (5 projects, 3 floors, SD watermark); credits $8.15/5 … $163/100; subscriptions **not captured** (C01) | SD→8K images |
| Homestyler | Web, apps | 2D/3D, renders | AI tools, 180–380 AI credits/mo | **Auto circuit & pipe layout** | Free; Pro+ $6.8/mo; Master+ $11.8/mo; Team $19.6/seat (C03) | Renders, panoramas |
| HomeByMe | Web, apps | 2D/3D, realistic images | Not verified | Not found | Official page not captured; aggregator: Starter free, paid tiers via sales (C07) | — |
| Live Home 3D | Win, Mac, iOS, Android | 2D/3D | Not verified | Not found | Official page not captured; aggregator: Standard $5.99/mo or $19.99/yr, Pro $14.99/mo or $39.99/yr; lifetime options (C07) | — |
| Sweet Home 3D | Desktop (Java), JS, mobile | 2D/3D | No | No | Free (GPL); catalog models OK for commercial use (C05) | OBJ etc. |
| blueprint3d | Web library | 2D/3D (Three.js) | No | No | **MIT** (V10) — reading reference | — |

Performance comparison between products: **not measured** (would need the same test project on the same devices; see Doc 8 §6 device list).

### 3.3 Minimum genuinely useful product (unchanged conclusion, stronger evidence)
Draw → rooms with real dimensions → doors/windows → furniture → 3D → save/share/export. Every competitor has this core. Paid differentiators across the market are catalog size, renders and AI. Planner 5D's documented weak spots are where a small team can compete:
- Sync overwrite with no history.
- Shared-wall editing problems.
- Mismatches between 2D and 3D.
- Platform feature gaps (grouping and lock are web-only).
- Paywall frustration.
- No Hindi.

---

## 4. Most technically risky assumptions (updated)

| # | Assumption | Update from round 2 | Validation |
|---|---|---|---|
| RISK-01 | Wall graph stays correct under edits | Planner 5D users report shared-wall and join problems (P03t, P06) ⇒ hard **and** valuable | Doc 8 GEO-* |
| RISK-02 | Three.js in Android WebView is fast enough | **Raised**: market leader appears to use native OpenGL/Vulkan/Filament on Android (P07); only anecdotal WebView-vs-Chrome reports found (source log) | Phase 0 benchmark on named devices (Doc 8 §6); fallback ADR-007 |
| RISK-03 | Legal, optimized catalog | Sweet Home 3D catalog and blueprint3d confirmed usable/MIT (C05, V10); per-item checks still needed | AST-01 |
| RISK-04 | AI recognition accurate & editable | Planner 5D takes 10 min–24 h and rejects sketches/perspective photos (P03f) ⇒ even the leader limits inputs; **CubiCasa5K is non-commercial (CC BY-NC 4.0)** ⇒ can't train a commercial model on it | Doc 6 gates |
| RISK-05 | AI cost vs revenue | Official prices now verified (V07–V09); Planner 5D gates AI with expiring credits | Doc 9 §3 |
| RISK-06 | WebGL context loss | unchanged | REN-07 |
| RISK-07 | Beginner maintaining AI-written geometry code | unchanged | Doc 7 §4 |
| RISK-08 | Differentiation | **New**: electrical "points on plan" exists (Planner 5D objects; Homestyler auto circuits) and NL editing exists (Copilot) | Customer interviews before building FR-034 beyond Phase 2 |

---

## 5. Uncertainty register (round 2 status)

| ID | Question | Status 2026-10-11 |
|---|---|---|
| U-01 | Free catalog size | **Partly resolved**: official pages disagree (50% vs 150+); free set differs by platform (P03h) |
| U-02 | Stairs/roof/terrain | **Resolved**: stairs via floor-hole workaround; roofs = catalog objects; terraces/balconies/facades have guides (P03s) |
| U-03 | Version history | **Resolved**: Android only (P03e) |
| U-04 | Play rating/installs | **Resolved**: §1 (P05) |
| U-05 | Mobile rendering tech | **Partly**: Android native graphics stack INFERRED from job ad (P07) |
| U-06 | INR prices | **Open** — needs a signed-in Indian Android device |
| U-07 | blueprint3d license | **Resolved: MIT** (V10) |
| U-08 | CubiCasa5K license | **Resolved: CC BY-NC 4.0 — no commercial use** (V10) |
| U-09 | Collision/snapping | **Partly**: snapping options documented (Android); 3D collision still UNKNOWN |
| U-10 | Floorplanner subscription prices | **Open** (JS-rendered) |
| U-11 | HomeByMe / Live Home 3D official pricing | **Open** (official pages 404 for the URLs tried) |
| U-12 | AdMob eCPM for India | **Open** — only unofficial ranges |
| U-13 | Planner 5D web 3D engine today | **Open** — not identifiable from the public page shell; not pursued further (no reverse engineering) |
| U-14 | Video tutorials, release notes | Release notes on App Store are generic ("Speed and functionality improvements"); tutorials not reviewed (help videos exist) — **low value, left open** |

## 6. Corrections to round 1

| Round-1 statement | Round-2 finding |
|---|---|
| "None of the competitors advertise electrical layout" | **Wrong.** Homestyler has auto circuit layout; Planner 5D lets users place sockets and switches (§2.6) |
| Collaboration "view-only by default, fuller on web" | Partly right. Help: live collaboration on **Web and iOS**; pricing page claims shared editing on every plan (conflict noted) |
| "Planner 5D uses Three.js" (job ad) | That ad is gone (404). The current Android job points to native OpenGL/Vulkan/Filament. The web engine is unknown |
| "100M users not found" | Found as a company claim on official pages (100M+/120M+), not audited |
| Floors: "3-floor limit may be outdated" | Current: web 6, apps 3 |
| AI recognition "1–3 min (B2B)" | Consumer help says **10 min–24 h** |
| Play fee "15% (verify)" | **Confirmed 15%** for subscriptions in India; 11% with alternative billing (V03) |
| Tester rule "12 testers / 14 days (verify)" | **Confirmed** for personal accounts created after 13 Nov 2023 (V04) |
| CubiCasa license "unknown" | **Non-commercial** |
| blueprint3d license "believed MIT" | **MIT confirmed** |
