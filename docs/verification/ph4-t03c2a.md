# PH4-T03 stage C2a — shared solids and furniture math

2026-10-15 · [D44](../decisions/furniture-spatial-geometry.md) · [machine-readable results](ph4-t03c2a-results.json). Base PR #90 merged48e0881 after exactc96c9d6 Check/Android SUCCESS in run38788811199. Issue32 remains open.

## Executed evidence

| Check | Actual result |
|---|---|
| Final `pnpm check` |58files / **401product tests passed**,22.99s; **18actual tooling tests passed**,0fail/skip. Schema/artifact/immutable-version/lint/boundaries/types passed |
| Complete browser suite |**89passed (6.8m)**,0skip; localChromium151/SwiftShader. The run began after extraction and before the final advisory-only cap/provenance refinements; final runtime buffer parity and focused tests follow those refinements. Full exact-head CI remains a separate gate |
| Full scene parity |11pre-extraction source cases (sample plus5thicknesses×2hostdirections, nonzero elevation): every mesh position/normal/UV/group, order, bounds/warnings/statistics equal. Repeated after final runtime support fixes:1testpassed893ms. This checks refactor preservation, not independent correctness |
| New analytic/property proofs |14new cases across2files: SAT/rotatedAABBfalsepositive/tangency/vertical/floor; windowvoid/sill/lintel/hostcut; mm³volume/reversal/translation; half-mm four normals and odd/even depths; exact postcut support intervals by height; full-common-height support; both independent cap faults in both ownership orders; cache furniture/paint exclusion and structural invalidation |
| Production |initialgzip168250bytes/1module,600000byte gate; crash hooks absent |
| Android debug |**BUILD SUCCESSFUL in27s**,170tasks40executed130up-to-date;9unchanged/cached native helperJUnit reports0failure/error/skip; lint0errors/15existingwarnings |
| Same-build APK |8114378bytes, SHA256`9758b07be9bf86060ad1b8476cd25919d1c548e891cc2ff2c8dae14d112d5ea2`;16production webfiles byte-equal; freshly decoded manifest, compiled native registration andv2signature pass |
| Protected data |39protected file hashes unchanged/0mismatches; sample Draft2020-12 schema0errors |

The final opening helper signature adjustment is TypeScript-only; Android outputs above use the same runtime code. Full browser results are Linux/SwiftShader evidence, not actual phones, total memory, thermal or physical accessibility proof. Nine native helper reports are cached, not fresh device executions. Renderer lifecycle/resource assertions remain in the full suite; numerical counters are not measured whole-process/GPU-driver memory.

## Review and failure diagnoses

Fresh read-only Codex reproduced two real ProjectStore-valid alignment defects in temporary probes: (1) a whole exposed face inherited tangent eligibility from a partly overlapping short wall; (2) a perpendicular cap filling a doorway inherited support removed from its host. Both depended on actual geometry/ownership. Initial independent probe1failed; after tangent correction1passed/1failed; after per-host **post-cut** support,2/2passed. Final eleven-scene parity still matched. Permanent regression loops both wall-array orders and both short-wall/doorway cases. Final fresh review:27focused/3files passed1.09s and both independent cap regressions passed568ms; no remaining source blockers. No reviewer edited repository files or supplied Claude-authored fixtures.

New-test corrections: JSON-import kinds were widened to string and needed a typed model fixture; read-only snapshot helpers required read-only signatures. A new T-union test initially assumed a single owned partition covered a junction; it now checks analytic points on both sides. Subsequent side assertions incorrectly assumed uncut strip ends: exact expected intervals are now `[heightLow,heightHigh,tangentLow,tangentHigh]` = `[0,1500,−100,1000]`, `[0,1500,2000,2100]`, `[1500,2100,−100,1000]`, `[2100,3000,−100,2000]`. This follows independently known doorway1000..2000 and neighbour height1500. All accepted fixtures, prior thresholds and production budgets remain unchanged.

## Remaining gates / prospective device instructions

No new advisory UI is claimed. C2b will add visible warnings/back-edge controls; C3actual3D pointer gestures follow. Bigger original catalog, material editing and other eligible L0 gaps remain. No D36 account/cloud/history/mobileoptimization/sharing/realphone/billing/security/privacy/release/finalClaude preparation.

**Only after explicit owner D36permission**, prospective Low/Mid check: open a debug build, create rooms/openings, switch2D/3D, verify wall/window shapes and existing furniture gestures, Undo and reopen; compare Hindi layout and record device/OS/WebView/build. This foundation has no new button to test yet. Protocol is documentation only; not run and not approval. Real-phone, native-provider, accessibility, external and final Claude gates remain pending. No release-ready or universal correctness claim.
