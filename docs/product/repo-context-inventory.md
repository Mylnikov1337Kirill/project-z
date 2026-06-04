# Project Z repo context inventory

Заполняется и обновляется перед AI-assisted разработкой в Project Z. Цель -- дать агенту достаточно контекста, не превращая handoff в бесконечный свиток.

## Project basics

```yaml
project:
  name: Project Z
  path: /Users/kirillmylnikov/Dev/ai/project-z
  purpose: Async-first retro learning game for developers and QA learning practical AI-assisted engineering workflows.
  audience:
    - developers
    - QA / autotest engineers
    - pilot team champions
  stack:
    - React 19
    - Vite 8
    - TypeScript 6
    - React Router DOM 7
    - plain CSS
  persistence: backend-only through Node /api/*; no supported local mode
  backend: Dockerized Node HTTP entrypoint, nginx reverse proxy config, HTTP adapters and own PostgreSQL through ProjectZDatabase
  database: ADR-0007 implemented with self-hosted PostgreSQL via Docker Compose, DATABASE_URL, pg + SQL and clean start with no Supabase data import
```

## Architecture in 5-10 lines

Project Z is a game-first React app whose active target is backend-only persistence through Node `/api/*`; there is no supported local persistence mode. The current slice has identity, map, chapter intro, Chapter 1 through Chapter 8 Scene 0 prep briefings, config-driven mission scenes, four-round boss fights for Chapters 1-8, a badge earned screen, markdown artifact export, `/leaderboard`, `/field-guide`, gated `/course/complete` final chapter archive, and a hidden post-completion notification seam. Phase 9 added integration-readiness docs for backend, Supabase and Pachca without implementing those integrations. Phase 10 through Phase 15 completed the original playable Chapters 2-7 and the historical `7/7` course route. Rules & Skills MLP is now hard-renumbered for the pre-prod course: `chapter-5` is Rules & Skills, `chapter-6` is Гигиена контекста, `chapter-7` is Дисциплина проверки, `chapter-8` is Рабочие сценарии, and the active course is an 8-chapter route. Phase 18 added deterministic authored answer feedback coverage across all chapters. Phase 20 added canonical recurring trap concepts through `TrapConceptId`, `trapId` on mission answers, and `src/entities/trap/model/trapConcepts.ts`; recurring traps now render as `Ловушка: <name>` plus a short concept explanation while chapter-specific `trapLabel` values stay available for local scene labels. Phase 21 added the boss dossier feedback loop: boss rounds lock choices into a `Досье N/4` control and focused dossier panel before final submit, then reveal cleared/review states, round feedback and trap details from `MissionEvaluation.roundResults` without changing scoring or progression. Phase 23 added non-interactive living world map landmarks: each chapter can expose typed `visual` metadata, and `/map` renders SVG pixel station signs on explicit decorative coordinates independent from route nodes and avatar offsets, without changing node interaction, progression or persistence. Rules & Skills MLP RSK-07 added the eighth `instruction-router` landmark for `Коммутатор инструкций`. Phase 24a added typed `chapter.reward` metadata for the original seven chapters, Phase 24b turned the badge left panel into a tone-specific collectible reward card while keeping markdown artifact preview/download visually secondary and intact, and Phase 24c completed reward verification coverage across the original seven badge routes. Phase 26 added optional typed mission `takeaway` config, compact deterministic Z-bot takeaway rendering after mission results, boss dossier round-level takeaways, and authored deterministic takeaway copy across mission-like configs. Phase 27 turned Scene N.0 prep into an in-world briefing boot sequence with visible preparation station, boot steps, charging/ready start control, preserved 15-second delayed gate and legacy `?qa=1` timing bypass while browser completion authority is removed. Phase 31 added a compact route-level trap field guide: `/field-guide` loads encountered canonical trap ids through `ProgressRepository.getEncounteredTrapIds`, maps them through `trapConcepts`, is reachable from the map HUD and mission trap discovery panel, omits unknown future traps and does not promote chapter-specific `trapLabel` values into guide entries. Phase 32 added a reflection-to-artifact loop: completed badge routes ask "Где применишь это завтра?", save/edit/skip chapter reflections through `ProgressRepository`, and append a `## Локальная заметка` section to generated markdown artifacts without analytics, upload or generated advice. Phase 33 added a transient boss dossier cue after the first locked round: the main arena stays focused on the active round, the `Досье N/4` button is highlighted until opened, pre-final dossier copy stays neutral and retry clears stale dossier/cue state. Phase 35 added optional typed mission `retryPrinciple` copy, authored non-leaking retry principles, the `docs/product/retry-principle-content-matrix.md` source inventory, and a `Вспомнить правило` UI surface that appears only after failed attempts or final boss review. Phase 36 added typed `chapter.reward.masteryActions` copy and replaced the old visible badge reward notes with a compact `Ты теперь умеешь` mastery moment while keeping badge actions and artifact controls intact; a follow-up badge replay fix makes old/repeated badge routes show collection status and chapter-specific rank instead of fresh completion/unlock stats. Phase 39 added a progress-derived session resume cue: `getCourseResumeTarget` derives the next unfinished scene from existing `ChapterProgress`, `/map` renders a compact `Продолжить маршрут` CTA only for learners with started progress, and Phase 40 retargeted the completed-course cue to `/course/complete` instead of self-looping the map or opening a finished mission. Phase 40 now renders `/course/complete` as `Архив глав`: a scrollable list of all chapter `.md` artifacts, selected-file preview and selected artifact download; BOC-06 renamed the artifact implementation to `MarkdownArtifactService`. Phase 41 added completed-state map polish: `/map` splits the route into a single green completed segment and the existing gold remaining segment, avoiding duplicate road layers; the first overloaded landmark backplates/flags pass was removed, so inner landmark pictograms, positions, progress persistence and navigation remain unchanged. Phase 42 added badge reward ceremony variants derived from `chapter.visual.tone`: `seal` for `gold/orange/pink`, `signal` for `blue/teal/violet`, and `route-seal` for `green`, with small earned-only motion and static replay/old reward cards. Backend migration PR 13 split chapter configs by chapter and added `npm run validate:content`; markdown artifacts remain client-generated through the artifact template registry unless a later ADR moves them server-side. The failed-answer leakage guard now keeps incorrect attempts from revealing unselected correct chips, exact correct answer sets, expected-step labels or exact correct ordering through mentor feedback, retry principles, answer details or boss dossier details. The frontend now follows the layer/feature architecture documented in `docs/architecture.md`: `src/app` owns bootstrap, providers, router, shell, global style tokens and the CSS manifest; `src/pages` owns route-level screens and route CSS; `src/features` owns product workflows and workflow CSS; `src/entities` owns domain rules/configs; `src/shared` owns reusable UI, primitive CSS, hooks, repository adapters and types. A single shared `GameShell` wraps the app routes and owns the optional fullscreen workspace control. On the map, the selected chapter drives the chapter ribbon and mentor bubble copy, while the robot avatar follows only selected accessible chapters and stays put when a locked node is inspected; newly unlocked chapters also get a one-time first-map-visit cue from `ProgressRepository` pending metadata. Chapter content, visual metadata, reward metadata, reward mastery actions, prep resources, mission configs, takeaway copy and artifact metadata live in per-chapter TypeScript modules under `src/entities/chapter/model/chapters`; `chapterCatalog.ts` only re-exports the ordered catalog, and shared authored feedback/retry patches live in `missionFeedback.ts`. Final challenges use typed `boss-fight` missions that nest existing round interaction configs. ADR-0007 is implemented: active backend DB access is own PostgreSQL through `ProjectZDatabase`, `pg + SQL`, `DATABASE_URL` and Docker Compose. Leaderboard data still comes through `ProgressRepository.getLeaderboard()`, backend leaderboard responses omit `fullName`, and Pachca delivery remains an outbox row only; there are still no live Pachca webhook calls, runtime internet search or external LLM calls in the app.

