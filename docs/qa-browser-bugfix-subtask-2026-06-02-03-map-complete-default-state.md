# Subtask BUG-03: Fix Map Default State After Route Completion

Priority: P2

Owner: unassigned

Source QA pass: Browser regression from Chapter 4 boss fight through `/course/complete` on 2026-06-02.

## Objective

After all seven chapters are complete, `/map` should default to a route-complete state instead of a Chapter 1 reward message.

## Observed Behavior

After completing all chapters and navigating from `/course/complete` back to `/map`, the map correctly shows:

```text
Маршрут закрыт
Закрыто 7/7
Все главы пройдены
```

All seven chapter nodes have checkmarks.

But the prominent Z-bot message says:

```text
Награда получена: «Ответственный автор»
Ты закрыл главу «ИИ как инженерный инструмент».
```

That is the Chapter 1 reward/message, not the route-complete or latest Chapter 7 state.

## Reproduction

1. Complete Chapter 7 and claim the Chapter 7 badge.
2. Open `/course/complete`.
3. Click `На карту`.
4. Observe the route summary and Z-bot message.

## Expected Behavior

For full route completion, default map state should prioritize one of:

- route completion and archive call to action;
- latest completed chapter reward, `Сценарий оформлен`;
- neutral completed-route state with no chapter-specific reward unless a chapter is selected.

It should not default to Chapter 1 reward copy.

## Likely Area

- `src/pages/map/MapPage.tsx`
- `src/features/map/lib/mapViewModel.ts`
- `src/features/map/lib/useWorldMapState.ts`
- `src/entities/chapter/lib/chapterResume.ts`
- `src/entities/chapter/lib/courseCloseout.ts`

## Work Plan

1. Trace how the map decides selected/highlighted chapter after route completion.
2. Find why Chapter 1 becomes the default message source.
3. Update selection priority for all-chapters-complete state.
4. Preserve explicit chapter selection behavior.
5. Add a regression test for map view model with all chapters closed.

## Acceptance Criteria

- `/map` with `7/7` completed opens on route-complete copy or latest-completion copy, not Chapter 1.
- `Открыть архив` remains visible and navigates to `/course/complete`.
- Explicitly selecting Chapter 1 can still show Chapter 1 details.
- Unit/view-model coverage exists for the all-complete default.

## Suggested Verification

```bash
npm test -- map
npm test -- chapterResume
```

Use the project-supported command names if they differ.

## Notes

This is not a progression blocker, but it makes the final experience feel wrong.
