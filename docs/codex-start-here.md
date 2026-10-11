# Start Here: project brief for Codex and Claude Code

**Date:** 2026-10-11 · **Owner:** Raghvendr · **Read with:** [`../AGENTS.md`](../AGENTS.md) (rules), [`combined-research.md`](combined-research.md) (spec), [`build-process-guide.md`](build-process-guide.md) (process).

This file carries **every decision made so far**, including decisions made in chat that are not in the other documents. Both agents get the same context from it. Update it when a decision changes; the owner asks an agent to do that.

**Current authorization (D17):** develop continuously, make routine decisions, audit/test/fix, and merge green PRs. Claude reviews after agreed development and Codex verification, before commercial release. This supersedes older per-task approval, pre-build independent-fixture, weekly/plan/deep-review and rescue pause instructions throughout these documents. Preserve accepted fixtures; record any unexecuted external/device checks honestly.

---

## 1. The project in 10 lines

- **What:** a Planner 5D-inspired home planner called "GharPlan" (placeholder name). The user draws rooms to real dimensions, adds doors, windows and furniture, and sees the result in 3D.
- **For whom:** Indian homeowners and small contractors/interior designers. Hindi + English. Must run on ₹10–20k Android phones.
- **Platform:** one TypeScript codebase. Web app + Android app via Capacitor. Google Play distribution.
- **Money:** freemium. Google Play Billing subscription, ads only outside the editor, optional rewarded unlock. AI credits only later.
- **Core promise:** measurements you can trust, 2D = 3D always, and your work is never lost.
- **Owner:** not a programmer. He tests on two phones (Low: Galaxy A0x/Redmi A; Mid: Galaxy A3x/A5x) and approves plans. Merge authority follows D15 below.
- **Current state:** Research PR #1 and PH0-T01 PR #2 are merged; the three-package TypeScript shell and CI are established. Accepted geometry fixtures are merged in PR #60 (historical Claude authorship before D16). PH0-T02 now implements pure L0 wall normalization, exact footprints/clear areas, half-edge rooms and identity; all 50 phase geometry fixture cases and 10,000 seeded command sequences pass. See [`verification/ph0-t02.md`](verification/ph0-t02.md) for actual checks, audit findings and remaining gates. D17/D18 are recorded in merged PR #62. Next is PH0-T03 core-model commands/undo, followed by editor/3D/saving/Android. There is no interactive editor or Android build yet; real-phone checks and ten-user interview completion are not confirmed. Claude review and future independent-comment fixtures are deferred to the final development audit under D17; accepted data remains protected.

## 2. Owner decisions (binding)

