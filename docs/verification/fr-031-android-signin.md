# FR-031 Android sign-in verification (D71)

These are Claude-authored tests. They are not a phone test and not a real Google or Supabase sign-in.

## Tests
- **`apps/web/src/cloud/native-signin.test.ts` (5 tests).** The Capacitor plugins and the Supabase client are replaced by recorders:
  - Only our deep link with a well-formed code is accepted. Error, foreign, look-alike and malformed links give nothing.
  - **Starting sign-in:** on Android the app asks Supabase for the PKCE address with `skipBrowserRedirect` and the `com.gharplan.app://auth-callback` return, then opens it in the system browser.
  - **Running app:** a returning deep link exchanges its code once and closes the tab; other links are ignored.
  - **Cold start:** a launch link exchanges its code, and a stored PKCE verifier alone makes the app reconnect at start-up.
  - **Web:** the web app keeps the normal redirect and never touches the native plugins.
- **`scripts/verify-android-apk.py` (runs in CI's "Android debug" job)** asserts the registered and packaged App/Browser plugins and the single deep link in the built APK.

## Results
See the PR for local and CI output.

## Pending
A real phone with the owner's Supabase project and Google account.
