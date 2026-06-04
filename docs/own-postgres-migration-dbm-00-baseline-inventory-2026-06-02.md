# DBM-00 baseline inventory: Supabase -> own PostgreSQL

Дата: 2026-06-02

Scope: baseline inventory for `docs/own-postgres-migration-subtasks-2026-06-02.md` / DBM-00. Runtime code was intentionally not changed.

## Evidence checked

- Supabase marker sweep:
  - `rg -l -S "supabase|SupabaseRestClient|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|/rest/v1|/rpc/|service_role|project_z_" --glob '!node_modules/**' --glob '!dist/**' --glob '!dist-server/**' --glob '!package-lock.json'`
  - `rg -n -S "supabase|SupabaseRestClient|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|/rest/v1|/rpc/|service_role|project_z_" server src e2e deploy Dockerfile README.md docs --glob '!node_modules/**' --glob '!dist/**' --glob '!dist-server/**' --glob '!package-lock.json'`
  - `rg -n -S "supabase|SupabaseRestClient|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|/rest/v1|/rpc/|service_role|project_z_" dist dist-server --glob '!node_modules/**'`
- Runtime and tests read:
  - `server/backend/api.ts`
  - `server/backend/announcementWorker.ts`
  - `server/backend/supabaseRest.ts`
  - `server/backend/http.ts`
  - `server/backend/cookies.ts`
  - `server/nodeHttp.ts`
  - `server/backend/api.test.ts`
  - `server/nodeApiParity.test.ts`
  - `server/backend/announcementWorker.test.ts`
  - `server/nodeHttp.test.ts`
  - `e2e/backend-api.spec.ts`
  - `e2e/backendApiFixtures.ts`
- SQL source read:
  - `supabase/migrations/202606010001_backend_schema.sql`
  - `supabase/migrations/202606010002_backend_rls.sql`
  - `supabase/migrations/202606010003_backend_read_models.sql`
  - `supabase/migrations/202606010004_backend_session_profile_rpc.sql`
  - `supabase/migrations/202606010005_backend_reflections_unlocks_rpc.sql`
  - `supabase/migrations/202606010006_backend_mission_attempt_rpc.sql`
  - `supabase/migrations/202606010007_backend_announcement_worker_grants.sql`

## Supabase dependency surface

### Runtime

