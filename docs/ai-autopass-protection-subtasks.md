# Сабтаски защиты от AI-автопрохождения

Дата: 2026-06-02

## Цель

Разбить план защиты Project Z от AI-автопрохождения на независимые агентские
сабтаски, которые можно запускать в отдельных чатах.

Threat model для этой разбивки: опубликованный сайт без доступа агента к
репозиторию. Главная цель первого прохода -- закрыть сценарий, где агент
открывает deployed web app, читает ответы из DOM/browser bundle/API и быстро
проходит курс.

## Общий порядок

Выполнять задачи по порядку:

1. Закрыть утечку answer keys в browser bundle.
2. Добавить rate limiting на попытки и создание сессий.
3. Добавить suspicious telemetry и trusted leaderboard policy.

Не считать minification/obfuscation защитой. `dist-server` может содержать
server-only scoring config; `dist/assets` не должен содержать answer-key поля.

## AZP-00. Baseline Security Inventory

Goal: зафиксировать текущую поверхность утечки без правок.

Implementation:

- Проверить `src`, `server`, `dist`, `dist-server` на answer-key leakage.
- Найти приватные поля в frontend source/bundle:
  - `isCorrect`
  - `correctOrder`
  - `acceptedFragmentIds`
  - `passingScore`
- Найти frontend-файлы, которым нужны публичные замены этих полей.
- Проверить текущие backend gates для submit/progress.

Acceptance:

- Есть список приватных полей в frontend source/bundle.
- Есть список frontend-файлов, которым нужны public-contract изменения.
- Есть подтверждение, что submit/scoring/progress уже backend-owned или список
  исключений.
- Код не изменён.

Prompt:

```text
Выполни AZP-00: сделай baseline inventory AI-autopass уязвимостей Project Z. Проверь src/server/dist на answer-key leakage, frontend usage приватных полей и текущие backend gates. Код не меняй; дай список файлов и следующий порядок работ.
```

## AZP-01. Public Mission Contract

Goal: ввести browser-safe типы контента.

Implementation:

- Разделить доменные типы миссий на public browser contract и private
  authored/scoring contract.
- Убрать из public contract:
  - `isCorrect`
  - `correctOrder`
  - `acceptedFragmentIds`
  - `passingScore`
  - trap ids/labels для невыбранных ответов
- Добавить публичный `targetCount` для `chip-ordering`, чтобы UI не читал
  `correctOrder.length`.
- Не менять scoring behavior в этой задаче.

Acceptance:

- Появились `PublicChapter` / `PublicMission` или эквивалентный публичный
  контракт.
- В публичном контракте нет answer-key полей.
- Ordering UI может определить количество позиций через публичное поле.
- TypeScript не требует приватные поля в browser-facing компонентах.

Prompt:

```text
Выполни AZP-01: раздели доменные типы миссий на public browser contract и private authored/scoring contract. Не меняй scoring. Добавь targetCount для chip-ordering public UI вместо correctOrder.length.
```

## AZP-02. Public Content Projection

Goal: отдавать клиенту только очищенный каталог.

Implementation:

- Добавить public projection для chapter catalog.
- Перевести `StaticContentRepository` на возврат browser-safe public catalog.
- Перевести UI на public поля.
- Оставить server scoring через private authored catalog.
- Расширить content validation, чтобы public projection и private authored
  content были согласованы.

Acceptance:

- `StaticContentRepository` возвращает только public catalog.
- UI компилируется и не обращается к приватным полям.
- `npm run validate:content` проверяет соответствие public projection и
  private authored content.

Prompt:

```text
Выполни AZP-02: сделай public projection для chapter catalog. Клиентский ContentRepository должен возвращать только browser-safe контент; UI переведи на public поля. Scoring пока оставь серверу через существующий private catalog.
```

## AZP-03. Server-Only Evaluation Boundary

Goal: убрать импорт evaluator/private mission types из browser runtime.

Implementation:

- Отделить server-only mission evaluation boundary.
- Сделать так, чтобы `evaluateMission` и answer-key поля использовались только
  server/test/content-validation путями.
- Оставить browser `MissionAttemptService` только с shape ответа и результата.
- Убрать frontend runtime imports private mission config/evaluator.

Acceptance:

- Browser runtime не импортирует `evaluateMission`.
- Browser runtime не импортирует private mission config.
- Submit API продолжает оценивать ответы на сервере.
- Mission result UI продолжает использовать server-returned evaluation.

Prompt:

```text
Выполни AZP-03: отдели server-only mission evaluation boundary. Browser runtime не должен импортировать evaluateMission или private mission config; submit API продолжает оценивать ответы на сервере.
```

## AZP-04. Bundle Leakage Regression

Goal: зафиксировать защиту тестом.

Implementation:

- Добавить CI-friendly regression check для production browser bundle.
- Проверять `dist/assets` после build на answer-key markers:
  - `isCorrect`
  - `correctOrder`
  - `acceptedFragmentIds`
  - `passingScore`
- Интегрировать проверку в существующий workflow через unit/script test или
  отдельный npm script.

Acceptance:

- После `npm run build` security check падает, если `dist/assets` содержит
  answer-key markers.