Phase 43 note: player-facing mentor/gameplay copy has been tightened across identity, map, prep, missions, feedback, badge and artifacts so the voice is consistently `Z-бот`, Russian-first, practical and non-punitive without changing scoring, route flow or answer correctness.

Prompt-assembly layout note, 2026-05-31: Chapter 7 `prompt-skeleton-assembly` keeps the reusable deterministic `prompt-assembly` mission kind, but its UI is now a slot wizard with a prompt-досье rather than a board that exposes all text at once. The controller owns `activePromptSlotId` and exposes `assignPromptFragmentToSlot(slotId, fragmentId)` for direct placement from fragment details; assigning still advances to the next empty slot. The prompt scene has a compact top brief with a dossier affordance, one active slot with previous/next controls, compact slot previews, a paged fragment rail with `overflow: hidden` and no native scrollbar, prompt-досье views for brief/slot/fragment/contract, mobile single-scroll mode and full feedback only after checking.

Prompt-assembly difficulty note, 2026-06-01: the same Chapter 7 scene now has 21 authored fragment cards instead of 14. Correct fragments are labeled by meaning rather than slot name (`Видимое поведение`, `Ближайший пример`, `Один поток`, `Стоп-лист`, `Регрессия сценария`, `Команда проверки`, `План и риск`), so the task is no longer a near-binary 7-slot/14-card match. Extra plausible wrong fragments stay deterministic and source-backed, using canonical traps where possible (`weak-test`, `sensitive-data`, `agent-as-source`, `neighboring-refactor`) plus one local plan-after-diff trap label.

Modal accessibility note, 2026-06-01: all current modal `role="dialog"` surfaces close on `Escape`, declare `aria-modal="true"` and use the shared `src/shared/lib/a11y/useModalEscapeClose.ts` hook instead of local keydown listeners. This currently covers the prompt briefing modal, prompt-досье and boss dossier, including the final reveal dossier, which can be dismissed and reopened from the dossier control.

Mission ordering layout note, 2026-06-02: Chapter 4 `context-inventory-order` exposed a non-boss chip-ordering overflow bug where lower source cards were visible but `document.elementFromPoint()` hit the disabled primary action button. The fix lives in `src/features/mission/ui/MissionScene.css`: non-boss `chip-ordering` consoles use a bounded `minmax(0, 1fr)` interaction row, the ordering board uses `auto minmax(0, 1fr)`, and dense source/target areas scroll internally. Keep the Playwright regression `keeps chapter 4 inventory ordering cards clickable below actions` when touching mission layout.

Chip-ordering rework closeout note, 2026-06-03: `docs/product/chip-ordering-mission-rework-subtasks.md` is complete through CHO-07. `gate-checklist-order` is now the only audited ordering mission converted to `pair-matching`; the remaining strict ordering missions are intentionally `self-review-assembly`, `assemble-task-brief`, `small-diff-loop`, `gate-closeout-order`, `context-inventory-order`, `skill-draft-order`, `gate-skill-anatomy`, `token-checklist-order`, `reviewer-note-order`, `gate-review-note` and `gate-playbook-order`. Focused Playwright coverage in `e2e/project-z.spec.ts` now includes `completes the reworked ordering and pair-matching rounds`, updates Chapter 3 closeout labels, and exercises Chapter 6 boss round 4 as pair matching rather than an ordering board. Keep this coverage when editing those missions or the pair-matching/ordering UI.

Backend-only cutover note, 2026-06-02: the active target is no supported local mode. BOC-01 through BOC-11 removed active local runtime/test paths, stale active-doc guidance, backend trust gaps and forbidden-symbol residue; use `docs/backend-only-cutover-subtasks-2026-06-02.md` for the remaining BOC-12 verification and rollout-blocker pass. Historical references to removed local-mode artifacts in older phase notes are archival context, not product direction to preserve.

Own PostgreSQL migration completion note, 2026-06-02: `docs/adr/ADR-0007-self-hosted-postgres-db.md` and `docs/own-postgres-migration-subtasks-2026-06-02.md` record the completed DBM-00..DBM-10 migration from Supabase REST/RPC to self-hosted PostgreSQL. Active DB access is `server/db/postgresProjectZDatabase.ts` through `ProjectZDatabase`, `pg + SQL` and `DATABASE_URL`; `server/db/migrations/202606020001_project_z_schema.sql` is the clean-start schema applied by `npm run db:migrate`. `deploy/docker-compose.yml` includes Postgres, API and nginx proxy. Supabase REST/RPC runtime code and tests were removed by DBM-10; `supabase/migrations` and DBM-00 inventory remain historical comparison material only.

Service composition note, 2026-06-01 / BOC-01 update 2026-06-02: backend migration PR 2 introduced `src/app/providers/AppServicesProvider.tsx` as the app-level composition root. BOC-01 removed the local/backend runtime split and old Vite env read from the app provider; runtime composition now always uses `HttpProgressRepository`, `HttpMissionAttemptService`, static content and `MarkdownArtifactService`. The shared `src/shared/api/appServices/appServices.ts` contract exposes `useAppServices` and no longer includes `announcementService`; route pages should keep using the hook or service props rather than importing concrete adapters.

Mission submit service note, 2026-06-01 / BOC-04 update 2026-06-02: `src/shared/api/missions/httpMissionAttemptService.ts` is the only frontend mission-attempt implementation. It posts raw answers plus stable ids to `/api/missions/:missionId/attempts`; scoring, attempt persistence, trap discovery, completion and badge side effects stay backend-owned.

Artifact template registry note, 2026-06-01 / BOC-06 update 2026-06-02 / RSK-03 update 2026-06-03 / RSK-10 update 2026-06-03: markdown artifact generation is implemented by `MarkdownArtifactService` as a private browser download path, not gameplay persistence. Template factories live under `src/shared/api/artifacts/templates`, and `src/shared/api/artifacts/artifactTemplateRegistry.ts` maps typed `ChapterArtifactId` values to template factories. Chapters can now expose multiple files through `artifacts?: ChapterArtifact[]`; legacy `artifact` still works through `src/shared/lib/content/chapterArtifacts.ts`. `MarkdownArtifactService.createChapterArtifacts` returns every configured file, while `createChapterArtifact` remains the first-file compatibility path. Rules & Skills is implemented as visible Chapter 5 and registers two distinct artifact ids/templates: `rules-inventory` and `skill-draft`.

