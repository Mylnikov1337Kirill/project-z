# Backend-only cutover subtasks

Дата: 2026-06-02

Цель: полностью убрать local mode из Project Z. После выполнения этого плана браузерная часть всегда работает через Node `/api/*`, а backend + Supabase остаются единственным источником истины для identity, progress, attempts, scoring, completion, unlocks, traps, reflections, leaderboard and announcement outbox.

Этот документ является рабочей разбивкой для отдельных чатов/агентов. Ссылайтесь на ID задач (`BOC-00`, `BOC-01`, etc.) в новых чатах.

## Non-negotiable target state

- No supported local persistence mode.
- No `VITE_PROJECT_Z_DATA_MODE`, `E2E_DATA_MODE`, local/backend runtime switch or default local path.
- No browser-owned mission scoring, attempt persistence, chapter completion, trap discovery persistence, leaderboard projection or badge announcement trigger.
- No `project-z-progress-v1` localStorage progress, local progress schema migrations or localStorage e2e seeding.
- No frontend mock announcement service in runtime composition.
- Browser submits only raw answer, stable ids, content version and idempotency key to `/api/missions/:missionId/attempts`.
- Node API and server-owned RPCs own score, completion, badge award, unlock, trap discovery and outbox writes.
- Static authored content may remain code-bundled; artifact markdown export may remain browser-generated if it is renamed away from local-mode language and does not persist product state.

## Execution order

Run tasks in order. Do not skip a task because a later task seems to cover it; the plan is designed to remove local mode without leaving compatibility shims.

### BOC-00. Baseline inventory and forbidden-symbol list

Goal: establish the exact cleanup surface before edits.

Implementation:

- Run an inventory grep over runtime, tests and docs for local-mode artifacts:
  - `localProgressRepository`
  - `LocalProgressRepository`
  - `localMissionAttemptService`
  - `LocalMissionAttemptService`
  - `mockAnnouncementService`
  - `VITE_PROJECT_Z_DATA_MODE`
  - `E2E_DATA_MODE`
  - `project-z-progress-v1`
  - `localStorage`
  - `local mode`
  - `local-first`
- Classify matches as runtime, tests, active docs, or historical docs.
- Create a short implementation note in the agent response listing the files that will be touched next.

Acceptance:

- The next implementer has a concrete file list before making removals.
- Historical ADR/audit docs can remain historical, but active docs and runtime must be scheduled for cleanup.

BOC-00 inventory result, 2026-06-02:

- Command surface checked: `src`, `server`, `supabase`, `e2e`, `docs`, `README.md`, `package/config` with the forbidden symbols above. `server/` and `supabase/` had no matches for the BOC-00 forbidden list.
- Runtime/config cleanup files:
  - `src/app/providers/AppServicesProvider.tsx` -- imports local progress, local mission submit and mock announcement services; owns `localAppServices` / `backendAppServices` split and `import.meta.env.VITE_PROJECT_Z_DATA_MODE`.
  - `src/shared/api/progress/localProgressRepository.ts` -- owns `project-z-progress-v1`, localStorage progress persistence, schema migrations and `LocalProgressRepository`.
  - `src/shared/api/missions/localMissionAttemptService.ts` -- owns local browser mission submit orchestration.
  - `src/shared/api/announcements/mockAnnouncementService.ts` -- frontend mock announcement implementation.
  - `src/shared/api/progress/httpProgressRepository.ts` -- has a remaining `window.localStorage` use for trap guide intro state; schedule under BOC-07.
  - `playwright.config.ts` -- reads `E2E_DATA_MODE` and injects `VITE_PROJECT_Z_DATA_MODE`.
- Test/e2e cleanup files:
  - `src/shared/api/progress/localProgressRepository.test.ts` -- local progress store/migration/leaderboard tests.
  - `src/shared/api/missions/localMissionAttemptService.test.ts` -- local mission submit service tests.
  - `e2e/project-z.spec.ts` -- localStorage progress fixture seeding and reads for `project-z-progress-v1`.
  - `e2e/backend-mode.spec.ts` -- backend fixture smoke currently gated by `E2E_DATA_MODE=backend`.
- Active docs cleanup files:
  - `README.md` -- still documents `VITE_PROJECT_Z_DATA_MODE=backend` and `E2E_DATA_MODE=backend` commands.
  - `docs/architecture.md` -- already points to backend-only target; keep aligned as cleanup proceeds.
  - `docs/product/repo-context-inventory.md` -- mostly marks pre-BOC debt correctly, but still has stale `LocalArtifactService`, local mode and backend fixture mode notes for BOC-06/BOC-08/BOC-09.
  - `docs/product/integration-next-steps.md` -- active and aligned; keep references current as env/test commands change.
  - `docs/adr/ADR-0006-backend-db-rls-and-api.md` -- active ADR still says local mode may remain for development/testing until transition; update in BOC-09.
