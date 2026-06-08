# Project Z best-practices compliance audit

Дата аудита: 2026-05-30.

Supersession note, 2026-06-02: this is a historical pre-backend audit. It may
mention local-first persistence and old artifact filenames as the state at that
time. Current guidance is backend-only through Node `/api/*`; use
`docs/backend-only-cutover-subtasks-2026-06-02.md` for active cleanup work.

Цель: проверить, соответствует ли текущий Project Z тем инженерным практикам, которым он обучает игроков в семи главах образовательного приложения, и зафиксировать, что соответствует, что не соответствует полностью и как довести проект до строгого соответствия.

## Короткий вердикт

Project Z в текущем состоянии в целом соответствует образовательной программе и довольно хорошо "живет по своим же правилам": курс покрывает все 7 навыков, игровой контент привязан к education kit, движок миссий детерминированный, фидбэк не раскрывает скрытые правильные ответы, прогресс и артефакты остаются local-first, а архитектура держится в заявленных слоях.

Строгое соответствие не абсолютное. Критичных противоречий, где приложение учит одному, а проект делает обратное, не найдено. Но есть несколько зон, где проект можно сделать ближе к собственным best practices:

- слабая трассируемость "каждая сцена -> конкретный раздел education source" вне retry matrix;
- заметное code-switching в некоторых видимых названиях рангов и отдельных подсказках;
- для curated prep resources пока нет автоматизированного link-check cadence; ссылки остаются ручной ответственностью;
- весь учебный каталог живет в одном большом `chapterCatalog.ts`, что ухудшает token hygiene будущих точечных content edits;
- Project Z учит AI-assisted visibility, но в проекте нет PR template / commit guidance, который закреплял бы это как рабочий процесс;
- нет отдельного набора unit/domain tests для mission engine и progress rules; e2e покрытие сильное, но не заменяет точечные domain tests для будущих изменений.

Оценка по смыслу: примерно 85-90% соответствия. Для пилота с 5-7 участниками текущая база выглядит годной. Для строгого "мы сами образцово следуем каждой практике" стоит закрыть рекомендации P0/P1 ниже.

## Методика

Проверены локальные источники:

- `/Users/kirillmylnikov/Dev/ai/project-z-development-handoff.md`
- `AGENTS.md`
- `docs/architecture.md`
- `docs/product/README.md`
- `docs/product/retry-principle-content-matrix.md`
- `docs/product/verification-and-self-review.md`
- education kit: `/Users/kirillmylnikov/Dev/Obsidian/main/AI/Reports/agentic-tools-awareness/education`
- `src/entities/chapter/model/chapterCatalog.ts`
- `src/entities/mission/lib/missionEngine.ts`
- `src/entities/trap/model/trapConcepts.ts`
- `src/shared/api/artifacts/localArtifactService.ts`
- `src/shared/api/progress/localProgressRepository.ts`
- `e2e/project-z.spec.ts`

Проверки, выполненные во время аудита:

| Check | Result |
| --- | --- |
| `npm run lint` | Passed via bundled Node v24.14.0 |
| `npm run typecheck` | Passed via bundled Node v24.14.0 |
| `npm run build` | Passed via bundled Node v24.14.0; only existing Vite chunk-size warning |
| `npm run test:e2e -- --list` | Listed 32 tests |
| `npm run test:e2e` | First sandboxed run hit known `listen EPERM`; approved rerun first found stale server on `127.0.0.1:5174`; after stopping PID 4931, full suite passed: 32 tests in 13.5s |

Static/source checks performed:

- exported chapter catalog has 7 chapters, 28 ordinary missions, 7 boss fights, 28 boss rounds, 63 mission-like targets total;
- all 63 mission-like targets have `retryPrinciple`, `takeaway`, `successFeedback` and `failureFeedback`;
- all incorrect scenario options have feedback;
- all chip options, including correct and incorrect chips, have feedback after feedback patches are applied;
- all ordering missions have complete `orderFeedback`;
- canonical trap usage exists for all 9 trap ids in `TrapConceptId`;
- no layer import violations found for `app -> pages -> features -> entities -> shared`, with the documented `shared/api/content` adapter exception;
- runtime source scan found no app `fetch`, OpenAI, Supabase, Pachca webhook, external LLM call, or runtime internet search implementation;
- direct `localStorage` access is isolated in `localProgressRepository` and e2e seed helpers, not normal UI components.

Limitations:

- Existing external prep resource URLs were not exhaustively live-checked. Resources added or replaced on 2026-05-30 were manually opened/reviewed; the audit also verified they remain static config, not runtime search/fetch.
- No new in-app Browser visual QA was run in this audit; current confidence comes from source review, Playwright coverage, layout assertions and recorded historical Browser QA in project docs.
- The workspace is not a git repo here, so PR template, commit trailers and git history could not be audited directly.

## Source best practices distilled

The education kit defines the training goal as normal engineering practice for AI-assisted work, not generic prompting. The global best practices are:

- author owns the diff;
- small, understandable, reviewable changes;
- task brief before risky AI work;
- plan-first workflow for risky or broad changes;
- minimal, maintained repo context;
- careful token/context hygiene;
- real verification evidence, not confident model output;
- reusable team playbooks from successful workflows;
- sensitive data never goes into external models;
- AI-assisted work remains visible to reviewers.

Project Z's local authoring rules mirror that: content must be grounded in education sources, each mission should teach one concrete move, wrong answers should be plausible AI-assisted traps, feedback must be useful and non-leaking, prep/mission/boss/badge/artifact copy must agree, resources must be curated static config, and artifacts must be practical starters with no learner personal data. See `AGENTS.md` lines 14-34 and 72-87.

## Cross-cutting compliance

### 1. Education source grounding

Status: mostly compliant.

Evidence:

- `AGENTS.md` contains a chapter-to-source map for all seven chapters (`AGENTS.md:22-30`).
- `docs/product/README.md` repeats the source map for future content work.
- `docs/product/retry-principle-content-matrix.md` maps every retry principle to a chapter, scene id, skill, source material, trap family and hint.
- `chapterCatalog.ts` implements all chapter configs with typed prep, reward, recap, artifacts, missions and boss links (`chapterCatalog.ts:4139-4925`).

Gap:

- The retry principle matrix is excellent, but it only traces retry hints. There is no equally explicit matrix for every prompt, correct answer, wrong answer, prep checklist, reward and artifact section.
- Future editors still have to infer a lot from the large `chapterCatalog.ts` and AGENTS source map.

How to improve:

- Add `docs/product/chapter-content-source-matrix.md` with one row per scene:
  - chapter;
  - scene id;
  - exact skill;
  - education source section/template;
  - correct-answer rule;
  - trap family;
  - artifact/reward tie-in.
- Optionally add typed `sourceRefs` metadata to mission configs, but a docs matrix is lower-risk and easier to review.

### 2. Deterministic authored content, no generated grading

Status: compliant.

Evidence:

- Mission kinds are typed as `scenario-decision`, `chip-picker`, `chip-ordering` and `boss-fight` (`src/shared/types/domain.ts:9-13`).
- Mission configs are typed and static; `ContentRepository` serves static chapters.
- `evaluateMission` is deterministic and scores by explicit ids/order/rounds, not LLM grading (`src/entities/mission/lib/missionEngine.ts:116-281`).
- There are no runtime LLM calls or runtime internet search calls in `src`.

Gap:

- None critical.

How to improve:

- Add small pure domain tests for `evaluateMission` so future engine changes do not rely only on e2e.

### 3. Failed-answer leakage guard

Status: compliant and well protected.

Evidence:

- Chip-picker failures show selected incorrect chips and budget overflow only; correct selected chip details are shown only on full correct result (`missionEngine.ts:164-217`).
- Chip-ordering failures show one generic neutral "Порядок не сошёлся" detail and do not list expected steps (`missionEngine.ts:83-99`, `220-237`).
- Boss results derive round feedback from each round, but still use the same basic evaluation rules (`missionEngine.ts:256-280`).
- E2E asserts that failed attempts do not show `Пропущено`, hidden correct chip feedback, expected labels or correct order (`e2e/project-z.spec.ts:1644-1710`).
- E2E asserts retry principles are present for all 63 targets and do not include banned leakage/filler fragments (`e2e/project-z.spec.ts:424-461`).

Gap:

- No critical gap.

How to improve:

- Add a pure content test for all exported missions to assert:
  - no retry principle contains correct chip ids/labels;
  - ordering retry text never includes exact `correctOrder` labels;
  - failed chip feedback is only selected trap feedback.

### 4. Recurring trap concepts

Status: compliant.

Evidence:

- Canonical `TrapConceptId` includes 9 recurring traps (`src/shared/types/domain.ts:15-24`).
- `trapConcepts.ts` defines Russian labels and explanations for all canonical traps (`src/entities/trap/model/trapConcepts.ts:9-64`).
- Static scan of exported chapters found canonical trap usage:
  - `context-dump`: 12
  - `weak-test`: 12
  - `too-broad`: 9
  - `neighboring-refactor`: 8
  - `sensitive-data`: 8
  - `confident-report`: 6
  - `blind-retry`: 3
  - `agent-as-source`: 2
  - `personal-magic`: 2
- Local-only `trapLabel` values remain chapter-specific and are not promoted into memory.
- E2E verifies canonical trap persistence, field-guide reload behavior and local label exclusion (`e2e/project-z.spec.ts:1712-1805`).

Gap:

- Trap usage is uneven by design, but `agent-as-source` and `personal-magic` appear only twice. That is acceptable for the current course shape, but these concepts may be less reinforced than `context-dump` and `weak-test`.

How to improve:

- If pilot users miss those concepts, add one non-invasive recap or boss feedback reference in Chapters 6-7 rather than adding new missions.

### 5. Local-first architecture and service boundaries

Status: compliant.

Evidence:

- Architecture requires `app -> pages -> features -> entities -> shared` and repository-backed data access (`docs/architecture.md:53-77`).
- Static import-boundary audit found zero layer violations.
- `ProgressRepository` owns learner/progress/attempts/completions/trap memory/reflections/unlock/leaderboard operations (`src/shared/api/progress/ProgressRepository.ts`).
- `LocalProgressRepository` is the only normal runtime storage adapter using `window.localStorage` (`src/shared/api/progress/localProgressRepository.ts:198-235`).
- `localArtifactService` generates markdown locally and appends local reflections without server storage (`src/shared/api/artifacts/localArtifactService.ts:817-923`).

Gap:

- The local progress adapter hardcodes chapter/rank metadata in addition to `chapterCatalog.ts`. This is current behavior, but it creates duplication for badge names and rank names.

How to improve:

- When the progress model is touched next, derive badge/rank labels from chapter config or create a single shared domain map. Do not change this casually; it touches completion/replay behavior.

### 6. Game UI over debug UI

Status: mostly compliant.

Evidence:

- Rules prohibit showing backend/repository/mock/TODO/phase/debug copy in gameplay UI (`AGENTS.md:36-44`).
- Source scan found implementation terms mostly in docs, types, repository names and generated artifact templates.
- `TODO` appears heavily in artifact templates, which is explicitly allowed when it reads as a downloaded project adaptation placeholder (`AGENTS.md:38-40`, `AGENTS.md:86`).
- E2E covers absence of learner personal data in artifacts and final archive behavior.

Gap:

- `AnnouncementResult.status` has a `mocked` value in shared types and `MockAnnouncementService` exists as implementation wording. This is acceptable because it is not visible gameplay UI, but it remains a naming smell if accidentally surfaced later.
- Identity input placeholders are examples (`agent-k`, `Имя Фамилия`), not implementation placeholders, so they are not a violation.

