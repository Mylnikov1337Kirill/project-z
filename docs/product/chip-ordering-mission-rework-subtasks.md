# Chip Ordering Mission Rework Subtasks

Use this as the implementation handoff for reworking the `chip-ordering` missions audited in `docs/product/chip-ordering-mission-audit.md`.

## Goal

Make every strict ordering mission fair and discoverable:

- keep protocol/document order where the order is genuinely taught;
- clarify debatable neighboring steps;
- replace the one unfair strict sequence with `pair-matching`;
- preserve authored answer secrecy in public content and gameplay feedback.

## Global Constraints

- Do not rewrite missions marked `Keep` in the audit unless a later task explicitly needs a consistency tweak.
- Keep all changes content-first. Do not change mission engine, public projection, or UI unless a check proves the existing implementation cannot support the planned content.
- Do not reveal exact answer keys in `failureFeedback`, `retryPrinciple`, public labels, or mentor hints.
- For strict ordering missions, teach a rubric such as "from X to Y", not a naked list of ids.
- Preserve chapter themes, trap vocabulary, badge/artifact framing, and Russian player-facing copy style.
- After changing authored content, run content validation at minimum.

## Recommended Order

1. `CHO-00` preflight.
2. Content tasks `CHO-01`, `CHO-02`, `CHO-03`, `CHO-04`, `CHO-05`, `CHO-06` can be assigned independently by file, except `CHO-05` owns both Chapter 7 ordering missions.
3. `CHO-07` final content QA and regression pass after all content tasks land.

## Task Index

| ID | Area | Primary file | Type | Dependency |
| --- | --- | --- | --- | --- |
| CHO-00 | Preflight and acceptance map | docs only | audit handoff | none |
| CHO-01 | Chapter 1 self-review order | `chapterOne.ts` | rewrite and keep | CHO-00 |
| CHO-02 | Chapter 3 boss closeout order | `chapterThree.ts` | rewrite and keep | CHO-00 |
| CHO-03 | Chapter 4 inventory order | `chapterFour.ts` | rewrite and keep | CHO-00 |
| CHO-04 | Chapter 6 boss final checklist | `chapterSix.ts` | replace with `pair-matching` | CHO-00 |
| CHO-05 | Chapter 7 reviewer note order | `chapterSeven.ts` | rewrite and keep | CHO-00 |
| CHO-06 | Chapter 8 boss playbook order | `chapterEight.ts` | rewrite and keep | CHO-00 |
| CHO-07 | Final validation and browser QA | content/tests/docs | verification | CHO-01..CHO-06 |

## CHO-00: Preflight And Acceptance Map

Goal: prepare a clean handoff before content edits begin.

Inputs:

- `docs/product/chip-ordering-mission-audit.md`
- `src/entities/chapter/model/chapters/*.ts`
- `src/shared/types/domain.ts`
- `src/entities/mission/lib/missionEngine.ts`
- `src/features/mission/ui/MissionInteractionBoards.tsx`

Work:

- Confirm the current list of `chip-ordering` missions:
  - `self-review-assembly`
  - `assemble-task-brief`
  - `small-diff-loop`
  - `gate-closeout-order`
  - `context-inventory-order`
  - `skill-draft-order`
  - `gate-skill-anatomy`
  - `token-checklist-order`
  - `gate-checklist-order`
  - `reviewer-note-order`
  - `gate-review-note`
  - `gate-playbook-order`
- Confirm that `pair-matching` is already supported in regular missions and boss rounds.
- Record any drift from the audit in a short note appended to this file or the audit.
- Decide whether each content task needs test fixture updates beyond `validate:content`.

Acceptance:

- The mission list still matches the audit or drift is explicitly documented.
- Future agents know that `CHO-04` can be implemented as content if `pair-matching` support remains present.
- No authored content is changed in this task.

Suggested checks:

- `rg -n "kind: 'chip-ordering'|correctOrder" src/entities/chapter/model/chapters`
- `npm run validate:content`

Preflight note (2026-06-03):

