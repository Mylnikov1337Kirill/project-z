# QA PASS Build-Flag Subtasks

Дата: 2026-06-03

## Status

- QAP-07 выполнен 2026-06-03: `README.md` документирует opt-in QA PASS flags
  для dev, focused e2e and production-like local Docker/nginx QA;
  `deploy/docker-compose.yml` прокидывает `PROJECT_Z_QA_PASS` в API service with
  empty default, so default dev/prod commands remain without QA PASS. Boundary:
  `VITE_PROJECT_Z_QA_PASS` controls only browser UI visibility, while
  `PROJECT_Z_QA_PASS` remains server-side endpoint authority.
- QAP-05 выполнен 2026-06-03: `server/backend/api.ts` добавляет
  `PROJECT_Z_QA_PASS`-gated `POST /api/missions/:missionId/qa-pass`, скрытый
  как existing 404 без server flag. Endpoint генерирует answer через
  `server/backend/qaPassAnswer.ts`, переиспользует normal submit persistence /
  completion / progress response flow, пропускает normal mission attempt rate
  limits, and keeps duplicate `clientAttemptId` semantics.

## Цель

Добавить QA-only кнопку `QA PASS` на миссиях Project Z. Кнопка видна только в
QA-сборке через `VITE_PROJECT_Z_QA_PASS=1`; фактический force-pass выполняется
backend-only endpoint через `PROJECT_Z_QA_PASS=1`, без возврата answer keys в
browser bundle.

Threat model: опубликованный сайт не должен раскрывать корректные ответы через
DOM, public content API или `dist/assets`. QA PASS нужен только для ручного QA и
автоматизированных проверок в явно включенном QA runtime.

## Общий порядок

Выполнять задачи по порядку:

1. Зафиксировать текущую поверхность.
2. Добавить browser-safe QA flag и сервисный контракт.
3. Добавить UI кнопку.
4. Добавить server-only генератор корректного ответа.
5. Добавить QA-only backend endpoint.
6. Покрыть e2e и документацией.

Не возвращать browser-owned scoring, local mission submit path или
client-side answer generation. `?qa=1` остается shortcut для навигации/prep, но
сам по себе не дает force-pass authority.

## Non-negotiable target state

- Browser submit по обычному пути отправляет только raw answer, stable ids,
  content version и idempotency key.
- `QA PASS` кнопка не появляется без `VITE_PROJECT_Z_QA_PASS=1`.
- QA force-pass endpoint не работает без `PROJECT_Z_QA_PASS=1`.
- Correct answer generation живет только в server/test code.
- `dist/assets` не содержит answer-key markers:
  - `isCorrect`
  - `correctOrder`
  - `acceptedFragmentIds`
  - `passingScore`
- Existing backend-only boundary остается главным источником score, completion,
  unlocks, trap discovery, badge awards and announcement outbox writes.

## QAP-00. Baseline Inventory

Goal: зафиксировать текущую QA/submit/security поверхность без правок.

Implementation:

- Проверить текущие точки:
  - `src/shared/lib/routing/useQaShortcutsEnabled.ts`
  - `src/pages/mission/MissionPage.tsx`
  - `src/features/mission/ui/MissionScene.tsx`
  - `src/shared/api/missions/MissionAttemptService.ts`
  - `src/shared/api/missions/httpMissionAttemptService.ts`
  - `server/backend/api.ts`
  - `e2e/backendApiFixtures.ts`
  - `scripts/check-browser-bundle-answer-keys.mjs`
- Подтвердить, что обычный submit отправляет только raw answer and stable
  attempt identifiers.
- Подтвердить, что browser bundle guard запрещает private answer markers в
  `dist/assets`.
- Составить короткий список файлов для QAP-01..QAP-07.

Acceptance:

- Есть список runtime/test/doc files, которые будут touched следующими
  сабтасками.
- Код не изменен.

Prompt:

```text
Выполни QAP-00 из docs/qa-pass-build-flag-subtasks.md: сделай baseline inventory QA PASS surface. Проверь QA shortcuts, mission submit, backend API, e2e fixture и browser bundle guard. Код не меняй; дай список файлов для следующих задач.
```

## QAP-01. Client QA Flag

Goal: добавить browser-safe флаг видимости QA PASS.

Implementation:

- Добавить helper `useQaPassEnabled()` на базе
  `import.meta.env.VITE_PROJECT_Z_QA_PASS === '1'`.
- Держать env access в одном helper, не размазывать `import.meta.env` по pages
  and features.
- Обновить `useQaShortcutsEnabled()` так, чтобы QA-pass build сохранял
  существующие prep/link shortcuts без необходимости вручную добавлять `?qa=1`.
