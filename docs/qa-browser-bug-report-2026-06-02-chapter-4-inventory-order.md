# Browser QA Bug Report - 2026-06-02 - Chapter 4 Inventory Ordering Blocker

## Fix Status

Fixed on 2026-06-02.

Runtime fix:

```text
src/features/mission/ui/MissionScene.css
```

Regression coverage:

```text
e2e/project-z.spec.ts
keeps chapter 4 inventory ordering cards clickable below actions
```

The ordering scene now constrains the source chip grid inside the mission
console and gives it internal scroll, so the action row no longer receives
hit-testing over visible source cards.

## Summary

Manual browser QA after the frontend/backend split is blocked on chapter 4, scene 4.4.

Route:

```text
http://localhost:8080/chapters/chapter-4/missions/context-inventory-order
```

Mission:

```text
Собрать inventory
```

Severity: P1 blocker.

The chip-ordering scene cannot be completed because lower ordering cards are visually present and enabled in the DOM, but browser hit-testing lands on the disabled primary action button instead of the card. As a result, clicks, keyboard activation, coordinate clicks, and drag attempts do not add the affected cards to `Текущий порядок`; `Проверить решение` remains disabled.

## Environment

- App URL used for clean run: `http://localhost:8080/`
- User-provided app URL with prior session: `http://127.0.0.1:8080/`
- Browser: Codex in-app Browser QA
- Test learner:
  - nickname: `codex-reg-20260602b`
  - display name: `Codex Regression QA`
- Date: 2026-06-02
- App console errors/warnings during blocker checks: `[]`

Note: `localhost:8080` was used for a clean identity flow because `127.0.0.1:8080` already had an existing HttpOnly session cookie from earlier QA. It is the same local server.

## Passed Coverage Before Blocker

The clean browser flow passed:

- identity form validation for empty submit;
- new learner creation;
- map load and profile display;
- leaderboard load with current learner visible;
- chapter 1 full completion, including ordering scene, boss fight, badge, reflection skip, and return to map;
- chapter 2 full completion, including ordering scene, boss fight, badge, reflection skip, and return to map;
- chapter 3 full completion, including regular ordering scene, boss fight, badge, reflection skip, and return to map.

Previously reported chapter 3 blocker no longer reproduces:

```text
/chapters/chapter-3/missions/plan-gate
Раунд 4: gate-closeout-order
```

The round accepted chip clicks, enabled `Проверить финал`, completed the boss, and awarded the chapter 3 badge.

## Blocker Details

Current blocked URL:

```text
http://localhost:8080/chapters/chapter-4/missions/context-inventory-order
```

Expected correct order from content model:

```text
project-basics
architecture
paths
commands
conventions
examples
pitfalls
sensitive-data
```

Expected visible labels:

```text
Паспорт проекта: название, команда, стек, назначение
Карта кода: архитектура в 5-10 строк, основные модули и зависимости
Навигация: важные пути для клиента, сервера, тестов, docs и config
Проверочный контур: install, build, lint, unit/e2e, typecheck
Правила работы: 3-5 обязательных соглашений для изменений
Ориентиры стиля: 1-3 хороших файла или пул-реквеста для повторения
Предупреждения: типовые ловушки, где агент чаще всего ошибётся
Безопасный старт: границы чувствительных данных и первый пилотный сценарий
```

Observed after selecting the first two cards on the default in-app Browser viewport:

```text
Текущий порядок:
01 Паспорт проекта: название, команда, стек, назначение
02 Карта кода: архитектура в 5-10 строк, основные модули и зависимости

Карточки для сборки:
Безопасный старт...
Правила работы...
Предупреждения...
Ориентиры стиля...
Навигация...
Проверочный контур...

Проверить решение [disabled]
```

The remaining cards report `disabled: false`, but attempts to activate `Навигация` do not change the ordered count.

## Reproduction Steps

1. Open `http://localhost:8080/`.
2. Identify as:

```text
Позывной: codex-reg-20260602b
Имя и фамилия: Codex Regression QA
```

3. Complete chapters 1-3 via the normal UI.
4. Open chapter 4.
5. Complete chapter 4 scenes:
   - `context-before-prompt`
   - `agents-md-core`
   - `pick-context-examples`
6. Open:

```text
/chapters/chapter-4/missions/context-inventory-order
```

