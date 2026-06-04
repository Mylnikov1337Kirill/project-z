# Architecture and backend migration audit

Дата аудита: 2026-06-01

Supersession note, 2026-06-02: this is a historical pre-cutover audit. It may
describe local-first architecture and optional local-mode fallbacks that were
valid before BOC. Current guidance is backend-only through Node `/api/*`; use
`docs/backend-only-cutover-subtasks-2026-06-02.md` and `docs/architecture.md`
for active work.

Цель: зафиксировать текущее архитектурное состояние Project Z, показать локальные места для рефакторинга и разметить кандидатов на перенос из local-first SPA в backend с базой данных.

## 1. Короткий вывод

Project Z сейчас находится в хорошей для раннего продукта точке: это цельная Vite + React + TypeScript SPA с понятными слоями `app -> pages -> features -> entities -> shared`, детерминированным игровым движком, typed content config и persistence-контрактами в `shared/api`. Главная сильная сторона -- уже есть `ProgressRepository`, `ContentRepository`, `ArtifactService`, `AnnouncementService`, а игровая UI-логика в основном не читает `localStorage` напрямую.

Главный архитектурный долг перед backend -- контракты есть, но реализации подключены прямыми singleton-импортами из local/mock файлов. Страницы и feature hooks импортируют `localProgressRepository`, `localArtifactService` и `mockAnnouncementService` напрямую, поэтому заменить хранилище без точечных правок по приложению пока нельзя. Второй крупный риск -- клиент сейчас является источником истины для scoring, попыток, completion, unlocks и leaderboard. Для локальной игры это нормально; для backend с общей таблицей лидеров и Pachca-уведомлениями это нужно переносить на server-side транзакции или хотя бы дублировать server-side валидацией.

Рекомендуемая стратегия: не переписывать приложение "под backend" целиком. Сначала укрепить текущие границы: добавить app-level service composition, разрезать `LocalProgressRepository`, вынести use case `submitMissionAnswer`, ввести версионированную схему local store и contract tests. Затем добавить backend/Supabase implementation за теми же интерфейсами и переключать источник данных feature flag'ом.

## 2. Текущий стек и границы

| Зона | Состояние | Наблюдение |
| --- | --- | --- |
| Runtime | React 19, Vite 8, TypeScript 6, React Router 7 | `package.json` содержит только React/router runtime-зависимости и Playwright/ESLint/TS dev-зависимости. |
| Routing | SPA routes in `src/app/router/AppRouter.tsx` | Guarded routes завязаны на `learner` из `GameStateProvider`. |
| State | Global game state in `GameStateProvider` | Загружает static content и local progress, отдает `identify` и `refreshProgress`. |
| Domain | `entities/chapter`, `entities/mission`, `entities/trap` | Оценка миссий и progress-деривации отделены от JSX. |
| Data access | `shared/api/*` | Контракты есть, local/mock implementations есть, но DI неполный. |
| Persistence | `localStorage` key `project-z-progress-v1` | Все пользовательские данные лежат в одном JSON blob. |
| Tests | One large Playwright suite | 38 e2e/user-flow tests, no unit/contract runner configured. |
| Backend | Not implemented | `netlify/functions` пустой, Supabase/Pachca описаны только в docs/ADR. |

## 3. Карта данных local-first

Текущий local store находится в `src/shared/api/progress/localProgressRepository.ts`:

```ts
type ProgressStore = {
  learner: Learner | null
  progress: ChapterProgress[]
  attempts: MissionAttempt[]
  completions: ChapterCompletion[]
  encounteredTrapIds: TrapConceptId[]
  chapterReflections: ChapterReflection[]
  pendingUnlockChapterId: string | null
}
```

Фактические доменные сущности, которые уже просятся в backend/DB:

| Данные | Сейчас | Backend-цель |
| --- | --- | --- |
| Learner identity | `learner` в localStorage, id через `crypto.randomUUID()` | `learners` + выбранный auth/pilot identity; privacy policy для `fullName`. |
| Chapter progress | `progress[]` с `status` и `completedMissionIds` | `learner_chapter_progress` + `completed_missions` или normalized mission completions. |
| Mission attempts | `attempts[]` с `answer: unknown`, `score`, `isCorrect` | `mission_attempts` с JSON answer, content version, server evaluation, idempotency key. |
| Chapter completions / badges | `completions[]` | `badge_awards` или `chapter_completions`, unique `(learner_id, chapter_id)`. |
| Trap memory | `encounteredTrapIds[]` | `trap_discoveries(learner_id, trap_id, first_seen_at)`. |
| Reflections | `chapterReflections[]` | `chapter_reflections` with bounded text and updated timestamp. |
| Pending unlock cue | `pendingUnlockChapterId` | Можно оставить frontend-only, но при multi-device лучше `user_ui_events` / `unlock_seen_at`. |
| Leaderboard | Derived single-entry array | DB view/materialized view over completions/progress. |
| Announcements | Mock preview only | Server-side outbox + delivery attempts + Pachca status. |

