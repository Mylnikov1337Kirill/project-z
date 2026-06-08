# 1. Architecture overview

Agent Trail is a Vite + React SPA whose active persistence target is backend-only through Node `/api/*`. There is no supported local persistence mode; backend-only cleanup and verification are tracked in `docs/backend-only-cutover-subtasks-2026-06-02.md`. The frontend is organized by layers: application bootstrap and routing stay in `app`, route-level screens stay in `pages`, product workflows stay in `features`, domain rules stay in `entities`, and reusable infrastructure stays in `shared`.

The main goal of the structure is predictable ownership. A route can assemble data and features, a feature can express a user workflow, an entity can hold domain rules, and shared modules must remain generic enough to be reused without knowing the product flow.

# 2. Folder structure

```text
src/
  app/
    layout/
    providers/
    router/
    styles/
  pages/
    badge/
    chapter/
    identity/
    leaderboard/
    map/
    mission/
    system/
  features/
    chapter/
    identity/
    leaderboard/
    map/
    mission/
  entities/
    chapter/
    mission/
    trap/
  shared/
    api/
    lib/
    types/
    ui/
```

# 3. Layers

`app` contains composition only: root component, providers, router, layout shell, global style tokens, and the style import manifest.

`pages` contains route-level components. Pages read URL params, guard access, and compose features/entities/shared modules.

`features` contains business workflows and product UI such as identity entry, map interaction, mission scenes, and locked-state screens.

`entities` contains domain data and pure domain rules: chapter progress calculations, mission evaluation, trap concepts, and static chapter catalog.

`shared` contains reusable building blocks: UI primitives, hooks/utilities, repository/API interfaces, backend HTTP adapters, artifact helpers and cross-layer types. Do not add local persistence implementations or frontend gameplay write adapters.

# 4. Dependency rules

Allowed direction: `app -> pages -> features -> entities -> shared`.

`app` can import from any lower layer to compose the application. `pages` can import `features`, `entities`, and `shared`, but should not put reusable business logic inline. `features` can import `entities` and `shared`, but not `pages` or `app`. `entities` should depend only on `shared/types` and other framework-free domain modules. `shared` must not import project-specific pages, features, or entities unless the folder is explicitly an adapter such as `shared/api/content`.

Avoid circular dependencies. If two modules need each other, move the shared contract down to `shared/types` or split orchestration into a page/app module.

# 5. Routing

Routing lives in `src/app/router/AppRouter.tsx`. Route paths and auth redirects are kept there so route behavior is visible in one place.

Route components live in `src/pages/*`. They may use `useParams`, redirects, and page-specific loading/locked/not-found states. Framework routing is not used in this SPA, so Vite keeps `src/main.tsx` as the only browser entrypoint.

# 6. State management

Global game state is loaded and exposed by `src/app/providers/GameStateProvider.tsx`. It owns chapters, learner profile, progress, initial loading, load errors, identity saving, and progress refresh.

Feature-local UI state stays inside the feature/page that owns it: map selection and pending-unlock effects in `features/map/lib`, mission answer state in `features/mission/lib`, leaderboard loading in `features/leaderboard/lib`, prep timer in the prep page, and badge download state in the badge page.

# 7. Data access

Repository interfaces and implementations live in `src/shared/api/*`. Components should not read `localStorage` directly. Use repositories/services such as `progressRepository`, `contentRepository` and `artifactService`; mission submit and completion-side effects must go through the backend mission attempt API path.

Domain calculations are separate from data access. For example, mission grading lives in `entities/mission/lib/missionEngine.ts`, while progress persistence lives in `shared/api/progress`.

# 8. Static Content And Artifacts

Chapter content stays as typed static config in `src/entities/chapter/model`. `chapterCatalog.ts` is only the public catalog export; per-chapter content lives in `src/entities/chapter/model/chapters`, and shared authored feedback/retry patches live in `src/entities/chapter/model/missionFeedback.ts`.

Content consistency is guarded by `npm run validate:content`, which checks chapter order, stable ids, mission answer references, boss rounds, prep resources and artifact metadata.

Markdown artifact templates stay client-generated for the current product shape. Add or change artifact downloads through `src/shared/api/artifacts/templates` and `artifactTemplateRegistry`; do not move artifact generation to backend without a separate ADR and migration plan.

# 9. UI structure

Reusable primitives live in `src/shared/ui`, for example `PixelPanel`, `MentorDialog`, and `GameHud`.

Feature-specific UI stays with the feature, for example `features/mission/ui/MissionScene.tsx`. Page components should compose UI and pass data, not become a dumping ground for reusable widgets.

Global CSS is imported by `src/app/App.tsx` from `src/app/styles`. `global.css` owns tokens and browser-wide base rules; `app.css` is only a manifest that imports CSS from the layer/file that owns the UI.

CSS follows the same ownership boundaries as TSX:

- `app` CSS is limited to application shell/layout concerns.
- `pages` CSS owns route-level frames and route-only layouts.
- `features` CSS owns workflow/product UI such as map, mission, chapter and identity surfaces.
- `shared/ui` CSS owns reusable, product-agnostic primitives such as buttons, panels, HUD, dialog and screen frame helpers.

Do not add feature/page selectors to `src/app/styles/app.css`. Add new selectors to the owning layer file and keep existing class names behavior-compatible unless a task explicitly includes a CSS API rename.

# 10. Naming conventions

Route-level components use the `Page` suffix: `MissionPage`, `BadgePage`, `ChapterPrepPage`.

Repository contracts use the `Repository` suffix. Backend HTTP adapters use `Http*` names, for example `HttpProgressRepository`. Service contracts use the `Service` suffix. Do not introduce `Local*Repository` gameplay adapters; old local persistence ADR guidance is superseded by the backend-only cutover.

Pure domain helpers use action-oriented names such as `resolveChapterStatus`, `getNextPlayableMission`, and `evaluateMission`. React hooks use the `use*` prefix and live outside pure entity files.

# 11. Examples

Add a new route by creating `src/pages/example/ExamplePage.tsx`, then registering it in `src/app/router/AppRouter.tsx`.

Add reusable UI by placing it under `src/shared/ui` only if it is product-agnostic. If it knows about missions, chapters, badges, or the map, keep it under the relevant `features/*` folder.

Add CSS beside the owner of the UI. For example, mission scene rules belong in `src/features/mission/ui`, route-only badge layout rules belong in `src/pages/badge`, and shared primitives belong in `src/shared/ui`.

Add a data source by defining the interface in `src/shared/api/<domain>` and hiding the storage/network details behind an implementation. Pages and features should call the interface-backed exported adapter rather than browser APIs directly.

Add a domain rule by placing pure logic under `src/entities/<domain>/lib`. If the rule needs React state or router data, keep that orchestration in `pages`, `features`, or `shared/lib`.
