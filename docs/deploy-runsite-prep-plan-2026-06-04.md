# RunSite deployment preparation plan

Дата: 2026-06-04

Цель: подготовить Project Z к первому бесплатному EU/no-card деплою на
RunSite как один Docker web service с managed PostgreSQL в том же RunSite
project.

Подробная очередь задач для отдельных агентов:
[`deploy-runsite-prep-subtasks-2026-06-04.md`](deploy-runsite-prep-subtasks-2026-06-04.md).

## Decision summary

- Target hosting: RunSite all-in for the first demo deployment.
- Budget and billing constraint: strictly `0 EUR/USD`, no payment card.
- Geography and policy constraint: EU-first hosting.
- Delivery path: new GitHub repository connected to RunSite auto-deploy.
- Runtime shape: one Docker image that serves both the Vite SPA and Node
  `/api/*` routes.
- Database: RunSite managed PostgreSQL free plan, using the internal
  PostgreSQL URL as runtime `DATABASE_URL`.
- Migrations: run manually before the first smoke using the external PostgreSQL
  URL.
- Public QA flags: do not enable `PROJECT_Z_QA_PASS` or
  `VITE_PROJECT_Z_QA_PASS` in the public demo deployment.

## Current state

- `npm run build` creates the browser bundle in `dist/`.
- `npm run build:server` creates the Node backend bundle in
  `dist-server/index.mjs`.
- The current `Dockerfile` builds and runs only the Node API bundle.
- The current production-like local topology uses three services in
  `deploy/docker-compose.yml`: PostgreSQL, API, and nginx.
- nginx currently serves `dist/`, applies SPA fallback, and proxies `/api/*`
  plus `/healthz` to the API container.
- RunSite can build from Git/Dockerfile and run one web service, but the target
  deployment should not depend on a separate nginx service.

## Required repository changes

- Extend the Node HTTP runtime so it can serve static files from `dist/`:
  - preserve existing `/healthz` and `/api/*` behavior;
  - serve `/assets/*` with long-lived immutable cache headers;
  - serve `/index.html` and SPA fallback with `no-store`;
  - return safe 404s for missing files and path traversal attempts;
  - keep same-origin API semantics and avoid adding CORS.
- Update the Docker build so the runtime image contains both:
  - `dist-server/index.mjs`;
  - `dist/`.
- Keep runtime defaults compatible with RunSite:
  - `HOST=0.0.0.0`;
  - `PORT=3000`;
  - `NODE_ENV=production`;
  - `EXPOSE 3000`;
  - healthcheck against `/healthz`.
- Add deploy documentation that records:
  - GitHub repository setup;
  - RunSite project/web service/PostgreSQL setup;
  - environment variables;
  - migration command;
  - smoke checklist;
  - fallback path if RunSite signup or deploy is blocked.

## RunSite setup checklist

1. Create a new GitHub repository for `project-z` and push `main`.
2. In RunSite, create a project for Project Z.
3. Add a free PostgreSQL service, save both internal and external URLs.
4. Add a Web Service from the GitHub repo using the repository `Dockerfile`.
5. Configure service port `3000`.
6. Add runtime env vars:

```text
DATABASE_URL=<RunSite internal PostgreSQL URL>
PROJECT_Z_PILOT_SESSION_COOKIE_NAME=project_z_pilot_session_id
PROJECT_Z_PACHCA_DELIVERY_MODE=dry-run
PROJECT_Z_ANNOUNCEMENT_BATCH_LIMIT=10
PROJECT_Z_ANNOUNCEMENT_MAX_ATTEMPTS=3
PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN=<generated secret>
```

7. Before the first API smoke, run migrations against the external DB URL:

```bash
DATABASE_URL='<RunSite external PostgreSQL URL>' npm run db:migrate
```

If the external database connection fails due to TLS negotiation, retry with a
URL that includes `?sslmode=require`.

## Verification gates

Run before deploying:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run build:server
docker build -t project-z:deploy .
```

Run after container start or RunSite deploy:

```bash
curl -i https://<service>.runsite.app/healthz
curl -i https://<service>.runsite.app/
curl -i https://<service>.runsite.app/api/me
```

Browser smoke:

- open the RunSite URL;
- verify the first screen renders;
- complete identity/session flow;
- submit at least one mission path that writes progress;
- refresh and confirm progress is read back from the backend.

## Fallback

If RunSite account creation, GitHub connection, Dockerfile build, free web
service, or free PostgreSQL provisioning is blocked, keep the same one-container
artifact and use this fallback:

- Render free Web Service in Frankfurt for the Docker web runtime;
- Aiven free PostgreSQL if no-card signup is available in the moment;
- manual migrations with the external DB URL before smoke.

Do not introduce platform-specific runtime code for the fallback. The portable
artifact remains: Docker + Node HTTP + `DATABASE_URL`.

## References checked on 2026-06-04

- RunSite overview/pricing: https://runsite.app/
- RunSite quickstart: https://docs.runsite.app/getting-started/quickstart/
- RunSite PostgreSQL connection docs:
  https://docs.runsite.app/services/postgresql/connecting/
- Koyeb pricing FAQ, used to reject Koyeb as primary under the no-card
  constraint: https://www.koyeb.com/docs/faqs/pricing
