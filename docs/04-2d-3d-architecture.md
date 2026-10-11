# Document 4 — 2D / 3D Engine & Synchronization Architecture

All content here is **PROPOSED** architecture for our product. It is not a description of Planner 5D's internals.

## 1. Coordinate systems & units

| Space | Units | Axes | Notes |
|---|---|---|---|
| Model (world) | integer **millimetres** | X right, Y "down the plan" (north = −Y), Z up | Stored values are integers; derived values (intersections, miter points) are float64 and never written back unless rounded deliberately |
| 2D screen | CSS pixels | x right, y down | `screen = (world − pan) × zoom` |
| 3D (Three.js) | metres | X = model X, **Y up = model Z**, Z = model Y | Conversion in one function `toThree(p) = (x/1000, z/1000, y/1000)`; scene root has no extra transforms |

Why integers: they make equality exact (snapping, junction sharing, hashing, undo identity) and avoid drift after thousands of edits.

```ts
const worldToScreen = (p: Vec2, v: View) => ({ x: (p.x - v.panX) * v.zoom, y: (p.y - v.panY) * v.zoom });
const screenToWorld = (s: Vec2, v: View) => ({ x: s.x / v.zoom + v.panX, y: s.y / v.zoom + v.panY });
// zoom about focal point f (pinch / wheel)
function zoomAt(v: View, f: Vec2, factor: number): View {
  const w = screenToWorld(f, v); const z = clamp(v.zoom * factor, 0.005, 2);
  return { zoom: z, panX: w.x - f.x / z, panY: w.y - f.y / z };
}
```

## 2. 2D geometry engine

### 2.1 Library evaluation for the 2D editor

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Canvas 2D (custom) | No dependency, full control of hit testing & draw order, fast for thousands of lines, easy to test with pure functions | Must write hit testing, dirty-rect logic | **Chosen** (ADR-005) |
| SVG | DOM hit testing free, crisp | DOM nodes per element slow on mobile with large plans; hard to control in WebView | Use only for export |
| Konva.js | Scene graph, events, drag | Its own object model duplicates ours → two sources of truth; dragging logic conflicts with constraint engine | Rejected |
| Fabric.js | Rich object editing | Designed for free-form graphics, not constraint CAD | Rejected |
| PixiJS | WebGL-fast 2D | Extra GPU context alongside Three.js on mobile (memory), text rendering complexity | Rejected for v1 |

The **geometry engine is custom regardless of renderer** — no library ships wall graphs with mitered junctions and room detection that we can trust and license for closed source (blueprint3d has a wall/corner model but is old and unmaintained; useful as reading reference only, check license first).

### 2.2 Data structures

```ts
type Id = string;                // ULID
interface Junction { id: Id; x: number; y: number }               // integer mm
interface Wall {
  id: Id; a: Id; b: Id;          // junction ids, a !== b
  thickness: number;             // mm
  height: number;                // mm
  sideMaterial: { left: Id; right: Id };  // left/right relative to a→b
}
interface Opening {              // door or window hosted by a wall
  id: Id; wallId: Id; kind: 'door' | 'window';
  offset: number;                // mm from wall.a along centreline to opening centre
  width: number; height: number; sill: number;   // mm
  flipX: boolean; flipY: boolean; // hinge side / swing direction
  assetId: Id;
}
interface Room { id: Id; floorId: Id; boundary: Id[]; /* ordered junction ids */ name: string; type: string; ceilingHeight: number; floorMaterial: Id }
```
Derived (never stored): `WallGeometry` (4–6 footprint vertices after mitering), `RoomPolygon` (interior polygon), adjacency maps.

### 2.3 Wall graph invariants (validated after every command)

| # | Invariant | Failure if violated |
|---|---|---|
| I1 | Every wall's junctions exist; `a ≠ b` | Dangling refs → crash |
| I2 | Wall length ≥ 10 mm | Degenerate miters, NaN normals |
| I3 | No two walls share both endpoints (duplicate) | Z-fighting, double rooms |
| I4 | Walls intersect only at shared junctions (graph is **planar**) | Room detection wrong |
| I5 | No two junctions closer than 1 mm | Snapping ambiguity |
| I6 | Collinear overlapping walls are merged/split so they don't overlap | Double geometry |
| I7 | Every opening lies within `[margin + w/2, len − margin − w/2]` and openings on one wall don't overlap | Holes outside wall |

