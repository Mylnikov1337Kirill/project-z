# Pair Matching Slot UX Subtasks

Date: 2026-06-04

Use this as the implementation handoff for the shared `pair-matching` UX/UI
fix planned in `docs/product/pair-matching-slot-ux-plan.md`.

## Goal

Make `pair-matching` missions behave like clear one-to-one slot assignments:
filled targets are easy to clear, cannot be overwritten by another active item,
and left-side card hover states do not show a partial inner outline artifact.

## Global Constraints

- Fix the shared `pair-matching` mission type, not only scene 5.1.
- Keep the answer shape as `Record<itemId, targetId>`.
- Do not add a public `capacity` field in this pass.
- Keep failed-answer feedback non-leaking; do not expose answer keys through
  public content, DOM copy, or retry details.
- Preserve existing normal happy paths for `knowledge-carrier-match`, Chapter 5
  boss carrier matching, and Chapter 6 final checklist matching.
- Keep visible UI copy Russian.

## Recommended Order

1. `PMX-00` preflight can run first and should not change code.
2. `PMX-01` and `PMX-02` can be implemented together because the UI needs the
   state guard.
3. `PMX-03` follows after the right-side clear control exists.
4. `PMX-04` adds focused automated regression coverage.
5. `PMX-05` performs final browser QA and documentation closeout.

## Task Index

| ID | Area | Primary files | Type | Dependency |
| --- | --- | --- | --- | --- |
| PMX-00 | Baseline inventory | docs/tests only | preflight | none |
| PMX-01 | One-to-one assignment guard | mission state/helpers | behavior | PMX-00 |
| PMX-02 | Right-side clear affordance | pair board UI | UX | PMX-01 |
| PMX-03 | Hover/focus polish | mission CSS | UI | PMX-02 |
| PMX-04 | Regression tests | unit/content/e2e | tests | PMX-01..PMX-03 |
| PMX-05 | Browser QA and closeout | browser/docs | verification | PMX-04 |

## PMX-00. Baseline Inventory

Goal: confirm the current shared `pair-matching` surface before edits.

Work:

- Inspect:
  - `src/features/mission/lib/useMissionSceneState.ts`
  - `src/features/mission/lib/missionAnswerHelpers.ts`
  - `src/features/mission/ui/MissionInteractionBoards.tsx`
  - `src/features/mission/ui/MissionScene.css`
  - `src/entities/chapter/model/chapters/chapterFive.ts`
  - `src/entities/chapter/model/chapters/chapterSix.ts`
  - `e2e/project-z.spec.ts`
- Confirm the current `pair-matching` authored missions and boss rounds:
  - Chapter 5 `knowledge-carrier-match`
  - Chapter 5 boss `gate-carrier-match`
  - Chapter 6 boss `gate-checklist-order`
- Confirm all current missions are one item per target.
- Record any drift directly in this subtasks file before implementation begins.

Acceptance:

- No code or authored content changes.
- The implementer knows whether every current `pair-matching` mission is
  one-to-one.
- Any discovered drift from this handoff is documented.

Baseline result, 2026-06-04:

- `rg` found exactly three current `pair-matching` surfaces:
  - Chapter 5 regular mission `knowledge-carrier-match`;
  - Chapter 5 boss round `gate-carrier-match`;
  - Chapter 6 boss round `gate-checklist-order`.
- Current authored content is one-to-one:
  - both Chapter 5 carrier matching surfaces use 6 items and the 6 shared
    `carrierTargets`, with one unique `acceptedTargetIds` target per item;
  - Chapter 6 final checklist matching uses 5 items and 5 targets, with one
    unique `acceptedTargetIds` target per item.
- No drift from this PMX handoff was found.
- Current shared UX/state baseline before edits:
  - `assignPairItemToTarget` writes `{ [itemId]: targetId }` without an
    occupied-target guard;
  - `isPairMatchingReady` only requires every item to have a target and does
    not reject duplicate target ids;
  - right-side target buttons are disabled only while submitting or when no
    active item exists, not when occupied by another item;
  - right-side assigned chips select their item but do not expose an explicit
    clear action;
  - `.pair-item-main:hover` participates in the shared hover shadow rule that
    also styles right-side controls.