- Confirmed the authored `chip-ordering` mission list still matches the audit exactly:
  `self-review-assembly`, `assemble-task-brief`, `small-diff-loop`,
  `gate-closeout-order`, `context-inventory-order`, `skill-draft-order`,
  `gate-skill-anatomy`, `token-checklist-order`, `gate-checklist-order`,
  `reviewer-note-order`, `gate-review-note`, `gate-playbook-order`.
- Drift from `docs/product/chip-ordering-mission-audit.md`: none found.
- `pair-matching` remains supported for regular missions and boss rounds:
  `MissionKind`, `PublicBossFightRoundMission`, `BossFightRoundMission`,
  `evaluateMission`, public content projection, mission answer state, and
  `MissionInteractionBoard` all route `pair-matching` through existing code.
  Existing authored coverage includes regular `knowledge-carrier-match` and
  boss round `gate-carrier-match` in Chapter 5.
- Future content tasks do not need test fixture updates beyond
  `npm run validate:content` if they preserve existing mission ids and only
  change authored copy, labels, chip order, or `CHO-04`'s mission kind/content
  to the already-supported `pair-matching` shape. If a task changes ids, round
  counts, or public contract fields, update the corresponding unit fixtures in
  addition to content validation.
- `npm run validate:content` passed during this preflight.

## CHO-01: Rewrite Chapter 1 Self-Review Ordering Copy

Goal: keep `self-review-assembly` as `chip-ordering`, but make the adjacent boundary steps non-interchangeable.

Primary file:

- `src/entities/chapter/model/chapters/chapterOne.ts`

Work:

- Reframe the sorting rubric as:
  - responsibility / task frame;
  - author understanding;
  - diff boundary cleanup;
  - data safety boundary;
  - evidence;
  - review handoff.
- Clarify card labels or mission copy so `remove-noise` is about pruning the diff before evidence, while `sensitive-data` is a separate safety gate.
- Update `prompt`, `mentorHint`, `failureFeedback`, and `takeaway` if needed.
- Keep `correctOrder` unless the rewrite intentionally changes the protocol.

Acceptance:

- A player can explain why diff cleanup precedes data-safety/evidence handoff from mission copy.
- Failure feedback teaches the protocol-level reason without exposing exact answer ids.
- Chapter 1 prep, artifact and mission copy do not contradict each other.

Suggested checks:

- `npm run validate:content`
- focused browser playthrough of Chapter 1 mission if available

## CHO-02: Rewrite Chapter 3 Boss Closeout Ordering Copy

Goal: keep `gate-closeout-order` as `chip-ordering`, but separate doing verification from reporting verification.

Primary file:

- `src/entities/chapter/model/chapters/chapterThree.ts`

Work:

- Clarify the phase model:
  - run or record verification;
  - self-review the diff;
  - summarize the change;
  - write the evidence trail;
  - call out residual risk.
- Rename or adjust labels around `run-verification` and `name-checks` so they are not perceived as duplicate checking cards.
- Update `prompt`, `mentorHint`, `failureFeedback`, and `takeaway` to say "first execute evidence, then write the review note".
- Keep the boss-round difficulty, but do not introduce a new protocol inside the boss that was not taught in the chapter.

Acceptance:

- `run-verification` and `name-checks` have visibly different roles.
- The player sees why evidence execution comes before a written evidence trail.
- Boss dossier copy remains consistent with the plan-first chapter.

Suggested checks:

- `npm run validate:content`
- `npm run typecheck`

## CHO-03: Rewrite Chapter 4 Inventory Ordering Copy

Goal: keep `context-inventory-order` as `chip-ordering`, but make the 8-card middle sequence less philosophical.

Primary file:

- `src/entities/chapter/model/chapters/chapterFour.ts`

Work:

- Use a layered document rubric:
  - identity;
  - architecture map;
  - navigation;
  - executable checks;
  - working rules;
  - examples;
  - risk warnings;
  - safe pilot / sensitive-data boundary.
- Update card labels where needed to match the layer model.
- Strengthen `prompt`, `mentorHint`, `failureFeedback`, and `takeaway` around "top-down inventory layers".
- Avoid turning the mission into a generic "what belongs in AGENTS.md" picker; it must remain document assembly.

