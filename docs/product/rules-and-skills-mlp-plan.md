# Rules & Skills MLP Plan

## Summary

MLP adds a mandatory new chapter between current Chapter 4 and current Chapter 5:

**Visible Chapter 5: Rules & Skills / Управление агентом**

The chapter teaches tool-agnostic agent management through two basic concepts:

- `rules`: persistent or scoped constraints that reduce guessing and unsafe improvisation;
- `skills`: reusable procedures with inputs, steps, verification and stop conditions.

`playbook` remains the focus of the final chapter. The new chapter only treats playbook as one possible carrier for a larger workflow and prepares the learner to understand why final playbooks should compose rules and skills rather than duplicate them.

This is not an MVP. The target is MLP: a fully playable, polished chapter with authored content, a new interaction type, two artifacts, route integration, tests and browser QA.

## Fixed Product Decisions

- The chapter is mandatory for all learners.
- Framing: **управление агентом**.
- UI may use English terms `rules`, `skills` and `playbook`.
- The chapter is tool-agnostic. Do not teach Codex Skill, Cursor rules or Claude/Codex file formats as implementation targets.
- A new mission kind is required: **pair matching** / "соедини пару".
- Artifacts are two separate files: `Rules Inventory` and `Skill Draft`.
- New trap concepts are allowed.
- Real Project Z examples are not selected yet; run a source/example review before final authored copy.

## Content Model

### Learning Objective

After the chapter, the learner can:

- distinguish `rule`, `skill`, `playbook`, `task brief` and one-off prompt;
- choose the right carrier for knowledge: always-on rule, scoped rule, reusable skill, playbook, task brief or discard;
- keep `rules` short, scoped, current and safe;
- describe a `skill` as a repeatable procedure another developer can run;
- detect stale, conflicting and unsafe instructions;
- connect rules/skills to context hygiene and final playbooks.

Core chapter rule:

> Не каждое знание должно становиться rule. Не каждый удачный prompt является skill. Не каждый skill должен грузиться в каждую задачу.

### Relationship To Neighbor Chapters

- Chapter 4 still teaches project context and `AGENTS.md` as a context carrier.
- New Chapter 5 teaches how to classify and maintain rules/skills inside that context system.
- Current Chapter 5 becomes visible Chapter 6 and should explicitly mention selecting only relevant rules/skills for the active context budget.
- Current Chapter 7 becomes visible Chapter 8 and should treat playbooks as a workflow wrapper over rules, skills, brief and verification.

### Chapter Shape

Baseline chapter balance: **4 regular missions + 1 boss fight**.

Keep 4 regular missions unless content drafting shows that conflict/stale-rule handling cannot fit without overloading the boss. Existing chapters use 4 regular missions, so a 5-mission chapter should be justified by playtest length, not by topic enthusiasm.

### Proposed Chapter Metadata

- Internal id: `chapter-5`
- Visible order: `5`
- Title: `Rules & Skills`
- Subtitle/framing in copy: `Управление агентом`
- Badge name: `Куратор инструкций`
- Rank after completion: `Agent Controller`
- Artifact files:
  - `rules-inventory.md`
  - `skill-draft.md`
- Map landmark id: `instruction-router`
- Map label: `Коммутатор инструкций`
- Suggested tone: `violet` or `teal`; final choice should be checked against the updated 8-node map composition.

Hard-renumbering is intentional for the current pre-prod course. As of 2026-06-03, chapter ids match visible order again: `chapter-5` is Rules & Skills, `chapter-6` is Гигиена контекста, `chapter-7` is Дисциплина проверки, and `chapter-8` is Рабочие сценарии. No legacy progress migration is required because test databases are disposable.

## Mission Design

### New Mission Kind: Pair Matching

Add a mission kind for "соедини пару".

Interaction goal: the learner assigns each left-side item to the correct right-side carrier/category.

Recommended use in this chapter:

- left side: examples of knowledge, instruction, procedure or workflow;
- right side: `Always-on rule`, `Scoped rule`, `Skill`, `Playbook`, `Task brief`, `Discard`.

