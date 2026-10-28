# D85/D86/D87 — Room photo visualizer (Phase 1 offline; Phase 2 AI; polish)

Owner, 2026-10-26: after Claude's architecture review the owner said "Okey now do work"; Claude Code is the builder again for this work (Codex does not run concurrently). Goal: after seeing the home in 3D, a customer tries paint, tiles/laminate/wallpaper or wall art on a photo of their **real** room.

Phase 1 (this change) is fully offline and deterministic: no network upload, no backend, no AI call, no new dependency, no cost. Phase 2 (server AI) is a planned design built in a separate task (see below for the owner's decisions).

## Phase 1: what is built

**Entry.** A seventh tool, "Room photo" / "कमरे की फ़ोटो" (`ToolId` `photo`), placed after Materials on the Tools rail. It behaves like the other six (one panel at a time, `region` named after the tool beside the canvas or as a bottom sheet, Escape and Close). The panel has a one-line explanation, the note "Preview only — colours and sizes from one photo are approximate. Check a real sample before buying." and a "Choose room photo" button (`accept="image/*"`). The narrow-phone rail drops its side padding/gaps below 400 px so seven labels keep whole words at 360 px (measured: 51 px buttons, ≥ 48 px).

**Ownership.** `RoomPhotoPanel` receives only the locale, never the store. The visualizer cannot call core-model commands, so architecture rule 1 holds by construction; nothing it creates is saved in the project or in the workspace. Its key handler stops propagation, so Ctrl+Z inside it undoes mask steps and never reaches the editor's window shortcut (drawing Undo); this is checked in a jsdom test and in e2e by comparing the exported project before and after.

**Lazy loading.** `VisualizerView` (engine, mask, view, export helpers) is a separate chunk loaded with `React.lazy` when a photo is chosen: 28.3 kB (10.0 kB gzip). The main `index` chunk grew from 532.89 kB to 536.83 kB (164.70 → 165.88 kB gzip); the build gate's initial JS rose from 239 581 to 243 035 gzip bytes (limit 600 000), mostly the new English+Hindi strings and the panel.

**Photo preparation** (`photo-prep.ts`). Same 15 MB limit as Photo or sketch to plan; non-images, empty files, pictures under 32 px and decoded images above 50 MP are refused with a friendly message. Decoding uses `createImageBitmap(file, {imageOrientation: 'from-image'})` (EXIF rotation applied where supported); the fallback `<img>` decode relies on browsers applying EXIF orientation by default (CSS `image-orientation: from-image`). The photo is drawn **once** into a canvas that fits 1536 px on the long side and 1024 px on the short side, never enlarged; that size is the working size for the mask, the engine and saved images. Re-encoding through a canvas drops EXIF/GPS. The full-size decode (≈ 48 MB for 12 MP) is closed immediately after the downscale.

**Area selection** (`mask.ts`). One alpha byte per working pixel. Brush and Eraser strokes (size slider in screen pixels, converted to photo pixels) have a one-pixel soft edge; "4 corners" fills the tapped quad and also sets the perspective plane (taps in any order are sorted clockwise from the top-left; dented, collinear or tiny shapes are refused). Clear, Undo and Redo replay recorded operations over a baked base; at most 40 undo steps are kept, so memory stays at two masks plus small records. Pointer → pixel mapping (`toPixel`) and the fitted display size (`fitSize`) are pure functions with tests. The mask shows as a half-alpha blue overlay; touch and mouse use the same Pointer Events.

**Materials.** Paint: the existing library paint swatches (`material-library.ts`) or a colour input. Pattern: one uploaded reference photo, or one of the seven shipped surface textures (the D76/D82 colour maps under `textures/<set>/color.jpg`, same-origin app files already used by the 3D view); pattern size (one repeat, in px), a 90° turn, grout lines on/off with grout colour. Picture: one uploaded image placed once into the four-corner quad, perspective-correct. Up to four results can be kept as short-labelled options ("Option A"…), stored as JPEG blobs, not raw pixels.

**Offline engine** (`surface-engine.ts`, the `'stand-in'` provider).
- Only pixels with mask > 0 change; pixels with mask 0 are copied byte for byte, and alpha is never touched (unit + property tests, and e2e pixel reads).
- Light: luminance `(54R + 183G + 19B) >> 8` (a grey keeps its value); reference = lower median luminance of the pixels at least half chosen; shading = luminance ÷ reference clamped to 0.2–1.8; output = material colour × shading, blended by mask alpha at soft edges.
- Paint uses each pixel's own luminance (wall texture shows through like real paint). Patterns and pictures use luminance averaged over chosen pixels within 1 % of the short side (two running-sum passes), so the old floor's grain or wallpaper does not print through while shadows stay.
- Patterns repeat in photo pixels without a quad, or through the quad's homography with the plane scaled to the quad's mean edge lengths. Pictures require the quad. Bilinear sampling (wrap for patterns, clamp for pictures).
- Homography (`homography.ts`): Heckbert's closed-form 4-point mapping square→quad, true inverse, composition and quad→quad; analytic tests (diagonal crossing, symmetric trapezoid, horizon) and fast-check properties (round trip, straight lines stay straight).
- Speed: work only inside the mask's bounding box; the provider renders rows in ~12 ms slices and yields to the UI, and can be cancelled. Measured in Node on this build machine (unit test, 1536×1024, every pixel chosen): paint ≈ 75–110 ms, perspective pattern with grout ≈ 190–250 ms. No phone was measured; a mid phone is expected to be several times slower, so full-frame patterns may approach ~1 s. Real Low/Mid timing remains a pending gate.

**Result.** Before/after compare slider (`role="slider"`, 0–100, arrows ±2, Page keys ±10, Home/End, drag anywhere on the frame) and "Compare options" between two kept options. "Save image": the web saves a JPEG download (`gharplan-room-photo.jpg`); where the browser can share files, "Share image" opens the phone share sheet. The Android app reuses the verified native PNG save of the plan/3D image exports (`exportNativePng`), because the native plugin accepts only checked PNG files; so on Android the saved image is PNG, not JPEG. Saved images carry a small "GharPlan preview · approximate" corner label; the screen shows the clean result. The preview-only note stays visible in the panel and in the visualizer.

**Provider boundary** (`surface-provider.ts`): `SurfaceEditProvider { kind: 'stand-in' | 'server'; render(request, signal): Promise<SurfaceEditResult> }`. The view takes a `provider` prop (default stand-in). D86 adds the `'server'` provider below; the stand-in stays the default.

## Phase 2 (D86): AI previews, as built

Owner decisions (2026-10-26): AI spending is allowed; the whole app may spend at most **US$3 per calendar month (UTC)** on AI (server kill-switch); every signed-in account gets **3 free AI previews per month**; provider **fal.ai** (GPT-Image-2.5 `flare` edit at server-forced `medium` quality, SAM-2 tap-to-select), replacing D76's Gemini for this feature only; consent screen and privacy-policy update; uploads and results deleted after **7 days**. No purchases (billing stays gated). Not signed in → no AI; the offline engine above stays the default and works without any network.

**Money and limits** (`server/supabase/migrations/20261026000000_room_photo_ai.sql`).
- `ai.settings` (one row, only the service role or the owner in the SQL editor can change it): `enabled` (kill switch), `monthly_cap_usd` 3, `free_previews_per_month` 3, `est_edit_usd` **0.08**, `est_segment_usd` **0.01**, `segment_daily_limit` 20. fal bills the edit model by tokens and publishes no per-image price, so each call reserves a deliberately conservative *estimate*; the owner should lower or raise `est_edit_usd` after reading the real cost in fal's usage page (setup guide step 9).
- `ai.jobs` (RLS: a person reads only their own rows; no client writes). The brief's `ai_settings`/`ai_jobs` live in a private `ai` schema: it is not exposed through the REST API, and the existing SEC-009 test pins six tables in `public`.
- `reserve_ai_job(client_job_id, kind, folder?)`: signed-in only; idempotent per (account, client_job_id) — the same key always answers the same job and never takes a second preview or a second share of the cap; checks `enabled`, the person's 3 edit jobs this month (not refunded/failed), the 20 taps today, and *this month's estimated spend + the new estimate ≤ cap*, all under a `FOR UPDATE` lock on the settings row, so two parallel reservations cannot both take the last slot (tested with two real sessions).
- States: `reserved` → `submitting` (claimed exactly once; a second submit can never pay fal again) → `running` → `succeeded` | `refunded` (nothing charged: frees the preview and the money) | `failed` (fal may have charged: the person gets the preview back, the money still counts). Stale jobs expire: reserved > 15 min → refunded; submitting > 15 min or running > 60 min → failed. A late webhook can still turn `failed` into `succeeded`.
- `ai_quota()` returns previews left, taps left and paused flags — never money. Service-only: `claim_ai_job`, `start_ai_job`, `finish_ai_job`, `ai_job_for_webhook`, `ai_expired_paths`, `mark_ai_purged`.
- Storage: private bucket `room-photos` (JPEG/PNG, 5 MB each). Policies let a signed-in person upload, read, replace and delete only under `<user id>/…` and never write in `<user id>/results/`. Plain PostgreSQL (CI) has no `storage` schema, so this part is guarded and skipped there; the setup guide has the manual fallback.
- Account deletion: job rows stay (with no owner) so the month's spending still counts; their files are listed for deletion at once.

**Edge Functions** (`server/supabase/functions/`, Deno on Supabase). All logic lives in `_shared/*.ts` with web-standard APIs only and injected "ports", so Vitest runs the same code; each `*/index.ts` is three lines. `server/supabase/config.toml` sets `verify_jwt = false` for all four because each checks its caller itself (Supabase Auth `getUser` for the two app functions — works with both legacy and new API keys; fal's signature for the webhook; the service-role key for cleanup). Run the Supabase CLI with `--workdir server`.
- `room-ai-submit`: request check (files only directly in `<uid>/<clientJobId>/`, `photo.jpg`, `mask.png`, ≤ 3 `ref-N.jpg`, known material kind, `#rrggbb` colour, surface wall/floor/other) → reserve as the user → the uploads exist with the right type and size (storage listing) → claim → 10-minute signed URLs → `POST https://queue.fal.run/openai/gpt-image-2.5/flare/edit?fal_webhook=<SUPABASE_URL>/functions/v1/room-ai-webhook?job=<id>` with `Authorization: Key FAL_KEY`, `X-Fal-Store-IO: 0`, `X-Fal-Object-Lifecycle-Preference: {"expiration_duration_seconds":3600}` and the fixed body `{prompt, image_urls:[photo, …refs], mask_url, quality:'medium', num_images:1, output_format:'jpeg', image_size:'auto', enable_safety_checker:true}` → `start_ai_job`. fal refuses → refunded; no answer → failed.
- Prompt: a fixed English template; only a cleaned label (letters, digits, spaces and `#,.()'-`, ≤ 40 characters) and a `#rrggbb` colour are inserted; ≤ 1000 characters.
- `room-ai-webhook`: Ed25519 check exactly as fal documents (message = request_id\nuser_id\ntimestamp\nhex(sha256(raw body)); keys from `https://rest.fal.ai/.well-known/jwks.json`, cached 12 h, one refetch on failure at most every 5 minutes; |now − timestamp| ≤ 300 s); bad signature → 401 and nothing changes. A valid delivery is answered 200 at once and settled in the background (`EdgeRuntime.waitUntil`): the image is downloaded only from `https://fal.media`/`*.fal.media` (no redirects, ≤ 15 MB, JPEG), stored as `<owner>/results/<job>.jpg`, the job succeeds; ERROR → refunded. Then the room photo and references are deleted; the mask stays so the app can finish a preview after being closed.
- `room-ai-segment`: one tap → reserve a `segment` job → `https://fal.run/fal-ai/sam2/image` with one positive point → mask fetched from the allowlisted host and returned as base64.
- `room-ai-cleanup` (service key only; owner schedules it daily): deletes job folders and results older than 7 days or of deleted accounts, plus any bucket object older than 7 days (from `storage.objects` when present), then marks the jobs purged.
- CORS: only `ALLOWED_ORIGINS` (https origins) and `https://localhost` (Capacitor). Secrets only from environment variables; logs carry job ids and outcomes, never keys, tokens, signed URLs or bodies.

**App** (`apps/web/src/visualizer/server-surface.ts`, `ai-image.ts`, `ai-codec.ts`, `AiConsent.tsx`; `cloud/api.ts` `roomAi`).
- The AI block appears only when the build has cloud settings: signed out it says how to get previews; signed in it shows "AI previews left this month: N of 3" or "AI is paused for this month", a "This area is" choice and "Make AI preview (uses 1)". The visualizer never loads the cloud library for someone who never signed in (the Phase 1 "nothing leaves the device" e2e check still passes unchanged).
- Consent (versioned, per device and account in `localStorage`) before the first preview or tap; links the privacy policy.
- Flow: reserve → upload the working-size photo (JPEG ≤ 1536×1024), the mask as an 8-bit greyscale PNG at exactly the photo's size (white = change, black = keep, soft edge greys) and at most one reference (pattern ≤ 512 px or picture ≤ 1024 px) with the person's own session → submit → poll `get_ai_job` (2, 2, 3, 3, 4, 5 then 6 s; about 3 minutes; woken at once on Capacitor `resume` and tab visibility) → download the result as a Blob → scale to the working size → **composite on the device**: out = photo·(255−m)/255 + AI·m/255 inside the mask; every pixel with m = 0 is copied byte for byte → kept as option "AI". The app then deletes the mask and result from storage.
- Never an automatic retry of a paid call. "Try again" (network/result problems) and "Keep waiting" (timeout) reuse the same clientJobId, so the server answers the same job. A job still running when the visualizer closes is remembered per account; opening the same photo again finishes it with the mask kept on the server.
- Tap to select (AI): the photo is uploaded once per visualizer session; each tap's mask becomes one `union` mask step (undoable; only ever adds).
- Privacy policy `apps/web/public/privacy.html` (English + Hindi; contact = the Google Play support email, as on `delete-account.html`; no invented company details); linked from the consent, Cloud saving and Settings; `delete-account.html` now mentions AI files.

**Tests (builder's own, not independent).** Vitest: fal body/prompt/allowlist/CORS/validation, Ed25519 signatures with generated keys (valid, tampered, wrong key, ±300 s, rotation refetch, rate limit), the four handlers with fake Supabase/fal, the client provider flow (reserve → upload → submit → poll → composite, cap, used up, signed out, refund, timeout, no double submit, resume), mask PNG bytes, composite property (outside-mask pixels identical), consent/quota UI. SQL on PostgreSQL 16: RLS, idempotency, 3/month, refund, failed, cap (exactly US$3 passes, more is refused), kill switch, taps, stale expiry, cleanup, account deletion, service-only functions, plus two-session races (last preview, same key, cap across accounts). Browser e2e against a stand-in for Supabase: consent → uploads → job → composite exact outside the mask, tap-to-select + Undo, privacy page at 412 px and 1280 px.

**Risks and open checks.**
- **No live fal call was made.** Field names, the mask convention and the webhook signature follow fal's documentation of 2026-10-26; the first real run must be watched (setup guide step 8).
- The real cost per preview is unknown; the cap is only as good as `est_edit_usd`. Check fal's usage page after the first previews and adjust.
- `image_size: 'auto'` may return a different aspect ratio than the photo (for example 3:2 for a 4:3 photo); the app stretches it back to the photo size, so content inside the area may shift slightly. Pending a live check.
- If fal moves result files to another host, results fail closed (job `failed`, preview given back); the owner can set `FAL_MEDIA_HOSTS`.
- An answer lost between fal and `room-ai-submit` is treated as `failed` (preview back, money counted); a late webhook still delivers it.
- Storage policies and the bucket use Supabase's `storage` schema, which CI cannot test; check them once in the real project (setup guide step 8).
- Android without `VITE_PUBLIC_APP_URL` opens the bundled privacy page inside the app (Back returns, the visualizer is closed).
- The legal text of `privacy.html` is the builder's factual draft; **the owner must review it** before release.

## D87 polish: zoom on the photo and room photos kept on the device

Owner, 2026-10-27: finish the app's core before any backend; the AI part stays as built (hidden when cloud is not configured). No server code changed. Claude Code builder; Codex does not run concurrently.

**Zoom and pan** (`view-zoom.ts`, pure, no DOM). The shown frame keeps its fitted size; the photo layer inside it is moved by a CSS transform `translate(x·W, y·H) scale(s)` with `s` from 1 (fit) to 6 and `x`, `y` stored as fractions of the frame, so a phone rotation keeps the same part in view. The view is always clamped so the photo covers the frame (`x ∈ [1 − s, 0]`). `screenToPixel`/`pixelToScreen` map a frame point to a working-size pixel and back; brush, eraser, 4-corner and AI taps all go through `screenToPixel`, and the brush radius in photo pixels is `size · photoWidth / (frameWidth · s)`, so the brush keeps its size on screen. One view is shared by the Area, Before/after and Compare stages; the compare divider stays in frame coordinates (both pictures move together inside their clipped layers), so the slider works the same when zoomed.
- Touch: two fingers pinch (scale follows finger distance; the photo point under the start midpoint follows the midpoint, so a two-finger drag also pans), computed from the gesture start each time so it never drifts. A finger left after a pinch pans until all fingers lift.
- **Two fingers never draw.** The first finger starts a live stroke; when a second finger lands, that stroke is dropped (never recorded) and the mask is redrawn from its recorded steps (`MaskHistory.redraw`). Corners and AI taps now count on release and only if the press moved ≤ 10 CSS px, so a press that turns into a pinch or drag never places a corner.
- Desktop: wheel (and trackpad pinch, which arrives as ctrl + wheel; a non-passive listener stops the page from zooming) zooms about the cursor; Shift + drag, the middle button or the **Move photo** toggle pans; `+`, `−`, `0` keys zoom (not while typing or on a slider). Space was not used, because Space presses the focused button for keyboard users.
- Controls: a sticky bar at the top of the controls with −, +, **Fit** and **Move photo** (each ≥ 48 px; one row at 360 px) and a small "Zoom 2.3×" badge on the photo.

**Room photos kept on the device** (`room-sessions.ts`). When the person keeps an option (or an AI preview is kept automatically), the session is saved: the working-size photo as JPEG (encoded once per visualizer at quality 0.9; a reopened session reuses its stored bytes), the chosen area as a run-length mask (`encodeMask`: value byte + base-128 run length, a few KB; decoding is byte-exact), the four-corner plane and up to 4 kept options (their JPEG bytes and labels). Removing an option updates the saved session. Each save also stores a ≤ 160 px JPEG thumbnail of the newest option in a separate summary record, so the list never loads photos.
- Storage: its own IndexedDB database `gharplan-room-photos` (stores `summaries` and `sessions`, written together in one transaction), separate from drawings; nothing goes into the project document or the workspace (architecture rule 1 holds: the visualizer still never sees the store). Bytes are stored as `Uint8Array`, not Blobs (older Android WebViews handle Blobs in IndexedDB poorly).
- Bounded: at most **10** sessions; saving an eleventh removes the oldest (never the one just saved). A full device (`QuotaExceededError`, also when it aborts the transaction) shows "This device is out of space, so this room photo was not saved. Delete older room photos in the Room photo panel." and keeps the earlier sessions; nothing is deleted automatically to make room.
- No storage (no IndexedDB, blocked, a private mode that refuses storage): the store opens as `null`, and the Recent list and auto-save simply do not appear.
- The panel shows **Recent room photos** (newest first: thumbnail, date and time, "N options"), a delete button per photo and **Delete all** with a confirm step. Reopening decodes the stored photo and the newest option (shown as the result), loads the mask and plane as the new starting point (`MaskHistory.load`: no undo before it; Clear and then Undo bring it back) and restores the kept options with their labels. A damaged or missing record says "This room photo could not be opened. You can delete it."
- The store code loads as its own small chunk (`room-sessions`, 3.14 kB / 1.28 kB gzip) from the panel; only the panel's list UI and strings are in the main bundle. Measured `pnpm build` before → after: main `index` 538.88 → 541.22 kB (166.94 → 167.67 kB gzip); `VisualizerView` 44.16 → 52.50 kB (15.43 → 18.14 kB gzip); CSS 36.51 → 38.18 kB; build-gate initial JS 247 191 → 248 686 gzip bytes (limit 600 000).

**Privacy.** No change to `privacy.html` in D87: the owner decided (2026-10-27) that the privacy page is written only when the app is ready to go live. Before release it must mention that kept room photos stay only on the device until deleted.

**Tests (builder's own, not independent).** Vitest: zoom maths with hand-worked values (centre/corner zoom, limits, edge clamp, pinch scale and midpoint, brush radius, wheel), fast-check properties (screen → pixel → screen is the identity for any view; a zoom keeps the point under the cursor when not clamped), gesture classification and the pointer tracker (second finger → pinch, leftover finger pans, then drawing again); mask RLE examples, damaged-data refusal and an encode/decode property; `MaskHistory.load`/`redraw`; the session store over an in-memory port **and over fake-indexeddb** (save, newest-first list, byte-for-byte reopen, replace, delete one/all, 10-session eviction, damaged record, quota from `put` and from a transaction abort, no/denied IndexedDB → null); jsdom UI for the Recent list (dates, option counts, delete, Delete all confirm/cancel, reopen restores options/area/stage, missing record message in Hindi, hidden without storage). Playwright `tests/e2e/room-photo-polish.spec.ts` at 1280×800 and 360×800: a real two-finger touch pinch (Chrome DevTools touch events) zooms and leaves the mask empty although the first finger had started a live stroke; wheel zoom; zoom 2.25× then a brushed line lands exactly where the zoom maths says (inside/outside checks at the stroke ends and edges, and the spot an unzoomed stroke would have hit is untouched), the result is exact mint inside and the original grey outside; the divider works by keys and drag while zoomed; Move photo and Shift + drag pan without moving the divider; Keep saves; close → Recent shows "1 option" → reopen: the option's JPEG bytes are identical, the result canvas equals the stored option decoded, the photo canvas equals the stored photo decoded and the area overlay is identical to before closing; delete removes it from IndexedDB.

**What D87 does not do.** No automatic wall/floor detection; no export/import of saved room photos; sessions are not synced or backed up (device only, by design); saved room photos count toward the browser/app storage and are lost if the app's data is cleared; zoom is not remembered when a session is reopened (it opens at Fit). Real Low/Mid phone checks of pinch feel, memory and IndexedDB size remain pending gates.

## Risks

- One photo cannot give true colour or scale: camera white balance, exposure and screen differences change colours; "pattern size" is visual, not millimetres. The note says so on every screen and in saved images.
- Hard-edged quads and hand-brushed masks are approximate; furniture in front of a surface must be erased by hand (Phase 2's SAM-2 would help).
- Memory on 2 GB phones: one decode at a time, closed at once; working canvases ≈ 6 MB each; worst case during a render is roughly 30–40 MB. Not measured on a real device.
- Same-origin texture files are fetched when an app finish is chosen (the same files the 3D view loads); no third-party request is made.

## What is NOT done

- Phase 2 (D86) is built but has not run against the real fal.ai service or the owner's Supabase project.
- No automatic wall/floor detection. (Pinch-zoom was added in D87.)
- Android saves PNG (native plugin limit), not JPEG; Web Share is used only where the browser supports sharing files (Android WebView does not).
- Results and options are not saved in the project. Since D87, kept options are saved on the device (Recent room photos, last 10); a shown but not kept result is still lost when the visualizer closes.
- No real Low/Mid phone testing, no performance claim for phones, no final Claude review (D36/D63 gates remain).
- No purchases of extra AI previews (billing stays gated).
- All tests are the builder's own (Claude Code), not independent fixtures.


## D90: provider change, recorded for later (owner, 2026-10-27)

The owner will not use fal.ai. When the backend is built (Firebase + Vercel, paused until the core app is finished), the D86 server logic is ported to Vercel Functions and the provider adapter is swapped: AI previews call the **OpenAI** image edit API directly with `OPENAI_API_KEY` (Vercel environment variable, server only); the mask becomes an alpha PNG (transparent = edit) of exactly the first image's size; OpenAI answers synchronously, so the function time limit and a client-side wait/cancel flow must be designed. Tap-to-select (SAM-2) needs a separately chosen host with its own key (Meta offers no official hosted SAM API as far as we know; SAM-2 itself is Apache-2.0); host and price are unverified. Until then the brush and 4-corner tools are the selection method. The server-enforced guardrails stay: medium quality, one image, compressed uploads, credits and the monthly cap.

## D92: AI test mode (access code, no backend) (owner, 2026-10-28)

**Owner decisions.** AI should work now, before any backend (login and database are postponed; the backend will later
be Firebase + Vercel, D90). Only someone who knows the **access code** may use AI. Owner update (same day): there are no
other testers; the owner is the only AI user, so the app and the guide speak of "your private AI code" (the code is still
needed because the `/api` addresses are public). Customers get per-user
credits later with the backend. Previews and blending: **OpenAI direct** (`OPENAI_API_KEY`, model
`gpt-image-2.5-flare`, `/v1/images/edits`). Tap to select: **Meta SAM-2 via fal.ai** (`FAL_KEY`, `fal-ai/sam2/image`).
Secrets only in Vercel Environment Variables, read only by server code. No work on `privacy.html` until the app is
ready to go live. Claude Code builder; D86 code is kept unchanged and is simply not used in a test-mode build.

**Design.**
- Two Vercel Functions in the root `api/` folder (Node.js runtime, Web-standard `export default { fetch }`):
  `POST /api/room-ai/edit` (maxDuration 300 s in `vercel.json`) and `POST /api/room-ai/segment` (120 s). The entry
  files only call the pure, tested code in `server/vercel/room-ai/` (lint, typecheck and Vitest include it).
- Every call passes, in this order: CORS preflight → POST only → allowed origin (ALLOWED_ORIGINS, plus
  `https://localhost` for the Capacitor app, plus an https origin whose host is the host the request was sent to — the deployment's own address, so preview URLs work) → server
  configured (keys present and AI_ACCESS_CODE at least 8 characters, else 503 `NOT_SET_UP`) → wrong-code lockout
  (10 wrong codes per 10 minutes per instance → 429) → access code in header `X-Room-AI-Code`, compared timing-safe
  (both values hashed with SHA-256, all 32 bytes compared; 401 `WRONG_CODE`) → per-instance rate limit (edit 6/min,
  segment 30/min → 429 `BUSY`) → body read with a hard byte limit while streaming (edit 4.2 MB, segment 3 MB → 413).
- **Edit** body (multipart): `room` PNG, `mask` PNG with alpha, 0–3 `reference` JPEG/PNG (each ≤ 800 KB, ≤ 2048 px),
  `kind` (paint/pattern/picture), `surface` (wall/floor/other), `label` (cleaned to ≤ 40 letters/digits/simple marks),
  `colour` (#rrggbb). Types are decided by magic bytes; sizes are read from the PNG IHDR / JPEG SOF; room and mask must
  have the same size, both multiples of 16, long side ≤ 1536, ≥ 655 360 pixels, aspect ≤ 3:1. The OpenAI form is
  fixed: `model=gpt-image-2.5-flare`, `image[]` = room FIRST then references, `mask`, a fixed prompt template (only
  the cleaned label, colour and surface are inserted; no free text), `quality=medium` (always: the default is `auto`),
  `n=1`, `size=<room size>`, `output_format=jpeg`, `output_compression=85`. Time limit 280 s. Answer
  `{ok, image: base64 JPEG, width, height}`; the base64 is limited to 3.2 MB of JPEG so the response stays under
  Vercel's 4.5 MB. Errors: `moderation_blocked`/`image_generation_user_error` → 422 `BLOCKED`; `insufficient_quota`/
  `billing_hard_limit_reached` → 402 `BUDGET`; other 429 → `BUSY`; OpenAI 401/403 → 503 `NOT_SET_UP`; timeout → 504;
  anything else → 502. **Nothing is retried** by the server or the app.
- **Why the room is a PNG, not a JPEG:** OpenAI's guide says "The image to edit and mask must be of the same format and
  size". A JPEG room with a PNG mask is not documented as accepted, so the safe choice is PNG for both. A busy photo is
  large as PNG; the app steps the size down (×0.85, never below 655 360 pixels) until room + mask + references fit
  4.15 MB, otherwise it says "too large".
- **Segment** body: `room` (JPEG ≤ 2.4 MB, ≤ 4096 px) and the point `x`, `y`. The photo is uploaded to fal's CDN with
  the documented two-step REST upload (initiate → PUT to `upload_url`; `file_url` must be https on `fal.media` or a
  subdomain), then `fal.run/fal-ai/sam2/image` with `prompts:[{label:1,x,y}]`, `sync_mode:true`, `output_format:png`.
  The mask comes back inline (data URI); a URL answer is downloaded only from https `*.fal.media`. Headers on every fal
  call: `X-Fal-Store-IO: 0`, `X-Fal-No-Retry: 1`, `X-Fal-Object-Lifecycle-Preference: {"expiration_duration_seconds":3600}`.
- Logs: only event, status, code, step, timings and sizes; never images, prompts, keys or the access code (tested).
- **App** (`test-mode.ts`, `test-surface.ts`, `ai-prep.ts`, `AiCodePrompt.tsx`): on only with the public build flag
  `VITE_ROOM_AI_TEST_MODE=1`; the web calls its own `/api`; the Android build needs `VITE_API_BASE_URL` (https web
  address). The AI section then reads "AI preview · AI test mode" and the D86 account section is not shown. First use
  asks for the private AI code (password field, kept in this device's localStorage, **Forget code** removes it; a 401
  forgets it and asks again with "That AI code is not right"), then the consent (test wording below, stored per
  device). The photo is stretched (never cropped) to the AI size (`aiSize`: multiples of 16, ≤ 1536, ≥ 655 360 px,
  ≤ 3:1; property-tested against the server's own check); the mask is converted to an RGBA PNG of exactly that size,
  alpha 0 wherever any covered working pixel is chosen (so a thin line is never lost), 255 elsewhere; references are
  JPEG ≤ 1024 px (q 0.85, then 0.7). Upload by XMLHttpRequest with a percent bar (where no progress event arrives,
  the wait message appears after 2.5 s), a **Cancel** button (AbortController) and "The AI is working. This can take
  up to 2 minutes. Keep this screen open." The app waits at most 295 s. The answer is scaled back to the working size
  and composited **only inside our own mask** (`compositeInMask`, D86): every pixel outside is byte-identical to the
  photo. The result is kept as option "AI". One preview at a time (button disabled + a provider guard), no automatic
  retry. **Tap to select (AI)** posts the photo and the point and adds the answer as one undoable `union` step.
- **Consent text in test mode** (only the provider and retention wording differs from D86, and it states what is
  true without our own storage): the photo, area and references go to OpenAI for previews; the photo and the tapped
  point go to fal.ai (Meta SAM-2) for tap-to-select; GharPlan's own server stores none of these; OpenAI says it does not
  train on this data and may keep it up to 30 days for abuse monitoring; fal.ai is asked to delete the upload after
  1 hour and not to keep the request; test mode is only for the owner, with the private AI code, and is paid from the owner's OpenAI account.
  The D86 consent text is unchanged.
- **Build guard** (`vite.config.ts` → `publicEnvProblems`): the build stops if any `VITE_` variable is named like a
  server secret (contains OPENAI, ACCESS_CODE, or FAL as a word) or its value looks like an OpenAI key (`sk-…`) or a
  fal key (`uuid:hex`). The message names the variable, never its value.

**Verified facts and sources (fetched with curl on 2026-10-28).**
- OpenAI image-generation guide (developers.openai.com/api/docs/guides/image-generation.md): mask applies to the first
  image, must have an alpha channel, transparent = edit, "same format and size"; custom sizes multiples of 16, aspect
  1:3…3:1, total pixels 655 360 … 8 294 400; quality default `auto`; `output_compression` 0–100 for jpeg/webp; jpeg is
  faster; `moderation_blocked` errors. API reference (…/reference/resources/images/methods/edit): `quality` low…max/auto
  (default auto), `n`, `size` WIDTHxHEIGHT, `output_format`, `output_compression`, models incl. `gpt-image-2.5-flare`
  (the default would be `-sunburst`). "Your data" (…/guides/your-data.md): `/v1/images/edits` data is not used for
  training, abuse-monitoring retention 30 days, no application state.
- Vercel (vercel.com/docs …/functions/runtimes/node-js.md, functions-api-reference.md, project-configuration/
  vercel-json.md, functions/limitations.md): one function per file in the root `api/`, TypeScript supported, the
  Web-standard `export default { fetch }` handler; `"type": "module"` needed without a framework (the root
  package.json has it); `functions` glob config with `maxDuration`; Hobby max duration 300 s; request and response body
  max 4.5 MB (413 `FUNCTION_PAYLOAD_TOO_LARGE`); request cancellation is opt-in (not enabled: a cancelled phone does not
  stop a call already sent to OpenAI anyway).
- fal (fal.ai/docs/llms-full.txt, fal.ai/models/fal-ai/sam2/image/llms.txt): inputs are URLs and only "some models"
  accept data URIs (not stated for SAM-2 → we upload); REST upload initiate + PUT; CDN files are forever and public
  unless the lifecycle header sets an expiry; `X-Fal-Store-IO: 0` disables the 90-day request history;
  `X-Fal-No-Retry`; SAM-2 fields `image_url`, `prompts`, `apply_mask`, `sync_mode` (data URI answer), `output_format`;
  output `image.url`.

**Not verified (safe choice taken).**
- No live OpenAI, fal or Vercel deployment call was made (no keys exist in this environment). The first real use must be
  watched (owner guide, last step).
- That Vercel compiles `api/room-ai/*.ts` importing `../../server/vercel/room-ai/*.js` (the `.js`-suffix TypeScript
  ESM convention). It runs locally under Node 24's type stripping with a `.js → .ts` resolve hook (harness output in
  the PR); the owner guide's smoke check (`/api/room-ai/edit` answering JSON 401/503) proves it after the first deploy.
- The meaning of `output_compression=85` (the docs say "compression level"; 85 is used as a JPEG-quality-like value as
  the owner brief asked). If results look blocky, raise it in `server/vercel/room-ai/openai.ts`.
- The fal `upload_url` host is not documented; it is accepted when https without credentials. `file_url` and results
  must be on `fal.media`.
- `insufficient_quota` / `billing_hard_limit_reached` as the codes for a used-up OpenAI budget (taken from OpenAI's
  usual error codes, not re-verified for this endpoint); anything unknown maps to "did not work".

**What is not reliable without a backend.**
- The in-memory limits (6 previews/min, 30 taps/min, 10 wrong codes/10 min) are **per function instance**; Vercel can
  run several instances and restarts them at any time. They only slow a burst. The real spend control in test mode is
  the secret access code plus the monthly **budget limits the owner sets in the OpenAI and fal dashboards (if
  available)**. There is no per-user count and no monthly cap of our own (the D86 US$3 cap lives in Supabase and is
  not used here).
- If the code leaks, anyone who has it can spend: change AI_ACCESS_CODE (and redeploy) to lock everyone out.
- A cancelled or lost answer may still have been paid at OpenAI (the request was already sent); the app says so.
- `privacy.html` still describes the D86 flow (fal, 7-day storage). By owner decision it is not changed until the app
  is ready to go live; test mode is limited to the owner's own use with the private code. Before any customer uses AI, the privacy page must
  describe OpenAI and fal as above.

**How it is replaced later.** When the Firebase + Vercel backend exists, the same two functions keep their request
checks and provider code; the access-code step is replaced by a signed-in user's token and a per-user credit
reservation (idempotent per tap, refund on provider failure, monthly cap), as designed in D86. The app keeps the same
`test-surface` flow (one POST, local composite); only the header and the error codes for "no credits" change.

**Tests (builder's own, not independent).** Vitest `server/vercel/room-ai/room-ai.test.ts`: timing-safe code check
(digest of both values, exact match only), 401/503/429 lockout, CORS/preflight/origins, streaming body limit 413,
magic-byte types and sizes, size rules, a property test that every app-prepared size passes the server check, form
checks (types, sizes, counts, picture needs a reference, label cleaning), the exact OpenAI form (model, quality=medium,
n=1, jpeg 85, size, room first, mask), prompt template, error mapping, one provider call per request and no retry,
logs free of keys/code/image, fal headers/body/host allowlist/data URI, upload → SAM-2 → mask, evil-host masks never
downloaded. `ai-prep.test.ts`: hand-worked AI sizes and a property test (multiples of 16, limits, shape within 4 %),
alpha mask exactly transparent where our mask is chosen (property) and block coverage when resizing, RGBA PNG bytes,
test-mode config, build guard. `test-surface.test.ts`: one POST with code header and fields, mask PNG at the AI size,
phases and progress fallback, composite inside the mask (and a property: outside pixels identical whatever the AI
returns), NEED_CODE/WRONG_CODE, all error statuses, network, cancel, timeout, one at a time, size step-down and
TOO_BIG, segment. `room-ai-test-ui.test.tsx` (jsdom): flag off → nothing; code prompt → consent wording → area check;
consent and code asked once; Forget code; Not now/Escape; Hindi. Playwright `tests/e2e-ai-test/room-ai-test.spec.ts`
(own config `playwright.ai-test.config.ts`, build with the flag, port 4186; `/api/room-ai/*` answered by `page.route`)
at 1280×800 and 412×915: code → consent → waiting (+ Cancel) → result only inside the brushed area (outside
byte-identical), request contents (code, fields, room PNG 992×672, RGBA mask transparent on the stroke); wrong code →
message → right code; Cancel; tap-to-select union + Undo. `tests/e2e/room-photo-ai-test-off.spec.ts`: with the flag off
there is no test-mode UI and no `/api/room-ai` request. A Node harness ran the real `api/` entry files: 503/204/403/
401/413/400 with zero provider calls.
