# Own PostgreSQL migration subtasks

Дата: 2026-06-02

Цель: мигрировать Project Z с текущего Supabase REST/RPC backend storage path на собственный PostgreSQL в Docker Compose. Browser-facing контракт остается Node `/api/*`; frontend не должен узнать, что под backend API сменилась база.

Этот документ является рабочей разбивкой для отдельных чатов/агентов. Ссылайтесь на ID задач (`DBM-00`, `DBM-01`, etc.) в новых чатах.

## Current state

- Active runtime: backend-only through Node `/api/*` and nginx reverse proxy.
- Current DB access: API and worker handlers depend on `ProjectZDatabase`; the active runtime factory returns the own PostgreSQL adapter through `DATABASE_URL`. Supabase REST/RPC runtime code was removed in DBM-10.
- Current SQL source: own clean-start schema lives in `server/db/migrations/202606020001_project_z_schema.sql`; historical Supabase source remains under `supabase/migrations/20260601000*_backend_*.sql`.
- Current trust boundary: browser submits raw inputs only; server repository logic owns scoring, completion, badge awards, outbox and leaderboard aggregation.
- Current verification blockers: real Docker Compose DB/API/proxy smoke is still unproven in this repo session because Docker/proxy tooling was unavailable.

Note: status paragraphs inside earlier DBM sections are implementation history.
Mentions of a Supabase-backed runtime there describe the state before DBM-09/10,
not the active runtime after this plan completed.

## Non-negotiable target state

- PostgreSQL is the target database.
- The first own-DB launch is a clean start; do not import existing Supabase data.
- Docker Compose owns the first supported local/self-hosted DB topology.
- Server code uses `DATABASE_URL`, not `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`, after cutover.
- Use `pg + SQL` rather than Prisma, Drizzle, Knex or a newly chosen ORM.
- Keep the browser API contract unchanged: `/api/*` response shapes, cookies, no-store JSON responses and error behavior must remain compatible.
- Keep backend-only authority: browser must not write score, completion, badge, leaderboard, outbox, trap discovery or unlock facts.
- Replace Supabase RLS/RPC with server-side session guards, repository methods and explicit SQL transactions.
- Pachca delivery remains dry-run only during this migration.
- Do not add frontend database access, exposed DB credentials, Supabase service-role secrets in `VITE_*`, or local-mode compatibility shims.

## Execution order

Run tasks in order. Do not skip baseline inventory because later tasks appear to touch the same files; the plan is designed to keep `/api/*` parity while moving one backend boundary at a time.

### DBM-00. Baseline inventory and contract

Status 2026-06-02: completed in `docs/own-postgres-migration-dbm-00-baseline-inventory-2026-06-02.md`. Runtime code was not changed. Next task: DBM-01.

Goal: establish the exact Supabase dependency surface and API/RPC behavior before edits.

Implementation:

- Inventory active Supabase references across runtime, tests, docs and deploy config:
  - `supabase`
  - `SupabaseRestClient`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `/rest/v1`
  - `/rpc/`
  - `service_role`
  - `project_z_`
- Classify matches as runtime, tests, active docs, historical docs or generated build output.
- Record the exact current `/api/*` contract:
  - pilot session creation and cookie behavior;
  - `GET /api/me`;
  - learner identify;
  - progress payload;
  - mission attempt submit/idempotency;
  - reflections;
  - traps discovered;
  - leaderboard privacy;
  - unlock-seen;
  - admin announcement worker.
- Map each Supabase RPC/function/view to the server method or SQL query that will replace it.
- Produce a concrete next-touch file list in the agent response.

Acceptance:

- No runtime code changes.
- Active Supabase dependency surface is categorized.
- The next implementer has a file list and RPC-to-server-method map.
- Historical docs may remain historical, but active docs and runtime are scheduled for cleanup.

Prompt:

```text
Выполни DBM-00 из docs/own-postgres-migration-subtasks-2026-06-02.md: сделай baseline inventory Supabase dependency surface, текущих /api/* contracts, RPC behavior, env vars and worker behavior. Не меняй runtime code.
```