Rules & Skills RSK-10 docs/source-map note, 2026-06-03: active product docs now describe the 8-chapter route. `docs/product/README.md` and `docs/product/retry-principle-content-matrix.md` map visible Chapter 5 to `modules/08-rules-and-skills.md`, `templates/rules-inventory.md` and `templates/skill-draft.md`, then shift token hygiene, verification and playbooks to visible Chapters 6-8. Local education kit placeholders live at `modules/08-rules-and-skills.md`, `templates/rules-inventory.md` and `templates/skill-draft.md` until the upstream education kit is updated. Historical 7/7 QA reports remain archival snapshots, not active product behavior.

Rules & Skills RSK-11 QA note, 2026-06-03: default Playwright e2e now has 55 tests and covers the active 8/8 route. New RSK-11 coverage includes regular Chapter 5 pair matching on desktop/mobile, failed pair-matching non-leakage, boss pair-matching dossier state, both Chapter 5 badge artifacts, and final archive selection for `rules-inventory.md` plus `skill-draft.md`. QA fixed mobile pair-matching action-row interception in `src/features/mission/ui/MissionScene.css` and completed badge recap overflow in `src/pages/badge/BadgePage.css`. Direct in-app Browser against Vite without a backend/API fixture showed the expected backend-only fallback and zero error logs; route evidence is the Playwright backend-fixture suite. Report: `docs/qa-rsk-11-e2e-browser-2026-06-03.md`.

Rules & Skills RSK-12 final verification note, 2026-06-03: the MLP is closed as an active 8-chapter course. Repo truth for future agents: `pair-matching` is a supported mission kind in regular missions and boss rounds; `Chapter` supports multiple artifacts through `artifacts?: ChapterArtifact[]` with legacy `artifact` fallback; visible Chapter 5 is `chapter-5` with Rules & Skills missions and two files, `rules-inventory.md` and `skill-draft.md`; chapter ids now match visible order through `chapter-8`. Full required checks passed: `npm run validate:content`, `npm run test:unit`, `npm run typecheck`, `npm run lint`, `npm run build`, and approved-local-server `npm run test:e2e` (55 tests). The first sandboxed e2e hit the known `listen EPERM` local-server restriction and the approved rerun passed.

QA PASS QAP-05 note, 2026-06-03: `server/backend/qaPassAnswer.ts` remains the server-only helper that generates deterministic passing `MissionAnswer` values from private authored mission config for regular missions and nested boss rounds. `server/backend/api.ts` now exposes `POST /api/missions/:missionId/qa-pass` only when `PROJECT_Z_QA_PASS=1`; without the flag it returns the existing API 404 and does not touch DB. The endpoint requires a pilot session, validates content version, resolves the mission through the private catalog, generates the answer server-side, reuses normal submit persistence/completion/progress response shape, skips normal mission-attempt rate limits and preserves duplicate `clientAttemptId` semantics. Checks passed: focused `npm run test:unit -- server/backend/api.test.ts` (30 tests), `npm run typecheck`, `npm run lint`, `npm run build:server`, full `npm run test:unit` (22 files / 140 tests), and `npm run build` including the browser bundle answer-key guard. Next QA PASS step is QAP-06: Playwright and backend API fixture coverage.

Map Layout Reflow MLR-02/MLR-03 note, 2026-06-03: `src/features/map/lib/mapViewModel.ts` owns independent `nodePositions` and `landmarkPositions`; `WorldMap.tsx` applies `screen-frame map-screen`; `WorldMap.css` centers `.map-landmark` on those explicit coordinates, removed `--landmark-peek-*` and per-landmark offset hacks, keeps desktop signs at `74px`, reduces them to `66px` at `max-width: 920px`, and hides decorative landmarks at `max-width: 560px`. `e2e/project-z.spec.ts` now expects the new wide route arc and no longer treats open landmark/avatar overlap as required. Next MLR step is MLR-04 browser QA and visual polish.

Content extraction note, 2026-06-01: backend migration PR 13 split `chapterCatalog.ts` into ordered per-chapter modules under `src/entities/chapter/model/chapters`, moved common authored feedback/retry patches to `src/entities/chapter/model/missionFeedback.ts`, and added `npm run validate:content` for chapter/order/id/mission-reference/prep/artifact consistency checks. `chapterCatalog.ts` remains the stable public import for `chapters`.

Pre-backend regression note, 2026-06-01: historical full CLI and Codex in-app Browser QA before backend PR 9 is recorded in `docs/qa-browser-regression-2026-06-01.md`. The pre-cutover local-first `7/7` route, final archive, leaderboard, trap guide, badge/artifact privacy and compact map/archive smoke passed with zero browser console errors/warnings. The quick-reload unlock cue pitfall found in that run was fixed by backend migration PR 14: `/map` now marks pending unlock metadata seen when it accepts the reveal, before the transient animation window starts.

Backend DB/API note, 2026-06-01 / BOC-08 and DBM-10 update 2026-06-02: ADR-0006 originally introduced the backend runtime modules under `server/backend`, the active Node HTTP runtime under `server/index.ts` / `server/nodeHttp.ts`, `src/shared/api/http/backendApiClient.ts`, `src/shared/api/progress/httpProgressRepository.ts` and `src/shared/api/missions/httpMissionAttemptService.ts`; DBM-10 superseded the old Supabase DB implementation with own PostgreSQL under `server/db`. The API covers pilot sessions, `GET /api/me`, identify, progress, server-authoritative mission attempts, chapter reflections, discovered traps, leaderboard and unlock-seen writes. Mission scoring still uses the deterministic `missionEngine`, but the browser sends only raw answer/idempotency inputs and backend-owned code writes score/completion/badges/outbox. BOC-08 renamed the Playwright route fixture to `e2e/backendApiFixtures.ts` and the focused smoke to `e2e/backend-api.spec.ts`; the smoke now runs in the default `npm run test:e2e` suite and can be focused with `npm run test:e2e -- e2e/backend-api.spec.ts`. The fixture smoke covers identity/progress/trap/reflection wiring, real mission submit through the HTTP service, backend leaderboard reads without `fullName`, and unlock-seen acceptance/reload behavior; `server/backend/api.test.ts` guards routing, validation, pilot cookie behavior, duplicate `clientAttemptId` retries and leaderboard privacy on the extracted runtime layer. `BackendApiClient` wraps the default browser `fetch` to avoid Chromium `Illegal invocation` from an unbound `window.fetch`. `server/backend/cookies.ts` treats blank `PROJECT_Z_PILOT_SESSION_COOKIE_NAME` as the default `project_z_pilot_session_id`, and `deploy/docker-compose.yml` now passes that default explicitly so the local proxy flow does not emit an invalid empty-name `Set-Cookie`. `server/backend/announcementWorker.ts` owns token auth and dry-run drain logic, and the active worker endpoint is `POST /api/admin/announcement-worker`. Live Pachca delivery remains blocked by code until a later verification pass. Real Docker Compose DB/API/proxy smoke and live Pachca sender delivery are still not verified in this repo session.

Node backend migration Phase 0 note, 2026-06-01: `docs/node-backend-migration-phase-0-contract-2026-06-01.md` is the baseline parity inventory for migrating pre-cutover functions to a Dockerized Node backend. It lists pre-cutover endpoints, frontend HTTP clients, Supabase migrations, env vars, cookie/header/body-limit expectations, worker migration target `POST /api/admin/announcement-worker`, deploy assumptions and cutover blockers. Runtime code was not changed in Phase 0; keep this document as the parity contract for historical comparison.