The **normalizer** enforces I3–I6 after each wall-changing command: it is the most important (and most test-heavy) function in the project.

### 2.4 Normalization (planarization) algorithm

```
function normalize(model, touchedWallIds):
  candidates = touchedWallIds ∪ walls whose bbox overlaps touched walls (spatial grid index)
  repeat until no change:
    for each pair (w1, w2) in candidates with overlapping bboxes:
      r = segmentIntersect(w1, w2)        // exact via float64, then rounded to integer mm
      case r.type:
        'none': continue
        'point-interior-both':            // X crossing
            j = getOrCreateJunction(round(r.p))
            split(w1, j); split(w2, j)
        'point-at-endpoint-of-one':       // T-junction: endpoint of w2 lies on interior of w1
            split(w1, existingJunctionOf(w2))
        'collinear-overlap':
            merge into minimal set of non-overlapping walls; keep the older wall id for the
            longest piece (stable identity for undo/materials); re-host openings by world position
    merge junctions closer than 1 mm (keep older id), drop walls shorter than 10 mm
    (re-host their openings or reject the command if an opening would be lost)
  return changed ids
```
Rounding to integer mm after intersection can move a point by ≤ 0.5 mm, which can create new tiny overlaps; the loop terminates because each iteration either reduces walls-crossing count or merges junctions (bounded). Add an iteration cap (e.g. 20) that **rejects the command** rather than corrupting the model.

Robust predicate: orientation test `orient(a,b,c) = (b−a)×(c−a)` on integers is exact in float64 while |coords| < 2^26 mm (~67 km), which we guarantee by limiting plan extent to ±1 000 m.

### 2.5 Junction mitering (wall footprint)

For each junction, sort incident walls by angle. For each consecutive pair (w_i, w_{i+1}) in CCW order, intersect the **left offset line of w_i** with the **right offset line of w_{i+1}** (both measured outward from the junction). That point becomes a footprint corner shared by both walls.

```
function wallFootprints(junction):
  ws = incidentWalls(junction) sorted by angle of direction pointing away from junction
  if ws.length == 1:  // free end
     cap with square end at junction
  for i in 0..n-1:
     A = ws[i], B = ws[(i+1) % n]
     p = intersectLines(offsetLine(A, +A.thickness/2), offsetLine(B, -B.thickness/2))
     if p is null (parallel) or |p − junction| > MITER_LIMIT (e.g. 3 × max thickness):
        p = fallback bevel: use the two offset endpoints at junction (adds a small triangle fill)
     A.cornerLeftAt[junction] = p; B.cornerRightAt[junction] = p
```
Edge cases: walls of different thickness at a T (works by the same rule), very acute angles (miter limit → bevel), 180° straight continuation (parallel offsets → shared point is the offset endpoint), 3+ walls at a junction (central polygon filled by "junction cap" polygon = convex hull of corner points ∪ junction).

### 2.6 Room detection (faces of a planar graph)

```
function detectFaces(graph):
  build half-edges: for each wall (a,b) create h(a→b), h(b→a)
  for each vertex sort outgoing half-edges by angle
  next(h: u→v) = the outgoing half-edge at v that is immediately clockwise from twin(h) (v→u)
  traverse unvisited half-edges following next() → cycles
  compute signed area of each cycle (on junction centrepoints)
  faces with positive area (CCW, per our y-down convention verify sign in tests) = interior faces
  discard the single unbounded outer face per connected component
  discard faces whose area < 0.25 m² (configurable) → not rooms
  return faces as ordered junction-id cycles
```
- Dangling walls (dead ends inside a room) appear twice in a cycle; that's allowed (room with a partition stub).
- Holes (a free-standing room inside another, not connected) are separate components: the inner component's outer face becomes a hole in the containing room → handle with point-in-polygon containment between components.
- **Room interior polygon** = offset the junction cycle inward by each wall's half-thickness (use the mitered footprint corners from §2.5 rather than a generic polygon offset → consistent with 3D).
- **Area** shown to user = area of the interior polygon (shoelace), in m² with 2 decimals; documented as "carpet area (inside walls)".

