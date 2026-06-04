# Subtask BUG-04: Fix Chapter 7 Prompt-Contract Card Labels

Priority: P3

Owner: unassigned

Source QA pass: Browser regression from Chapter 4 boss fight through `/course/complete` on 2026-06-02.

## Objective

Make Chapter 7 scene 7.3 card labels distinguish between "current destination slot" and "correct/intended slot" so unplaced distractor cards do not look semantically assigned to the active slot.

## Observed Behavior

In `/chapters/chapter-7/missions/prompt-skeleton-assembly`, after all seven slots are filled, placed cards correctly show:

```text
В СЛОТЕ: ЦЕЛЬ
В СЛОТЕ: КОНТЕКСТ
...
```

But unplaced cards all show the current active slot, which remains the last selected slot:

```text
В СЛОТ: ПЛАН ДО ПРАВОК
```

This makes remaining distractor cards look like they belong in `План до правок`.

## Reproduction

1. Open Chapter 7 scene 7.3.
2. Close the brief overlay with `К сборке`.
3. Fill all seven prompt-contract slots correctly.
4. Observe labels on unplaced cards.

## Expected Behavior

Unplaced cards should not imply semantic membership in the active slot. Better labels include:

- `Добавить в выбранный слот`
- `Выбери слот для размещения`
- `Разместить в активный слот`

Placed cards should still show the slot that contains them.

## Likely Area

- `src/entities/chapter/model/chapters/chapterSeven.ts`
- `src/features/mission/ui/MissionInteractionBoards.tsx`
- `src/features/mission/lib/useMissionSceneState.ts`
- `src/features/mission/lib/missionAnswerHelpers.ts`

## Work Plan

1. Inspect render logic for fragment/card status labels.
2. Separate active destination state from placed-slot state.
3. Update visible text and aria labels for unplaced cards.
4. Keep placed-card labels clear and stable.
5. Add focused UI/state coverage if mission board rendering is tested.

## Acceptance Criteria

- After filling the canvas, unplaced distractor cards no longer say they belong to `План до правок`.
- Placed cards still show `В слоте: <slot>`.
- Card click behavior remains unchanged.
- Labels remain understandable for keyboard/screen-reader users.

## Suggested Verification

```bash
npm test -- mission
npm test -- chapterSeven
```

Use the project-supported command names if they differ.

## Notes

This is a UX clarity bug, not a completion blocker. The scene was still passable during Browser QA.