Node backend migration Phase 1 note, 2026-06-01 / DBM-10 update 2026-06-02: API routing, request validation, cookie helpers, JSON/no-store response helpers and safe error handling live under `server/backend`. `server/backend/api.ts` is the reusable `/api/*` handler for Node routes, `server/backend/announcementWorker.ts` is the reusable worker handler for `POST /api/admin/announcement-worker`, and `server/backend/http.ts` / `cookies.ts` hold shared runtime-neutral helpers. The historical Supabase REST helper was removed by DBM-10.

Node backend migration Phase 2 note, 2026-06-01: `server/index.ts` is the source Node HTTP entrypoint and `server/nodeHttp.ts` is the `node:http` adapter. The Node runtime serves `GET /healthz`, routes `/api/*` through `server/backend/api.ts`, routes `POST /api/admin/announcement-worker` through `server/backend/announcementWorker.ts`, preserves forwarded host/protocol/cookie/authorization headers, writes multiple `Set-Cookie` values, enforces the 64 KiB request body limit before handler dispatch and logs only method/path/status/duration context. The focused source-level smoke remains `npm run test:unit -- server/nodeHttp.test.ts`.

Node backend migration Phase 3 note, 2026-06-01: `esbuild` is now an explicit dev dependency for the deployable server bundle. `scripts/build-server.mjs` bundles `server/index.ts` for Node `20.19` into `dist-server/index.mjs`, `npm run build:server` produces the artifact and `npm run start:server` runs the built server through the supported-Node wrapper. `dist-server` is ignored like other generated build output.

Node backend migration Phase 4 note, 2026-06-01 / BOC update 2026-06-02 / DBM-04 update 2026-06-02: `server/nodeApiParity.test.ts` now exercises the Node route path with injected `ProjectZDatabase` fakes for pilot session cookie behavior, `GET /api/me`, identify, progress, mission submit, duplicate `clientAttemptId`, leaderboard privacy, unlock-seen acceptance semantics, reflection save/read, discovered traps, worker token auth and dry-run worker transitions. BOC-08 removed the old Playwright env branch; backend API fixture coverage now runs by default through `npm run test:e2e`.

Node backend migration Phase 5 note, 2026-06-01: `Dockerfile` builds the Node API image from `server/index.ts` through `npm run build:server` and runs the bundled `dist-server/index.mjs` on `HOST=0.0.0.0`, `PORT=3000` with a container `GET /healthz` healthcheck. `.dockerignore` keeps local build outputs, `node_modules`, test reports and local env files out of the image context. `deploy/nginx/default.conf` serves Vite `dist`, falls back SPA routes to `index.html`, proxies `/api/*` and `/healthz` to the Node API service, forwards cookie/authorization/forwarded host/protocol headers, preserves `Set-Cookie`, and uses an access log format without query strings, cookies or authorization headers. `deploy/docker-compose.yml` wires the API image and nginx proxy for local smoke. Real Supabase/RLS smoke and real backend-only E2E are still Phase 6 gaps.

Node backend migration Phase 6 blocked note, 2026-06-01: historical pre-DBM runtime context. The Phase 6 real Supabase/proxy smoke was attempted but stopped before real API calls because the current shell had no `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` or `PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN`, and no `docker`, `podman`, `nerdctl` or `nginx` CLI for the proxy path. Built Node `/healthz` still passed after approved local bind on port `63216`. Do not retry this superseded Supabase smoke for the active own-Postgres path; keep live Pachca disabled.

Node backend migration Phase 7 note, 2026-06-01: the user explicitly accepted the remaining Phase 6 blocker, so active runtime/config was cut over to the Node backend path. The source of truth for runtime code is now `server/index.ts`, `server/nodeHttp.ts` and `server/backend/*`; pre-cutover hosting config and function adapters were removed. `eslint.config.js`, `vitest.config.ts` and `tsconfig.node.json` now include server tests/runtime only. Active docs point to relative browser `/api/*`, `POST /api/admin/announcement-worker`, server-only Node env vars and the reverse proxy that serves `dist` and proxies `/api/*`. Phase 7 verification passed lint/typecheck/unit/build/build:server/backend API fixture E2E and built `/healthz`; Docker/proxy smoke remains unrun because this environment has no container/proxy CLI.

Node backend migration Phase 8 note, 2026-06-01 / BOC-08 and DBM-10 update 2026-06-02: final closeout regression passed the available checks: `npm run lint`, `npm run typecheck`, `npm run test:unit` (16 files / 71 tests), `npm run build`, `npm run build:server`, backend API fixture E2E, full E2E, built Node `/healthz` smoke on `127.0.0.1:63218`, and Codex in-app Browser QA against the production `dist` via `npm run preview` on `127.0.0.1:63219`. Browser QA covered map loading with 7 nodes/7 landmarks, representative Chapter 1 mission submit, leaderboard rendering, zero error/warn console logs and no visible backend/debug/runtime copy. DBM-10 superseded the old Supabase worker smoke blocker; Docker build, container healthcheck, nginx reverse-proxy browser QA, own-Postgres DB/API/proxy smoke and dry-run worker smoke are still explicit production rollout blockers in environments without Docker/proxy tooling and server-only env vars. `.netlify` is ignored as local generated CLI state; active runtime remains Node backend + nginx reverse proxy + own PostgreSQL.

## Important paths

