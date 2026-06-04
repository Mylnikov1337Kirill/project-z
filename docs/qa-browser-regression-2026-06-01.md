# Project Z Browser QA regression

Дата: 2026-06-01

Цель: полный pre-backend regression после 8 локальных refactor phases из `docs/architecture-backend-migration-audit-2026-06-01.md`, перед стартом backend phase / PR 9.

## Summary

Статус: **можно переходить к PR 9 backend ADR/design**, но с одним подтверждённым UI lifecycle bug, который лучше исправить до пилота или до переноса unlock state в backend.

CLI baseline зелёный:

- `npm run lint` - passed.
- `npm run typecheck` - passed.
- `npm run test:unit` - passed: 9 files / 36 tests.
- `npm run build` - passed; осталось существующее non-blocking Vite warning about chunk >500 kB.
- `npm run test:e2e` - first sandbox run failed on known local-server `listen EPERM 127.0.0.1:5174`; approved rerun passed: 38/38 tests.

Browser QA через Codex in-app Browser:

- Clean run origin: `http://127.0.0.1:63127/`.
- Desktop viewport: `1440x900`.
- Compact smoke viewport: `390x844`.
- Browser console errors/warnings after pass: 0.
- Screenshots: `/private/tmp/project-z-browser-regression-2026-06-01/`.

## Browser coverage

Passed:

- No-learner guards redirect to identity for `/map`, `/leaderboard`, `/field-guide`, chapter, prep, mission, badge, `/course/complete` and unknown route.
- Fresh identity validation shows required-name feedback; `@browser-regression` login reaches map.
- Fresh map renders 7 nodes and 7 landmarks, with 1 open node, 6 locked nodes, no completed nodes, no horizontal overflow and no visible debug/backend/repository/mock text.
- Fresh leaderboard shows current learner at `0/7` / `Новый участник`.
- Fresh trap field guide route opens.
- Chapter 1 landing and normal prep gate render; `?qa=1` bypass reaches first mission.
- Scenario decision wrong answer shows trap feedback; correct answer advances.
- Chip picker wrong answer shows selected trap feedback and did not leak missed correct answers through `Пропущено`.
- Chip ordering submit stays disabled until a full order; reset works; correct order advances.
- Boss fight starts, dossier cue appears after first locked round, and round aria labels no longer duplicate `Раунд N`.
- Chapter 1 badge renders reward/artifact, artifact preview excludes learner full name, download button is present, and option-only reflection save works.
- Chapters 2-6 completed through Browser QA shortcuts to badge routes; badge artifact previews exclude learner full name and show download buttons.
- Chapter 7 prompt assembly completed manually in Browser after closing the prompt briefing: all 7 slots filled, success feedback shown, then route reached Chapter 7 badge.
- Completed map shows 7 completed nodes, no open/locked nodes, no reveal node, and archive link verified on revisit.
- Completed leaderboard shows `7/7` and `Playbook Crafter`.
- Trap guide persists encountered canonical trap `Уверенный отчёт`.
- Final archive route is gated/reachable at `7/7`, lists all seven chapter markdown files and has no horizontal overflow.
- Compact smoke at `390x844`: completed map and final archive have no horizontal overflow.

## Finding

### B-001 - P1/P2 - One-time map unlock cue repeats on quick reload

Repro confirmed in Browser QA:

1. Complete Chapter 1.
2. Open `/map`.
3. Observe Chapter 2 unlock reveal.
4. Reload before the reveal timeout finishes.

Actual:

- Before reload: one `.map-node-unlock-reveal`, unlock copy visible.
- After fast reload: one `.map-node-unlock-reveal` still appears, unlock copy visible again.
- After waiting for the reveal window and reloading again: reveal clears.

Impact:

- Core route is not blocked, and the completed `7/7` flow still passes.
- The bug violates the intended "one-time" cue semantics and will matter more once unlock-seen state becomes backend or multi-device state.

Likely area:

- `src/features/map/lib/useWorldMapState.ts` marks pending unlock as seen only after the reveal timeout.

Suggested fix:

- Mark pending unlock as seen immediately after accepting it for reveal, while keeping the visual reveal in component-local state for the current mount.
- Add e2e coverage for reload during the reveal window.

## Limitations

- Manual download events were not checked in Codex in-app Browser; Playwright e2e covers artifact/archive download behavior.
- Physical drag/touch ordering was not exhaustively checked; click/keyboard and e2e paths cover the deterministic flow.
- External prep resource availability was not opened.
- Backend/Supabase/Pachca/LLM integration was not checked because it is not implemented yet.

## Go / no-go

For PR 9, which is DB/RLS/backend ADR/design rather than backend implementation, the app baseline is good enough to proceed. Before implementing backend persistence or shared unlock state, fix B-001 or explicitly account for immediate `unlock_seen` semantics in the backend design.
