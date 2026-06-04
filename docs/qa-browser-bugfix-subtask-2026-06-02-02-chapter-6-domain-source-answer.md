# Subtask BUG-02: Fix Chapter 6 Boss Domain-Source Answer Content

Priority: P1

Owner: unassigned

Source QA pass: Browser regression from Chapter 4 boss fight through `/course/complete` on 2026-06-02.

## Objective

Align Chapter 6 boss round 3 prompt, answer key, and feedback so the user can infer the correct choices without guessing.

## Observed Behavior

Chapter 6 boss round 3 asks:

```text
Что может быть настоящим доменным источником для такого правила?
```

The following set fails:

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

## Why This Is A Bug

The prompt asks for a "domain source". A sanitized synthetic example can be useful evidence or a safe fixture, but it is not clearly a source of domain truth. Current content and answer key are misaligned.

## Reproduction

1. Open Chapter 6 boss: `/chapters/chapter-6/missions/verification-gate`.
2. Progress to round 3.
3. Select the domain spec, domain owner/QA confirmation, and existing half-day test.
4. Finish the boss.
5. Observe round 3 is marked `Нужен разбор`.
6. Retry with the sanitized synthetic example included.
7. Observe the boss passes.

## Expected Behavior

Pick one product direction and make prompt/key/feedback consistent:

- Option A: If the round is strictly about domain truth sources, accept only actual sources such as current spec, domain owner/QA confirmation, and a true existing golden test.
- Option B: If the synthetic example is intentionally required, reframe the prompt as "domain source plus safe evidence/examples" and explain that requirement in the feedback.

## Likely Area

- `src/entities/chapter/model/chapters/chapterSix.ts`
- `src/entities/mission/lib/missionEngine.ts`
- `src/entities/mission/lib/missionEngine.test.ts`
- `src/entities/chapter/model/chapterCatalog.content.test.ts`
- `scripts/check-browser-bundle-answer-keys.mjs`

## Work Plan

1. Inspect Chapter 6 boss round 3 mission config and answer key.
2. Decide whether the synthetic example should be accepted, required, optional, or rejected.
3. Update prompt text, option text, feedback, and final dossier copy accordingly.
4. Add/adjust content tests for accepted and rejected combinations.
5. Run answer-key/bundle validation scripts if available.

## Acceptance Criteria

- Correct options are clear from the round prompt and rule reminder.
- Accepted set matches the wording of the prompt.
- Rejected sets receive useful feedback, not surprising failure.
- Tests cover the intended accepted combination and at least one tempting rejected combination.

## Suggested Verification

```bash
npm test -- chapterSix
npm test -- missionEngine
node scripts/check-browser-bundle-answer-keys.mjs
```

Use the project-supported command names if they differ.

## Notes

Avoid weakening the mission by making all plausible options correct. The goal is a clear product decision and matching feedback.