## 4. Что уже сделано хорошо

1. Есть layer architecture и она в основном соблюдается: route composition в `app`, screens в `pages`, workflow UI в `features`, pure rules/config в `entities`, contracts/UI/types в `shared`.
2. Прямого чтения `localStorage` из UI почти нет; storage спрятан в `LocalProgressRepository`.
3. Mission scoring находится в `entities/mission/lib/missionEngine.ts`, не в компонентах. Это хороший кандидат для shared domain package или server-side reuse.
4. Chapter progress helpers вынесены в `entities/chapter/lib`, поэтому routing/map/badge не держат всю доменную математику inline.
5. Pachca уже архитектурно отнесена на backend через ADR-0004; в UI нет webhook/secrets.
6. Content typed, deterministic, without LLM grading. Это снижает риск backend-миграции: сервер может валидировать ответы по тем же stable ids.

## 5. Главные риски перед backend

### R1. Прямые imports local/mock implementations

`GameStateProvider`, `MissionPage`, `BadgePage`, `CourseCloseoutPage`, `TrapFieldGuidePage`, `useWorldMapState`, `useLeaderboardEntries` импортируют concrete local services. Пример: `GameStateProvider` импортирует `staticContentRepository` и `localProgressRepository`; `MissionPage` импортирует `mockAnnouncementService` и `localProgressRepository`; `BadgePage` и `CourseCloseoutPage` импортируют `localArtifactService`.

Почему это важно: при добавлении Supabase/HTTP implementation придется менять несколько route/feature files, а не только composition root. Это размывает уже заявленное правило "UI не переписывается при смене persistence".

### R2. Client-authoritative scoring and completion

`MissionPage` делает `evaluateMission(...)`, затем вызывает `saveMissionAttempt(...)`, `completeChapter(...)` и `AnnouncementService`. Для local-only это отлично. Для общего backend это означает, что клиент может подменить `isCorrect`, `score`, `chapterId`, `missionId` или вызвать completion без реальной попытки, если backend будет принимать эти поля как истину.

Минимальная backend-цель: API `submitMissionAttempt` принимает raw answer + ids, сам достает content version, сам оценивает, транзакционно пишет attempt/completion/unlock и возвращает evaluation для UI.

### R3. `LocalProgressRepository` смешивает storage, schema, domain rules и projections

В одном файле лежат:

- schema local store;
- initial progress for 7 chapters;
- unlock map;
- badge/rank maps, дублирующие chapter catalog;
- storage read/write and recovery;
- reflection normalization;
- attempt persistence;
- chapter completion;
- leaderboard projection.

Это удобно для local slice, но перед backend мешает выделить чистую модель данных и contract tests.

### R4. Дублирование chapter metadata

`badgeNameByChapter` и `rankAfterCompletionByChapter` в repository дублируют `chapterCatalog`. При будущем редактировании контента backend/leaderboard может начать показывать старые badge/rank. Надежнее хранить stable `chapter_id` и получать display metadata из content snapshot/catalog или писать snapshot в `badge_awards` в момент выдачи.

### R5. No store version / migrations

`readStore()` пытается нормализовать часть полей, но local blob не имеет `schemaVersion`. Перед импортом pilot data или переходом к backend нужно решить: discard, one-time import или migration. Без версии нельзя надежно отличить старый формат от поврежденного состояния.

### R6. Privacy and raw answers

`MissionAttempt.answer` имеет `unknown` и сохраняется целиком. Сейчас это deterministic chips/slots, но в будущем raw answers могут содержать пользовательский текст. Для backend нужно заранее определить retention, PII rules, anonymization and export/delete path. `fullName` также попадает в `Learner` и `LeaderboardEntry`; для Pachca docs уже сказано не отправлять full name.

### R7. Tests are expensive for migration safety

Playwright suite сильный для flows/layout, но нет unit/contract tests для `missionEngine`, `chapterProgress`, `LocalProgressRepository`, idempotent completion, unlock rules, leaderboard sorting. Backend-миграция будет менять именно эти контракты, и ловить это только e2e слишком медленно.

### R8. Content and artifact authoring friction

`chapterCatalog.ts` около 5583 строк, `localArtifactService.ts` около 923 строк. Это уже не критично для runtime, но критично для поддержки: сложно ревьюить контент, валидировать ids, переиспользовать artifact templates server-side или давать редакторам безопасный workflow.

## 6. Backend candidates

### Priority legend

- P0: нужен до реального shared backend/leaderboard, иначе риск данных или дорогое переписывание.
- P1: нужен для production/pilot backend с несколькими пользователями.
- P2: можно оставить client/local в первом backend slice, но лучше иметь план.
- P3: оставить frontend-only, если нет отдельной product need.