### 2.7 Room identity across edits (keeping names/materials)
After any change, recompute faces and match new faces to old rooms:
1. Exact match on junction-cycle set → same room id.
2. Otherwise match by maximum polygon overlap (IoU ≥ 0.5) → inherit id and properties.
3. A split room: largest piece keeps the id, other gets a new id copying properties.
4. A merge: the larger old room's id survives.
Unmatched old rooms are deleted; this happens inside the same command so undo restores them exactly.

### 2.8 Openings
- Position is parametric (`offset` along host wall), so moving a junction moves openings with the wall automatically.
- When wall length changes: keep `offset` ratio if `keepRelative` else keep absolute offset from `a`; then clamp to I7; if it cannot fit, the command fails with "Door no longer fits on wall".
- When a wall is split by normalization: re-host the opening to the piece that contains its centre; if it straddles the split junction → reject the edit (or move the junction? no — reject; explicit is better).

### 2.9 Snapping
Priority order (first hit within tolerance wins; tolerance is in **screen px** so it feels the same at any zoom):
1. Existing junction (12 px)
2. Point on existing wall centreline (8 px) → creates T-junction
3. Extension/alignment guides: same X or Y as another junction (6 px), shown as dashed line
4. Angle snap of the segment direction (every 15°) with length unchanged
5. Grid (grid size adapts to zoom: 10 / 50 / 100 / 500 / 1000 mm)
Result is always rounded to integer mm.

### 2.10 Hit testing
Spatial hash grid (cell 1 000 mm) of walls, junctions, openings, furniture footprints. Pick order: junction handles > openings > furniture (OBB test, top-most first) > walls (distance to centreline ≤ thickness/2 + 4 px) > rooms (point in polygon).

### 2.11 Editing interactions
| Action | Mouse/keyboard | Touch |
|---|---|---|
| Draw wall | click points, Esc/double-click to end, type length + Enter | tap points with loupe offset; "Done" button |
| Select | click | tap |
| Multi-select | Shift+click, drag marquee | long-press "Select mode" then taps |
| Move | drag | drag (after 150 ms hold to avoid conflict with pan) |
| Rotate furniture | handle drag, R = +15°, Shift = free | rotate handle; two-finger rotate only on selected furniture |
| Delete | Del | trash in context menu |
| Undo/redo | Ctrl+Z / Ctrl+Shift+Z | buttons in toolbar |
| Precise values | property panel | bottom sheet with numeric keypad |

During drags we apply **preview transactions** (not pushed to undo stack) and commit one command on release. Preview runs normalization only for affected walls; full validation on commit.

#### 2.11.1 Keyboard shortcuts (desktop web)
| Key | Action |
|---|---|
| W / R / D / O / F | Wall tool / Room-rectangle / Door / Opening (window) / Furniture catalog |
| V or Esc | Select tool / cancel current drawing |
| Enter | Confirm typed length or value |
| Del / Backspace | Delete selection |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z (or Ctrl+Y) | Undo / redo |
| Ctrl/Cmd+C, V, D | Copy / paste / duplicate |
| Ctrl/Cmd+A | Select all furniture on current floor |
| Arrow keys (Shift = ×10) | Nudge selection 10 mm (100 mm) |
| Q / E | Rotate selected furniture −15° / +15° |
| Shift (hold) | Disable snapping while dragging |
| Space + drag, mouse wheel | Pan / zoom |
| 2 / 3 / Tab | 2D view / 3D view / toggle |
| G (in 3D) | Toggle walk mode; WASD move, mouse look, +/− eye height |
Touch equivalents are buttons in the toolbar/context menu (every action reachable without a keyboard, NFR-009).

