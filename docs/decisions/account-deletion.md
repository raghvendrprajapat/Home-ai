# D70: FR-043 account deletion and data export

Status: accepted by Claude Code under D52 + the owner's D63 permission (2026-10-18). Builds on D65 and D67–D69.

## In the app (Cloud saving → "Your account and data")
- **Download all my cloud drawings.** One JSON file (`gharplan-cloud-export`, version 1) holds every cloud drawing, including the trash, with its newest version.
  - Drawings that could not be read are listed under `missing`, never silently left out.
  - Drawings that exist only on the device are exported with the existing "Export drawing".
- **Delete my account….**
  - The confirmation says what is deleted (the account, every cloud drawing, version and share link, at once and for good) and what stays (drawings on this device; hosting-provider backups expire on the provider's schedule).
  - **Recent sign-in (§D.8):** deleting needs a sign-in from the last 10 minutes, checked against the account's `last_sign_in_at`. Otherwise the app asks the person to sign in again first.
  - The person must then type exactly `DELETE`.
  - The database deletes everything immediately (`delete_account`, D65). The app then forgets which drawings were linked to the cloud and signs out, and the confirmation stays visible.

## Public page for Google Play
- `apps/web/public/delete-account.html` is a static page in English and Hindi with the in-app steps, what is deleted and what is kept.
- For people who cannot open the app, it points to the support email on the Play listing. No address is invented here.
- It is one of the two web pages AGENTS §3 allows.

## Owner checks before release (not done here)
- **Backup period.** Confirm the hosting provider's backup period and, if needed, state it as a number on this page and in the privacy policy (the privacy policy is still gated).
- **Support email.** Put the support email on the Play listing.
- **Real Supabase check.** D65 noted that deleting the sign-in record on real Supabase is still to be confirmed there.

## Not done
- Deleting drawings that exist only on a device; that is the existing per-drawing trash or clearing app data.
- A grace period before deletion.
- Phone tests.
