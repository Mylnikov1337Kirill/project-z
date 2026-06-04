# RunSite deployment preparation subtasks

Дата: 2026-06-04

Цель: разбить подготовку Project Z к первому RunSite деплою на независимые
агентные задачи. Ссылайтесь на ID задач (`RSP-00`, `RSP-01`, etc.) в новых
чатах.

Связанный общий план:
[`deploy-runsite-prep-plan-2026-06-04.md`](deploy-runsite-prep-plan-2026-06-04.md).

## Non-negotiable target state

- First public demo deployment targets RunSite, EU/no-card/free.
- Runtime is one Docker web service, not nginx plus separate API service.
- Browser and API remain same-origin.
- PostgreSQL access stays server-side through `DATABASE_URL`.
- Migrations are explicit and manual for the first deploy.
- Public demo must not expose QA pass controls or answer keys.
- The implementation must stay portable to another Docker host if RunSite is
  blocked.

## Execution order

Run tasks in order. RSP-05 and RSP-06 require account/platform access; if an
agent does not have that access, it should produce exact commands and note the
blocker instead of changing runtime assumptions.

### RSP-00. Deployment baseline and file inventory

Goal: establish the exact deploy surface before code edits.

Implementation:

- Inspect `Dockerfile`, `deploy/docker-compose.yml`, `deploy/nginx/default.conf`,
  `server/nodeHttp.ts`, `server/index.ts`, `package.json`, and README runtime
  sections.
- Confirm which paths currently serve API, healthcheck, static files and SPA
  fallback.
- Confirm the current generated artifacts and approximate sizes:
  - `dist/`;
  - `dist-server/index.mjs`.
- Record the exact files expected to change in RSP-01 through RSP-04.
- Do not change runtime code.

Acceptance:

- Agent response lists the current deploy topology and the next-touch file list.
- No repository files are edited.
- Any surprise that invalidates the one-container plan is called out.

Prompt:

```text
Выполни RSP-00 из docs/deploy-runsite-prep-subtasks-2026-06-04.md: сделай deployment baseline inventory для RunSite one-container деплоя. Не меняй код.
```

### RSP-01. Node static SPA serving

Goal: make the Node runtime serve the built Vite SPA without nginx.

Implementation:

- Extend the Node HTTP server so non-API GET/HEAD requests can serve files from
  `dist/`.
- Preserve existing behavior for:
  - `GET /healthz`;
  - `/api/*`;
  - `POST /api/admin/announcement-worker`.
- Add static behavior equivalent to the current nginx intent:
  - `/assets/*` serves existing files only and sets
    `Cache-Control: public, max-age=31536000, immutable`;
  - `/index.html` serves `dist/index.html` with `Cache-Control: no-store`;
  - SPA routes like `/map` fall back to `dist/index.html`;
  - missing assets return 404, not SPA fallback;
  - path traversal attempts return safe 404.
- Keep same-origin routing; do not add CORS.
- Add focused Node HTTP tests for static serving, SPA fallback and traversal
  protection.

Acceptance:

- `/healthz` and `/api/*` tests still pass.
- Static tests prove `/`, `/map`, `/index.html`, and `/assets/<file>` behavior.
- Missing asset and traversal tests pass.
- No browser-facing API response shape changes.

Prompt:

```text
Выполни RSP-01: добавь static SPA serving в Node runtime so one container can serve dist and /api/* same-origin. Preserve /healthz and /api/* behavior; add focused tests for root, SPA fallback, assets cache headers, missing assets and path traversal.
```

### RSP-02. One-container Docker image

Goal: make the project `Dockerfile` produce the complete deployable app image.

Implementation:

- Update the build stage to run both:
  - `npm run build`;
  - `npm run build:server`.
- Keep dependency installation deterministic through `npm ci`.
- Update the runtime stage to copy:
  - `dist-server/index.mjs` to `/app/index.mjs`;
  - `dist/` to `/app/dist`.
- Keep production runtime env defaults:
  - `NODE_ENV=production`;
  - `HOST=0.0.0.0`;
  - `PORT=3000`.
- Keep `EXPOSE 3000`, the `/healthz` healthcheck and `CMD ["node", "index.mjs"]`.
- Do not change `deploy/docker-compose.yml` unless a local compose smoke requires
  a minimal alignment update.

Acceptance:

- `docker build -t project-z:deploy .` succeeds on a machine with Docker.
- Running the image serves `/healthz`, `/`, `/assets/*`, SPA fallback and
  `/api/*`.
- The runtime image does not depend on host-mounted `dist/`.

Prompt:

```text
Выполни RSP-02: обнови Dockerfile so the runtime image includes both dist-server/index.mjs and dist/. Build with npm run build plus npm run build:server, keep PORT 3000 and /healthz healthcheck.
```

### RSP-03. Local verification and smoke coverage

