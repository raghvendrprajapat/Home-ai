# AI test mode: owner setup guide (D92)

This turns on **AI preview** and **Tap to select (AI)** in the Room photo tool for **you and your testers only**.
Nobody can use AI without the **access code** that you make up. There is no login and no database yet; per-user
credits for customers come later with the backend.

Until you finish these steps nothing changes: the app works exactly as now and the offline Room photo preview keeps
working. You do not need to read or change any code.

**Golden rule:** keys and the access code go only into the OpenAI website, the fal.ai website and Vercel's
Environment Variables page. Never paste a key into chat (including Claude or Codex), into GitHub, or into a file in
the project. (You give the access code to testers yourself, privately, for example on WhatsApp.)

**Money:** every AI preview is paid from your OpenAI account and every tap-to-select from your fal account. The app
cannot count each tester's use yet, so the budget limits in steps 1 and 2 are your real safety net.

About 30 minutes.

## 1. OpenAI key (for AI previews)

1. Open https://platform.openai.com and sign in (or sign up).
2. Open **Settings → Billing**. Add a small credit, for example **US$5**.
3. If you see **Limits** or **Usage limits / budget** in the billing or project settings, set a **monthly budget** of
   about US$5 and an email alert. (If OpenAI does not show this option for your account, the prepaid credit is the
   limit: previews stop when it is used up.)
4. Open **API keys** → **Create new secret key**. Give it a name like `gharplan-ai-test`. Copy the key (it starts with
   `sk-`) into your password manager. You paste it only in step 4.

## 2. fal.ai key (for Tap to select)

1. Open https://fal.ai and sign in (Google is fine).
2. In **Billing**, add a small credit, for example **US$5**.
3. If fal offers a **spending limit** or **budget alert**, set it to about US$5 per month.
4. In **Keys**, create an **API key** and copy it into your password manager.

(If you only want AI previews, you can skip fal. "Tap to select (AI)" then says that AI is not set up.)

## 3. Make up an access code

Make up a code of **at least 8 characters** that is hard to guess, for example `chai-garden-4721`. Write it in your
password manager. Give it **only** to the people who should test AI. If it leaks, change it (step 4) and redeploy.

## 4. Add the settings in Vercel

1. Open https://vercel.com, open the GharPlan project → **Settings → Environment Variables**.
2. Add these, one by one (Environment: **Production**; also tick **Preview** if you test preview links).
   If Vercel offers a **Sensitive** switch, turn it on for the first three.

| Name | Value |
|---|---|
| `OPENAI_API_KEY` | your OpenAI key from step 1 |
| `FAL_KEY` | your fal key from step 2 |
| `AI_ACCESS_CODE` | your access code from step 3 |
| `ALLOWED_ORIGINS` | your web address, for example `https://gharplan.vercel.app` (several addresses: separate with commas) |
| `VITE_ROOM_AI_TEST_MODE` | `1` |

3. **Do not** add `VITE_` in front of the first four names. (`VITE_` means "public, built into the app". The build
   stops on purpose if a key or the code is given a `VITE_` name.)

## 5. Redeploy

1. In Vercel open **Deployments**, click the three dots on the newest one → **Redeploy**. (Settings are used only by
   a new deployment.)
2. Quick check that the AI server part is running: on your phone or computer open
   `https://<your address>/api/room-ai/edit` (for example `https://gharplan.vercel.app/api/room-ai/edit`).
   - You should see a short text: `{"ok":false,"code":"INVALID_REQUEST"}`. That is correct (a browser visit is not an
     AI request).
   - If you see a Vercel error page (404 or "FUNCTION_INVOCATION_FAILED"), tell Claude what you saw (no keys needed).

## 6. Test on a phone (web)

1. Open the app address on the phone. Open **Room photo**, choose a room photo.
2. In section 2 ("Choose the material") you should now see **AI preview** with a yellow **AI test mode** label.
3. With the brush, paint over a wall. Choose a paint colour. Choose "This area is: A wall".
4. Tap **Make AI preview**. It asks for the **access code**: type it, tap **Use this code**.
5. Read the **Before you use AI** box and tap **I agree, continue**.
6. You see "Sending the photo… %", then "The AI is working. This can take up to 2 minutes." Keep the screen open.
   You can tap **Cancel AI preview** (if the photo was already sent, that preview may still be charged).
7. The result appears: only the area you painted changes; the rest of the photo stays exactly the same. It is kept as
   option **AI**.
8. Try **Tap to select (AI)**: tap a wall; it is added to the area. "Undo area change" removes it.
9. Try a wrong code once: tap **Forget code**, then **Make AI preview**, type a wrong code. You should see
   "That access code is not right." (A wrong code costs nothing.)
10. Check the cost after the first previews: OpenAI → **Usage**; fal → **Usage/Billing**. Tell Claude roughly what one
    preview cost, so the plan for customer credits uses real numbers.

## 7. Android app (only when you want AI in the Android test app)

The Android app has no server of its own, so its build needs two **public** values (they are not secret, you may share
them in chat): `VITE_ROOM_AI_TEST_MODE=1` and `VITE_API_BASE_URL=https://<your web address>` (for example
`https://gharplan.vercel.app`). Ask Claude to build the Android test app with these two values. The Android app always
calls from `https://localhost`; the server already allows that address.

## 8. Turn AI off

- **Hide AI in the app:** in Vercel delete `VITE_ROOM_AI_TEST_MODE` (or set it to `0`) and redeploy. The AI test mode
  section disappears.
- **Stop all AI calls at once:** delete or change `AI_ACCESS_CODE` and redeploy. Every AI request is then refused
  ("not set up" or "code not right"), and nothing is charged.
- **Lock out one tester:** not possible with one shared code. Change the code and give the new one only to the others.

## What to know

- GharPlan's server does not store photos. OpenAI may keep request data up to 30 days for abuse checks (it says it does
  not train on it); fal is asked to delete the uploaded photo after 1 hour.
- The server limits (6 previews a minute, 30 taps a minute, 10 wrong codes in 10 minutes) are only a speed bump: Vercel
  may run several copies of the server. Your OpenAI/fal budget limits are the real limit.
- The privacy page is not updated yet (your decision: only when the app goes live). Use AI test mode only with testers
  who know this, not with customers.
