# AGENTS.md: shared rules for Codex and Claude Code (GharPlan)

Both agents read this file. Codex reads `AGENTS.md` automatically. Claude Code reads it when the repo has no `CLAUDE.md`; otherwise a `CLAUDE.md` containing `@AGENTS.md` imports it. Keep this file under 200 lines.

## 1. Read first (same context for both agents)
| File | What it is |
|---|---|
| `docs/codex-start-here.md` | Current state, all owner decisions, roles, model guidance, first prompts. **Read this at the start of every new session.** |
| `docs/combined-research.md` | The product + engineering spec (merged Claude + Codex research). Task IDs (PHx-Tyy), requirements (PRD-FR/NFR), decisions (ADR), tests (GEO/SYNC/REN/REL/SEC/UX/AI/MON/DM/PERF/AST) all come from here |
| `docs/build-process-guide.md` | How we work: task cycle, prompts, reviews, phone testing, safety |
| `docs/examples/sample-project.json` + `project.schema.json` | Validated example project (fixture) |

If code, this file and the spec disagree, **stop and ask the owner**. Do not guess.

## 2. Owner and roles
- **Owner:** Raghvendr. Not a programmer, "AI-first". Communicates in Hinglish.
  - Explain everything in simple words.
  - Never ask him to read or edit code.
  - Always give step-by-step phone test instructions.
  - He approves plans and tests on phones. On 2026-10-11 he authorized Codex to merge PRs until his next instruction. Codex may merge only after all applicable task checks/reviews pass; this permission does not waive phone tests, Claude reviews or specification decisions.
- **Codex = main builder.** Plans, implements, writes tests, runs checks and self-reviews for nearly every task.
- **Claude Code = second checker** (limited usage, so it is used sparingly):
  - ⭐ tasks: deep review before merge; independent test fixtures for the riskiest modules.
  - Normal tasks: weekly batch review of merged PRs.
  - Rescue: after Codex fails twice on the same problem.
  - Security review before release.
  - Claude does not rewrite Codex's implementation except in a rescue the owner asked for.
- **GitHub Actions (CI)** runs lint, types, tests and builds on every PR. Red CI = never merge.

## 3. Scope (owner decisions; do not change without the owner)
- Product: Planner 5D-inspired home planner. **Web app + Android app (Capacitor), mobile-first, Hindi + English, must work on budget Android phones.**
- **Out of scope:**
  - Electrical/wiring features of any kind.
  - Marketing website pages (home, about, blog). The only web pages are the Play-required privacy-policy page and account-deletion page.
  - Real-time collaboration, photoreal server renders, DWG/BIM, iOS app, AR, user-uploaded 3D models.
  - AI before the first release.
- **L0 (first release):** one floor; straight walls at 0°/90° only, with L/T junctions; X-crossings and other angles are rejected.
- Never copy anything from Planner 5D (code, assets, catalog, UI art, private APIs).

## 4. Architecture rules (never break)
1. Project data changes **only** through `core-model` commands. Renderers (Konva 2D, Three.js 3D) never write the model. Konva state is never saved.
2. Model stores **integer millimetres**; floats only in derived data. Plan axes: X east, Y south (down, like the screen), Z up. Three.js mapping `(x/1000, z/1000, y/1000)`; Three `rotation.y = −θ`.
3. `document.revision` = last **server-confirmed** revision only. `localGeneration` +1 on every edit/undo/redo, never reused. Worker/async results carry `{projectId, sessionId, localGeneration, dependencyHash}`; stale results are dropped.
4. Every command is **atomic**: if validation fails, the model is unchanged. Normalization and room recomputation happen inside the command, so undo is exact.
5. Openings use `offset` = distance from `wall.a` to the opening **centre**. Reversing the wall gives `newOffset = L − offset` and toggles `flipX`. A split through an opening is rejected.
6. Cloud save = `{expectedServerRevision, commandId, document}` with an idempotency receipt (§H.5). Never last-write-wins; a conflict creates a copy.
7. **No secrets** (API keys, Supabase service key, signing keys, Play JSON) in code, logs, the app bundle or chat. Use Supabase/GitHub secrets.
8. New dependency: first record name, version and license in `docs/decisions/dependencies.md`. **No GPL/AGPL code, no non-commercial assets**, and every 3D asset needs a license record.

## 5. Working rules
- **One task ID per branch and PR.** Branch name like `ph0-t02-geometry`. No unrelated refactors.
- **Plan first:** before editing, post a plan (files, tests with independent expected values, failure modes, out-of-scope) and wait for the owner's OK. Skip only for one-line fixes.
- **Tests:**
  - Every geometry function gets unit tests + at least one fast-check property test, with analytic expected values (not values produced by the same code).
  - Make the listed test IDs from the spec pass.
- **Independent fixtures:** files under `tests/fixtures/independent/` are written by the *other* agent. Never edit them to make your code pass. If one looks wrong, explain why in the PR and ask the owner.
- Run `pnpm check` (lint + typecheck + tests) before every commit. **Never skip, delete or weaken a test.**
- **Evidence:** report actual command output. Screenshots and "it works" are not evidence of geometry, saving or performance.
- **Every PR description ends with an "Owner summary"** in simple English:
  - (1) what the app can do now;
  - (2) how to test on the Low and Mid phones, step by step;
  - (3) what is NOT done;
  - (4) risks.
- **⭐ tasks** (label `star`: geometry core, core-model/undo, 3D sync/stale guard, openings, local save, cloud save/RLS, billing, release) are not merged until Claude's deep review findings are fixed.
- If you fail twice on the same problem, stop and say so plainly. The owner will bring in the other agent.

## 6. Commands (PH0-T01; run from repository root)
- Runtime: Node 24.19.0 (`.node-version`), pnpm 11.19.0 (`packageManager`).
- `pnpm install --frozen-lockfile`: install the recorded dependency graph
- `pnpm check`: lint + typecheck + tests (required before commit)
- `pnpm dev`: run the web app locally
- `pnpm build`: build the web application
- See `apps/web/README.md` for the current shell and validation limits.
- Android build steps: see `docs/benchmarks/phase0.md` (created in PH0-T07)