How to improve:

- Keep `mocked` strictly inside service implementation. If backend integration starts, rename visible/domain-facing copy to product language and keep adapter statuses out of UI.

### 7. Russian-first language and code-switching

Status: partially compliant.

Evidence:

- Most player-facing copy is natural Russian.
- AGENTS explicitly allows English for filenames, commands, code identifiers, `backend`, `LLM` and accepted process markers (`AGENTS.md:62-84`).

Gaps:

- Player-facing rank names are English: `Diff Owner`, `Brief Boss`, `Mission Planner`, `Context DJ`, `Token Tamer`, `Trust But Tester`, `Playbook Crafter`.
- Some visible reward/recap copy uses English process terms where Russian would be clearer, for example Chapter 2's next move lists `goal, scope, out of scope, examples, acceptance и verification` (`chapterCatalog.ts:4273-4274`).
- Chapter 3/5/7 naturally use terms like `diff`, `outcome`, `playbook`; some are acceptable for developer audience, but the current rules prefer Russian when clarity is not harmed.

How to improve:

- Replace or pair ranks with Russian names:
  - `Diff Owner` -> `Автор изменений`
  - `Brief Boss` -> `Мастер брифа`
  - `Mission Planner` -> `Планировщик изменений`
  - `Context DJ` -> `Сборщик контекста`
  - `Token Tamer` -> `Хранитель контекста`
  - `Trust But Tester` -> `Проверяющий делом`
  - `Playbook Crafter` -> `Автор сценариев`
- Translate Chapter 2 next move to: `цель, границы, запреты, примеры, критерии приёмки и проверка`.
- Keep `AI-assisted: true`, filenames and command names as-is.

### 8. Static curated resources

Status: compliant, with one maintenance gap.

Evidence:

- Prep resource links are static chapter config under `chapterCatalog.ts`.
- Source scan found no runtime `fetch` in app code.
- Prep resource entries include maintenance metadata such as `language`, `type`, `source` and `lastReviewed`.
- Chapter 6 now includes Russian-first verification/e2e resources and a conference talk, with English primary fallbacks for Google testing practices.

Gaps:

- No recurring non-runtime link-check script or review cadence is documented for external prep links.

How to improve:

- Add a non-runtime link-check script as an optional docs maintenance task, not as app behavior.

### 9. Artifact quality and privacy

Status: compliant.

Evidence:

- Artifacts match education templates:
  - Chapter 1: self-review (`localArtifactService.ts:8-69`);
  - Chapter 2: task brief (`localArtifactService.ts:72-167`);
  - Chapter 3: plan-first checklist (`localArtifactService.ts:170-242`);
  - Chapter 4: AGENTS/context starter (`localArtifactService.ts:245-433`);
  - Chapter 5: token hygiene checklist (`localArtifactService.ts:436-508`);
  - Chapter 6: verification matrix and self-review (`localArtifactService.ts:511-608`);
  - Chapter 7: playbook draft (`localArtifactService.ts:611-776`).
- Reflection notes are local, optional/skippable and appended to markdown (`localArtifactService.ts:783-823`).
- E2E verifies artifact previews/download filenames and absence of learner full name in previews.

Gap:

- Chapter 4 artifact is very large and combines `AGENTS.md` plus repo context inventory. It is useful, but may be heavy for a first pilot user.

How to improve:

- Consider splitting Chapter 4 artifact into two sections with a "start here" mini-template at top, then full optional inventory below.
- Keep TODO placeholders; they are appropriate template fields.

### 10. Verification discipline in the project itself

Status: mostly compliant.

Evidence:

- `docs/product/verification-and-self-review.md` contains a strong verification matrix and project-specific guardrails.
- Current audit ran lint, typecheck, build and full e2e.
- E2E suite has 32 tests covering retry principles, mastery actions, map flow, final archive, scene numbering, prep gating, badge recap, artifacts, reflections, keyboard navigation, mentor takeaways, leakage guard, trap memory/field guide, boss dossier, boss layout and reward route.