### DBM-01. ADR and target DB contract

Status 2026-06-02: completed. ADR-0007 now explicitly locks DBM-00 compatibility constraints, the domain `ProjectZDatabase` target boundary, server-side guards replacing Supabase RLS/RPC/client DB access, `DATABASE_URL` after cutover and generated-output rebuild policy. Runtime code was not changed. Next task: DBM-02.

Goal: lock the target architecture so later agents do not reselect DB, ORM, import policy or hosting.

Implementation:

- Read `docs/adr/ADR-0007-self-hosted-postgres-db.md`.
- Confirm it states:
  - PostgreSQL target;
  - Docker Compose DB topology;
  - `pg + SQL`;
  - `DATABASE_URL`;
  - clean start with no Supabase data import;
  - no Supabase RLS/RPC/client DB access;
  - unchanged browser `/api/*` contract.
- If DBM-00 found additional active constraints, amend ADR-0007 with those constraints.
- Update README/repo context only if DBM-00 changed the known migration surface.

Acceptance:

- Future agents do not need to choose DB, ORM, data import policy or first hosting topology.
- ADR-0007 and the subtask plan agree.

Prompt:

```text
Выполни DBM-01: проверь и при необходимости уточни ADR-0007 для own PostgreSQL migration. Зафиксируй PostgreSQL + Docker Compose + pg + SQL + DATABASE_URL + clean start + no Supabase RLS/RPC/client DB access.
```

### DBM-02. SQL migration runner

Status 2026-06-02: completed. Added `scripts/db-migrate.mjs`,
`npm run db:migrate`, `pg`, `server/db/migrations`, and focused runner tests for
lexical ordering, idempotent skip planning and dirty migration detection. Real
Postgres smoke remains for DBM-03/DBM-09 because no schema/Compose DB exists yet.
Next task: DBM-03.

Goal: add a project-owned migration runner before introducing own-Postgres schema files.

Implementation:

- Add a `pg`-backed migration runner script, planned path: `scripts/db-migrate.mjs`.
- Add `npm run db:migrate`.
- Add a migrations directory, planned path: `server/db/migrations`.
- The runner should:
  - require `DATABASE_URL`;
  - connect to PostgreSQL;
  - create `schema_migrations` if missing;
  - apply SQL files in lexical order;
  - wrap each migration in a transaction when possible;
  - record applied migration filename and timestamp;
  - skip already applied files on repeat runs;
  - fail loudly on a dirty or partially failed migration.
- Add focused tests if practical without requiring a real Docker DB; otherwise document a real-DB smoke command for DBM-03/DBM-09.

Acceptance:

- `npm run db:migrate` exists.
- The runner is idempotent against already applied migrations.
- Empty-DB migration application is ready for the schema task.
- No runtime API behavior changes yet.

Prompt:

```text
Выполни DBM-02: добавь SQL migration runner for own PostgreSQL. Используй DATABASE_URL, server/db/migrations, schema_migrations and npm run db:migrate. Не меняй API runtime behavior.
```

### DBM-03. PostgreSQL schema migration

Status 2026-06-02: implementation completed. Added
`server/db/migrations/202606020001_project_z_schema.sql` with the clean-start
Project Z tables, constraints, indexes, `project_z_touch_updated_at` trigger and
`leaderboard_entries` view. Added focused migration tests covering required
domain tables and excluding Supabase RLS/RPC/grant artifacts. Real empty-DB
smoke was not run in this session because `DATABASE_URL`, `docker` and `psql`
were unavailable. Next task: DBM-04, after running `npm run db:migrate` against
an empty Postgres database when one is available.

Goal: create the clean-start own-Postgres schema equivalent to the active Supabase domain tables.

Implementation:

- Port the table schema from `supabase/migrations/202606010001_backend_schema.sql`.
- Port indexes, constraints, `leaderboard_entries` view and `project_z_touch_updated_at` trigger.
- Keep the core domain tables:
  - `pilot_sessions`
  - `learners`
  - `learner_chapter_progress`
  - `mission_attempts`
  - `completed_missions`
  - `badge_awards`
  - `trap_discoveries`
  - `chapter_reflections`
  - `announcement_deliveries`
