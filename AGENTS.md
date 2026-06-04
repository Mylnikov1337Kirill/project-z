# Project Z Agent Rules

Project Z is a game-first learning app, not a dashboard, LMS, or architecture demo. The first screen must feel like a playable retro map.

Before substantial AI-assisted work, read the local prep pack:

- `/Users/kirillmylnikov/Dev/ai/project-z-development-handoff.md`
- `docs/product/README.md`
- `docs/product/repo-context-inventory.md`
- `docs/architecture.md` for current frontend layer boundaries and dependency direction
- `docs/product/verification-and-self-review.md` before reporting or handing off changes
- `docs/product/session-closeout.md` before the final response

## Educational Source Of Truth

Mission, quiz, prep and artifact content must be grounded in the education kit, not only in handoffs. Before changing chapter copy, prep briefing copy, curated resource lists, mission configs, answer options, scoring feedback, reward copy, generated markdown artifacts, or any gameplay teaching content, open the relevant source module/template first.

Education kit root:

- `/Users/kirillmylnikov/Dev/Obsidian/main/AI/Reports/agentic-tools-awareness/education/README.md`

Rules & Skills was inserted after the upstream education kit map was created. Until
that kit has matching files, use the repo-local Chapter 5 placeholders listed
below.

Chapter-to-source map:

- Chapter 1, ИИ как инженерный инструмент: `modules/01-ai-as-engineering-tool.md`, `templates/ai-pr-self-review.md`
- Chapter 2, Постановка задачи: `modules/02-task-framing.md`, `templates/task-brief.md`
- Chapter 3, Работа от плана: `modules/04-plan-first-agentic-workflow.md`, `templates/task-brief.md`
- Chapter 4, Контекст проекта: `modules/03-context-engineering.md`, `templates/repo-context-inventory.md`, `templates/agents-md-v0.md`
- Chapter 5, Rules & Skills: repo-local `modules/08-rules-and-skills.md`, repo-local `templates/rules-inventory.md`, repo-local `templates/skill-draft.md`
- Chapter 6, Гигиена контекста: `modules/05-token-hygiene.md`, `templates/token-hygiene-checklist.md`
- Chapter 7, Дисциплина проверки: `modules/06-verification-discipline.md`, `templates/verification-matrix.md`, `templates/ai-pr-self-review.md`
- Chapter 8, Рабочие сценарии: `modules/07-playbooks.md`, `templates/playbook-template.md`, `templates/clinic-case-capture.md`

Use the relevant module to improve the quiz substance: scenarios, wrong-answer feedback, mentor guidance, and acceptance of correct answers should teach the same practical rule as the source material. If a listed source file is missing, say so in the final report and fall back to the handoff plus existing in-repo docs.

Prep resources are curated static chapter config, not runtime internet search. Prefer strong Russian-language materials; use English fallback when the English source is clearly stronger or no comparable Russian material exists. For agentic topics, choose tool-agnostic foundation materials about agent loops, task framing, context, constraints, examples, acceptance criteria, verification, stop conditions, and human ownership. Do not use a resource as a primary learning link when its value is mainly tied to a specific commercial product or interface such as Copilot, Claude, Cursor, or similar coding assistants; vendor docs are acceptable only as secondary fallback when they explain a transferable mechanism better than available generic sources. Generated chapter artifacts must be practical starters with explicit project adaptation points and no learner personal data.

## Game UI Over Debug UI

- Do not show implementation status on the game UI.
- Do not show text like `Phase 1`, `No backend`, `ProgressRepository`, `ContentRepository`, `AnnouncementService`, `placeholder`, `TODO`, `mock`, or similar architecture/debug labels in visible gameplay screens.
- Exception: generated markdown artifact previews may contain project adaptation markers/TODO as part of the template the player downloads; they must not look like unfinished app implementation work.
- Architecture seams belong in code and docs, not in the player-facing interface.
- Avoid generic panels that explain the system. Every visible element should serve the game moment.
- If a feature is not implemented yet, use in-world product language such as locked zones, briefings, unavailable routes, or mentor guidance.
- Keep technical notes in docs, handoffs, README, or code comments, not on playable screens.