```yaml
paths:
  app_entry: src/main.tsx
  app_root: src/app/App.tsx
  app_router: src/app/router/AppRouter.tsx
  app_providers: src/app/providers
  app_services_provider: src/app/providers/AppServicesProvider.tsx
  app_shell: src/app/layout/GameShell.tsx
  pages: src/pages
  features: src/features
  entities: src/entities
  shared: src/shared
  styling_manifest: src/app/styles/app.css
  global_style_tokens: src/app/styles/global.css
  shared_ui_styles: src/shared/ui
  entrypoint: src/main.tsx
  architecture_doc: docs/architecture.md
  backend_migration_audit: docs/architecture-backend-migration-audit-2026-06-01.md
  backend_only_cutover_plan: docs/backend-only-cutover-subtasks-2026-06-02.md
  own_postgres_migration_plan: docs/own-postgres-migration-subtasks-2026-06-02.md
  own_postgres_dbm_00_inventory: docs/own-postgres-migration-dbm-00-baseline-inventory-2026-06-02.md
  own_postgres_adr: docs/adr/ADR-0007-self-hosted-postgres-db.md
  chapter_content: src/entities/chapter/model/chapterCatalog.ts
  chapter_content_modules: src/entities/chapter/model/chapters
  chapter_content_feedback: src/entities/chapter/model/missionFeedback.ts
  badge_reward_route: src/pages/badge/BadgePage.tsx
  badge_reflection_panel: src/pages/badge/ChapterReflectionPanel.tsx
  badge_reward_styles: src/pages/badge/BadgePage.css
  course_closeout_route: src/pages/closeout/CourseCloseoutPage.tsx
  course_closeout_styles: src/pages/closeout/CourseCloseoutPage.css
  course_closeout_helper: src/entities/chapter/lib/courseCloseout.ts
  chapter_prep_route: src/pages/chapter/ChapterPrepPage.tsx
  chapter_prep_styles: src/pages/chapter/ChapterPrepPage.css
  trap_field_guide_route: src/pages/field-guide/TrapFieldGuidePage.tsx
  trap_field_guide_styles: src/pages/field-guide/TrapFieldGuidePage.css
  chapter_flow_helpers: src/entities/chapter/lib/chapterProgress.ts
  trap_concepts: src/entities/trap/model/trapConcepts.ts
  map_feature: src/features/map/WorldMap.tsx
  map_styles: src/features/map/WorldMap.css
  chapter_resume_helper: src/entities/chapter/lib/chapterResume.ts
  mission_scene: src/features/mission/ui/MissionScene.tsx
  mission_scene_state: src/features/mission/lib/useMissionSceneState.ts
  mission_scene_parts: src/features/mission/ui
  mission_submit_use_case: src/shared/api/missions/httpMissionAttemptService.ts
  mission_attempt_services: src/shared/api/missions
  backend_runtime_modules: server/backend
  backend_runtime_api_handler: server/backend/api.ts
  backend_qa_pass_answer: server/backend/qaPassAnswer.ts
  backend_runtime_worker_handler: server/backend/announcementWorker.ts
  backend_runtime_http_helpers: server/backend/http.ts
  backend_runtime_cookie_helpers: server/backend/cookies.ts
  backend_db_interface: server/db/projectZDatabase.ts
  backend_postgres_db_client: server/db/postgresProjectZDatabase.ts
  backend_runtime_db_factory: server/db/runtimeProjectZDatabase.ts
  backend_db_migrations: server/db/migrations
  backend_db_migrate_script: scripts/db-migrate.mjs
  backend_node_entrypoint: server/index.ts
  backend_node_http_adapter: server/nodeHttp.ts
  backend_node_api_parity_tests: server/nodeApiParity.test.ts
  backend_node_build_script: scripts/build-server.mjs
  backend_node_bundle: dist-server/index.mjs
  backend_node_dockerfile: Dockerfile
  backend_node_dockerignore: .dockerignore
  backend_reverse_proxy_config: deploy/nginx/default.conf
  backend_reverse_proxy_compose: deploy/docker-compose.yml
  historical_supabase_migrations: supabase/migrations/20260601000*_backend_*.sql
  backend_node_migration_phase_plan: docs/node-backend-migration-agent-phases-2026-06-01.md
  backend_node_migration_phase0_contract: docs/node-backend-migration-phase-0-contract-2026-06-01.md
  backend_http_client: src/shared/api/http/backendApiClient.ts
  backend_http_progress_repository: src/shared/api/progress/httpProgressRepository.ts
  backend_http_mission_attempt_service: src/shared/api/missions/httpMissionAttemptService.ts
  backend_e2e_fixture: e2e/backendApiFixtures.ts
  backend_e2e_smoke: e2e/backend-api.spec.ts
  modal_escape_hook: src/shared/lib/a11y/useModalEscapeClose.ts
  map_view_model: src/features/map/lib/mapViewModel.ts
  map_state_hook: src/features/map/lib/useWorldMapState.ts
  leaderboard_model: src/features/leaderboard/lib
  leaderboard_table: src/features/leaderboard/ui/LeaderboardTable.tsx
  game_hud: src/shared/ui/GameHud.tsx
  mentor_dialog: src/shared/ui/MentorDialog.tsx
  mission_engine: src/entities/mission/lib/missionEngine.ts
  progress_repository: src/shared/api/progress
  app_services_context: src/shared/api/appServices/appServices.ts
  artifacts_service: src/shared/api/artifacts
  artifact_template_registry: src/shared/api/artifacts/artifactTemplateRegistry.ts
  artifact_templates: src/shared/api/artifacts/templates
  domain_types: src/shared/types/domain.ts
  adr: docs/adr
  product_prep: docs/product
  integration_next_steps: docs/product/integration-next-steps.md
  map_landmark_icon_style: docs/product/map-landmark-icon-style.md
  retry_principle_content_matrix: docs/product/retry-principle-content-matrix.md
  handoff: /Users/kirillmylnikov/Dev/ai/project-z-development-handoff.md
  agent_rules: AGENTS.md
```

## Commands

```yaml
commands:
  install: npm install
  dev: npm run dev -- --host 127.0.0.1
  build: npm run build
  lint: npm run lint
  typecheck: npm run typecheck
  test: npm run test
  preview: npm run preview
  unit_test: npm run test:unit
  e2e_test: npm run test:e2e
  node_http_adapter_smoke: npm run test:unit -- server/nodeHttp.test.ts
  node_api_parity_smoke: npm run test:unit -- server/nodeApiParity.test.ts
  build_server: npm run build:server
  start_server: PORT=3000 npm run start:server
  node_health_smoke: curl -i http://127.0.0.1:3000/healthz
  docker_api_build: docker build -t project-z-api:local .
  docker_api_run_smoke: docker run --rm -d --name project-z-api-smoke -p 3000:3000 project-z-api:local
  docker_proxy_smoke: docker compose -f deploy/docker-compose.yml up --build -d
  db_migrate: DATABASE_URL=postgres://... npm run db:migrate
  planned_own_postgres_compose_after_dbm_09: docker compose -f deploy/docker-compose.yml up --build -d
  backend_e2e_smoke: npm run test:e2e -- e2e/backend-api.spec.ts
  audit: npm audit --omit=dev
```

Notes:

- Use Node `>=20.19.0`. The repo has `.nvmrc`, `.node-version` and `.npmrc` with `engine-strict=true`; installs should happen on a supported runtime.
- The normal npm scripts are wrapped by `scripts/run-with-supported-node.mjs`. If local `/usr/local/bin/node` is too old for Vite 8/ESLint 10, Codex sessions automatically prepend the bundled Node at `/Users/kirillmylnikov/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`; outside Codex, use a supported Node or set `PROJECT_Z_NODE_BIN=/path/to/node`.
- Unit tests run through `npm run test:unit`; Playwright e2e tests run through `npm run test:e2e`. BOC-08 made backend API fixture coverage part of the default Playwright suite; focused fixture smoke is `npm run test:e2e -- e2e/backend-api.spec.ts`.
- The active Node/proxy runtime expects server-only `DATABASE_URL`; never expose DB URLs, worker tokens or future Pachca credentials through `VITE_*` env vars.
- ADR-0007 is implemented: `npm run db:migrate` applies `server/db/migrations/*.sql`; real empty-DB smoke still needs a reachable Postgres `DATABASE_URL`.
- Node backend source smoke is `npm run test:unit -- server/nodeHttp.test.ts`; it covers `GET /healthz`, a representative `/api/leaderboard` route, the target worker route, forwarded headers, the request body limit and multiple `Set-Cookie` headers. Node API parity smoke is `npm run test:unit -- server/nodeApiParity.test.ts`; it covers the current `/api/*` and admin worker contract through the Node route path with injected `ProjectZDatabase` fakes. The deployable bundle smoke is `npm run build:server`, `DATABASE_URL=postgres://... PORT=3000 npm run start:server`, then `curl -i http://127.0.0.1:3000/healthz`. The Docker/proxy smoke is `docker compose -f deploy/docker-compose.yml up -d db`, `DATABASE_URL=postgres://project_z:project_z_local_password@127.0.0.1:54321/project_z npm run db:migrate`, `PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN=local-worker-token docker compose -f deploy/docker-compose.yml up --build -d`, then `curl -i http://127.0.0.1:8080/`, `curl -i http://127.0.0.1:8080/api/me` and `docker compose -f deploy/docker-compose.yml down`.
- The dev server may need escalated sandbox permission because listening on `127.0.0.1` can fail with `listen EPERM`.
- Real local Node backend smokes can hit the same sandbox `listen EPERM` restriction; use approved local-server permission when intentionally binding `server/index.ts` / `server/nodeHttp.ts` for a smoke.
- For gameplay UI changes, build/lint alone are not enough; run browser QA against the affected desktop/fullscreen-first route.
- Browser QA depends on the Codex Browser plugin exposing an in-app browser. In Codex Mobile sessions the Browser plugin may be installed but return no available browser (`iab` unavailable / empty browser list). Treat that as browser QA unavailable for the client session, not as a shell permission problem. Do not add one-off headless Firefox scripts or temporary QA seed pages as a workaround unless explicitly requested; run lint/build and any repo-provided CLI smoke/e2e tests, report the limitation, and leave a dev URL for manual QA.