- Не делать `?qa=1` эквивалентом force-pass.

Acceptance:

- Без env флага поведение не меняется.
- `?qa=1` сам по себе не включает `QA PASS`.
- `VITE_PROJECT_Z_QA_PASS=1` включает QA-pass UI eligibility and preserves QA
  link behavior.

Prompt:

```text
Выполни QAP-01 из docs/qa-pass-build-flag-subtasks.md: добавь browser-safe useQaPassEnabled helper и обнови useQaShortcutsEnabled так, чтобы QA-pass build сохранял prep/link shortcuts. Не добавляй force-pass authority через ?qa=1.
```

## QAP-02. Mission Service Contract

Goal: добавить отдельный QA-pass метод без answer payload.

Implementation:

- Расширить `MissionAttemptService` методом `submitQaPassMissionAttempt`.
- Команда должна принимать только:
  - `chapterId`
  - `missionId`
  - `contentVersion`
  - `clientAttemptId`
- В `HttpMissionAttemptService` отправлять
  `POST /api/missions/:missionId/qa-pass`.
- Не менять shape обычного `submitMissionAttempt`.
- Обновить `httpMissionAttemptService.test.ts`.

Acceptance:

- Unit test доказывает: normal submit всё ещё отправляет только raw
  answer/idempotency fields.
- QA-pass submit не отправляет `answer`.
- Browser service contract не содержит `source`, `isCorrect`, `score` или
  client-owned derived fields.

Prompt:

```text
Выполни QAP-02 из docs/qa-pass-build-flag-subtasks.md: расширь MissionAttemptService отдельным submitQaPassMissionAttempt без answer payload. Http service должен POSTить /api/missions/:id/qa-pass, а normal submit shape не должен измениться.
```

## QAP-03. Mission UI Button

Goal: показать кнопку `QA PASS` на каждой сцене только в QA-pass build.

Implementation:

- В `MissionPage` получить `qaPassEnabled` через helper из QAP-01.
- Добавить `handleQaPassSubmit`, который вызывает
  `missionAttemptService.submitQaPassMissionAttempt`.
- Переиспользовать существующую логику `isSubmitting`, `onProgressChange`,
  `resultState`, replay badge handoff and `wasChapterCompletedBeforeSubmit`.
- Передать `qaPassEnabled` and `onQaPassSubmit` в `MissionScene`.
- В `MissionScene` отрендерить кнопку `QA PASS` рядом с mission actions.
- Disabled state: `isSubmitting` или `Boolean(result?.passed)`.
- Сохранить существующие visual/layout classes and mobile behavior; не
  возвращать удаленный `.pixel-button-qa`, если достаточно existing button
  variants.

Acceptance:

- Default runtime скрывает `QA PASS`.
- QA-pass build показывает кнопку на regular mission и boss mission.
- Кнопка вызывает service method once per click and disables while submitting.
- Existing answer submit/reset behavior не меняется.

Prompt:

```text
Выполни QAP-03 из docs/qa-pass-build-flag-subtasks.md: добавь QA PASS кнопку в MissionPage/MissionScene только при qaPassEnabled. Кнопка должна вызывать submitQaPassMissionAttempt, переиспользовать текущий result/progress flow и не менять обычный submit.
```

## QAP-04. Server QA Answer Generator

Goal: генерировать корректные ответы server-only.

Implementation:

- Добавить server-only helper `server/backend/qaPassAnswer.ts`.
- Экспортировать `createQaPassAnswer(mission)` или эквивалент.
- Покрыть mission kinds:
  - `scenario-decision`: первый correct option id.
  - `chip-picker`: все correct chip ids within budget.
  - `chip-ordering`: `correctOrder`.
  - `pair-matching`: accepted target id for every item.
  - `prompt-assembly`: accepted non-trap fragment for every required slot,
    без duplicate fragment reuse.
  - `boss-fight`: answer map по всем rounds.
- Если для миссии невозможно собрать deterministic passing answer, helper
  должен бросать server-side error с безопасным текстом для логов/tests.
- Не импортировать helper в browser runtime.

Acceptance:

- Unit test прогоняет все миссии private catalog через generated answer and
  `evaluateMission` and gets pass.
- Browser bundle guard не видит answer-key markers в `dist/assets`.
- TypeScript не требует расширять public mission types для QA answer generator.

Prompt:

```text
Выполни QAP-04 из docs/qa-pass-build-flag-subtasks.md: добавь server-only qaPassAnswer helper, который генерирует passing answer для всех mission kinds и boss rounds. Покрой unit test через private catalog + evaluateMission. Не импортируй helper в browser runtime.
```

## QAP-05. QA-Pass API Endpoint

Goal: добавить backend-only force-pass endpoint.