Gaps:

- There is no unit test runner configured. The project relies on Playwright for content/domain smoke checks plus UI flows.
- Mission engine and progress repository are deterministic pure-ish logic and would benefit from fast unit tests before future scoring/progression changes.

How to improve:

- Add a minimal unit test setup only if it stays lightweight. Candidate tests:
  - `evaluateMission` never leaks missed correct chips on failure;
  - chip-ordering failure returns generic neutral detail;
  - boss fight aggregates round results deterministically;
  - progress completion unlocks only the next chapter and handles replay idempotently.
- Keep existing Playwright e2e for user-visible behavior.

### 11. Token hygiene and future maintainability

Status: partially compliant.

Evidence:

- Project docs strongly teach and enforce context hygiene (`AGENTS.md:99-110`, `docs/product/repo-context-inventory.md`).
- Future agents are instructed to read exact docs and relevant education modules, not the whole world.

Gap:

- The main content file `src/entities/chapter/model/chapterCatalog.ts` is very large, containing feedback patches, retry patches, all chapters, all missions, bosses, prep, rewards and resources.
- That shape is convenient for typed local-first config, but it makes narrow content edits expensive: a future agent often has to load a 4,900+ line file to edit one chapter.
- This is the clearest place where the codebase itself does not fully embody the token hygiene lesson it teaches.

How to improve:

- Split chapter content into per-chapter files:
  - `src/entities/chapter/model/chapters/chapterOne.ts`
  - `chapterTwo.ts`, etc.
  - shared helper `applyMissionFeedback.ts`
  - central `chapterCatalog.ts` imports and exports the array.
- Keep mission ids and exported `chapters` shape unchanged.
- Add a content source matrix before or during the split so review stays safe.

### 12. Reusable playbooks in the project itself

Status: partially compliant.

Evidence:

- Chapter 7 teaches playbooks well; artifact includes when to use / when not to use, input context, prompt skeleton, workflow, acceptance, verification and mistakes.
- Project has strong standing docs: AGENTS, architecture, repo context, verification/self-review and session closeout.

Gap:

- There is not yet a small `docs/product/playbooks/` set for Project Z's own repeated workflows.
- Existing docs are rules/checklists, but not quite "use this workflow when changing mission content" playbooks.

How to improve:

- Add 3 local Project Z playbooks:
  - `mission-content-edit-playbook.md`;
  - `map-landmark-icon-playbook.md`;
  - `badge-artifact-reward-playbook.md`.
- Each should include when to use, when not to use, required context, prompt skeleton, verification, typical AI mistakes and stop conditions.

## Chapter-by-chapter audit

### Chapter 1. AI как инженерный инструмент

Education source: `modules/01-ai-as-engineering-tool.md`, `templates/ai-pr-self-review.md`.

Core taught practice:

- author owns every substantial change;
- AI result must be small, explainable and checked;
- before review, remove noise, run checks and mark AI assistance.

Project implementation:

- Chapter summary, prep, reward and recap directly reinforce author ownership (`chapterCatalog.ts:4141-4229`).
- Ordinary scenes cover:
  - who owns an unexplained diff;
  - reviewable vs noisy AI result;
  - risk scan in AI-assisted changes;
  - self-review ordering.
- Boss fight simulates final PR decision with risk scan, author move, evidence loadout and review gate.
- Artifact is a self-review checklist with ownership, scope, quality, verification, AI visibility and reviewer note (`localArtifactService.ts:8-69`).

Compliance:

- Strongly compliant.

Gaps:

- Rank `Diff Owner` is English.
- The project itself does not include a PR template or commit guidance file enforcing `AI-assisted: true`.

Recommended additions:

- Rename rank to Russian or display Russian primary + English secondary if the team loves the title.
- Add `.github/pull_request_template.md` or docs-only PR template with:
  - AI helped with;
  - checks run;
  - reviewer focus;
  - `AI-assisted: true` marker guidance.

