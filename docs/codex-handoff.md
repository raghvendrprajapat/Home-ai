# Claude Code → Codex development handoff (D80)

Owner instruction: 2026-10-20 (chat, Hinglish: "ab tak kya kya ho chuka hai iska context mujhe Codex ko dene hai … itni detail honi chahiye ki tum dono ke work me koi conflict na ho"). Repository: [raghvendrprajapat/Home-ai](https://github.com/raghvendrprajapat/Home-ai).

**Claude Code stops building when this handoff is merged into main.** Codex becomes the sole builder when the owner sends [the resume prompt](codex-resume-prompt.md). This reverses the D52 direction (Codex → Claude, 2026-10-17). Never run both builders at the same time. After this, Claude only reviews (PR comments or chat) and only when the owner asks. It never pushes, merges or opens PRs unless the owner hands building back in a new message.

This is a development handoff. It does not open any gated scope (see §6), and it is not the final Claude review.

## 1. Read in this order

1. `AGENTS.md` (rules); `docs/codex-start-here.md` §2, especially D17, D36, D63, D72–D80.
2. This file.
3. `docs/specs/phase1-quality.md` (D76 contract and anti-cheat rules); `docs/combined-research.md` (spec).
4. The decision and verification records linked from the D72–D79 rows, and the open PRs on GitHub.
5. The older [Codex → Claude handoff](claude-code-handoff.md) is history. Its "remaining work" list is out of date; use §5 below.

## 2. State of main at this handoff

Main = `30c89eb9baa587f18d88196c0892f58eb735253e` (PR #140), plus this docs-only handoff PR once merged. Everything below was built by Claude Code under D52 and merged only after all CI checks were green. Claude wrote its own tests; they are not independent evidence (§4).

| PR | What it added | Decision |
|---|---|---|
| #129–#131 | Audit fixes: furniture geometry as new versions, cloud save recovery/sign-in/trash, floor-aware 3D picking | D74 |
| #132 | Vercel config for the owner's web preview | D75 |
| #133 | Phase 1 quality spec and the acceptance guard (`scripts/acceptance-guard.mjs`) | D76 |
| #134 | Independent acceptance tests `tests/acceptance/*` + `MANIFEST.sha256`, written by a separate agent from the spec only | D76 |
| #135, #137 | Realistic 3D: CC0 textures + HDRI with rights records, ACES, shadows, furnished sample (`apps/web/src/samples/showcase.ts`), "Low walls" cutaway (default 1 m), wall-cap colour, tight camera fit | D76-M1 |
| #136 | Pro editor shell: top bar, Tools rail (Draw, Openings, Furniture, Materials, Copilot, Project), one panel at a time, phone bottom sheet | D76-M2 |
| #138 | Copilot chat on the offline stand-in (2BHK/1BHK template, paint walls, floor finish, furnish a room, one Undo per change); `ApplySurfaceMaterials` core-model command | D76-M3 |
| #139 | Calmer 3D screen: compact floating tools, phone sheet no longer covers the house, refit on resize | D79 |
| #140 | 2D plan and plan PNG draw furniture as original top-view symbols (`apps/web/src/editor/furniture-symbol.ts`) | D78 |

**Earlier work by Claude (D53–D73), all merged:** wall-segment drag, starter templates, walk mode, furniture grouping and colour variants, multiple floors, stairs and roofs, Supabase cloud save, conflicts and version history, share links, account deletion and export, Android Google sign-in, modern original furniture (D72), and the AI stand-in features AI-1/2/3 (D73). See the codex-start-here rows. Live cloud still needs owner-created Supabase and Google projects (D63).

## 3. Open work at handoff: one PR, now owned by Codex

**PR #141 (D77 decor pack), branch `decor-models`, head `4de03e5c0a58a1c5cde0974b17008de93ca1a2ad`.**

- **What it adds:** curtains (floor and window length), floor lamp, table lamp, framed wall art, a leafy planter (v3), and better coffee table, armchair, sliding wardrobe and 3-seat sofa (new versions).
- **Pipeline:** opt-in `mergeByMaterial` (fewer draw calls). The sample house gets this decor, and mid draw calls drop from 183 to 145.
- **Low walls view:** raised items whose middle is above the cut are hidden there.
- **2D symbols:** the curtain and wall-art symbols now use the item's own colour. The D78 catalog test found this after main was merged.
- **Test changes:** count and newest-version numbers only. They are listed in the PR body.
- **Verification on that head:** local `pnpm check` exit 0 (832 tests). Earlier head `bc8fc0b`: acceptance 36 passed, 1 fixme.
- **CI at handoff time:** Check, Acceptance and Cloud database were green; Android debug was still running. Claude did not merge it: the owner paused execution while asking for this handoff.

**Codex, first task:** read the PR and its two comments. Confirm that every required check is COMPLETED SUCCESS on the exact current head. Then squash-merge with `expectedHeadSha` = that head.
- If main moved, merge main into `decor-models` (no rebase/force-push), re-run `pnpm check`, push and wait for green.
- If the head is red, root-cause and fix it on `decor-models`.

Claude will not push to `decor-models` again.

## 4. Rules that are easy to break (all still binding)

- **Locked acceptance tests (D76):**
  - Never edit `tests/acceptance/**` or `tests/acceptance/MANIFEST.sha256`; `pnpm acceptance:guard` (first step of `pnpm check`) fails if you do.
  - `tests/acceptance-enabled.txt` may only gain lines. Removing one needs an owner-visible reason.
  - The separate CI job "Acceptance (independent)" must stay green.
- **Existing tests:**
  - Never change an assertion to make code pass. Allowed edits: setup-only lines, and catalog counts or newest-version pins forced by a new immutable asset version (say so in the PR).
  - The M1 defaults (furnished sample, low walls) made old e2e tests use a setup-only `beforeEach`: `navigator.deviceMemory=2`, `localStorage['gharplan-e2e-sample']='fixture'`, `localStorage['gharplan-low-walls']='0'`. New e2e tests that expect the plain fixture need the same block.
  - Panels open through `tests/e2e/helpers/tools.ts` (`openTool`, `closeTool`, `openToolIfShown`).
- **Performance budget:** the locked R1 test allows **≤ 200 draw calls on mid** with the furnished sample. A bookcase once pushed it to 221 and was removed. Use `mergeByMaterial` for new multi-part assets.
- **Catalog:**
  - Asset versions are immutable. Change a design as a new `sources/a_<id>-v<N>.json`, then run `pnpm assets:build`, `assets:check` and `assets:versions`.
  - Every asset and texture needs a rights record. No GPL/AGPL, no non-commercial assets, nothing from Planner 5D.
  - **No fridge, toilet, basin or other appliances/sanitaryware** (owner, 2026-10-20) unless the owner changes this.
- **AI:**
  - No live AI or AI-render call of any kind until the owner sets a monthly cost limit (D76).
  - Customer plans or photos go to an AI only after consent and a privacy-policy update.
  - Provider choice is Google Gemini.
  - Keys stay on the server only; never in code, logs or chat.
- **Builder honesty:** Claude-authored tests are the builder's own tests. Do not present them, or your own, as independent fixtures.
- **Merging:** one task per branch/PR. Never merge red CI. Merge with the 40-character `expectedHeadSha`. Every PR body ends with the 4-part Owner summary.

**Known local quirks (not regressions):**
- `tests/e2e/furniture-gestures.spec.ts` rotation-handle test (~line 37/38) fails on unchanged main in Claude's container and passes in CI.
- Under heavy machine load, fast-check property tests in `packages/core-model/src/core-model.test.ts` and `persistence.test.ts` can exceed 30 s; they pass when re-run alone and in CI.
- `furniture-placement:28` and 3D first-render waits can time out under load.

Prove any such claim by re-running before calling it environmental.

## 5. What remains to reach the owner's reference-video level

The last independent screenshot review (before D77–D79) scored the product **4/10**. A fresh independent review after #141 is still pending.

The gaps below are ranked by impact, as discussed with the owner on 2026-10-20. Nothing here is started. Items 1–6 need no paid service and no new owner permission; they are ordinary D17 editor/3D/furniture/material work.

1. **Catalog breadth:** 42 items vs the reference app's very large catalog. Add original Indian-size designs (beds, sofas, almirahs, chairs, tables, decor) as new immutable assets within the draw-call budget.
2. **Model detail:** the parametric box/rounded/cylinder pipeline looks simple. Options:
   - richer pipeline shapes;
   - CC0 models with rights records;
   - commissioned or licensed models, which need an owner budget decision.
3. **Lighting:** lamps don't emit light, and there is no day/night. Add lamp and ceiling lights and a day/night choice within the mid/low budgets.
4. **Materials:** only a few textures (12 files). Add more CC0 tiles, wood, marble and wallpapers with rights records.
5. **Ready-made design gallery:** only one furnished sample. Add furnished 1/2/3BHK examples built from real commands.
6. **High-quality image export from the device:** a better-than-screen PNG of the 3D view, with no server.

**Owner decisions needed first (ask, don't assume):**

7. **Live Gemini Copilot (Phase 2)** and **AI photo-renders (Phase 3)**: need the monthly cost limit, consent UI and a privacy-policy update.
8. **Kitchen appliances and bathroom fittings:** currently refused by the owner.
9. **Angled or curved walls:** L0 is 0°/90° only.
10. **Garden/exterior:** not in scope yet.
11. **3D-model budget:** whether to buy licensed models.

**Still gated (D36/D63):**
- billing, ads and subscriptions;
- mobile optimization and real Low/Mid phone testing;
- analytics;
- release packaging;
- final Claude review.

Real-phone checks for all of the above remain pending and must be reported as pending.

## 6. No-conflict protocol between Codex and Claude

| Topic | Rule |
|---|---|
| Who builds | Codex only, from the owner's resume prompt onward. Claude's last push is the head listed in §3 plus this handoff PR. |
| Branches | Codex creates only **new** branch names that do not already exist on GitHub (e.g. `d81-catalog-wave-1`). Never push to an existing branch from earlier work, such as `claude/planner5d-reverse-engineering-lvgvo9`, `m1-realistic-3d`, `m1-polish`, `m2-editor-shell`, `m3-copilot`, `phone-3d`, `plan-symbols`, `acceptance-tests` or `fr0xx-*`. The one exception is `decor-models`, which Codex owns until #141 is merged. |
| Decision numbers | D77 is in #141. D80 is this handoff. Codex starts at **D81** and adds rows after D80 in `docs/codex-start-here.md`. |
| Shared files | `docs/codex-start-here.md` is the shared record. Append rows; never rewrite another agent's row except to mark it superseded with a reason. |
| Reviews | If the owner asks Claude to review, Claude answers in a PR comment or chat only. Codex decides on the fix and pushes it. |
| Handing back | Only the owner can hand building back to Claude, in a new message. Before that, Codex writes a short checkpoint (main SHA, open PRs with heads and CI, work in progress) into a new `docs/` handoff or a GitHub issue. |
| Owner communication | Simple Hinglish, step-by-step phone tests, never ask the owner to read or edit code, never ask for keys. Report real command output; screenshots alone are not evidence. |