7. Select ordering cards in the intended order.
8. After selecting the first two cards, click:

```text
Навигация: важные пути для клиента, сервера, тестов, docs и config
```

Actual result: card is not added to `Текущий порядок`; primary action remains disabled.

Expected result: card is appended as item 03; after all 8 cards are selected, `Проверить решение` becomes enabled.

## Hit-Test Evidence

At the blocked state on the default in-app Browser viewport, the `Навигация` card is visible and enabled:

```json
{
  "disabled": false,
  "rect": {
    "height": 75.546875,
    "width": 259.5,
    "x": 52,
    "y": 406.546875
  },
  "text": "Навигация: важные пути для клиента, сервера, тестов, docs и config",
  "viewport": {
    "height": 773,
    "width": 646
  }
}
```

But `document.elementFromPoint(centerOfCard)` resolves to the disabled primary action button:

```json
{
  "hit": {
    "tag": "BUTTON",
    "className": "pixel-button",
    "disabled": true,
    "text": "Проверить решение"
  }
}
```

The same pattern was also seen after a reset on a temporary `1280x720` viewport: the lower-row `Паспорт проекта...` card was enabled, but hit-testing at its center landed on the disabled `Проверить решение` button.

## Interaction Attempts

Tried on the affected card:

- Playwright locator click scoped to `.chip-grid button`;
- coordinate click at card center;
- keyboard `Enter`;
- keyboard `Space`;
- drag from card center to the order track;
- scene reset and replay.

All attempts left the ordered count unchanged and `Проверить решение` disabled.

App console errors/warnings during checks:

```json
[]
```

## Screenshot

Captured screenshot:

```text
/private/tmp/project-z-browser-qa-chapter-4-inventory-blocker.png
```

Other useful QA screenshots:

```text
/private/tmp/project-z-browser-qa-identity.png
/private/tmp/project-z-browser-qa-map-start.png
/private/tmp/project-z-browser-qa-leaderboard-start.png
/private/tmp/project-z-browser-qa-map-after-chapter-3.png
```

## Relevant Code Pointers

Ordering UI:

```text
src/features/mission/ui/MissionInteractionBoards.tsx
```

Relevant component:

```tsx
function ChipOrderingBoard(...)
```

The card click handler is wired:

```tsx
onClick={() => pickOrderChip(chip.id)}
```

Scene layout CSS:

```text
src/features/mission/ui/MissionScene.css
```

Likely relevant areas:

```text
.mission-console
.mission-layout-chip-ordering:not(.mission-layout-boss) .mission-console
.mission-layout-chip-ordering:not(.mission-layout-boss) .ordering-board
.mission-layout-chip-ordering:not(.mission-layout-boss) .chip-grid
.mission-actions
```

Content projection appears correct:

```text
src/shared/api/content/publicContentProjection.ts
```

Relevant logic:

```ts
targetCount: mission.correctOrder.length
```

Chapter 4 content appears correct:

```text
src/entities/chapter/model/chapters/chapterFour.ts
```

Mission id:

```text
context-inventory-order
```

## Current Hypothesis

This is a frontend layout/stacking/overflow bug in the mission scene, not a backend persistence or content projection issue.

The chip grid extends underneath the action row. The action row, specifically the disabled `Проверить решение` button, occupies the hit-test area above lower cards. Because `mission-console` uses constrained grid rows and `overflow: hidden`, the layout can visually present cards in a region where the action row receives pointer events.

Potential fix directions:

- make the ordering board/chip grid scroll within its allocated row instead of extending under `.mission-actions`;
- adjust `.mission-console` grid rows for non-boss chip-ordering scenes to `minmax(0, 1fr) auto`;
- add `min-height: 0` and `overflow: auto` to the correct ordering container;
- ensure `.mission-actions` does not overlap the interactive chip area;
- add a regression test for `context-inventory-order` with eight ordering chips at a viewport where the action row is present.

## QA Status

Original manual browser regression was blocked at chapter 4. After the fix, the
focused Playwright regression passed at the reported `646x773` viewport, and
Codex in-app Browser QA confirmed the `Навигация` card center hit-tests to the
card, appends item 03, enables submit after all 8 cards, completes the scene,
and reports no console errors/warnings. The in-app Browser viewport override
did not apply in this client session and remained `1280x720`; exact compact
viewport coverage is therefore provided by the Playwright regression.
