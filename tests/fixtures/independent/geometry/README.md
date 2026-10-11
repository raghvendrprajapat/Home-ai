# Independent geometry fixtures (PH0-T02a)

**Written by:** Claude Code (second checker), before the geometry code exists (decision D8).
**Used by:** PH0-T02 (geometry core) and the later tasks named in each case's `earliestTask`.
**Spec:** `docs/combined-research.md` §E.1, §E.4–E.8, §H.6, Part M (GEO-001…006, GEO-010, GEO-011, GEO-016, GEO-021); decisions D11, D12, D14, D15 in `docs/codex-start-here.md`.

> **Rule for the builder (AGENTS.md §5):** never edit, delete or weaken anything in this folder to make code pass.
> If a case looks wrong, explain why in the PR (with your own arithmetic) and ask the owner. The other agent then re-checks it.

Every expected value was calculated by hand from the spec; the `arithmetic` field of each case shows the working.
None of the values was produced by running geometry code.

## Files

| File | What it checks | Spec tests |
|---|---|---|
| `sample-project.json` | Faces, face orientation, clear (carpet) areas of the H.6 sample; area after moving the partition | GEO-001, GEO-010, DM-003 geometry |
| `two-squares.json` | F-TWO-SQ: two 4 m rooms; east side moved +500 mm; door threshold not counted in rooms | GEO-010 |
| `footprint-area.json` | Area covered by walls (footprint union) incl. T-junctions and mixed thickness | GEO-006 (L0) |
| `t-junction.json` | Wall endpoint on another wall's interior (and the reverse) splits at one shared junction | GEO-003, GEO-004 |
| `rejections.json` | X-crossings and non-orthogonal walls rejected atomically in L0 (add and move) | GEO-003 |
| `collinear-overlap.json` | Collinear overlaps (25 %, contained, duplicate, reversed duplicate, different thickness) | GEO-005 |
| `segments-and-limits.json` | 9/10/11 mm walls; coordinate domain; NaN; fractional coordinates; thickness and height limits | GEO-016, I2, I8, D11, D15, §E.12.2 |
| `closing-gap.json` | A raw 0.4 mm closing gap closes the loop on the existing junction | GEO-016, D15 |
| `split-merge.json` | A partition splits a room; deleting it merges the rooms; room identity rules | GEO-011 (geometry part), §E.8 |
| `small-rooms.json` | Rooms below / at / above 0.25 m² clear area; zero or negative usable space rejected | GEO-021, D12 |

## Data format

Each file is JSON: `{ "fixtureSet", "specRefs", "cases": [...] }`. Each case has:

| Field | Meaning |
|---|---|
| `id` | Unique case ID, e.g. `SAMPLE-01` |
| `tests` | Spec test IDs this case serves |
| `earliestTask` | First task that must wire this case into an automated test. A case for a later task must not be dropped; it is wired when that task is built |
| `description` | Plain-English summary |
| `plan` | Input model: `junctions` (`id`, `x`, `y`, integer mm) and `walls` (`id`, `a`, `b`, `thickness`, `height`), optional `rooms` (`id`, `boundary`, `name`). Omitted fields (`floorId`, materials, `rev`) are filled by the test adapter with `"f0"`, `"m_default"` and `0`. Coordinates follow §E.1: X east, **Y south (down)**. A string instead of an object refers to another plan: `"same as <caseId>"` (same file), `"same as <file> <caseId>"`, or `"result of <file> <caseId>"` (the model after that case's operation) |
| `operation` | What to do (see below) |
| `expect` | Expected result (see below) |
| `arithmetic` | Hand calculation, line by line |

### Operations

| `op` | Meaning |
|---|---|
| `analyze` | No change. Compute faces, clear areas and footprints of `plan` |
| `validate` | Validate `plan` as a saved/loaded model (hard constraints I1–I8, D11, D15, §E.12.2) |
| `addWall` | Add one wall from `from` to `to` (integer mm) with `thickness` and `height`, then normalize (§E.5). If an endpoint lies exactly on an existing junction, that junction must be reused |
| `addWallRaw` | Same, but `from`/`to` are raw pointer values (floats). They are quantized to integer mm first (D15), then treated as `addWall` |
| `moveJunctions` | Move all listed junctions to the new integer positions **in one atomic command** |
| `deleteWall` | Delete the named wall, then normalize and recompute rooms |

### Expectations

| Field | Meaning |
|---|---|
| `accepted` | `true` = the command succeeds / the plan is valid. `false` = rejected |
| `modelUnchanged` | With `accepted: false`: the canonical model (IDs, values, order) is identical to the input. Also used for "accept or reject, either is fine, but the result equals the input" |
| `wallCount`, `junctionCount`, `faceCount` | Counts after the operation. `faceCount` counts bounded faces (rooms), never the outer face |
| `faces[].corners` | The face's corner points in order. **Orientation rule (GEO-001):** a room face listed in this order has a **positive** signed area `½·Σ(xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)` in model coordinates (Y down), i.e. clockwise on screen, the same order as the rooms stored in `docs/examples/sample-project.json`. Compare as a cyclic sequence (any start corner, same direction). Junctions that lie on a straight edge between two corners (collinear, e.g. T-junction stems on the other side) are not corners and must be ignored |
| `faces[].centrelineSignedAreaMm2` | Signed shoelace area of the corner polygon (centrelines) with the orientation above |
| `faces[].clearRect` | `[minX, minY, maxX, maxY]` of the clear (inside-walls) rectangle; multiples of 0.5 mm |
| `faces[].clearAreaMm2` | Unrounded clear (carpet) area in mm² (D14) |
| `faces[].smallSpaceWarning` | D12: `true` iff 0 < unrounded clear area < 250 000 mm² |
| `faces[].roomId` | Expected room ID after the operation; `"<new>"` means a newly generated ID (not any old ID) |
| `junctionsAt[]` | `{at, id?, degree}`: there is exactly one junction at `at`; if `id` is given it must be that existing ID; `degree` = number of walls meeting there |
| `wallsAlongLine` | For collinear checks: walls on the line, their merged coverage `union`, `totalLength` (sum of wall lengths, so overlap would show as a larger number) and `idsPresent` (old IDs that must still exist) |
| `wallIdOn[]` | `{from, to, id}`: the wall covering exactly this segment (direction ignored) has this ID (lineage rule: the older ID stays on the longest piece) |
| `changedWalls`, `unchangedWalls` | Walls whose geometry must / must not change |
| `footprintUnionAreaMm2` | Area of the union of all wall bodies and junction caps (§E.6) |
| `outerBoundaryRect` | `[minX, minY, maxX, maxY]` of the union of all wall footprints |
| `thresholdAreaMm2` | Area of a door threshold quad (opening width × wall thickness). `operation.withOpening` adds that opening for the analysis |
| `faces[].displayLabelM2` | Expected label text: clear area in m² with 2 decimals (§E.7), rounded half up. Tested separately from the exact area (D14) |
| `newRoomCopiesPropertiesFrom`, `checkRoomNamesHint` | §E.8 split rule: the new room copies the old room's properties and the user sees a "check room names" hint |
| `errorKind` | With `accepted: false`, a hint of the reason (free text; tests may ignore the wording) |

### Tolerances

- Areas: |actual − expected| ≤ 1 mm² (D14, GEO-010). Rounded m² labels are a separate test.
- `clearRect` values: ≤ 0.001 mm (they are exact multiples of 0.5 mm).
- Junction coordinates and wall lengths: exact integers.
- Counts, IDs, `accepted`, `smallSpaceWarning`: exact.

### NaN in JSON

JSON has no NaN. A coordinate written as the string `"NaN"` must be converted by the adapter to `Number.NaN` before validation.

## Open question (no fixture written)

§E.6 says "a free end gets a square cap" but does not say whether the cap is flush with the end junction or extends by thickness/2 beyond it. That changes footprint area and the clear area of rooms that contain a dead-end stub. No case here depends on it. **Owner decision needed before a free-end fixture is written.**

## Not covered here (later fixture sets)

Openings and host rules (PH2-T04a), undo/commands and generations (PH0-T03), snapping priorities and pixel tolerances (PH2-T03), angled walls and 4+ wall junctions (not L0), save races (PH5-T03a).
