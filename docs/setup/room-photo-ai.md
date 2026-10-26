# Room photo AI: owner setup guide (D86)

This turns on **AI previews** and **Tap to select (AI)** in the Room photo tool. Until you finish these steps the app
keeps working exactly as before: the offline Room photo preview works, and the AI part only says "sign in" or does
nothing. You do not need to read or change any code.

**Golden rule:** keys and passwords go only into the fal.ai website, the Supabase website or your own computer's
terminal. Never paste a key into chat (including Claude or Codex), into GitHub, or into a file in the project.

What you need:
- The Supabase project you already use for cloud saving (D67), with Google sign-in working.
- A computer with Node.js (the same one used for building the app) for step 5.
- About 45 minutes.

## 1. Create a fal.ai account and add a small credit

1. Open https://fal.ai and sign up (Google sign-in is fine).
2. In fal's billing area, add a small credit, for example **US$5**. Previews stop by themselves when the credit is used up.
3. If fal's dashboard offers a **spending limit** or **budget alert**, set it to about US$5 per month. (This is a second
   safety net. The app also has its own US$3 per month limit on the server.)
4. In fal's dashboard, create an **API key**. Copy it into your password manager. You will paste it only in step 6.

## 2. Open your Supabase project

1. Open https://supabase.com/dashboard and open the GharPlan project.
2. Note your **project reference**: the part before `.supabase.co` in the project URL
   (for example `abcdefghijklmno` in `https://abcdefghijklmno.supabase.co`).

## 3. Add the AI tables (run the migration)

1. Open the **SQL editor** in your Supabase project.
2. If you have not done it before, run these two files first, one at a time, each exactly once:
   `server/supabase/migrations/20261018000000_cloud_projects.sql`, then
   `server/supabase/migrations/20261019000000_audit_fixes.sql`.
3. Paste the whole file `server/supabase/migrations/20261026000000_room_photo_ai.sql` and run it once.
4. It should finish without an error. If you see an error, copy only the error text (it contains no secret) and send
   it to Claude. Do not run the file a second time.

## 4. Check the private photo storage

The migration also creates a **private** storage bucket called `room-photos` with rules that let each person use only
their own folder.

1. Open **Storage** in your Supabase project. You should see a bucket named `room-photos` marked as private (not public).
2. If it is not there, tell Claude; it will give you the exact steps for your screen. Do not make the bucket public.

## 5. Deploy the four AI functions (on your computer)

Open a terminal in the GharPlan project folder (the folder that contains `package.json` and the `server` folder) and
run these lines one by one. Replace `<project-ref>` with the reference from step 2.

```sh
npx supabase@latest login
npx supabase@latest --workdir server link --project-ref <project-ref>
npx supabase@latest --workdir server functions deploy room-ai-submit
npx supabase@latest --workdir server functions deploy room-ai-webhook
npx supabase@latest --workdir server functions deploy room-ai-segment
npx supabase@latest --workdir server functions deploy room-ai-cleanup
```

- `login` opens your browser to sign in to Supabase.
- `link` may ask for your database password; type it in the terminal only.
- `--workdir server` is needed because this project keeps its Supabase files in `server/supabase`.
- The file `server/supabase/config.toml` already tells Supabase that these four functions check their callers
  themselves. If a deploy ever complains about a missing sign-in, add `--no-verify-jwt` to that deploy line.

## 6. Set the two secrets

The functions need two secrets. Supabase provides its own address and keys automatically; you add only these:

| Name | Value |
|---|---|
| `FAL_KEY` | the fal API key from step 1 |
| `ALLOWED_ORIGINS` | the web address of your app on Vercel, for example `https://gharplan.vercel.app` (several addresses: separate them with commas). The Android app is always allowed. |

Either use the Edge Functions **secrets** page of your Supabase project, or type in the terminal (the key stays on
your computer and in Supabase):

```sh
npx supabase@latest --workdir server secrets set FAL_KEY=paste-the-key-here ALLOWED_ORIGINS=https://your-app.vercel.app
```

## 7. Delete old photos every day (schedule the cleanup)

Photos, chosen areas and results must be deleted after 7 days. The `room-ai-cleanup` function does this; it has to be
called once a day with your project's **service role key** (find it in the project's API settings; it is secret).

1. In **Database → Extensions** (or the extensions page of your project), turn on `pg_cron` and `pg_net`.
2. In the **SQL editor**, run this once. Put your service role key between the quotes on the first line, and your
   project reference in the address. (This keeps the key in Supabase's encrypted vault.)

```sql
select vault.create_secret('PASTE-SERVICE-ROLE-KEY-HERE', 'room_ai_cleanup_key');
select cron.schedule('room-ai-cleanup-daily', '17 3 * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/room-ai-cleanup',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'room_ai_cleanup_key')),
    body := '{}'::jsonb)
$$);
```

This runs every day at 03:17 UTC (08:47 in India). If your dashboard has a "Cron" page you can see the job there.

## 8. Check that it works (first real test)

1. Make sure the Vercel settings `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set (they already are if cloud
   saving works) and that the latest version of the app is deployed.
2. Open the app, open **Project → Cloud saving** and sign in with Google.
3. Open **Room photo**, choose a photo of a room, brush over one wall, choose a paint colour.
4. In the **AI preview** box you should see **"AI previews left this month: 3 of 3"**.
5. Tap **Make AI preview (uses 1)**. The first time, a screen explains what is sent and links the privacy policy.
   Tap **I agree, continue**. After about a minute the result appears as option **"AI"**, and the box shows **2 of 3**.
   Only the brushed wall should change; everything else must look exactly like your photo.
6. Try **Tap to select (AI)** in step 1: tap a wall; it should be added to the chosen area. Undo removes it.
7. Make 2 more previews: the button turns off and says the month's previews are used. (Each account gets 3 per month;
   they come back on the 1st, UTC.)
8. Open Storage → `room-photos`: there should be a folder for your account. The room photo of a finished preview is
   already gone; the rest goes within 7 days (step 7).
9. Read the privacy policy at `https://your-app.vercel.app/privacy.html` and change anything that is not right for
   you. **It is a draft written by the builder; please have it checked before a public release.**

**Check the US$3 safety switch** (SQL editor):

```sql
update ai.settings set monthly_cap_usd = 0;   -- the app now says "AI is paused for this month"
update ai.settings set monthly_cap_usd = 3;   -- back to normal
```

To switch all AI off at once: `update ai.settings set enabled = false;` (and `true` to switch it on again).

## 9. Adjust the cost estimate after the first previews

fal does not publish a fixed price per picture for this model, so the app counts each preview as **US$0.08** (on
purpose a bit high) and each tap as US$0.01. With US$3 per month that is at most about 37 previews for the whole app.

1. After a few previews, open fal's **usage** or billing page and divide the amount spent by the number of previews.
2. In the SQL editor, set the estimate to that number (round up a little), for example:

```sql
update ai.settings set est_edit_usd = 0.06, updated_at = now();
```

3. This month's estimated total so far: `select public.gp_ai_spent();` (only you can run this; it is never shown in the app).

Other settings in the same row: `free_previews_per_month` (3), `segment_daily_limit` (20 taps per account per day),
`est_segment_usd` (0.01). Change them only if you decide so; tell Claude so the docs stay correct.

## What is still pending

- No real AI call was made while building; step 8 is the first one. If anything looks wrong, switch AI off
  (`enabled = false`) and tell Claude.
- Real Low/Mid phone testing and the final Claude review are still pending (D36/D63 gates).
