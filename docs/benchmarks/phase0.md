# Phase 0 — Android build and phone benchmark procedure

2026-10-12; PH0-T07. Phone results below are **pending**, not generated from cloud measurements. Phase 0 exit and commercial release remain open. D17 permits independent development while these checks are outstanding.

## Build and inspection

The Android app bundles local web assets over private `https://localhost`. There is no remote development-server URL, navigation allowlist, sign-in, billing or signing credential in its configuration. Production application ID is the provisional `com.gharplan.app`; the debug variant is separate: **`com.gharplan.app.debug`**. Debugging follows Android's build flag. The `perf` intent extra is honored only by a debug build.

Required toolchain: Node 24.19.0 / pnpm 11.19.0, a **JDK** 21 with `javac`, Android SDK platform 36, build tools 35.0.0 (AGP default) and 36.0.0 (artifact verifier), platform tools. Gradle 8.14.3 is wrapped and its official distribution SHA-256 is pinned. AGP is 8.13.0. Min SDK 24 / target SDK 36. Install SDK packages through Android Studio's SDK Manager using its normal license flow. On Windows use Android Studio's embedded compatible JDK or installed JDK 21 and `gradlew.bat`; the root Android script is the Linux/macOS path.

From the repository root after a frozen install:

```sh
pnpm check
pnpm android:sync
pnpm android:debug
```

`android:sync` builds the web app and copies assets/configuration into the wrapper; generated copies, build output, local SDK paths, keystores and service configuration are ignored by Git. `android:debug` syncs again, then compiles/lints. In Android Studio, open `apps/web/android`; choose JDK 21 for Gradle, SDK 36, and the debug variant. Do not set a live server URL to make packaging work.

For this managed cloud machine, the compiler and SDK are retained outside the checkout. Use command-scoped selectors; do not change `HOME` or disable trust checks:

```sh
JAVA_HOME=/workspace/toolchains/temurin-21/jdk-21.0.12.1+1 ANDROID_HOME=/workspace/toolchains/android-sdk pnpm android:debug
```

If Java tooling needs this cloud proxy/trust explicitly, use Gradle's supported `-Dhttps.proxyHost=proxy -Dhttps.proxyPort=8080 -Dhttp.proxyHost=proxy -Dhttp.proxyPort=8080 -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts`, retaining TLS and the expected checksum. Scoped SDK commands use the official CLI. Current command-line tools 23 delegate the deprecated `sdkmanager` compatibility command to Android CLI; do not run its optional skill/auth initialization for this project. A writable tool cache can require the supported execution-permission flow. The current instance is not proof of published/fresh-task restoration.

CI runs Check first, then **Android debug**: frozen install, Java 21, SDK components, local asset sync, debug compilation/lint, APK signature verification, decoded-manifest/config/asset checks and native dependency evidence. The retained `gharplan-debug-[commit]` artifact contains the debug APK, SHA-256, decoded manifest, verification JSON, lint/dependency reports and matching web `dist` assets. Retention is seven days; an older expired artifact needs a new checked CI run. Local and CI APK hashes can differ because debug signing keys/build provenance differ. Neither a debug APK size nor compilation proves the Play AAB download limit or phone usability.

## Low and Mid phone steps