#### 2.11.2 Constraint handling
Hard constraints (command rejected if violated): invariants I1–I7 (§2.3); thickness 50–600 mm; height 1 000–6 000 mm; opening fits host wall; furniture size > 0.
Soft constraints (allowed, warned): furniture overlap (FR-017); furniture outside any room; door swing hitting furniture.
Edit-propagation rules when one value changes:
- **Wall length edit:** the user picks which end moves (a, b, or both symmetric). The moving junction keeps its other walls attached, so their lengths and angles change. If any other wall would fall below 10 mm or cross another wall, the command is rejected and the conflicting wall is shown.
- **Room W×D edit (rectangle rooms):** the room's two right-side or two bottom-side junctions move. Neighbouring rooms that share those walls resize too, and a preview shows this before commit.
- **Angle lock:** walls drawn at 0°/90° keep their angle when a connected junction moves, unless the user drags with Shift. This is implemented by moving the neighbour junction along the wall's axis, not by a general solver.
- No general constraint solver in v1 (dimensions "driving" geometry like CAD). This is a deliberate scope limit (Doc 9 §6).

### 2.12 What needs custom code vs libraries

| Piece | Custom | Library |
|---|---|---|
| Vectors, segment intersection, orientation | Custom (small, tested) | — |
| Wall graph, normalizer, mitering, faces, room identity | **Custom** | none suitable |
| Polygon triangulation (floors, ceilings) | — | `earcut` (ISC) or Three.js `ShapeUtils` (uses earcut) |
| Polygon boolean/offset (only if needed for advanced features) | — | Clipper2 port (verify license of chosen JS port) |
| Spatial index | Custom grid (simple) or `rbush` (MIT) | |
| Property-based testing | — | `fast-check` (MIT) |

### 2.13 Failure scenarios to test (feeds Doc 8)
Drawing a wall exactly over another; T-junction onto wall with a door at that point; dragging a junction across another wall (must split, not cross); closing a loop with 0.4 mm gap (must snap/merge); 1-mm wall; 179.9° nearly straight junction; 5 walls at one junction; deleting a wall that splits a room; undo after normalization merged walls; very large coordinates; NaN input from bad numeric parse.

## 3. 3D engine

### 3.1 Engine comparison

