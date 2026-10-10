# Document 9 — Cost, Risk & Feasibility Assessment

All prices are **estimates from third-party snapshots or stated assumptions** unless marked verified. Re-check official pricing pages (Supabase, Cloudflare, Google Play, AI providers) before committing money.

## 1. Fixed costs (monthly unless noted)

| Item | Estimate | Basis |
|---|---|---|
| Google Play developer account | already owned | user profile |
| Supabase | $0 (Free) during development → ~$25/mo Pro at launch | third-party snapshot of Pro price; Free tier pauses inactive projects (verify) |
| Cloudflare R2 (catalog) | ~$0–2 | ~$0.015/GB-month, zero egress (third-party snapshot); catalog of 100–500 items ≈ 1–5 GB |
| Web hosting (Pages/Netlify) | $0 at this scale | free tiers (verify limits) |
| Domain | ~$10–15/year | typical, estimate |
| Error monitoring (Sentry or similar) | $0 free tier initially | verify quotas |
| Claude Code / AI coding tool | depends on your plan | your Claude plan; not estimated here |
| Test devices (Low + Mid Android) | one-time ~₹10k–25k if not already owned | estimate |
| 3D assets for MVP (100 items) | $0 (CC0/compatible) to ~$1,000–3,000 if buying/commissioning | wide estimate; depends on sourcing |
| Expert review (geometry/3D, security) | ~$500–3,000 one-time for a few days of freelance review | estimate; strongly recommended |

## 2. Variable costs by MAU (infrastructure only, no AI)

Assumptions: 3 projects/user, 300 KB gz per project version, 20 versions kept → ~18 MB/user worst case (most far less); catalog served from R2 (no egress fee); Supabase Pro quotas (third-party: 100k MAU auth, 8 GB DB, 100 GB file storage, ~250 GB egress — verify).

| MAU | Infra / month (est.) | Notes |
|---|---|---|
| 100 | $0–5 | Free tiers |
| 1,000 | ~$25–35 | Supabase Pro to avoid pausing + backups |
| 10,000 | ~$30–80 | Storage may exceed 100 GB if versions not pruned → prune to 20 |
| 100,000 | ~$150–600 | Larger compute add-on, storage/egress overages; still small vs AI |

**Highest marginal cost features:** (1) AI image generation, (2) AI plan recognition with GPU models, (3) server-side rendering (excluded in v1), (4) unpruned version history.

## 3. AI cost scenarios (only if Phase 6 ships)
Assumption (hypothetical, for sizing only): 10% of MAU use restyle 3×/month at ~$0.16/request (4 images at ~$0.04) and 2% use plan recognition once at ~$0.05.

| MAU | Restyle | Recognition | Total AI / month |
|---|---|---|---|
| 1,000 | $48 | $1 | ~$49 |
| 10,000 | $480 | $10 | ~$490 |
| 100,000 | $4,800 | $100 | ~$4,900 |

→ AI must be credit-gated (Doc 6 §5); never unlimited on a low-price subscription.

## 4. Revenue model comparison (no revenue promised)

| Model | Pros | Cons |
|---|---|---|
| Ads only | Zero friction | Low eCPM in India (not researched here — do deep research); ads in a design canvas hurt UX |
| Freemium subscription (recommended core) | Predictable; matches competitors | Requires clear value (catalog, export, multi-floor, electrical) |
| Credits (for AI) | Matches variable cost | Users dislike opaque credits → show cost in ₹ equivalent |
| One-time unlock | Simple for Indian users | No recurring revenue to fund AI/assets |

Recommended: Free + ads on non-editor screens → Premium monthly/yearly → AI credits add-on. Google Play fee: model 15% for subscriptions until India terms are confirmed (Doc 2 §15).

Break-even formula (fill in after research): `monthly_profit = paying_users × net_price × (1 − play_fee) + ad_revenue − infra − AI_cost − tools`. Do not assume a conversion rate; measure it in closed testing.

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
| K-09 | Market too crowded | Medium | Medium | Electrical-layer + India focus differentiation; validate with users early | Owner |
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
- **User data deletion:** in-app + web URL (Play requires a deletion path for apps with accounts — verify current policy text).
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

## 7. Research still needed (tell Raghvendr explicitly)
1. **Deep research (Perplexity Pro):** Indian Play Store demand for home-design apps, top competitors' installs/ratings, user complaints in Hindi reviews.
2. Electrician/contractor interviews (5–10 from your customers): would they use an electrical point planner? What would they pay?
3. AdMob eCPM ranges for India in this category (AdMob/industry reports).
4. Hands-on test of Planner 5D on your phone for the UNKNOWN items (Doc 1 §4).
5. Official pricing pages for Supabase, R2, AI providers on the day you start building.

## 8. Final recommendation (Part 22)

**Can a beginner using Claude Code realistically build a useful Planner 5D-inspired app?**
**A narrow version — yes, possibly, but not quickly and not alone.** A full Planner 5D equivalent (10K-item catalog, photoreal 4K renders, AI recognition, collaboration, 5 platforms) is not realistic for one beginner; it is a multi-year, multi-person product.

- **Build first:** Phase 0 proof of concept — wall graph + room detection + live 3D walls with door/window holes + undo + local save, with tests and a benchmark on two real Android phones.
- **Hardest:** the geometry engine's edge cases, and making 3D smooth on cheap phones.
- **Do not attempt initially:** AI recognition, photoreal rendering, collaboration, multi-floor, iOS, user-uploaded models.
- **Libraries:** TypeScript, React, Vite, Three.js, Immer (patches), Zustand, earcut, fast-check, Vitest, Playwright, Capacitor, Supabase, gltf-transform.
- **Effort range:** MVP ≈ 75–115 experienced-engineer days (sum of the Phase 0–5, 7, 8 E-ranges in Doc 7); for a beginner with Claude Code, plan **9–19 months part-time** (sum of the B-ranges), with a budget for **some paid expert review**. These are estimates, not promises.
- **Cash cost to MVP launch (excluding your time):** roughly **$500–5,000**, dominated by assets and expert help; monthly infra stays small (< $50) until thousands of users.
- **Architecture for expansion:** pure-TS canonical model + command bus + read-only renderers (Doc 4 §4) — it lets you add AI, electrical layer, multi-floor, and a future native renderer without rewriting the data model.
- **Commercially viable MVP (hypothesis to validate):** fast accurate 2D plan + 3D view + ~100–300 India-relevant furniture items + PNG/PDF export + **electrical point planning with a points list** + honest Premium subscription. The electrical layer is the clearest reason someone would choose this over Planner 5D — validate it with your own customers before building beyond Phase 2.
