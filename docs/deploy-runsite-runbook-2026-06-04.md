# RunSite deploy runbook

Date: 2026-06-04

Goal: first public Project Z demo on RunSite using one Docker Web Service and
one free RunSite PostgreSQL service. The browser app and `/api/*` stay
same-origin. PostgreSQL stays server-side through `DATABASE_URL`.

Related preparation docs:

- [`deploy-runsite-prep-plan-2026-06-04.md`](deploy-runsite-prep-plan-2026-06-04.md)
- [`deploy-runsite-prep-subtasks-2026-06-04.md`](deploy-runsite-prep-subtasks-2026-06-04.md)

## Target topology

- GitHub repository: source of truth for RunSite auto-deploys.
- RunSite project: one project for the demo environment.
- RunSite PostgreSQL: free PostgreSQL service in the same RunSite project.
- RunSite Web Service: builds this repository root `Dockerfile`.
- Runtime container:
  - serves `dist/` through the Node HTTP runtime;
  - serves `/api/*` and `/healthz` from the same origin;
  - listens on `HOST=0.0.0.0` and `PORT=3000`;
  - does not need nginx, a RunSite Static Site, or a separate API service.

The deployable artifact remains portable Docker. Do not add RunSite-specific
runtime code, CORS, or a separate static-hosting path.

## Secrets rule

Never commit real secret values, database URLs, service passwords, worker
tokens, `.env` files, screenshots with visible credentials, or copied RunSite
dashboard connection strings.

Use placeholders in committed docs:

```text
<runsite-internal-postgresql-url>
<runsite-external-postgresql-url>
<generated-worker-token>
<github-owner>
<service-url>
```

Store real values only in RunSite environment variables and the project password
manager.

## Pre-deploy local gate

