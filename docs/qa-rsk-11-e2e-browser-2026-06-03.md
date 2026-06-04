# RSK-11 E2E And Browser QA

Date: 2026-06-03

Scope: Rules & Skills MLP route proof after inserting `chapter-rules-skills` as visible Chapter 5, shifting the former Chapters 5-7 to visible Chapters 6-8, and making the active course an 8/8 route.

## Automated Evidence

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run validate:content` passed: 1 file / 4 tests.
- `npm run build` passed; the answer-key bundle gate passed.
- Focused e2e `npm run test:e2e -- --grep "Rules & Skills|final archive|final closeout"` passed: 8 tests.
- Focused badge layout regression `npm run test:e2e -- --grep "renders collectible reward cards"` passed: 1 test.
- Full e2e `npm run test:e2e` passed: 55 tests.

The first sandboxed focused e2e hit the known local-server `listen EPERM` restriction when Playwright tried to bind `127.0.0.1`; the approved local-server reruns passed.

## Covered Flows

- Regular Rules & Skills pair-matching mission on desktop `1440x900` and mobile `390x760`.
- Failed Rules & Skills pair-matching attempt with selected-trap-only feedback and no hidden correct-map leakage.
- Rules & Skills boss round 1 pair matching through the dossier path.
- Chapter 5 badge artifact selector for `rules-inventory.md` and `skill-draft.md`.
- Final archive selection/download checks for both Rules & Skills files.
- Full backend-fixture course route now completes `8/8`, including shifted visible Chapters 6-8 and `/course/complete`.

## Browser QA Notes

Codex in-app Browser was opened against `http://127.0.0.1:5174/?qa=1` while the Vite dev server was running. Because the active runtime is backend-only and this direct Vite server had no `/api/*` backend fixture or Node backend attached, the browser showed the expected fallback:

```text
Карта не загрузилась
Сигнал карты сбился
```

Error-level browser console logs were empty for that direct check. Screenshot capture through the Browser API timed out on `Page.captureScreenshot`, so retained browser evidence for RSK-11 is this QA note plus the Playwright route/browser-fixture coverage above.

## Fixes Found During QA

- `src/features/mission/ui/MissionScene.css`: mobile non-boss pair matching now uses bounded/internal scrolling so the action row does not intercept target taps at `390x760`.
- `src/pages/badge/BadgePage.css`: completed badge recap cards now scroll internally so the artifact preview stays inside the reward frame after Chapter 4 recap gained four rules.
- `e2e/project-z.spec.ts` and `e2e/backend-api.spec.ts`: hard-coded 7-chapter route expectations were updated to use the active catalog length or the new `8/8` route.

## Residual Risk

Real own-Postgres plus nginx proxy browser smoke was not run in this session. Direct in-app Browser cannot exercise the full app flow without an attached backend/API fixture because Project Z no longer supports a frontend local mode. Keep Docker Compose DB/API/proxy smoke as the external rollout confidence check.