| Criterion | Three.js | Babylon.js | React Three Fiber | Unity | Godot |
|---|---|---|---|---|---|
| License | MIT | Apache-2.0 | MIT | Proprietary (runtime fee terms changed over time — verify) | MIT |
| Web/WebView fit | Excellent, small | Excellent, larger bundle | Wraps Three.js | Web export heavy (WASM, large download) | Web export exists, large; mobile web weaker |
| Shares code with 2D web editor | Yes (same TS app) | Yes | Yes | No (C#, separate app) | No (GDScript/C#) |
| Proven in this product category | Yes — blueprint3d (MIT) and many web planners; note Planner 5D's own Android app appears native (Doc 1 §1.2) | Yes (many configurators) | Same as Three.js | Yes (native apps) | Less |
| Claude Code suitability | Very high (huge corpus, stable API) | High | High, but declarative layer adds lifecycle subtleties for imperative incremental updates | Medium (editor-centric, scenes are binary/YAML, hard to test headless) | Medium |
| Mobile perf | Good if budgets respected | Good | Same as Three.js + React reconcile overhead | Best native perf | Good native |
| **Verdict** | **Chosen** (ADR-006) | Strong alternative | Use for UI-only overlays at most | Reject for v1 | Reject for v1 |

### 3.2 Scene graph

```
Scene
 ├─ Lights: HemisphereLight (ambient), DirectionalLight "sun" (+ shadow on Mid/High)
 ├─ Floor_<floorId>  (Group, y = floor elevation)
 │   ├─ Walls  (Group) → one Mesh per wall (merged per-material groups on Low tier)
 │   ├─ Floors (Group) → one Mesh per room
 │   ├─ Ceilings (Group, hidden in orbit "doll-house" mode)
 │   ├─ Openings (Group) → door/window GLB instances
 │   ├─ Furniture (Group) → GLB instances / InstancedMesh for repeated items
 │   └─ Electrical (Group, v1.1) → small icons/meshes
 ├─ Helpers: selection outline, grid, measurement labels (CSS2D or sprite)
 └─ Camera (Perspective) + controls (Orbit | Walk)
```
Each mesh has `userData.entityId` for picking and incremental updates.

### 3.3 Wall mesh generation (no CSG)
Openings are cut by building the wall **face as a 2D shape with rectangular holes** on the wall's local (length, height) plane, then extruding through thickness using the mitered footprint for the ends:

```
function buildWallMesh(wall, footprint, openings):
  // local frame: u along a→b (0..L), v up (0..H), w across thickness
  outer = rectangle(0,0,L,H)
  holes = openings.map(o => rect(o.offset - o.width/2, o.sill, o.width, o.height))
  front = triangulate(outer, holes)            // earcut
  back  = same, offset by thickness, using footprint corners for left/right ends (mitered)
  sides = quads for: top edge, mitered end faces, and the 4 reveal faces of each hole
  uv: u,v in metres × material.scale  (world-scale texture so tiles don't stretch)
  groups: front=leftMaterial, back=rightMaterial, top/reveals=wall-edge material
```
Because ends use the same footprint corners as the 2D drawing (§2.5), 2D and 3D always agree. Avoiding CSG libraries keeps it fast (< 1 ms per wall, target to be measured) and deterministic.

Floors: triangulate room interior polygon (earcut) at room floor elevation; ceilings at `ceilingHeight`, normals flipped. Skirting boards (later) are extrusions along the interior polygon.

### 3.4 Materials & lighting
- `MeshStandardMaterial` (PBR metal/rough) everywhere; material library entries = {baseColor, map (KTX2), normalMap (optional, Mid/High only), roughness, metalness, uvScale}.
- Lighting: Hemisphere + Directional sun; optional environment map (small 256 px PMREM from a neutral studio HDR, CC0 from Poly Haven — verify license per asset) on Mid/High.
- Tone mapping ACESFilmic (or AgX if available in the chosen Three.js version), sRGB output.
- Anti-aliasing: MSAA via WebGL2 `antialias: true` on Desktop/Mid; off on Low with pixel ratio 1.
- Light fixtures in v1 are **visual only** (emissive material); real per-fixture lights are expensive on mobile — at most 0–2 dynamic point lights on High.

### 3.5 Performance techniques
| Technique | Where |
|---|---|
| `InstancedMesh` for repeated catalog items (chairs) | Furniture with ≥ 3 copies |
| Geometry merging per material for static walls on Low tier | Walls/floors |
| LOD: catalog assets ship LOD0 (≤ 20k tris) and LOD1 (≤ 3k tris) + 2D icon | Asset pipeline |
| KTX2/Basis textures (GPU-compressed) | All textures |
| Meshopt / Draco geometry compression | GLB delivery |
| Frustum culling (Three default) + room-based visibility in walk mode | Large plans |
| Render on demand (only when something changed or camera moved) | Battery |
| Dispose geometry/material/texture on removal; ref-counted asset cache | Memory |

### 3.6 Navigation
- **Orbit**: OrbitControls with limits: polar angle ≤ 85° (no under-floor), distance 1–200 m, target clamped to plan bbox. Touch: one finger rotate, two finger pan/zoom.
- **Walk**: eye height 1 600 mm; on-screen joystick (touch) / WASD; collision against 2D wall segments with radius 250 mm (cheap 2D circle-vs-segment test; door openings excluded from colliders); no physics engine needed.
- Camera transitions animated ≤ 400 ms; respect `prefers-reduced-motion`.

### 3.7 Asset pipeline
```
source (GLB/FBX/OBJ from licensed source)
 → tools/asset-pipeline: gltf-transform
     - validate (glTF-Validator: 0 errors)
     - normalize: metres, Y-up, origin at bottom-centre of footprint, facing −Z (front)
     - weld, simplify to LOD0 ≤ 20k tris, LOD1 ≤ 3k tris
     - textures → KTX2 (UASTC for normal maps, ETC1S for colour), max 1024/2048
     - meshopt compress
     - render thumbnail (headless Three.js) 256×256 webp
     - compute footprint (W,D,H) mm
 → upload to R2 under content-hash path (immutable caching)
 → catalog.json entry {id, name_en, name_hi, category, tags, dims, lods[], thumb, license{source,url,type,attribution}, tier: free|premium}
```
Every asset must have a license record; build fails without it (AST-01).

### 3.8 Realistic performance targets & assumptions
See PRD-NFR-001..006. Assumptions: sample project size as defined; Chrome-based Android System WebView current version; no other heavy apps open.

**Named reference devices (PROPOSED, chosen from India market data in Doc 1 / source log; buy or borrow and record the exact model, RAM, GPU, Android and WebView version before testing):**
| Tier | Device class to use | Why |
|---|---|---|
| Low | Samsung Galaxy A0x series or Redmi A-series (≈ ₹7–10k, 3–4 GB RAM) | Budget phones are a large share of Indian users; the segment is shrinking but large (IDC/press, 2026) |
| Mid | Samsung Galaxy A3x/A5x series (≈ ₹20–30k, 6–8 GB RAM) | Samsung A-series named as Samsung's growth driver in India (press, 2026) |
| Desktop | Any 2020+ laptop with integrated GPU, Chrome stable | Web version |

**Competitor context:** Planner 5D's Android app appears to use a native graphics stack (Kotlin + OpenGL/Vulkan/Filament per job ad, Doc 1 §1.2). Our WebView approach therefore carries a real risk of a performance gap. Phase 0 must compare our Capacitor build against **Chrome on the same phone** and against Planner 5D's app (subjective smoothness, recorded on video) on the same Low and Mid devices. **Unvalidated** until Phase 0 benchmark; if Low device fails, fallback is reduced pixel ratio, no normal maps, merged walls, and finally "2D-first mode" with on-demand 3D snapshots.

## 4. Single source of truth & synchronization

### 4.1 Principle
There is exactly one mutable thing: the **ProjectModel** inside `core-model`. 2D and 3D are pure projections of it. Neither renderer stores authoritative data; they keep *caches* keyed by entity id + entity revision.

```mermaid
sequenceDiagram
  participant U as User (2D or 3D)
  participant T as Tool (UI)
  participant C as CommandBus (core-model)
  participant V as Validator/Normalizer
  participant M as ProjectModel (immutable snapshots)
  participant D as Dependency resolver
  participant R2 as 2D renderer
  participant R3 as 3D renderer
  participant P as Persistence
  U->>T: drag junction (pointer events)
  T->>C: preview(MoveJunction{id, to})
  C->>V: apply on draft
  V-->>C: ok + changedIds (walls, junctions, openings, rooms)
  C->>M: new snapshot (preview, not in history)
  C->>D: changedIds
  D-->>R2: dirty set
  D-->>R3: dirty set (throttled to 1/frame)
  U->>T: release
  T->>C: commit(MoveJunction)
  C->>M: snapshot + push inverse patch to history
  C->>P: journal append (debounced 500 ms)
```

### 4.2 Command pattern
```ts
interface Command { type: string; apply(draft: Draft): void }        // uses Immer-style draft
interface CommitResult { ok: boolean; errors?: ValidationError[]; changed: Set<Id>; patches: Patch[]; inverse: Patch[] }

function execute(cmd: Command, model: ProjectModel): CommitResult {
  const [next, patches, inverse] = produceWithPatches(model, d => { cmd.apply(d); normalize(d, touched(d)); recomputeRooms(d); });
  const errors = validateAll(next, affected(patches));
  if (errors.length) return { ok: false, errors, changed: new Set(), patches: [], inverse: [] };
  commitSnapshot(next); history.push({ cmd: cmd.type, patches, inverse });
  return { ok: true, changed: idsFromPatches(patches), patches, inverse };
}
```
Undo = apply `inverse` patches; redo = apply `patches`. Because normalization and room recomputation happen **inside** the command, their effects are part of the patch, so undo restores the exact prior state (including merged walls and room ids). Immer (MIT) provides `produceWithPatches`.

### 4.3 Dependency graph (what to rebuild)
| Changed entity | Also dirty |
|---|---|
| Junction | incident walls → their openings; walls of neighbouring junctions (miters); rooms touching |
| Wall | its two junctions' incident walls (miters), openings, adjacent rooms (floor/ceiling polygons) |
| Opening | host wall mesh, opening instance |
| Room props | room floor/ceiling mesh |
| Furniture | that instance only |
| Material definition | all meshes using it (material swap only, no geometry rebuild) |

### 4.4 Renderer update loop
```
on changed(ids):
  dirty ∪= expand(ids)                  // §4.3
  scheduleFrame()
frame():
  for id in dirty:
    e = model.get(id)
    if !e: removeAndDispose(id)
    else if cache[id].rev !== e.rev: rebuild(id)
  dirty.clear(); render()
```
Each entity has `rev` (incremented in the command). A **consistency check** in dev/test builds compares `hash(model-derived geometry)` with `hash(rendered geometry)` after each frame (SYNC tests).

### 4.5 Example: user drags a wall in 2D (the 8 steps)
1. Tool computes new junction positions for both endpoints (parallel move) → `MoveWall` preview.
2. Normalizer splits/merges if the wall now crosses another; incident walls' miters recomputed (derived).
3. Rooms recomputed; identity matched (§2.7); validator checks invariants I1–I7.
4. Openings on moved/resized walls re-clamped; failure → preview shows red and commit will be refused.
5. Dirty set → 3D rebuilds only those walls, neighbours, floors/ceilings of affected rooms, and opening instances.
6. Room area labels update in 2D from derived polygons.
7. On release: commit → history push → journal append → autosave snapshot (debounced).
8. Undo applies inverse patches → same dirty-set mechanism restores both views.

### 4.6 Preventing 2D/3D inconsistency
- Renderers have no write API to the model (enforced by package boundaries).
- Both renderers consume the **same derived geometry functions** (footprints, room polygons) from `geometry/`.
- Deterministic derivation: same model JSON → same derived output (tested by hashing).
- Snapshot tests: load fixture → render headless → compare entity-level geometry hashes.

## 5. Persistence & recovery
- Snapshot (full JSON, gzip) every 30 s of activity or 50 commands; journal (commands as patches) between snapshots.
- On start: load latest snapshot + replay journal; if replay fails validation, open last good snapshot and keep the broken file in `recovery/` for support.
- Writes are atomic: write to temp key/file then rename/swap pointer.

## 6. Electrical layer (differentiator, v1.1)
Competitive context (Doc 1 §2.6):
- Planner 5D lets users place sockets and switches as objects, with no wiring.
- Homestyler auto-generates circuits.

So our value is the **Indian workflow plus a priced bill of quantities**, not "points on a plan".

Entities: `ElectricalPoint {id, kind: switchboard|socket6A|socket16A|light|fan|ac|geyser|inverter|db|tv|data, mount: 'wall'|'ceiling', wallId?, offset?, roomId?, position?, height, modules? (switchboard size), label?}`.
- Wall points use (wallId, offset, height) like openings, so they move with walls.
- Ceiling points (fans, lights) use roomId plus a position inside the room polygon; they are re-validated when the room changes. This fixes audit gap A-06.

Output: per-room counts, then a bill of quantities. The BOQ maps each point kind to shop SKUs (e.g. modular plate size, socket type, MCB rating for a DB) and prices them from a CSV price list that the shop owner can edit.

**No load calculation, wire sizing, auto-routing or code-compliance claims in v1** (liability). The output says "for estimation; final design by a licensed electrician".

## 7. User flows (Part J)

Each row gives: **Entry** · **Screens** · **Actions → system response** · **Loading** · **Error → recovery** · **Success**.

| # | Flow | Entry | Screens | Actions → system response | Loading | Error → recovery | Success |
|---|---|---|---|---|---|---|---|
| F1 | First-time onboarding (FR-038) | First app launch | Splash → 3 cards → editor with coach marks | Swipe/skip → coach mark "tap 4 corners" → room appears with area | Splash ≤ 2 s; catalog thumbnails lazy-load | WebGL unavailable → "3D not supported on this phone, 2D works" banner; skip always available | First room created (analytics `room_closed`) |
| F2 | Create blank project (FR-001) | Project list "+" | Name & units sheet → editor | Enter name, pick metric/imperial → empty 2D canvas with grid | Instant | Storage write fails → "Phone storage full" + export/clear-space help; project stays in memory | Project listed after restart |
| F3 | Create a room (FR-005) | Room tool | 2D editor + W×D sheet | Drag rectangle or type 3600 × 3000 → 4 walls + room label + area | — | W or D < 300 mm → field error, nothing created | Room with correct area (GEO-03) |
| F4 | Draw custom walls (FR-002/003/004) | Wall tool | 2D editor with loupe | Tap points; length bubble live; type exact length; tap first point → loop closes → toast "Room added: 12.4 m²" | — | Invalid geometry → wall red + reason; command rejected, model unchanged; undo available | Closed room detected |
| F5 | Precise dimensions (FR-004/007) | Select wall | Bottom sheet | Edit length/thickness/height; choose which end moves (a/b/both) → connected walls follow | — | Door no longer fits → error "Door D1 doesn't fit", value reverts | Stored value = typed value (GEO-06) |
| F6 | Doors/windows (FR-008/009) | Catalog "Doors & Windows" | Catalog → editor | Drag onto wall (valid walls highlight) → offset handles + distance to corner | GLB placeholder frame until loaded | Dropped off-wall or overlapping → snaps back with message | Hole visible in 3D (SYNC-03) |
| F7 | Add furniture (FR-014/015/043) | Catalog | Catalog sheet → editor | Search/category → tap places at view centre or drag → back-to-wall snap near walls | Box with dimensions until GLB loads | Download fails → retry icon on box; box keeps size so layout work continues | Item in 2D and 3D at same transform |
| F8 | Edit furniture dimensions (FR-016) | Select item | Property sheet | Edit W/D/H, lock-proportions toggle → model rescales | — | Value ≤ 0 or > 10 m → field error | Bounding box = entered size |
| F9 | 2D → 3D (FR-019) | Toggle (phone) / split view (tablet) | 3D view | Scene builds from model; selection carried over | Walls/floors immediate; furniture streams in; progress chip | Context lost → "Restoring 3D…" auto-rebuild; if it fails twice → 2D-only mode message | 3D hash = model hash |
| F10 | Navigate 3D (FR-020/021) | 3D view | Orbit; "Walk" button | Drag rotate, pinch zoom, two-finger pan; Walk = joystick + look | — | Camera stuck/lost → "Reset view" button | Can't pass through walls in walk mode |
| F11 | Change materials (FR-018) | Select wall side/floor (2D or 3D) | Material grid sheet | Tap swatch → applied | Texture placeholder colour until KTX2 loads | Texture fails → base colour kept, retry | Change persisted after reload |
| F12 | AI redesign (FR-032, v2) | 3D view → "AI Style" | Style picker → consent (first time) → progress → gallery | Choose style → cost in credits shown → job starts | Progress with cancel, ≤ 60 s target | Timeout/refusal/offline → message, **no credits charged**, retry | Image saved, labelled "AI image, not your exact furniture" |
| F13 | Save & reopen (FR-022/023) | Automatic; project list | Editor status icon; recovery dialog | Every edit autosaved locally; cloud icon: saved/saving/offline/conflict | Opening large project: progress bar | Journal newer than snapshot → "Restore unsaved changes?"; cloud conflict → "Conflicted copy created" | Reopened project identical (SYNC-07) |
| F14 | Duplicate project (FR-024) | List ⋮ | — | Duplicate → "Copy of X" with new IDs | — | Storage full → message, original untouched | Both projects open independently (REL-03) |
| F15 | Export (FR-025) | ⋮ → Export | Format sheet → Android share sheet | PNG (free, watermark) / PDF (Premium or watermarked free, see PRD §15) | Rendering progress | Out of memory → lower resolution offered | File shared to WhatsApp etc. |
| F16 | Upgrade (FR-029) | Premium item/feature tap | Paywall → Play Billing sheet | Plan comparison with renewal terms → purchase → entitlement refresh | "Processing purchase…" for pending | Cancelled → back unchanged; pending → keeps checking, restore button | Premium unlocked ≤ 10 s (MON-01) |

Responsive layouts: **Phone portrait** — full-screen canvas, bottom toolbar, bottom-sheet properties, 2D/3D toggle. **Tablet/landscape** — left tool rail, right properties panel, optional split 2D|3D. **Desktop web** — same as tablet plus keyboard shortcuts and hover states.
