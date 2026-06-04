# Subtask BUG-01: Fix Leaderboard Full-Completion Projection

Priority: P0

Owner: unassigned

Source QA pass: Browser regression from Chapter 4 boss fight through `/course/complete` on 2026-06-02.

## Objective

Make `/leaderboard` reflect the current operator's fully completed route consistently across the summary card and ranking table.

## Observed Behavior

After completing all seven chapters, `/leaderboard` shows the current operator summary correctly:

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

## Reproduction

1. Complete Chapter 7 boss and claim the Chapter 7 badge.
2. Open `/course/complete` and verify `7/7`.
3. Open `/leaderboard`.
4. Compare the top "Твой зачёт" summary with the ranking table.
5. Navigate `/map` -> `/leaderboard`; the mismatch remains.

## Expected Behavior

- The current operator appears in the leaderboard table with `7/7`.
- `Лучший результат` is `7` or higher for this state.
- Current rank is `Playbook Crafter`.
- Latest reward is the actual latest earned reward, likely `Сценарий оформлен`, not `награды ещё впереди`.
- Summary and table use the same source or synchronized projections.

## Likely Area

- `src/pages/leaderboard/LeaderboardPage.tsx`
- `src/features/leaderboard/lib/useLeaderboardEntries.ts`
- `src/features/leaderboard/lib/leaderboardModel.ts`
- `src/entities/chapter/lib/leaderboardProjection.ts`
- backend progress/leaderboard projection if ranking now comes from the server

## Work Plan

1. Trace data flow for the top summary and ranking table.
2. Identify why current progress reaches the summary but not leaderboard rows.
3. Fix projection/update path so full chapter completion updates ranking data.
4. Fix latest reward derivation for completed users.
5. Add regression coverage for a user with all seven chapters completed.

## Acceptance Criteria

- A completed user appears in `/leaderboard` rows with `7/7`.
- `Лучший результат` is `7` for a dataset where the completed user is the top result.
- `последняя награда` is not `награды ещё впереди` after badges exist.
- Unit tests cover full-completion leaderboard projection/model behavior.
- Browser/e2e coverage is added if the existing suite supports a focused check.

## Suggested Verification

```bash
npm test -- leaderboard
npm run test -- leaderboard
```

Use the project-supported command names if they differ.

## Notes

Do not solve this by hiding the table mismatch. The table data itself must be correct.