| Priority | Candidate | Current files | Что вынести / изменить | Backend/DB target | Reason |
| --- | --- | --- | --- | --- | --- |
| P0 | Service composition boundary | `src/app/providers/GameStateProvider.tsx`, `src/pages/*`, `src/features/*/lib` | Перестать импортировать `local*` / `mock*` из pages/features. Ввести `AppServicesProvider` или `services.ts` composition root. | One selected implementation: local, http, Supabase. | Без этого backend swap будет расползаться по UI. |
| P0 | Learner identity | `IdentityScreen`, `GameStateProvider`, `LocalProgressRepository.identify` | Выбрать auth/pilot identity. Отделить display nickname от PII full name. | `learners`, optional `auth.users`/invite table/session table. | Multi-user backend невозможен без identity policy. |
| P0 | Mission submit authority | `MissionPage.handleMissionSubmit`, `missionEngine`, `LocalProgressRepository.saveMissionAttempt` | Вынести orchestration в use case/API: evaluate, save attempt, record traps, complete chapter. | `POST /api/missions/:id/attempts` + transaction. | Сейчас клиент сам решает correctness/completion. |
| P0 | Chapter completion and unlocks | `LocalProgressRepository.completeChapter`, `unlockNextChapters`, `MissionPage` | Сделать completion idempotent and transactional. | `chapter_completions`, `learner_chapter_progress`, unique constraints. | Нужна защита от duplicate completion and replay. |
| P1 | Leaderboard | `LocalProgressRepository.getLeaderboard`, `useLeaderboardEntries`, `leaderboardModel` | Backend aggregate instead of single local entry. Keep UI table. | SQL view/materialized view or endpoint `GET /api/leaderboard`. | Общая доска не может жить в localStorage. |
| P1 | Trap memory | `recordEncounteredTrapIds`, `getEncounteredTrapIds`, `TrapFieldGuidePage` | Persist per user, dedupe by `(learner_id, trap_id)`. | `trap_discoveries`. | Multi-device/reload/shareable progress. |
| P1 | Chapter reflections | `BadgePage`, `CourseCloseoutPage`, `ChapterReflectionPanel`, `LocalProgressRepository.saveChapterReflection` | Store bounded local notes server-side with privacy rules. | `chapter_reflections`. | Сейчас заметки теряются между устройствами. |
| P1 | Announcement delivery | `mockAnnouncementService`, `MissionPage.announceChapterCompletion`, ADR-0004 | Server-side outbox, idempotency, retries, logs. Frontend only emits completion event or backend derives it. | `announcement_deliveries`, Pachca env vars in backend. | Secrets/retries/status must not be in browser. |
| P1 | Repository contract tests | `ProgressRepository`, future `HttpProgressRepository` | Добавить tests that every implementation passes. | Test suite, not DB table. | Ключевой safety net for migration. |
| P2 | Content repository | `staticContentRepository`, `chapterCatalog.ts` | Можно оставить bundled; позже вынести read model/content API/CMS. | `content_versions`, `chapters`, `missions` or static JSON/CDN. | Нужно только если контент редактируется вне deploy. |
| P2 | Artifact generation | `localArtifactService`, `BadgePage.handleDownload`, `CourseCloseoutPage.handleDownload` | Split templates and generator; optionally server-generate/download. | `artifact_templates`, generated file endpoint or keep client-only. | Backend нужен для sharing/history, не обязателен для privacy-first local files. |
| P2 | Local data migration | `project-z-progress-v1` | One-time import/discard/manual migration policy. | migration endpoint/tool. | Нужен только если pilot local progress must survive. |
| P2 | Operational/admin status | Not implemented | Delivery status, failed announcements, progress audits. | Backend admin logs/status table. | Maintainers need visibility, players do not. |
| P3 | Map selection/avatar/prep timers | `useWorldMapState`, `ChapterPrepPage`, UI hooks | Keep frontend-only except `unlock seen` if multi-device matters. | Optional `user_ui_state`. | Pure presentation state. |
| P3 | QA shortcuts | `useQaShortcutsEnabled`, Playwright flows | Keep hidden and local/test-only. | Test-only endpoints if backend mode needs seeding. | Should not enter product backend. |

## 7. Recommended target architecture

### Frontend

Keep the current layer architecture. Add one missing composition boundary:

```text
src/app/providers/AppServicesProvider.tsx
  provides:
    contentRepository: ContentRepository
    progressRepository: ProgressRepository
    artifactService: ArtifactService
    announcementService: AnnouncementService
    clock/id helpers if needed

src/shared/api/
  contracts only
  local/*
  http/* or supabase/*
```

Pages/features should consume services through a hook/context, or receive them from page-level composition. The smallest first step can be `src/shared/api/services.ts` exporting selected implementations, but a provider is cleaner for tests and runtime switching.

