# Map Layout Reflow Subtasks

Use this as the implementation handoff for rebuilding the world map layout after inserting the `Rules & Skills` chapter.

## Global Constraints

- Keep chapter order: `1 -> 2 -> 3 -> 4 -> Rules & Skills -> 5 -> 6 -> 7`.
- Target silhouette: wide horizontal arc, not a two-row map or hub map.
- Keep chapter nodes as the only interactive targets.
- Keep landmarks decorative and non-interactive.
- Do not change shared `.screen-frame` behavior for other screens.
- Hide decorative landmarks on very narrow mobile screens.

## MLR-00: Baseline And Current Layout Audit

Goal: confirm the current map behavior before changing coordinates.

Work:

- Inspect `src/features/map/lib/mapViewModel.ts`, `src/features/map/WorldMap.tsx`, and `src/features/map/WorldMap.css`.
- Confirm current route polyline expectations in `e2e/project-z.spec.ts`.
- Capture `/map?qa=1` mentally or through browser QA if execution context allows.

Acceptance:

- Current node/landmark coupling is understood.
- Known test expectations that encode old coordinates are identified.

Suggested checks:

```bash
npm run test:unit -- src/features/map/lib/mapViewModel.test.ts
```

Audit result (2026-06-03):

- `nodePositions` currently has eight route coordinates and still encodes the
  old route: `15,66 29,47 42,63 55,40 68,58 80,42 90,60 94,39`.
- `landmarkPositions` is currently derived from
  `nodePositions.map((position) => getPlayerAvatarPosition(position))`, so
  decorative landmarks inherit the avatar offset instead of having their own
  layout coordinates.
- `getPlayerAvatarPosition` offsets each node by `x - 6`, `y + 12` with
  clamping, and `WorldMap.tsx` uses it only for `.avatar-bot` placement.
- `WorldMap.tsx` renders route lines from `nodePositions`, renders landmarks
  from `landmarkPositions`, and keeps landmarks decorative via
  `pointer-events: none`.
- `WorldMap.css` currently depends on landmark peek variables
  (`--landmark-peek-x`, `--landmark-peek-y`) plus per-landmark overrides for
  `verification-lab`, `attention-window`, and `playbook-relay`.
- `e2e/project-z.spec.ts` hardcodes old polyline expectations:
  completed first two chapters `15,66 29,47`, open route after chapter 2
  `29,47 42,63 55,40 68,58 80,42 90,60 94,39`, and full completed route
  `15,66 29,47 42,63 55,40 68,58 80,42 90,60 94,39`.
- The same e2e area preserves old visual coupling through landmark/node
  overlap checks, max landmark-to-node distance `<= 125`, and the expectation
  that the open landmark partially overlaps the avatar.
- Browser baseline note: plain Vite at `/map?qa=1` reaches the backend-only
  loading error without an API/e2e fixture; the focused map e2e fixture is the
  reliable current browser baseline.

Checks run:

```bash
npm run test:unit -- src/features/map/lib/mapViewModel.test.ts
npm run test:e2e -- e2e/project-z.spec.ts -g "celebrates completed map chapters"
```

## MLR-01: Split Route Nodes From Decorative Landmarks

Goal: remove the layout coupling that makes landmarks inherit avatar/node offsets.

Files likely touched:

- `src/features/map/lib/mapViewModel.ts`
- `src/features/map/lib/mapViewModel.test.ts`

Work:

- Keep `nodePositions` as route/interaction coordinates.
- Define `landmarkPositions` explicitly instead of deriving it from `getPlayerAvatarPosition`.
- Preserve `getPlayerAvatarPosition` for robot placement only.

Use these target coordinates:

```ts
export const nodePositions = [
  { x: 14, y: 68 },
  { x: 27, y: 48 },
  { x: 40, y: 61 },
  { x: 53, y: 39 },
  { x: 65, y: 54 },
  { x: 77, y: 38 },
  { x: 87, y: 55 },
  { x: 94, y: 29 },
]

export const landmarkPositions = [
  { x: 8, y: 56 },
  { x: 27, y: 60 },
  { x: 40, y: 49 },
  { x: 53, y: 51 },
  { x: 65, y: 41 },
  { x: 76, y: 50 },
  { x: 87, y: 67 },
  { x: 89, y: 43 },
]
```

Acceptance:

- Eight node positions and eight landmark positions exist.
- Route helpers still use only `nodePositions`.
- Avatar position still follows the selected chapter node.

Suggested checks:

```bash
npm run test:unit -- src/features/map/lib/mapViewModel.test.ts
```

## MLR-02: Rework Map CSS For The New Arc

Goal: make the visual layer match the new independent coordinates.

Files likely touched:

- `src/features/map/WorldMap.tsx`
- `src/features/map/WorldMap.css`

Work:

- Add a map-specific frame class, for example `className="screen-frame map-screen"`.
- Center `.map-landmark` with `transform: translate(-50%, -50%)`.
- Remove landmark peek variables and per-landmark offset hacks.
- Keep landmark size around `74px` on desktop.
- On `max-width: 920px`, reduce landmark size to about `66px`.
- On `max-width: 560px`, hide `.map-landmarks`.

Acceptance:

- Desktop and tablet show landmarks without colliding with nodes.
- Mobile shows a clean node route without decorative landmark clutter.
- Mentor dialog, resume cue, avatar, route lines, nodes, and chapter ribbon keep expected z-order.

Suggested checks:

```bash
npm run typecheck
npm run build
```

Result (2026-06-03):

- `WorldMap.tsx` now applies `className="screen-frame map-screen"` to the
  map frame, leaving shared `.screen-frame` behavior unchanged for other
  routes.
- `.map-landmark` is centered directly on its explicit `landmarkPositions`
  coordinate with `transform: translate(-50%, -50%)`.
- Removed the old `--landmark-peek-x` / `--landmark-peek-y` variables and
  per-landmark offset overrides.
- Desktop landmarks stay at `74px`; `max-width: 920px` reduces them to
  `66px`; `max-width: 560px` hides `.map-landmarks`.
- Direct in-app Browser against plain Vite still reaches the known
  backend-only fallback (`Сигнал карты сбился`) without `/api/*` fixtures, so
  visual route QA remains an MLR-04 item.

Checks run:

```bash
npm run test:unit -- src/features/map/lib/mapViewModel.test.ts
npm run typecheck
npm run build
```

## MLR-03: Update Route Expectations In Tests

Goal: align tests with the new wide-arc route.

Files likely touched:

- `src/features/map/lib/mapViewModel.test.ts`
- `e2e/project-z.spec.ts`

Work:

- Update the view-model test that currently expects landmarks to equal avatar positions.
- Update hardcoded polyline expectations:
  - completed first two chapters: `14,68 27,48`
  - open route after chapter 2: `27,48 40,61 53,39 65,54 77,38 87,55 94,29`
  - full completed route: `14,68 27,48 40,61 53,39 65,54 77,38 87,55 94,29`
- Keep existing overlap and horizontal overflow assertions.

Acceptance:

- Tests encode the new route shape.
- Tests no longer preserve the old landmark/avatar coupling.

Suggested checks:

```bash
npm run test:unit -- src/features/map/lib/mapViewModel.test.ts
npm run typecheck
```

Result (2026-06-03):

- `e2e/project-z.spec.ts` now expects the new wide-arc route points for the
  first two completed chapters, the open route after Chapter 2, and the full
  completed course route.
- The happy-path landmark metrics no longer preserve the old open
  landmark/avatar overlap. They still keep the landmark/node overlap guard and
  max landmark-to-node distance guard, and now assert the open landmark and
  avatar are present without overlapping.
- `src/features/map/lib/mapViewModel.test.ts` already encoded explicit
  `landmarkPositions` and the no-avatar-coupling regression from MLR-01, so no
  unit-test edit was needed for this pass.

Checks run:

```bash
npm run test:unit -- src/features/map/lib/mapViewModel.test.ts
npm run typecheck
npm run lint
npm run build
npm run test:e2e -- e2e/project-z.spec.ts -g "celebrates completed map chapters|shows a completed world state|completes chapter 1 happy path"
```

## MLR-04: Browser QA And Visual Polish

Goal: verify that the rebuilt map is actually prettier, not only test-green.

Work:

- Open `/map?qa=1`.
- Check desktop around `1440x900`.
- Check tablet around `920px` width.
- Check mobile around `390px` width.
- Verify:
  - route reads as a broad arc;
  - `Rules & Skills` feels intentionally placed, not inserted;
  - landmarks do not overlap nodes on desktop/tablet;
  - landmarks are hidden on narrow mobile;
  - chapter ribbon does not cover important route content;
  - no horizontal overflow;
  - no browser console errors.

Acceptance:

- Map composition looks balanced with all eight chapters.
- Right side no longer feels cramped.
- Mobile remains usable and visually clean.

Suggested checks:

```bash
npm run build
```

Focused Playwright map tests from `e2e/project-z.spec.ts` should be run if time allows.

Result (2026-06-03):

- Plain Vite at `/map?qa=1` still reaches the known backend-only fallback
  without `/api/*` fixtures, so visual QA used fixture-backed Playwright state.
- Desktop `1440x900`, tablet `920x900`, and mobile `390x844` were checked with
  Chapter 5 / `Rules & Skills` open after the first four completed chapters.
  Desktop completed-course state was checked as the full-route right-side
  composition.
- CSS polish in `WorldMap.css` moved the map mentor dialog left on desktop so
  Chapter 8 remains visible instead of sitting under the dialog.
- Narrow mobile now gives the map-specific frame more vertical room and uses a
  compact mentor dialog inside `.map-screen`; landmarks remain hidden below
  `560px`.
- Fixture-backed geometry metrics confirmed no landmark/node overlaps on
  desktop or tablet, no mentor/ribbon/node overlaps on mobile, zero horizontal
  overflow, no browser console errors, and route span `80 x 39` percentage
  points for the broad arc.

Checks run:

```bash
npm run test:e2e -- e2e/mlr04-map-qa.spec.ts
npm run build
npm run test:e2e -- e2e/project-z.spec.ts -g "celebrates completed map chapters|shows a completed world state|completes chapter 1 happy path"
```

The QA spec above was temporary and removed after capturing screenshots and
metrics.
