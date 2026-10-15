# PH4-T03 stage B — actual furniture models

2026-10-15 · See [D42](../decisions/furniture-models.md) and [machine-readable executed results](ph4-t03b-results.json). Base: PR #88 merge `da740234df4e9c5dff1f1b33ad305cc2b542e085`; its reviewed head1b47cfd had Check/Android SUCCESS in run38730499295.

## Implemented behavior

The original desk now renders its actual six-part,72-triangle GLB instead of a solid dimension box. Source selection is exact asset/version/LOD, never latest substitution. Grounded native coordinates,37/90degree yaw, uniform1.5scale/elevation and saved legacy per-axis sizes map through canonical dimensions. Three compatible copies share six InstancedMeshes (216placed triangles); dropping to two restores individual meshes sharing the same decoded geometry/materials. All parts and instance hits retain furniture IDs. Loaded objects leave fallback instance membership while canonical hidden boxes preserve selection outlines/framing.

Transport/decode failures leave dimensioned fallback boxes, expose bilingual status and explicit retry, and do not alter the drawing or structural scene acknowledgement. Status pages bound mounted rows at20 without hiding later recovery actions. Unsupported finishes/size discrepancies explain a nonretryable fallback. Source loading, transient state and retry never create history or saved model properties.

## Executed checks

| Check | Actual output/evidence |
|---|---|
| Final `pnpm check` | **54files /378product tests passed**,34.56s; **18tooling tests passed**,0failure/skip. Includes schema reproducibility, immutable original catalog/rights/version checks, boundaries/lint/types |
| Full browser run | **80passed (6.5m)**,0skip. Linux Chromium151.0.7922.173/SwiftShader. Full build preceded final legacy-size guard; focused23tests and fresh6probes covered that guard, followed by **7/7current browser cases passed (28.1s)**. Exact-final-head full CI remains a merge gate |
| Seven new browser cases | Actual72triangle/six-part GPU draw and closed ownership;503fallback/retry with unchanged completeJSON/generation; undo during delayed load;216triangle3copies→144triangle2copies; decode during pending/failed CPU cannot attach/acknowledge; ready previous-model lease survives CPU failure/deletion until view close; actual WebGL loss/restoration retains model and GPU counters |
| Production | initial gzip166112bytes/1module,600000-byte gate; test crash hooks absent |
| Android debug | **BUILD SUCCESSFUL in40s**;170tasks40executed130up-to-date; native9JUnit helper reports unchanged/cached,0failure/error/skip; lint0errors/15existingwarnings |
| Actual APK | 8114378bytes; SHA256`c78de69a09cfd7e3c446c775e46bad2e9e8f0cb055f869c15f5467aa85d54554`;16production files byte-equal; same-build decoded manifest/compiled plugin registration pass; signaturev2 verified |
| Protected inputs | **39files unchanged**,0hash mismatches; sample Draft2020-12 validation0errors |
| Fresh read-only Codex review | Current23focused cases passed1.17s;6independent temporary fault/guard probes passed322ms;0remaining blockers. No repository edits/push or Claude fixture authorship |

Permanent tests include the actual shipped GLB and ordered native axes/front drawer, bounded accessor/decode rejection, transform/property checks, final1mm guard, exact pin mismatch,4-owned-pipeline limit including cancelled unabortable parses, delete/retry/late-close fences, shared-resource/instance transitions, actual adapter ray/fallback membership and original/partial/late/close/collection disposer failures. Resource errors are counted; all independent owners are attempted even if another disposer throws.

The retained renderer lifecycle test performed36warm-up +50measured view cycles. Main-frame V8 growth was **5.145%**, below its10%threshold; closed base pools/GPU/worker/RAF ownership passed. This retained fixture uses the sample's unavailable legacy pins and is **not a loaded-catalog memory benchmark**. Actual loaded GLB close/reopen, instance transitions and context recovery are separately executed by the new cases. Neither result measures worker heaps, GPU/driver bytes, Android process memory, thermal behavior or physical Low/Mid performance.

## Diagnosed failures and fixes

The new Retry browser case exposed the wrong visible button label; fixed to model retry. A new copy test attempted existing2D-only controls while in3D; corrected the test to the real2D copy journey before3D Undo. The initial instance-failure injection intercepted Three's constructor setup before the tested ownership stage; corrected it to fail after allocation during matrix updates. No accepted test/fixture was weakened.

Fresh review independently reproduced cleanup faults: throwing instance disposal skipped subsequent close owners; throwing original GLTF disposal suppressed returned cloned ownership; collection stopped after one failed disposer. Aggregated independent cleanup, detached ownership and contained async disposal now have permanent regressions. A separate store observer remains active after worker failure so later deletions cancel loads. Status paging and nonretryable unsupported-finish handling address review findings. The final guard rejects amplified native tolerance beyond1mm while retaining compatible items and cached recovery.

## Remaining work and prospective phone steps

Issue32 remains open for stageC pointer move/rotate/nudge and back-to-wall/collision advisories. Material variants and the ~30-item original catalog follow PH4-T04/T05. Flat static untextured original assets only; no arbitrary imported models, texture/compression/R2 delivery or device proof.

**After owner permission under D36 only**, prospective Low/Mid checks: open a debug build, browse/place the original desk, enter37degrees/1.5scale/300mm elevation, switch3D, duplicate twice in2D, return3D and Undo; rotate camera, switch views, save/reopen and check Hindi; test a failed load/retry; record exact device/OS/WebView/build and timings. These steps were not run and are not authorization to run them.

Accounts/cloud/history, mobile optimization/direct sharing/real Low–Mid tests, billing/security/privacy/release packaging/final Claude review remain unstarted. CI uses a different pinned Chromium version; device/accessibility/native provider/external reviews remain open. Automated verification is scoped evidence, not a universal correctness guarantee.