## Visual Layout

- Project Z targets desktop/fullscreen-first gameplay only. Do not start adaptive, mobile-first or responsive redesign work unless the user explicitly reopens that scope.
- Browser layout QA should focus on desktop/fullscreen-first viewports. Mobile-width checks are not required unless the user explicitly asks for adaptive work.
- If a feature does not fit inside the current viewport or game working zone, rebuild the local layout instead of accepting clipping, hidden controls, overflowing children, or page-level scroll as the solution. Panels may scroll internally, but primary actions must remain visible and no element may leave its parent block.
- The world map should be the main first-screen object and should use the full available width.
- Chapter nodes must sit directly on the route line. Do not place nodes and line independently by eye.
- If an SVG route is aligned with CSS-positioned nodes, use the same coordinate system and verify alignment. For `viewBox="0 0 100 100"` with CSS `%` node positions, use `preserveAspectRatio="none"`.
- Verify node centers against route points programmatically or with browser inspection. Do not trust a compile/build result as visual proof.
- Robot/player avatars must not overlap interactive nodes. Decorative avatars should use `pointer-events: none`.
- Mentor guidance should feel like an in-game dialog bubble, preferably over the map, not like a separate corporate card or sidebar.
- Current player title can live in a small HUD above the map.
- Chapter rewards should not dominate the map UI. Show them after completion, in chapter detail, or subtly on hover/title.
- Map landmark icons must follow `docs/product/map-landmark-icon-style.md`: shared station-sign frame, crisp pixel SVG shapes, one strong inner metaphor, no tiny text/UI/details, no diagonal marks crossing and obscuring the symbol, and no visual clutter that only makes sense after reading an explanation.
- For map landmark icon changes, inspect the rendered `/map` view and a close crop of each changed landmark at desktop/fullscreen-first size. Do not report the icon done if the crop reads as line soup, a broken artifact, or a symbol that requires its label to understand.

## Copy And Language

- Visible UI text should be Russian unless explicitly requested otherwise.
- Avoid literal or awkward translations. Prefer natural product/game copy.
- Do not use unclear metaphors like "учебный картридж" unless the product direction explicitly asks for it.
- Do not write placeholder-sounding copy in the UI. Even Phase 1 screens should read like part of the game world.
- Keep visible UI copy human and mostly Russian. Avoid code-switching: use Russian terms such as `изменения`, `пул-реквест`, `границы задачи`, `видимое поведение`, `критерий приёмки`, `снимки интерфейса`, `рефакторинг`, `награда` and `финальное испытание` instead of English labels like `scope`, `reviewable`, `observable behavior`, `warning`, `snapshots`, `badge`, `rank` or `boss challenge`. English is allowed only when translating would clearly reduce clarity for this audience, such as filenames, command flags, code identifiers, `backend`, `LLM` or an accepted team process marker like `AI-assisted: true`.
- Explain what awaits a new learner directly inside the intro flow: map, chapters, scenarios, mentor feedback, final challenge and rewards.
- Avoid copy that assumes the user has read external context before opening the app.

## Teaching Content Authoring Rules

