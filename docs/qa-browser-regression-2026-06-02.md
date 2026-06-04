# Browser QA regression report - 2026-06-02

## Summary

Manual browser QA was run against `http://127.0.0.1:8080/` after the frontend/backend split.

Result: **blocked at chapter 3 boss fight**.

The happy-path course flow works through:

- learner identity creation;
- map entry and profile display;
- chapter 1 full completion;
- chapter 2 full completion;
- chapter 3 regular missions;
- chapter 3 boss rounds 1-3.

The flow cannot continue through chapter 3 boss round 4 because the chip-ordering UI does not accept selections, so the final submit button never enables.

## Environment

- App URL: `http://127.0.0.1:8080/`
- Browser: Codex in-app Browser QA
- Test learner:
  - nickname: `codex-regress-20260602`
  - display name: `Codex Browser QA`
- Date: 2026-06-02
- Current blocked URL: `http://127.0.0.1:8080/chapters/chapter-3/missions/plan-gate`

## P1 Blocker

### Chapter 3 boss fight ordering round cannot be completed

Route:

```text
/chapters/chapter-3/missions/plan-gate
```

Mission:

```text
Финальный бой за плановый шлюз
```

Blocked round:

```text
Раунд 4: закрыть сессию
```

Observed behavior:

- The round renders five enabled `.mission-chip` buttons.
- Clicking the cards does not add them to `Текущий порядок`.
- `Текущий порядок` remains empty and still shows:

```text
Перетащи карточки сюда или выбери их в нужном порядке.
```

- The primary action remains disabled:

```text
Проверить финал [disabled]
```

Expected behavior:

- Clicking each ordering card should append it to `Текущий порядок`.
- After selecting the required number of cards, `Проверить финал` should become enabled.
- Submitting the correct order should complete the boss fight, award the chapter 3 badge, and unlock chapter 4.

Correct order expected for the round:

```text
run-verification
review-diff
summarize-changes
name-checks
call-risks
```

Visible card labels:

```text
Доказательства: запустить согласованные проверки или записать, что не удалось выполнить
Self-review diff: самостоятельно просмотреть изменения, лишние файлы и непонятные решения
Итог изменений: коротко описать, что изменилось и почему это соответствует цели
След проверки: назвать пройденные проверки и ручной сценарий
Остаточные риски: отдельно указать открытые или непроверенные места
```

## Reproduction Steps

1. Open `http://127.0.0.1:8080/`.
2. Identify as:

```text
Позывной: codex-regress-20260602
Имя: Codex Browser QA
```

3. Complete chapter 1 fully.
4. Complete chapter 2 fully.
5. Complete chapter 3 regular missions:
   - `plan-first-or-not`
   - `read-the-plan`
   - `agree-boundaries`
   - `small-diff-loop`
6. Open chapter 3 boss fight:

```text
/chapters/chapter-3/missions/plan-gate
```

7. Complete boss rounds 1-3.
8. On round 4, click any ordering card.

Actual result: no card is added to the order track.

Expected result: clicked card appears in `Текущий порядок`.

## Attempts to Rule Out Automation Flakiness

The blocker was reproduced twice, including after reloading the mission and replaying boss rounds 1-3.

Tried interaction paths:

- Playwright role clicks on the card buttons;
- `.mission-chip` locator clicks;
- keyboard `Enter` / `Space`;
- double click;
- DOM-level click through the in-app Browser adapter;
- reset button and repeated card selection;
- full mission reload and replay.

All attempts produced the same state:

```text
Текущий порядок: empty
Проверить финал: disabled
```

Page console errors/warnings from the app were empty during checks:

```text
[]
```

Note: noisy `Statsig` / `Cloudflare` messages appeared in the Browser tool output, but those came from the Browser plugin telemetry layer, not from the Project Z page console.

## Relevant Code Pointers

Ordering board UI:

```text
src/features/mission/ui/MissionInteractionBoards.tsx
```

Important area:

```tsx
<button
  className={`mission-chip ${
    selectedChipSet.has(chip.id) ? 'mission-chip-used' : ''
  }`}
  disabled={
    isSubmitting ||
    selectedChipSet.has(chip.id) ||
    selectedChipIds.length >= orderLimit
  }
  draggable={
    !isSubmitting &&
    !selectedChipSet.has(chip.id) &&
    selectedChipIds.length < orderLimit
  }
  key={chip.id}
  onDragEnd={handleChipDragEnd}
  onDragStart={(event) => handleChipDragStart(event, chip.id)}
  onPointerDown={(event) => handleChipPointerDown(event, chip.id)}
  onClick={() => pickOrderChip(chip.id)}
  type="button"
>
  {chip.label}
</button>
```

Mission scene state:

```text
src/features/mission/lib/useMissionSceneState.ts
```

Important function:

```ts
function pickOrderChip(chipId: string) {
  setSelectedChipIds((currentIds) => {
    if (currentIds.includes(chipId) || currentIds.length >= orderLimit) {
      return currentIds
    }

    return [...currentIds, chipId]
  })
}
```

Ready-state logic:

```text
src/features/mission/lib/missionAnswerHelpers.ts
```

Important condition:

```ts
if (activeMission.kind === 'chip-ordering') {
  return selectedChipIds.length === orderLimit
}
```

Public projection:

```text
src/shared/api/content/publicContentProjection.ts
```

Projection appears to include `targetCount` for chip-ordering missions:

```ts
targetCount: mission.correctOrder.length
```

Chapter 3 round data:

```text
src/entities/chapter/model/chapters/chapterThree.ts
```

Round id:

```text
gate-closeout-order
```

## Passed Coverage Before Blocker

### Identity and map

- Empty identity submit showed validation.
- New learner created successfully.
- Map loaded after login.
- Profile showed `@codex-regress-20260602`.
- Rank after chapter 2 showed `Brief Boss`.

### Chapter 1

Completed:

- prep gate;
- `reviewable-or-not`;
- `spot-the-ai-risk`;
- `self-review-assembly`;
- boss fight `ship-or-stop`;
- badge page `Ответственный автор`;
- return to map.

### Chapter 2

Completed:

- prep gate;
- `turn-request-into-goal`;
- `draw-task-boundaries`;
- `pick-useful-examples`;
- `assemble-task-brief`;
- boss fight `brief-gate`;
- badge page `Чёткий бриф`;
- return to map.

### Chapter 3

Completed before blocker:

- prep gate;
- `plan-first-or-not`;
- `read-the-plan`;
- `agree-boundaries`;
- `small-diff-loop`;
- boss round `gate-risk-classifier`;
- boss round `gate-plan-review`;
- boss round `gate-human-decision`.

Blocked:

- boss round `gate-closeout-order`.

## Other Route Checks

Map after blocker:

- Shows chapter 1 and chapter 2 completed.
- Shows chapter 3 open.
- Shows chapters 4-7 locked.
- Resume card points back to chapter 3 final fight.

Leaderboard:

- Opens successfully.
- Shows current learner.
- Shows `2/7`.
- Shows rank `Brief Boss`.

Field guide:

- Opens successfully.
- Shows `Справочник ловушек`.
- Shows no discovered traps yet.

Course complete route before 7/7:

- Opens guard page successfully.
- Shows `Маршрут ещё открыт`.
- Shows archive locked until `7/7`.

Reload persistence:

- Reloading `/map` preserved learner identity and progress.
- Still shows chapter 3 as the active route.

## Not Completed

Could not browser-test:

- chapter 3 badge;
- chapter 4;
- chapter 5;
- chapter 6;
- chapter 7;
- final course archive after 7/7;
- final leaderboard state after full completion.

Reason: user flow is blocked in chapter 3 boss round 4.

## Notes for Next Agent

Start with the interactive bug, not backend progression.

Likely places to inspect first:

1. Whether `orderLimit` is correct at runtime for boss round `gate-closeout-order`.
2. Whether `activeMission` changes correctly when entering boss round 4.
3. Whether `onPointerDown` / drag state suppresses or interferes with `onClick` for boss chip-ordering rounds.
4. Whether `selectedChipIds` is reset or overwritten immediately after `pickOrderChip`.
5. Whether the boss layout class or CSS layer is preventing the actual button click from reaching the expected handler.

After fixing, rerun from:

```text
http://127.0.0.1:8080/chapters/chapter-3/missions/plan-gate
```

Then complete chapters 4-7 and verify final archive.
