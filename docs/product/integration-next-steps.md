# Agent Trail integration next steps

Status: readiness checklist plus backend/DB slice status. The active DB implementation is own PostgreSQL through `ProjectZDatabase`, backend fixture smoke covers identity/progress/traps/reflections, mission submit, leaderboard and unlock-seen behavior, and a token-protected backend Pachca dry-run worker can drain `announcement_deliveries`. BOC-01 through BOC-08 removed the supported frontend local mode and made backend API fixture coverage the default Playwright path. The active runtime path is now the Dockerized Node API behind the nginx reverse proxy. Docker Compose DB/API/proxy smoke, real-backend e2e and live Pachca delivery are still pending.

Active cleanup target: finish backend-only docs, hardening and rollout verification. Use `../backend-only-cutover-subtasks-2026-06-02.md` for remaining BOC work; do not preserve or recreate local mode.

## Current boundary

- The target product boundary is backend-only: learner identity, mission attempts, chapter completion, badge state, trap discoveries, reflections and leaderboard data go through Node `/api/*`.
- There is no supported local progress/attempt/completion persistence mode. Browser-owned gameplay writes are removal regressions, not a development fallback.
- The active deploy path is the Node/proxy runtime under `server/*`, `Dockerfile` and `deploy/*`.
- The active backend slice uses own PostgreSQL migrations under `server/db/migrations`, shared runtime-neutral handlers under `server/backend/*`, and the Node HTTP server that owns the active API path. Historical Supabase migrations remain under `supabase/migrations` only for comparison.
- In the backend-only runtime, mission attempts post raw answers plus stable ids; scoring, completion, badge awards, leaderboard data and Pachca outbox rows are server-owned.
- Browser chapter completion must not call an announcement service after BOC cleanup; backend mission submit writes an outbox row and the server-only announcement worker can mark it as `dry_run`.
- Frontend must not contain Pachca webhook URLs, webhook secrets, DB URLs or server-side credentials.
- Gameplay UI must not mention backend, Supabase, Pachca, webhook status, mock/debug state or future notification copy.

## Backend checklist

- Production host for this migration is the Dockerized Node API behind the reverse proxy, serving `dist` and same-origin `/api/*`.
- Define a typed badge-completion event contract from the frontend/backend boundary:
  - learner display handle;
  - chapter id/title;
  - badge id/name;
  - completed chapter count;
  - event id for idempotency;
  - completed timestamp.
- Keep announcement sending server-side and idempotent so replayed completion events do not duplicate Pachca posts.
- Add retries, structured logs and a visible operational status for maintainers, not for players.
- Store secrets only in backend environment variables. `DATABASE_URL`, worker tokens and future Pachca credentials must never use a `VITE_*` prefix.
- Decide whether completion events are emitted only after persisted progress succeeds or are recovered from stored progress later. Current backend slice creates `announcement_deliveries` only on first badge award.

## Database checklist

- Pilot auth currently uses ADR-0006 pilot sessions with an httpOnly cookie; decide later whether invite email/SSO replaces it.
- The minimum backend-owned data set is:
  - learners;
  - chapter progress;
  - mission attempts;
  - earned badges;
  - announcement delivery status.
- Apply `server/db/migrations` with `npm run db:migrate` before API/proxy smoke that touches `/api/*` routes.
- Browser DB credentials are not a supported path; all DB reads/writes go through Node `/api/*`.
- HTTP-backed `ProgressRepository` and mission attempt service are the active frontend adapters after BOC-01 removed the legacy mode switch.
- ADR-0006 says legacy pilot localStorage progress is not imported into server progress; server progress starts empty after backend cutover.
- Keep leaderboard reads behind `ProgressRepository.getLeaderboard()` or a matching service boundary.
- Keep backend fixture smoke as a fast guard for mission submit, unlocks and leaderboard aggregation; add the same checks against a real backend before production rollout confidence.

## Pachca checklist

- Approve the destination channel, sender identity and notification cadence with the pilot group.
- Confirm Pachca webhook/API shape, authentication mechanism and rate limits.
- Send only non-sensitive game progress data. Do not include full name, raw answers, attempt history, artifact content or private project details.
- Use backend-side dry run logging before enabling real delivery. The current worker only supports `PROJECT_Z_PACHCA_DELIVERY_MODE=dry-run`.
- Record delivery status and error details server-side.
- Keep retries bounded and idempotent.

## Draft Pachca copy

This copy is for a future backend sender only. Do not show it on badge, leaderboard, map or mission screens.

```text
@{nickname} закрыл главу «{chapterTitle}» в Agent Trail и получил награду «{badgeName}».
Прогресс маршрута: {completedChapters}/7.
Главное правило этой главы: автор отвечает за AI-assisted diff как за свой инженерный результат.
```

Fallback without a mention handle:

```text
Игрок Agent Trail закрыл главу «{chapterTitle}» и получил награду «{badgeName}».
Прогресс маршрута: {completedChapters}/7.
```

## Recommended order

1. Execute `docs/backend-only-cutover-subtasks-2026-06-02.md` in order.
2. Apply own PostgreSQL migrations against the Docker Compose database with `npm run db:migrate`.
3. Run mission submit, replay/idempotency, leaderboard and unlock-seen coverage against the Node/proxy API; fixture smoke remains a fast local guard.
4. Smoke `POST /api/admin/announcement-worker` against the Node/proxy path and inspect `announcement_deliveries` dry-run status transitions.
5. Enable live Pachca only after idempotency/logging checks look correct.