## Conventions

- Visible gameplay UI is Russian.
- Visible gameplay copy should be human and mostly Russian. Avoid code-switching in player-facing text; prefer `изменения`, `пул-реквест`, `границы задачи`, `видимое поведение`, `снимки интерфейса`, `рефакторинг`, `награда` and `финальное испытание` over English labels unless the English term is a filename, code identifier, command flag or accepted team marker.
- Keep the app game-first: no dashboard, LMS, implementation status panel or architecture demo in player-facing screens.
- Layout target is desktop/fullscreen-first only. Do not start adaptive, mobile-first or responsive redesign work unless the user explicitly asks for it.
- If mission content, dossier, feedback or controls do not fit inside the current game frame, rebuild the local layout instead of accepting clipping or page-level overflow. Boss dossier should stay a focused panel with selectable round cards, not a long scrollable report; dense answer boards may still use internal scrolling when needed.
- Every modal dialog must close on `Escape`. For React modal surfaces, reuse `src/shared/lib/a11y/useModalEscapeClose.ts`, keep `aria-modal="true"` on blocking dialogs and cover the behavior in Playwright when adding or changing a modal.
- Do not show debug/architecture/persistence/backend/phase details in gameplay UI.
- Keep persistence and integrations behind service interfaces.
- Keep service implementation selection in `src/app/providers/AppServicesProvider.tsx`; pages/features should use `useAppServices` or receive service interfaces by props instead of importing local/mock adapters directly.
- Keep mission submit orchestration behind `MissionAttemptService`; route pages should not inline evaluation, attempt persistence, trap recording, boss completion or announcement trigger logic.
- Prefer existing React + CSS patterns over new dependencies.
- CSS follows the same ownership as TSX: `src/app/styles/app.css` is only an import manifest, `global.css` owns tokens/base rules, page styles stay with `src/pages/*`, workflow styles stay with `src/features/*`, and only reusable primitive styles belong in `src/shared/ui`.
- Mission UI should be driven by typed mission configs.
- Boss fights are still one mission in the chapter sequence; use the `boss-fight` mission kind for compact multi-round finals so attempts/completion continue through the existing route and progress flow. Current boss rounds lock in choices without revealing correctness until the final submit.
- Boss fight final feedback now reuses each round's deterministic evaluation feedback and answer details through `MissionEvaluation.roundResults`; keep the dossier reveal inside the boss mission console and do not add a parallel boss-specific result model or results route.
- Boss dossier guidance should stay lightweight: use the transient post-lock cue and `Досье N/4` affordance, not an always-visible previous-answer summary in the main arena.
- Failed mission attempts must not reveal unselected correct chips, exact correct answer sets, expected-step labels or exact correct ordering. The mission engine can show selected traps and general retry guidance; detailed correct-answer confirmation belongs only after success or in non-player-facing authoring docs.
- Retry principles are authored chapter-skill hints, not answer explanations. They can appear after incorrect attempts and final boss review, but must not list hidden correct chips, expected-step labels, exact ordering, exact correct counts or missed correct options; keep source mapping current in `docs/product/retry-principle-content-matrix.md`.
- Chip-ordering missions should use non-leaking retry guidance after failure. Do not use expected chip labels or `orderFeedback` to tell the player which exact step belongs in a wrong position.
- Prep resources, mission UI and artifact metadata should be driven by typed configs.
- Scene N.0 prep UX belongs to `src/pages/chapter/ChapterPrepPage.tsx` and `ChapterPrepPage.css`; preserve the briefing boot sequence, delayed start gate, visible `На карту`, static curated resources and `?qa=1` immediate-start bypass.
- Leaderboard UI should read progress through `ProgressRepository.getLeaderboard()`, not by direct storage access.
- The one-time map unlock cue should stay behind `ProgressRepository`: chapter completion sets pending unlock metadata, `/map` marks it seen immediately when accepting the reveal, and reloads should not replay it.
- Map landmarks are decorative game-world objects: keep their metadata in chapter config/domain types, render them in `src/features/map/*`, keep them non-interactive, place them through explicit `landmarkPositions` independent from route nodes/avatar offsets, and preserve chapter nodes as the only clickable route targets. Decorative landmarks are hidden on very narrow mobile.
- Map landmark icon changes must follow `docs/product/map-landmark-icon-style.md`: keep the shared station-sign frame, use crisp simple pixel SVGs, verify the rendered `/map` view and close crops, and do not accept pictograms that read as broken artifacts or need labels to be understood.
- Badge reward metadata lives in chapter config/domain types as `chapter.reward`; `masteryActions` are authored chapter-specific capability bullets, not tomorrow/next-step recap copy. Reward ceremony variants derive from `chapter.visual.tone` in `BadgePage`: `seal` for `gold/orange/pink`, `signal` for `blue/teal/violet`, and `route-seal` for `green`; fresh completion motion is gated by `?earned=1`, while replay and old badge routes stay static. Keep badge route rendering in `src/pages/badge/*`, preserve `.md` artifact preview/download and do not change progress/unlock/leaderboard behavior during reward-card polish.
- Badge reflections are user-authored notes: read/write them only through `ProgressRepository`, keep them optional/skippable and bounded, and include them in artifacts through `MarkdownArtifactService` without learner identity, analytics or generated advice. Backend API/RLS owns reflection persistence; markdown artifacts remain private browser-generated downloads.
- Final archive lives at `/course/complete`, is gated by all chapters completed, and lets the learner select, preview and download the existing chapter `.md` artifacts. Keep downloads delegated to `MarkdownArtifactService.createChapterArtifacts` / `createChapterArtifact`; archive row identity must include both chapter id and artifact id because future chapters may expose multiple files. Do not reintroduce a synthetic combined final report unless product direction changes.
- Completion notifications should go through backend badge/outbox writes; do not show Pachca/post implementation copy in the player UI and do not place real webhook details or secrets in frontend code.
- Before extending backend/Supabase/Pachca work, read `docs/product/integration-next-steps.md`, `docs/architecture-backend-migration-audit-2026-06-01.md` and `docs/adr/ADR-0006-backend-db-rls-and-api.md`; for the Supabase -> own PostgreSQL migration also read `docs/own-postgres-migration-subtasks-2026-06-02.md` and `docs/adr/ADR-0007-self-hosted-postgres-db.md`. Keep service-role keys, webhook tokens, DB URLs and delivery calls server-side.
- Runtime logic for the active Node backend lives in `server/backend/*`; `server/nodeHttp.ts` is the HTTP adapter and `server/index.ts` is the source entrypoint.
- Mission/quiz/prep/artifact teaching content should be checked against the relevant education kit source before editing. See `AGENTS.md` and `docs/product/README.md` for the chapter-to-source map.
- Future teaching copy should follow `AGENTS.md` authoring rules: one concrete learning outcome per mission, specific engineering situations, grammatically aligned answer options, plausible AI-assisted traps, feedback that explains the selected trap or general rule without leaking hidden correct answers, and coherent prep/mission/boss/badge/artifact/announcement language per chapter.
- Recurring AI traps should use canonical `trapId` values from `src/entities/trap/model/trapConcepts.ts`; keep `trapLabel` only for local chapter-specific labels that are not recurring course concepts.
- The trap field guide should stay repository-backed: route/UI code uses `ProgressRepository.getEncounteredTrapIds`, maps only canonical `trapId` values through `trapConcepts`, omits future unknown traps by default and never reads `localStorage` directly.
- Phase 18 feedback patches in `src/entities/chapter/model/missionFeedback.ts` are authored content, not a generic fallback; when changing mission chips/order, keep useful selected-trap feedback while preserving the failed-answer leakage guard.
- Frontend architecture changes should follow `docs/architecture.md` and the dependency direction `app -> pages -> features -> entities -> shared`.
- Do not grow `src/app/styles/app.css` with real selectors; put new style rules in the owning layer file and preserve existing class names unless a task explicitly includes a styling API rename.
- Keep large gameplay components split by real ownership: route pages compose, feature hooks own workflow state/effects, feature UI parts render mission/map/leaderboard surfaces, and `shared/ui` is for reused route chrome such as `GameHud`.
- Prep resource links are curated static config; do not add runtime internet search/fetch in the player app.
- Chip-ordering missions support both click selection and drag/drop. Placed source cards are hidden from the lower chip grid until the player removes them from the order track. Keep ordered chips compact inside the target area; do not let them stretch to the full target width/height.
- Generated markdown artifacts should be private, practical starters with TODO/adaptation points, optional reflection notes and no learner personal data. Artifact templates live outside `MarkdownArtifactService`; add new templates through `src/shared/api/artifacts/templates` plus the typed registry, and use `getChapterArtifacts` when code needs the effective chapter file list.
- For multi-file or UI behavior changes, use plan-first workflow before editing.
- Mission scene QA shortcut is available only behind `?qa=1`; it should not appear in the normal player flow.