### Backend

Recommended first backend shape:

```text
Browser SPA
  -> API/serverless functions for write flows:
       identify
       submit mission attempt
       save reflection
       mark unlock seen
       leaderboard
  -> optional direct Supabase reads only where RLS is simple

Backend/API
  -> Postgres/Supabase tables
  -> server-side mission evaluation
  -> announcement outbox and Pachca sender
```

If the first backend slice is Supabase-only from browser, keep these writes server-owned anyway:

- mission attempt submission;
- chapter completion;
- badge award creation;
- Pachca/outbox delivery;
- leaderboard aggregation if anti-tamper matters.

Direct browser Supabase writes are acceptable for low-stakes profile/reflection reads/writes after RLS is in place.

## 8. Draft database model

This is intentionally minimal and maps to current domain ids.

```sql
learners (
  id uuid primary key,
  auth_user_id uuid null,
  nickname text not null,
  full_name text null,
  created_at timestamptz not null,
  updated_at timestamptz not null
)

learner_chapter_progress (
  learner_id uuid not null,
  chapter_id text not null,
  status text not null check (status in ('locked', 'open', 'completed')),
  opened_at timestamptz null,
  completed_at timestamptz null,
  pending_unlock_seen_at timestamptz null,
  primary key (learner_id, chapter_id)
)

mission_attempts (
  id uuid primary key,
  learner_id uuid not null,
  chapter_id text not null,
  mission_id text not null,
  answer_json jsonb not null,
  is_correct boolean not null,
  score integer not null,
  content_version text not null,
  client_attempt_id text null,
  created_at timestamptz not null,
  unique (learner_id, client_attempt_id)
)

completed_missions (
  learner_id uuid not null,
  chapter_id text not null,
  mission_id text not null,
  first_completed_at timestamptz not null,
  primary key (learner_id, chapter_id, mission_id)
)

badge_awards (
  id uuid primary key,
  learner_id uuid not null,
  chapter_id text not null,
  badge_name_snapshot text not null,
  completed_chapters integer not null,
  awarded_at timestamptz not null,
  event_id text not null unique,
  unique (learner_id, chapter_id)
)

trap_discoveries (
  learner_id uuid not null,
  trap_id text not null,
  first_seen_at timestamptz not null,
  primary key (learner_id, trap_id)
)

chapter_reflections (
  learner_id uuid not null,
  chapter_id text not null,
  option_id text null,
  option_label text null,
  note text not null default '',
  skipped boolean not null default false,
  updated_at timestamptz not null,
  primary key (learner_id, chapter_id)
)

announcement_deliveries (
  id uuid primary key,
  badge_award_id uuid not null,
  channel text not null,
  status text not null check (status in ('pending', 'dry_run', 'sent', 'failed')),
  idempotency_key text not null unique,
  attempts_count integer not null default 0,
  provider_message_id text null,
  last_error text null,
  created_at timestamptz not null,
  sent_at timestamptz null
)
```

Content can stay static in code for the first backend release. If moved later, add `content_versions`, `chapters`, `missions`, `mission_options/fragments` or store validated JSON configs with stable ids.

## 9. Draft API contracts

Current `ProgressRepository` is useful, but backend mode should prefer command-style writes over client-provided derived results.

```text
GET /api/me
POST /api/learners/identify
  body: { nickname, fullName? }
  returns: { learner }

GET /api/content/chapters
  returns: { chapters, contentVersion }

GET /api/progress
  returns: { learner, progress, encounteredTrapIds, pendingUnlockChapterId }

POST /api/missions/:missionId/attempts
  body: { chapterId, answer, clientAttemptId, contentVersion }
  server:
    validates learner/session
    evaluates mission
    writes mission_attempt
    writes completed_mission if correct
    completes chapter if boss correct and all rules pass
    writes trap_discoveries
    creates badge_award + announcement outbox if first completion
  returns: { evaluation, progress, trapDiscoveries, completion? }

GET /api/chapter-reflections/:chapterId
POST /api/chapter-reflections/:chapterId
  body: { optionId, optionLabel, note, skipped }

GET /api/traps/discovered
GET /api/leaderboard
POST /api/unlocks/:chapterId/seen
```

Optional artifact endpoint:

```text
GET /api/artifacts/:chapterId
  returns markdown artifact generated from server-side template + saved reflection
```

For privacy-first pilot, artifact generation can remain client-side. For multi-device archive or saved downloads, move it server-side.

## 10. Local refactor plan before backend

### Step 1. Add service composition

Create one app-level service registry and replace direct imports in pages/features.

Candidates to change first:

