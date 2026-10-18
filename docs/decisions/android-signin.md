# D71: FR-031 Google sign-in in the Android app

Status: accepted by Claude Code under D52 + the owner's D63 permission (2026-10-18). Completes D67, which covered the web app only.

## Why a different flow on Android
Google does not allow sign-in inside an app's embedded web view, and the Capacitor app is a web view. So on Android:
1. **Get the sign-in address.** The app asks Supabase for the Google address with the PKCE flow and `skipBrowserRedirect`. The return address is `com.gharplan.app://auth-callback`.
2. **Open Google outside the app.** That address opens in the system browser (Custom Tab) through `@capacitor/browser`.
3. **Come back to the app.** After Google, Supabase sends the browser to the deep link. Android hands it to GharPlan's main activity through the new intent filter in `AndroidManifest.xml`.
4. **Finish signing in.** `@capacitor/app` delivers the link (`appUrlOpen`). The app exchanges the one-time code for a session (`exchangeCodeForSession`) and closes the browser tab.
5. **If Android closed the app meanwhile:** the stored PKCE verifier tells the app at start-up that a sign-in is waiting. It reconnects and reads the launch link (`getLaunchUrl`).
6. **Other links are ignored.** Only links that start with `com.gharplan.app://auth-callback` and carry a well-formed `code` are used.

The web app keeps the normal redirect flow (D67).

## Checks
- **APK checks.** `scripts/verify-android-apk.py` now also proves, from the built APK:
  - The App and Browser plugins are registered and packaged.
  - There is exactly one browsable deep link, `com.gharplan.app://auth-callback`, on `MainActivity`.
- **No new permission.** The Browser plugin only adds a `<queries>` entry for Custom Tabs.
- **Debug and release share the link.** A debug build (`com.gharplan.app.debug`) uses the same link. If both builds are installed, Android asks which app should open it.

## Owner setup (adds to D67 step 5)
- In Supabase → Authentication → URL configuration, add `com.gharplan.app://auth-callback` as an allowed redirect URL.
- Nothing changes in the Google Cloud client: Google still returns to Supabase's own callback.

## Not done
- A real phone test with a real Supabase project and Google account.
- Native Google One Tap or Credential Manager sign-in. The browser flow is the documented Supabase approach.
