# D44 — shared wall solids and furniture spatial geometry (PH4-T03 stage C2a)

2026-10-15 · Codex under D17, subject to D36. Depends on PR #90, exact `c96c9d6614fd8c4c69bd12aad0183e5d473eb644`, Check/Android SUCCESS in run38788811199; merge `48e0881f4d547a7caeb0c1a3b31a2c9226c8301e`. Initial red CI and its stronger lifecycle preconditions remain recorded in verification/ph4-t03c1.md.

## Shared geometry, no renderer state in the model

`render3d/solids.ts` extracts the complete existing CPU height-band wall union. Derived tuples explicitly mean **[east mm, up mm, south mm]**. Cut openings on each host before union ownership; cancel opposite internal faces; preserve full face ordering and the existing shared2Mwork/100krawsurface limits. Mesh material assignment stays at consumption, with the original left/right rule, compaction, shared-edge dependencies and triangulation. `mesh.ts` preserves its openingRect/subtractRectangle exports. This is pure CPU geometry, without Three/DOM or canonical writes.

The helper accepts read-only model snapshots. The legacy pure `wallStrips` signature still requires a mutable Plan type, so a single documented structural cast adapts that read-only boundary; no input mutation is performed. Direct frozen-snapshot tests and unchanged serialized inputs cover it.

An advisory-owned `WallSolidsCache` keys ordered floors/elevations, junctions, wall geometry and opening dimensions. Furniture, paint definitions, wall finish IDs, names and generation counters do not rebuild the structural union. Cached arrays, tuples and faces are frozen. Array order remains relevant because partition material ownership uses it. Material binding is deliberately absent from this cache, preventing stale paint references.

## Collision and alignment contract

`editor/furniture-spatial.ts` derives oriented dimension boxes. Four-axis SAT and positive vertical interval overlap classify wall/furniture penetration; tangency is clear. Derived comparison tolerance is1e−7mm, not a canonical quantization rule. Same-floor furniture and floor elevation are respected. Preview clones exclude self by canonical ID. Wall collision uses actual cut solid boxes: doors/windows remain void, while sill/lintel/perpendicular solids still count. Only the chosen object is compared with solids/other objects, not all global pairs. Dimension boxes are conservative asset envelopes, not mesh-triangle collision.

Back alignment translates **cardinal** objects only, with FRONT=(sinθ,−cosθ), BACK=(−sinθ,cosθ). The back must oppose the exposed wall's free-space normal. No implicit rotation, angle approximation, centreline snap or unlimited teleport. Caller supplies a finite maximum movement. An optional stable prior key resolves eligible ties.

Longitudinal support is recorded from **each host's post-opening pieces at each active height band**, keeping only the original longitudinal planes. Actual strips retain free-cap/L/T extensions while low neighbours exist, and recompute them above those neighbours. Support intersects real exposed union faces independently of material owner. A perpendicular cap cannot borrow a nearby wall's tangent range or a removed doorway's support. Jambs and end faces do not become side candidates.

Coplanar support retains the tangent×height union. The whole back span must be supported across a common positive height interval; complementary high/low patches cannot bridge a hole. Whole-body wall SAT then rejects intrusion into T stubs. Side-plane grouping/intersections are weakly cached by structural solids identity/floor. Snap rejection scans walls only, not furniture pairs.

Odd half-mm wall faces remain derived fractions. Compute centre=face+freeSpaceSign×depth/2; quantize toward free space (+ceil/−floor), then verify nonpenetration, full span and gap≤1mm. This handles positive/negative coordinates without saving fractional positions. Positive/negative odd/even depths and all four normals have analytic/property proofs.

## Scope and verification

This PR supplies the shared renderer and pure advisory foundation. **No new user-visible collision/snap controls yet.** C2b adds transient2D/3D warnings, pointer8/12px hysteresis and explicit200mm draft alignment; C3 adds actual3D pointer transformations. Warnings will remain nonblocking; draft/model edits still use atomic core commands. No advisory state is serialized or exported.

See [executed verification](../verification/ph4-t03c2a.md). Full pre/post scene-buffer parity is a refactor check, not an independent correctness proof; direct analytic/property tests complement it. Fresh read-only Codex identified two cap provenance faults, reproduced before fixes and covered after them. No accepted Claude fixture, dependency, schema, catalog or owner research changed. D36 work and physical/external/final-review gates remain pending.
