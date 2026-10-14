# D35: bounded orbit, conservative quality and captured3D PNG

PH3-T03, Codex under D17,2026-10-14. No dependency/schema/accepted-fixture change.

## Camera

One shared guard keeps live camera/target finite, target in scene bounds, camera above the current floor, distance1–200m and polar angle<=85degrees. Empty/degenerate poses have finite fallbacks. Fit uses a bounding sphere and both horizontal/vertical FOV; if200m cannot frame a large object, report capped focus rather than promise complete framing. Reset/focus are immediate (within400ms, no animated reduced-motion exception). Opening focus derives actual host void bounds, including windows/sills/reversed axes without a GLB mesh.

Camera motion is transient, without model/history/autosave writes. Explicit AddCameraPreset/DeleteCameraPreset core commands save/delete bookmarks with global fresh IDs, name1–60, at most20, atomic validation and exact Undo/Redo. Canonical bookmark vectors are integer plan-axis mm, mapped to Three metres X/Z/Y. Independent component rounding can move a1m/200m radius by up to a few mm: stored eligibility permits3mm quantization tolerance; live restoration clamps to exact orbit limits while leaving saved values unchanged. New commands validate floor/radius/angle eligibility. Schema-legal imported unsupported bookmarks stay untouched and report failure when opened. A floor at the schema elevation limit can render safely but a camera above it may be unrepresentable as a bookmark; reject save explicitly.

## Quality and lighting

Auto deliberately starts Low pending real-device calibration. Capability integers are not FPS measurements or a device classifier. Manual Low/Mid/High overrides are available; insufficient2048texture/renderbuffer capability downgrades to Low with a visible message and recreated non-MSAA context. Quality/lighting recreation preserves the same ProjectStore/session and transient pose; no canonical/history write.

| Profile | DPR maximum / framebuffer cap | MSAA | Sun shadow | Real point lights | Texture budget |
|---|---|---|---|---|---|
| Low |1 /1Mpixels|off|off|0|128MiB|
| Mid |1.5 /2Mpixels|requested|one1024map|0|256MiB|
| High |2 /4Mpixels|requested|one2048map|<=2|256MiB|

Actual antialias capability is exposed; the requested flag is not a phone-performance guarantee. Framebuffer pixel cap can reduce DPR below1 for very large canvases. Asset texture admission/enforcement follows PH4; present procedural scene has no catalog textures. Point fixtures are still future catalog work; imported point lights are capped, have no per-lamp shadow maps, and intensities/colors are visual approximations, not physical lighting calculations.

Low batches structural triangles per material, preserving normals/UV and triangle→entity ranges; original meshes remain hidden for bounds/source ownership and never double draw. Ceilings use separate category-owned neutral material and per-room batches, retaining visibility/ownership even when a canonical material is named __ceiling. Three or more dimensioned placeholder furniture objects share an InstancedMesh with instance→entity IDs/transforms. Complete buffers still exist on CPU, and batch rebuilding is conservative; no total-memory or incremental-topology performance claim.

Sun position/target follows accepted bounds/floor, so translating/elevating a plan preserves relative lighting and shadows. Shadow coverage is bounded centrally (maximum40m across); large-plan policy is disclosed. Day/warm presets are original. Full resource/context-loss lifecycle is PH3-T04.

## Screenshot

Only a complete current accepted generation can capture; pending/stale/lost/empty scenes reject. Borrow the live default framebuffer for correct ACES/sRGB: setDPR1 before capped export size, render a cloned camera, synchronously copy pixels before yielding, then restore original logical size BEFORE oldDPR, target/cube/mip/viewport/scissor/CSS and redraw. Ordinary Three render targets lack this live output path. Actual buffer dimensions and context validity are checked. Failed restoration marks3D unavailable instead of current success.

1000/2000longedge, <=2048edge/4Mpixels/10MiBPNG and >=64shortedge on the raw capture (lower retries can have a smaller short edge). Conservative simultaneous original/export MSAA color/depth, rawRGBA, Canvas, decoded bitmap and encoded cap estimates must fit64/128/384MiB for Low/Mid/High. These are admission estimates, not measured driver/phone peak memory; physical profiling remains required. Raw pixels must show visible scene variation before watermark. PNG CRC/envelope, actual decoding/dimensions and decoded scene variation above the watermark all validate before Save.

Immutable click-time rawRGBA/name/generation supplies lower retries, regardless of later geometry/camera/quality changes. A failed GPU capture with no raw source requires an explicitly new lower capture; never substitute silently. Encoding/decode deadlines8s; late bitmaps close, Canvas/URLs release, one flight and epoch prevent unmounted publication. Browser acknowledges download requested; Android reuses D32 guarded PNG cache/MIME/hash/destination readback. PNG is visual, not editable JSON backup; direct app share/PDF/photoreal server rendering remain outside this task.

Fresh Codex review found/fixed radius rounding, opening focus, fixed-origin shadows, blank encodedPNG and unstable select labels; boundary, translation/elevation, default-framebuffer colors/orientation/restoration, encoded-white/readback/stall/unmount and seeded batch/fit/host/quantization properties verify the corrections. Evidence: ../verification/ph3-t03.md. Claude/expert and physical Low/Mid/TalkBack/thermal/GPU/provider gates remain pending.
