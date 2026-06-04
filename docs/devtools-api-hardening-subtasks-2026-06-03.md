# DevTools/API Hardening Subtasks

Дата: 2026-06-03

## Summary

Разбить hardening Project Z против обходов через DevTools и прямые API-запросы
на независимые сабтаски. Scope: серверные гейты для identity, progress, mission
start/submit, reflections и unlock state. Не скрываем весь будущий контент из
`/api/content`/bundle. QA режим оставляем как есть.

## Общий порядок

1. Зафиксировать текущую поверхность и контракты ошибок.
2. Усилить server-side identity contract.
3. Унифицировать progression gates для mission start и mission submit.
4. Закрыть reflection/unlock мутации для недоступных глав.
5. Добавить regression tests на прямые API bypass сценарии.
6. Прогнать focused backend tests и e2e smoke.

## DHA-00. Baseline Bypass Inventory

Goal: зафиксировать текущие обходы без правок.

Implementation:

- Проверить прямые запросы к `/api/progress`, `/api/learners/identify`,
  `/api/missions/:id/start`, `/api/missions/:id/attempts`,
  `/api/chapter-reflections/:chapterId`, `/api/unlocks/:chapterId/seen`.
- Подтвердить, какие проверки уже есть в `server/backend/api.ts` и
  `server/db/postgresProjectZDatabase.ts`.
- Зафиксировать текущие коды ошибок для no session, no learner, locked chapter,
  locked mission.

Acceptance:

- Есть список bypass vectors и текущих expected/actual outcomes.
- Код не изменен.

Prompt:

```text
Выполни DHA-00: сделай baseline inventory DevTools/API bypass surface Project Z. Проверь protected API routes, existing backend/db gates and current error contracts. Код не меняй; дай список exact gaps для DHA-01..DHA-04.
```

Result 2026-06-03:

- Verification: `npm run test:unit -- server/backend/api.test.ts server/db/postgresProjectZDatabase.test.ts`
  passed (`2` files, `53` tests). Source code was not changed for DHA-00.
- `/api/progress`: protected. Missing pilot session returns `401`
  `Нужно открыть пилотную сессию.` Existing session without learner maps DB
  `learner_not_identified` to `409` `Нужно представиться перед продолжением.`
- `/api/learners/identify`: missing session auto-creates pilot session as intended.
  `nickname` is required, but `fullName` is optional today. Direct API can create
  a learner with `full_name = null`, returned as `fullName: ''`.
- `/api/missions/:id/start`: API validates content version and that
  `chapterId`/`missionId` exist in catalog, then DB only checks active session and
  identified learner. It does not check chapter status or previous completed
  missions, so direct requests can write `mission_starts` for locked chapters or
  skipped scenes. This also affects suspicious-signal telemetry because attempts
  read `mission_starts`.
- `/api/missions/:id/attempts`: already server-gated. API ignores client-owned
  derived fields and DB requires active learner, open/completed chapter, and
  completed previous missions. DB errors map to current contracts:
  `chapter_not_open` -> `409` `Глава ещё закрыта.`, `mission_not_open` -> `409`
  `Сцена ещё закрыта.`
- `/api/chapter-reflections/:chapterId`: protected only by active identified
  learner. There is no known/completed chapter gate. Locked or unknown chapter
  read returns `200` with `reflection: null`; write can upsert a reflection for
  the requested `chapterId`.
- `/api/unlocks/:chapterId/seen`: protected only by active identified learner.
  DB calls `ensureLearnerProgress` and then updates by `chapterId` without a
  status gate. Locked known chapter can mutate `unlock_seen_at`; unknown chapter
  is currently a `200` no-op.

Exact gaps for follow-up tasks:

- DHA-01: require nonblank `fullName` in API and Postgres boundary; add
  `full_name_required` API error mapping; keep identify auto-create session
  behavior.
- DHA-02: extend `RecordMissionStartInput` with `chapterIds`, `firstChapterId`,
  and `requiredPreviousMissionIds`; pass `getChapterAndMission` context from API;
  reject locked chapters and unopened missions before inserting `mission_starts`.
- DHA-03: require completed known chapter for reflection read/write; require known
  `open` or `completed` chapter for unlock seen; avoid mutating
  `learner_chapter_progress` for locked/unknown chapters; add
  `chapter_not_completed` mapping if introduced.
- DHA-04: add regression tests for direct API bypasses and Postgres no-write
  boundaries: missing/blank `fullName`, locked mission start, skipped previous
  mission start, locked/unknown reflection read/write, locked/unknown unlock seen.

## DHA-01. Required Full Identity

Goal: нельзя создать агента без полного профиля через прямой API.

Implementation:

- В `POST /api/learners/identify` требовать оба поля: `nickname` и `fullName`.
- В `PostgresProjectZDatabase.identifyLearner` нормализовать оба поля и
  отклонять пустой `fullName`.
- Добавить `full_name_required` mapping в API error mapper.
- Не менять auto-create pilot session behavior.

Acceptance:

- Missing/blank `nickname` возвращает `400`.
- Missing/blank `fullName` возвращает `400`.
- Валидная identity форма продолжает создавать learner и initial progress.

Prompt:

```text
Выполни DHA-01: сделай fullName обязательным server-side для /api/learners/identify. Обнови Postgres boundary, API error mapping и tests. Не меняй session auto-create behavior.
```

Result 2026-06-03:

- `/api/learners/identify` now requires nonblank `nickname` and `fullName`;
  missing/blank values return `400` before `identifyLearner` is called.
- `ProjectZDatabase.identifyLearner` now exposes `fullName: string` at the
  server interface boundary, while `PostgresProjectZDatabase.identifyLearner`
  still defensively normalizes and rejects `null`/blank direct inputs with
  `full_name_required` before touching Postgres.
- API maps DB `full_name_required` to `400` `Нужно указать имя и фамилию.`
- Identify auto-create session behavior for valid requests is unchanged.
- Verification passed:
  `npm run test:unit -- server/backend/api.test.ts server/db/postgresProjectZDatabase.test.ts`
  (`2` files, `56` tests), `npm run typecheck`, `npm run lint`, `npm run build`.

## DHA-02. Mission Start Progression Gate

Goal: прямой `POST /api/missions/:missionId/start` не должен регистрировать
старт закрытой сцены.

Implementation:

- Расширить DB input для `recordMissionStart`: `chapterIds`, `firstChapterId`,
  `requiredPreviousMissionIds`.
- В API для mission start переиспользовать `getChapterAndMission`.
- В DB перед insert проверять:
  - learner identified;
  - chapter status `open` или `completed`;
  - если chapter не completed, все previous required missions completed.
- Ошибки `chapter_not_open` и `mission_not_open` мапятся в existing `409`.

Acceptance:

- Locked chapter start не вставляет `mission_starts`.
- Skipped previous mission start не вставляет `mission_starts`.
- Valid start still returns `{ startedAt }`.

Prompt:

```text
Выполни DHA-02: добавь progression gate в recordMissionStart, matching submitMissionAttempt gates. API должен передавать requiredPreviousMissionIds, DB не должна писать start для locked chapter или unopened mission.
```

Result 2026-06-03:

- `RecordMissionStartInput` now carries `chapterIds`, `firstChapterId`, and
  `requiredPreviousMissionIds`, and `/api/missions/:missionId/start` passes the
  same catalog-derived `getChapterAndMission` context used by mission submit.
- `PostgresProjectZDatabase.recordMissionStart` now runs inside a transaction:
  it touches the active session, requires an identified learner, seeds/checks
  learner progress, rejects non-`open`/`completed` chapters with
  `chapter_not_open`, and rejects missing previous mission completions with
  `mission_not_open` before inserting `mission_starts`.
- Regression coverage proves valid starts still return `{ startedAt }`, locked
  chapter starts roll back without a `mission_starts` insert, and skipped
  previous mission starts roll back without a `mission_starts` insert.
- Verification passed:
  `npm run test:unit -- server/backend/api.test.ts server/db/postgresProjectZDatabase.test.ts`,
  `npm run test:unit -- server/nodeApiParity.test.ts`, `npm run typecheck`,
  `npm run lint`, `npm run test:unit`, `npm run build:server`.

## DHA-03. Reflection And Unlock State Gates

Goal: прямые API-запросы не должны читать/писать reward/reflection/unlock state
для недоступных глав.

Implementation:

- `getChapterReflection` и `saveChapterReflection` требуют completed chapter.
- `markUnlockSeen` требует known chapter со статусом `open` или `completed`.
- Unknown/locked chapter не должен мутировать `learner_chapter_progress`.
- Добавить error mapping для `chapter_not_completed` при необходимости.

Acceptance:

- Reflection read/save для locked/open-but-not-completed chapter возвращает
  blocked error.
- Unlock seen для locked/unknown chapter не меняет progress.
- Completed reflection flow and valid unlock seen continue working.

Prompt:

```text
Выполни DHA-03: добавь DB gates для chapter reflections и markUnlockSeen. Reflections доступны только completed chapters; unlock seen мутирует только known open/completed chapter. Покрой tests.
```

Result 2026-06-04:

- `ProjectZDatabase.getChapterReflection` and `saveChapterReflection` now carry
  catalog `chapterIds`; `/api/chapter-reflections/:chapterId` passes the active
  catalog context into the DB boundary.
- `PostgresProjectZDatabase` requires a known `completed` chapter before reading
  or upserting `chapter_reflections`; blocked reads/writes throw
  `chapter_not_completed` before touching the reflections table.
- `markUnlockSeen` now checks the requested chapter is known and already
  `open`/`completed` before any progress mutation; locked/unknown chapters throw
  `chapter_not_open` without `learner_chapter_progress` writes.
- API maps DB `chapter_not_completed` to `409`
  `Глава ещё не завершена.`