1. In GitHub, open the successful CI run for the reviewed PR/main build. Download its `gharplan-debug-[commit]` artifact and unzip it. Find `android/app/build/outputs/apk/debug/app-debug.apk` and the matching `dist` folder. Keep the included verification/hash with your results.
2. On each phone, open **Settings → About phone → Software information**, tap **Build number** seven times, then enable **Developer options → USB debugging**. Connect your own laptop by USB and authorize its displayed debugging key on the phone. Record exact model/RAM/Android and the installed Chrome/WebView versions. Menu names vary by manufacturer.
3. Open a terminal in the SDK `platform-tools` folder (Windows: prefix these commands with `./` or `.\` if required). `adb devices` must show this phone as `device`, not `unauthorized`; with multiple devices use `adb -s [serial]` consistently. Install the APK with `adb install -r [full path to app-debug.apk]`. This targets the separate debug package. If Android says `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, the old/new debug signing keys differ. First export and retain any reports/projects from the installed debug app; uninstall deletes that package's data. PH0-T07 has only the disposable sample. Once the test data is preserved, explicitly uninstall **only** `com.gharplan.app.debug` with `adb uninstall com.gharplan.app.debug`, then install the APK without `-r`. Never uninstall a production package or bypass signature verification. A tester can compare the two signer certificate digests using `apksigner verify --print-certs [APK path]`; a local/CI hash difference alone does not prove which key signed it.
4. Open GharPlan normally. Test the sample's precision edit, view switch and undo as described in `verification/ph0-t05.md`. Reload/process death still restores the sample in PH0-T07 because durable saving is PH0-T08. This is not yet a user project app.
5. Start the disposable performance lab with a **cold start**, copying these commands. The activity uses `singleTask`, so the extra on an already-open activity alone would not select the lab:

   ```sh
   adb shell am force-stop com.gharplan.app.debug
   adb shell am start -n com.gharplan.app.debug/com.gharplan.app.MainActivity --ez perf true
   ```

6. On laptop Chrome, open `chrome://inspect/#devices`, enable **Discover USB devices**, then **inspect** the GharPlan WebView. Record `adb shell dumpsys webviewupdate` engine/version and `adb shell getprop ro.build.version.release`. A missing inspect target is a failed prerequisite; check USB authorization and that this is the debug APK. Do not enable debugging on a release build.
7. Fill device/start thermal fields, choose sample/3D, five minutes and 20-second warm-up, reset, wait for a valid scene and Start. Leave app visible/orientation fixed. Orbit and optional wall edits are scripted. On completion, enter ending thermal state and record it. Reset and repeat for three runs. Follow PH0-T06's procedure for large 3D and large 2D; repeatedly release valid corner drags so accepted changes are measured. Export before leaving the disposable page.
8. **WebView export fallback:** browser `blob` downloads are not a native Filesystem/share implementation. The Android lab's Export action explicitly explains this. Keep the page open. In the USB inspection Console, paste `copy(document.querySelector('[data-testid="perf-json"]').textContent)`; paste the resulting clipboard JSON into a plain-text file named with model/build/scenario/run. This reads only the disposable lab's displayed reports and does not transmit them. On Chrome the normal Export JSON button downloads the file. Native report export and real-phone validation remain pending.
9. **Chrome comparison with the same assets:** use the artifact's `dist` folder, rather than building a different local revision. From the repository root run `pnpm android:benchmark-web --outDir [absolute path to that dist folder]`. Keep the server on laptop loopback. Run `adb reverse tcp:4173 tcp:4173`, then on this USB-connected phone type `http://localhost:4173/perf` in Chrome. This is a forwarded test address, not a hosted preview. The phone's loopback origin is needed for secure-context APIs; opening an HTTP LAN IP is not equivalent. Verify the report's build equals the APK's report build. Repeat the same fixtures/settings/runs and thermal recording. Remove the forwarding afterward with `adb reverse --remove tcp:4173`.
10. Collect JSON, engine/build/thermal metadata and, where possible, a video/trace of stalls. Interrupted, partial, insufficient-interaction or mixed-orientation runs must be repeated. Do not label approximate JS heap as total phone/worker/GPU memory.
11. Separately, outside timed runs, check WebView context recovery (REN-007). With the sample's 3D view open, in USB inspection Console paste `window.gharplanContext = document.querySelector('[data-testid="three-view"] canvas').getContext('webgl2').getExtension('WEBGL_lose_context'); window.gharplanContext?.loseContext()`. An unavailable extension is a pending test, not a pass. Confirm the visible 3D-unavailable message and preserved 2D drawing/precision controls. After a few seconds paste `window.gharplanContext?.restoreContext()` and verify the latest valid model reappears in 3D, with no silent reset or Console error. Record a trace/video and the interval from the restore request until the valid scene returns: NFR-017 requires **≤3 seconds**, or a working 2D fallback with the model unchanged. Record phone/engine/build, steps and timing evidence; an unmeasured return is not a timing pass. These debug-only inspection steps simulate graphics context loss; they do not prove recovery from every OS/GPU failure.

This is a prepared procedure, not executed phone results. Do not force-stop another package, clear user project data, paste signing/API credentials, or infer a device result from the cloud diagnostic.

## Results register

| Device / container | Exact model, RAM, OS, engine, build | Sample 3D: runs 1/2/3 | Large 3D: runs 1/2/3 | Large 2D: runs 1/2/3 | Thermal and JSON evidence |
|---|---|---|---|---|---|
| Low / Chrome | Pending | Pending | Pending | Pending | Pending |
| Low / Android WebView | Pending | Pending | Pending | Pending | Pending |
| Mid / Chrome | Pending | Pending | Pending | Pending | Pending |
| Mid / Android WebView | Pending | Pending | Pending | Pending | Pending |
| Integrated-GPU desktop / Chrome | Pending | Pending | Pending | Pending | Pending |

Each result needs whole-window FPS, frame p50/p95/p99, preview/command timing, accepted changes, commit-to-submitted-3D timing, draw calls, supported heap readings, interruptions and limitations. Keep exact report files instead of filling only rounded averages.

NFR-002: 200-wall 2D editing ≥30 FPS Low / ≥45 FPS Mid, Mid commit-validation p95 ≤100 ms. NFR-003: sample ≥24 FPS Low / ≥30 FPS Mid / ≥60 FPS reference desktop; separate six-room/60-item and 100-wall/100-object fixtures remain to be added/verified. NFR-004: valid edit-to-3D p95 ≤200 ms Low / ≤100 ms Mid, with the harness's submission-vs-display limitation recorded. Require all three sustained runs, not one screenshot or a best run. Phase 0's Low <15 FPS triggers a rendering/platform fallback decision; that threshold is not yet measured.

Current evidence: PH0-T06 has one 30-second development-server software-GPU diagnostic per scene, with expensive 200-wall previews and 645 draw calls. PH0-T07 has actual native compilation/packaging checks described in `verification/ph0-t07.md`. There is **no Low/Mid/WebView/thermal/kill-app pass**. Durable storage, native export, OEM backup/transfer policy, 50-cycle memory checks, final Claude/specialist review and release signing/Play still require their own evidence.
