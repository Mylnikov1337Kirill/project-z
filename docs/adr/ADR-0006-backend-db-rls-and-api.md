# ADR-0006: Backend DB, RLS и API для первого backend-среза

Дата: 2026-06-01

## Статус

Принято. Updated 2026-06-02 by backend-only cutover: ADR-0002 is superseded,
and local mode is no longer a supported development/test fallback.

## Решение

Первый backend-срез Project Z использует backend/serverless API как единственный доверенный слой для identity, progress, mission attempts, reflections, traps, leaderboard и отметок о просмотренных unlock-событиях. Browser SPA не пишет производные игровые факты напрямую в базу.

Backend становится источником истины для scoring, completion, badge awards, leaderboard aggregation и Pachca outbox с первого backend write-среза. Контент глав, миссий и объяснений остаётся типизированным/static внутри приложения; перенос контента в DB/CMS возможен только отдельным ADR.

Identity для пилота строится на pilot session. Старый localStorage progress из `project-z-progress-v1` не импортируется: серверный прогресс начинается пустым. После backend-only cutover Node `/api/*` является единственным поддерживаемым runtime path; local mode не является development/test fallback.

## Контекст

ADR-0002 исторически разрешил local-first сохранение за repository-интерфейсами, чтобы не блокировать frontend-итерации; он superseded backend-only cutover. ADR-0004 уже закрепил, что Pachca webhook и секреты принадлежат backend. Аудит backend migration от 2026-06-01 показал, что pre-cutover localStorage-срез был удобен для игры, но клиент являлся источником истины для попыток, score, completion, unlocks и локального leaderboard.

Для общей таблицы лидеров, idempotent badge awards и безопасной Pachca-интеграции эти решения нужно перенести на server-side транзакции. Этот ADR фиксирует минимальную модель данных, публичные API и RLS/security правила для первой backend-реализации.

## Архитектура

Browser SPA вызывает backend/serverless API для:

- создания и восстановления pilot session;
- идентификации learner display profile;
- чтения progress и trap discoveries;
- отправки mission attempt;
- чтения и записи chapter reflection;
- чтения leaderboard;
- отметки unlock-события как просмотренного.

Server-side владельцы доменных решений:

- `POST /api/missions/:missionId/attempts` принимает raw answer и stable ids, сам валидирует learner/session, достаёт актуальный content snapshot/version, оценивает ответ и пишет результат;
- chapter completion выполняется idempotent транзакцией на backend;
- badge award создаётся только backend и только один раз на `(learner_id, chapter_id)`;
- Pachca outbox event создаётся только при первой выдаче badge award;
- leaderboard строится backend aggregation/view, а не клиентским расчётом.

Frontend может продолжать использовать repository/service-контракты, но backend implementation не должна доверять клиентским `score`, `isCorrect`, `completedMissionIds`, `badgeAwards` или leaderboard rows.

## Модель данных

Имена таблиц и поля ниже являются целевой минимальной схемой для первого backend-среза. Поля `created_at` и `updated_at` заполняются backend/DB defaults, а все внешние ключи должны быть добавлены в фактической миграции.

```sql
pilot_sessions (
  id uuid primary key,
  public_code text null unique,
  created_at timestamptz not null,
  expires_at timestamptz null,
  revoked_at timestamptz null,
  last_seen_at timestamptz null
)

learners (
  id uuid primary key,
  pilot_session_id uuid not null,
  nickname text not null,
  full_name text null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (pilot_session_id)
)

learner_chapter_progress (
  learner_id uuid not null,
  chapter_id text not null,
  status text not null check (status in ('locked', 'open', 'completed')),
  opened_at timestamptz null,
  completed_at timestamptz null,
  unlock_seen_at timestamptz null,
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

Leaderboard может быть SQL view/materialized view или endpoint projection поверх `learners`, `learner_chapter_progress`, `completed_missions` и `badge_awards`. Public leaderboard возвращает только `nickname` или другой display handle, количество завершённых глав, score/progress summary и timestamps, нужные для сортировки. Full name в leaderboard не раскрывается.

## Public API

Публичные API первого backend-среза:

```text
POST /api/pilot-sessions
  body: { publicCode? }
  returns: { pilotSession }

GET /api/me
  returns: { pilotSession, learner? }

POST /api/learners/identify
  body: { nickname, fullName? }
  returns: { learner }

GET /api/progress
  returns: { learner, progress, completedMissionIds, encounteredTrapIds, pendingUnlockChapterId }

POST /api/missions/:missionId/attempts
  body: { chapterId, answer, clientAttemptId, contentVersion }
  server:
    validates pilot session and learner
    validates mission id, chapter id and content version
    evaluates answer server-side
    writes mission_attempt
    writes completed_missions if correct
    completes chapter when chapter rules pass
    creates badge_awards if this is the first chapter completion
    creates announcement_deliveries outbox row on first badge award only
    writes trap_discoveries
  returns: { evaluation, progress, trapDiscoveries, completion? }

GET /api/chapter-reflections/:chapterId
  returns: { reflection? }

POST /api/chapter-reflections/:chapterId
  body: { optionId?, optionLabel?, note?, skipped }
  returns: { reflection }

GET /api/traps/discovered
  returns: { trapIds }

GET /api/leaderboard
  returns: { entries }

POST /api/unlocks/:chapterId/seen
  returns: { progress }
```

Client-provided `clientAttemptId` is an idempotency key for retry safety. Backend may return the already persisted result for duplicate `(learner_id, client_attempt_id)` requests.

## RLS и security rules

RLS/security policy для первого backend-среза:

- learner может читать только строки, связанные с его `pilot_session_id`;
- learner может писать только разрешённые user-owned поля своего learner/profile и свои chapter reflections;
- learner может читать свой progress, attempts, completed missions, trap discoveries и badge awards;
- client не может напрямую писать `score`, `is_correct`, `completed_missions`, `badge_awards`, leaderboard rows или `announcement_deliveries`;
- любые writes, которые меняют score/completion/badge/announcement, проходят через backend service role или server-owned RPC/function;
- Pachca webhook URL, tokens и secrets существуют только в backend env vars;
- leaderboard endpoint не возвращает `full_name`, raw answers, reflection notes или session identifiers;
- logs не должны содержать raw Pachca secrets или full raw request payloads с потенциальными PII.

## Privacy и retention

Privacy policy для первого backend-среза минимальная:

- `full_name` является optional PII и не используется в public leaderboard или Pachca payload;
- public display identity ограничивается `nickname` или отдельным display handle;
- raw answers могут храниться только для bounded audit/debug retention;
- reflection notes приватны для learner и service role, не попадают в leaderboard, Pachca payloads или публичные exports;
- старый `project-z-progress-v1` localStorage progress не импортируется в backend mode;
- local mode после backend launch не является production fallback.

Сроки удаления raw answers, session expiry и operational log retention должны быть заданы в backend implementation PR до production-включения.

## Последствия

- Backend implementation PR должен начинаться с DB migrations/RLS/API, совместимых с этим ADR.
- Frontend не должен отправлять или ожидать принятия server-owned производных фактов как истины.
- Local repository/runtime mode is removed from active guidance; backend-only runtime starts with empty server progress for legacy localStorage users.
- Pachca dry-run/live delivery реализуется через outbox и idempotency, а не через browser calls.
- Если позже понадобится перенос content/artifacts в backend, для этого нужен отдельный ADR и отдельная миграционная стратегия.
