# FR-031 Android sign-in verification (D71)

These are Claude-authored tests. They are not a phone test and not a real Google or Supabase sign-in.

## Tests
- **`apps/web/src/cloud/native-signin.test.ts` (5 tests).** The Capacitor plugins and the Supabase client are replaced by recorders:
  - Only our deep link with a well-formed code is accepted. Error, foreign, look-alike and malformed links give nothing.
  - **Starting sign-in:** on Android the app asks Supabase for the PKCE address with `skipBrowserRedirect` and the `com.gharplan.app://auth-callback` return, then opens it in the system browser.
  - **Running app:** a returning deep link exchanges its code once and closes the tab; other links are ignored.
  - **Cold start:** a launch link exchanges its code, and a stored PKCE verifier alone makes the app reconnect at start-up.
  - **Web:** the web app keeps the normal redirect and never touches the native plugins.
- **`apps/web/src/cloud/share-link.test.ts` (3 new tests).** These cover the link address:
  - **Android:** the app never links to its internal `https://localhost`. Without a public address it makes no link.
  - **Web:** the web app uses its own address unless `VITE_PUBLIC_APP_URL` is set.
  - **Unsafe addresses:** http, localhost, query, `#`, sign-in details and malformed values are ignored.
  - **Bug found while preparing the phone steps:** before this fix, a link made in the Android app would have been `https://localhost/#/share/…`.
- **`scripts/verify-android-apk.py` (runs in CI's "Android debug" job)** asserts the registered and packaged App/Browser plugins and the single deep link in the built APK.

## Results (2026-10-18, local)
- `native-signin.test.ts`: 5/5 passed.
- `pnpm check` (after merging main with FR-032/033/043 and the share-address fix): 82 files, 584 tests passed.
- Mutation: letting the Android app fall back to its own address fails 2 of the new share-address tests.
- All cloud browser tests: 13/13 passed. A build with the three cloud values set but empty, as CI supplies them when no secret exists, succeeds.
- The APK checks run only in CI's "Android debug" job. The sandbox used for this work has no Android SDK, so they were not run locally.

## Pending
A real phone with the owner's Supabase project and Google account.
