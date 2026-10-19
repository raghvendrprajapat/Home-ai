# Phase 1 quality: acceptance spec (D76)

**Owner request (2026-10-19).** After watching a Planner 5D "Copilot" video, the owner said the app looks like a toy and asked to bring it to that level, verified in a way the builder cannot cheat. Phase 1 has three parts:

- **M1:** realistic 3D.
- **M2:** a professional editor shell.
- **M3:** a Copilot chat panel that runs on the offline stand-in.

Phase 1 adds no paid service. Live Gemini calls (Phase 2) and AI renders (Phase 3) wait for the owner's monthly cost limit (see D76).

This file is the **contract**. The independent acceptance tests in `tests/acceptance/` are written from this file alone, by an agent that does not see the implementation. The builder may not edit those tests (see "Anti-cheat rules"). Nothing here copies Planner 5D's code, art, catalog or UI art. Only the level of polish is the target.

## Fixed test setup
- **Sample project:** the bundled sample opened with "Skip welcome" (the existing first-run button).
- **Viewports:**
  - Desktop: 1280×800.
  - Phones: 360×800 and 412×915.
- **Quality:** "auto" unless a test says otherwise. In the CI browser (software WebGL), "auto" may resolve to any tier; tests that need a tier choose it through the existing quality control in the 3D settings.

## M1: realistic 3D
The 3D view element (`data-testid="three-view"`) exposes these attributes. They must be true statements about the live scene:

| Attribute | Meaning | Required |
|---|---|---|
| `data-quality-tier` | `low`, `mid` or `high`, the tier actually in use | always |
| `data-tone-mapping` | `aces` or `none` | `aces` on mid/high |
| `data-environment` | `none`, or `hdri:<asset id>` for the lighting environment in use | `hdri:…` on mid/high |
| `data-shadows` | `on` or `off` | `on` on mid/high |
| `data-textured-materials` | number of materials in the scene with a colour texture map | ≥ 3 on mid/high with the sample; `0` on low |
| `data-texture-bytes` | estimated GPU bytes of all loaded textures, an integer | ≤ 64 MiB on mid, ≤ 96 MiB on high, `0` on low |
| `data-draw-calls` | draw calls of the last frame (already exists) | ≤ 200 on mid with the furnished sample |

**R1. Surfaces look real on mid/high.**
- Floors use photographic CC0 textures in real-world scale:
  - wood laminate: planks about 1200 mm long;
  - 600×600 mm vitrified tile;
  - marble.
- Walls use a subtle plaster texture under the paint colour.
- **Pixel check:** take the same camera pose, render it on mid and on low, and crop the floor of the largest room. On mid, the mean absolute difference between horizontally adjacent pixels is at least **1.5×** the low value.

**R2. Lighting.**
- On mid/high: ACES tone mapping, an HDRI environment (CC0), and soft sun shadows.
- On low: no shadows, no environment map and no textures, so budget phones stay fast.

**R3. A furnished first impression.**
- The bundled sample opens with real catalog models in both rooms: at least a sofa, a coffee table, a TV unit, a bed and a wardrobe.
- In 3D, every furniture item reaches `data-model-phase="ready"`.
- No grey placeholder boxes remain visible once loading finishes.

**R4. Sensible auto quality.**
- "auto" picks `mid` when the GPU allows 4096 px textures and the device reports at least 4 GB memory and 4 cores (where reported).
- Otherwise it picks `low`.
- The person can always override the tier.

**R5. Licences.** Every texture and HDRI file has a rights record:
- source URL;
- licence CC0;
- author or site;
- date checked;
- SHA-256 hash.

The asset check fails if a file has no record.

## M2: professional editor shell
**S1. Canvas first.**
- **Desktop 1280×800:** the drawing area (`data-testid="editor-views"`) is visible without scrolling and covers at least **60%** of the viewport area.
- **Phones (360×800 and 412×915):** it covers at least **50%** of the viewport, again without scrolling.

**S2. Top bar** (`role="banner"`). It holds:
- the app mark;
- the project name;
- the 2D / 3D / 2D+3D switch (group named "Drawing view");
- Undo and Redo buttons (names "Undo", "Redo");
- a "Share" or "Export" entry.

On phones, no two interactive elements in the top bar overlap: their bounding boxes have zero intersection area. Every interactive element there is at least 40×40 px.

**S3. Tool rail** (`navigation` named "Tools"). One tap opens each of:
- Draw (walls and rooms);
- Openings (doors and windows);
- Furniture (catalog);
- Materials (paint, floors);
- Copilot;
- Project (floors, save, cloud, export, settings).

Each opens its panel (`region` named after the tool) beside the canvas on desktop and as a bottom sheet on phones. Only one panel is open at a time. Escape or a close button closes it.

**S4. Nothing lost.**
- Every behaviour covered by the existing `tests/e2e` suite keeps working.
- Those tests may be updated only to open the right panel first.
- Their assertions must stay as strict as before.

**S5. Hindi.** With Hindi chosen, the top bar, tool rail and panel titles are in Hindi.

## M3: Copilot (offline stand-in)
**C1. Panel.**
- The Copilot panel (`region` named "Copilot") shows:
  - a short note that it is an offline helper, not online AI yet;
  - three starter chips;
  - a text box named "Ask Copilot" and a "Send" button.
- Messages appear as a conversation, newest last.

**C2. Requests the stand-in must handle, in English and in Hinglish:**

| Request (examples) | Result |
|---|---|
| "Make a 2BHK", "2BHK banao" | Opens a new project from the 2BHK template (six named rooms). The previous drawing is untouched. |
| "Furnish the bedroom", "bedroom furnish karo" (sample) | Shows the checked layout preview for the bedroom. "Apply" adds the furniture as **one** undo step; Undo removes all of it. |
| "Paint the walls beige", "deewar beige karo" | Every wall side of the active floor gets a beige paint, as **one** undo step. |
| "Wooden floor in the living room", "living room mein wooden floor" | The living room floor becomes the wood material, as **one** undo step. |
| Anything it cannot do | A short reply listing what it can do. The drawing does not change (the exported JSON is byte-identical). |

**C3.** Every Copilot change goes through the normal core-model commands. Undo and Redo behave exactly as for manual edits.

## Anti-cheat rules
1. **Who writes the tests.** `tests/acceptance/` is written by a separate agent from this file only. That agent commits a `MANIFEST.sha256` listing every file it wrote, with its hash.
2. **The guard.** `pnpm acceptance:guard` (part of `pnpm check`) fails if any listed file differs from its hash, or if a file under `tests/acceptance/` is not listed.
   - The builder never edits these files or the manifest.
   - If a test is wrong, the builder writes why in the PR and asks the owner.
   - Only the test author may change a test, in a separate PR.
3. **Running them.** Acceptance specs run with `pnpm acceptance`. A milestone counts as done only when its specs pass in CI unchanged.
4. **Screenshots.** Each milestone attaches screenshots at the fixed viewports. An independent review agent scores them against frames from the owner's video. Its scores and comments are reported as written, unedited.
5. **The final judge** is the owner, using the Vercel preview and the Low and Mid phones.
