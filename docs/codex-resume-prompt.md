# Owner prompt: resume in Codex (D80)

Paste the text below into a new Codex task connected to `raghvendrprajapat/Home-ai`, branch `main`. Send it only after the D80 handoff PR is merged. Claude Code has stopped building; do not run both builders.

```text
I am the owner of raghvendrprajapat/Home-ai. Claude Code has handed development back to you under D80 (see docs/codex-handoff.md). You are now the sole builder: you may plan, implement, test, push NEW task branches, open PRs and merge a PR only when every required check (Check, Acceptance (independent), Cloud database, Android debug) is COMPLETED SUCCESS on its exact head, using the 40-character expectedHeadSha. Claude Code will not push, merge or open PRs; it only reviews if I ask.

Step 1: read, do not change anything yet.
Read AGENTS.md, docs/codex-handoff.md (all of it), docs/codex-start-here.md §2 (especially D17, D36, D63, D72–D80), docs/specs/phase1-quality.md and docs/build-process-guide.md. Fetch main and list the open PRs. Then tell me in simple Hinglish:
 a) what the app can do now (short);
 b) the exact main SHA you see, and the state of PR #141 (head SHA and each check);
 c) the rules from docs/codex-handoff.md §4 and §6 you must follow, in your own words;
 d) anything in the handoff that does not match what you see on GitHub. If something does not match, stop and ask me.

Step 2: finish PR #141 (D77 decor pack), the only open work.
It belongs to you now (branch decor-models). If all required checks are green on its exact head, squash-merge it with expectedHeadSha. If main has moved, merge main into decor-models (no rebase, no force-push), run pnpm check, push and wait for green. If a check is red, find the root cause and fix it on decor-models. Report actual command output.

Step 3: propose, then build, the next work from docs/codex-handoff.md §5 items 1–6 (catalog breadth, model detail, lighting, materials, ready-made design gallery, high-quality image export). Start with what you think gives the biggest visible improvement within the ≤200 mid draw-call budget. One task per new branch and PR, decision rows from D81 onward, pnpm check before every commit, Owner summary in every PR.

Hard rules:
- Never edit tests/acceptance/** or its MANIFEST. tests/acceptance-enabled.txt may only gain lines. Never weaken, skip or delete a test. Only setup-only lines, or catalog counts/newest-version pins forced by a new immutable asset version (named in the PR), may change in existing tests.
- Asset versions are immutable; every asset and texture needs a rights record; no GPL/AGPL, no non-commercial assets, nothing copied from Planner 5D; no fridge, toilet, basin or other appliances/sanitaryware.
- No live AI or AI-render call until I set a monthly AI cost limit. No secrets in code, logs or chat; never ask me for keys.
- Ask me first before items 7–11 of §5 and every gated scope: billing, ads, subscriptions, mobile optimization, real Low/Mid phone testing, analytics, release packaging, final Claude review.
- Use only new branch names that do not already exist on GitHub (except decor-models for PR #141).
- Claude's tests are the builder's own tests, not independent fixtures; say so honestly.
- Do not claim phones, external services or reviews passed unless they actually ran; report them as pending.

Talk to me in simple Hinglish. Never ask me to read or edit code. For every PR, give me step-by-step phone test steps.
```
