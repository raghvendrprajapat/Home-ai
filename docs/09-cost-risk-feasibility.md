> **Superseded (2026-10-11):** the combined Claude + Codex document [`combined-research.md`](combined-research.md) is now the main reference. This file is kept as history. Electrical planning has been removed from the product scope by owner decision.

# Document 9 — Cost, Risk & Feasibility Assessment

Round 2 (2026-10-11): Supabase, Cloudflare R2, Google Play fees, Gemini, OpenAI and Anthropic prices were **read on the official pages** (source log V01–V09). Everything else is an estimate and is labelled as one. Prices change; recheck on the day you buy.

## 1. Fixed costs

| Item | Cost | Basis |
|---|---|---|
| Google Play developer account | already owned | user profile |
| Supabase | **$0 Free** in development (50k MAU, 500 MB DB, 1 GB files, 5 GB egress; **paused after 1 week of inactivity**, max 2 projects) → **$25/mo Pro** at launch (100k MAU, 8 GB disk, 100 GB files, 250 GB egress, daily backups kept 7 days, $10 compute credit covers a Micro instance) | VERIFIED V01 |
| Cloudflare R2 (catalog) | $0.015/GB-month; Class A $4.50/M, Class B $0.36/M requests; **egress free** → catalog of 1–5 GB ≈ $0.02–0.08/mo plus requests | VERIFIED V02 |
| Web hosting (Pages/Netlify) | $0 at this scale | free tiers (estimate; verify limits) |
| Domain | ~$10–15/year | estimate |
| Error monitoring | $0 free tier initially | estimate; verify quotas |
| Claude Code / AI coding tool | your plan | not estimated |

## 1a. One-time and recurring non-infrastructure costs (estimates)

| Line | Estimate | Notes |
|---|---|---|
| Development labour | Your own time: 9–19 months part-time (Doc 7). If hiring help at an assumed ₹1,500–4,000/hour for a freelance web/3D developer, **20–60 hours of expert help ≈ ₹30k–2.4 lakh** | Rate is an assumption, not a quote; get 2–3 quotes |
| Expert reviews | Geometry/3D review after Phase 0 (1–2 days), security review before launch (1 day) ≈ **$500–3,000** total | estimate |
| Test devices | Low + Mid Android (Doc 4 §3.8) ≈ **₹30k–40k** if buying both new; ₹0 if borrowed | price classes from Indian market (estimate) |
| Testing labour | 12 closed testers for 14 days (Play rule, V04) — friends/customers; time cost only | VERIFIED rule |
| 3D assets (100 items) | $0 (CC0 + Sweet Home 3D catalog models, license permits commercial use — C05) up to ~$1,000–3,000 if buying/commissioning | estimate |
| Maintenance | Plan ~15–20% of build effort per year (Android/WebView updates, library upgrades, Play policy changes) | rule of thumb, not data |
| Legal (privacy policy/terms review) | ₹10k–50k one-time if using a lawyer | estimate |

## 2. Variable infrastructure cost by MAU (no AI)

Assumptions:
- 3 projects/user.
- 300 KB gzipped per stored version, 20 versions kept → ≤ 18 MB/user worst case.
- About 5 MB/user/month of project download egress from Supabase.
- Catalog from R2 (free egress), about 200 cached asset requests/user/month.

| MAU | Supabase | R2 | Total / month (est.) | Notes |
|---|---|---|---|---|
| 100 | $0 (Free) — or $25 to avoid pausing | ≈ $0 | **$0–25** | Free plan pauses after 1 week inactivity → not suitable for a live app |
| 1,000 | $25 | ≈ $0.1 | **≈ $25–30** | within Pro quotas |
| 10,000 | $25 + storage over 100 GB (≈ 180 GB worst case → 80 GB × $0.0213 ≈ $2) | ≈ $1 | **≈ $28–40** | prune versions to keep under quota |
| 100,000 | $25 + compute upgrade (Medium $60 − $10 credit) + storage (≈ 1.7 TB × $0.0213 ≈ $36) + egress (≈ 500 GB, 250 GB over × $0.09 ≈ $23) | ≈ $7–10 | **≈ $150–250** | MAU at quota edge (100k included, then $0.00325/MAU) |

