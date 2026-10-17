# AGENTS.md: shared rules for Codex and Claude Code (GharPlan)

Both agents read this file. Codex reads `AGENTS.md` automatically. Claude Code reads it when the repo has no `CLAUDE.md`; otherwise a `CLAUDE.md` containing `@AGENTS.md` imports it. Keep this file under 200 lines.

## 1. Read first (same context for both agents)
| File | What it is |
|---|---|
| `docs/codex-start-here.md` | Current state, all owner decisions, roles, model guidance, first prompts. **Read this at the start of every new session.** |
| `docs/combined-research.md` | The product + engineering spec (merged Claude + Codex research). Task IDs (PHx-Tyy), requirements (PRD-FR/NFR), decisions (ADR), tests (GEO/SYNC/REN/REL/SEC/UX/AI/MON/DM/PERF/AST) all come from here |
| `docs/build-process-guide.md` | How we work: task cycle, prompts, reviews, phone testing, safety |
| `docs/examples/sample-project.json` + `project.schema.json` | Validated example project (fixture) |

If code, this file and the spec disagree, investigate and record a reasoned resolution under D17. Ask only when necessary information or authorization is missing; never silently change accepted fixtures or product scope.

## 2. Owner and roles
- **D52 handoff override (2026-10-17):** the owner requested that Codex finish only already-running catalog/split-view work, start no new feature, then hand development continuity to Claude Code through GitHub and a resume prompt. Codex stops after that checkpoint. Claude becomes the sole builder when the owner sends the resume prompt; D16's no-development/no-push rule is superseded only for that delegated continuation. Do not run both builders concurrently. D36 permission gates remain fully binding, including final Claude review. Read `docs/claude-code-handoff.md` and its linked final GitHub checkpoint before continuing. Self-authored tests/review never become independent evidence merely because the builder changes.
- **Owner:** Raghvendr. Not a programmer, "AI-first". Communicates in Hinglish.
  - Explain everything in simple words.
  - Never ask him to read or edit code.
  - Always give step-by-step phone test instructions.
  - D36 (2026-10-14) requires explicit owner permission BEFORE any accounts/cloud saving/sync/conflicts/version-history work; mobile optimization/direct sharing/real Low–Mid testing; billing/subscriptions/security/privacy/release packaging/final Claude review. Do not start these scopes, including preparatory implementation, until authorized. D17 continues for other editor/3D/furniture/material tasks and green merges. Existing automated product checks/debug CI remain ordinary validation; no release packaging or real-phone tests.
  - D17 (2026-10-11) authorizes continuous development, routine decisions, verification and green-PR merges without repeated plan approval. Real-phone and external-service checks remain release requirements; report them pending until actually executed.
- **Codex = outgoing main builder (D52).** Plans, implements, writes tests, runs checks, opens/pushes PR branches and applies review findings.
- **Claude Code = incoming builder only under the owner's D52 continuation prompt; otherwise the D16 review role below applies.** The older review-only/no-development/no-push instructions are historical for that delegated continuation. Review results remain PR comments or chat:
  - D17 defers Claude's deep, batch, rescue and security reviews until the agreed development and Codex verification are complete. Claude review is still required before commercial release, but is no longer a development or PR-merge prerequisite.
  - Future independent fixtures PH2-T04a/PH5-T03a are deferred to final review. Codex must use clearly attributed analytic/property/fault-injection tests meanwhile, without claiming independent Claude authorship. If Claude later supplies fixture data in a **PR comment**, Codex copies it exactly and links it under D16. PR #60's accepted geometry fixtures remain protected.
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
- **Plan first:** communicate scope, tests and failure modes, then proceed under D17's standing authorization. Record routine decisions; do not repeatedly request approval.
- **Tests:**
  - Every geometry function gets unit tests + at least one fast-check property test, with analytic expected values (not values produced by the same code).
  - Make the listed test IDs from the spec pass.
- **Independent fixtures:** expected cases/values come from Claude, not the implementation. For PH2-T04a/PH5-T03a, Codex may initially copy Claude's source PR-comment data into `tests/fixtures/independent/` **exactly as given, without changing any value**, and must link the source comment in the fixture PR. Verify the copy against the comment before merge. Never edit accepted fixtures (including PR #60) to make code pass. If a case is wrong, incomplete or not ready to copy, explain why in the PR and ask the owner; obtain a corrected Claude source comment before a separately approved correction. Do not invent or silently repair expected values.
- Run `pnpm check` (lint + typecheck + tests) before every commit. **Never skip, delete or weaken a test.**
- **Evidence:** report actual command output. Screenshots and "it works" are not evidence of geometry, saving or performance.
- **Every PR description ends with an "Owner summary"** in simple English:
  - (1) what the app can do now;
  - (2) how to test on the Low and Mid phones, step by step;
  - (3) what is NOT done;
  - (4) risks.
- **⭐ tasks** require thorough tests and a fresh Codex review before merge. Claude's review is deferred by D17; report that accurately, and keep external/device release gates pending until proven.
- Repeated failures require diagnosis, regression tests and a documented limitation if unresolved. Continue unaffected authorized work; do not weaken tests or fabricate success.

## 6. Commands (PH0-T01; run from repository root)
- Runtime: Node 24.19.0 (`.node-version`), pnpm 11.19.0 (`packageManager`).
- `pnpm install --frozen-lockfile`: install the recorded dependency graph
- `pnpm check`: lint + typecheck + tests (required before commit)
- `pnpm dev`: run the web app locally
- `pnpm assets:build`: explicitly regenerate the original static catalog; `pnpm assets:check` compares artifacts read-only.
- `pnpm assets:versions`: compare immutable catalog versions against the Git baseline; local checks require `origin/main`, CI supplies the reviewed base SHA.
- `pnpm build`: check catalog artifacts and build the web application
- See `apps/web/README.md` for the current shell and validation limits.
- Android build steps: see `docs/benchmarks/phase0.md` (created in PH0-T07)