- Keep `pgcrypto` or an equivalent PostgreSQL UUID strategy.
- Exclude Supabase-only artifacts:
  - RLS policies;
  - `request.jwt.claims`;
  - `authenticated` / `service_role` grants;
  - PostgREST RPC wrappers;
  - Supabase-specific security-definer exposure policy.
- Apply migration to an empty Postgres DB with `npm run db:migrate`.

Acceptance:

- Empty Postgres DB receives the clean-start Project Z schema.
- Re-running migrations is safe.
- Schema supports all active backend domain rows.
- No Supabase RLS/grant/RPC-only object is required for the own-Postgres path.

Prompt:

```text
Выполни DBM-03: добавь own PostgreSQL schema migration. Перенеси таблицы/indexes/constraints/view/updated_at trigger, исключи Supabase RLS/grants/RPC wrappers, проверь npm run db:migrate на пустой БД если Docker/Postgres доступны.
```

### DBM-04. DB interface and pg client

Status 2026-06-02: completed. Added the `ProjectZDatabase` domain interface,
`SupabaseProjectZDatabase` adapter, `PostgresProjectZDatabase` over `pg.Pool`
and `createProjectZDatabaseFromEnv()` that requires `DATABASE_URL`. API,
announcement worker and Node runtime options now depend on `ProjectZDatabase`
fakes instead of `SupabaseRestClient`. At this historical DBM-04 point, the
default runtime still used the Supabase-backed adapter until DBM-05/06/07/08
ported the SQL methods. `PostgresProjectZDatabase` includes the factory and focused pg SQL
coverage for leaderboard/announcement boundaries; session/progress/mission and
reflection/unlock methods are still pending their dedicated phases. Next task:
DBM-05.

Goal: replace the Supabase REST shape with a domain-oriented database interface.

Implementation:

- Add `pg` and TypeScript support if needed.
- Create a domain DB interface, planned owner: `server/backend` or `server/db`.
- Interface should expose behavior-level methods, not Supabase primitives:
  - `createPilotSession`
  - `getMe`
  - `identifyLearner`
  - `getProgress`
  - `submitMissionAttempt`
  - `getChapterReflection`
  - `saveChapterReflection`
  - `markUnlockSeen`
  - `getLeaderboardEntries`
  - `getPendingAnnouncementDeliveries`
  - `updateAnnouncementDeliveryStatus`
- Implement `PostgresProjectZDatabase` over `pg.Pool`.
- Add `createProjectZDatabaseFromEnv()` that requires `DATABASE_URL`.
- Keep API and worker handlers dependency-injected so unit tests can use fakes.

Acceptance:

- API/worker code can depend on the domain DB interface without knowing Supabase or `pg` details.
- Existing fixture-backed tests can be migrated away from `SupabaseRestClient` without losing behavior coverage.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are not needed by the new DB factory.

Prompt:

```text
Выполни DBM-04: добавь ProjectZDatabase interface and PostgresProjectZDatabase over pg.Pool using DATABASE_URL. Не переписывай все handlers сразу; подготовь dependency boundary and tests.
```

### DBM-05. Session, learner and progress queries

Status 2026-06-02: completed. `PostgresProjectZDatabase` now implements pilot
session create/reuse, active-session `last_seen_at` touch, `/api/me`, learner
identity upsert with compatible normalization/caps, idempotent first-chapter
progress initialization, progress payload projection, completed mission/trap
aggregation and ordered pending unlock selection using own PostgreSQL SQL.
Focused DB tests cover mapping, session guards, nickname rejection, progress
initialization and pending unlock behavior. Backend API unit tests for
session/profile/progress now use a fake `ProjectZDatabase` instead of fake
Supabase RPC calls. At this historical DBM-05 point, the runtime factory still
used the Supabase-backed adapter until DBM-06/07/08 ported the remaining methods
and DBM-09 cut over runtime env. Real
empty-DB smoke remains pending until Docker/Postgres is available. Next task:
DBM-06.

