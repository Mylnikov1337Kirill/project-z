# Node backend migration Phase 0 contract

Date: 2026-06-01

Supersession note, 2026-06-02: this is a historical parity contract for the Node migration. It still records the pre-BOC state where local mode was default. The active cleanup target is backend-only; use `docs/backend-only-cutover-subtasks-2026-06-02.md` for current work.

Scope: baseline inventory for migrating Project Z from Netlify Functions to a Dockerized Node HTTP backend. This document is the parity contract for Phase 1 and later phases. It intentionally does not change runtime code.

## Non-goals

- Do not replace Netlify Functions in Phase 0.
- Do not add the Node HTTP server, Docker image, reverse proxy or `/healthz` yet.
- Do not change browser-facing API paths; the browser contract remains same-origin `/api/*`.
- Do not enable live Pachca delivery.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY`, worker tokens or Pachca secrets to frontend code or `VITE_*` env vars.

## Current runtime map

| Area | Current files | Notes |
| --- | --- | --- |
| Netlify browser API | `netlify/functions/api.ts` | Owns `/api/*` routing, request parsing, cookies, JSON responses, Supabase RPC calls, server-side mission evaluation and safe error logging. |
| Netlify announcement worker | `netlify/functions/announcement-worker.ts` | Server-only dry-run worker over `announcement_deliveries`; currently reachable only at `/.netlify/functions/announcement-worker`. |
| Supabase REST helper | `netlify/functions/backend/supabaseRest.ts` | Service-role REST/RPC client. Reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from server env. |
| Frontend HTTP base client | `src/shared/api/http/backendApiClient.ts` | Uses relative paths and `credentials: 'include'`; POST sends JSON with `content-type: application/json`. |
| Frontend progress adapter | `src/shared/api/progress/httpProgressRepository.ts` | Maps app progress/reflection/trap/leaderboard calls to `/api/*`. Server-owned gameplay writes deliberately throw here. |
| Frontend mission submit adapter | `src/shared/api/missions/httpMissionAttemptService.ts` | Posts raw answer, `chapterId`, `clientAttemptId` and `contentVersion`; does not send local `source`, `score` or `isCorrect`. |
| Service composition | `src/app/providers/AppServicesProvider.tsx` | Pre-BOC historical state: local mode was default; backend HTTP services were selected only with `VITE_PROJECT_Z_DATA_MODE=backend`. |
| Supabase migrations | `supabase/migrations/202606010001_backend_schema.sql` through `202606010007_backend_announcement_worker_grants.sql` | Tables, RLS, read model, service-role RPCs, mission submit transaction and announcement worker grants. |
| Backend-mode E2E fixtures | `e2e/backendModeFixtures.ts`, `e2e/backend-mode.spec.ts` | Fixture-backed browser smoke for backend mode without a real Supabase project. |
| Unit tests | `netlify/functions/api.test.ts`, `netlify/functions/announcement-worker.test.ts`, `src/shared/api/progress/httpProgressRepository.test.ts`, `src/shared/api/missions/httpMissionAttemptService.test.ts` | Current focused coverage for backend API behavior and frontend HTTP adapters. |

## Browser-facing API contract

All current browser API responses are JSON and set:

```text
cache-control: no-store
content-type: application/json; charset=utf-8
```

Errors use this shape:

```json
{ "error": "Human-readable message" }
```

Current body parsing in `netlify/functions/api.ts` accepts plain or base64-encoded JSON bodies. The explicit application body limit is `64 * 1024` bytes. Missing body is treated as `{}`. Invalid JSON returns `400` with `Нужен корректный JSON.`. Oversized JSON returns `413` with `Запрос слишком большой.`.

| Endpoint | Method | Auth/session | Request body | Success response | Current owner/tests |
| --- | --- | --- | --- | --- | --- |
| `/api/pilot-sessions` | `POST` | No existing cookie required. | `{ publicCode?: string }` | `{ pilotSession }` and `Set-Cookie`. | `netlify/functions/api.ts`; adapter coverage through `HttpProgressRepository.identify`. |
| `/api/me` | `GET` | Optional pilot cookie. | None. | `{ pilotSession, learner }`, both nullable. Invalid session returns nulls and expires the cookie. | `netlify/functions/api.ts`; backend-mode fixture smoke. |
| `/api/learners/identify` | `POST` | Existing cookie optional; API creates a pilot session if absent. | `{ nickname: string, fullName?: string }` | `{ learner }` and `Set-Cookie` if a session was created. | `netlify/functions/api.ts`; `HttpProgressRepository` unit coverage; backend-mode fixture smoke. |
| `/api/progress` | `GET` | Requires valid pilot cookie. | None. | `{ learner, progress, completedMissionIds, encounteredTrapIds, pendingUnlockChapterId }`. | `netlify/functions/api.ts`; `HttpProgressRepository` unit coverage; backend-mode fixture smoke. |
| `/api/missions/:missionId/attempts` | `POST` | Requires valid pilot cookie and identified learner via RPC. | `{ chapterId, answer, clientAttemptId, contentVersion }` | `{ evaluation, progress, trapDiscoveries, completion? }`. | `netlify/functions/api.ts`; `netlify/functions/api.test.ts`; `HttpMissionAttemptService` unit coverage; backend-mode fixture smoke. |
| `/api/chapter-reflections/:chapterId` | `GET` | Requires valid pilot cookie. | None. | `{ reflection }` where reflection is nullable. | `netlify/functions/api.ts`; `HttpProgressRepository` unit coverage; backend-mode fixture smoke. |
| `/api/chapter-reflections/:chapterId` | `POST` | Requires valid pilot cookie. | `{ optionId?, optionLabel?, note?, skipped }` | `{ reflection }`. | `netlify/functions/api.ts`; `HttpProgressRepository` unit coverage; backend-mode fixture smoke. |
| `/api/traps/discovered` | `GET` | Requires valid pilot cookie. | None. | `{ trapIds }` derived from current progress payload. | `netlify/functions/api.ts`; `HttpProgressRepository` unit coverage; backend-mode fixture smoke. |
| `/api/leaderboard` | `GET` | Current implementation does not require a pilot cookie. | None. | `{ entries }`; `fullName` is always `''`. | `netlify/functions/api.ts`; `netlify/functions/api.test.ts`; backend-mode fixture smoke. |
| `/api/unlocks/:chapterId/seen` | `POST` | Requires valid pilot cookie. | None or `{}`. | `{ progress }`. | `netlify/functions/api.ts`; `HttpProgressRepository` unit coverage; backend-mode fixture smoke. |

Important mission-submit parity details:

- `contentVersion` must equal `project-z-static-content-v1`; stale content returns `409`.
- The server evaluates the submitted raw answer with `evaluateMission`; client-provided `score`, `isCorrect`, completion facts and `source` are ignored.
- `clientAttemptId` is an idempotency key. A duplicate returns the persisted attempt evaluation, not a new evaluation of the retried answer body.
- Mission gate failures from the RPC map to player-safe `409` errors such as `Глава ещё закрыта.` or `Сцена ещё закрыта.`.
- Leaderboard responses must not expose `fullName`, raw answers, session ids or reflection notes.

## Cookie and header contract

Pilot session cookie:

```text
name: PROJECT_Z_PILOT_SESSION_COOKIE_NAME or project_z_pilot_session_id
Path=/
HttpOnly
SameSite=Lax
Max-Age=5184000
Secure only when x-forwarded-proto=https or rawUrl starts with https://
```

The API accepts only UUID-looking cookie values as pilot session ids. Invalid or missing values are treated as no session. `GET /api/me` expires the cookie with `Max-Age=0` when Supabase reports `invalid_pilot_session`.

Request headers that matter today:

- Browser API reads `cookie` for the pilot session.
- Browser API reads `x-forwarded-proto` to decide the `Secure` cookie attribute.
- Browser API currently does not read `x-forwarded-host`; future Node/proxy phases should still preserve it because the migration plan requires forwarding it and future absolute URL logic may depend on it.
- Worker reads `authorization: Bearer <PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN>`.
- Supabase REST helper sends `apikey`, `authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` and `content-type: application/json` to Supabase.

Node/reverse-proxy parity expectation:

- Preserve incoming `cookie`, `authorization`, `x-forwarded-proto` and `x-forwarded-host`.
- Preserve outgoing `Set-Cookie`, including multiple cookies when present.
- Keep API responses same-origin and relative; frontend must keep calling `/api/*`.
- Keep `cache-control: no-store` on API and worker responses.
- Keep JSON error shape stable.
- Keep logs safe: log method/path/status-style context, not raw request bodies, raw answers, cookies, service-role keys, worker tokens, Pachca secrets or full PII payloads.

## Announcement worker contract

Current endpoint:

```text
POST /.netlify/functions/announcement-worker
```

Target endpoint for the Node backend migration:

```text
POST /api/admin/announcement-worker
```

Current behavior in `netlify/functions/announcement-worker.ts`:

- Only `POST` is accepted; other methods return `405`.
- Requires `Authorization: Bearer <PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN>` before touching Supabase.
- `PROJECT_Z_PACHCA_DELIVERY_MODE` defaults to `dry-run`; any non-`dry-run` value returns `409` because live delivery is not implemented.
- Reads pending `announcement_deliveries` for channel `pachca`, status `pending`, `attempts_count < maxAttempts`, ordered by `created_at.asc`.
- Marks supported pending rows as `dry_run` with `attempts_count + 1`, `last_error: null`, `sent_at: null`.
- Unsupported channels or incomplete payloads are marked `failed` with bounded `last_error`.
- Safe info log includes only `deliveryId` and `mode`.

Worker limits:

| Env var | Default | Bounds | Notes |
| --- | ---: | ---: | --- |
| `PROJECT_Z_ANNOUNCEMENT_BATCH_LIMIT` | `10` | `1..25` | Number of pending rows to process. |
| `PROJECT_Z_ANNOUNCEMENT_MAX_ATTEMPTS` | `3` | `1..10` | Rows at or above this attempts count are skipped by selection/update filters. |

Node parity expectation:

- Keep the old Netlify worker available until cutover phases explicitly remove it.
- Add the target `POST /api/admin/announcement-worker` only after reusable worker logic exists.
- Keep token auth, dry-run-only mode, response counts, status transitions and safe logs equivalent.

## Runtime env vars

| Env var | Current status | Owner | Notes |
| --- | --- | --- | --- |
| `PORT` | Future Node runtime env, not consumed by current Netlify code. | Phase 2/3 Node server. | Reserve for `node:http` server listen port. |
| `SUPABASE_URL` | Required server env. | Netlify API, worker, Supabase REST helper. | Must not be exposed through `VITE_*`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required server env. | Netlify API, worker, Supabase REST helper. | Service-role secret; server only. |
| `PROJECT_Z_PILOT_SESSION_COOKIE_NAME` | Optional server env. | Netlify API. | Defaults to `project_z_pilot_session_id`; changing it invalidates old cookies unless migration handles both. |
| `PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN` | Required server env for worker. | Announcement worker. | Server-only bearer token. |
| `PROJECT_Z_PACHCA_DELIVERY_MODE` | Optional, defaults to `dry-run`; only `dry-run` is accepted. | Announcement worker. | Live mode is intentionally blocked. |
| `PROJECT_Z_ANNOUNCEMENT_BATCH_LIMIT` | Optional. | Announcement worker. | Default/bounds above. |
| `PROJECT_Z_ANNOUNCEMENT_MAX_ATTEMPTS` | Optional. | Announcement worker. | Default/bounds above. |
| `VITE_PROJECT_Z_DATA_MODE` | Optional frontend build-time env. | `AppServicesProvider`. | Pre-BOC historical switch: `backend` selected HTTP adapters; not a secret. BOC-01 removes it. |

## Supabase migration and RPC inventory

| Migration | Responsibility |
| --- | --- |
| `202606010001_backend_schema.sql` | Tables for pilot sessions, learners, progress, attempts, completions, badge awards, trap discoveries, reflections and announcement deliveries. |
| `202606010002_backend_rls.sql` | RLS policies and grants; authenticated users can read/write only permitted own data, service role owns server-side writes. |
| `202606010003_backend_read_models.sql` | `leaderboard_entries` view and JSON payload helper functions. |
| `202606010004_backend_session_profile_rpc.sql` | Pilot session, learner identity and progress RPCs. |
| `202606010005_backend_reflections_unlocks_rpc.sql` | Reflection read/write and unlock-seen RPCs. |
| `202606010006_backend_mission_attempt_rpc.sql` | Transactional mission attempt submit, completion, badge award and outbox write. |
| `202606010007_backend_announcement_worker_grants.sql` | Service-role grants needed by the announcement worker. |

Real Supabase deployment/RLS smoke is still a blocker for cutover. Current tests use mocked fetch or backend-mode route interception, not a live Supabase project.

## Test coverage baseline

Current automated baseline before Node extraction:

| Coverage | Current guard |
| --- | --- |
| API server-side mission evaluation ignores client score facts | `netlify/functions/api.test.ts`. |
| Mission gate errors map to player-safe API errors | `netlify/functions/api.test.ts`. |
| Duplicate `clientAttemptId` returns persisted evaluation | `netlify/functions/api.test.ts`. |
| Leaderboard omits `fullName` | `netlify/functions/api.test.ts` and backend-mode E2E. |
| Worker token auth and dry-run transition | `netlify/functions/announcement-worker.test.ts`. |
| Worker live mode blocked | `netlify/functions/announcement-worker.test.ts`. |
| Frontend HTTP progress endpoints | `src/shared/api/progress/httpProgressRepository.test.ts`. |
| Frontend mission submit body excludes local authority fields | `src/shared/api/missions/httpMissionAttemptService.test.ts`. |
| Backend-mode fixture smoke for identity/progress/traps/reflections/mission submit/leaderboard/unlock seen | `e2e/backend-mode.spec.ts` with `E2E_DATA_MODE=backend`. |

Baseline acceptance checks for Phase 0:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

Phase 0 result on 2026-06-01:

- `npm run lint` passed through `scripts/run-with-supported-node.mjs` fallback to Codex bundled Node v24.14.0.
- `npm run typecheck` passed through the same fallback.
- `npm run test:unit` passed: 14 files / 51 tests.
- `npm run build` passed through the same fallback; Vite kept the existing non-blocking chunk-size warning for the main JS bundle.
- Browser QA was not run because Phase 0 is documentation-only and does not change runtime or gameplay UI.

## Deploy assumptions before migration

- Active deploy topology is Netlify static hosting plus Netlify Functions.
- `netlify.toml` builds with `npm run build`, publishes `dist`, bundles functions with `esbuild`, rewrites `/api/*` to `/.netlify/functions/api/:splat`, and uses SPA fallback to `/index.html`.
- There is no Node HTTP server entrypoint yet.
- There is no Dockerfile or reverse proxy config yet.
- Pre-BOC historical state: local mode was default for development.
- Pre-BOC backend mode was opt-in and assumed same-origin `/api/*` plus cookies.
- Worker delivery is server-only dry-run; no live Pachca calls exist.

## Cutover blockers and risks

Do not remove Netlify runtime or switch production traffic until these are resolved:

- Runtime-neutral handler extraction must keep current Netlify wrappers passing.
- Node `node:http` entrypoint must serve `/healthz` and route `/api/*` through the same handlers.
- Node adapter must preserve the 64 KiB JSON body limit, base64/plain-body behavior where relevant, method/path routing, cookies, multiple `Set-Cookie` headers, JSON error shape and `no-store` headers.
- Reverse proxy must forward `cookie`, `authorization`, `x-forwarded-proto` and `x-forwarded-host`, and must preserve `Set-Cookie`.
- Target worker endpoint `POST /api/admin/announcement-worker` must match current worker auth and dry-run behavior before old worker removal.
- Real Supabase migration/RLS smoke has not run.
- Real backend-mode E2E against the deployed API has not run.
- Real worker dry-run smoke against a Supabase project has not run.
- Live Pachca delivery is intentionally unavailable and must stay blocked unless a later explicit task changes the product/security decision.
- Active docs/runbooks must not describe Netlify as active runtime after cutover, except historical ADR context.

## Phase 1 handoff checklist

Next phase: `Phase 1. Runtime-neutral API modules` from `docs/node-backend-migration-agent-phases-2026-06-01.md`.

Phase 1 should:

- Extract routing/request validation/cookie helpers/JSON response helpers/error mapping/safe logging from `netlify/functions/api.ts` into runtime-neutral modules.
- Extract Supabase REST access behind runtime-neutral server helpers or keep a wrapper boundary that can be called from both Netlify and Node.
- Extract announcement worker logic so both `/.netlify/functions/announcement-worker` and future `POST /api/admin/announcement-worker` can call the same implementation.
- Leave current Netlify files as thin adapters.
- Preserve every endpoint, env var, cookie/header behavior and test invariant listed in this document.
- Add focused tests around routing, validation, pilot cookie behavior, duplicate `clientAttemptId`, leaderboard privacy, worker auth and dry-run transitions.