- Every mission must teach one concrete engineering move from the relevant education source: author ownership, task framing, plan-first control, project context, context hygiene, verification discipline, or reusable team scenarios.
- Write prompts as specific engineering situations with an observable decision. Avoid abstract quiz wording like "choose best practice" when the player can instead decide what to do before review, which context to pass, or which evidence proves the result.
- Answer options must grammatically fit the prompt, have comparable length/detail, and avoid giving away correctness through tone. A correct option should be correct because it follows the scenario and source material, not because it sounds more polished.
- Wrong answers should be plausible AI-assisted traps, not silly distractors. Prefer recurring traps the player can recognize later: `Уверенный отчёт`, `Соседний рефакторинг`, `Свалка контекста`, `Тест, который ничего не доказывает`, `Агент как источник`, `Чувствительные данные`, `Слишком широко`, `Личная магия`.
- For recurring traps, use the canonical `trapId` values from `src/entities/trap/model/trapConcepts.ts`; keep `trapLabel` only for local chapter-specific labels that are not recurring course concepts.
- Feedback must explain the rule, the selected trap, or the visible mistake. Never leave the learner with a bare "неверно"; when a detailed hint would reveal a hidden correct answer, use a non-leaking retry principle instead.
- Failed attempts must never reveal unselected correct answers, exact correct answer sets, or the exact correct ordering. It is acceptable to explain the trap the learner selected, the rule being tested, or a general retry principle; do not render `Пропущено` cards for hidden correct chips, expected-step labels, or failure copy that effectively lists the answer.
- Retry principles must stay authored and source-backed. When changing them, update `docs/product/retry-principle-content-matrix.md` and keep them specific to the chapter skill without naming hidden correct chips, exact answer counts, expected-step labels, exact ordering or missed correct options.
- Keep chapter language coherent across prep, missions, final challenge, badge, rank, artifact and hidden announcement copy. A chapter should point to one memorable skill, not a cloud of related slogans.
- Prefer Russian teaching terms in visible copy: `цель`, `границы`, `запреты`, `бриф задачи`, `примеры`, `критерии приёмки`, `проверка`, `доказательства`, `доменный источник`, `рабочий сценарий`, `каркас запроса`, `чек-лист`, `короткий итог`.
- English can remain in filenames, commands, code identifiers, source titles, accepted process markers and external resource names. If an English term appears in player-facing prose, it should make the sentence clearer for developers, not merely mirror the source material.
- Prep screens should prepare the exact skill practiced in the chapter: short rule, likely traps, 3-5 checklist items and curated resources that reinforce the same behavior.
- Artifact markdown should be useful after the game: practical starter templates, explicit project adaptation points, no learner personal data, and `TODO` only as template placeholders rather than unfinished app work.
- If correct/incorrect status depends on internal policy, domain facts, or a source ambiguity, stop and ask the user/domain owner instead of guessing a clean quiz answer.

## Scope Discipline

- Implement only the requested phase, but make that phase feel intentional and usable.
- Do not add backend, real Pachca calls, external LLM calls, or extra dependencies unless the phase explicitly calls for them.
- Keep dependencies minimal.
- Keep persistence behind interfaces, but do not expose those interfaces in the player-facing UI.
- For frontend architecture changes, follow `docs/architecture.md`: keep `app` as composition, `pages` as route-level screens, `features` as product workflows, `entities` as domain rules, and `shared` as reusable UI/lib/api/types.
- For CSS architecture changes, follow the same ownership boundaries: `src/app/styles/app.css` is only the style manifest, `global.css` owns tokens/base rules, route styles stay in `src/pages/*`, workflow styles stay in `src/features/*`, and reusable primitive styles stay in `src/shared/ui`.
- Temporary QA shortcuts must be hidden from the normal player flow and gated behind an explicit route flag such as `?qa=1`. Do not show debug/test controls by default.

## Frontend Code Rules