- `server/backend/supabaseRest.ts`
  - Defines `SupabaseRestClient`.
  - Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` through `createSupabaseRestClientFromEnv()`.
  - Sends Supabase REST requests to `/rest/v1/rpc/{functionName}` for RPC, `/rest/v1/{path}` for selects and updates.
  - Sends service-role headers: `apikey`, `authorization: Bearer <service role key>`, `content-type: application/json`.
  - Maps non-2xx Supabase responses into `SupabaseRestError(status, message)`.
- `server/backend/api.ts`
  - Creates a Supabase client from env unless a test/fake `db` is injected.
  - Active RPC calls:
    - `project_z_create_pilot_session`
    - `project_z_get_me`
    - `project_z_identify_learner`
    - `project_z_get_progress`
    - `project_z_submit_mission_attempt`
    - `project_z_get_chapter_reflection`
    - `project_z_save_chapter_reflection`
    - `project_z_mark_unlock_seen`
  - Active Supabase table/view read:
    - `leaderboard_entries?select=learner_id,nickname,closed_chapters_count,last_badge_date&order=closed_chapters_count.desc,last_badge_date.desc.nullslast`
- `server/backend/announcementWorker.ts`
  - Creates a Supabase client from env unless a test/fake `db` is injected.
  - Reads `announcement_deliveries` via Supabase REST with nested `badge_awards(...,learners(nickname))`.
  - Updates `announcement_deliveries` via Supabase REST `PATCH`.
- `server/nodeHttp.ts`
  - Keeps the runtime dependency injectable as `db?: SupabaseRestClient`.
  - Routes `/api/*` to `server/backend/api.ts` and `POST /api/admin/announcement-worker` to `server/backend/announcementWorker.ts`.
- `server/backend/cookies.ts`
  - Not a Supabase dependency, but an active `project_z_` marker: cookie defaults to `project_z_pilot_session_id` and can be renamed with `PROJECT_Z_PILOT_SESSION_COOKIE_NAME`.

### Tests

- `server/backend/api.test.ts`
  - Uses `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` test env values.
  - Mocks Supabase REST/RPC through global `fetch`.
  - Guards JSON errors, cookie behavior, mission derived-field trust boundary, RPC error mapping, log redaction, duplicate attempt persisted-evaluation behavior and leaderboard privacy.
- `server/nodeApiParity.test.ts`
  - Uses injected fake `SupabaseRestClient`.
  - Guards Node route parity for sessions, `/api/me`, identify, progress/traps, reflections, unlock-seen, mission submit/idempotency, leaderboard and worker dry-run.
- `server/backend/announcementWorker.test.ts`
  - Uses Supabase REST fetch mocks.
  - Guards worker token-before-DB, dry-run status update and live Pachca `409`.
- `server/backend/supabaseMigrations.test.ts`
  - Locks the Supabase grant shape for `project_z_submit_mission_attempt`: execute only to `service_role`, not `anon`, `authenticated` or `public`.
- `server/nodeHttp.test.ts`
  - Uses `SupabaseRestClient` only as an injected type/fake for Node route smoke.
- `e2e/backend-api.spec.ts` and `e2e/backendApiFixtures.ts`
  - No live Supabase dependency.
  - Browser-facing fixture contract covers identify, progress, traps, reflections, mission submit without client-owned score/source/isCorrect, unlock-seen and leaderboard without `fullName`.

### SQL source

- `supabase/migrations/202606010001_backend_schema.sql`
  - Current domain schema source: `pilot_sessions`, `learners`, `learner_chapter_progress`, `mission_attempts`, `completed_missions`, `badge_awards`, `trap_discoveries`, `chapter_reflections`, `announcement_deliveries`.
  - Also includes indexes and `project_z_touch_updated_at`.
- `supabase/migrations/202606010003_backend_read_models.sql`
  - Current `leaderboard_entries` view.
  - JSON projection helpers: `project_z_session_json`, `project_z_learner_json`, `project_z_progress_payload`.
- `supabase/migrations/202606010004_backend_session_profile_rpc.sql`
  - Session/profile/progress RPCs and helper functions.
- `supabase/migrations/202606010005_backend_reflections_unlocks_rpc.sql`
  - Reflection and unlock-seen RPCs.
- `supabase/migrations/202606010006_backend_mission_attempt_rpc.sql`
  - Mission-attempt transaction RPC.
- `supabase/migrations/202606010002_backend_rls.sql` and `202606010007_backend_announcement_worker_grants.sql`
  - Supabase-only RLS, `request.jwt.claims`, `authenticated` grants and `service_role` grants. Do not port these into the own-Postgres target, except as behavioral constraints for server-side guards and SQL transaction boundaries.

### Deploy config

- `deploy/docker-compose.yml`
  - Active API service still passes `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
  - Worker env vars are active: `PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN`, `PROJECT_Z_PACHCA_DELIVERY_MODE`, `PROJECT_Z_ANNOUNCEMENT_BATCH_LIMIT`, `PROJECT_Z_ANNOUNCEMENT_MAX_ATTEMPTS`.
- `deploy/nginx/default.conf`
  - Contains `project_z_` names for nginx variables/upstream only. These are not DB dependencies.
- `Dockerfile`
  - No direct Supabase marker in source, but the built server uses runtime env.

### Active docs

- `README.md`
  - Correctly documents current `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` runtime and future `DATABASE_URL` target.
- `docs/own-postgres-migration-subtasks-2026-06-02.md`
  - Active DBM plan.
- `docs/adr/ADR-0007-self-hosted-postgres-db.md`
  - Active target ADR for PostgreSQL, Docker Compose, `pg + SQL`, `DATABASE_URL` and clean start.
- `docs/product/repo-context-inventory.md`
  - Active repo context; should be updated after DBM-00.
- `docs/product/integration-next-steps.md`
  - Active backend/Supabase/Pachca readiness checklist until DB cutover supersedes the Supabase path.
- `docs/product/verification-and-self-review.md`
  - Active verification notes; should record DBM-00 as docs-only inventory if updated.

### Historical docs

- `docs/node-backend-migration-phase-0-contract-2026-06-01.md`
- `docs/node-backend-migration-agent-phases-2026-06-01.md`
- `docs/architecture-backend-migration-audit-2026-06-01.md`
- Historical/status sections in `docs/backend-only-cutover-subtasks-2026-06-02.md`

Historical docs may keep Supabase references as migration history. Do not use them as active target guidance where ADR-0007 and the DBM plan are more specific.

### Generated build output

- `dist-server/index.mjs`
  - Contains bundled `server/backend/supabaseRest.ts`, `SupabaseRestClient`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `/rest/v1`, RPC names and `project_z_pilot_session_id`.
  - Treat as generated output. It must be rebuilt after the own-Postgres runtime cutover; do not edit it manually.
- `dist/`
  - No Supabase marker matches from the DBM-00 sweep.

## Current environment contract

### Current active runtime

- Required for `/api/*` paths that touch DB:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Optional:
  - `PROJECT_Z_PILOT_SESSION_COOKIE_NAME`, defaults to `project_z_pilot_session_id`.
- Worker:
  - `PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN` is required before DB access.
  - `PROJECT_Z_PACHCA_DELIVERY_MODE` defaults to `dry-run`; any non-`dry-run` value returns `409`.
  - `PROJECT_Z_ANNOUNCEMENT_BATCH_LIMIT` defaults to `10`, bounded to `1..25`.
  - `PROJECT_Z_ANNOUNCEMENT_MAX_ATTEMPTS` defaults to `3`, bounded to `1..10`.

### Target after DBM cutover

- Replace active Supabase runtime env with `DATABASE_URL`.
- Keep `PROJECT_Z_PILOT_SESSION_COOKIE_NAME` and worker env behavior unless a later DBM task intentionally changes it.
- Do not introduce `VITE_*` DB/secrets.

## Current `/api/*` contract

All backend JSON responses use:

- `cache-control: no-store`
- `content-type: application/json; charset=utf-8`

The browser client uses relative `/api/*` paths and `credentials: include`. Node request bodies are limited to 64 KiB before handler dispatch; invalid JSON returns `400 { "error": "Нужен корректный JSON." }`.

### `POST /api/pilot-sessions`

- Body: `{ publicCode?: string }`.
- Current data call: `project_z_create_pilot_session({ p_public_code })`.
- Response: `200 { pilotSession }`.
- Cookie:
  - name: `PROJECT_Z_PILOT_SESSION_COOKIE_NAME` or `project_z_pilot_session_id`;
  - `Path=/`;
  - `HttpOnly`;
  - `SameSite=Lax`;
  - `Max-Age=5184000`;
  - `Secure` when `x-forwarded-proto=https` or raw URL is HTTPS.
- SQL behavior:
  - trims empty `publicCode` to null;
  - reuses an active matching `public_code` session;
  - otherwise inserts a new session;
  - updates `last_seen_at`.

### `GET /api/me`

- Without a valid UUID pilot cookie: `200 { learner: null, pilotSession: null }` and no DB call.
- With valid cookie: `project_z_get_me({ p_pilot_session_id })`.
- Response: `200 { pilotSession, learner }`, where `learner` can be null.
- If DB reports `invalid_pilot_session`: `200 { learner: null, pilotSession: null }` plus expired pilot cookie.

### `POST /api/learners/identify`

- Body: `{ nickname: string, fullName?: string }`.
- If cookie is absent, creates a pilot session first and sets the cookie.
- Current data call: `project_z_identify_learner({ p_pilot_session_id, p_nickname, p_full_name, p_chapter_ids, p_first_chapter_id })`.
- Response: `200 { learner }`.
- SQL behavior:
  - active session required;
  - nickname is whitespace-normalized, trimmed and capped at 40 chars;
  - full name is whitespace-normalized, trimmed, capped at 120 chars and stored as nullable;
  - missing nickname raises `nickname_required`;
  - learner is upserted by `pilot_session_id`;
  - all chapter progress rows are ensured and the first chapter starts `open` with `unlock_seen_at` set.

### `GET /api/progress`

- Requires pilot cookie.
- Current data call: `project_z_get_progress({ p_pilot_session_id, p_chapter_ids, p_first_chapter_id })`.
- Response: `200 { learner, progress, completedMissionIds, encounteredTrapIds, pendingUnlockChapterId }`.
- SQL behavior:
  - active session required and `last_seen_at` updated;
  - identified learner required;
  - progress rows are ensured idempotently;
  - progress is ordered by chapter catalog order;
  - `completedMissionIds` are ordered by first completion timestamp and mission id;
  - `encounteredTrapIds` are ordered by first seen timestamp and trap id;
  - `pendingUnlockChapterId` is the first ordered open chapter after the first chapter with `unlock_seen_at is null`.

### `POST /api/missions/:missionId/attempts`

- Body: `{ chapterId: string, answer: MissionAnswer, clientAttemptId: string, contentVersion: string }`.
- Required input checks:
  - missing `answer`: `400 { error: "Нужен ответ." }`;
  - missing `clientAttemptId`: `400 { error: "Нужен ключ попытки." }`;
  - mismatched `contentVersion`: `409 { error: "Контент обновился. Перезагрузи маршрут и попробуй снова." }`;
  - unknown chapter: `404 { error: "Глава не найдена." }`;
  - unknown mission: `404 { error: "Сцена не найдена." }`.
- Server derives before DB call:
  - mission evaluation through TypeScript `evaluateMission`;
  - score and correctness;
  - encountered canonical trap ids;
  - required previous mission ids;
  - boss/non-boss flag;
  - next chapter id;
  - badge name snapshot.
- Current data call: `project_z_submit_mission_attempt(...)`.
- Browser/client-derived fields such as `source`, `score`, `isCorrect`, `completion`, `completedMissionIds` and `trapDiscoveries` are ignored.
- Response: `200 { evaluation, progress, trapDiscoveries, completion }`.
- Duplicate behavior:
  - duplicate `(learner_id, client_attempt_id)` for the same mission returns persisted attempt data;
  - API re-evaluates `rpcResult.attempt.answer` and returns the persisted evaluation, not the retried body;
  - reuse of the same `clientAttemptId` for another mission/chapter returns `409 { error: "Ключ попытки уже использован для другой сцены." }`.
- SQL transaction behavior:
  - active session and identified learner required;
  - ensure progress;
  - chapter must be `open` or `completed`;
  - previous required missions must be completed while chapter is not completed;
  - insert mission attempt with server-derived `is_correct` and `score`;
  - insert `completed_missions` only for correct attempts;
  - insert `trap_discoveries`, reporting `isNew` against pre-insert state;
  - correct boss completes chapter, opens next chapter if present, creates one `badge_awards` row per learner/chapter and one pending `announcement_deliveries` row per new badge award.
- Error mapping:
  - `invalid_pilot_session` -> `401 { error: "Пилотная сессия недоступна." }`;
  - `learner_not_identified` -> `409 { error: "Нужно представиться перед продолжением." }`;
  - `client_attempt_id_required` -> `400 { error: "Нужен ключ попытки." }`;
  - `chapter_not_open` -> `409 { error: "Глава ещё закрыта." }`;
  - `mission_not_open` -> `409 { error: "Сцена ещё закрыта." }`;
  - unknown DB failure -> `500 { error: "Сервер не смог сохранить данные." }`.

### `GET /api/chapter-reflections/:chapterId`

- Requires pilot cookie and identified learner.
- Current data call: `project_z_get_chapter_reflection({ p_pilot_session_id, p_chapter_id })`.
- Response: `200 { reflection: ChapterReflection | null }`.

### `POST /api/chapter-reflections/:chapterId`

- Body: `{ optionId?: string, optionLabel?: string, note?: string, skipped?: boolean }`.
- Current data call: `project_z_save_chapter_reflection({ p_pilot_session_id, p_chapter_id, p_option_id, p_option_label, p_note, p_skipped })`.
- Response: `200 { reflection }`.
- SQL behavior:
  - active session and identified learner required;
  - `optionId` and `optionLabel` normalize whitespace and cap at 80 chars;
  - `note` normalizes whitespace and caps at 180 chars;
  - `skipped: true` clears option/note and stores `skipped: true`;
  - upsert by `(learner_id, chapter_id)`.

### `GET /api/traps/discovered`

- Requires pilot cookie and identified learner.
- Current data call: reuses `project_z_get_progress`.
- Response: `200 { trapIds }`.

### `GET /api/leaderboard`

- Public API route: no pilot cookie required in current handler.
- Current data call: Supabase REST select from `leaderboard_entries`.
- Response: `200 { entries }`.
- Privacy:
  - `fullName` is always returned as an empty string;
  - raw answers, reflection notes and session ids are not returned.
- Sort:
  - `closed_chapters_count desc`;
  - `last_badge_date desc nullslast`.

### `POST /api/unlocks/:chapterId/seen`

- Requires pilot cookie and identified learner.
- Current data call: `project_z_mark_unlock_seen({ p_pilot_session_id, p_chapter_id, p_chapter_ids, p_first_chapter_id })`.
- Response: `200 { progress }`.
- SQL behavior:
  - ensures progress;
  - sets `unlock_seen_at = coalesce(unlock_seen_at, now())`;
  - returns updated progress projection.

### Other API behavior

- Unknown `/api/*` route: `404 { error: "Маршрут API не найден." }`.
- Backend config missing for Supabase env: `503 { error: "Серверный режим не настроен." }`.
- Unexpected API errors log method/path/status-safe context only; tests guard against logging raw payloads, private notes, answer ids or pilot session ids.

## Admin worker contract

### `POST /api/admin/announcement-worker`

- Method must be `POST`; otherwise `405 { error: "Announcement worker expects POST." }`.
- Requires `Authorization: Bearer <PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN>` before DB access.
- `PROJECT_Z_PACHCA_DELIVERY_MODE` defaults to `dry-run`; any non-`dry-run` value returns `409 { error: "Live Pachca delivery is not enabled yet. Use dry-run mode first." }` before DB access.
- Reads pending deliveries:
  - table: `announcement_deliveries`;
  - filters: `channel=eq.pachca`, `status=eq.pending`, `attempts_count=lt.{maxAttempts}`;
  - order: `created_at.asc`;
  - limit: bounded batch limit;
  - nested read: `badge_awards(chapter_id,badge_name_snapshot,completed_chapters,awarded_at,learners(nickname))`.
- For supported `pachca` rows in dry-run:
  - builds preview from learner nickname, chapter title, badge snapshot and completed chapter count;
  - patches the row only if still pending and attempts below max;
  - sets `attempts_count + 1`, `last_error: null`, `sent_at: null`, `status: dry_run`;
  - returns delivery result with `status: "dry_run"` and preview.
- Unsupported channels or incomplete payloads become `failed` when the guarded update succeeds; concurrency conflicts are returned as `skipped`.
- Response: `200 { deliveries, failedCount, mode, processedCount, skippedCount }`.
- Supabase DB failures return `500 { error: "Announcement worker database failed." }`.

## RPC/function/view replacement map

| Current Supabase object | Current owner | Future replacement |
| --- | --- | --- |
| `project_z_create_pilot_session` | `server/backend/api.ts` `POST /api/pilot-sessions` | `ProjectZDatabase.createPilotSession({ publicCode })`; SQL find active public code session, update `last_seen_at`, or insert. |
| `project_z_assert_active_pilot_session` | Called by all RPCs | Private session guard used by every DB method; select non-revoked/non-expired session and update `last_seen_at` inside the query/transaction. |
| `project_z_get_me` | `GET /api/me` | `ProjectZDatabase.getMe({ pilotSessionId })`; return active session plus optional learner. |
| `project_z_identify_learner` | `POST /api/learners/identify` | `ProjectZDatabase.identifyLearner(...)`; normalize profile, upsert learner, ensure initial progress. |
| `project_z_ensure_learner_progress` | RPC helper | Private `ensureLearnerProgress(client, learnerId, chapterIds, firstChapterId)`. |
| `project_z_get_progress` | `GET /api/progress` and traps route | `ProjectZDatabase.getProgress({ pilotSessionId, chapterIds, firstChapterId })`; require learner, ensure progress and return projection. |
| `project_z_progress_payload` | RPC helper | Private projection SQL/helper used by progress, mission submit and unlock-seen; or explicit SQL rows mapped in TypeScript. |
| `project_z_session_json` | SQL JSON helper | TypeScript row mapper or SQL JSON projection. |
| `project_z_learner_json` | SQL JSON helper | TypeScript row mapper or SQL JSON projection. |
| `project_z_submit_mission_attempt` | `POST /api/missions/:missionId/attempts` | `ProjectZDatabase.submitMissionAttempt(...)` inside one PostgreSQL transaction; keep TypeScript mission evaluation in API/service layer. |
| `project_z_get_chapter_reflection` | `GET /api/chapter-reflections/:chapterId` | `ProjectZDatabase.getChapterReflection({ pilotSessionId, chapterId })`. |
| `project_z_save_chapter_reflection` | `POST /api/chapter-reflections/:chapterId` | `ProjectZDatabase.saveChapterReflection(...)`; normalize/cap text and upsert. |
| `project_z_mark_unlock_seen` | `POST /api/unlocks/:chapterId/seen` | `ProjectZDatabase.markUnlockSeen(...)`; mark once and return updated progress. |
| `leaderboard_entries` view | `GET /api/leaderboard` and worker-free public read | Keep as own-Postgres view or replace with `ProjectZDatabase.getLeaderboardEntries()` query. Response must omit `fullName`. |
| `project_z_touch_updated_at` trigger | `learners.updated_at` | Keep in own-Postgres schema unless replaced by explicit SQL updates. |
| `project_z_current_pilot_session_id` | Supabase RLS only | Do not port. Replace with Node session guard and method scoping. |
| RLS policies and `authenticated` / `service_role` grants | Supabase defense-in-depth | Do not port as own-Postgres runtime objects. Preserve the behavior through server-only DB credentials, guards and transactions. |
| `announcement_deliveries` REST select/update | `server/backend/announcementWorker.ts` | `ProjectZDatabase.getPendingAnnouncementDeliveries({ limit, maxAttempts })` and `ProjectZDatabase.updateAnnouncementDeliveryStatus(...)`. |

## Next-touch file list

Use this list for later DBM tasks; DBM-00 made no runtime edits.

- DBM-01 ADR/docs confirmation:
  - `docs/adr/ADR-0007-self-hosted-postgres-db.md`
  - `README.md`
  - `docs/product/repo-context-inventory.md`
  - `docs/own-postgres-migration-subtasks-2026-06-02.md`
- DBM-02 migration runner:
  - `package.json`
  - `package-lock.json`
  - `scripts/db-migrate.mjs`
  - `server/db/migrations/`
  - optional focused tests under `server/db` or `scripts`
- DBM-03 clean-start schema:
  - `server/db/migrations/*.sql`
  - source references: `supabase/migrations/202606010001_backend_schema.sql`, `202606010003_backend_read_models.sql`
- DBM-04 DB interface and pg client:
  - `package.json`
  - `package-lock.json`
  - `server/backend/api.ts`
  - `server/backend/announcementWorker.ts`
  - `server/backend/supabaseRest.ts` (eventual replacement/removal)
  - `server/nodeHttp.ts`
  - `server/nodeHttp.test.ts`
  - `server/nodeApiParity.test.ts`
  - new `server/db` or `server/backend` database interface files
- DBM-05 session/profile/progress:
  - `server/backend/api.ts`
  - new DB implementation files
  - `server/backend/api.test.ts`
  - `server/nodeApiParity.test.ts`
  - source SQL reference: `supabase/migrations/202606010004_backend_session_profile_rpc.sql`
- DBM-06 mission attempt transaction:
  - `server/backend/api.ts`
  - new DB implementation files
  - `server/backend/api.test.ts`
  - `server/nodeApiParity.test.ts`
  - `e2e/backendApiFixtures.ts`
  - source SQL reference: `supabase/migrations/202606010006_backend_mission_attempt_rpc.sql`
- DBM-07 reflections/unlocks/leaderboard:
  - `server/backend/api.ts`
  - new DB implementation files
  - `server/backend/api.test.ts`
  - `server/nodeApiParity.test.ts`
  - `e2e/backend-api.spec.ts`
  - source SQL reference: `supabase/migrations/202606010005_backend_reflections_unlocks_rpc.sql`
- DBM-08 worker:
  - `server/backend/announcementWorker.ts`
  - `server/backend/announcementWorker.test.ts`
  - `server/nodeApiParity.test.ts`
  - source SQL references: `supabase/migrations/202606010001_backend_schema.sql`, `202606010007_backend_announcement_worker_grants.sql`
- DBM-09 Docker Compose cutover:
  - `deploy/docker-compose.yml`
  - `Dockerfile`
  - `README.md`
  - `docs/product/repo-context-inventory.md`
- DBM-10 cleanup:
  - `server/backend/supabaseRest.ts`
  - `supabase/migrations/`
  - `dist-server/index.mjs` via rebuild only
  - `README.md`
  - `docs/product/repo-context-inventory.md`
  - `docs/product/verification-and-self-review.md`

## DBM-00 acceptance status

- No runtime code changes: satisfied.
- Active Supabase dependency surface categorized: satisfied.
- `/api/*` contract and worker behavior recorded: satisfied.
- RPC-to-server-method map recorded: satisfied.
- Active docs/runtime scheduled for cleanup: satisfied through the next-touch file list.