Goal: port session/profile/progress reads and writes from Supabase RPC to server-owned SQL.

Implementation:

- Replace:
  - `project_z_create_pilot_session`
  - `project_z_get_me`
  - `project_z_identify_learner`
  - `project_z_get_progress`
  - `project_z_assert_active_pilot_session`
  - `project_z_ensure_learner_progress`
  - `project_z_progress_payload`
- Preserve behavior:
  - active session rejects revoked/expired sessions;
  - active session updates `last_seen_at`;
  - optional `publicCode` can reuse an existing active session;
  - learner nickname/full name normalization and length caps remain compatible;
  - first chapter opens on identify/progress initialization;
  - progress response shape stays unchanged;
  - pending unlock logic stays ordered by chapter catalog.
- Update API tests to use fake `ProjectZDatabase` rather than fake Supabase RPC calls.

Acceptance:

- Pilot cookie/API behavior is unchanged.
- Progress requires an identified learner.
- First chapter progress initializes idempotently.
- Existing `/api/me`, identify and progress tests pass with the new DB abstraction.

Prompt:

```text
Выполни DBM-05: перенеси pilot session, learner identify and progress payload logic from Supabase RPC to ProjectZDatabase/Postgres SQL while preserving current /api/* response shapes and tests.
```

### DBM-06. Mission attempt transaction

Status 2026-06-02: completed. `PostgresProjectZDatabase.submitMissionAttempt`
now runs through an explicit `pg.Pool.connect()` transaction with
`begin`/`commit`/`rollback`, preserves active session and identified learner
guards, chapter/previous-mission gates, idempotency by
`(learner_id, client_attempt_id)`, persisted duplicate answer/evaluation
behavior, server-derived attempt inserts, correct-answer completion rows, trap
discovery reporting, correct-boss chapter completion, next-chapter opening,
single badge awards and one pending `pachca` announcement delivery per new
badge. Focused adapter tests cover boss completion/outbox, duplicate retries,
reused client attempt rollback, missing previous-mission rollback and empty
attempt-key validation. API malicious-field and duplicate behavior remained
covered by backend API/parity tests. Real empty-DB smoke remains pending until a
Docker/Postgres database is available. Next task: DBM-07.

Goal: port the mission submit RPC into a server-owned PostgreSQL transaction.

Implementation:

- Replace `project_z_submit_mission_attempt` with `ProjectZDatabase.submitMissionAttempt`.
- Keep mission evaluation in TypeScript `missionEngine`; do not move scoring into SQL.
- Transaction must preserve:
  - required active pilot session and identified learner;
  - idempotency by `(learner_id, client_attempt_id)`;
  - conflict if `clientAttemptId` is reused for another mission/chapter;
  - chapter open/completed gate;
  - required previous mission gate;
  - mission attempt insert with server-derived `is_correct` and `score`;
  - `completed_missions` insert on correct answers;
  - trap discovery insert and new/existing reporting;
  - chapter completion on correct boss;
  - next chapter open;
  - one badge award per learner/chapter;
  - one pending `announcement_deliveries` row per new badge award;
  - duplicate attempt returns persisted answer/evaluation, not the retried body.
- Keep client-derived malicious fields ignored.

Acceptance:

- Existing API tests for malicious fields and duplicate `clientAttemptId` pass.
- Boss completion creates badge/outbox once.
- Incorrect, non-boss and locked/closed mission paths preserve current error behavior.
- Transaction boundaries are explicit and rollback on failure.

Prompt:

```text
Выполни DBM-06: перенеси project_z_submit_mission_attempt из PL/pgSQL в server-side Postgres transaction. Сохрани idempotency, gates, completion, badge/outbox, trap discovery and persisted duplicate behavior.
```

### DBM-07. Reflections, unlocks, leaderboard