**Highest marginal costs:**
1. AI image generation.
2. AI plan recognition with human correction or GPU models.
3. Server rendering (excluded in v1; Planner 5D's 4K/360° renders take 30 min–24 h server time, Doc 1 R-3D-03).
4. Unpruned version history.

## 3. AI cost scenarios (only if Phase 6 ships)
Assumptions (hypothetical, for sizing only):
- 10% of MAU use restyle 3×/month at **$0.134/request**: 4 images × $0.0336 (VERIFIED Nano Banana 2.1 1K price, V07).
- 2% use plan recognition once at ≈ $0.05 (Sonnet 5.5 estimate, Doc 6 §4.1) + CV compute.

| MAU | Restyle | Recognition | Total AI / month |
|---|---|---|---|
| 1,000 | $40 | $1 | ≈ $41 |
| 10,000 | $402 | $10 | ≈ $412 |
| 100,000 | $4,020 | $100 | ≈ $4,120 |

Batch pricing (half price, 24 h turnaround) would roughly halve restyle cost. Planner 5D gates AI with **credits that expire every 30 days** (Doc 1 §1.1); we should do the same. → AI must be credit-gated (Doc 6 §5), never unlimited on a low-price subscription.

## 4. Revenue model comparison (no revenue promised)

| Model | Pros | Cons / evidence |
|---|---|---|
| Ads | Zero friction for free users | India eCPM is low: unofficial sources say banner ≈ $0.10–1.00 (one developer reported $0.08 banner / $0.70 interstitial). **No official figure** → measure in your own AdMob account. Ads inside a design canvas hurt UX |
| Rewarded ad → unlock premium item for 72 h | Proven in this category (Planner 5D used it in 2020 per a Play review) | Revenue per view unknown for India |
| Freemium subscription (recommended core) | Predictable; matches all competitors | Needs clear value: full catalog, multi-floor, no watermark |
| Credits (for AI) | Matches variable cost | Show cost in ₹; credits expire monthly (competitor practice) |
| One-time unlock | Simple for Indian users | No recurring revenue to fund AI/assets |
| Brand tie-ups (e.g. paint/tiles/switch brands) | Room Planner advertises Asian Paints colours (Doc 1 §3.1) | Needs traction first |

Google Play fee for India (VERIFIED V03): **15%** on auto-renewing subscriptions; **11%** if using alternative billing in India.

Break-even formula: `monthly_profit = paying_users × net_price × (1 − 0.15) + ad_revenue − infra − AI_cost − tools`. Do not assume a conversion rate; measure it in closed testing.

## 5. Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| K-01 | Geometry bugs corrupt projects | High | High | Doc 4 invariants, property tests, journal recovery, expert review | Dev |
| K-02 | 3D too slow on Low Android WebView | Medium | High | Phase 0 benchmark, tiers, 2D-first fallback | Dev |
| K-03 | Asset licensing violation | Medium | High | License register + CI (AST-01), only verified sources | Owner |
| K-04 | Beginner can't debug AI-written code | High | High | Small phases, tests as spec, paid expert hours, CLAUDE.md rules | Owner |
| K-05 | AI cost overrun | Medium | Medium | Credits, global daily cap | Dev |
| K-06 | Play policy rejection (data safety, account deletion, billing rules) | Medium | Medium | Checklist Phase 8; read current policies | Owner |
| K-07 | WebView storage cleared → lost local projects | Low–Medium | High | Persistent storage request, filesystem backup, cloud sync, export file | Dev |
| K-08 | Trademark/IP claims (name, look-alike UI) | Low | High | Own name, own UI, no Planner 5D assets/API | Owner |
| K-09 | Market too crowded | Medium | Medium | India focus (Hindi, cheap phones, never-lose-work); validate with users early | Owner |
| K-10 | Scope creep (multiplayer, photoreal) | High | Medium | Explicit exclusions PRD §18 | Owner |

## 5.1 Security, legal & IP summary (Part O)
- **Independent implementation only:** no copying of Planner 5D code, assets, catalog, UI artwork, trademarks; no use of their private/B2B APIs.
- **Open-source licenses:** prefer MIT/Apache/BSD/ISC. **Avoid GPL code (e.g. Sweet Home 3D application code) in the closed-source app.** Sweet Home 3D's *default catalog models/textures* are stated as usable for commercial use (license page) — still record per-item source.
- **Assets:** CC0 preferred; CC-BY needs attribution screen; marketplace assets: check "use in apps/redistribution" — many marketplace licenses forbid redistributing raw model files that users could extract (a GLB in an app is extractable). Read each license.
- **User uploads (v2):** terms must state the user owns/has rights; malware scanning not needed for images but validate type/size.
- **API keys:** only on server (edge functions); Play/AI secrets in Supabase secrets; rotate on leak.
- **Auth/access:** RLS everywhere; signed URLs short-lived.
- **Payments:** Google Play Billing for digital goods in the Android app (Play policy); server verification.
- **AI privacy:** consent, 30-day deletion, provider data-use review.
- **User data deletion:** in-app path **and** a web link, plus the Data safety deletion answers (VERIFIED Play Console Help V05).
- **Third-party model licenses:** avoid AGPL (Ultralytics YOLO) and non-commercial datasets (CubiCasa5K is CC BY-NC 4.0) — Doc 6 §4.0.
- **Competitor IP:** Planner 5D's terms reserve all rights to its software, catalog and materials (P04) — use none of their assets, names or UI artwork.
- **Backups:** managed DB backups + storage versioning.

## 6. Feasibility of each subsystem with Claude Code

| Subsystem | Class | Why |
|---|---|---|
| App shell, project list, settings, i18n | Straightforward with existing libraries | Standard React |
| 2D editor rendering + tools | Feasible, significant custom engineering | Interaction details, touch |
| Geometric constraint engine (normalizer, faces, miters) | **High complexity, high risk** | Edge cases; needs tests + expert review |
| 3D scene generation from model | Feasible, significant custom engineering | Well-documented Three.js |
| Furniture catalog | Requires external assets | Licensing/money |
| Realistic rendering (photoreal) | Not realistic in v1 on mobile | Exclude; use AI restyle instead later |
| Mobile optimization | Feasible but needs real devices + profiling skill | Expert help likely |
| AI plan recognition | High risk + external services | Human correction mandatory |
| AI interior design (images) | Straightforward via APIs, costly | Credit gating |
| Cloud sync (whole-document) | Feasible | Supabase |
| Real-time multiplayer | Not realistic within constraints | Exclude |
| Subscription system | Feasible with plugin/RevenueCat | Must test with license testers |

## 7. Research status (round 2) and what is still needed
Done on 2026-10-11:
- Planner 5D official pages, 246 help articles, Play and App Store listings.
- Competitor pricing pages and Play India stats.
- Vendor prices, Play fee, tester and deletion policies, licenses.

Still needed:
1. **Customer interviews (most important):** 5–10 homeowners and 3–5 small contractors/interior designers.
   - Would a Hindi, phone-first planner that never loses work save them time?
   - What would they pay?
   - What do they use today (paper, WhatsApp photos, AutoCAD via a draftsman)?
2. **INR prices** of Planner 5D, Homestyler and Room Planner subscriptions: open each app's paywall on an Indian phone and screenshot it.
3. **AdMob India eCPM:** no official data exists publicly; measure in your own account with a test app.
4. **Hands-on tests on your phone:** Planner 5D and Homestyler — record what is free vs paid and how smooth 3D is on a cheap phone.
5. Floorplanner subscription prices, and HomeByMe / Live Home 3D official prices (pages not captured).
6. Recheck vendor prices on the day you start paying.

## 8. Final recommendation (Part 22)

**Can a beginner using Claude Code realistically build a useful Planner 5D-inspired app?**
**A narrow version — yes, possibly, but not quickly and not alone.** A full Planner 5D equivalent (10K-item catalog, photoreal 4K renders, AI recognition, collaboration, 5 platforms) is not realistic for one beginner; it is a multi-year, multi-person product.

- **Build first:** Phase 0 proof of concept — wall graph + room detection + live 3D walls with door/window holes + undo + local save, with tests and a benchmark on two real Android phones.
- **Hardest:** the geometry engine's edge cases, and making 3D smooth on cheap phones.
- **Do not attempt initially:** AI recognition, photoreal rendering, collaboration, multi-floor, iOS, user-uploaded models.
- **Libraries:** TypeScript, React, Vite, Three.js, Immer (patches), Zustand, earcut, fast-check, Vitest, Playwright, Capacitor, Supabase, gltf-transform.
- **Effort range:** MVP ≈ 75–115 experienced-engineer days (sum of the Phase 0–5, 7, 8 E-ranges in Doc 7); for a beginner with Claude Code, plan **9–19 months part-time** (sum of the B-ranges), with a budget for **some paid expert review**. These are estimates, not promises.
- **Cash cost to MVP launch (excluding your time):** roughly **$500 to $10,000**, the sum of the §1a lines. The low end is free assets, borrowed phones and one short expert review. The high end is bought assets, both test phones, legal review and ~60 hours of paid developer help (INR amounts converted at an assumed ≈ ₹83/$, not a quoted rate). Monthly infrastructure stays small (≈ $25–40) until tens of thousands of users (§2).
- **Architecture for expansion:** pure-TS canonical model + command bus + read-only renderers (Doc 4 §4) — it lets you add AI, multi-floor, and a future native renderer without rewriting the data model.
- **Commercially viable MVP (hypothesis to validate):** fast accurate 2D plan + 3D view + ~100–300 India-relevant furniture items + PNG/PDF export + honest Premium subscription. Electrical planning was removed from scope by owner decision (2026-10-11). Differentiation to validate: India-first, Hindi, complete editor on cheap phones, never-lose-work saving (shared walls, version history and conflict-safe sync are documented Planner 5D weaknesses).