Run these checks before creating the live service:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run build:server
docker build -t project-z:deploy .
```

If Docker is unavailable locally, keep that as an explicit deploy blocker and
run the Docker build from another trusted machine before provisioning RunSite.

Generated `dist/` and `dist-server/` files are build outputs and are ignored by
git. RunSite must build them from the Dockerfile, not receive them as committed
artifacts.

## GitHub setup

If the project directory is not a git repository yet:

```bash
git init
```

Create the first commit after reviewing the staged diff for accidental secrets:

```bash
git status --short
git add .
git diff --cached --check
git commit -m "Prepare Project Z RunSite deployment"
git branch -M main
```

Create and push the GitHub repository. With GitHub CLI:

```bash
gh repo create <github-owner>/project-z --private --source . --remote origin --push
```

Without GitHub CLI, create an empty repository in GitHub, then run:

```bash
git remote add origin git@github.com:<github-owner>/project-z.git
git push -u origin main
```

Either private or public visibility is acceptable for the deploy mechanics. Use
private unless the owner explicitly wants the source public.

## RunSite PostgreSQL

1. Open the RunSite dashboard.
2. Create a new project, for example `project-z-demo`.
3. In that project, create a new PostgreSQL service on the free plan.
4. Use PostgreSQL 17 if RunSite offers a version choice; otherwise use a
   RunSite-supported PostgreSQL version compatible with standard SQL migrations.
5. Use stable names if the dashboard asks:
   - service: `project-z-db`;
   - database: `project_z`;
   - user: `project_z`.
6. Save the generated password immediately in the password manager. RunSite
   masks it after creation.
7. Copy both PostgreSQL URLs from the database Overview tab into the password
   manager:
   - Internal URL: only for other RunSite services in the same project.
   - External URL: only for trusted shells outside RunSite, including manual
     migrations from a laptop.

Do not construct either URL by hand. Copy the dashboard values exactly.

## RunSite Web Service

1. In the same RunSite project, create `New service` -> `Web Service`.
2. Connect GitHub and select the `project-z` repository.
3. Select branch `main`.
4. Select Dockerfile-based deploy. The Dockerfile is at repository root:
   `Dockerfile`.
5. Leave custom build/start commands empty unless RunSite explicitly requires
   them for Docker services. The Dockerfile already runs `npm ci`,
   `npm run build`, `npm run build:server`, and starts `node index.mjs`.
6. Select the free Web Service plan.
7. Configure service port `3000`.
8. Configure the health check path as `/healthz` if the dashboard exposes that
   setting.
9. Keep auto-deploy from `main` enabled for the demo unless the owner wants
   manual deploys.

Do not create a RunSite Static Site for `dist/`. The Node Web Service serves the
SPA and API from the same origin.

## Runtime environment variables

Set these on the RunSite Web Service, not in committed files:

| Name | Value | Secret | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | `<runsite-internal-postgresql-url>` | Yes | Use the internal RunSite PostgreSQL URL for runtime. It resolves inside the RunSite project and keeps DB traffic private. |
| `NODE_ENV` | `production` | No | Dockerfile already sets this; adding it in RunSite is okay. |
| `HOST` | `0.0.0.0` | No | Dockerfile already sets this. Required for public service binding. |
| `PORT` | `3000` | No | Dockerfile already sets this. Also configure service port `3000` in RunSite. |
| `PROJECT_Z_PILOT_SESSION_COOKIE_NAME` | `project_z_pilot_session_id` | No | Optional runtime default, set explicitly for clarity. |
| `PROJECT_Z_PACHCA_DELIVERY_MODE` | `dry-run` | No | Keep dry-run for the public demo. Live Pachca delivery is out of scope. |
| `PROJECT_Z_ANNOUNCEMENT_BATCH_LIMIT` | `10` | No | Admin worker dry-run batch size. |
| `PROJECT_Z_ANNOUNCEMENT_MAX_ATTEMPTS` | `3` | No | Admin worker dry-run retry cap. |
| `PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN` | `<generated-worker-token>` | Yes | Generate a random token and store it in the password manager. Needed only for authenticated admin worker calls. |

Generate the worker token locally, then paste only the value into RunSite and
the password manager:

```bash
openssl rand -hex 32
```

Do not set these variables for public demo deploys:

| Name | Required state | Why |
| --- | --- | --- |
| `PROJECT_Z_QA_PASS` | Unset | Server-side force-pass endpoint must stay disabled. |
| `VITE_PROJECT_Z_QA_PASS` | Unset | Browser QA PASS UI and shortcuts must not be built into the public bundle. |

If RunSite has separate build-time and runtime env sections, keep
`VITE_PROJECT_Z_QA_PASS` unset in both.

## Manual migrations

Run migrations explicitly before the first API smoke that touches database-backed
routes.

Use the external RunSite PostgreSQL URL from a trusted local shell:

```bash
npm ci
DATABASE_URL='<runsite-external-postgresql-url>' npm run db:migrate
```

Use the external URL here because local shells cannot resolve the internal
RunSite hostname. Do not put the external URL into the RunSite Web Service
runtime env.

Expected successful output includes `Applied migration ...`,
`Skipping already applied migration ...`, or `No pending database migrations.`

If the external DB connection fails because TLS is required, retry with
`sslmode=require`:

```bash
DATABASE_URL='<runsite-external-postgresql-url>?sslmode=require' npm run db:migrate
```

If the URL already has query parameters, append `&sslmode=require` instead.

Do not move migrations into the Docker `CMD` for the first deploy. Keep the
first public rollout manual and observable.

## Runtime smoke checklist

After the RunSite build succeeds and migrations have run, set:

```bash
APP_URL='https://<service>.runsite.app'
```

Smoke the public runtime:

```bash
curl -fsS "$APP_URL/healthz"
curl -fsSI "$APP_URL/"
curl -fsSI "$APP_URL/index.html"
curl -fsSI "$APP_URL/map"
curl -fsS "$APP_URL/api/me"
```

Expected results:

- `/healthz` returns HTTP 200 and `{"status":"ok"}`.
- `/`, `/index.html`, and `/map` return HTTP 200 HTML from the SPA.
- `/index.html` and SPA fallback responses include `Cache-Control: no-store`.
- `/api/me` returns HTTP 200 JSON. Before identity setup it should contain
  `"learner":null` and `"pilotSession":null`.
- No request requires CORS because browser and API use the same origin.

Smoke one built asset by extracting an `/assets/...` path from the HTML:

```bash
ASSET_PATH="$(curl -fsS "$APP_URL/" | sed -n 's/.*src="\([^"]*\/assets\/[^"]*\.js\)".*/\1/p' | head -n 1)"
curl -fsSI "$APP_URL$ASSET_PATH"
```

Expected asset result: HTTP 200 with
`Cache-Control: public, max-age=31536000, immutable`.

Check missing assets return 404 instead of the SPA fallback:

```bash
curl -i "$APP_URL/assets/definitely-missing.js"
```

Expected result: HTTP 404.

## Browser smoke checklist

Use a fresh browser profile or incognito window:

1. Open `https://<service>.runsite.app/`.
2. Confirm the first screen renders without console errors.
3. Complete the normal identity/session flow.
4. Confirm the map renders and Chapter 1 is reachable.
5. Complete one normal mission path through the UI without QA PASS.
6. Refresh the page.
7. Confirm completed progress is still present after refresh.
8. Open the leaderboard page and confirm it renders without exposing private
   session identifiers.