### Chapter 2. Постановка задачи

Education source: `modules/02-task-framing.md`, `templates/task-brief.md`.

Core taught practice:

- no "сделай нормально";
- define goal, scope, out of scope, examples, acceptance criteria and verification;
- ask for plan before risky changes.

Project implementation:

- Chapter prep checklist exactly mirrors goal/scope/examples/acceptance/verification (`chapterCatalog.ts:4277-4289`).
- Scenes cover observable goal, task boundaries, useful examples and task brief order (`chapterCatalog.ts:1410`, `1598`).
- Boss fight covers missing fields, best contract, evidence loadout and plan gate.
- Artifact is a task brief template with goal, boundaries, out of scope, examples, acceptance, verification, first prompt and decision after plan (`localArtifactService.ts:72-167`).

Compliance:

- Strongly compliant.

Gaps:

- Visible recap next move uses English field names where Russian would be clearer (`chapterCatalog.ts:4273-4274`).
- Rank `Brief Boss` is English.

Recommended additions:

- Translate field names in visible reward/recap copy.
- Keep English headings only inside downloadable templates if the team intentionally wants common process labels.

### Chapter 3. Работа от плана

Education source: `modules/04-plan-first-agentic-workflow.md`, `templates/task-brief.md`.

Core taught practice:

- plan before risky diff;
- human decision checkpoint;
- small diff;
- verification;
- summary/stop conditions.

Project implementation:

- Chapter prep, reward and recap clearly teach plan-first (`chapterCatalog.ts:4339-4441`).
- Scenes cover when plan-first is needed, how to read a plan, boundary agreement and small diff loop (`chapterCatalog.ts:1876`, `2031`).
- Boss fight covers risk classification, plan review, human decision and closeout order.
- Artifact is a plan-first checklist with when to plan, plan prompt, plan review, decision, stop conditions and closeout (`localArtifactService.ts:170-242`).

Compliance:

- Strongly compliant as learning content.

Gaps:

- Some visible terms (`diff`, `outcome`) are English developer shorthand. They are probably acceptable for this audience, but not perfectly aligned with the Russian-first wording rule.
- Rank `Mission Planner` is English.

Recommended additions:

- Translate where natural: `набор изменений`, `результат`, `планировщик изменений`.
- Keep `diff` only where it is the team's normal review term.

### Chapter 4. Контекст проекта

Education source: `modules/03-context-engineering.md`, `templates/repo-context-inventory.md`, `templates/agents-md-v0.md`.

Core taught practice:

- repo context is infrastructure, not one prompt;
- maintain small always-on rules and scoped context;
- use 1-3 examples;
- define glossary, commands and sensitive boundaries.

Project implementation:

- Project itself has AGENTS, architecture docs, repo context inventory, verification/self-review and session closeout.
- Chapter 4 prep teaches AGENTS, scoped context, examples, glossary and sensitive data (`chapterCatalog.ts:4444-4562`).
- Scenes cover context-before-prompt, AGENTS.md core, context examples and inventory order (`chapterCatalog.ts:2293`, `2462`).
- Artifact combines AGENTS.md starter and repo context inventory (`localArtifactService.ts:245-433`).

Compliance:

- Very strong. This is one of the best-aligned chapters because the project genuinely uses the same machinery it teaches.

Gaps:

- Artifact may be too long for first-time use.
- Source traceability for individual content choices is still implicit outside retry matrix.

Recommended additions:

- Add a compact "minimum viable context" first page to the artifact.
- Add the proposed content source matrix.

### Chapter 5. Гигиена контекста

Education source: `modules/05-token-hygiene.md`, `templates/token-hygiene-checklist.md`.

Core taught practice:

- choose mode by task;
- do not dump the whole repo;
- small reviewable diffs;
- stop blind retries;
- ask for summary;
- sometimes doing it manually is better.

Project implementation:

- Chapter 5 prep and reward teach mode choice, context budget and stop rule (`chapterCatalog.ts:4565-4683`).
- Scenes cover work mode, budgeted context, stopping blind retry and checklist ordering (`chapterCatalog.ts:2736`, `2922`).
- Artifact is a token/context hygiene checklist with before start, budget, during work, stop conditions and after (`localArtifactService.ts:436-508`).

Compliance:

- Strong at product/content level.
- Partial at codebase-maintainability level because central content config is very large.

Gaps:

- `chapterCatalog.ts` is the biggest mismatch with this chapter's spirit.
- Rank `Token Tamer` is English.

Recommended additions:

- Split chapter configs by chapter.
- Keep shared feedback/retry application helpers typed and small.
- Rename rank or make Russian primary.

### Chapter 6. Дисциплина проверки

Education source: `modules/06-verification-discipline.md`, `templates/verification-matrix.md`, `templates/ai-pr-self-review.md`.

Core taught practice:

- AI result works only after evidence;
- choose checks by task type;
- UI/e2e must verify observable behavior;
- business logic needs an oracle;
- reviewer note records evidence, risk and focus.

Project implementation:

- Chapter 6 prep/reward/recap teach evidence over confidence (`chapterCatalog.ts:4686-4804`).
- Scenes cover evidence before review, verification matrix, observable checks and reviewer note ordering (`chapterCatalog.ts:3239`, `3426`).
- Boss covers evidence loadout, empty test, oracle and review note.
- Artifact is a verification matrix plus self-review and reviewer note (`localArtifactService.ts:511-608`).
- Prep resources now include Russian e2e/testing materials and a Russian conference talk, plus English primary fallbacks for Google testing practices.
- Project-level verification is strong: lint, typecheck, build, e2e and extensive verification docs.

Compliance:

- Strong.

Gaps:

- Project lacks fast unit/domain tests for the deterministic engine and progress rules.
- Rank `Trust But Tester` is English.

Recommended additions:

- Add small domain tests for `missionEngine` and progress unlock/replay rules.
- Rename rank to Russian primary.

### Chapter 7. Рабочие сценарии

Education source: `modules/07-playbooks.md`, `templates/playbook-template.md`, `templates/clinic-case-capture.md`.

Core taught practice:

- playbook is reusable workflow, not a magic prompt;
- include when to use / when not to use;
- define input context, prompt skeleton, workflow, acceptance, verification, mistakes and update loop;
- derive playbooks from real clinic cases.

Project implementation:

- Chapter 7 prep/reward/recap directly teach repeatable team workflows (`chapterCatalog.ts:4807-4925`).
- Scenes cover playbook candidate, anatomy, prompt skeleton and clinic-to-playbook capture (`chapterCatalog.ts:3684`, `3856`).
- Boss covers candidate scan, boundaries, document order and rollout.
- Artifact is a playbook draft with purpose, when/when not, input context, prompt skeleton, workflow, acceptance, verification, typical mistakes, token hygiene, case capture, examples and update notes (`localArtifactService.ts:611-776`).

Compliance:

- Strong as course content.
- Partial as project practice because Project Z has rules/checklists but not yet explicit project playbooks.

Gaps:

- Rank `Playbook Crafter` is English.
- No `docs/product/playbooks/` folder for Project Z's recurring workflows.

Recommended additions:

- Add Project Z internal playbooks for mission content edits, map landmark edits and reward/artifact edits.
- Keep them short: 1-3 pages each.

## Detailed gap register

