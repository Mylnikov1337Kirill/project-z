# ADR-0007: Self-hosted PostgreSQL database

Дата: 2026-06-02

## Статус

Принято и реализовано через DBM-00..DBM-10 в `docs/own-postgres-migration-subtasks-2026-06-02.md`.

## Решение

Project Z migrated from the historical Supabase REST/RPC data-access path to
own PostgreSQL, доступный backend runtime через `DATABASE_URL`.

Первый поддерживаемый topology для собственной БД: Docker Compose рядом с Node API and nginx reverse proxy. База запускается как отдельный `postgres` service with persistent volume and healthcheck; Node API uses `DATABASE_URL`.

Data-access style: `pg + SQL`. Не вводить Prisma, Drizzle, Knex or another ORM for this migration unless a later ADR replaces this decision.

Migration policy: clean start. Existing Supabase data is not imported. The own-Postgres launch starts with an empty server progress state, matching the backend-only pilot-session model already accepted in ADR-0006.

Browser-facing API policy: `/api/*` contracts do not change. The browser continues to talk only to the Node backend and never receives DB credentials.

DBM-00 baseline inventory is the contract source for compatibility details during the cutover: no-store JSON responses, cookie semantics, request body limit, existing error messages/statuses, leaderboard privacy, duplicate mission attempt idempotency and admin worker response shapes must remain compatible unless a later ADR explicitly changes them.

## Контекст

ADR-0006 implemented the first backend DB/API slice with Supabase/Postgres schema, RLS policies and server-owned RPCs. After backend-only cutover, the browser no longer talks to storage directly; Node `/api/*` is the only supported runtime path.

That historical Supabase path was a backend data-access implementation detail:

- PL/pgSQL RPCs own session checks, progress initialization, mission-attempt transaction, reflections, unlock-seen and payload projections;
- RLS/grants are defense-in-depth for the historical Supabase shape, not an active browser-to-database boundary.

The migration replaced Supabase REST/RPC with a domain-oriented PostgreSQL
repository and explicit server-side transactions, while preserving the Node
`/api/*` behavior. Historical Supabase migrations remain only under
`supabase/migrations` for comparison.

## Target boundaries

- Node backend owns all reads/writes to PostgreSQL.
- Frontend remains backend-only and uses existing HTTP adapters.
- Mission scoring remains deterministic TypeScript through `missionEngine`; SQL stores server-derived results.
- Server-owned transactions write completion, badge awards, leaderboard source rows and announcement outbox.
- Pachca delivery remains dry-run only until a later verified rollout decision.
- Secrets stay server-side. `DATABASE_URL`, worker token and any future Pachca credentials must not use `VITE_*`.
- Browser input remains untrusted raw input only. The browser must not write score, correctness, completion, badge awards, leaderboard facts, announcement outbox facts, trap discoveries or unlock state directly.
- Current Supabase RLS/RPC behavior moves to explicit Node session guards and repository methods. Do not recreate a browser-addressable RPC/client DB contract for the own-Postgres target.
- The admin announcement worker remains server-only: worker token validation and live-Pachca `409`/dry-run gating happen before DB work where the current contract requires it.

## Repository contract

Later implementation tasks should introduce a domain-oriented `ProjectZDatabase` boundary rather than leaking `pg` query details into API routing. The target method set from DBM-00 is:

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

Private helpers may exist for active-session guarding, progress initialization and projection mapping, but they should not become a new public/browser database surface. `project_z_*` Supabase helper names may remain in historical SQL/docs only; new runtime code should prefer domain method names.

## Schema and migrations

Use SQL migrations under the project, planned path `server/db/migrations`, with an npm runner planned as `npm run db:migrate`.

Port the active domain schema from Supabase:

- `pilot_sessions`
- `learners`
- `learner_chapter_progress`
- `mission_attempts`
- `completed_missions`
- `badge_awards`
- `trap_discoveries`
- `chapter_reflections`
- `announcement_deliveries`
- `leaderboard_entries` view
- indexes, constraints and `updated_at` trigger

Do not port Supabase-only objects into the own-Postgres target:

- RLS policies;
- `request.jwt.claims` helpers;
- `authenticated` / `service_role` grants;
- PostgREST RPC wrapper functions;
- Supabase REST/RPC client contract.

Access control moves to the Node backend session guard plus explicit SQL transaction/query boundaries.

## Consequences

- Future agents should use the DBM task plan as historical implementation
  context, not as a prompt to restart the migration.
- Active runtime is own-Postgres-backed through `DATABASE_URL`.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are no longer runtime
  requirements. `DATABASE_URL` is the only DB connection env var for Node
  API/worker code.
- Existing Supabase/RLS smoke blockers are historical blockers for the
  superseded ADR-0006 runtime, not production blockers for the own-Postgres
  path.
- Production confidence after cutover requires DB migration smoke, API parity tests, backend e2e, full e2e and Docker Compose DB/API/proxy smoke.
- Generated build output such as `dist-server/index.mjs` must be rebuilt after runtime changes, not manually edited during the migration.
