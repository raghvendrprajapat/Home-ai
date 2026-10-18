# D67: FR-031 cloud sign-in and saving in the app

Status: accepted by Claude Code under D52 + the owner's D63 permission (2026-10-18). Builds on D65 (cloud database).

## What the app does
- **Off by default.** Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time, the app is fully local and the "Cloud saving" panel only says it is not set up. A secret or service-role key is refused both at build time (`vite.config.ts`) and at run time (`cloud/config.ts`); only `https://<ref>.supabase.co` URLs are accepted.
- **Lazy.** `@supabase/supabase-js` is loaded only when someone taps "Sign in with Google", or when an earlier sign-in (a stored session) or a return from Google (`?code=`) is present. Local-only use makes no network request.
- **Sign-in (web).** Google through Supabase Auth with the PKCE flow. The local drawing is flushed to the device before the page leaves for Google; the one-time `code` is removed from the address bar after the exchange.
- **Saving (§H.5 client rules, `cloud/cloud-save.ts`).**
  - The person chooses "Save this drawing to the cloud". This device remembers that choice per drawing (`localStorage`, a convenience only).
  - Saves follow edits after 2 seconds, with one save in flight.
  - Edits made meanwhile stay local and go in the next save.
  - On success only `document.revision` moves, through `store.confirmServerRevision`.
  - "Saved in cloud (version N)" appears only when the acknowledged edit is the current one.
  - With no answer, the retry resends the identical request and key. Back-off is 2, 4, 8 … up to 60 seconds; when the connection returns, the retry goes immediately.
  - Other answers stop automatic saving and explain why, keeping the local work: a newer cloud version (conflict), the drawing not being in this cloud, a taken project id, trash, size, the 200-project limit, invalid content, or being signed out. Nothing is ever merged or overwritten.
- **The bundled sample and other fixed ids.**
  - The cloud refuses them because they claim a revision this account never saved (`NOT_FOUND`) or belong to someone else (`PROJECT_ID_TAKEN`).
  - "Save as a new cloud project" then opens the same drawing under a fresh project id with revision 0 and saves it.
- **Opening from the cloud.**
  - The Projects screen lists the signed-in person's cloud drawings.
  - The opened drawing is validated by the normal parser before use, and the app checks that its id and revision match.
  - If this device already has a drawing with that id, the person chooses: "Open this device's version" or "Open the cloud version as a separate copy". Nothing local is replaced.
  - A drawing just opened from its cloud head does not upload itself again.

## Choices
- **Library types.** supabase-js 2.117.2's own type files do not compile under this project's `exactOptionalPropertyTypes`. `apps/web/tsconfig.json` therefore maps the import to `cloud/supabase-types.d.ts`, which types only the calls used. Vite, Vitest and the browser tests run the real package.
- **Browser tests use a stand-in.** The tests answer every request to `https://gharplan-e2e.supabase.co`, including the Google authorize redirect, the PKCE token exchange and the D65 functions, using the same save rules. Only the e2e build sets that address.
- **Android sign-in** is added by D71 (system browser + deep link). Before D71: Google blocks sign-in inside an app's web view. Android needs the system browser plus a deep link back (`@capacitor/browser` and `@capacitor/app`), which comes as a separate change with its own native checks. Until then the cloud panel works in the web app.

## Owner setup (when you want the cloud live; no keys in chat)
Screen names in Supabase and Google can change slightly over time.
1. **Create the Supabase project.**
   - Go to supabase.com, sign up, and create a project (for example "gharplan", region Mumbai).
   - Keep the database password in your own password manager. Never paste it anywhere else.
2. **Create the database tables.**
   - Open the SQL editor.
   - Paste the whole file `server/supabase/migrations/20261018000000_cloud_projects.sql` and run it once.
3. **Create the Google sign-in client.**
   - In Google Cloud Console, create a project.
   - Fill in the OAuth consent screen: External, app name GharPlan, your support email.
   - Create an OAuth client ID of type "Web application".
   - Add this authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
4. **Turn on Google in Supabase.**
   - Open Authentication → Providers → Google.
   - Paste the Google client ID and client secret there. The secret stays in Supabase only.
5. **Tell Supabase where the app lives.**
   - Open Authentication → URL configuration.
   - Add the web app's address. For local testing, also add `http://localhost:5173/`.
6. **Give the app its two public values.**
   - In Project settings → API, find the project URL and the anon / publishable key.
   - They go into the build settings as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
   - Do not use the service-role or secret key; the build refuses it.
7. **Optional: empty the trash automatically.** Schedule `select public.purge_trashed();` once a day with pg_cron, so trash older than 30 days is removed.

## Not done here
- Android sign-in.
- The conflict choices screen and version history (FR-032).
- Share links (FR-033).
- Account deletion and export (FR-043).
- A real Supabase project and real Google sign-in.
- Phone tests.