| Priority | Gap | Why it matters | Suggested fix |
| --- | --- | --- | --- |
| P0 | No complete scene-to-source traceability matrix | Future content edits can drift from education sources while still passing tests | Add `docs/product/chapter-content-source-matrix.md` |
| P0 | English ranks and visible process terms | App rules say Russian-first visible copy; current ranks are player-facing | Rename ranks or show Russian primary titles |
| P1 | One huge `chapterCatalog.ts` | Weakens token hygiene and future narrow edits | Split per-chapter content files |
| P1 | No PR template / AI-assisted visibility artifact in repo | Chapter 1 teaches AI visibility, but project does not enforce it as a process | Add PR template or docs-only reviewer note template |
| P1 | No unit/domain test layer | E2E is strong but slower and less precise for engine/progress regressions | Add minimal tests for `missionEngine` and progress rules |
| P1 | No Project Z internal playbook folder | Chapter 7 is taught, but repo lacks reusable project workflows | Add 2-3 short internal playbooks |
| P2 | No external resource link-check cadence | Curated static links can decay over time | Add docs-only maintenance script or review checklist |
| P2 | Artifact 4 is heavy | Useful but may overwhelm a first pilot participant | Add "minimum viable context" section before full inventory |
| P2 | Canonical trap distribution uneven | Some traps may be less memorable | Use pilot feedback before adding more references |

## Recommended implementation sequence

### Step 1: Editorial compliance pass

Scope:

- rank names;
- Chapter 2 recap field names;
- obvious visible English process terms where Russian is clearer.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- focused e2e for badge/reward/leaderboard/rank copy

Risk:

- Low. Mostly typed config/copy, but rank copy appears in progress, badges and leaderboard.

### Step 2: Add source traceability matrix

Scope:

- docs-only matrix mapping all 63 mission-like configs and 7 artifacts to source modules/templates.

Verification:

- lightweight docs context check;
- optional script that verifies every mission id appears in the matrix.

Risk:

- Low. Improves future safety.

### Step 3: Add resource maintenance cadence

Scope:

- add a non-runtime link-check script or checklist for curated prep resource review;
- document review cadence and what to do when a source decays or becomes too tool-specific.

Verification:

- `npm run typecheck`
- `npm run build`
- quick prep route e2e/browser check if visible resource rendering changes.

Risk:

- Low to medium. Resource text is visible.

### Step 4: Split chapter content files

Scope:

- preserve exported `chapters`;
- preserve all ids;
- move chapter configs into per-chapter files;
- keep feedback/retry patch helper shared.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- full `npm run test:e2e`
- static content audit: 7 chapters, 63 mission targets, zero missing feedback/retry/takeaway.

Risk:

- Medium. Mechanical but touches source of all content.

### Step 5: Add project playbooks and optional PR template

Scope:

- docs/product/playbooks:
  - mission content edit;
  - map landmark icon edit;
  - badge/artifact reward edit.
- optional `.github/pull_request_template.md` if this repo will be used with git hosting.

Verification:

- docs context check.

Risk:

- Low.

### Step 6: Add domain tests if the project accepts another test layer

Scope:

- mission engine;
- progress unlock/replay;
- trap id collection.

Verification:

- new unit test command;
- existing e2e remains.

Risk:

- Medium because it adds tooling/dependency decisions. Keep it small.

## Final answer to the audit question

Does the current project fully correspond to the best practices taught in the app?

Answer: it corresponds very well, but not perfectly in the strictest interpretation.

What fully corresponds:

- seven-chapter skill program;
- one concrete skill per chapter and per mission family;
- deterministic authored missions;
- strong non-leaking feedback model;
- canonical recurring traps and field guide;
- practical markdown artifacts;
- local-first persistence behind repositories;
- no backend/Supabase/Pachca/LLM/runtime-search implementation;
- architecture boundaries and CSS ownership;
- verification culture with lint/typecheck/build/e2e and current 32 passing tests.

What does not fully correspond yet:

- source traceability is incomplete outside retry principles;
- some visible language is more English than the Russian-first rule prefers;
- external prep resources do not yet have an automated link-check cadence;
- content architecture is not ideal for token hygiene because one file owns too much;
- the repo lacks its own small playbook set and PR visibility template;
- unit/domain tests are not yet separated from e2e.

Recommended stance:

- Do not block the pilot on these gaps.
- Close P0 editorial/source-traceability gaps before scaling beyond the first pilot wave.
- Close P1 maintainability/playbook/testing gaps before a larger content expansion or backend phase.