Public mission data should expose labels and descriptions, but not accepted target ids. Authored data should hold accepted target ids and trap feedback.

Minimal authored shape:

```ts
type PairMatchingMission = MissionBase & {
  kind: 'pair-matching'
  items: Array<{
    id: string
    label: string
    description?: string
    acceptedTargetIds: string[]
    feedback?: string
    trapId?: TrapConceptId
    trapLabel?: string
  }>
  targets: Array<{
    id: string
    label: string
    description?: string
  }>
}
```

Answer shape:

```ts
Record<string, string | null | undefined>
```

Grading:

- pass only when every required item is matched to an accepted target;
- score by correctly matched items;
- failed answer details show only selected wrong items and authored feedback;
- do not reveal unselected correct targets or the full correct mapping.

UI:

- desktop: two-column or rail-and-target layout with stable target drop zones;
- mobile: one active item with target buttons or stacked assignment rows;
- support click/tap assignment first, drag/drop only as enhancement;
- show current assignments before submit, but no correctness state before submit.

### Regular Missions

#### 5.1 `knowledge-carrier-match`

Kind: `pair-matching`

Title: `Куда положить знание`

Purpose: introduce the central mental model: choose the carrier for a piece of knowledge.

Example matches:

- "Правило безопасности про реальные логи и PII" -> `Always-on rule`
- "Frontend-only convention for button icons" -> `Scoped rule`
- "Repeatable browser QA procedure with inputs/checks" -> `Skill`
- "Team workflow for adding a new mission end to end" -> `Playbook`
- "Acceptance criterion for one bugfix" -> `Task brief`
- "One developer's lucky prompt phrasing" -> `Discard`

This is the new "соедини пару" flagship mission.

#### 5.2 `rule-scope-gate`

Kind: `chip-picker` with optional budget, or `pair-matching` if the new mechanic plays well.

Title: `Отобрать rules`

Purpose: teach that rules must be short, scoped, current and safe.

Learner selects candidates that belong in a durable rule set and rejects noise:

- current safety boundary;
- small architecture constraint;
- stale command;
- one-off debug note;
- real secret/log example;
- broad slogan like "write good code";
- scoped UI convention.

This mission should make clear that `AGENTS.md` is not a dumping ground. However, do not make `AGENTS.md` the lesson target; keep the target generic: always-on and scoped rules.

#### 5.3 `skill-draft-order`

Kind: `chip-ordering`

Title: `Собрать skill`

Purpose: build the anatomy of a reusable skill.

Correct order:

1. when to use;
2. when not to use;
3. required inputs;
4. workflow steps;
5. forbidden moves;
6. verification;
7. stop conditions;
8. update trigger / known bad cases.

The lesson is not a specific tool format. It is a repeatable procedure that another developer can run.

#### 5.4 `instruction-drift-fix`

Kind: `scenario-decision` or `chip-picker`

Title: `Починить drift`

Purpose: handle stale or conflicting instructions.

Scenario: the agent receives a current project rule, an old note, a scoped rule used globally and a useful workflow trapped in a chat transcript. The learner chooses the safe maintenance action:

- update or remove the stale rule;
- scope the rule instead of keeping it always-on;
- turn the repeated procedure into a skill draft;
- keep one-off task context out of durable instructions.

This mission covers conflict/staleness without over-expanding the chapter.

### Boss Fight: `instruction-drift`

Title: `Финальный бой за управление агентом`

Boss concept: **Instruction Drift**

The boss represents a polluted instruction system: too many rules, stale notes, unsafe examples, one repeated workflow that is not yet a skill, and pressure to call everything a playbook.

Rounds:

1. `gate-carrier-match`
   Kind: `pair-matching`
   Match knowledge to carrier: always-on rule, scoped rule, skill, playbook, task brief, discard.

2. `gate-rule-scope`
   Kind: `chip-picker`
   Keep only safe and useful durable rules; remove stale, broad and unsafe candidates.