- `src/app/providers/GameStateProvider.tsx`
- `src/pages/mission/MissionPage.tsx`
- `src/pages/badge/BadgePage.tsx`
- `src/pages/closeout/CourseCloseoutPage.tsx`
- `src/pages/field-guide/TrapFieldGuidePage.tsx`
- `src/features/map/lib/useWorldMapState.ts`
- `src/features/leaderboard/lib/useLeaderboardEntries.ts`

Acceptance: switching from `local` to `http` implementation happens in one file/provider.

### Step 2. Split `LocalProgressRepository`

Suggested files:

```text
src/shared/api/progress/local/localProgressStore.ts
src/shared/api/progress/local/localProgressMigrations.ts
src/shared/api/progress/local/localProgressRepository.ts
src/entities/chapter/lib/progressMutations.ts
src/entities/chapter/lib/leaderboardProjection.ts
```

Move pure functions out of browser storage:

- create initial progress from `chapters`;
- unlock next chapter;
- apply successful mission attempt;
- complete chapter idempotently;
- project leaderboard entry.

Acceptance: storage adapter only reads/writes JSON; domain functions are unit-testable without `window`.

### Step 3. Add a mission submit use case

Create `src/features/mission/lib/submitMissionAnswer.ts` or `src/entities/mission/application/submitMissionAnswer.ts`:

```text
input: learner, chapter, mission, answer, state, services
output: evaluation, trapDiscoveries, progress, completion/replay state
```

Both normal submit and `?qa=1` shortcut should call the same orchestration with different answer/evaluation source. This becomes the frontend mirror of the future backend endpoint.

### Step 4. Remove content duplication from repository

Stop maintaining badge/rank/unlock maps inside `LocalProgressRepository`. Derive from `chapters` or inject chapter metadata into the repository/use case. At minimum, store only ids in progress and let UI derive display copy from `chapterCatalog`.

### Step 5. Introduce local store version

Add:

```ts
type ProgressStore = {
  schemaVersion: 1
  ...
}
```

Then add explicit migration/recovery policy. This also prepares a one-time backend import if needed.

### Step 6. Split artifact templates

`LocalArtifactService` should not be a 923-line switch plus template dump. Move each markdown template to either:

- a separate `.ts` template factory per artifact; or
- `.md` template files plus tiny interpolation; or
- content repository artifact templates.

Acceptance: adding an artifact does not require editing one giant service switch beyond a typed registry.

### Step 7. Add domain and repository tests

Add a small unit runner, likely Vitest, unless the team wants to keep Playwright-only. Test targets:

- `evaluateMission` for each mission kind;
- non-leaking failed evaluation shape;
- `chapterProgress` route/unlock helpers;
- `completeChapter` idempotency;
- `ProgressRepository` contract against local and future HTTP/Supabase implementations;
- leaderboard sorting/projection.

## 11. Backend migration sequence

### Phase A. Backend readiness without backend

1. Add service composition boundary.
2. Split progress repository.
3. Add store version and migrations.
4. Add contract/domain tests.
5. Add a `backendMode` feature flag but keep default `local`.

### Phase B. Persistence backend

1. Choose auth mode: invite email, SSO, magic link, or pilot session code.
2. Create DB schema and RLS.
3. Implement `HttpProgressRepository` or `SupabaseProgressRepository`.
4. Start with read/write learner, progress, reflections, traps.
5. Keep local fallback for offline/dev.

### Phase C. Server-authoritative gameplay

1. Implement `submitMissionAttempt` backend endpoint.
2. Reuse or port mission evaluation logic server-side.
3. Make completion/unlock transaction idempotent.
4. Return the same `MissionEvaluation` shape to frontend.
5. Update e2e seeding to use backend fixtures/API in backend mode.

### Phase D. Shared leaderboard and announcements

1. Replace local `getLeaderboard()` with DB aggregate.
2. Add badge award outbox.
3. Add Pachca dry-run mode.
4. Enable live Pachca after idempotency/logging checks.
5. Keep webhook secrets only in backend env vars.

### Phase E. Content/artifacts, only if needed

1. Split content catalog by chapter and add validation script.
2. Optionally move content configs to JSON/DB/CMS.
3. Decide if artifacts stay client-generated or become server-generated downloads.

## 12. Testing strategy for migration

Current e2e coverage is valuable and should stay. Add cheaper tests before backend work:

| Layer | Tests to add | Why |
| --- | --- | --- |
| Domain | Mission evaluation, chapter progress, course closeout | Backend migration depends on identical decisions. |
| Repository contract | `ProgressRepository` behavior over local and backend implementations | Prevent UI from depending on local-only quirks. |
| Backend integration | Attempt submit, completion idempotency, RLS, leaderboard aggregate | Catch multi-user and transaction bugs. |
| E2E local mode | Keep current Playwright suite | Protect existing playable flow. |
| E2E backend mode | Smaller happy path + replay + leaderboard + reflection | Proves real backend wiring without duplicating all layout tests. |
| Security checks | No webhook/secrets in frontend bundle; RLS policies | Protect Pachca/Supabase credentials and user data. |

