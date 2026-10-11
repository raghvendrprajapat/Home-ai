# Source log (round 2, live access)

All sources below were **opened directly** on **2026-10-11** (HTTP 200 unless noted) after internet access was enabled. Quotes in Doc 1 come from these pages. Round-1 sources (search snippets, 2026-10-10) are preserved in git history (commit `1874268`, `docs/01-research-report.md` §5); every round-1 claim was rechecked against the sources below.

## Planner 5D (official)

| ID | URL | Used for |
|---|---|---|
| P01 | https://planner5d.com/ | Claims: "100M+ homeowners and pros … over 540M homes"; "more than 8,000 items"; feature list (AI floor-plan recognition, 360° walkthrough, mood boards, import 3D models, shopping list, Apple Vision Pro) |
| P02 | https://planner5d.com/pricing | Plans and prices (Free/Premium/Professional/Enterprise), AI Studio credits and models, collaboration claim, trials, "Trusted by 120M+" |
| P03 | https://support.planner5d.com/en/ (+ 12 collections, 38 sub-collections, **246 articles** downloaded) | Feature behaviour. Key articles listed below |
| P03a | …/articles/13443446-can-i-create-an-electrical-layout-in-planner-5d | No wiring/circuits; sockets and switches can be placed |
| P03b | …/articles/16475679-how-to-create-a-new-floor | Web up to 6 floors, apps up to 3 (Windows shows 6) |
| P03c | …/articles/5876734-how-to-synchronize-projects-across-devices | "most recent local version replaces older versions"; no stored previous versions |
| P03d | …/articles/15156440-how-to-save-projects | Online-only saving, offline changes overwrite risk, no-account projects not restorable |
| P03e | …/articles/13228894-how-to-restore-project-to-previous-version-ios ; …/9945382-explore-project-history-android | Version history only on Android |
| P03f | …/articles/14434484-how-to-upload-a-floor-plan | Paid-only, formats, do/don't, **10 min–24 h** processing |
| P03g | …/articles/7871003-halting-the-plan-digitalization-process-ios | Recognition cannot be cancelled by user once started |
| P03h | …/articles/15128965-planner-5d-subscription-types | Basic/Premium/PRO, trials (3-day yearly Premium on iOS/macOS; 7-day PRO), free-item customisation, no refunds |
| P03i | …/articles/9582739-export-projects-in-dwg-or-dxf-formats | PRO only, 2D only |
| P03j | …/articles/16527164-how-to-export-to-pdf | PDF report for Free/Premium/PRO |
| P03k | …/articles/14602018-how-to-use-live-collaboration-tool ; …/15116256-how-to-share-projects | Live collaboration on Web and iOS; shares view-only by default |
| P03l | …/articles/15458561-about-ai-studio ; …/15501753-how-to-generate-a-floor-plan ; …/15502159-how-to-use-populate-tool | AI Studio tools, credits (100 Premium / 1,000 PRO monthly; expire every 30 days) |
| P03m | …/articles/17139826-how-to-use-copilot-for-projects-on-web | Copilot: text instructions create/restyle **editable projects**, paid credits |
| P03n | …/articles/16127121-how-to-use-smart-wizard | Shape/size/type/style → furnished room; Web, iOS, Android |
| P03o | …/articles/16109431-about-home-scan | Video scan → 2D/3D plan; Basic vs Full scan (Full detects sockets, AC units) |
| P03p | …/articles/16964235-about-render-processing-times | Draft 1–2 min, HD 2–15 min, 4K ~30 min, 360° up to 24 h, queued |
| P03q | …/articles/16881159-how-to-lock-furniture ; …/7210732-power-of-grouping… ; …/13044756-how-to-align-objects-android | Lock (web only), grouping (web only), snap to points/rulers (Android) |
| P03r | …/articles/9112709-useful-keyboard-shortcuts-web ; …/5903546-undo-the-latest-action ; …/13161059-3d-navigation-and-camera-controls-web | Controls, WASD, undo |
| P03s | …/articles/8015474-placing-stairs-between-two-floors-windows ; …/8047181-adding-a-roof-ios ; …/8066505-creating-a-round-wall-ios | Stairs need floor-hole workaround; roofs are catalog objects; round walls by splitting |
| P03t | …/articles/8069478-exterior-walls-showing-through-the-internal-walls | Wall "join points"; texture conflicts when walls are misaligned |
| P03u | …/articles/15701690-how-to-change-wall-thickness ; …/8898710-distance-between-objects-web ; …/5922866-how-to-delete-an-account ; …/8123331-unlocking-premium-perks-on-a-free-plan-ios ; …/9942428-how-to-import-3d-models-on-web ; …/15189751-planner-5d-b2b-api-technical-overview ; …/8600481-setting-graphics-quality-windows | Misc. behaviours as cited in Doc 1 |
| P04 | https://planner5d.com/pages/terms/ | Personal accounts: non-commercial use, watermarked renders; commercial accounts: commercial use |
| P05 | https://play.google.com/store/apps/details?id=com.planner5d.planner5d&hl=en_IN&gl=IN | Rating 4.27 (582,492 ratings), 5 Cr+ downloads, updated 7 Oct 2026, "#5 top grossing house & home", description "more than 6,723 elements", data-safety summary, sample reviews |
| P06 | https://apps.apple.com/us/app/planner-5d-interior-design/id606173978 | 4.4 (42K ratings), v5.11.1, 963.4 MB, iOS 17+, 24 languages (no Hindi), IAP list, App Privacy, reviews |
| P07 | https://jobs.lever.co/planner5d (and job 323ec23b-…) | Android Team Lead: Kotlin/Java; "2D/3D graphics (Canvas, OpenGL, Vulkan, or Google Filament)"; mentions "CRDT". Round-1 Three.js job ad (794488a5-…) now returns **404** |
| P08 | https://planner5d.com/editor (page shell only) | jQuery-based web shell; 3D engine not identifiable from public shell (not investigated further) |

