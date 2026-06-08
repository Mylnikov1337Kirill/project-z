# Agent Trail

Agent Trail - retro-оболочка обучающей игры про осознанное использование AI и agentic tools в инженерной работе.

## Development context

Единственный актуальный handoff/source of truth для продолжения разработки:

- [`../project-z-development-handoff.md`](../project-z-development-handoff.md)

Смежные документы, которые стоит читать по задаче:

- [`AGENTS.md`](AGENTS.md) - правила для будущих агентов и учебного контента;
- [`docs/architecture.md`](docs/architecture.md) - frontend architecture boundaries;
- [`docs/backend-only-cutover-subtasks-2026-06-02.md`](docs/backend-only-cutover-subtasks-2026-06-02.md) - активный план/status backend-only cutover;
- [`docs/own-postgres-migration-subtasks-2026-06-02.md`](docs/own-postgres-migration-subtasks-2026-06-02.md) - план миграции с Supabase на собственный PostgreSQL;
- [`docs/product/README.md`](docs/product/README.md) - AI-ready prep pack для agentic-сессий.

## Commands

Agent Trail requires Node `>=20.19.0`. The repo includes `.nvmrc`,
`.node-version`, and `.npmrc` with `engine-strict=true` so installs happen on a
supported runtime.

In Codex, the npm scripts below also guard themselves: if the current shell is
still on the local `/usr/local/bin/node` `v20.11.0`, they automatically rerun
Vite, TypeScript, ESLint, and Playwright through the bundled Codex Node. Outside
Codex, use a supported Node or set `PROJECT_Z_NODE_BIN=/path/to/node`.

```bash
npm install
npm run dev
npm run build
npm run build:server
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run validate:content
npm run preview
npm run start:server
```

Локальный dev server по умолчанию:

```text
http://localhost:5173
```

## QA PASS runtime

`QA PASS` is an opt-in QA-only path. Default `npm run dev`,
`npm run test:e2e`, `npm run build`, `npm run prod:local`, Docker Compose and
production runtime keep it disabled.

Use both flags when a QA browser build/test should expose the `QA PASS` button
and the backing API or Playwright fixture should accept force-pass attempts:

```bash
VITE_PROJECT_Z_QA_PASS=1 PROJECT_Z_QA_PASS=1 npm run dev
VITE_PROJECT_Z_QA_PASS=1 PROJECT_Z_QA_PASS=1 npm run test:e2e -- --grep "QA PASS"
```

Flag boundaries:

- `VITE_PROJECT_Z_QA_PASS=1` is a browser build-time flag. It only controls UI
  visibility and QA navigation shortcut eligibility.
- `PROJECT_Z_QA_PASS=1` is server-side runtime authority for
  `POST /api/missions/:missionId/qa-pass`. Keep it out of browser/client env
  and off in production.

For production-like local QA through Docker/nginx, pass both flags to the
wrapper so the static browser bundle is built with the UI flag and the API
container receives the server flag:

```bash
VITE_PROJECT_Z_QA_PASS=1 PROJECT_Z_QA_PASS=1 npm run prod:local
```

## Backend-only runtime

Backend-only is the active runtime target. BOC-01 through BOC-08 removed the
frontend local/backend switch, local progress persistence, local mission submit
path, frontend announcement mock, localStorage trap-guide state and optional
E2E mode branch. Continue backend-only cleanup through
[`docs/backend-only-cutover-subtasks-2026-06-02.md`](docs/backend-only-cutover-subtasks-2026-06-02.md);
do not add local-mode behavior or compatibility shims.

The active backend DB path is own PostgreSQL through the server-side
`ProjectZDatabase` boundary. Browser code still talks only to same-origin
`/api/*`; scoring, completion, badge awards, leaderboard aggregation and Pachca
outbox writes stay server-owned. Supabase REST/RPC clients and adapters are no
longer part of active runtime code.

The current backend slice includes:

- own PostgreSQL schema migrations under `server/db/migrations`;
- same-origin API routing through `/api/*` served by the Node API behind the
  reverse proxy;
- frontend HTTP adapters for the backend API path.

Required env vars for the backend API path:

```bash
DATABASE_URL=postgres://...
```

`DATABASE_URL` belongs to the Node runtime and must stay server-side only.
Historical Supabase migrations remain under `supabase/migrations` for reference
only; they are superseded by `server/db/migrations` and are no longer the active
runtime DB path.

Own-PostgreSQL migration contract:

- ADR: [`docs/adr/ADR-0007-self-hosted-postgres-db.md`](docs/adr/ADR-0007-self-hosted-postgres-db.md);
- agent task plan: [`docs/own-postgres-migration-subtasks-2026-06-02.md`](docs/own-postgres-migration-subtasks-2026-06-02.md);
- DB access: `DATABASE_URL`;
- implementation style: `pg + SQL`;
- first topology: PostgreSQL service in `deploy/docker-compose.yml`;
- migration policy: clean start, no Supabase data import.

DBM-10 cleanup is complete: active runtime/config uses `DATABASE_URL`, and
remaining Supabase references are historical migration/planning context.

`npm run db:migrate` applies `.sql` files from `server/db/migrations` through
`DATABASE_URL`. Run migrations explicitly before API/proxy smoke that touches
database-backed `/api/*` routes; the API startup path does not hide migration
failures.

The backend announcement worker is a separate server-only dry-run function over
`announcement_deliveries`:

```bash
PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN=...
PROJECT_Z_PACHCA_DELIVERY_MODE=dry-run
PROJECT_Z_ANNOUNCEMENT_BATCH_LIMIT=10
PROJECT_Z_ANNOUNCEMENT_MAX_ATTEMPTS=3
```

Call `POST /api/admin/announcement-worker` on the Node runtime with
`Authorization: Bearer $PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN` to mark pending
Pachca outbox rows as `dry_run`. Live delivery is intentionally blocked until a
later verification pass.

## Node backend runtime

The active backend runtime is the bundled Node HTTP artifact at
`dist-server/index.mjs`, built from the source entrypoint at `server/index.ts`.
The Node API image is described by `Dockerfile`, and the same-origin nginx
reverse proxy lives in `deploy/nginx/default.conf`, with local topology in
`deploy/docker-compose.yml`. Node `/api/*` parity is covered by fixture-backed
source tests.

The Node runtime uses built-in `node:http` and currently routes:

- `GET /healthz`;
- `/api/*` through the shared runtime-neutral backend handler;
- `POST /api/admin/announcement-worker` through the shared dry-run worker
  handler.

Build and run the Node backend bundle:

```bash
npm run build:server
DATABASE_URL=postgres://... PORT=3000 npm run start:server
```

`PORT` is optional and defaults to `3000`; `HOST` is optional and defaults to
`0.0.0.0`. `/api/*` routes need `DATABASE_URL`. The admin worker route also
needs `PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN` and keeps
`PROJECT_Z_PACHCA_DELIVERY_MODE=dry-run`.

Smoke the built server:

```bash
curl -i http://127.0.0.1:3000/healthz
curl -i http://127.0.0.1:3000/api/me
```

These focused and regression checks are useful for Node runtime confidence:

```bash
npm run test:unit -- server/nodeHttp.test.ts
npm run test:unit -- server/nodeApiParity.test.ts
npm run test:e2e -- e2e/backend-api.spec.ts
npm run test:e2e
```

Those smokes cover `GET /healthz`, adapter behavior, and Node-route parity for
the current `/api/*` contract: pilot sessions, identity, progress, mission
submit/idempotency, leaderboard privacy, unlock-seen, reflections, trap reads
and the admin worker auth/dry-run path.

`/api/*` smoke requires a migrated PostgreSQL database and `DATABASE_URL`.

Build and smoke the Node API image:

```bash
docker build -t agent-trail-api:local .
docker run --rm -d --name agent-trail-api-smoke -p 3000:3000 agent-trail-api:local
curl -i http://127.0.0.1:3000/healthz
docker stop agent-trail-api-smoke
```

Run the local reverse proxy topology after building the Vite static bundle:

```bash
npm run build
docker compose -f deploy/docker-compose.yml up -d db
DATABASE_URL=postgres://project_z:project_z_local_password@127.0.0.1:54321/project_z npm run db:migrate
PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN=local-worker-token \
docker compose -f deploy/docker-compose.yml up --build -d
curl -i http://127.0.0.1:8080/
curl -i http://127.0.0.1:8080/api/me
docker compose -f deploy/docker-compose.yml down
```

The nginx proxy serves `dist`, falls back SPA routes to `index.html`, proxies
`/api/*` and `/healthz` to the Node API service, forwards cookies,
authorization and forwarded host/protocol headers, preserves `Set-Cookie`, and
uses an access log format that avoids query strings, cookies and authorization
headers. The compose topology exposes Postgres on host port `54321` by default
for explicit local migrations; override it with `PROJECT_Z_DB_PORT` if needed.
Use `docker compose -f deploy/docker-compose.yml down --volumes` when you need a
fresh clean-start local database.
Docker/proxy smoke requires Docker Compose or equivalent container tooling; if
the CLI is unavailable, keep this gate explicitly blocked rather than treating a
plain Vite preview or direct Node `/healthz` check as reverse-proxy coverage.