| # | Decision | Where in spec |
|---|---|---|
| D1 | **No electrical/wiring features.** The app and the owner's electrical shop are separate businesses | combined-research header, §C.1 |
| D2 | **No marketing website now.** Only the Play-required privacy-policy page and account-deletion page | FR-047, §O.3 |
| D3 | Web + Android (Capacitor), mobile-first | ADR-001, ADR-009 |
| D4 | First release (L0) = one floor, walls at 0°/90° only, L/T junctions | §C.1, §E.4 |
| D5 | Stack: TypeScript, React + Vite, Zustand (UI only), Konva (2D display only), custom `geometry` + `core-model` with Immer patches, Three.js WebGL2, Supabase (Postgres JSONB snapshots, Auth, RLS, RPC), Cloudflare R2, Play Billing, AdMob, Vitest + fast-check + Playwright | Part D, §D.25 |
| D6 | **Codex = main builder; Claude Code = review-only second checker** under D16 (Claude's usage limit is lower) | AGENTS.md §2; D16 |
| D7 | **2-level Claude check:** ⭐ tasks get a deep Claude review before merge; normal tasks get a weekly batch review | build-process-guide §6 |
| D8 | Independent cases and expected answers come from Claude before Codex implements the matching risky module. PH0-T02a geometry is complete in PR #60, authored before D16. Future PH2-T04a openings and PH5-T03a save races use Claude's PR-comment data, copied exactly by Codex under D16; merge each fixture PR before the matching implementation. | build-process-guide §7; D16; PR #60 |
| D9 | AI features only after the first Play release, and only if a spike shows value; Gemini terms require an 18+ audience | Part I, §O.3 |
| D10 | Never copy Planner 5D code, assets, UI or private APIs | §O.1 |
| D11 | **Wall thickness: 50–1000 mm, inclusive, stored as integer mm.** The sample schema maximum is 1000, matching FR-007, §D.4 and §E.12.2; values outside the range are rejected. | Owner instruction; FR-007, §D.4, §E.12.2; project.schema.json |
| D12 | **Small closed rooms:** keep every bounded face whose clear (inside) area is positive. If clear area is < 0.25 m², keep the room and show a warning such as "very small space — shaft/niche?"; at exactly 0.25 m² no small-space warning is needed. Zero or negative clear area is an invalid drawing: reject the command with a clear error and leave the model unchanged. Never silently discard a small valid room. | Owner instruction; §E.7; GEO-021 |
| D13 | **Area tests:** use unrounded clear-area mm² with existing tolerances; m² labels are formatted and tested separately. Initial sample 20642175/15872175 mm²; moved partition 21119175/15395175 mm². | Owner approval; §H.6; DM-003 |
| D14 | **Raw input and canonical validation:** the 0.4 mm case is transient pointer/preview input before snapping/quantization to an integer-mm command. Fractional canonical project/command coordinates are rejected unchanged. Test the stages separately. | §E.1, §E.13; GEO-016 |
| D15 | **Merge delegation (2026-10-11; formerly D13):** the owner said, "mere next instructions tak pr tum khud merge karoge". Until he changes this instruction, Codex may merge prepared PRs after all applicable CI, review and task acceptance gates pass. This changes only who clicks Merge; plan approval, real phone testing, Claude checks and unresolved specification decisions remain required where applicable. Older owner-merge examples in the guide are superseded by this decision. | Owner instruction; AGENTS.md §2 |
| D16 | **Claude review-only (2026-10-11):** Claude Code does no development work and never pushes to the repository. Claude only reviews (⭐ deep reviews, weekly batch review, security review and rescue diagnosis), replying in PR comments or chat. For independent fixtures PH2-T04a and PH5-T03a, Claude writes the cases and expected values as text in a PR comment; Codex copies them into `tests/fixtures/independent/` exactly as given, without changing any value, and links the source comment in the PR. This supersedes older instructions permitting Claude development, file authoring, fixture PRs or rescue implementation. | Owner instruction; AGENTS.md §2/§5; build-process-guide C1/C3/§7.1 |
| D17 | **Continuous development and final Claude review (2026-10-11):** owner authorized Codex to continue through agreed app development, decide routine ambiguities using best judgement, audit and verify the work, and merge checked PRs. Claude reviews only after development and Codex verification; no Claude development/push. This supersedes D7/D8/D15/D16's earlier review timing and per-task owner-approval/pause gates. Existing accepted fixtures remain unchanged. Future Claude fixture comments are deferred; Codex tests must be explicitly attributed. CI, security, real-device and external-service release requirements remain; do not describe unexecuted checks as verified or claim universal "100%" correctness. | Latest owner instruction and "Okey do it"; AGENTS.md §2/§5 |
| D18 | **Free wall caps (Codex implementation decision under D17):** an unconnected end extends its rectangular footprint by thickness/2 beyond the centreline endpoint (a conventional square cap). L/T junction extensions use the perpendicular wall half-thickness to close the corner without double-counting union area. Room clear area subtracts these actual footprints, including dead-end stubs. Existing independent fixtures contain no free-cap expectation and remain untouched. | §E.6 ambiguity; independent geometry README open question; geometry implementation/tests |

## 3. Which model for which job (benchmark-based, 2026-10-11)

These are independent Vals.ai results at **max effort**. Your app's default settings may differ, and small gaps (2–3%) are noise.

| Benchmark | Claude Opus 5.5 | GPT-6.1 Sol | Meaning for us |
|---|---|---|---|
| Vals Index (overall) | 66.97% (#3), $32.14/test | 61.15% (#8), $3.24/test | Opus a bit stronger; Sol ~10× cheaper per test |
| Terminal-Bench 4.0 (long coding tasks) | 65.15% (#1) | 55.05% (#6) | Opus for the hardest multi-step work |
| ProgramBench (build a whole program) | 18.50% (#1) | 3.00% | Opus |
| Vibe Code Bench v1.1 (build apps) | 90.29% | 88.93% | About equal, so use Sol (cheaper) |
| Code Migration | 66.65% | 65.12% | About equal |
| SRE Bench (fix build/ops problems) | 33.59% | 50.76% (#2) | Sol |
| CyberBench (security) | 55.36% | 39.29% | Opus for security review |

**Use:**

| Model | Jobs |
|---|---|
| **GPT-6.1 Sol in Codex** | All building, UI, catalog, i18n, export, Android/Capacitor, CI and build problems, normal reviews |
| **Claude Opus 5.5** | Review-only: ⭐ plan/deep reviews (geometry, undo/sync, openings, saving, RLS, billing), independent case/expected-value PR comments, rescue diagnosis, security review |
| **Claude Sonnet** | The weekly batch review of normal PRs (saves Claude usage) |

Sources: vals.ai model pages for both models (fetched 2026-10-11), and Artificial Analysis for GPT-6.1 Sol.

## 4. How every task runs

1. **Codex:** communicate plan → code + tests → `pnpm check` → fresh review → PR with Owner summary, under D17's standing authorization.
2. **GitHub Actions** must be green; merge only the verified PR head.
3. **Codex:** fix findings, record evidence and pending device/external checks, merge under D15/D17, then continue the next task.
4. **Final review/release:** Claude reviews the completed work; Codex fixes findings. Owner/external testers execute required Low/Mid phone and service checks before commercial release.

Stop rules:
- Diagnose repeated failures, add regression coverage, document unresolved risks and continue unaffected work. Obtain external expertise where needed without claiming the blocked gate has passed.
- Never merge red CI or weaken accepted fixtures. D17 supersedes older automatic pause rules.

## 5. Task order

Full details, prompts and "you check" steps are in `build-process-guide.md` §7. Specs come from `combined-research.md` §L.2. ⭐ = Claude deep check.

| Phase | Tasks |
|---|---|
| 0 Proofs | PH0-T01 repo + CI · PH0-T02a ⭐ independent geometry fixtures (**merged PR #60, before D16**) · PH0-T02 ⭐ geometry core · PH0-T03 ⭐ core-model + undo · PH0-T04 2D view · PH0-T05 ⭐ 3D view · PH0-T06 perf page · PH0-T07 Android build + phone benchmark · PH0-T08 ⭐ local save + kill test → **expert review** |
| 1 Foundation | PH1-T01…T05 |
| 2 2D editor | PH2-T01…T03, PH2-T04a ⭐ fixtures, PH2-T04 ⭐ doors/windows, PH2-T05, PH2-T06 |
| 3 3D | PH3-T01, PH3-T02 ⭐ worker/stale guard, PH3-T03…T06 |
| 4 Furniture | PH4-T01…T05 |
| 5 Cloud | PH5-T01 ⭐ RLS, PH5-T02, PH5-T03a ⭐ fixtures, PH5-T03 ⭐ save protocol, PH5-T04…T06 |
| 7 Mobile | PH7-T01…T06 (T06 ⭐ security) |
| 8 Release | PH8-T01 ⭐ billing … PH8-T08 ⭐ release |
| 6 AI | After the first release only |

## 6. What NOT to do

- Do not begin an unrelated scope change; communicate plans and proceed under D17 for the agreed development.
- Do not build features outside the current task, especially electrical features, website pages, AI, multiplayer or iOS.
- Do not save Konva or Three.js state as project data.
- Do not alter independent cases/expected values to make code pass. D16 permits Codex's initial exact copy from Claude's source PR comment for PH2-T04a/PH5-T03a, with the comment linked in the fixture PR; disputed corrections require owner resolution and a corrected Claude source comment.
- Do not weaken or delete tests.
- Do not put secrets in code or chat.
- Do not add GPL/AGPL code or unlicensed assets.
- Do not tell the owner something works without test output and phone steps.

## 7. ID glossary

| Prefix | Meaning |
|---|---|
| PHx-Tyy | Roadmap task (Part L) |
| PRD-FR / PRD-NFR | Requirement (Part C) |
| ADR | Technology decision (§D.25) |
| TRD | Technical requirement (Part D) |
| DM, GEO, SYNC, REN, PERF, AST, REL, SEC, UX, AI, MON | Test IDs (Part M) |
| F-xx | Planner 5D feature evidence (Part A) |
| §X.n | Section in combined-research.md |

---

## 8. Prompts for the owner to paste

**Prompt 1: onboarding.** Paste this first, in a new Codex task, with repo `Home-ai` and branch `claude/planner5d-reverse-engineering-lvgvo9` (or `main` after the merge).
```text
You are the main builder for this project. Read AGENTS.md, docs/codex-start-here.md,
docs/build-process-guide.md and docs/combined-research.md (focus on Parts 0, C, D, E, F, G, H, L, M).
Do NOT write code yet. Reply in simple English (I am not a programmer):
1) What we are building and for whom, in 5 lines.
2) The rules you must follow (top 10).
3) The Phase 0 tasks in order, and which ones need Claude's deep check.
4) Any contradictions, unclear points or risks you found in the documents, with file + section.
5) What you need from me (accounts, phones, decisions) before PH0-T01.
```

**Prompt 2: repository setup.** Run after Prompt 1 looks right.
```text
Task: repository setup (no app code).
1) Open a pull request that merges branch claude/planner5d-reverse-engineering-lvgvo9 into main.
2) After I merge it, create one GitHub issue per task listed in docs/build-process-guide.md Part 7
   (title "PHx-Tyy short name", body = the task's specific instruction + "You check" text),
   labels: phase-N, and "star" for ⭐ tasks.
3) Give me click-by-click steps to protect the main branch (require PR + passing checks).
Show me the plan first and wait for my OK.
```

**Prompt 3: first build task.**
```text
Task PH0-T01: Repo skeleton + CI. Follow AGENTS.md and docs/build-process-guide.md §7.2 (PH0-T01 row).
pnpm monorepo with only packages/geometry, packages/core-model, apps/web (React + Vite, TypeScript strict);
GitHub Actions running lint, typecheck and tests on every PR; docs/decisions/dependencies.md; pin Node LTS and pnpm;
fill the commands section of AGENTS.md. Show the plan first and wait for my OK. Then implement on branch
ph0-t01-skeleton, run pnpm check, open a PR with actual output and an Owner summary.
```

After that, use the task prompt template in `build-process-guide.md` §7.1 for every task.

**Claude Code prompts.** Use claude.ai/code connected to the same repo; it reads AGENTS.md too. D16 applies to every Claude session: review only, no development/file edits/commits/pushes; reply in a PR comment or chat. Independent cases/expected values must be supplied in a PR comment.

⭐ **Deep review (Opus):**
```text
Read AGENTS.md and docs/codex-start-here.md. Review ONLY the diff of PR #[N] (task [PHx-Tyy]) against the
combined-research sections it names. Max 10 real problems, most serious first: file + line, why wrong,
a concrete failing test. Also list important cases the tests do not cover. Reply in a PR comment or chat.
Do not develop, edit files, commit or push (D16).
```

**Weekly batch review (Sonnet: run `/model sonnet` first):**
```text
Read AGENTS.md. Review ONLY the diffs of PRs merged this week: #[N1], #[N2], ... Max 10 real problems overall,
most serious first: PR, file + line, why wrong, failing test idea. Keep it short; reply in a PR comment or chat.
Do not develop, edit files, commit or push (D16).
```

**Independent cases (Opus, before PH2-T04/PH5-T03):** use the Claude C1 comment prompt in `build-process-guide.md` §7.1, then give its source-comment URL to Codex's transcription prompt. Claude never writes fixture files or opens/pushes a fixture PR. PH0-T02a's existing PR #60 remains unchanged.
