# QA Browser Bugfix Plan: Chapter 4 Boss To Finish

Date: 2026-06-02

Scope: manual Browser QA regression from Chapter 4 boss fight through course completion at `http://127.0.0.1:8080/`.

Operator used during repro: `@CODEX-REGRESS-20260602` / `Codex Browser QA`.

## Summary

The route is playable from Chapter 4 boss fight through final course completion. Chapters 4, 5, 6, and 7 can be completed, `/course/complete` opens, the archive shows `7/7` completed chapters, and all seven markdown templates are available.

Confirmed issues to assign:

1. [BUG-01: Leaderboard full-completion projection](./qa-browser-bugfix-subtask-2026-06-02-01-leaderboard-full-completion.md)
2. [BUG-02: Chapter 6 boss domain-source answer/content](./qa-browser-bugfix-subtask-2026-06-02-02-chapter-6-domain-source-answer.md)
3. [BUG-03: Map complete-route default state](./qa-browser-bugfix-subtask-2026-06-02-03-map-complete-default-state.md)
4. [BUG-04: Chapter 7 prompt-contract card labels](./qa-browser-bugfix-subtask-2026-06-02-04-chapter-7-prompt-contract-labels.md)

## BUG-01: Leaderboard Projection Is Stale Or Inconsistent After Full Completion

Priority: P0

Area:

- `src/pages/leaderboard/LeaderboardPage.tsx`
- `src/features/leaderboard/lib/useLeaderboardEntries.ts`
- `src/features/leaderboard/lib/leaderboardModel.ts`
- `src/entities/chapter/lib/leaderboardProjection.ts`
- backend/progress projection code if leaderboard data now comes from server

Observed:

After completing all seven chapters and opening `/leaderboard`, the top summary shows the current operator correctly:

```text
7/7
закрыто глав
Playbook Crafter
текущий ранг
```

But the same page also shows:

```text
награды ещё впереди
последняя награда
Лучший результат: 3
```

The ranking table does not include `@CODEX-REGRESS-20260602` and still shows a best result of `3/7`.

Repro:

1. Complete the route through Chapter 7 badge.
2. Open `/leaderboard`.
3. Observe the top user summary and the ranking table.
4. Navigate map -> leaderboard again; the mismatch remains.

Expected:

- Current operator appears in the ranking table.
- Best result is `7`, not `3`.
- Last reward reflects the latest earned reward, likely `Сценарий оформлен`, not `награды ещё впереди`.
- The table and top summary use the same completed chapter count/rank source or a synchronized projection.

Likely Fix Tasks:

1. Identify why the "Твой зачёт" summary and ranking table read different sources.
2. Ensure full completion updates the leaderboard projection/read model.
3. Ensure the current operator/session is included in the leaderboard rows after progress changes.
4. Fix latest reward derivation for completed users.
5. Add a regression test for a user with all seven chapters completed.

Acceptance Criteria:

- Given a user with 7 closed chapters, `/leaderboard` shows that user in the table with `7/7` and rank `Playbook Crafter`.
- `Лучший результат` is at least `7` for that state.
- Latest reward is not `награды ещё впереди` when any chapter reward has been earned.
- Add/update unit tests for leaderboard projection/model and one browser/e2e check if the suite supports it.

## BUG-02: Chapter 6 Boss Round 3 Domain Source Answer Is Confusing

Priority: P1

Area:

- `src/entities/chapter/model/chapters/chapterSix.ts`
- `src/entities/mission/lib/missionEngine.ts`
- `src/entities/mission/lib/missionEngine.test.ts`
- `src/entities/chapter/model/chapterCatalog.content.test.ts`
- `scripts/check-browser-bundle-answer-keys.mjs`

Observed:

Chapter 6 boss, round 3 asks:

```text
Что может быть настоящим доменным источником для такого правила?
```

The following seemingly valid set fails:

```text
Актуальная спецификация правила отпусков
Подтверждение владельца домена или QA с контекстом правила
Существующий эталонный тест на похожий half-day кейс
```

The following also fails:

```text
Актуальная спецификация правила отпусков
Подтверждение владельца домена или QA с контекстом правила
```

The round passes only when also selecting:

```text
Синтетический пример без персональных данных, похожий на рабочий
```

Why this is a bug:

The copy frames the round as choosing a "domain source". A synthetic example can be a safe test fixture or example, but it is not obviously a source of domain truth. The content and answer key are out of alignment.

Expected:

Pick one product decision and make content/key consistent:

- Option A: Treat only actual domain truth sources as correct: current spec, domain owner/QA confirmation, and an existing golden/ethalon test when it truly encodes the rule.
- Option B: Rename/reframe the round to ask for "domain source and safe evidence/examples", then explain why the sanitized synthetic example is required.

