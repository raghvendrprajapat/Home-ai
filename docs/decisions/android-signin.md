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

## Owner setup (adds to D67 steps 5 and 6)
- In Supabase → Authentication → URL configuration, add `com.gharplan.app://auth-callback` as an allowed redirect URL.
- Nothing changes in the Google Cloud client: Google still returns to Supabase's own callback.
- **Test APK with the cloud on.** CI's "Android debug" APK is local-only unless the repository has these GitHub Actions secrets (Settings → Secrets and variables → Actions → New repository secret):
  - `VITE_SUPABASE_URL`: the project URL.
  - `VITE_SUPABASE_ANON_KEY`: the anon/publishable key only. The build fails on a secret or service-role key.
  - `VITE_PUBLIC_APP_URL` (optional): the public `https://` address where the web app is hosted.
  - The two Supabase values are public by design and end up inside the app. They are stored as secrets only so they stay out of CI logs.
  - The next CI run's `gharplan-debug-<sha>` artifact then has the cloud on.

## Share links from the Android app
- The Android app's pages come from an internal `https://localhost`, so a link built from its own address would be dead for everyone else.
- Links therefore use `VITE_PUBLIC_APP_URL`.
- Without that address, the Android app says it cannot make view-only links and creates none.
- The web app keeps using its own address unless `VITE_PUBLIC_APP_URL` is set.
- Hosting the web app (which is also needed for the visitor page and `delete-account.html`) is the owner's choice and is not done here.

## Not done
- A real phone test with a real Supabase project and Google account.
- Native Google One Tap or Credential Manager sign-in. The browser flow is the documented Supabase approach.
