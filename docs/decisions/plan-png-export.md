# D32: canonical whole-plan PNG export

PH2-T06, Codex under D17,2026-10-14. No dependency/project-schema/accepted-fixture change. Original PNG fixture is generated with Python zlib/CRC from two red and two blue RGBA pixels; it is Codex data, not a Claude independent fixture.

## Rendering and limits

Capture the immutable current ProjectStore snapshot when Create is pressed; local disk save status is separate. Canvas2D fits the whole canonical footprint/furniture/door swing extent into a square2000px image; lower retry uses1000px and the same captured model/locale. Uniform world-to-image scale preserves shape proportions. Viewport, selection, Konva state and unconfirmed drafts are excluded. Render all admitted walls/openings/furniture/clear-room polygons; centreline wall labels use exact integer-mm length/strict imperial formatter, room labels use the same clear-area formatter as the editor. Title and GharPlan watermark are original text. No textures/remote artwork/model downloads in this first plan image.

Safety limits: <=200walls, <=500furniture and <=500openings; no empty-wall plan; <=4million pixels, <=2048edge, <=10MiB encodedPNG, <=4096chunks. Over-budget projects are retained and image creation reports failure; no clipped/truncated scene or blank success. Numeric limits are safety budgets, not proven phone performance. All dimension label strings remain available in the accessible preview list; dense plans/long Hindi names still need physical readability checks.

PNG signature/IHDR/CRC/chunk bounds/end/data are checked before decode/transport. Actual browser decode validates the image; a32×32probe rejects a white/transparent blank. Encoding and decode have8s diagnostic deadlines; a late decoded bitmap is closed. Main canvas/bitmap resources are released. UI operation ref prevents concurrent generation/save; epoch and owned object URLs prevent stale/unmounted delivery. Lower retry preserves the captured snapshot after later edits; a new Create captures new content. APNG is not editable project backup; JSON remains available.

## Delivery and Android

Browser Save requests an object-URL download and says requested; it cannot verify external file-manager delivery. Android uses existing ProjectFiles system-document picker with explicit formatpng, image/png MIME and a generated private-cache .png source. Existing omitted-format JSON behavior remains unchanged and rejects PNG paths through that default. Format/path traversal/symlink guards, binary cache exact hash/length readback, bounded native streaming and destination readback receipt apply. Cleanup is unique-path/nonblocking and cannot remove canonical files; cache admission stays bounded32retained transport sources.

ProjectPngSource checks bounded PNG envelope/CRC/IHDR in a streaming buffer. API24-safe readFully and unsigned long masks avoid APIs introduced in26. Browser decoding plus source checksum does not prove provider durability/fsync or correct behavior on everyOEM. The destination can be incomplete after a failure; the preview/model stay available. No new permission, persistent URI grant, secret, service or deployment.

Save via the Android document picker is implemented. Direct in-app share sheet remains a UF-15 mobile/release follow-up; a saved PNG can be shared from the device file manager. PDF and3Dscreenshots are later scope. Physical picker/provider/WhatsApp/share/font/Low-Mid/performance, novice/tape, final Claude/expert/security remain pending.

## Verification

Exact independent fixture CRC3421780262 for123456789, every-byte truncation and seeded bit mutation; byte/base64 transport roundtrip, cache/receipt/cancel/failure/stalled cleanup; canonical200/201wall admission; analytic sample labels and paint calls; uniform translated fits. Actual downloaded PNG decode/dimensions/nonblank content, byte-identical exports despite viewport/selection/drafts, imperial labels without spatial conversion, forced encoding/whitePNG/stalled-decoder failures and lower recovery, empty-model refusal. Native format/path andPNGCRC/dimension JVM tests supplement browser checks; no phone run claimed. Evidence: ../verification/ph2-t06.md.