- Do not grow large gameplay components by adding another conditional branch inline. Route pages should compose, feature hooks should own workflow state/effects, and feature UI parts should render focused surfaces.
- Keep mission workflow logic out of `MissionScene` JSX. Answer state, chip budget checks, boss round derivation, drag/drop interaction and feedback rendering should stay split across `features/mission/lib` and focused `features/mission/ui` components.
- Keep map selection, avatar movement and pending-unlock effects in `features/map/lib`; keep pure map calculations and mentor prompt derivation in view-model helpers.
- Keep leaderboard loading/sorting/error state in `features/leaderboard/lib`, and render ranking data with semantic table markup unless an accessibility review intentionally changes the pattern.
- Do not store derived state in React state when it can be calculated from props or existing state.
- Use effects only to synchronize with external systems, subscriptions, timers or browser APIs. Avoid synchronous `setState` resets directly inside an effect body; derive loading/readiness when practical.
- Put reusable route chrome in `shared/ui` only when it is genuinely shared and does not know about a specific product workflow. Keep chapter, mission, map, badge and leaderboard-specific UI inside the owning feature/page.
- Do not add feature, page or component selectors back into `src/app/styles/app.css`; add new CSS to the owner file and keep selector names compatible unless a task explicitly asks for a styling API rename.
- When refactoring interactive UI, add or update Playwright coverage for keyboard navigation, focus/pressed state, loading/error/empty states, or semantic markup touched by the change.
- Accessibility rule for modal dialogs: every surfaced modal with `role="dialog"` must declare modal semantics (`aria-modal="true"` when it blocks the page), provide an explicit close action when dismissible, and close on `Escape`. Reuse `src/shared/lib/a11y/useModalEscapeClose.ts` for React modal surfaces instead of adding ad hoc keydown listeners.
- Run the normal npm scripts (`npm run lint`, `npm run build`, etc.). They are wrapped by `scripts/run-with-supported-node.mjs`: if the local system Node is below `20.19.0`, Codex sessions automatically rerun Vite/TypeScript/ESLint/Playwright with the bundled Codex Node. Outside Codex, use Node `>=20.19.0` or set `PROJECT_Z_NODE_BIN=/path/to/node`.

## Feedback Loop

- After UI changes, run lint, typecheck, e2e tests, build checks and open the app in the browser when available.
- Use a screenshot or browser visual inspection to catch layout issues.
- Browser QA should use the Codex Browser plugin first. If the Browser plugin cannot provide an in-app browser (`iab` is unavailable or the browser list is empty), treat browser QA as unavailable in the current Codex client session. This is a client/browser binding limitation, not something to fix with shell permissions.
- In Codex Mobile sessions, do not work around unavailable Browser QA with ad hoc headless Firefox scripts, temporary QA seed pages or other one-off browser automation unless the user explicitly asks for that path. Run `npm run lint`, `npm run build` and any repo-provided CLI smoke/e2e tests, then report browser QA as not run because the in-app browser is unavailable and leave the dev URL for manual checking.
- Check console errors.
- For map work, verify:
  - 8 chapter nodes are visible;
  - open/locked states are clear;
  - the first node is clickable when expected;
  - locked nodes are disabled when expected;
  - route line passes through node centers;
  - landmark icons follow `docs/product/map-landmark-icon-style.md` and remain readable in a close crop;
  - landmark signs use explicit decorative positions independent from route nodes/avatar offsets and do not overlap the robot or interactive nodes;
  - mentor bubble and robot avatar do not cover nodes;
  - no debug/architecture text is visible.
- Do not report "works" based only on `npm run build`.

## Reporting Back

- Keep final reports short and concrete.
- Mention what changed, what was verified, and any known limitation.
- Do not dump noisy debug details unless the user asks for them.

## Session Closeout

Every AI-assisted session that changes files, project status, checks, constraints, or future-agent rules must leave the repo context current. For read-only review or analysis, do the lightweight closeout check and explicitly report that docs were not updated because repo truth did not change.

- Before the final response, read `docs/product/session-closeout.md`.
- Update `/Users/kirillmylnikov/Dev/ai/project-z-development-handoff.md` when phase status, completed work, known-good checks, next step, or the next-chat prompt changed. This is the only Project Z handoff; do not recreate `project-z-progress-handoff.md`.
- Update `docs/product/repo-context-inventory.md` when commands, stack, paths, constraints, known pitfalls, or missing context changed.
- Update `docs/product/verification-and-self-review.md` when checks, browser QA, reviewer focus, recurring risks, or stop conditions changed.
- Update `README.md` only for user-visible setup, status, structure, or command changes.
- If no docs need updates, state that in the final response with the reason.