Likely Fix Tasks:

1. Review the Chapter 6 boss round 3 answer key and feedback copy.
2. Decide whether the synthetic example is required or just useful.
3. Update labels/feedback so wrong and right sets are unambiguous.
4. Add content tests for the intended accepted/rejected combinations.

Acceptance Criteria:

- A user can infer the correct answer from the prompt and rule text without guessing.
- Final dossier feedback explains why each selected correct option is valid.
- The accepted set matches the wording of "domain source" or the wording is changed.

## BUG-03: Map Post-Completion Default Message Shows Chapter 1 Reward

Priority: P2

Area:

- `src/pages/map/MapPage.tsx`
- `src/features/map/lib/mapViewModel.ts`
- `src/features/map/lib/useWorldMapState.ts`
- `src/entities/chapter/lib/chapterResume.ts`
- `src/entities/chapter/lib/courseCloseout.ts`

Observed:

After completing all seven chapters and navigating from `/course/complete` back to `/map`, the map correctly shows all nodes checked:

```text
Маршрут закрыт
Закрыто 7/7
Все главы пройдены
```

But the prominent Z-bot message says:

```text
Награда получена: «Ответственный автор»
Ты закрыл главу «ИИ как инженерный инструмент».
```

That is the Chapter 1 reward/message, not the route completion state or latest Chapter 7 reward.

Expected:

After full completion, the default map message should prioritize one of:

- route completion / archive call to action;
- latest completed chapter reward (`Сценарий оформлен`);
- no chapter-specific reward message unless the user explicitly selects a chapter.

Likely Fix Tasks:

1. Find why the map defaults to Chapter 1 after full completion.
2. Update the map view model selection priority for completed routes.
3. Add a regression test for "all chapters completed" map state.

Acceptance Criteria:

- With 7/7 chapters closed, `/map` opens on a route-complete state.
- The default message does not claim the latest event is Chapter 1 unless Chapter 1 is explicitly selected.
- The archive link remains visible and reachable.

## BUG-04: Chapter 7 Prompt-Contract Assembly Mislabels Unplaced Cards

Priority: P3

Area:

- `src/entities/chapter/model/chapters/chapterSeven.ts`
- `src/features/mission/ui/MissionInteractionBoards.tsx`
- `src/features/mission/lib/useMissionSceneState.ts`
- `src/features/mission/lib/missionAnswerHelpers.ts`

Observed:

In Chapter 7 scene 7.3 (`/chapters/chapter-7/missions/prompt-skeleton-assembly`), after filling all seven slots, placed cards are marked correctly:

```text
В СЛОТЕ: ЦЕЛЬ
В СЛОТЕ: КОНТЕКСТ
...
```

But unplaced cards all show a target for the currently active slot, which remains the last selected slot:

```text
В СЛОТ: ПЛАН ДО ПРАВОК
```

This is mechanically understandable but confusing. It makes every remaining card look like it belongs in `План до правок`.

Expected:

Unplaced cards should not imply semantic membership in the active slot. Better options:

- `Добавить в выбранный слот`;
- `Выбери слот для размещения`;
- show each card's intended slot only if that is intentional content metadata, not active selection state.

Likely Fix Tasks:

1. Separate "current destination slot" UI from "this fragment's intended/correct slot" UI.
2. Update text/aria labels for unplaced fragments.
3. Add a focused UI/state test if mission board rendering has coverage.

Acceptance Criteria:

- After filling the canvas, unplaced distractor cards no longer read as if they belong to the active slot.
- Placed cards still clearly show which slot contains them.
- Keyboard/screen-reader labels remain understandable.

## Not Bugs From This QA Pass

These were observed during Browser QA but should not be assigned as app bugs unless reproduced outside the Codex in-app Browser.

1. `.md` download payload was not verified because Codex in-app Browser does not support download events.
2. `Statsig` / `Cloudflare` errors in the tool logs came from the Browser runtime telemetry (`ab.chatgpt.com` / `oaistatsig.com`), not from Project Z.
3. Screenshot emission through `nodeRepl.emitImage` was unstable in the QA environment; this did not affect app navigation.

## Suggested Regression After Fixes

Run a targeted browser pass:

1. Start from Chapter 6 boss round 3 and verify the corrected answer/content.
2. Complete Chapter 7 through badge.
3. Open `/course/complete` and switch archive templates `#01` -> `#07`.
4. Open `/map` and verify the route-complete default state.
5. Open `/leaderboard` and verify current operator appears with `7/7`, correct rank, and latest reward.

Suggested automated coverage:

- `leaderboardProjection` full-completion case.
- map view model full-completion default case.
- Chapter 6 boss round 3 accepted/rejected answer combinations.
- Chapter 7 prompt-contract board render state after all slots are filled.