3. `gate-skill-anatomy`
   Kind: `chip-ordering`
   Assemble skill sections in a repeatable order.

4. `gate-release-decision`
   Kind: `scenario-decision`
   Decide release path: pilot the skill with owner/update trigger, leave playbook creation for final workflow chapter, and update neighboring context only where needed.

Boss takeaway:

> Управление агентом начинается не с большого prompt. Оно начинается с решения, какое знание должно жить как rule, какое как skill, какое как task brief, а какое нужно удалить.

## Artifacts

### Artifact Model Change

Current `Chapter` supports one `artifact?: ChapterArtifact`. MLP requires two separate chapter artifacts.

Implement multi-artifact support:

- add `artifacts?: ChapterArtifact[]` to `Chapter`;
- keep `artifact?: ChapterArtifact` temporarily for backward compatibility or migrate all chapters to `artifacts`;
- update badge, artifact preview/download, final archive and validation to handle one or many artifacts per chapter;
- add tests that Chapter 5 exposes two artifact files.

Recommended MLP path: migrate to `artifacts: ChapterArtifact[]` for all chapters and expose a helper `getChapterArtifacts(chapter)` if needed to reduce call-site churn.

### Rules Inventory

Artifact id: `rules-inventory`

File: `rules-inventory.md`

Sections:

- Always-on rules
- Scoped rules
- Rules to delete
- Unsafe examples that must not become context
- Source / owner
- Update trigger

This artifact should be a real working document, not only a reflection worksheet.

### Skill Draft

Artifact id: `skill-draft`

File: `skill-draft.md`

Sections:

- Skill name
- When to use
- When not to use
- Required inputs
- Steps
- Forbidden moves
- Verification
- Stop conditions
- Known bad cases
- Update trigger

This artifact is tool-agnostic and must not mention `SKILL.md` as a required format.

## Trap Concepts

Add new trap concepts for MLP:

- `stale-rule`: an old instruction continues to steer the agent after project truth changed.
- `conflicting-instructions`: the agent receives incompatible rules and guesses precedence.
- `prompt-instead-of-skill`: a copied prompt lacks inputs, procedure, verification and stop condition.
- `unsafe-always-on-context`: secrets, raw logs, PII or sensitive examples are placed into persistent context.

Reuse existing traps where they already fit:

- `context-dump`
- `personal-magic`
- `sensitive-data`
- `too-broad`
- `weak-test`

## Implementation Plan

### Content And Catalog

- Add `src/entities/chapter/model/chapters/chapterFive.ts`.
- Insert it in `chapterCatalog.ts` after current `chapterFour`.
- Rename chapter modules to match visible `order` values:
  - `chapterFive.order = 5`
- `chapterSix.order = 6`
- `chapterSeven.order = 7`
- `chapterEight.order = 8`
- Keep content validation aligned with `chapter.id === chapter-${chapter.order}` for the numbered chapters.
- Update visible copy in shifted chapters where they mention their own chapter number.
- Update Chapter 4 and final playbook chapter copy only where needed to connect the learning sequence; do not rewrite their core lessons.

### Pair Matching Mission Kind

- Extend `MissionKind`, public/authored mission types, `BossFightRoundMission` and `Mission`.
- Extend public projection so accepted pair targets and authored feedback are not exposed.
- Extend mission engine with pair matching scoring and answer details.
- Extend `missionAnswerHelpers`, `useMissionSceneState`, `MissionInteractionBoards`, `MissionScene` labels/layout and boss dossier summaries.
- Add unit tests for scoring, non-leakage and boss-round support.

### Artifacts

- Add artifact ids `rules-inventory` and `skill-draft`.
- Add two markdown template factories.
- Update artifact registry.
- Update badge and course closeout views to list multiple artifacts for a chapter.
- Update artifact tests and final archive tests.

### Map And Progress

