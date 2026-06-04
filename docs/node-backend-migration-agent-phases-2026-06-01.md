# План запуска агентов: миграция с Netlify Functions на Node backend

Дата: 2026-06-01

Статус на 2026-06-02: исторический план Node migration Phase 0-8. Не использовать его local-mode инварианты как текущую цель. Активный план удаления local mode: `docs/backend-only-cutover-subtasks-2026-06-02.md`.

Источник: `/Users/kirillmylnikov/Downloads/PLAN (1).md`

Цель: разложить миграцию Project Z с Netlify Functions на собственный Dockerized Node HTTP backend на последовательные фазы, которые можно отдавать отдельным агентам без потери контекста и без преждевременного cutover.

## Как запускать

Запускать фазы строго по порядку. Каждый следующий агент начинает только после того, как предыдущий оставил рабочее состояние, обновил релевантные docs/handoff и перечислил пройденные проверки.

Перед каждой фазой агент читает:

- `/Users/kirillmylnikov/Dev/ai/project-z-development-handoff.md`
- `/Users/kirillmylnikov/Dev/ai/project-z/AGENTS.md`
- `/Users/kirillmylnikov/Dev/ai/project-z/docs/architecture.md`
- `/Users/kirillmylnikov/Dev/ai/project-z/docs/adr/ADR-0006-backend-db-rls-and-api.md`
- `/Users/kirillmylnikov/Dev/ai/project-z/docs/product/integration-next-steps.md`
- `/Users/kirillmylnikov/Dev/ai/project-z/docs/node-backend-migration-phase-0-contract-2026-06-01.md` после выполнения Phase 0
- этот файл

Глобальные инварианты для всех фаз:

- браузерный контракт остается `/api/*`;
- Supabase остается текущей БД/RPC на этой миграции;
- `SUPABASE_SERVICE_ROLE_KEY` и worker token остаются только на сервере;
- frontend не получает Pachca secrets, Supabase service role key или server-only env vars;
- live Pachca delivery не включается; worker работает только как token-protected dry-run, если отдельная задача явно не меняет это решение;
- local mode остается рабочим для разработки до production cutover;
- gameplay/UI не должен показывать backend, Supabase, Netlify, Pachca, debug, phase, TODO/mock/runtime status copy;
- исторические ADR могут упоминать Netlify как прошлый контекст, но активные runbooks/deploy docs после cutover должны вести на Node backend.

## Phase 0. Baseline inventory and migration contract

Цель: зафиксировать текущий runtime-контракт до кода, чтобы следующие агенты не гадали, что считается parity.

Задание агенту:

```text
В Project Z подготовь Phase 0 для миграции Netlify Functions -> Node backend. Не переписывай runtime. Инвентаризируй текущие Netlify API/worker endpoints, env vars, cookies, headers, body limits, test coverage and deploy assumptions. Зафиксируй parity contract and cutover risks in docs, then run baseline checks.
```

Сабтаски:

- Составить карту текущих файлов `netlify/functions/*`, backend helpers, tests, Supabase migrations and frontend HTTP clients.
- Зафиксировать все browser-facing endpoints:
  - `/api/pilot-sessions`
  - `/api/me`
  - `/api/learners/identify`
  - `/api/progress`
  - `/api/missions/:missionId/attempts`
  - reflections
  - traps
  - leaderboard
  - unlock-seen
- Зафиксировать worker migration:
  - old: `/.netlify/functions/announcement-worker`
  - target: `POST /api/admin/announcement-worker`
- Зафиксировать runtime env vars:
  - `PORT`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - optional `PROJECT_Z_PILOT_SESSION_COOKIE_NAME`
  - `PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN`
  - `PROJECT_Z_PACHCA_DELIVERY_MODE=dry-run`
  - batch/attempt limits already used by current code.
- Зафиксировать compatibility expectations for cookies, `set-cookie`, `authorization`, `x-forwarded-proto`, `x-forwarded-host`, JSON error shape, `no-store` headers and safe logs.
- Добавить или обновить небольшой migration checklist doc if needed; do not touch runtime code unless a typo/doc import blocks checks.