- Проверка не сканирует `dist-server` как ошибку.
- Проверка может запускаться без ручной инспекции bundle.

Prompt:

```text
Выполни AZP-04: добавь regression check, что production browser bundle не содержит answer-key markers. Интегрируй проверку в существующий test/build workflow без ручной инспекции dist.
```

## AZP-05. Submit Rate Limiting

Goal: ограничить быстрый перебор ответов.

Implementation:

- Добавить backend rate limiting для
  `POST /api/missions/:missionId/attempts`.
- Политика:
  - `8` попыток в минуту на `pilotSessionId + missionId`;
  - `20` попыток за 10 минут на `pilotSessionId`;
  - желательно дополнительно учитывать IP hash из forwarded headers.
- При превышении возвращать `429` с `retryAfterSeconds`.
- Не раскрывать внутренние rate-limit детали больше необходимого.

Acceptance:

- Submit возвращает `429` с понятным error message и `retryAfterSeconds`.
- Unit/API tests покрывают нормальный submit, превышение лимита и reset окна.
- Duplicate `clientAttemptId` behavior не ломается.

Prompt:

```text
Выполни AZP-05: добавь backend rate limiting для mission attempts. Политика: 8 попыток в минуту на pilotSessionId+missionId и 20 попыток за 10 минут на session. При превышении возвращай 429 с retryAfterSeconds.
```

## AZP-06. Pilot Session Rate Limiting

Goal: усложнить массовое создание новых сессий.

Implementation:

- Добавить rate limiting для `POST /api/pilot-sessions`.
- Политика по умолчанию: `10` новых pilot sessions/hour/IP hash.
- IP hash брать из forwarded headers с учётом nginx proxy headers.
- Сохранить текущие cookie semantics и `publicCode` behavior.

Acceptance:

- `POST /api/pilot-sessions` возвращает `429` при превышении лимита.
- Existing public-code/session reuse не ломается.
- Tests покрывают лимит и нормальную сессию.

Prompt:

```text
Выполни AZP-06: добавь rate limiting создания pilot sessions по IP hash из forwarded headers. Сохрани текущие cookie semantics и publicCode поведение.
```

## AZP-07. Suspicious Events Schema

Goal: начать собирать сигналы автоматизации.

Implementation:

- Добавить DB migration для `suspicious_events` или эквивалентной таблицы.
- Добавить `ProjectZDatabase` методы для записи suspicious events.
- Событие должно хранить:
  - `learner_id`
  - `pilot_session_id`
  - `reason`
  - `metadata`
  - `created_at`
- Не раскрывать fraud details в UI/API response.

Acceptance:

- Backend может записать suspicious event.
- Пользовательский UI не видит fraud scoring details.
- Unit/DB tests покрывают insert и нормализацию metadata.

Prompt:

```text
Выполни AZP-07: добавь DB schema и ProjectZDatabase методы для suspicious events. Пока только запись событий; пользовательский UI не должен видеть детали fraud scoring.
```

## AZP-08. Mission Lifecycle Signals

Goal: дать серверу данные о скорости прохождения.

Implementation:

- Добавить `POST /api/missions/:missionId/start` или lazy start на first mission
  read/submit.
- Фиксировать start/submit timing server-side.
- Записывать suspicious event для impossible-fast паттернов.
- Не блокировать нормальный UX только по времени.

Acceptance:

- Submit может определить, что mission была начата подозрительно поздно или
  пройдена слишком быстро.
- Быстрое прохождение пишет suspicious event.
- E2E нормального прохождения не требует challenge.

Prompt:

```text
Выполни AZP-08: добавь server-side mission lifecycle signal. Фиксируй start/submit timing и помечай suspicious слишком быстрые прохождения без блокировки нормального UX.
```

## AZP-09. Trusted Leaderboard Policy

Goal: не пускать подозрительные результаты в публичный trusted leaderboard.

Implementation:

- Добавить server-side trusted/untrusted policy для leaderboard.
- Suspicious completion сохраняет личный progress.
- Suspicious learner/completion не попадает в public leaderboard и badge
  announcement path без ручной доверенной проверки.
- Не раскрывать пользователю точную причину исключения из trusted leaderboard.

Acceptance:

- Leaderboard скрывает или помечает untrusted/suspicious completions server-side.
- Личный progress/badge route не ломается.
- Tests доказывают, что suspicious learner не попадает в public leaderboard.

Prompt:

```text
Выполни AZP-09: добавь trusted leaderboard policy. Suspicious completions должны сохранять личный progress, но не попадать в public leaderboard и badge announcement path без ручной доверенной проверки.
```

## Финальная проверка

После завершения цепочки выполнить:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

Дополнительно:

- security grep/check по `dist/assets`;
- targeted API/e2e для submit, rate limit, leaderboard privacy;
- убедиться, что `dist-server` rebuilt после server-side изменений.

## Assumptions

- Threat model: опубликованный сайт без доступа агента к репозиторию.
- Если агент видит исходники локально, code split не скроет ответы; тогда keys
  нужно выносить из repo/build artifact в приватное backend-хранилище или
  вводить ручную проверку.
- `dist-server` может содержать private keys; `dist/assets` не может.
- Obfuscation/minification не считается защитой.