9. Check the network panel: API requests should be same-origin `/api/*`
   requests to the RunSite service URL.
10. Confirm there is no visible `QA PASS` button, no QA-only shortcut UI, and no
    answer-key data in browser-visible responses.

If mission completion cannot be verified manually in the browser, record the
exact blocker and do not claim production smoke is complete.

## RunSite logs checklist

Open Web Service logs after the smoke and check for:

- missing `DATABASE_URL`;
- PostgreSQL connection failures;
- migration-related table errors;
- static file 404 loops for real built assets;
- unexpected HTTP 500s;
- accidental requests to `POST /api/missions/:missionId/qa-pass`;
- accidental exposure of `PROJECT_Z_QA_PASS` or `VITE_PROJECT_Z_QA_PASS`.

Open PostgreSQL service logs or metrics and check for connection churn or
connection-limit warnings. The free database is small; keep the first demo load
light.

## Fallback if RunSite is blocked

Use this only if RunSite account creation, Git integration, Dockerfile build,
free Web Service provisioning, or free PostgreSQL provisioning is blocked.

Keep the same repository and Dockerfile. Do not change application runtime
assumptions.

Fallback Web Service:

1. Create a Render Web Service from the GitHub repository.
2. Select Docker as the runtime and use repository root `Dockerfile`.
3. Set `PORT=3000`, `HOST=0.0.0.0`, and the same Project Z env vars listed
   above.
4. Set health check path `/healthz`.
5. Use the free instance type only if it is available and acceptable for the
   demo constraints at deploy time.

Fallback PostgreSQL:

1. Prefer Aiven for PostgreSQL free tier if no-card signup is available.
2. Create a free PostgreSQL service in an EU region if offered.
3. Store the Aiven service URI in the password manager.
4. Use that URI as Render runtime `DATABASE_URL`.
5. Run `DATABASE_URL='<aiven-postgresql-url>' npm run db:migrate` from a trusted
   shell before API smoke.
6. Apply the SSL mode or certificate requirements shown by Aiven if the first
   connection fails.

If Aiven is unavailable and the owner relaxes the no-card/free constraint, use a
managed PostgreSQL service in the same Render region and apply the same
`DATABASE_URL` plus manual migration contract.

## References checked on 2026-06-04

- RunSite product/pricing: https://runsite.app/
- RunSite quickstart: https://docs.runsite.app/getting-started/quickstart/
- RunSite PostgreSQL connections:
  https://docs.runsite.app/services/postgresql/connecting/
- Render Web Services: https://render.com/docs/web-services
- Render Docker: https://render.com/docs/docker
- Aiven PostgreSQL free tier:
  https://aiven.io/docs/products/postgresql/concepts/pg-free-tier