## Competitors (official pages / Play)

| ID | URL | Used for |
|---|---|---|
| C01 | https://floorplanner.com/pricing | Free: 5 projects, 3 floors, SD watermarked exports; credits $8.15 per 5 … $163 per 100. Subscription prices are rendered by JavaScript and were **not captured** |
| C02 | https://www.roomsketcher.com/pricing/ | Free (2 credits, 1 AI floor-plan conversion), Pro $24/mo or $144/yr, Team $70/mo or $420/yr |
| C03 | https://www.homestyler.com/pricing | Free (unlimited 1K renders), Pro+ $6.8/mo (incl. "plumbing & electricity", parametric stairs/roofs, 180 AI credits), Master+ $11.8/mo, Team $19.6/seat/mo |
| C04 | https://es.homestyler.com/forum/view/1854685667502432257 (via search) | Homestyler Plumbing & Electrical tool: auto layout of circuits/pipes after placing panels; manual mode; 3D diagram |
| C05 | https://www.sweethome3d.com/license/ | GPL app; default catalog models/textures usable commercially; GPL forbids proprietary derivatives |
| C06 | Google Play listings (hl=en_IN, gl=IN) for Homestyler, Live Home 3D, Sweet Home 3D, HomeByMe, Home Design 3D, Floor Plan Creator, Room Planner (icandesignapp), magicplan, ArcSite, JoyPlan, Draw Floor Plan, Shree Naksha Ghar, Electrical House Wiring, others | Ratings, installs, last update (table in Doc 1 §2) |
| C07 | HomeByMe and Live Home 3D official pricing pages | **Not captured** (HomeByMe /en/pricing 404; livehome3d.com/buy 404). Third-party figures kept, labelled |

## Vendors, policies, licenses

| ID | URL | Used for |
|---|---|---|
| V01 | https://supabase.com/pricing | Free: 50k MAU, 500 MB DB, 1 GB files, 5 GB egress, **paused after 1 week inactivity**, 2 projects. Pro $25/mo: 100k MAU then $0.00325, 8 GB disk then $0.125/GB, 250 GB egress then $0.09/GB, 100 GB files then $0.0213/GB, daily backups 7 days, $10 compute credit. Team $599 |
| V02 | https://developers.cloudflare.com/r2/pricing/ | Standard $0.015/GB-month; Class A $4.50/M; Class B $0.36/M; egress free |
| V03 | https://support.google.com/googleplay/android-developer/answer/112622 | Service fees: remaining markets (incl. India) **15% for auto-renewing subscriptions**; alternative billing in India = Play fee **minus 4%**; new 10%/20% structure only in EEA/UK/US (30 Jun 2026) and AU/JP (30 Sep 2026) |
| V04 | https://support.google.com/googleplay/android-developer/answer/14151465 | Personal accounts created after 13 Nov 2023: closed test, **≥12 testers opted in continuously for 14 days** |
| V05 | https://support.google.com/googleplay/android-developer/answer/13327111 | Account deletion: in-app path **and** web link; Data safety deletion questions |
| V06 | https://support.google.com/googleplay/android-developer/answer/9858738 | Payments policy: Play Billing for digital goods; alternative billing in eligible regions |
| V07 | https://ai.google.dev/gemini-api/docs/pricing | Nano Banana 2.1 images: $0.0336 (1K) / $0.0504 (2K) / $0.113 (4K) per image standard; half on Batch. Older Flash Image $0.039/1K image |
| V08 | https://platform.openai.com/docs/pricing | gpt-image models priced per 1M tokens (e.g. gpt-image-2 image output $15/M); per-image cost needs their calculator — **not converted here** |
| V09 | https://docs.anthropic.com/en/docs/about-claude/pricing | Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50 (≤100K prompt), Opus 5.5 $4/$20 per M tokens |
| V10 | raw LICENSE files on GitHub / npm registry | three.js MIT (npm 0.186.1); blueprint3d MIT; Capacitor MIT (npm 8.5.3); earcut ISC; Immer MIT; Zustand MIT; fast-check MIT; glTF-Transform MIT (npm 4.5.1); OpenCV Apache-2.0; Tesseract Apache-2.0; SAM 2 Apache-2.0; RT-DETR Apache-2.0; **Ultralytics AGPL-3.0**; **CubiCasa5K CC BY-NC 4.0** |

## Secondary sources (labelled as such where used)
- AdMob India eCPM: only vendor blogs/forums found (banner roughly $0.10–1.00; anecdote $0.08 banner / $0.70 interstitial). **No official figure.**
- Android WebView vs Chrome WebGL: forum anecdotes only (Babylon.js forum, Khadas forum). **No benchmark.**
- Indian smartphone market: IDC Q1 2026 via press (vivo 19.6%, Samsung 17.1%; sub-₹15k segment shrinking). Used only to choose test-device classes.
- Live Home 3D and HomeByMe prices: aggregators (xpay, App Store listing via search).