Implementation:

- В `server/backend/api.ts` добавить route
  `POST /api/missions/:missionId/qa-pass`.
- Если `PROJECT_Z_QA_PASS !== '1'`, вернуть existing not-found style response
  and do not touch DB.
- Если enabled:
  - require pilot session;
  - read `chapterId`, `contentVersion`, `clientAttemptId`;
  - check `contentVersion`;
  - resolve chapter/mission through private catalog;
  - preserve chapter/mission gates through existing DB boundary;
  - generate correct answer through QAP-04 helper;
  - persist through the same submit/completion/progress orchestration as normal
    attempts.
- Extract shared submit persistence helper if needed to avoid duplicated
  completion/trap/result response code.
- Skip normal mission-attempt rate limits for this QA-only endpoint so manual QA
  can click through a route quickly.
- Keep duplicate `clientAttemptId` semantics equivalent to normal submit.

Acceptance:

- Disabled endpoint returns not found and does not call `db.submitMissionAttempt`.
- Enabled endpoint writes a passed attempt through DB boundary.
- Locked mission remains locked.
- Stale content still returns 409.
- Response shape matches normal submit response.

Prompt:

```text
Выполни QAP-05 из docs/qa-pass-build-flag-subtasks.md: добавь PROJECT_Z_QA_PASS gated POST /api/missions/:id/qa-pass. Endpoint должен генерировать answer server-side и переиспользовать normal persistence/completion/progress response flow, но быть полностью hidden когда env flag выключен.
```

## QAP-06. E2E And Fixture Coverage

Goal: покрыть видимость и кликабельность QA PASS.

Implementation:

- Добавить e2e default assertion: без `VITE_PROJECT_Z_QA_PASS=1` кнопка
  `QA PASS` не видна на mission scene.
- Добавить e2e QA assertion: с `VITE_PROJECT_Z_QA_PASS=1` кнопка видна и
  проходит regular mission.
- Добавить e2e QA assertion для boss scene.
- Обновить `e2e/backendApiFixtures.ts`, чтобы fixture поддерживал
  `/api/missions/:id/qa-pass` только когда test env включает
  `PROJECT_Z_QA_PASS=1`.
- Existing tests that use `?qa=1` should continue to work without relying on
  browser-side answer authority.

Acceptance:

- QA e2e не зависит от browser-side answer keys.
- Existing e2e with `?qa=1` не ломаются.
- Focused QA PASS e2e passes.
- Full e2e remains compatible with default non-QA mode.

Prompt:

```text
Выполни QAP-06 из docs/qa-pass-build-flag-subtasks.md: добавь Playwright coverage для default hidden QA PASS и QA env clickable pass на regular + boss mission. Обнови backendApiFixtures для QA-pass endpoint без client-side answer keys.
```

## QAP-07. Docs And Runtime Wiring

Goal: оставить агентам и QA понятный запуск.

Implementation:

- Обновить README или добавить короткий QA section в этот документ с командами:
  - `VITE_PROJECT_Z_QA_PASS=1 PROJECT_Z_QA_PASS=1 npm run dev`
  - `VITE_PROJECT_Z_QA_PASS=1 PROJECT_Z_QA_PASS=1 npm run test:e2e -- --grep "QA PASS"`
- При необходимости прокинуть `PROJECT_Z_QA_PASS` в `deploy/docker-compose.yml`
  для production-like local QA.
- Не делать QA mode default ни для dev, ни для prod.
- Если добавляется npm script, назвать его явно, например `dev:qa-pass`, and keep
  default `npm run dev` clean.

Acceptance:

- QA запуск документирован.
- Default commands remain production-safe.
- `PROJECT_Z_QA_PASS` is server-side only; `VITE_PROJECT_Z_QA_PASS` controls
  only browser UI visibility.

Prompt:

```text
Выполни QAP-07 из docs/qa-pass-build-flag-subtasks.md: задокументируй QA PASS runtime flags and, if needed, прокинь PROJECT_Z_QA_PASS в local Docker runtime. Default dev/prod commands должны остаться без QA PASS.
```

## Финальная проверка

После завершения цепочки выполнить:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run build:server
```

Дополнительно:

- focused QA PASS e2e;
- security check по `dist/assets`;
- убедиться, что default runtime hides `QA PASS`;
- убедиться, что QA runtime can complete representative regular and boss
  scenes.

## Assumptions

- Visible button label: `QA PASS`.
- `?qa=1` stays a navigation/prep shortcut, not force-pass authority.
- Private answer keys may exist in server bundle, never in browser assets.
- QA PASS attempts may write normal progress in QA runtime; production runtime
  cannot call this path because both client and server flags are off by default.
