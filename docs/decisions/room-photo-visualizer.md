# D85 — Room photo visualizer (Phase 1 offline; Phase 2 planned)

Owner, 2026-10-26: after Claude's architecture review the owner said "Okey now do work"; Claude Code is the builder again for this work (Codex does not run concurrently). Goal: after seeing the home in 3D, a customer tries paint, tiles/laminate/wallpaper or wall art on a photo of their **real** room.

Phase 1 (this change) is fully offline and deterministic: no network upload, no backend, no AI call, no new dependency, no cost. Phase 2 (server AI) is a planned design only and stays gated (see below).

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

**Provider boundary** (`surface-provider.ts`): `SurfaceEditProvider { kind: 'stand-in' | 'server'; render(request, signal): Promise<SurfaceEditResult> }`. Only the stand-in exists. The view takes a `provider` prop (default stand-in), so Phase 2 can plug in without UI changes.

## Phase 2: planned design (not built, gated)

Gated on owner decisions: monthly AI budget, provider choice (the D76 note named Google Gemini; this plan names fal.ai GPT-Image-2.5 edit and SAM-2), free-credit amount, consent and the privacy-policy update. Until then no photo leaves the device.

- **Server-only secret.** Supabase Edge Functions hold the provider key (Supabase secrets); never in the app bundle, logs or chat.
- **Functions.** `submit` (validate, reserve credits, upload to a private bucket, start the async job), `webhook` (provider callback with signature check; store output; settle or refund), `segment` (SAM-2 tap-to-select returning a mask).
- **Credits ledger.** Append-only reserve → settle on success / refund on failure or timeout; the balance is derived from the ledger; idempotency key per request.
- **Server allowlist.** Model, quality (server-enforced `medium`), output size and prompt template are fixed on the server; the client cannot choose a more expensive option.
- **Storage.** Private bucket, signed short-lived URLs, short retention with automatic deletion; account deletion (FR-043) removes them.
- **Local composite.** The AI output is composited on the device inside the same mask, so pixels outside the chosen area remain the person's own photo, byte for byte.
- **Async jobs.** Jobs survive app backgrounding; the app polls/resumes on app resume and shows pending/failed/refunded states.
- **CORS** limited to `https://localhost` (Capacitor Android) and the Vercel domain.
- **Memory.** Upload the working-size image only (≤ 1536×1024 JPEG), decode one result at a time, keep options as compressed blobs.

## Risks

- One photo cannot give true colour or scale: camera white balance, exposure and screen differences change colours; "pattern size" is visual, not millimetres. The note says so on every screen and in saved images.
- Hard-edged quads and hand-brushed masks are approximate; furniture in front of a surface must be erased by hand (Phase 2's SAM-2 would help).
- Memory on 2 GB phones: one decode at a time, closed at once; working canvases ≈ 6 MB each; worst case during a render is roughly 30–40 MB. Not measured on a real device.
- Same-origin texture files are fetched when an app finish is chosen (the same files the 3D view loads); no third-party request is made.

## What is NOT done

- No server provider, no AI, no upload, no backend, no credits (Phase 2 above).
- No pinch-zoom on the photo; no automatic wall/floor detection.
- Android saves PNG (native plugin limit), not JPEG; Web Share is used only where the browser supports sharing files (Android WebView does not).
- Results and options are not saved in the project and are lost when the visualizer closes.
- No real Low/Mid phone testing, no performance claim for phones, no final Claude review (D36/D63 gates remain).
- All tests are the builder's own (Claude Code), not independent fixtures.