- Existing coverage confirms the regular Chapter 5 happy path on desktop and
  mobile, failed-answer non-leakage, the Chapter 5 boss pair-matching dossier
  round, and the Chapter 6 boss final checklist happy path. It does not yet
  cover duplicate target readiness, occupied-target overwrite prevention, or
  right-side clear.
- Check run during preflight: `npm run validate:content` passed
  (`src/entities/chapter/model/chapterCatalog.content.test.ts`, 5 tests).

Suggested checks:

- `rg -n "kind: 'pair-matching'|acceptedTargetIds|targets:" src/entities/chapter/model/chapters`

Prompt:

```text
Выполни PMX-00 из docs/product/pair-matching-slot-ux-subtasks.md: сделай baseline inventory общего pair-matching UX. Код не меняй. Подтверди список pair-matching сцен/раундов и то, что текущий контент one-to-one.
```

## PMX-01. One-To-One Assignment Guard

Goal: prevent occupied targets from being overwritten by another active item.

Primary files:

- `src/features/mission/lib/useMissionSceneState.ts`
- `src/features/mission/lib/missionAnswerHelpers.ts`

Work:

- Update `assignPairItemToTarget(itemId, targetId)` so it returns the existing
  state unchanged when `targetId` is already assigned to a different item.
- Keep moving the same assigned item to another empty target.
- Keep assigning an unassigned item to an empty target.
- Keep active item advancement after successful assignment.
- Do not clear or replace another item implicitly.
- Update `isPairMatchingReady` so readiness requires:
  - every item has a target;
  - assigned target ids are unique.

Acceptance:

- Occupied target click does not overwrite another item.
- Current item can still move to an empty target.
- Submit readiness is false for duplicate target answers.
- No public mission type or answer shape changes.

Suggested checks:

- `npm run typecheck`
- focused unit test from PMX-04 once added

Prompt:

```text
Выполни PMX-01 из docs/product/pair-matching-slot-ux-subtasks.md: добавь one-to-one guard для assignPairItemToTarget и обнови isPairMatchingReady так, чтобы duplicate target answers не считались готовыми. Не меняй public answer shape.
```

## PMX-02. Right-Side Clear Affordance

Goal: make assigned slots clearable where the player sees the assignment.

Primary file:

- `src/features/mission/ui/MissionInteractionBoards.tsx`

Likely related file:

- `src/features/mission/ui/MissionScene.css`

Work:

- For each target, derive:
  - whether it is occupied;
  - which item occupies it;
  - whether it is occupied by the current active item.
- Disable `pair-target-main` when:
  - submitting;
  - no active item exists;
  - target is occupied by a different item.
- Render assigned item chips in the target assignment area with an explicit
  right-side clear button:
  - visible text/icon can stay `x`;
  - `aria-label` must name the item being cleared;
  - click calls `clearPairItem(item.id)`.
- Keep the assigned chip itself available for selecting that item if the current
  UI already supports it, but do not make chip click the only clear path.
- Keep the left-side clear button as a secondary path.

Acceptance:

- A filled right-side target visibly offers `x` clear.
- Clearing from the right side removes the assignment and updates progress.
- A target occupied by another item cannot be clicked as an assignment target.
- Keyboard users can reach and activate the clear control.

PMX-02 result, 2026-06-04:

- `MissionInteractionBoards.tsx` now derives the occupied target state,
  owning item, and active-item ownership for each right-side target.
- `pair-target-main` is disabled while submitting, while no item is active, or
  when the target is occupied by another item.
- Right-side assigned chips keep their item-selection button and add a separate
  `x` clear button with an item-specific `aria-label` that calls
  `clearPairItem(item.id)`.
- `MissionScene.css` adds compact joined styling for the right-side assigned
  chip and clear button.
- Checks passed: `npm run typecheck`, `npm run lint`, `npm run build`, and
  approved-local-server focused
  `npm run test:e2e -- --grep "completes the Rules & Skills carrier matching mission on desktop and mobile|locks the Rules & Skills boss pair matching round into the dossier"`
  (2 tests).
- Codex in-app Browser was available, but direct Vite browsing without the
  Playwright backend API fixture still shows the known backend-only fallback
  (`Сигнал карты сбился`) on the mission route; affected-route evidence is the
  backend-fixture Playwright run.

Suggested checks:

- `npm run typecheck`
- `npm run lint`

Prompt:

```text
Выполни PMX-02 из docs/product/pair-matching-slot-ux-subtasks.md: добавь явную очистку занятого target справа и disabled state для target, занятого другим item. Left-side clear оставь как дубль.
```