Status 2026-06-02: completed. `PostgresProjectZDatabase` now implements
chapter reflection read/write, skipped-reflection clearing, unlock-seen updates
with idempotent `unlock_seen_at` behavior and public leaderboard reads through
own PostgreSQL SQL. Focused adapter tests cover reflection mapping,
normalization/caps, skipped clearing, unlock progress response and leaderboard
privacy (`full_name` absent from the query). API/parity tests for reflection,
unlock and leaderboard routes remain green. At this historical DBM-07 point,
the runtime factory still used the Supabase-backed adapter until DBM-08/09
completed worker migration and Docker Compose cutover. Real empty-DB smoke
remains pending until Docker/Postgres is available.
Next task: DBM-08.

Goal: port the remaining learner-owned read/write APIs and public leaderboard read.

Implementation:

- Replace:
  - `project_z_get_chapter_reflection`
  - `project_z_save_chapter_reflection`
  - `project_z_mark_unlock_seen`
  - Supabase REST select of `leaderboard_entries`
- Preserve behavior:
  - active pilot session required for learner-owned data;
  - reflection fields are normalized and capped;
  - skipped reflection clears option/note fields;
  - unlock seen is idempotent and returns progress;
  - leaderboard returns only public display data;
  - `fullName` remains absent/empty in public leaderboard entries.

Acceptance:

- Reflection save/read tests pass.
- Unlock-seen acceptance/reload behavior remains covered.
- Leaderboard privacy tests pass.
- API handlers no longer need Supabase RPC/select for these paths.

Prompt:

```text
Выполни DBM-07: перенеси reflections, unlock-seen and leaderboard from Supabase RPC/REST to ProjectZDatabase/Postgres SQL. Сохрани response shapes and leaderboard privacy.
```

### DBM-08. Announcement worker DB migration

Status 2026-06-02: completed. `server/backend/announcementWorker.ts` now uses
`ProjectZDatabase` methods for pending delivery selection and guarded status
updates instead of Supabase REST select/update syntax. Worker unit tests now use
typed fake DB methods and cover token-before-DB auth, dry-run-only gating,
bounded batch/max-attempt settings, dry-run status updates, unsupported-channel
failure, incomplete-payload failure and skipped rows when a pending update guard
matches no rows. `PostgresProjectZDatabase` SQL tests now assert the pending
`pachca` delivery selection and status/attempt update guards. The shared runtime
factory intentionally stayed Supabase-backed at this historical DBM-08 point
until DBM-09 performed the Docker/Postgres cutover. Real empty-DB smoke remains
pending until Docker/Postgres is available. Next task: DBM-09.

Goal: port the dry-run announcement worker from Supabase REST select/update to SQL.

Implementation:

- Replace Supabase REST query syntax in `server/backend/announcementWorker.ts`.
- Implement SQL methods for:
  - selecting pending `pachca` deliveries with badge/learner data;
  - marking dry-run;
  - marking failed;
  - skipping already changed rows.
- Preserve behavior:
  - token auth remains required;
  - delivery mode remains `dry-run` only;
  - batch limit and max attempts env behavior unchanged;
  - unsupported channel is marked failed;
  - incomplete payload is marked failed;
  - update only rows still `pending` and under max attempts.

Acceptance:

- Worker tests pass with fake DB.
- Worker updates only eligible pending rows.
- Live Pachca delivery is still blocked.
- No Supabase REST select/update remains in worker runtime.

Prompt:

```text
Выполни DBM-08: переведи announcement worker с Supabase REST select/update на ProjectZDatabase/Postgres SQL, сохрани token auth, dry-run-only mode and pending-row update guards.
```

### DBM-09. Docker Compose cutover

Status 2026-06-02: completed. `createRuntimeProjectZDatabaseFromEnv()` now
uses the own PostgreSQL factory and requires `DATABASE_URL`; a focused runtime
factory unit guard covers that Supabase env vars no longer satisfy active
runtime configuration. `deploy/docker-compose.yml` now includes a pinned
`postgres:17-alpine` `db` service, persistent data volume, Postgres
healthcheck, host migration port, API `depends_on` DB health and API
`DATABASE_URL`; `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` were removed
from compose. `Dockerfile` installs production dependencies in the runtime image
for the Postgres-backed server path. README smoke commands now document explicit
manual `npm run db:migrate` before API/proxy smoke and replace the old dummy
Supabase proxy command. Available checks passed: `npm run typecheck`,
`npm run test:unit` and `npm run build:server`. Real Docker Compose config,
DB/API/proxy smoke, `/healthz` through proxy and `/api/me` against a migrated
empty DB were not run because this environment has no `docker` CLI. Next task:
DBM-10.