- Add `instruction-router` to `ChapterLandmarkId`.
- Add a pixel-style landmark icon and update `map-landmark-icon-style.md`.
- Rebalance the map for 8 nodes if current route spacing or landmark overlap breaks.
- Keep progress keyed by current hard-renumbered chapter ids.
- Update `staticContentVersion` from `project-z-static-content-v1` to a new value.
- Add or update progress reconciliation tests so a learner with old rows receives the new chapter row and does not get false course completion.

### Docs And Source Map

- Update `docs/product/README.md`.
- Update `docs/product/retry-principle-content-matrix.md`.
- Update `docs/product/repo-context-inventory.md`; remove or revise the old no-eighth-chapter guidance because this plan is the explicit request.
- Add education source placeholders:
  - `modules/08-rules-and-skills.md`
  - `templates/rules-inventory.md`
  - `templates/skill-draft.md`
- Update verification/self-review docs from `7/7` to `8/8` once implementation lands.

RSK-10 result, 2026-06-03: product docs/source maps are updated for the
active 8-chapter route. `docs/product/README.md` and
`docs/product/retry-principle-content-matrix.md` include visible Chapter 5
Rules & Skills with retry principles for all new mission-like targets, and
shift token hygiene, verification and playbooks to visible Chapters 6-8.
Local education kit placeholders were added at `modules/08-rules-and-skills.md`,
`templates/rules-inventory.md` and `templates/skill-draft.md`.

## Example Review Dependency

Before final authored mission copy, run a small source/example review and choose 1-2 concrete example domains.

Candidates:

- browser QA for gameplay flows;
- mission content update;
- backend API parity check;
- retry principle update.

Decision criteria:

- repeated enough to plausibly become a skill;
- safe to show with synthetic data;
- clear inputs and verification;
- not already fully owned by Chapter 7 playbooks;
- teaches rules/skills rather than only context or verification.

Until this review is complete, mission examples may use synthetic project-like cases.

RSK-00 result, 2026-06-02: source/example review is complete in
`docs/product/rules-and-skills-source-example-review.md`.

Chosen authored example domains:

- Primary: browser QA for gameplay flows as a reusable `Skill` example with
  clear inputs, steps, verification and stop conditions.
- Secondary: mission content update as the carrier-selection domain for scoped
  rules, task briefs, playbook boundaries and discarded prompt habits.

Use backend API parity and retry principle update only as synthetic or scoped-rule
examples unless a later product review explicitly asks for deeper treatment.

## Test Plan

Required automated checks:

- `npm run validate:content`
- `npm run test:unit`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Focused tests to add/update:

- pair matching mission engine scoring and failed-answer non-leakage;
- public projection strips accepted target ids and authored feedback;
- content validation accepts 8 visible chapters and stable non-order ids;
- new chapter has prep, boss, two artifacts, visual metadata and retry principles;
- progress initialization/reconciliation includes the new chapter without corrupting old ids;
- badge and final archive render/download both new artifacts;
- e2e covers at least one regular pair-matching mission, one boss pair-matching round, Chapter 5 badge/artifacts and final 8/8 course completion.

Browser QA:

- `/map` with 8 nodes at desktop and mobile widths;
- new Chapter 5 prep, all missions, boss, badge and both artifact previews;
- shifted Chapter 6-8 navigation;
- final `/course/complete` archive with 8 chapters and both Chapter 5 artifacts;
- no answer leakage in failed pair matching attempts;
- no layout overlap in pair matching desktop/mobile UI.

## Acceptance Criteria

- The course is playable end to end as 8 visible chapters.
- New Chapter 5 is mandatory and unlocks in sequence after Chapter 4.
- The learner can complete all new missions and boss without hidden correctness leakage.
- The new pair matching mission type works both as a regular mission and a boss round.
- Chapter 5 produces two separate artifacts.
- Current playbook chapter remains about playbooks and does not become a duplicate skill chapter.
- Chapter ids and visible numbers are consistent across catalog, routes, tests and authored copy.
- Docs and QA references no longer claim that the final course is `7/7`.