## PMX-03. Hover And Focus Polish

Goal: remove the strange left-card hover artifact without losing interaction
feedback.

Primary file:

- `src/features/mission/ui/MissionScene.css`

Work:

- Remove `.pair-item-main:hover` from the shared hover shadow rule that also
  targets right-side controls.
- Apply hover/focus styling at the card level or through a clean full-card
  treatment that matches the visible frame.
- Keep active and assigned states visually distinct:
  - active: warm highlight;
  - assigned but inactive: green-tinted state;
  - disabled/submitting: no pointer-looking hover.
- Add or preserve `:focus-visible` styling for `pair-item-main`,
  `pair-target-main`, `pair-clear-button`, and `pair-assigned-chip` controls.
- Ensure no card text or controls shift on hover.

Acceptance:

- Hovering a left-side card no longer creates a partial inner outline or
  offset shadow artifact.
- Focus state is visible from keyboard.
- Right-side target/chip hover remains intentional.
- No layout shift from hover/focus states.

Suggested checks:

- Browser inspection of Chapter 5 scene 5.1 at desktop size.
- `npm run lint`

Prompt:

```text
Выполни PMX-03 из docs/product/pair-matching-slot-ux-subtasks.md: убери hover artifact у левых pair-matching карточек. Не ломай active/assigned/focus states и не допускай layout shift.
```

## PMX-04. Regression Tests

Goal: lock the behavior so the UX bug does not come back.

Primary files:

- `src/features/mission/lib/missionAnswerHelpers.test.ts`
- `src/entities/chapter/model/chapterCatalog.content.test.ts`
- `e2e/project-z.spec.ts`

Work:

- Add unit coverage that `isPairMatchingReady` rejects duplicate target ids.
- Add or extend content validation for authored `pair-matching` missions:
  - item count equals target count;
  - every item has exactly one accepted target;
  - accepted target ids across items are unique.
- Add a focused Playwright regression in the existing Chapter 5 pair-matching
  test area:
  - assign first item to a target;
  - select a second item;
  - click the occupied target;
  - assert the first assignment remains and progress does not falsely advance;
  - clear the occupied target from the right side;
  - assert progress decreases and the target can be assigned again.
- Keep existing happy path helper `completeCarrierPairMatching` working.

Acceptance:

- Unit/content tests fail if duplicate target assignment becomes ready.
- E2E fails if occupied slots can be overwritten.
- E2E fails if right-side clear disappears or stops working.
- Existing Chapter 5 pair-matching completion still passes.

Suggested checks:

- `npm run test:unit -- src/features/mission/lib/missionAnswerHelpers.test.ts src/entities/chapter/model/chapterCatalog.content.test.ts`
- `npm run test:e2e -- --grep "Rules & Skills carrier matching|pair matching"`

Prompt:

```text
Выполни PMX-04 из docs/product/pair-matching-slot-ux-subtasks.md: добавь unit/content/e2e регрессию для one-to-one pair-matching, occupied target guard и right-side clear. Existing happy path должен остаться зелёным.
```

## PMX-05. Browser QA And Closeout

Goal: verify the fix visually and leave repo context current.

Work:

- Run final checks:
  - `npm run typecheck`
  - `npm run lint`
  - focused unit/content tests from PMX-04
  - focused e2e from PMX-04
- Use Codex Browser if available on:
  - `/chapters/chapter-5/missions/knowledge-carrier-match?qa=1`
- Verify:
  - no left-card hover artifact;
  - occupied target cannot be overwritten;
  - right-side `x` clears the slot;
  - progress and submit enabled/disabled state update correctly;
  - no horizontal overflow;
  - no error-level console logs.
- Update `docs/product/verification-and-self-review.md` with checks and browser
  QA result.
- Update `/Users/kirillmylnikov/Dev/ai/project-z-development-handoff.md` with
  final status if the implementation lands.

Acceptance:

- All requested checks are reported with pass/fail status.
- Browser QA evidence is recorded or explicitly marked unavailable with reason.
- Handoff docs point to the completed fix and any remaining risk.

Prompt:

```text
Выполни PMX-05 из docs/product/pair-matching-slot-ux-subtasks.md: проведи финальные checks и Browser QA для Chapter 5 pair-matching UX, затем обнови verification/self-review и project handoff с результатом.
```