## Good examples

- `src/app/router/AppRouter.tsx` -- route composition and guarded navigation in one app-level place.
- `src/app/providers/GameStateProvider.tsx` -- app state loading and progress refresh behind a provider.
- `src/pages/*` -- route-level screens split by route.
- `src/entities/chapter/model/chapterCatalog.ts` plus `src/entities/chapter/model/chapters/*` -- public chapter catalog export and per-chapter mission/config modules.
- `src/features/mission/ui/MissionScene.tsx` plus `src/features/mission/lib/useMissionSceneState.ts` -- mission composer and state controller for deterministic interaction types.
- `src/shared/api/missions/httpMissionAttemptService.ts` -- the frontend mission submit service; it posts raw answer/idempotency inputs to `/api/missions/:missionId/attempts`.
- `src/features/map/lib/useWorldMapState.ts` and `src/features/map/lib/mapViewModel.ts` -- map selection/avatar/pending-unlock state and pure map view-model helpers.
- `src/features/leaderboard/lib/useLeaderboardEntries.ts` and `src/features/leaderboard/ui/LeaderboardTable.tsx` -- leaderboard loading/sorting and semantic table rendering.
- `src/shared/ui/GameHud.tsx` -- shared route HUD/profile presentation.
- `src/app/styles/app.css` -- CSS import manifest only; owned style rules live in `src/app/layout`, `src/pages`, `src/features`, and `src/shared/ui`.
- `src/entities/mission/lib/missionEngine.ts` -- deterministic scoring outside UI components.
- `docs/architecture.md` -- layer ownership and dependency rules for future frontend changes.
- `docs/adr` -- architectural decisions kept out of player-facing UI.

## Known pitfalls

