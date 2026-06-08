# Pair Matching Slot UX Plan

Date: 2026-06-04

## Goal

Fix the shared `pair-matching` mission UX/UI used by Chapter 5 scene 5.1
`knowledge-carrier-match`, the Chapter 5 boss carrier round, and the other
current pair-matching scenes.

The player-facing problem:

- left-side cards show a strange hover artifact because the hover shadow is
  applied to the inner button instead of the visible card frame;
- after an item is assigned into a right-side slot, the slot cannot be cleared
  where the player is looking;
- an occupied right-side slot can still be overwritten by clicking another
  left-side card and then the occupied target.

## Decisions

- `pair-matching` is one-to-one for the current product: one item per target.
- Occupied targets must not accept a different active item.
- A filled target gets an explicit right-side `x` clear control.
- The existing left-side clear button can remain as a secondary path.
- Clicking an occupied target does not clear it; clearing is explicit.
- Do not add a `capacity` field or change the public answer shape in this pass.

## Target Behavior

- Selecting an unassigned item and clicking an empty target assigns it.
- Selecting an assigned item and clicking another empty target moves it there.
- Selecting a different item and clicking an occupied target leaves the existing
  assignment unchanged.
- Clearing from the right-side slot removes that item assignment, updates
  progress, and makes the target available again.
- `Проверить решение` becomes enabled only when every item is assigned and no
  target contains more than one item.
- Hover/focus states on left-side cards look intentional and do not draw a
  partial inner outline or offset artifact.

## Implementation Surface

Primary files:

- `src/features/mission/lib/useMissionSceneState.ts`
- `src/features/mission/lib/missionAnswerHelpers.ts`
- `src/features/mission/ui/MissionInteractionBoards.tsx`
- `src/features/mission/ui/MissionScene.css`
- `src/features/mission/lib/missionAnswerHelpers.test.ts`
- `src/entities/chapter/model/chapterCatalog.content.test.ts`
- `e2e/project-z.spec.ts`

Do not change:

- public answer shape: `Record<itemId, targetId>`;
- mission catalog ids;
- backend scoring semantics beyond rejecting duplicate target readiness in the
  client ready helper;
- authored teaching copy unless a QA pass uncovers a direct contradiction.

## Verification

Minimum automated checks after implementation:

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit -- src/features/mission/lib/missionAnswerHelpers.test.ts src/entities/chapter/model/chapterCatalog.content.test.ts`
- focused e2e for Chapter 5 pair matching, or the closest available Playwright
  grep that covers `knowledge-carrier-match`

Browser QA:

- `/chapters/chapter-5/missions/knowledge-carrier-match?qa=1`
- desktop and narrow/mobile viewport if available;
- verify no horizontal overflow, no console errors, right-side clear works,
  occupied target cannot be overwritten, and the left-card hover artifact is
  gone.
