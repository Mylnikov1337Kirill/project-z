# Rules & Skills Source And Example Review

Date: 2026-06-02

Scope: RSK-00 for `rules-and-skills-mlp-plan.md`. This is a docs-only source review for choosing concrete example domains before final authored mission copy. It does not implement later RSK subtasks.

## Sources Reviewed

- `docs/product/rules-and-skills-mlp-plan.md`
- `docs/product/rules-and-skills-mlp-subtasks.md`
- `docs/product/rules-and-skills-content-expansion.md`
- `docs/product/repo-context-inventory.md`
- `docs/product/retry-principle-content-matrix.md`
- `docs/product/verification-and-self-review.md`
- `docs/product/integration-next-steps.md`
- Current Chapter 4 content in `src/entities/chapter/model/chapters/chapterFour.ts`
- Current Chapter 8 content in `src/entities/chapter/model/chapters/chapterEight.ts`

## Decision

Use two concrete example domains for authored Rules & Skills missions:

1. **Browser QA for gameplay flows** as the primary `Skill` example.
2. **Mission content update** as the secondary example for carrier selection, scoped rules and playbook boundary.

Keep **backend API parity check** and **retry principle update** mostly synthetic or scoped-rule examples, not primary authored mission domains.

## Candidate Review

### Browser QA For Gameplay Flows

Decision: **Use as primary skill example.**

Why it fits:

- Repeated in Project Z docs as required evidence for gameplay UI work.
- Has clear inputs: task brief, affected route/mission, expected visible behavior, nearby spec or route, allowed test data and viewport targets.
- Has clear workflow steps: open route, exercise happy path, try a failed answer/state when relevant, inspect console, check layout fit, verify artifact/badge/map continuity where touched.
- Has clear verification: browser evidence, console status, screenshots or DOM/layout notes, plus relevant e2e/CLI checks.
- Teaches the `skill` concept directly: a reusable procedure with inputs, steps, forbidden moves, verification and stop conditions.

Authoring use:

- Use for `skill-draft-order` and boss `gate-skill-anatomy`.
- Phrase it as "проверить gameplay UI после изменения миссии" rather than as a tool-specific Codex/Playwright lesson.
- Keep it distinct from Chapter 7 playbooks: this is a reusable procedure, not the full team workflow for adding a mission end to end.

Safety:

- Use sanitized or synthetic route/data examples.
- Do not expose QA shortcuts, real learner data, raw logs, secrets, backend status or phase language in player-facing copy.

### Mission Content Update

Decision: **Use as secondary example.**

Why it fits:

- Project Z has a stable content-authoring surface: chapter configs, mission feedback, trap ids, retry principles, content validation and artifact copy.
- It naturally demonstrates carrier choice:
  - a non-leaking feedback rule can be a scoped rule;
  - a source-backed copy update for one mission is a task brief;
  - a full "add a new mission" workflow can be a playbook;
  - the browser QA portion can remain a skill;
  - a lucky prompt phrasing should be discarded.
- Verification is clear: source map check, `npm run validate:content`, non-leakage review, relevant tests and browser QA if gameplay UI changes.

Authoring use:

- Use in `knowledge-carrier-match`, `rule-scope-gate` and `instruction-drift-fix`.
- It is a good domain for showing that `AGENTS.md` or durable rules are not dumping grounds for every content note.

Safety:

- Use synthetic mission titles or Project Z-like examples rather than exact current hidden answer mappings.
- Avoid leaking existing correct answers, correct orders or trap solutions from current chapters.

### Backend API Parity Check

Decision: **Do not use as a primary authored mission example. Use only as a synthetic scoped-rule example if needed.**

Why:

- It is repeatable and has strong verification, but it pulls the chapter toward backend migration/status details.
- Product docs explicitly say gameplay UI should not show backend, debug, persistence, phase or integration implementation details.
- It risks teaching implementation-specific Project Z architecture instead of tool-agnostic rules/skills.

Allowed use:

- A short synthetic example such as "API contract changes require parity checks" can appear as a scoped rule candidate.
- Do not mention real endpoints, env vars, tokens, migration phases, webhook details or server internals in player-facing copy.

### Retry Principle Update

Decision: **Do not use as a primary authored mission example. Fold into mission-content examples or use synthetic scoped-rule examples.**

Why:

- It is repeatable and source-backed, but too meta for a learner who has not authored Project Z missions.
- It can accidentally reveal how current answer feedback is protected.
- It teaches non-leaking feedback rules well, but not the full distinction between rule, skill and playbook on its own.

Allowed use:

- Use synthetic examples for "failed-attempt feedback must not reveal hidden correct mappings" as a durable/scoped content rule.
- If used in mission copy, avoid exact existing scene ids, correct options, chip labels or order hints.

## Authored-Copy Guidance

- Prefer the browser QA skill when the learner must assemble a repeatable procedure.
- Prefer mission content update when the learner must classify knowledge into rule, skill, playbook, task brief or discard.
- Use backend parity only as an abstract scoped rule, not as a workflow.
- Use retry principle updates only as synthetic non-leakage examples inside the content-authoring domain.
- Keep examples tool-agnostic: no Codex Skill, Cursor rules, Claude/Codex file format or Project Z backend implementation details as learning targets.
- Keep Chapter 7's territory clear: a playbook may compose browser QA and content rules, but Chapter 5 should not teach full playbook anatomy.

## Recommended Example Mapping

| Example | Best carrier in Chapter 5 copy | Notes |
| --- | --- | --- |
| "After a gameplay mission UI change, run a repeatable visual QA procedure with expected route, checks and evidence." | `Skill` | Primary concrete skill example. |
| "Failed-answer feedback must not reveal unselected correct answers or exact ordering." | `Scoped rule` | Content-authoring rule; use synthetic examples. |
| "Add a new mission end to end: source review, config, feedback, validation, browser QA and artifact/retry updates." | `Playbook` | Mention as carrier only; do not teach playbook anatomy. |
| "Acceptance criteria for one mission copy bug." | `Task brief` | Good contrast against durable rules. |
| "Backend contract changes require parity checks." | `Scoped rule` | Keep abstract and synthetic. |
| "One author's lucky prompt for writing feedback copy." | `Discard` | Good trap for prompt-instead-of-skill. |

## Acceptance Check

- Chosen examples are repeatable, safe, have clear inputs and clear verification.
- Examples teach rules/skills rather than only context, verification or playbook rollout.
- No real secrets, PII, raw logs, backend credentials, webhook details or unsafe data are used.