Acceptance gate:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- Документ перечисляет parity contract, env vars, endpoints and cutover blockers.
- Handoff updated with Phase 0 status and exact next phase.

## Phase 1. Runtime-neutral API modules

Цель: вынести Netlify-specific handler logic в runtime-neutral backend modules, сохранив текущий Netlify wrapper working.

Задание агенту:

```text
Выполни Phase 1: выдели runtime-neutral backend modules from current Netlify API and announcement worker. Netlify functions must remain operational as thin wrappers. Browser-facing `/api/*` behavior must not change.
```

Сабтаски:

- Выбрать владельца backend modules, например `src/server/*` или `server/*`, с учетом `tsconfig`, Vitest and build boundaries.
- Вынести общую маршрутизацию `/api/*` из `netlify/functions/api.ts` в pure/request-adapter-friendly modules.
- Вынести Supabase REST access, request validation, cookie handling, response helpers, JSON/no-store/error helpers and safe logging behind runtime-neutral functions.
- Вынести announcement worker logic в reusable handler callable from both Netlify wrapper and future Node route.
- Оставить `netlify/functions/api.ts` and `announcement-worker.ts` as thin adapters.
- Preserve duplicate `clientAttemptId` behavior: duplicate returns persisted evaluation, not a new answer evaluation.
- Preserve leaderboard privacy: no `fullName`.
- Preserve dry-run worker transitions and token auth.
- Add or move focused unit tests to target the extracted modules, while keeping existing Netlify tests passing.

Acceptance gate:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- Focused tests cover API routing, validation, pilot cookie behavior, duplicate `clientAttemptId`, leaderboard without `fullName`, worker auth and dry-run transitions.
- No frontend API path changed.
- Handoff updated with extracted module map and Phase 2 instructions.

## Phase 2. Node HTTP entrypoint

Цель: добавить собственный Node HTTP runtime рядом с Netlify, без cutover and deletion.

Задание агенту:

```text
Выполни Phase 2: добавь Node entrypoint on built-in `node:http` that serves `GET /healthz` and `/api/*` through the runtime-neutral handlers from Phase 1. Do not remove Netlify yet.
```

Сабтаски:

- Добавить Node entrypoint, например `server/index.ts` or `src/server/index.ts`, using built-in `node:http`.
- Реализовать `GET /healthz`.
- Подключить `/api/*` routes to Phase 1 handlers.
- Поддержать:
  - cookies and `set-cookie`;
  - request body size limit;
  - method/path routing;
  - `x-forwarded-proto` and `x-forwarded-host`;
  - JSON responses and JSON errors;
  - `cache-control: no-store` for API responses;
  - safe logging without secrets and raw PII payloads.
- Добавить tests for Node request adapter without requiring real network when practical.
- Add a local smoke command or documented command for `GET /healthz` and one representative API route.
- Keep Netlify wrappers compiling and tested.

Acceptance gate:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- Local Node entrypoint can answer `GET /healthz`.
- Representative `/api/*` request reaches the same handler behavior as Netlify wrapper.
- Handoff updated with how to run the Node API locally and Phase 3 instructions.

## Phase 3. Server build and local run scripts

Цель: сделать Node backend buildable/runnable as a deployable artifact, still before Docker/proxy cutover.

Задание агенту:

```text
Выполни Phase 3: add server build/deploy scripts. Produce an esbuild bundle in `dist-server/index.mjs` and add `build:server` / `start:server` scripts. Keep frontend build and existing tests green.
```

Сабтаски:

- Add `esbuild` or an existing repo-compatible server bundling setup.
- Add package scripts:
  - `build:server`
  - `start:server`
  - optionally `dev:server` only if it follows existing script style.
- Ensure server bundle outputs `dist-server/index.mjs`.
- Keep ESM compatibility with current `"type": "module"`.
- Ensure TypeScript, ESLint and Vitest include the new server files intentionally.
- Document required runtime env vars and local run steps in active docs/README.
- Add smoke instructions for:
  - `npm run build:server`
  - `PORT=... npm run start:server`
  - `curl http://127.0.0.1:PORT/healthz`
- Do not yet add Docker or reverse proxy config unless required to prove bundle viability.

Acceptance gate:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- `npm run build:server`
- `npm run start:server` smoke with `GET /healthz`.
- Handoff updated with server build/run details and Phase 4 instructions.

## Phase 4. Node API parity and backend-mode smoke

Цель: убедиться, что Node runtime реально покрывает текущий backend contract, а не только healthcheck.

Задание агенту:

```text
Выполни Phase 4: expand tests and smoke coverage so Node `/api/*` has parity with the existing Netlify API. Keep Netlify wrappers until cutover.
```

Сабтаски:

- Move or duplicate important Netlify API tests onto the runtime-neutral/Node handler layer.
- Cover:
  - pilot session creation and cookie behavior;
  - `GET /api/me`;
  - identify;
  - progress read;
  - mission submit;
  - duplicate `clientAttemptId`;
  - leaderboard without `fullName`;
  - unlock-seen acceptance semantics;
  - reflections save/read;
  - traps discovered;
  - admin worker token auth;
  - worker dry-run status transition.
- Add backend-mode E2E smoke path against real Node route/proxy candidate where possible.
- If real Supabase env is unavailable, keep tests fixture-backed and document the exact missing real-env gate.
- Preserve local-first E2E suite and default local mode.

Acceptance gate:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- `npm run build:server`
- Existing backend-mode fixture smoke still passes.
- New Node parity tests pass.
- Handoff updated with remaining real-Supabase/proxy gaps and Phase 5 instructions.

## Phase 5. Docker image and reverse proxy

Цель: собрать deployable topology: static `dist` + Node API behind reverse proxy.

Задание агенту:

```text
Выполни Phase 5: add Dockerfile for the Node API and reverse proxy config that serves Vite `dist`, performs SPA fallback, and proxies `/api/*` to the Node backend. Do not remove Netlify until the proxy path is verified.
```

Сабтаски:

- Add Dockerfile for Node API.
- Decide and document reverse proxy technology/config location, for example nginx or Caddy, consistent with target deployment.
- Proxy responsibilities:
  - serve Vite `dist`;
  - SPA fallback to `index.html`;
  - proxy `/api/*` to Node API;
  - forward `cookie`, `set-cookie`, `authorization`, `x-forwarded-proto`, `x-forwarded-host`;
  - keep API no-store behavior intact;
  - avoid leaking secrets in logs.
- Add local Docker/proxy smoke docs or scripts if the repo already has a pattern.
- Verify container healthcheck.
- Verify frontend still calls relative `/api/*`; no hardcoded Netlify path except historical docs/tests that will be removed in Phase 7.

Acceptance gate:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- `npm run build:server`
- Docker build succeeds.
- Container `GET /healthz` succeeds.
- Reverse proxy serves app shell and proxies at least one `/api/*` route.
- Handoff updated with proxy run instructions and Phase 6 instructions.

## Phase 6. Real Supabase integration smoke before cutover

Цель: проверить не только fixture behavior, но и текущую Supabase/RPC связку through Node backend.

Задание агенту:

```text
Выполни Phase 6: run real integration smoke against the existing Supabase env through the Node backend/proxy. Do not enable live Pachca. If required secrets are unavailable, stop with a precise blocked checklist.
```

Сабтаски:

- Confirm available env vars without printing secret values.
- Run real smoke through Node backend:
  - `GET /healthz`;
  - pilot session;
  - identify;
  - progress;
  - mission submit;
  - duplicate `clientAttemptId`;
  - leaderboard;
  - unlock-seen;
  - reflection save/read;
  - traps discovered.
- Run worker dry-run smoke:
  - `POST /api/admin/announcement-worker`;
  - token auth rejection;
  - token auth success;
  - dry-run transition in `announcement_deliveries`.
- Run backend-mode E2E against real Node route/proxy before cutover.
- Inspect logs for secret/raw PII leakage.
- Record exact Supabase project/env assumptions in docs without exposing secrets.

Acceptance gate:

- All real-smoke calls pass, or a blocked checklist states exact missing env/table/RPC/policy issue.
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- `npm run build:server`
- Backend-mode E2E against real Node/proxy passes when env is available.
- Handoff updated with real smoke results and Phase 7 cutover readiness.

## Phase 7. Cutover and Netlify runtime removal

Цель: переключить runtime path to Node backend and remove active Netlify runtime/config.

Задание агенту:

```text
Выполни Phase 7: cut over active runtime docs/config to the Node backend and remove Netlify Functions/config from the runtime path. Only start this phase if Phase 6 passed or the user explicitly accepts the remaining blocker.
```

Сабтаски:

- Switch active deploy/run docs to Node backend + reverse proxy.
- Remove `netlify/functions` runtime code after equivalent Node coverage exists.
- Remove `netlify.toml` and active Netlify runtime references.
- Move/rename tests from Netlify paths to server paths.
- Update `eslint`, `vitest`, `tsconfig`, README/docs so active instructions no longer propose Netlify Functions.
- Update frontend/backend docs to state:
  - browser uses relative `/api/*`;
  - worker endpoint is `POST /api/admin/announcement-worker`;
  - Node API owns server env/secrets;
  - reverse proxy serves static `dist` and proxies `/api/*`.
- Run grep/runtime audit for:
  - `/.netlify/functions`
  - `netlify/functions`
  - `netlify.toml`
  - stale worker endpoint
  - docs that present Netlify as active runtime.
- Keep historical ADR mentions only when clearly past-tense.

Acceptance gate:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- `npm run build:server`
- Backend-mode E2E against Node/proxy passes.
- Docker build and container healthcheck pass.
- Grep audit shows no active Netlify API path remains.
- Handoff updated with cutover status and Phase 8 verification plan.

## Phase 8. Full regression, browser QA and closeout

Цель: завершить миграцию как проверенное состояние, пригодное для следующей разработки.

Задание агенту:

```text
Выполни Phase 8: final verification and closeout after Node backend cutover. Focus on regressions, docs accuracy, and future-agent handoff. Do not add new backend features.
```

Сабтаски:

- Run final command suite:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:unit`
  - `npm run build`
  - `npm run build:server`
  - Docker build
  - container healthcheck
  - backend-mode E2E against Node/proxy
  - local-first E2E if runtime changes could affect the SPA bundle or routes.
- Run browser QA of the app shell served by the reverse proxy:
  - map loads;
  - representative mission flow still works;
  - leaderboard route renders;
  - no browser console errors;
  - gameplay UI has no backend/debug/runtime copy.
- Re-run grep audit for stale Netlify runtime references.
- Update:
  - `/Users/kirillmylnikov/Dev/ai/project-z-development-handoff.md`
  - `docs/product/repo-context-inventory.md` if commands/paths changed;
  - `docs/product/verification-and-self-review.md` if verification expectations changed;
  - README active setup/deploy sections.
- Leave exact known-good commands, ports, env expectations and remaining risks.

Acceptance gate:

- Final checks pass or failures are documented as explicit blockers.
- Handoff describes Node backend as active runtime.
- Active docs no longer tell agents to use Netlify Functions.
- User receives concise final status with changed files, verification and remaining operational risks.

## Phase dependency summary

| Phase | Depends on | Main output | Can run in parallel? |
| --- | --- | --- | --- |
| 0 | current repo only | parity contract and baseline | No |
| 1 | Phase 0 | runtime-neutral handlers, Netlify wrappers intact | No |
| 2 | Phase 1 | Node HTTP entrypoint | No |
| 3 | Phase 2 | `dist-server/index.mjs`, scripts | No |
| 4 | Phase 3 | Node parity tests and backend-mode smoke | No |
| 5 | Phase 4 | Dockerfile and reverse proxy config | No |
| 6 | Phase 5 | real Supabase/worker smoke results | No |
| 7 | Phase 6 | Netlify runtime removed, Node cutover | No |
| 8 | Phase 7 | final verified handoff | No |

## Stop conditions

Stop and ask the user before continuing if:

- real Supabase env vars are missing for Phase 6 and the phase cannot be honestly verified;
- a migration requires changing the browser-facing `/api/*` contract;
- a task would expose service-role keys or worker tokens to frontend code;
- live Pachca delivery becomes necessary;
- deleting Netlify runtime is requested before Node parity and real-smoke gates pass;
- frontend/gameplay behavior changes outside the migration surface.