Acceptance:

- `commands`, `conventions`, `examples`, `pitfalls`, and `sensitive-data` no longer read as freely swappable categories.
- The mission still maps to `agents-context-starter.md`.
- Failure feedback names the layer rule, not just "start with passport".

Suggested checks:

- `npm run validate:content`
- browser QA for Chapter 4 mission because this mission has prior QA history

## CHO-04: Replace Chapter 6 Boss Final Checklist With Pair Matching

Goal: replace `gate-checklist-order` with `pair-matching` because exact ordering is not the skill being taught.

Primary file:

- `src/entities/chapter/model/chapters/chapterSix.ts`

Likely related files only if validation or UI support is missing:

- `src/shared/types/domain.ts`
- `src/entities/mission/lib/missionEngine.ts`
- `src/features/mission/ui/MissionInteractionBoards.tsx`
- `src/shared/api/content/publicContentProjection.ts`

Work:

- Convert boss round `gate-checklist-order` from `kind: 'chip-ordering'` to `kind: 'pair-matching'`.
- Suggested targets:
  - `result-state`: state of result;
  - `diff-cleanup`: diff cleanup;
  - `evidence`: evidence trail;
  - `reusable-memory`: reusable workflow memory;
  - `known-bad-case`: characteristic bad case.
- Suggested item mapping:
  - `summary` -> `result-state`
  - `review-diff` -> `diff-cleanup`
  - `record-checks` -> `evidence`
  - `save-workflow` -> `reusable-memory`
  - `capture-bad-case` -> `known-bad-case`
- Rewrite prompt and mentor hint from "assemble stages" to "match each closeout note to its role".
- Ensure failed feedback teaches role recognition and does not reveal all correct mappings.
- Remove `correctOrder`; add `items`, `targets`, and `acceptedTargetIds` using existing pair-matching conventions.

Acceptance:

- The boss round is no longer a strict sequence.
- All five closeout concepts are still assessed.
- Public content projection does not expose `acceptedTargetIds`.
- Boss round evaluation works with a pair-matching round.

Suggested checks:

- `npm run validate:content`
- `npm run test:unit -- src/entities/mission/lib/missionEngine.test.ts`
- `npm run typecheck`
- focused boss browser QA for Chapter 6

## CHO-05: Rewrite Chapter 7 Reviewer Note Ordering Copy

Goal: keep both Chapter 7 reviewer-note ordering missions as `chip-ordering`, but make the document story order explicit.

Primary file:

- `src/entities/chapter/model/chapters/chapterSeven.ts`

Work:

- Apply one shared rubric to both `reviewer-note-order` and `gate-review-note`:
  - result / user effect;
  - factual evidence;
  - domain source;
  - uncovered risk;
  - reviewer ask.
- Update regular mission copy first, then mirror the boss round.
- Clarify why `evidence` comes before `oracle`: evidence says what was checked; oracle says why the rule is trusted.
- Clarify why `risk` comes before `focus`: risk names the uncertainty; focus tells reviewer where to look.
- Keep labels aligned between regular and boss missions unless there is a strong reason to diverge.

Acceptance:

- Both Chapter 7 ordering missions teach the same note structure.
- The middle order is defensible from copy before the first attempt.
- Failure feedback mentions proof/source/risk/focus order without leaking exact ids.

Suggested checks:

- `npm run validate:content`
- focused browser QA for regular mission and Chapter 7 boss round

## CHO-06: Rewrite Chapter 8 Boss Playbook Ordering Copy

Goal: keep `gate-playbook-order` as `chip-ordering`, but make the 8-card playbook document order discoverable inside the boss.

Primary file:

- `src/entities/chapter/model/chapters/chapterEight.ts`

Work:

- Prefer strengthening the rubric over changing the number of cards, unless playtesting still shows confusion.
- Use this document order:
  - purpose;
  - applicability boundaries;
  - required inputs / rules / skills;
  - launch prompt skeleton;
  - workflow;
  - acceptance / verification;
  - known bad cases;
  - examples / update.