- Historical docs allowed to keep historical matches, with clearer supersession markers if BOC-09 touches them: `docs/node-backend-migration-phase-0-contract-2026-06-01.md`, `docs/node-backend-migration-agent-phases-2026-06-01.md`, `docs/architecture-backend-migration-audit-2026-06-01.md`, `docs/product/best-practices-compliance-audit-2026-05-30.md`, `docs/adr/ADR-0002-local-first-persistence-behind-repository-interfaces.md`, historical entries in `docs/product/verification-and-self-review.md`.
- Adjacent symbols found for later acceptance gates, outside the minimal BOC-00 grep: `currentProgressStoreSchemaVersion` in `src/shared/api/progress/localProgressRepository.ts`; `qa-shortcut` and `SubmitMissionAttemptSource` in `src/pages/mission/MissionPage.tsx`, `src/shared/api/missions/MissionAttemptService.ts`, mission submit tests; `LocalArtifactService` / `localArtifactService` in artifact service, artifact tests, composition and docs.
- Next touch order from this inventory after BOC-01: BOC-02/BOC-03 hit `ProgressRepository.ts`, `httpProgressRepository.ts`, `localProgressRepository.ts` and local progress tests; BOC-04 hits `MissionAttemptService.ts`, `MissionPage.tsx`, local/http mission tests; BOC-05 deletes frontend announcement service leftovers; BOC-06 renames artifact service; BOC-08 rewrites Playwright mode/config; BOC-09 cleans active docs.

Prompt for a new chat:

```text
Выполни BOC-00 из docs/backend-only-cutover-subtasks-2026-06-02.md: сделай baseline inventory local-mode артефактов, классифицируй runtime/tests/active docs/historical docs и не меняй код.
```

### BOC-01. Backend-only service composition

Goal: remove the frontend runtime switch and make HTTP/backend services the only app services.

Implementation:

- Update `src/app/providers/AppServicesProvider.tsx` so it creates only backend services:
  - `HttpProgressRepository`
  - `HttpMissionAttemptService`
  - existing static content repository
  - artifact service after BOC-06 naming cleanup, or current artifact service only temporarily inside the same PR if BOC-06 is done together.
- Remove `localAppServices`, `backendAppServices` split and `import.meta.env.VITE_PROJECT_Z_DATA_MODE`.
- Remove imports of local progress, local mission attempt and mock announcement services from composition.
- Keep route/page code consuming `useAppServices`; do not replace service injection with direct API imports inside pages.

Acceptance:

- No runtime reference to `VITE_PROJECT_Z_DATA_MODE`.
- Browser bundle has only one service graph.
- `AppServicesProvider` still exposes the same app context shape, minus services removed by later contract cleanup.

Prompt:

```text
Выполни BOC-01: сделай AppServicesProvider backend-only, убери VITE_PROJECT_Z_DATA_MODE и local/backend split. Не трогай поведение страниц сверх необходимой компиляции.
```

BOC-01 implementation result, 2026-06-02:

- `src/app/providers/AppServicesProvider.tsx` now creates a single app service graph with `HttpProgressRepository`, `HttpMissionAttemptService`, `contentRepository` and the current artifact service pending BOC-06 naming cleanup.
- Removed the `localAppServices` / `backendAppServices` split, `import.meta.env.VITE_PROJECT_Z_DATA_MODE`, and composition imports of `localProgressRepository`, `LocalMissionAttemptService` and `mockAnnouncementService`.
- `src/shared/api/appServices/appServices.ts` no longer exposes `announcementService`; no runtime caller used it, and keeping a fake frontend announcement service would preserve a hidden local/mock dependency.
- Verification passed: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:unit` (16 files / 71 tests). Build kept the existing non-blocking Vite chunk-size warning.
- Remaining scheduled cleanup: local progress repository/tests in BOC-02/BOC-03, local mission submit and QA shortcut in BOC-04, announcement service files/tests in BOC-05, artifact naming in BOC-06, Playwright/env mode removal in BOC-08 and active docs in BOC-09.

### BOC-02. ProgressRepository contract cleanup

Goal: make illegal backend writes impossible from the frontend contract.

Implementation:

- Remove local-only write primitives from `ProgressRepository`:
  - `saveMissionAttempt`
  - `completeChapter`
  - `recordEncounteredTrapIds`
- Keep backend-backed methods that are still product features:
  - `getLearner`
  - `identify`
  - `getProgress`
  - `getEncounteredTrapIds`
  - `getChapterReflection`
  - `saveChapterReflection`
  - `getPendingChapterUnlock`
  - `markChapterUnlockSeen`
  - `getLeaderboard`
- Remove or redesign `getTrapGuideIntroSeen` / `markTrapGuideIntroSeen` in BOC-07; do not keep localStorage-backed UI persistence as a hidden exception.
- Update `HttpProgressRepository` to implement only the surviving contract.
- Update callers and tests to use `MissionAttemptService` for mission submit, never progress write methods.

Acceptance:

- TypeScript prevents frontend code from saving attempts, completing chapters or recording traps directly through `ProgressRepository`.
- No HTTP repository method throws “Backend mode records/saves/completes through MissionAttemptService” because those methods no longer exist.

Prompt:

```text
Выполни BOC-02: урежь ProgressRepository до backend-safe методов, удали saveMissionAttempt/completeChapter/recordEncounteredTrapIds из интерфейса и адаптеров, поправь компиляцию.
```

BOC-02 implementation result, 2026-06-02:

- `src/shared/api/progress/ProgressRepository.ts` no longer exposes `saveMissionAttempt`, `completeChapter` or `recordEncounteredTrapIds`; frontend code cannot call these gameplay writes through the shared progress contract.
- `src/shared/api/progress/httpProgressRepository.ts` now implements only the surviving backend-safe progress methods. The old “Backend mode ... through MissionAttemptService” throw stubs were removed.
- `src/shared/api/progress/httpProgressRepository.test.ts` no longer asserts the removed throw-stub behavior.
- `src/shared/api/missions/localMissionAttemptService.ts` now uses a narrow `LocalMissionProgressRepository` legacy dependency for its temporary local write path, keeping the public `ProgressRepository` contract backend-safe until BOC-04 deletes the local mission submit service.
- Verification passed: `npm run typecheck`, `npm run lint`, `npm run test:unit` (16 files / 70 tests), `npm run build`. Build kept the existing non-blocking Vite chunk-size warning. Acceptance grep confirmed no removed methods or old backend-mode throw messages remain in `ProgressRepository`, `HttpProgressRepository` or its test.
- Remaining scheduled cleanup: local progress persistence/tests in BOC-03, local mission submit and QA shortcut in BOC-04, trap guide intro localStorage persistence in BOC-07.

### BOC-03. Delete local progress persistence

Goal: remove the localStorage progress implementation and all local progress store migrations.

Implementation:

- Delete `src/shared/api/progress/localProgressRepository.ts`.
- Delete or rewrite `src/shared/api/progress/localProgressRepository.test.ts`.
- Move any still-needed pure domain tests to entity-level helpers, not local repository tests.
- Remove references to:
  - `project-z-progress-v1`
  - `currentProgressStoreSchemaVersion`
  - local progress schema migrations
  - browser `crypto.randomUUID()` learner creation inside persistence.
- Keep `entities/chapter/lib/progressMutations.ts` only if still used by backend tests or server-side logic. If it becomes unused after the cutover, delete it in the same task or explicitly schedule deletion in BOC-11.

Acceptance:

- `rg "localProgressRepository|LocalProgressRepository|project-z-progress-v1|currentProgressStoreSchemaVersion" src server e2e` has no runtime/test matches.
- No app code reads/writes progress from `window.localStorage`.

Prompt:

```text
Выполни BOC-03: удали localProgressRepository и localStorage progress store/migration/test surface. Сохрани только pure domain helpers, если они реально используются.
```

BOC-03 implementation result, 2026-06-02:

- Deleted `src/shared/api/progress/localProgressRepository.ts` and `src/shared/api/progress/localProgressRepository.test.ts`; local progress store migrations, `project-z-progress-v1`, `currentProgressStoreSchemaVersion`, and browser learner creation in persistence are gone from runtime/test code.
- Kept `src/entities/chapter/lib/progressMutations.ts` because it is still imported by `server/backend/api.ts`, `e2e/backendModeFixtures.ts`, and entity-level tests.
- Reworked `e2e/project-z.spec.ts` to seed progress through `installBackendApiFixture` instead of `window.localStorage`; assertions that previously read the progress store now inspect backend fixture state. The only remaining e2e localStorage check is the trap-guide intro key, which is scheduled for BOC-07 and no longer uses the progress store.
- Updated `e2e/backendModeFixtures.ts` with mutable fixture state for the converted suite and a temporary server-side handling of the existing `qa-shortcut` answer until BOC-04 removes browser QA shortcut authority.
- Verification passed: `npm run typecheck`, `npm run lint`, `npm run test:unit` (15 files / 60 tests), `npm run build`, and full `npm run test:e2e` (43 passed / 4 skipped; skipped backend-mode smoke remains gated by `E2E_DATA_MODE` until BOC-08). Build kept the existing non-blocking Vite chunk-size warning.
- Acceptance grep passed: `rg "localProgressRepository|LocalProgressRepository|project-z-progress-v1|currentProgressStoreSchemaVersion" src server e2e` has no matches.

### BOC-04. Delete local mission submit path and QA shortcut authority

Goal: remove client-owned mission orchestration.

Implementation:

- Delete `src/shared/api/missions/localMissionAttemptService.ts`.
- Delete or rewrite `src/shared/api/missions/localMissionAttemptService.test.ts`.
- Remove `SubmitMissionAttemptSource` from the public mission attempt command unless a non-local backend reason remains.
- Remove hidden `?qa=1` mission completion shortcut from production runtime, or replace test coverage with backend/API fixture setup. Do not keep a browser path that can force correctness.
- Keep `HttpMissionAttemptService` as the only `MissionAttemptService` implementation.
- Ensure `MissionPage` sends only:
  - `answer`
  - `chapterId`
  - `missionId`
  - `contentVersion`
  - `clientAttemptId`

Acceptance:

- `rg "LocalMissionAttemptService|localMissionAttemptService|qa-shortcut|SubmitMissionAttemptSource" src server e2e` has no production runtime match.
- Backend e2e does not depend on browser-side forced completion.
- Incorrect answer behavior still uses server-returned evaluation.

Prompt:

```text
Выполни BOC-04: удали LocalMissionAttemptService и browser QA shortcut authority. MissionPage должен использовать только HttpMissionAttemptService и raw answer/idempotency submit.
```

BOC-04 implementation result, 2026-06-02:

- Deleted `src/shared/api/missions/localMissionAttemptService.ts` and `src/shared/api/missions/localMissionAttemptService.test.ts`; local browser mission orchestration and its QA shortcut evaluator are gone.
- `SubmitMissionAttemptCommand` no longer exposes `source` / `SubmitMissionAttemptSource`. `MissionPage` submits only `answer`, `chapterId`, `missionId`, `contentVersion` and `clientAttemptId`; `HttpMissionAttemptService` remains the only mission submit implementation.
- Removed the mission UI “Засчитать сцену” browser shortcut, its obsolete `.pixel-button-qa` styling and the `qa-shortcut` handling branch from `e2e/backendModeFixtures.ts`; backend-style fixture submits now always evaluate the raw answer.
- Reworked e2e shortcut-dependent setup to seed server fixture state directly where a test needs pre-completed progress. The real mission submit and boss tests still use UI answers and server-returned evaluation.
- Verification passed: `npm run typecheck`, `npm run lint`, `npm run test:unit` (14 files / 55 tests), `npm run build`, targeted Playwright for the changed numbering test, and full `npm run test:e2e` (43 passed / 4 skipped; backend-mode smoke remains gated by `E2E_DATA_MODE` until BOC-08). Build kept the existing non-blocking Vite chunk-size warning.
- Acceptance grep passed: `rg "LocalMissionAttemptService|localMissionAttemptService|qa-shortcut|SubmitMissionAttemptSource" src server e2e` has no matches.

### BOC-05. Remove frontend announcement mock/runtime dependency

Goal: make announcements backend-only.

Implementation:

- Remove `AnnouncementService` from `AppServices` if no frontend runtime caller remains.
- Delete `src/shared/api/announcements/mockAnnouncementService.ts` and obsolete tests/imports.
- Keep announcement event creation in backend/Supabase transaction only.
- Keep `server/backend/announcementWorker.ts` as the server-owned dry-run worker.
- Ensure badge/gameplay UI does not show Pachca/backend/debug notification copy.

Acceptance:

- `rg "mockAnnouncementService|AnnouncementService|announceBadgeEarned|announcementService" src` has no runtime match unless it is a server-owned or historical doc reference.
- Badge completion still creates outbox rows through mission submit backend path.

Prompt:

```text
Выполни BOC-05: убери frontend AnnouncementService/mockAnnouncementService из runtime composition. Announcements должны остаться только backend outbox + worker.
```

BOC-05 implementation result, 2026-06-02:

- Deleted `src/shared/api/announcements/AnnouncementService.ts` and `src/shared/api/announcements/mockAnnouncementService.ts`; the browser runtime no longer has a frontend announcement service or mock Pachca preview path.
- Removed the now-unused `BadgeEarnedEvent` and `AnnouncementResult` shared frontend domain types.
- Kept backend-owned announcement flow intact: mission submit backend/Supabase path remains responsible for badge awards and `announcement_deliveries`, and `server/backend/announcementWorker.ts` remains the server dry-run worker.
- Verification passed: `npm run typecheck`, `npm run lint`, `npm run test:unit` (14 files / 55 tests), `npm run build`. Build kept the existing non-blocking Vite chunk-size warning.
- Acceptance grep passed: `rg "mockAnnouncementService|AnnouncementService|announceBadgeEarned|announcementService" src` has no matches.

### BOC-06. Artifact service naming cleanup

Goal: remove confusing local-mode naming without moving private artifact export unnecessarily.

Decision:

- Keep markdown artifact generation in the browser for now because it is a private download, not product state.
- Rename local-mode names to neutral product names.

Implementation:

- Rename `LocalArtifactService` to a neutral implementation name, for example `MarkdownArtifactService`.
- Rename `localArtifactService.ts` to a neutral filename, for example `markdownArtifactService.ts`.
- Update imports/tests from `localArtifactService` to the new name.
- Keep template registry and reflection append behavior intact.
- Do not add server-side artifact storage/generation in this task.

Acceptance:

- No runtime file/class/import uses `LocalArtifactService` or `localArtifactService`.
- Artifact preview/download behavior remains unchanged.
- Reflection text still appears in generated markdown without learner identity.

Prompt:

```text
Выполни BOC-06: переименуй LocalArtifactService/localArtifactService в нейтральный MarkdownArtifactService/markdownArtifactService, не меняя markdown export behavior.
```

BOC-06 implementation result, 2026-06-02:

- Renamed `src/shared/api/artifacts/localArtifactService.ts` to `src/shared/api/artifacts/markdownArtifactService.ts` and `LocalArtifactService` to `MarkdownArtifactService`.
- Renamed the artifact unit test to `src/shared/api/artifacts/markdownArtifactService.test.ts` and updated the provider import in `src/app/providers/AppServicesProvider.tsx`.
- Kept markdown artifact behavior unchanged: typed template registry lookup, reflection append section and client-side private download path remain intact.
- Verification passed: focused `npm run test:unit -- src/shared/api/artifacts/markdownArtifactService.test.ts` (1 file / 3 tests), `npm run typecheck`, `npm run lint`, full `npm run test:unit` (14 files / 55 tests), and `npm run build`. Build kept the existing non-blocking Vite chunk-size warning.
- Acceptance grep passed: `rg "LocalArtifactService|localArtifactService" src server e2e package.json playwright.config.ts vite.config.ts` has no matches.

### BOC-07. Remove trap guide intro localStorage state

Goal: remove the last UI localStorage exception from backend mode.

Decision:

- Delete persisted intro state instead of adding a backend endpoint. The intro can be derived from current session UI state or shown as normal static copy.

Implementation:

- Remove `getTrapGuideIntroSeen` and `markTrapGuideIntroSeen` from `ProgressRepository`.
- Remove corresponding `HttpProgressRepository` localStorage calls.
- Update map/trap guide UI to avoid depending on persisted intro-seen state.
- If an intro cue remains, make it non-persistent or derive it from backend-owned unlock/progress facts.

Acceptance:

- `rg "trap-guide-intro|TrapGuideIntro|localStorage" src` has no runtime localStorage match.
- Unlock-seen behavior still works through `/api/unlocks/:chapterId/seen`.

Prompt:

```text
Выполни BOC-07: удали trap guide intro localStorage state и методы getTrapGuideIntroSeen/markTrapGuideIntroSeen. Не ломай unlock-seen backend flow.
```

BOC-07 implementation result, 2026-06-02:

- Removed `getTrapGuideIntroSeen` and `markTrapGuideIntroSeen` from `src/shared/api/progress/ProgressRepository.ts`.
- Removed the trap guide intro `window.localStorage` key and read/write helpers from `src/shared/api/progress/httpProgressRepository.ts`; `HttpProgressRepository` now keeps unlock-seen writes only through `/api/unlocks/:chapterId/seen`.
- Updated `src/features/map/WorldMap.tsx` so the field guide cue is non-persistent in-memory UI state for the current SPA session. It still waits for encountered canonical traps, pending-unlock handling and active reveal animation before taking over the mentor prompt.
- Updated Playwright coverage in `e2e/project-z.spec.ts` to assert session-only cue behavior instead of persisted seen state.
- Verification passed: `npm run typecheck`, `npm run lint`, `npm run test:unit` (14 files / 55 tests), `npm run build`, and targeted `npm run test:e2e -- --grep "trap field guide intro|session map intro"` (3 passed; sandboxed attempt hit the known `listen EPERM`, approved rerun passed). Build kept the existing non-blocking Vite chunk-size warning.
- Acceptance grep passed: `rg -n "trap-guide-intro|TrapGuideIntro|localStorage|getTrapGuideIntroSeen|markTrapGuideIntroSeen|project-z-trap-guide-intro-seen-v1" src e2e server --glob '!node_modules'` has no matches.

### BOC-08. Backend-only E2E and fixture cleanup

Goal: make tests reflect the only supported runtime.

Implementation:

- Remove `E2E_DATA_MODE` branching.
- Remove localStorage e2e seeding and tests that assume `project-z-progress-v1`.
- Make backend/API fixture smoke the default e2e path where real Supabase is not available.
- Keep real-backend e2e instructions for environments with server env and Docker/proxy tooling.
- Remove test names/docs that imply “backend mode” is optional.

Acceptance:

- `npm run test:e2e` runs backend-only fixture coverage by default, or clearly fails early with missing required backend fixture setup.
- No e2e file writes local progress into localStorage.
- No Playwright config sets `VITE_PROJECT_Z_DATA_MODE`.

Prompt:

```text
Выполни BOC-08: перепиши Playwright/e2e на backend-only default, убери E2E_DATA_MODE и localStorage seeding. Fixture-backed API smoke должен стать основным быстрым e2e.
```

BOC-08 implementation result, 2026-06-02:

- `playwright.config.ts` no longer reads `E2E_DATA_MODE` or injects `VITE_PROJECT_Z_DATA_MODE`; `npm run test:e2e` now starts the same backend-only app graph used by runtime.
- Renamed `e2e/backend-mode.spec.ts` to `e2e/backend-api.spec.ts` and removed the env-gated `test.skip`, so backend/API fixture smoke runs in the default Playwright suite.
- Renamed `e2e/backendModeFixtures.ts` to `e2e/backendApiFixtures.ts` and updated imports. The main `e2e/project-z.spec.ts` already seeds through API fixture state; its old `writeProgressStore` / `seedProgressStore` helper names were renamed to backend fixture state helpers.
- Removed stale e2e test names that implied local or optional backend mode. No e2e/config path contains `E2E_DATA_MODE`, `VITE_PROJECT_Z_DATA_MODE`, `backend-mode`, `project-z-progress-v1` or `localStorage`.
- Verification passed: `npm run typecheck`, `npm run lint`, targeted backend API smoke after approved local-server rerun, and full `npm run test:e2e` (47 passed). The first sandboxed e2e attempt hit the known `listen EPERM` local-server restriction; approved reruns passed.

### BOC-09. Active docs and ADR cleanup

Goal: remove active documentation that tells agents to keep local mode.

Implementation:

- Update active docs:
  - `README.md`
  - `docs/architecture.md`
  - `docs/product/integration-next-steps.md`
  - `docs/product/repo-context-inventory.md`
  - `/Users/kirillmylnikov/Dev/ai/project-z-development-handoff.md`
- Mark ADR-0002 as superseded or add a new ADR for backend-only cutover. Do not silently leave ADR-0002 as active guidance.
- Keep historical migration/audit docs, but add a short supersession note where needed if they are likely to mislead future agents.
- Replace “local-first/default local mode” guidance with “current cleanup target is backend-only; old local mode is removal work until BOC is complete.”

Acceptance:

- Active entrypoint docs point to this BOC plan or to the completed backend-only state after implementation.
- No Quick Start prompt instructs a future agent to preserve local mode.
- Historical docs are clearly historical if they mention local-first.

Prompt:

```text
Выполни BOC-09: обнови active docs/ADR/handoff под backend-only target, пометь local-first ADR/старые планы как historical/superseded where needed.
```

BOC-09 implementation result, 2026-06-02:

- Updated active entrypoint docs for backend-only state: `README.md`, `docs/architecture.md`, `docs/product/integration-next-steps.md`, `docs/product/README.md`, `docs/product/repo-context-inventory.md` and `/Users/kirillmylnikov/Dev/ai/project-z-development-handoff.md`.
- `README.md` now describes backend-only as the active runtime target after BOC-01..BOC-08, with no local-mode shims.
- `docs/architecture.md` now says there is no supported local persistence mode, forbids local gameplay write adapters and removes `Local*Repository` naming guidance.
- `docs/product/integration-next-steps.md` now treats remaining work as backend-only docs/hardening/rollout verification, not local-mode removal guidance.
- `docs/product/repo-context-inventory.md` and the handoff now mark historical local-first references as archival context and update active service boundaries to `HttpProgressRepository`, `HttpMissionAttemptService`, `MarkdownArtifactService` and backend badge/outbox announcement wiring.
- `docs/adr/ADR-0002-local-first-persistence-behind-repository-interfaces.md` is explicitly superseded by ADR-0006 and the BOC plan.
- `docs/adr/ADR-0006-backend-db-rls-and-api.md` now says local mode is no longer a supported development/test fallback.
- Added supersession notes to historical audit docs likely to mislead future agents: `docs/architecture-backend-migration-audit-2026-06-01.md` and `docs/product/best-practices-compliance-audit-2026-05-30.md`.
- Acceptance grep over active docs/handoff shows remaining local-mode/local-first matches only as negative guidance, explicit no-local statements, or historical/pre-cutover context; the Quick Start no longer asks future agents to preserve local mode or run `E2E_DATA_MODE`.

### BOC-10. Backend write authority hardening

Goal: close the remaining “trusted derived params” seam between Node and Supabase.

Implementation:

- Audit `server/backend/api.ts` and `supabase/migrations/*mission_attempt*`.
- Keep browser unable to send `score`, `isCorrect`, `completion`, `trapDiscoveries` or `source`.
- Prefer a server-owned module boundary where Node computes evaluation and passes only internal values to a service-role-only RPC. If the RPC continues to receive `p_is_correct` / `p_score`, document and test that only `server/backend/api.ts` can call it and browser input cannot influence those params except through raw answer evaluation.
- Add tests proving malicious browser submit body fields are ignored:
  - `score`
  - `isCorrect`
  - `completedMissionIds`
  - `completion`
  - `source`
  - `trapDiscoveries`
- Add or keep duplicate `clientAttemptId` tests returning persisted evaluation.

Acceptance:

- Unit tests prove client-sent derived fields cannot affect persisted result.
- RPC grants remain service-role-only.
- Logs do not include raw secrets, full request payloads or private reflection notes.

Prompt:

```text
Выполни BOC-10: усили backend write authority. Добавь тесты, что browser body score/isCorrect/completion/source/trapDiscoveries игнорируются, а RPC остается service-role-only.
```

BOC-10 implementation result, 2026-06-02:

- `server/backend/api.ts` keeps mission submit writes server-owned: browser body still contributes only raw `answer`, stable ids and `contentVersion`; `p_is_correct`, `p_score` and `p_encountered_trap_ids` are computed from authored content through `evaluateMission` / `getEncounteredTrapIdsFromEvaluation` before the service-role RPC call.
- Extended `server/backend/api.test.ts` with a malicious submit body containing `score`, `isCorrect`, `completedMissionIds`, `completion`, `source` and `trapDiscoveries`; the test proves those fields are not forwarded and do not affect response evaluation/completion/trap discoveries.
- Added backend error log redaction coverage: API errors log method/path/error message only, not raw request body values, pilot cookies or private notes.
- Extended `server/nodeApiParity.test.ts` with the same derived-field hardening check through the Node route wrapper, preserving duplicate `clientAttemptId` coverage that returns the persisted evaluation instead of the retried answer.
- Added `server/backend/supabaseMigrations.test.ts` to lock the historical mission attempt RPC grant shape: `project_z_submit_mission_attempt` is revoked from `public`, granted to `service_role`, and not granted to `anon`, `authenticated` or `public`. This test was removed later by DBM-10 when Supabase REST/RPC stopped being active runtime.
- Verification passed: focused `npm run test:unit -- server/backend/api.test.ts server/nodeApiParity.test.ts server/backend/supabaseMigrations.test.ts` (3 files / 22 tests), `npm run typecheck`, `npm run lint`, full `npm run test:unit` (15 files / 58 tests), `npm run build:server`, and `npm run build`. Build kept the existing non-blocking Vite chunk-size warning.
- BOC-11 forbidden-symbol precheck passed with no matches for the configured active source/test/config grep after BOC-10.

### BOC-11. Forbidden-symbol cleanup gate

Goal: ensure no local-mode residue remains in active runtime and tests.

Implementation:

- Run grep gates over active source/test/config paths:

```bash
rg -n "localProgressRepository|LocalProgressRepository|localMissionAttemptService|LocalMissionAttemptService|mockAnnouncementService|VITE_PROJECT_Z_DATA_MODE|E2E_DATA_MODE|project-z-progress-v1|currentProgressStoreSchemaVersion|qa-shortcut" src server e2e package.json playwright.config.ts vite.config.ts
```

- Run a second localStorage gate:

```bash
rg -n "localStorage" src server e2e
```

- Any remaining match must be either deleted or explicitly justified as browser UI state that is unrelated to persistence mode. The intended target is zero runtime matches.
- Remove unused files, tests and exports surfaced by TypeScript/ESLint.

Acceptance:

- Forbidden-symbol grep has zero active runtime/test matches.
- Any remaining `localStorage` use has a written justification in the final agent response and is not progress/gameplay state. Preferred target: zero.

Prompt:

```text
Выполни BOC-11: прогони forbidden-symbol gates из docs/backend-only-cutover-subtasks-2026-06-02.md и удали остатки local mode из active source/tests/config.
```

BOC-11 implementation result, 2026-06-02:

- Forbidden-symbol gate passed with zero active source/test/config matches:
  `rg -n "localProgressRepository|LocalProgressRepository|localMissionAttemptService|LocalMissionAttemptService|mockAnnouncementService|VITE_PROJECT_Z_DATA_MODE|E2E_DATA_MODE|project-z-progress-v1|currentProgressStoreSchemaVersion|qa-shortcut" src server e2e package.json playwright.config.ts vite.config.ts`.
- `localStorage` gate passed with zero active source/test matches:
  `rg -n "localStorage" src server e2e`.
- Additional file-name sweep found no active local/mock announcement/backend-mode leftovers under `src`, `server` or `e2e`.
- No runtime code edits were needed. Status docs were updated to record BOC-11 completion and keep the next task pointed at BOC-12 backend-only verification.
- Verification passed: `npm run lint` and `npm run typecheck` through `scripts/run-with-supported-node.mjs` with the Codex bundled Node fallback.

### BOC-12. Backend-only verification and rollout blockers

Goal: prove the cleanup without relying on local fallback.

Required checks:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run build:server
npm run test:e2e
```

Additional environment checks when Docker/proxy/server env are available:

```bash
docker build -t project-z-api:local .
docker run --rm -d --name project-z-api-smoke -p 3000:3000 project-z-api:local
curl -i http://127.0.0.1:3000/healthz
docker stop project-z-api-smoke
npm run build
docker compose -f deploy/docker-compose.yml up -d db
DATABASE_URL=postgres://project_z:project_z_local_password@127.0.0.1:54321/project_z npm run db:migrate
PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN=... PROJECT_Z_PACHCA_DELIVERY_MODE=dry-run docker compose -f deploy/docker-compose.yml up --build -d
```

Real-backend smoke scenarios:

- `POST /api/pilot-sessions`
- `GET /api/me`
- identify learner
- `GET /api/progress`
- mission submit correct and incorrect answers
- duplicate `clientAttemptId`
- leaderboard without `fullName`
- unlock seen
- save/read reflection
- discovered traps
- `POST /api/admin/announcement-worker` dry-run transition

Acceptance:

- All available local checks pass.
- Missing Docker/own-Postgres/Pachca checks are reported as explicit external blockers, not hidden by local fallback.
- Final response includes the forbidden-symbol grep result.

Prompt:

```text
Выполни BOC-12: прогон backend-only verification gates, real-backend smoke where env/tooling exists, и зафиксируй оставшиеся внешние rollout blockers без local fallback.
```

BOC-12 implementation result, 2026-06-02:

- Required backend-only local gates passed: `npm run lint`, `npm run typecheck`, `npm run test:unit` (15 files / 58 tests), `npm run build`, `npm run build:server`, and `npm run test:e2e` (47 passed).
- The first sandboxed `npm run test:e2e` attempt failed with the known local-server restriction, `listen EPERM: operation not permitted 127.0.0.1:5174`; the approved rerun outside the sandbox passed.
- `npm run build` kept the existing non-blocking Vite chunk-size warning for `dist/assets/index-BvYHN6nN.js`.
- Forbidden-symbol gate passed with zero active source/test/config matches:
  `rg -n "localProgressRepository|LocalProgressRepository|localMissionAttemptService|LocalMissionAttemptService|mockAnnouncementService|VITE_PROJECT_Z_DATA_MODE|E2E_DATA_MODE|project-z-progress-v1|currentProgressStoreSchemaVersion|qa-shortcut" src server e2e package.json playwright.config.ts vite.config.ts`.
- `localStorage` gate passed with zero active source/test matches:
  `rg -n "localStorage" src server e2e`.
- Additional active filename/symbol sweep passed with zero matches for `backend-mode`, local artifact service names, mock announcement names, local progress names and local mission names under `src`, `server`, `e2e` and active config.
- Docker rollout checks were not available in this environment: `docker --version` / `docker info` returned `command not found`, so `docker build`, `docker run` health smoke and `docker compose` smoke were not run.
- Historical pre-DBM Supabase/Pachca smoke scenarios were not available because Supabase env, `PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN` and `PROJECT_Z_PACHCA_DELIVERY_MODE` were missing from the environment; Pachca delivery credentials were also absent for non-dry-run delivery. DBM-10 superseded the Supabase smoke path; active external rollout blockers are own-Postgres Docker Compose DB/API/proxy smoke and Pachca dry-run worker verification.

## Final done definition

The backend-only cutover is complete only when all are true:

- Active runtime has no local/backend switch.
- Active tests have no localStorage progress fixture path.
- Active docs no longer instruct future agents to preserve local mode.
- Browser cannot persist gameplay state without Node `/api/*`.
- Mission submit, completion, unlocks, traps, reflections, leaderboard and outbox are backend-owned.
- Artifact download has no local-mode naming, even if markdown generation remains browser-side.
- Full available verification passes and real environment blockers are explicit.