Important: existing Playwright tests seed `localStorage` directly. Backend mode needs test fixtures that seed via API/DB setup instead of writing `project-z-progress-v1`.

## 13. Decisions needed before implementation

1. Auth model: anonymous pilot session, invite-only email, SSO, or Supabase auth?
2. Identity privacy: do we need `fullName` at all in shared leaderboard, or only nickname/display handle?
3. Data retention: should raw answers be stored forever, summarized, or deleted after scoring?
4. Content source: keep typed TS configs in bundle for v1 backend, or move content to JSON/DB now?
5. Scoring authority: must backend be authoritative from first backend release, or is Supabase persistence behind current client scoring acceptable for a private pilot?
6. Local data migration: discard, manual import, or one-time migration from `localStorage`?
7. Offline/local mode: keep local-first fallback after backend launch, or switch fully to online backend?
8. Pachca timing: send on first badge award only, on course completion, or both?

## 14. Implementation sequence

This is the practical execution order. Treat every item as a small PR/iteration with its own verification, not as one large refactor.

### PR 0. Baseline and audit lock

Goal: prove the current local-first app is green before moving boundaries.

Scope:

- run current checks and record any known failures before refactoring;
- do not change source code;
- keep this audit as the implementation reference.

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:e2e` if local server permissions allow it.

Exit criteria:

- current behavior is known-good, or failures are documented before refactor work starts.

### PR 1. Add domain/contract test runner

Goal: add cheap tests before moving mission/progress logic.

Scope:

- add a small unit test runner, likely Vitest;
- add focused tests for `missionEngine`, `chapterProgress`, course closeout and leaderboard sorting/projection;
- do not refactor production logic yet beyond testability seams that are genuinely tiny.

Why first:

- later PRs will move logic between files; these tests catch behavioral drift faster than full Playwright.

Exit criteria:

- `npm run test:unit` or equivalent exists;
- domain tests cover successful and failed mission evaluation, non-leaking failure details, chapter unlock derivation and completed-course detection.

### PR 2. Introduce service composition

Goal: make implementation choice app-level instead of page/feature-level.

Scope:

- add `AppServicesProvider` / `useAppServices` or a similarly explicit composition root;
- provide `contentRepository`, `progressRepository`, `artifactService`, `announcementService`;
- replace direct imports of `localProgressRepository`, `localArtifactService` and `mockAnnouncementService` in pages/features;
- keep local implementations as the selected default.

Do not:

- change persistence format;
- add backend;
- change UI copy or gameplay behavior.

Exit criteria:

- switching from local to future backend implementation would happen in one provider/composition file;
- all existing routes still use the same local behavior.

### PR 3. Extract mission submit use case

Goal: remove write-flow orchestration from `MissionPage`.

Scope:

- create `submitMissionAnswer` or `missionProgressService` use case;
- move evaluation, attempt save, trap recording, boss completion and announcement trigger into that use case;
- make normal submit and `?qa=1` shortcut use the same orchestration path where possible;
- return a result object suitable for `MissionPage` to render.

Why before repository split:

- this becomes the frontend mirror of the future `POST /api/missions/:missionId/attempts` endpoint.

Exit criteria:

- `MissionPage` mostly handles route guards, render state and passing callbacks;
- completion/replay behavior remains unchanged;
- e2e happy path and replay/badge tests still pass.

### PR 4. Split pure progress mutations from local storage

Goal: make progress behavior testable without `window.localStorage`.

Scope:

- extract pure functions for initial progress, mission completion, chapter completion, unlock derivation and leaderboard projection;
- leave browser storage read/write in the local adapter;
- add/extend tests for idempotent completion, replay, pending unlock and leaderboard projection.

Do not:

- change the external `ProgressRepository` contract yet unless the change is backwards-compatible.

Exit criteria:

- local adapter reads/writes store and delegates behavior to pure functions;
- progress mutation tests do not require browser APIs.

### PR 5. Add local store schema version and migrations

Goal: make local data explicit before backend import/discard decisions.

Scope:

- add `schemaVersion` to `ProgressStore`;
- add migration/recovery functions;
- decide how unknown/corrupt versions behave;
- keep a path for old `project-z-progress-v1` data.

Exit criteria:

- old local store shape still loads or is intentionally reset with documented behavior;
- migration tests cover empty, current and old/corrupt stores.

### PR 6. Remove chapter metadata duplication from repository

Goal: stop storing/displaying chapter content facts from duplicated maps.

Scope:

- remove `badgeNameByChapter` and `rankAfterCompletionByChapter` duplication from progress repository;
- derive display metadata from `chapterCatalog`, injected chapter metadata, or write an explicit badge snapshot at completion;
- keep persistent progress records mostly id-based.

Exit criteria:

- changing a badge/rank in chapter config cannot silently diverge from repository-derived leaderboard/completion display.

### PR 7. Split artifact template registry

Goal: make artifact generation maintainable and backend-portable.

Scope:

- move each markdown artifact template out of the giant `LocalArtifactService` file;
- add a typed registry keyed by artifact id;
- keep browser download behavior unchanged.

Exit criteria:

- adding a new artifact means adding a template module and registry entry, not expanding a 900-line switch.

### PR 8. Introduce backend-ready write contracts

Goal: make the future backend authoritative without rewriting UI again.

Scope:

- add or revise a command-style service contract for mission attempts;
- prefer input `{ chapterId, missionId, answer, clientAttemptId, contentVersion }`;
- response should include `MissionEvaluation`, progress refresh data, trap discoveries and optional completion result;
- keep local implementation behind the same contract.

Exit criteria:

- frontend no longer needs to pass trusted `isCorrect`/`score` into persistence in the future backend path.

### PR 9. Draft DB/RLS/backend ADR before implementation

Goal: lock backend shape before code.

Scope:

- turn the schema/API draft in this audit into an ADR or backend design doc;
- choose auth mode, local-data migration policy, raw answer retention and Pachca timing;
- define RLS/security constraints.

Exit criteria:

- backend implementation can start without reopening core product/security decisions.

### PR 10. Implement first backend persistence slice

Goal: introduce backend storage without server-authoritative gameplay yet, unless the team decides to combine it.

Scope:

- implement identity/progress/reflections/traps read/write;
- keep local implementation available for dev/offline fallback;
- add backend-mode test fixtures.

Exit criteria:

- app can load learner/progress from backend mode and still complete local playable flows in local mode.

### PR 11. Implement server-authoritative mission submit

Goal: move scoring/completion authority to backend.

Scope:

- implement attempt submit endpoint;
- reuse or port deterministic mission evaluation;
- write attempt, completed mission, chapter completion, trap discovery and badge award transactionally;
- return the existing `MissionEvaluation` shape.

Exit criteria:

- frontend submit path can switch to backend endpoint without changing mission UI;
- duplicate boss completion is idempotent.

### PR 12. Add shared leaderboard and announcement outbox

Goal: move multi-user surfaces and integrations server-side.

Scope:

- replace local single-entry leaderboard with backend aggregate;
- add badge award outbox;
- add Pachca dry-run mode first;
- enable live Pachca only after idempotency, logs and retry bounds are verified.

Exit criteria:

- no Pachca secret or webhook URL exists in frontend;
- duplicate/replayed completion does not duplicate announcements.

### PR 13. Optional content/artifact extraction

Goal: reduce authoring friction after core backend is stable.

Scope:

- split `chapterCatalog.ts` by chapter;
- add content validation script;
- decide whether artifacts remain client-generated or move to backend-generated downloads.

Exit criteria:

- content changes become easier to review without changing runtime architecture.

### PR 14. Fix unlock-seen acceptance semantics

Goal: make the one-time map unlock cue safe before backend persistence/cutover.

Scope:

- mark a pending unlock as seen as soon as the map accepts it for reveal;
- keep the visual reveal window local UI state only;
- add regression coverage for reloading `/map` during the reveal window.

Why now:

- the pre-backend regression found that a quick reload during the reveal window could repeat the "one-time" cue;
- backend `unlock_seen` semantics should model acceptance, not animation completion.

Exit criteria:

- first map visit after completion still shows the fresh unlock cue;
- reload during the reveal window does not show it again;
- trap-guide intro waits until the unlock cue has been accepted/cleared from blocking state.

Implementation note, 2026-06-01:

- `chapterCatalog.ts` now remains the stable ordered `chapters` export;
- per-chapter configs live under `src/entities/chapter/model/chapters`;
- common authored feedback/retry patches live in `src/entities/chapter/model/missionFeedback.ts`;
- `npm run validate:content` validates chapter order, ids, mission answer references, boss rounds, prep resources and artifact metadata;
- artifacts remain client-generated downloads through `ArtifactService` and `artifactTemplateRegistry`; backend-generated downloads require a later ADR.
- PR 14 fixed the quick-reload edge by writing `unlock_seen` before starting the transient map reveal animation.

### PR 15. Harden backend-mode cutover smoke

Goal: make the backend-mode path prove the same server-authoritative boundaries before real Supabase cutover.

Scope:

- extend backend-mode Playwright fixture coverage beyond identity/progress/traps/reflections;
- cover a real mission submit through `HttpMissionAttemptService` without client-owned `source`, `score` or `isCorrect`;
- cover backend leaderboard aggregate reads without `fullName`;
- cover backend unlock-seen acceptance so reloads during the reveal window do not replay the cue;
- add API unit coverage for duplicate `clientAttemptId` retries returning the persisted attempt evaluation.

Do not:

- enable live Pachca;
- add frontend secrets;
- require a real Supabase project for the local regression smoke.

Exit criteria:

- `E2E_DATA_MODE=backend npm run test:e2e -- --grep "backend"` covers identify, progress/traps/reflection, mission submit, unlock-seen and leaderboard through `/api/*`;
- duplicate retry semantics are covered at the Netlify API boundary;
- real Supabase/RLS and real-backend e2e remain explicit pre-cutover checks.

Implementation note, 2026-06-01:

- `e2e/backend-mode.spec.ts` now has four backend-mode smoke tests;
- `netlify/functions/api.test.ts` verifies duplicate mission attempt responses use the persisted answer evaluation rather than a retried answer body;
- full unit/lint/typecheck/build and backend-mode e2e passed through the supported-node wrapper; first sandboxed Playwright attempt hit the known `listen EPERM` local-server restriction, then the approved rerun passed after stopping a stale Vite process on `127.0.0.1:5174`.

## 15. Recommended near-term backlog

1. `P0` Add app-level service registry/provider and remove direct local/mock imports from route/feature files.
2. `P0` Extract mission submit orchestration from `MissionPage`.
3. `P0` Split `LocalProgressRepository` into storage adapter + pure progress mutations.
4. `P0` Add store `schemaVersion` and explicit migration policy.
5. `P1` Add unit/contract test runner and tests for mission/progress/repository behavior.
6. `P1` Draft Supabase/Postgres schema and RLS policy in docs before coding.
7. `P1` Implement backend dry-run for badge completion/outbox without Pachca live send.
8. `P2` Done 2026-06-01: split `chapterCatalog.ts` by chapter and add content validation.
9. `P2` Split artifact templates from `LocalArtifactService`.

## 16. Backend extraction map by file

| File | Current responsibility | Candidate action |
| --- | --- | --- |
| `src/shared/api/progress/ProgressRepository.ts` | Persistence contract for learner/progress/traps/reflections/leaderboard | Keep, but consider command-style `submitMissionAttempt` contract or separate `MissionProgressService`. |
| `src/shared/api/progress/localProgressRepository.ts` | Local store, unlock rules, attempts, completions, reflections, leaderboard | Split; later add `HttpProgressRepository` / `SupabaseProgressRepository`. |
| `src/app/providers/GameStateProvider.tsx` | Loads content/learner/progress and exposes state | Inject services; do not import local implementation. |
| `src/pages/mission/MissionPage.tsx` | Route guard, evaluate, persist attempt, complete chapter, announce | Extract submit use case; future backend endpoint replaces local orchestration. |
| `src/features/map/lib/useWorldMapState.ts` | Map UI state + pending unlock repository calls | Inject repository; keep avatar/selection local; optionally persist unlock seen server-side. |
| `src/features/leaderboard/lib/useLeaderboardEntries.ts` | Loads leaderboard from progress repo and sorts | Keep hook; backend repo returns multi-user rows. |
| `src/pages/field-guide/TrapFieldGuidePage.tsx` | Loads encountered traps | Keep UI; backend persists trap discoveries. |
| `src/pages/badge/BadgePage.tsx` | Loads/saves reflection, creates artifact, browser download | Inject services; backend can store reflections first, artifact generation later. |
| `src/pages/closeout/CourseCloseoutPage.tsx` | Loads all reflections, creates all artifacts, browser download | Keep route; backend can batch reflections/artifacts later. |
| `src/shared/api/announcements/mockAnnouncementService.ts` | Mock badge announcement preview | Replace with backend-owned outbox sender; frontend should not know Pachca status. |
| `src/shared/api/content/staticContentRepository.ts` | Bundled chapter catalog | Keep initially; add backend/content implementation only if content needs runtime editing. |
| `src/entities/mission/lib/missionEngine.ts` | Deterministic grading | Keep pure; reuse or port server-side for authoritative attempt submit. |
| `src/entities/chapter/model/chapterCatalog.ts` | All chapter/prep/mission/reward/artifact configs | Split/validate; optional DB/CMS later. |
| `e2e/project-z.spec.ts` | User-flow/layout coverage with localStorage fixtures | Keep for local mode; add backend-mode seeding path. |

## 17. Final recommendation

Do not start by adding Supabase calls inside pages. Project Z is already close to the right shape; the missing piece is not "database code", it is a clean service boundary and server-authoritative submit/completion flow.

The best first PR is a refactor-only PR:

1. Introduce `AppServicesProvider`.
2. Move all local/mock implementation choice into one composition file.
3. Extract `submitMissionAnswer`.
4. Add contract tests around local behavior.

After that, backend work becomes additive: implement the same contracts over DB/API, switch by flag, and keep the game UI stable.
