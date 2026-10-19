# Web preview on Vercel (D75)

**Owner request (chat, 2026-10-19):** "Me apne saas app ko dekhna chata hu so ab tak app jitna bana hai use vercel par deploy karo." The owner wants to see the app as built so far. This is an owner preview, not a public release: Play release packaging, billing, analytics and the final review stay gated.

## What is in the repository
`vercel.json` at the repository root:
- **Install:** `npm install -g pnpm@11.19.0 && pnpm install --frozen-lockfile`. This uses the exact pnpm from `packageManager`, so Vercel's own pnpm detection does not matter.
- **Build:** `pnpm build`. The catalog artifacts are checked, the web app is built, and `verify-web-build` runs.
- **Output:** `apps/web/dist`.
- **Caching:**
  - Content-hashed `/assets/*` and `/catalog/blobs/*` are cached for a year (immutable).
  - Every page sends `nosniff` and a strict referrer policy.
- **Routes:** share links use `#/share/<token>`, so no rewrites are needed for them. Only the developer page `/perf` is rewritten to the app.

## Who does what
- **Account and permission:** a Vercel account and the GitHub permission belong to the owner. No token or key goes into the code or the chat. Claude cannot deploy from its sandbox: it has no Vercel login, and api.vercel.com answered 403.
- **Owner steps:** sign in at vercel.com with GitHub, choose "Add New → Project", import `raghvendrprajapat/Home-ai` and press Deploy. The settings come from `vercel.json`.
- **After that:** every push to `main` updates the site, and every pull request gets its own preview link.
- **Without cloud variables:** the app works fully on the device. The cloud panel says the cloud is not set up.
  - Cloud sign-in needs the owner's Supabase project.
  - It then needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` added in the Vercel project settings, never in code. The anon (publishable) key is meant to be public; the service key must never be used.

## Limits
- **Vercel plan:** the free Hobby plan is meant for personal, non-commercial use. A paid plan (or another host) is needed before a commercial launch. Check the current terms on vercel.com.
- **Node version:** `package.json` pins Node 24.19.0. If Vercel refuses the pinned version, choose Node 24.x in the project settings.
- **Verified locally (2026-10-19):** a fresh clone with exactly these install and build commands (Node 24.19.0) produced `apps/web/dist`. A real Vercel build has not run yet.