- Update `prompt`, `mentorHint`, `failureFeedback`, and `takeaway` so the player sees the order before the first attempt.
- If labels are edited, preserve distinct roles for `acceptance`, `mistakes`, and `examples`.
- Do not duplicate full rules/skills anatomy inside the playbook round.

Acceptance:

- `acceptance`, `mistakes`, and `examples` no longer read as interchangeable tail sections.
- The boss round still assesses playbook document assembly, not generic playbook component recognition.
- The round remains consistent with `team-playbook-draft.md`.

Suggested checks:

- `npm run validate:content`
- focused browser QA for Chapter 8 boss

## CHO-07: Final Validation, Regression QA And Handoff

Goal: verify that the full content set remains playable, fair and non-leaky after the reworks.

Inputs:

- Completed `CHO-01` through `CHO-06`
- `docs/product/chip-ordering-mission-audit.md`
- this subtask file

Work:

- Run content and type validation.
- Grep for remaining `chip-ordering` rounds and confirm only intended missions remain strict ordering.
- Verify `gate-checklist-order` is now `pair-matching`.
- Do focused browser QA on changed missions:
  - Chapter 1 regular mission;
  - Chapter 3 boss round 4;
  - Chapter 4 regular mission;
  - Chapter 6 boss round 4;
  - Chapter 7 regular mission and boss round 4;
  - Chapter 8 boss round 3.
- Update the audit or this file with final status if implementation diverged from the plan.

Acceptance:

- `npm run validate:content` passes.
- `npm run typecheck` passes.
- Changed regular missions and boss rounds can be completed.
- Failed attempts do not reveal full answer keys.
- Public bundle answer-key check still passes if `npm run build` is run.

Suggested checks:

- `npm run validate:content`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- browser QA at desktop and mobile viewports for changed interaction types

Final validation note (2026-06-03):

- No implementation drift from this plan was found. Remaining strict
  `chip-ordering` missions are the intended set: `self-review-assembly`,
  `assemble-task-brief`, `small-diff-loop`, `gate-closeout-order`,
  `context-inventory-order`, `skill-draft-order`, `gate-skill-anatomy`,
  `token-checklist-order`, `reviewer-note-order`, `gate-review-note`, and
  `gate-playbook-order`.
- `gate-checklist-order` is now `pair-matching`; public projection still hides
  `acceptedTargetIds` and exposes only the existing public pair-matching shape.
- Updated Playwright regression coverage in `e2e/project-z.spec.ts`:
  Chapter 3 boss round 4 selectors now match the rewritten closeout labels,
  Chapter 6 boss layout/reset coverage now exercises the pair-matching round
  instead of stale ordering-board assumptions, and a focused CHO-07 test
  completes the reworked Chapter 7 regular ordering mission, Chapter 6
  pair-matching boss round 4, Chapter 7 boss round 4, and Chapter 8 boss round 3
  through the backend API fixture.
- Failed-attempt coverage still verifies generic ordering retry guidance for
  Chapter 1 and no hidden expected-step / exact-order leakage; Chapter 4
  inventory ordering layout regression still completes the scene.
- Checks passed:
  `npm run validate:content`,
  `npm run typecheck`,
  `npm run lint`,
  `npm run build`,
  and approved-local-server
  `npm run test:e2e -- --grep "does not reveal correct answers after failed attempts|completes chapter 3 boss ordering round|keeps chapter 4 inventory ordering cards clickable below actions|keeps boss controls inside the arena|completes the reworked ordering and pair-matching rounds"` (5/5).
  The first sandboxed e2e attempts hit the known `listen EPERM` local-server
  restriction; approved reruns passed.

## Notes For Future Agents

- `pair-matching` already exists in the current domain model; do not reimplement it for `CHO-04` unless the preflight finds drift.
- `orderFeedback` exists on authored `chip-ordering` missions, but the current engine retry path does not surface it. Do not rely on `orderFeedback` alone to fix fairness.
- Content validation is necessary but not sufficient. The risky part is player discoverability, so changed prompts and failure feedback need human-readable review.
- If two agents touch the same chapter file, merge by mission id and preserve unrelated authored copy.