Goal: prove the one-container runtime works before platform setup.

Implementation:

- Run:
  - `npm run lint`;
  - `npm run typecheck`;
  - `npm run test:unit`;
  - `npm run build`;
  - `npm run build:server`.
- If Docker is available, run:
  - `docker build -t project-z:deploy .`;
  - start the image with a valid `DATABASE_URL` if a migrated PostgreSQL is
    available;
  - smoke `/healthz`, `/`, one built `/assets/*` URL and `/api/me`.
- If Docker or Postgres is unavailable, record the blocker explicitly and keep
  unit/build checks as the completed gate.
- Capture any RunSite-relevant memory/runtime concerns from logs.

Acceptance:

- All available local checks pass.
- Any unavailable check has a concrete blocker and exact command to run later.
- The final response includes the smoke result matrix.

Prompt:

```text
Выполни RSP-03: проведи local verification для one-container deploy path. Запусти npm checks/builds, Docker build/smoke если Docker и Postgres доступны, и верни матрицу результатов с блокерами.
```

### RSP-04. Deploy runbook and environment documentation

Goal: document the exact RunSite deployment steps inside the repo.

Implementation:

- Add a deploy runbook at `docs/deploy-runsite-runbook-2026-06-04.md`.
- Include:
  - GitHub repo creation and first push steps;
  - RunSite project creation;
  - PostgreSQL free service creation;
  - Web Service from Git/Dockerfile setup;
  - service port `3000`;
  - env vars and which values are secrets;
  - manual migration command using the external DB URL;
  - runtime smoke checklist;
  - browser smoke checklist;
  - fallback to Render Web Service plus Aiven/Postgres if RunSite is blocked.
- State explicitly that `PROJECT_Z_QA_PASS` and `VITE_PROJECT_Z_QA_PASS` stay
  unset for public demo deploys.
- Do not include real secrets.

Acceptance:

- A fresh agent can follow the runbook without rereading the whole codebase.
- Runbook distinguishes internal RunSite DB URL for runtime from external DB URL
  for manual migrations.
- No secret value is committed.

Prompt:

```text
Выполни RSP-04: добавь RunSite deploy runbook в docs/deploy-runsite-runbook-2026-06-04.md. Зафиксируй GitHub, RunSite web service, free PostgreSQL, env vars, manual migrations, smoke checks, QA flags off, and fallback path. Не коммить реальные секреты.
```

### RSP-05. GitHub and RunSite provisioning

Goal: create the first live RunSite deployment.

Implementation:

- Initialize git if the repository still has no `.git`.
- Make a first commit containing the deploy-prep changes.
- Create a new GitHub repository for Project Z and push `main`.
- In RunSite:
  - create a project;
  - create a free PostgreSQL service;
  - save the generated password securely;
  - create a Web Service from the GitHub repo;
  - use Dockerfile build;
  - configure port `3000`;
  - set runtime env vars from the runbook.
- Use the RunSite internal PostgreSQL URL for web service `DATABASE_URL`.
- Do not enable public QA flags.

Acceptance:

- GitHub repo exists with `main` pushed.
- RunSite web service builds successfully or has a clear platform-side failure.
- RunSite PostgreSQL exists and both internal/external URLs are recorded outside
  committed files.
- No secrets are committed.

Prompt:

```text
Выполни RSP-05: создай GitHub repo и первый RunSite project/web service/PostgreSQL по docs/deploy-runsite-runbook-2026-06-04.md. Если нет доступа к аккаунтам, остановись на точном списке действий и не меняй runtime assumptions.
```

### RSP-06. RunSite migrations and production smoke

Goal: prove the live RunSite app works with the live PostgreSQL database.

Implementation:

- Run migrations locally or from a trusted shell with:
  - `DATABASE_URL='<RunSite external PostgreSQL URL>' npm run db:migrate`.
- If the external DB connection requires TLS, retry with `?sslmode=require`.
- Trigger/restart the RunSite web service after env var changes if needed.
- Smoke:
  - `GET /healthz`;
  - `GET /`;
  - `GET /api/me`;
  - browser first screen;
  - identity/session flow;
  - one mission submit path that writes progress;
  - refresh and confirm progress is read back.
- Check RunSite logs for:
  - missing `DATABASE_URL`;
  - DB connection failures;
  - static file 404 loops;
  - unexpected 500s;
  - accidental QA pass exposure.

Acceptance:

- Live app URL is recorded in the agent response.
- DB migrations are applied or the exact DB blocker is recorded.
- Smoke confirms same-origin SPA/API behavior and persisted progress.
- No QA pass UI is visible in the public demo.

Prompt:

```text
Выполни RSP-06: примени RunSite PostgreSQL migrations через external DB URL, затем сделай live smoke /healthz, /, /api/me and browser progress flow. Проверь логи и убедись, что QA PASS не включен.
```
