# PH0-T01 dependency register

## PH1-T03 UI state (2026-10-12, recorded before installation)

| Dependency | Exact version | License / primary evidence | Purpose |
|---|---|---|---|
| zustand | 5.0.15 | MIT; [official version metadata](https://registry.npmjs.org/zustand/5.0.15) | UI navigation, locale and preferences only; canonical drawings stay in core-model |

Official metadata confirms React >=18 and existing React 19.3.0 compatibility; Immer, React/types and use-sync-external-store peers are optional. The default React hook reuses existing React. No router/i18n dependency is added: typed English/Hindi messages and existing browser APIs suffice for the three-screen shell. Inspect/inventory any actually added lock versions before installation. Product privacy and actual device tests remain separate.

## PH0-T08 local durability (2026-10-12, recorded before installation)

| Dependency | Exact version | License / primary evidence | Purpose |
|---|---|---|---|
| @capacitor/filesystem | 8.1.4 | MIT; [official metadata](https://registry.npmjs.org/@capacitor%2ffilesystem/8.1.4) | Private Android Data mirror; core >=8 is compatible with pinned 8.5.3 |
| @capacitor/synapse | 1.0.4 | ISC; [official metadata](https://registry.npmjs.org/@capacitor%2fsynapse/1.0.4) | Filesystem's resolved bridge helper |
| fake-indexeddb | 6.2.5 | Apache-2.0; [official metadata](https://registry.npmjs.org/fake-indexeddb/6.2.5) | Test actual IndexedDB transaction/CAS/abort behavior; never shipped as runtime |
| io.ionic.libs:ionfilesystem-android | 1.1.1 | MIT; [official Maven POM](https://repo.maven.apache.org/maven2/io/ionic/libs/ionfilesystem-android/1.1.1/ionfilesystem-android-1.1.1.pom) and [primary license](https://github.com/ionic-team/ion-android-filesystem/blob/main/LICENSE), API verified | Native implementation underneath Filesystem |
| Kotlin plugin / stdlib | 2.2.20 | Apache-2.0; official plugin build file / [primary license](https://github.com/JetBrains/kotlin/blob/master/license/LICENSE.txt) | Filesystem's native Kotlin build/runtime |
| kotlinx-coroutines | 1.10.2 | Apache-2.0; official plugin build file / [primary license](https://github.com/Kotlin/kotlinx.coroutines/blob/master/LICENSE.txt) | Native asynchronous file I/O |

Existing Immer 11.1.21 MIT is reused for replay. Filesystem's official npm archive integrity was verified before inspecting its native requirements. Its exact Maven source uses file close, and `renameTo` with copy/delete fallback: this is **not** a universal atomic-rename or fsync guarantee. The mirror will validate immutable files/commit markers and retain a previous copy; actual phone process-death, power-loss and OEM behavior remain separate evidence. New resolved npm versions must be inventoried before installation; complete native notices/security audit remains a release gate. No public/external storage permission or product secret is needed for private Data operations.

Filesystem is also declared directly by `apps/web`, because Capacitor CLI discovers the native plugins from the application dependencies, rather than a transitive workspace library. APK verification requires its actual registration and packaged class. A successful JavaScript import or APK compile alone does not prove native plugin availability.

## PH0-T03 schema and command history (2026-10-11, recorded before installation)

| Dependency | Exact version | License | Purpose | Evidence |
|---|---|---|---|---|
| immer | 11.1.21 | MIT | Immutable atomic updates and forward/inverse command patches | [Official metadata](https://registry.npmjs.org/immer/11.1.21) |
| ajv | 8.20.0 | MIT | Compile the accepted Draft 2020-12 project schema to reproducible standalone validation; no runtime dynamic code generation in the app | [Official metadata](https://registry.npmjs.org/ajv/8.20.0) |
| ajv-formats | 3.0.1 | MIT | RFC date-time validation in the generated schema validator | [Official metadata](https://registry.npmjs.org/ajv-formats/3.0.1) |
| fast-deep-equal | 3.1.3 | MIT | Ajv transitive schema/compiler dependency | [Official metadata](https://registry.npmjs.org/fast-deep-equal/3.1.3) |
| require-from-string | 2.0.2 | MIT | Ajv build-time standalone generation dependency | [Official metadata](https://registry.npmjs.org/require-from-string/2.0.2) |
| json-schema-traverse | 1.0.0 | MIT | Ajv build-time schema traversal | [Official metadata](https://registry.npmjs.org/json-schema-traverse/1.0.0) |
| fast-uri | 3.1.8 | BSD-3-Clause | Ajv's resolved 3.x URI parser | [Official metadata](https://registry.npmjs.org/fast-uri/3.1.8) |

Ajv is selected to use the existing authoritative JSON Schema rather than maintain a separate shape definition. Compile-time generation avoids `unsafe-eval` in the browser; checked-in output must match regeneration. Runtime semantic geometry/reference checks remain custom core-model functions. The resolved fast-uri 3.x license/version is checked before installing the resolved graph.

## PH0-T02 property testing (2026-10-11, recorded before installation)

| Dependency | Exact version | License | Purpose | Evidence |
|---|---|---|---|---|
| fast-check | 4.10.2 | MIT | Seeded analytic geometry and command-sequence property tests; no browser runtime dependency | [Official npm metadata](https://registry.npmjs.org/fast-check/4.10.2) |
| pure-rand | 8.4.2 | MIT | fast-check's deterministic random generator, resolved transitive dependency | [Official npm metadata](https://registry.npmjs.org/pure-rand/8.4.2) |

Node 24 satisfies fast-check's >=12.17 requirement. Pure TypeScript geometry needs no runtime dependency in this task; existing half-mm fixtures are preserved. Metadata checks are license evidence, not a legal audit.

Checked against official npm version metadata and official GitHub repositories on 2026-10-11, before installation. These exact versions are selected for the skeleton; the lockfile pins their transitive dependencies. Package metadata is license evidence, supplemented by the installed-package license inventory during verification.

| Dependency | Exact version | License | Purpose | Evidence |
|---|---|---|---|---|
| Node.js | 24.19.0 | MIT, with bundled third-party notices | Verified Krypton LTS runtime | [Official release](https://github.com/nodejs/node/releases/tag/v24.19.0) |
| pnpm | 11.19.0 | MIT | Workspace and frozen-lockfile installs | [Version metadata](https://registry.npmjs.org/pnpm/11.19.0) |
| react | 19.3.0 | MIT | Web shell | [Version metadata](https://registry.npmjs.org/react/19.3.0) |
| react-dom | 19.3.0 | MIT | Browser mounting | [Version metadata](https://registry.npmjs.org/react-dom/19.3.0) |
| vite | 8.3.4 | MIT | Web development server and production build | [Version metadata](https://registry.npmjs.org/vite/8.3.4) |
| @vitejs/plugin-react | 6.1.2 | MIT | React JSX transformation with Vite 8 | [Version metadata](https://registry.npmjs.org/@vitejs%2Fplugin-react/6.1.2) |
| typescript | 6.0.3 | Apache-2.0 | Strict checking across all packages | [Version metadata](https://registry.npmjs.org/typescript/6.0.3) |
| eslint | 10.12.0 | MIT | Source/configuration linting | [Version metadata](https://registry.npmjs.org/eslint/10.12.0) |
| @eslint/js | 10.0.1 | MIT | JavaScript lint recommendations | [Version metadata](https://registry.npmjs.org/@eslint%2Fjs/10.0.1) |
| typescript-eslint | 8.71.1 | MIT | TypeScript lint parsing and rules | [Version metadata](https://registry.npmjs.org/typescript-eslint/8.71.1) |
| vitest | 5.0.3 | MIT | Smoke-test runner; future pure-engine tests use Node | [Version metadata](https://registry.npmjs.org/vitest/5.0.3) |
| jsdom | 30.1.2 | MIT | DOM for the web smoke test | [Version metadata](https://registry.npmjs.org/jsdom/30.1.2) |
| @testing-library/react | 16.3.3 | MIT | Render the actual React shell and query accessibility roles | [Version metadata](https://registry.npmjs.org/@testing-library%2Freact/16.3.3) |
| @testing-library/dom | 10.4.2 | MIT | Required React Testing Library peer | [Version metadata](https://registry.npmjs.org/@testing-library%2Fdom/10.4.2) |
| @types/react | 19.3.0 | MIT | React types | [Version metadata](https://registry.npmjs.org/@types%2Freact/19.3.0) |
| @types/react-dom | 19.3.0 | MIT | Browser renderer types | [Version metadata](https://registry.npmjs.org/@types%2Freact-dom/19.3.0) |
| @types/node | 24.19.2 | MIT | Node 24 tooling types | [Version metadata](https://registry.npmjs.org/@types%2Fnode/24.19.2) |

Compatibility decisions:

- Node 24.19.0 meets pnpm's >=22.13, Vite/plugin's >=22.12 and jsdom's >=24.15 requirements.
- TypeScript 7.0.2 is excluded: typescript-eslint 8.71.1 declares support for >=4.8.4 and <6.1.0. TypeScript 6.0.3 is within that supported range.
- React and react-dom share the exact version; type packages match their major/minor. Vite 8 satisfies the plugin and Vitest peer ranges.
- Optional compiler, browser-test, coverage and canvas peers are not installed. No renderer, backend, Android, asset or billing dependency is needed in PH0-T01.
- No geometry algorithms exist yet. fast-check and independent geometry fixtures start in their own tasks, not as empty or tautological tests here.

## CI actions

Official release tags were resolved to immutable commits; all three actions have MIT license metadata.

| Action | Release | Commit |
|---|---|---|
| actions/checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| actions/setup-node | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| pnpm/action-setup | v6.1.0 | `ea17c68df8912ef543352723c149a84f56e3d413` |

Sources: each action's official GitHub `releases/latest`, tag-ref and license endpoints. New dependencies must be entered here before installation, with purpose, exact version and license evidence. GPL/AGPL code and non-commercial assets are prohibited by AGENTS.md. This task introduces no 3D assets.

## Resolved registry inventory

After lockfile-only resolution and before installing packages, all 210 resolved registry package versions were checked against official npm license metadata and recorded in `dependency-licenses.json`. The check found no unknown licenses and no GPL/AGPL candidates. It includes optional platform packages, so its count can exceed the installed package count.

Licenses present: MIT, MIT-0, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, BlueOak-1.0.0 and CC0-1.0. Preserve applicable bundled license/notice files when distributing dependency code. MPL-2.0 file-level obligations still apply if such code is modified/distributed; this task does not modify third-party code. Registry metadata is not a legal opinion or proof that every bundled file was inspected.
# PH0-T04 renderer dependency (2026-10-11)

| Package | Pinned version | License | Purpose / risk |
|---|---|---|---|
| konva | 10.7.1 | MIT | Imperative browser canvas display and picking. No canonical model state is stored in Konva. Optional native canvas/skia peers are not installed; real browser tests cover drawing. Official exact-version npm metadata verified before installation. |

## PH0-T05 3D renderer dependencies (2026-10-11, recorded before installation)

| Package | Exact version | License | Purpose / official metadata |
|---|---|---|---|
| three | 0.186.1 | MIT | Lazy WebGL2 renderer. [Version metadata](https://registry.npmjs.org/three/0.186.1) |
| @types/three | 0.186.0 | MIT | Three.js type declarations. [Version metadata](https://registry.npmjs.org/@types%2fthree/0.186.0) |
| @dimforge/rapier3d-compat | 0.12.0 | Apache-2.0 | Transitive dependency of @types/three; not used as a physics engine in this task. [Version metadata](https://registry.npmjs.org/@dimforge%2frapier3d-compat/0.12.0) |
| @tweenjs/tween.js | 23.1.3 | MIT | Transitive dependency of @types/three; not used as a physics engine in this task. [Version metadata](https://registry.npmjs.org/@tweenjs%2ftween.js/23.1.3) |
| @types/stats.js | 0.17.4 | MIT | Transitive dependency of @types/three; not used as a physics engine in this task. [Version metadata](https://registry.npmjs.org/@types%2fstats.js/0.17.4) |
| @types/webxr | 0.5.24 | MIT | Transitive dependency of @types/three; not used as a physics engine in this task. [Version metadata](https://registry.npmjs.org/@types%2fwebxr/0.5.24) |
| fflate | 0.8.3 | MIT | Transitive dependency of @types/three; not used as a physics engine in this task. [Version metadata](https://registry.npmjs.org/fflate/0.8.3) |
| meshoptimizer | 1.1.1 | MIT | Transitive dependency of @types/three; not used as a physics engine in this task. [Version metadata](https://registry.npmjs.org/meshoptimizer/1.1.1) |

Three.js and declarations are pinned. Geometry remains pure and independent of Three.js. No external 3D assets, textures or physics runtime are introduced. Browser GPU compatibility and real-phone performance remain separate gates.

## PH0-T07 Android tooling (2026-10-11, recorded before installation)

| Dependency | Exact version | License / source | Purpose |
|---|---|---|---|
| @capacitor/core | 8.5.3 | MIT; [official metadata](https://registry.npmjs.org/@capacitor%2fcore/8.5.3) | Local web/native bridge; no remote development server in packaged configuration |
| @capacitor/android | 8.5.3 | MIT; [official metadata](https://registry.npmjs.org/@capacitor%2fandroid/8.5.3) | Android wrapper; official source targets SDK 36, min SDK 24 and Java 21 |
| @capacitor/cli | 8.5.3 | MIT; [official metadata](https://registry.npmjs.org/@capacitor%2fcli/8.5.3) | Development-only native project generation/sync; requires Node >=22 |
| Gradle wrapper/distribution | 8.14.3 | Apache-2.0; official Capacitor template and [Gradle release](https://github.com/gradle/gradle-distributions/releases/tag/v8.14.3) | Exact `all.zip` SHA-256 `ed1a8d686605fd7c23bdf62c7fc7add1c5b23b2bbc3721e661934ef4a4911d7c` from official release asset digest |
| Android Gradle plugin | 8.13.0 | Apache-2.0; official Capacitor Android/template `build.gradle` | Android compilation, lint and packaging |
| actions/setup-java | v6.0.1; `de7274f081f381c8f8158605e0321c36c376e2e6` | MIT; official release, tag-ref and license endpoints | CI Java 21 Temurin selection |
| actions/upload-artifact | v7.0.2; `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | MIT; official release, tag-ref and license endpoints | Retained debug APK/build evidence, not signing or Play deployment |

Core, Android and CLI share the exact release; Android declares core ^8.5.0. Official npm release archives were inspected for SDK/Gradle/Java requirements because the documentation host is proxy-blocked locally. Android SDK/platform/build tools are external toolchain components under Google's SDK terms, not copied application code. Existing runner SDK/license provisioning is used for CI; this task does not claim owner phone or Play verification. New npm transitive versions are checked before installing the resolved lockfile. Generated default launcher art is from the MIT Capacitor template; final independent branding is a later release task. No furniture assets or GPL/AGPL application dependencies are introduced.

Native template dependencies: AndroidX Activity 1.11.0, AppCompat 1.7.1, CoordinatorLayout 1.3.0, Core 1.17.0, Fragment 1.8.9, Webkit 1.14.0, Core SplashScreen 1.2.0, AndroidX JUnit 1.3.0 and Espresso Core 3.7.0 use Apache-2.0 ([primary license](https://github.com/androidx/androidx/blob/androidx-main/LICENSE.txt), API verified). Apache Cordova framework 14.0.1 is Apache-2.0 ([primary license](https://github.com/apache/cordova-android/blob/master/LICENSE), API verified). JUnit 4.13.2 test tooling is EPL-1.0 ([primary license](https://github.com/junit-team/junit4/blob/main/LICENSE-junit.txt), API verified). The template's optional Google Services Gradle plugin 4.4.4 is Apache-2.0 ([primary license](https://github.com/google/play-services-plugins/blob/main/LICENSE), API verified); no service configuration or credentials are supplied. The native resolved dependency tree is retained with CI artifacts; complete distributed native notices and transitive legal/security auditing remain a release gate. All **309** resolved npm registry versions, including 83 additions, have official license metadata with zero unknown/GPL/AGPL candidates. The CLI carries deprecated uuid 7.0.3 transitively; it is development-only, recorded without inventing an advisory or forcing an untested override.


### PH1-T04 file-export selection (2026-10-12)

No new runtime dependency. Official `@capacitor/share@8.0.3` was considered: MIT, peer Capacitor >=8; npm metadata/tarball SHA512 and shipped Android/TypeScript API were inspected. It acknowledges share-sheet activity rather than durable destination content, so it was not installed. Small app-owned `ProjectFiles` glue uses Android ACTION_CREATE_DOCUMENT with the existing Capacitor bridge and private Filesystem cache, then bounds/verifies destination bytes. No broadened permissions/provider paths. Actual provider/OEM/lifecycle validation remains a phone gate. Existing JUnit4.13.2 native test tooling (EPL1.0, already pinned in variables.gradle) is now executed; official Maven POM license reconfirmed: https://repo.maven.apache.org/maven2/junit/junit/4.13.2/junit-4.13.2.pom. Native/transitive distributed notices remain a release requirement; npm313 prior records are unchanged.

## PH1-T05 diagnostics and E2E (2026-10-12, before installation)

| Dependency | Version | License / primary source | Purpose |
|---|---|---|---|
| @sentry/browser | 11.6.0 | MIT; https://registry.npmjs.org/@sentry%2fbrowser/11.6.0 | Optional consent-gated, allowlisted diagnostic codes; no automatic integrations |
| @sentry/core, browser-utils, replay, replay-canvas, feedback | 11.6.0 | MIT; official npm exact-version metadata | SDK resolved dependencies; replay/feedback integrations are disabled |
| @sentry/conventions | 0.26.0 | MIT; official npm metadata | Resolved SDK convention types |
| @playwright/test, playwright, playwright-core | 1.64.0 | Apache-2.0; official npm exact-version metadata | Browser-only CI tests; never product runtime |

Node 24.19.0 meets the documented engines. Inspect the resolved lock graph before installing; preserve prior inventory entries. Reporting defaults off, requires explicit opt-in and configured public DSN; no credentials are provided or needed for local development. Actual Sentry ingestion and physical Android recovery remain external release checks.

Resolved addition web-vitals6.2.3 (MIT, https://registry.npmjs.org/web-vitals/6.2.3) was checked in the complete registry inventory before the frozen install. All324 versions are inventoried;313 previous package records are preserved verbatim. Sentry11 uses `dataCollection` controls (not the older removed sendDefaultPii flag); shipped types/source and actual transport tests are the integration evidence.

## PH4-T01 static asset tools (2026-10-15, before installation)

| Dependency | Exact version | License / official source | Selection |
|---|---|---|---|
| @gltf-transform/core | 4.5.1 | MIT; https://registry.npmjs.org/@gltf-transform%2fcore/4.5.1 | Development-only Document/NodeIO writes and reads standard GLB; avoids a custom binary writer. No browser runtime addition. |
| property-graph | 4.1.0 | MIT; https://registry.npmjs.org/property-graph/4.1.0 | Resolved core graph dependency; exact lock admission required. |
| gltf-validator | 2.0.0-dev.3.10 | Apache-2.0; https://registry.npmjs.org/gltf-validator/2.0.0-dev.3.10 | Official Khronos validator; pinned despite its dev release suffix, with real generated/corrupt GLB tests and explicit warning reporting. |

Official npm metadata and both direct tarball SHA512 integrities were verified before installation. Core4.5.1 replaces no engine dependency; Three remains0.186.1. Compared with gltf-transform/functions4.5.1 (MIT), core avoids image-processing dependencies for this static untextured foundation; no texture conversion or simplification claim. Compared with a custom GLB encoder, NodeIO reduces format risk. Generic textured imports and KTX2 are deferred from this untextured foundation; measured device compression selection and R2/account delivery remain permission-gated under D36. No GPL/AGPL or third-party furniture art is introduced; record and inspect the full lock resolution before frozen install.