- Verification passed:
  `npm run test:unit -- server/backend/api.test.ts server/db/postgresProjectZDatabase.test.ts`
  (`2` files, `62` tests), `npm run test:unit -- server/nodeApiParity.test.ts`,
  `npm run typecheck`, `npm run lint`, `npm run build:server`,
  `npm run build`.

## DHA-04. Direct API Regression Tests

Goal: зафиксировать DevTools/API bypass сценарии тестами.

Implementation:

- Добавить backend API tests на:
  - identify without fullName;
  - progress before identity;
  - mission start locked chapter;
  - mission attempt locked mission;
  - reflection before completion;
  - unlock seen locked chapter.
- Добавить Postgres boundary tests на rollback/no insert для gated writes.
- Если fixture e2e покрывает direct API, добавить один browser-level smoke for
  direct locked submit response.

Acceptance:

- Tests fail against old behavior for at least identity fullName, mission start
  gate, and reflection/unlock gates.
- Existing mission submit malicious payload tests stay green.
- No QA mode behavior changes.

Prompt:

```text
Выполни DHA-04: добавь regression tests for DevTools/API bypasses after DHA-01..DHA-03. Покрой backend API and Postgres boundary; keep QA behavior unchanged.
```

Result 2026-06-04:

- `server/backend/api.test.ts` now covers the DHA-00 direct API bypass
  outcomes for missing pilot session on progress, missing/blank `fullName`,
  locked chapter mission starts, skipped previous-mission starts, locked chapter
  attempts, incomplete reflection reads/writes, and locked/unknown unlock-seen
  writes.
- `server/db/postgresProjectZDatabase.test.ts` now explicitly covers rollback/no
  insert for locked-chapter mission attempts and no reflection upsert for
  open/locked/unknown chapters, alongside the existing mission-start,
  previous-mission, reflection-read, and unlock-seen no-write gates.
- `e2e/backend-api.spec.ts` adds a browser-level backend fixture smoke for a
  direct unopened mission submit returning the blocked response without mutating
  progress. QA pass behavior and production code were not changed.
- Verification passed:
  `npm run test:unit -- server/backend/api.test.ts server/db/postgresProjectZDatabase.test.ts server/nodeApiParity.test.ts`
  (`3` files, `81` tests), `npm run typecheck`, `npm run lint`, and
  `npm run test:e2e -- e2e/backend-api.spec.ts` (`5` tests). The e2e command
  needed elevated sandbox permissions because the default sandbox blocked the
  local dev server bind on `127.0.0.1`.

## DHA-05. Verification Pass

Goal: подтвердить hardening без регрессий основного flow.

Implementation:

- Запустить focused tests:
  - `npm test -- server/backend/api.test.ts`
  - `npm test -- server/db/postgresProjectZDatabase.test.ts`
  - `npm test -- src/shared/api/progress`
  - `npm test -- src/shared/api/missions`
- Запустить relevant e2e backend API smoke if available.
- Проверить, что ordinary learner flow still works with both identity fields.

Acceptance:

- Focused tests green.
- Нет изменений QA shortcuts / `PROJECT_Z_QA_PASS`.
- В final report перечислены protected routes and residual out-of-scope content
  visibility.

Prompt:

```text
Выполни DHA-05: прогон focused verification для DevTools/API hardening. Запусти backend/db/service tests and relevant e2e smoke. Код меняй только если tests показывают regression from DHA changes.
```

Result 2026-06-04:

- Focused unit verification passed:
  `npm run test:unit -- server/backend/api.test.ts` (`39` tests),
  `npm run test:unit -- server/db/postgresProjectZDatabase.test.ts`
  (`30` tests), `npm run test:unit -- src/shared/api/progress`
  (`3` tests), and `npm run test:unit -- src/shared/api/missions`
  (`2` tests).
- Relevant backend API e2e smoke passed:
  `npm run test:e2e -- e2e/backend-api.spec.ts` (`5` tests), including the
  ordinary fresh learner identify flow with both identity fields and the direct
  unopened mission submit blocked response.
- The repo's `npm test -- <unit-file>` currently delegates to Playwright e2e,
  so the first sandboxed attempt hit the known local dev server bind restriction
  (`listen EPERM` on `127.0.0.1:5174`). The e2e smoke passed after rerunning
  with local bind permission.
- No production code changes were needed. QA shortcuts / `PROJECT_Z_QA_PASS`
  were not changed.
- Protected routes covered by the hardening pass: `/api/progress`,
  `/api/learners/identify`, `/api/missions/:missionId/start`,
  `/api/missions/:missionId/attempts`, `/api/chapter-reflections/:chapterId`,
  and `/api/unlocks/:chapterId/seen`.
- Residual out-of-scope visibility from DHA-00 remains by design: public future
  chapter/mission content can still be visible through `/api/content` and browser
  assets; this pass protects server-owned state changes and progression, not full
  content secrecy.

## Assumptions

- Полный профиль агента означает обязательные `nickname` и `fullName`.
- Защита в этом pass предотвращает protected state changes/progression, но не
  скрывает весь public content из browser assets.
- `?qa=1` и `PROJECT_Z_QA_PASS` остаются без изменений.
