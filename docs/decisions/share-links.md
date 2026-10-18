# D69: FR-033 view-only share links

Status: accepted by Claude Code under D52 + the owner's D63 permission (2026-10-18). Builds on D65, D67 and D68.

## Owner side (cloud panel → "Share a view-only link")
- **Who can share:** only a drawing that already has a cloud version.
- **Creating a link:** "Create a view-only link" asks the database (`create_share`) for a new 64-hex-character token.
  - The link is `https://<app>/#/share/<token>`.
  - Because the token is after `#`, browsers never send it to a web server or pass it on as a referrer.
  - Only the token's SHA-256 is stored in the cloud (D65), so the link is shown once, with a Copy button.
- **Managing links:**
  - Live links are listed with the time they were made.
  - "Stop sharing" revokes a link immediately.
  - At most 10 live links per drawing.
  - Moving the drawing to the trash or deleting the account also stops its links (D65).

## Visitor side (`SharedView`)
- **No sign-in needed.** The page loads only the Supabase client, without a session, and calls `get_shared_project` — the one database function signed-out visitors may call.
- **What the page shows:**
  - The drawing's newest cloud version is checked by the normal parser.
  - It is shown read-only: the name, a "View-only" badge, the 2D plan as an image (the existing plan-image renderer) and the room list with clear areas.
  - Nothing on the page can change the shared drawing.
- **"Save a copy on this device"** creates an ordinary local drawing with a new project id and revision 0, then opens the normal app with it. The copy is not linked to the cloud.
- **Bad links:**
  - A stopped, unknown or trashed link says "This link is not available".
  - A malformed `#/share/…` address is ignored and opens the normal app.

## Not done
- A 3D or walk-through view on the shared page (the visitor can save a copy and open 3D there).
- Link expiry dates.
- Commenter or editor roles (only `viewer` is ever issued).
- Rate limiting beyond Supabase's gateway.
- Phone tests.