- Do not regress the game UI into a technical status page.
- Do not put `localStorage`, backend status, repository interface names or phase labels into visible gameplay copy.
- Artifact preview may show project adaptation markers/TODO as downloaded-template content; do not use TODO as app implementation/status copy.
- Do not extend backend/Supabase, enable real Pachca calls or add external LLM calls unless explicitly requested for a later phase.
- Do not start the Supabase-to-own-Postgres migration by choosing a different DB/ORM/import policy. Use ADR-0007 and `docs/own-postgres-migration-subtasks-2026-06-02.md`: PostgreSQL, Docker Compose, `DATABASE_URL`, `pg + SQL`, clean start and no Supabase data import.
- Do not pass an empty pilot-session cookie name into runtime config. `PROJECT_Z_PILOT_SESSION_COOKIE_NAME` is optional, but blank values must behave like the default `project_z_pilot_session_id`; otherwise browsers reject the session cookie and login falls through to `Нужно открыть пилотную сессию.` on the next progress read.
- Do not add runtime internet search/fetch for prep resources. Browser markdown artifact export may remain client-generated under neutral naming, but local progress/attempt/completion persistence must not be reintroduced under the backend-only cutover plan.
- Do not hardcode mission-specific scoring inside screens when it belongs in the mission engine/configs.
- Do not split Chapter 1 boss rounds into separate chapter missions unless the progress model is intentionally redesigned; the current boss is one mission id (`ship-or-stop`) with nested rounds.
- Do not label neutral boss stage progress as depleted shields. If future UI uses boss/player shields, define the damage/reveal mechanic first.
- Do not invent quiz substance only from memory or handoff summaries; use the matching education module/template as the source of truth for scenarios, wrong-answer feedback and mentor guidance.
- Do not add silly distractors, decorative jargon or English labels just because the source material uses them; visible copy should teach the next engineering action in natural Russian.
- Do not remove useful smart feedback when editing missions, but never restore failed-attempt leaks: exported chapters should retain authored explanations for selected wrong options/traps and boss round results without listing missed correct chips or exact expected ordering.
- Do not reintroduce ad hoc or English recurring trap labels in gameplay feedback. Use `trapId` for canonical concepts and verify no visible trap label remains in English.
- Do not let chapter-specific `trapLabel` values appear as canonical entries in `/field-guide`; only encountered canonical `trapId` values belong there.
- Do not rely on build success as visual proof; map alignment and mission flow need browser inspection.
- Do not accept mission layouts where action buttons leave the mission frame or require page scroll to find. Constrain the working area and let dense panels scroll internally.
- Do not accept ordering layouts where the source chip grid extends under `.mission-actions`; visible source cards must hit-test to the card, not to the primary action row.
- Do not add new modal dialogs without the Escape-to-close accessibility contract; this includes dossier-style overlays that use `role="dialog"`.
- Prompt-assembly is intentionally an exception to the shared desktop-only mission grid: keep its dedicated slot wizard and prompt-досье local to `MissionScene` / `MissionInteractionBoards`, preserve the active-slot flow, paged fragment rail without native scrollbar, mobile single-scroll behavior and delayed full feedback panel.
- Do not let `MissionScene` grow back into the owner of answer state, drag/drop, boss round derivation and feedback rendering; keep new mission modes behind feature-local model/hooks and focused UI parts.
- Do not let `src/app/styles/app.css` grow back into a global selector dump; feature/page/component styles belong to the same owner as the UI.
- Keep leaderboard rows semantic (`table`/`th`/`td`) unless a future accessibility review deliberately changes the pattern.
- If the Codex Browser plugin cannot provide an in-app browser, say that directly and avoid ad hoc browser automation workarounds. Prefer a durable repo-level CLI smoke/e2e test command for future browser QA.
- Map mentor text should stay tied to the selected chapter; do not reintroduce hardcoded Chapter 1 mentor copy on `/map`.
- Map avatar should stay tied to the last selected accessible chapter; locked-node preview must not move the robot onto a locked node.
- Locked map nodes should remain disabled for navigation, but selection/inspection can still update the mentor bubble and chapter ribbon.
- Do not mark pending map unlocks as seen before the reveal is visible; React StrictMode dev remounts can otherwise consume the cue before the player sees it.
- The local resume cue should stay derived from existing progress via `getCourseResumeTarget`: no cue for fresh learners, next unfinished scene for mid-course learners, and a final closeout CTA for completed `8/8` learners.
- The completed-course resume cue should point to `/course/complete` and never to a completed mission route or a self-looping map CTA.
- Do not treat map landmark SVG edits as complete based only on build/lint. Inner pictograms must pass the close-crop readability criteria in `docs/product/map-landmark-icon-style.md`.
- Do not regress Scene 4 ordering cards into full-width/full-height blocks after they are placed in the target area.
- Chapter 8 is now the final visible chapter, and `chapter-8` is the final chapter id. Historical 7/7 browser QA remains archival evidence for the pre-Rules & Skills course, while the active route is 8/8 with Rules & Skills as `chapter-5`.
- Chapter 5 educational source material is repo-local for now: use `modules/08-rules-and-skills.md`, `templates/rules-inventory.md` and `templates/skill-draft.md` when editing Rules & Skills content.
- Do not expose QA shortcuts by default; keep test controls behind explicit route flags.
- Do not show `mock`/webhook/backend/Pachca wording in the leaderboard or badge UI; keep those as code/docs concepts only.
- Keep `GameShell` above `Routes`; if each route mounts its own fullscreen shell, browser fullscreen exits during route transitions.
- Fullscreen API can be blocked by embedded browser surfaces. The shell should handle denied fullscreen requests without console errors; verify actual browser fullscreen in a normal browser when that behavior itself is the acceptance target.

## Sensitive-data boundaries

Never paste into external models:

- secrets, tokens, keys or `.env` files;
- production dumps;
- raw logs with PII;
- customer personal data;
- payment, pricing or financial data unless sanitized and explicitly approved;
- internal incidents, contracts or confidential business data unless explicitly approved.

Use sanitized samples. If sanitization removes the meaning, keep the workflow local or ask for domain-safe context.

## First pilot scenarios for this repo

- [x] Self-review before Phase 4.
- [x] Chapter 1 playable loop polish.
- [x] Badge earned screen implementation.
- [x] Scene 0 prep briefing for Chapter 1.
- [x] Local `ai-pr-self-review.md` preview/download after Chapter 1 boss.
- [x] Leaderboard and hidden announcement-service wiring.
- [x] Chapter 1 quiz copy editorial QA.
- [x] Chapter 1 final challenge redesigned as a compact multi-round boss fight.
- [x] Phase 9 integration-readiness checklist for backend, Supabase and Pachca.
- [x] Chapter 2 playable task-framing loop with `task-brief.md` artifact.
- [x] Chapter 3 playable plan-first workflow loop with `plan-first-checklist.md` artifact.
- [x] Chapter 4 playable context-engineering loop with `agents-context-starter.md` artifact.
- [x] Chapter 5 playable token-hygiene loop with `token-hygiene-checklist.md` artifact.
- [x] Chapter 6 playable verification-discipline loop with `verification-matrix.md` artifact.
- [x] Chapter 7 playable playbook loop with `team-playbook-draft.md` artifact and historical `7/7` local course completion.
- [x] Rules & Skills playable chapter inserted as visible Chapter 5 with `rules-inventory.md` and `skill-draft.md` artifacts.
- [x] Phase 18 smart answer feedback pass across Chapters 1-7.
- [x] Phase 20 recurring AI trap taxonomy across Chapters 1-7.
- [x] Phase 21 boss dossier feedback loop across boss fights.
- [x] Phase 23 living world map landmarks across the original 7 chapter nodes.
- [x] Rules & Skills RSK-07 eighth map landmark: `instruction-router` / `Коммутатор инструкций`.
- [x] Phase 24a reward content model across all 7 chapter badges.
- [x] Phase 24b collectible reward card UI across badge routes.
- [x] Phase 24c reward verification and polish across badge routes.
- [x] Phase 26a authored mission takeaway contract and representative Chapter 1 takeaways.
- [x] Phase 26b mentor robot feedback UI with result-state takeaways.
- [x] Phase 26c boss-fight mentor takeaway pass.
- [x] Phase 26d authored takeaway copy scale-out across all mission families.
- [x] Phase 27 briefing boot sequence on Scene N.0 prep screens.
- [x] Failed-answer leakage guard for chip-picker/order feedback and boss dossier details.
- [x] Phase 31 trap field guide for encountered canonical traps.
- [x] Phase 32 local reflection-to-artifact loop.
- [x] Phase 33 boss dossier cue and scaffolding.
- [x] Phase 35 non-leaking retry principles across all mission-like configs.
- [x] Phase 36 badge mastery actions across all completed badge routes.
- [x] Phase 39 local session resume cue from existing progress.
- [x] Phase 40 final closeout/archive with per-chapter markdown preview/download.
- [x] Phase 41 completed map world state polish.
- [x] Phase 42 reward ceremony variants across all seven badge routes.
- [x] Phase 43 mentor personality pass for Russian-first Z-бот gameplay copy.
- [x] One-time map unlock cue for newly opened chapters.
- [x] Feature/layer frontend architecture documentation.
- [x] Frontend component refactor: split mission scene UI/state, extracted map state/model, semantic leaderboard table and shared route HUD.
- [x] CSS architecture refactor: `app.css` is a manifest and style rules are split by app/page/feature/shared ownership.
- [ ] Browser QA playbook for gameplay flows.
- [ ] Content validation script for chapter configs.

## Missing context

- [ ] No automated unit test setup yet.
- [ ] No final production app name.
- [ ] No approved Pachca payload details.
- [ ] Backend-only cutover implementation still pending; see `docs/backend-only-cutover-subtasks-2026-06-02.md`.
- [ ] No final answer on admin/report auth.