Goal: make Docker Compose run API, nginx proxy and own PostgreSQL together.

Implementation:

- Add a Postgres service to `deploy/docker-compose.yml`, planned image: pinned `postgres:17-alpine`.
- Add a persistent volume for Postgres data.
- Add Postgres healthcheck.
- Set API `DATABASE_URL=postgres://...@db:5432/...`.
- Ensure API waits for DB health where Compose supports it.
- Decide whether migrations run manually via `npm run db:migrate` or as a documented deployment step; do not hide migration failures in API startup unless explicitly designed.
- Remove `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from compose only after API runtime no longer uses them.
- Update README smoke commands for the new topology.

Acceptance:

- Compose topology can start DB + API + proxy on a machine with Docker.
- `/healthz` still works.
- `/api/me` works against the empty own DB.
- Supabase env vars are absent from compose after runtime cutover.
- The old dummy Supabase proxy smoke command is replaced.

Prompt:

```text
Выполни DBM-09: обнови deploy/docker-compose.yml для Postgres service + volume + healthcheck + API DATABASE_URL. После runtime cutover убери Supabase env vars from compose and update README smoke commands.
```

### DBM-10. Cleanup, docs and verification

Status 2026-06-02: implementation cleanup completed. Removed active
`server/backend/supabaseRest.ts`, `server/db/supabaseProjectZDatabase.ts` and
`server/backend/supabaseMigrations.test.ts`; added an archive marker for
`supabase/migrations`; updated README, active product context, verification
guide, ADR-0007, integration next steps and handoff to name own PostgreSQL as
the active DB path and remaining Supabase references as historical. Verification
passed for `npm run lint`, `npm run typecheck`, `npm run test:unit` (17 files /
89 tests), `npm run build`, `npm run build:server`, focused backend e2e (4/4)
and full e2e (47/47). Results are recorded in
`docs/product/verification-and-self-review.md`. Real Docker Compose DB/API/proxy
smoke remains blocked here because `docker` is unavailable.

Goal: remove active Supabase runtime dependency and leave the repo ready for future agents.

Implementation:

- Remove or archive active runtime code that only exists for Supabase REST/RPC.
- Update active tests away from Supabase-specific fakes.
- Update active docs:
  - README;
  - `docs/product/repo-context-inventory.md`;
  - `docs/product/verification-and-self-review.md`;
  - `/Users/kirillmylnikov/Dev/ai/project-z-development-handoff.md`;
  - ADR-0007 if implementation diverged from the plan.
- Keep old Supabase docs only as historical context with clear supersession markers.
- Run grep gates:
  - active runtime/config should not require `SUPABASE_URL`;
  - active runtime/config should not require `SUPABASE_SERVICE_ROLE_KEY`;
  - active runtime should not call Supabase REST/RPC;
  - generated `dist-server` matches may be ignored only if rebuilt by the same task.
- Run verification:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run build`
  - `npm run build:server`
  - focused backend e2e
  - full e2e
  - Docker Compose DB/API/proxy smoke where Docker is available.

Acceptance:

- Active runtime uses `DATABASE_URL` and own PostgreSQL.
- Frontend `/api/*` behavior remains compatible.
- Supabase REST/RPC code is gone from active runtime.
- Docs name any remaining historical Supabase references as historical.
- All checks pass or external blockers are concrete and documented.

Prompt:

```text
Выполни DBM-10: финальный cleanup and verification for own PostgreSQL cutover. Удали active Supabase runtime/config references, обнови docs/handoff, запусти lint/typecheck/unit/build/build:server/e2e and Docker Compose smoke if available.
```
