# Answer Display Shuffle Subtasks

Дата: 2026-06-04

Цель: разбить механизм перемешивания отображаемых ответов Project Z на
независимые агентские задачи.

Пользовательское решение для этой разбивки:

- новый запуск = новая загрузка приложения, refresh или new tab;
- порядок должен оставаться стабильным внутри текущей загрузки, включая retry,
  reset, boss rounds и SPA-переходы;
- перемешивать только варианты ответов: `scenario-decision.options`,
  `chip-picker.chips` и исходный банк `chip-ordering.chips`;
- не перемешивать `pair-matching.items`, `pair-matching.targets`,
  `prompt-assembly.slots` и `prompt-assembly.fragments`.

## Target State

- Ответы отображаются в другом порядке при новой загрузке приложения.
- Текущая попытка не "прыгает": повторный render, reset ответа, retry после
  ошибки и переходы внутри той же загрузки сохраняют порядок карточек.
- Submit, scoring, QA PASS, progress и backend API продолжают работать по `id`,
  без изменений wire contract.
- Public browser bundle по-прежнему не содержит authored answer-key полей.
- Для `chip-ordering` перемешивается только банк доступных карточек; порядок,
  который собрал пользователь в `order-track`, остается его ответом.

## Recommended Order

1. `ADS-00` preflight.
2. `ADS-01` helper and tests.
3. `ADS-02` UI integration.
4. `ADS-03` regression coverage.
5. `ADS-04` final verification.

## Task Index

| ID | Area | Primary files | Type | Dependency |
| --- | --- | --- | --- | --- |
| ADS-00 | Baseline and acceptance inventory | docs only | preflight | none |
| ADS-01 | Shuffle helper | `src/features/mission/lib` | implementation + unit tests | ADS-00 |
| ADS-02 | Mission UI integration | `MissionInteractionBoards.tsx` | implementation | ADS-01 |
| ADS-03 | Regression tests | mission UI/helper/e2e tests | tests | ADS-02 |
| ADS-04 | Final verification | checks + handoff note | verification | ADS-01..ADS-03 |

## ADS-00: Baseline And Acceptance Inventory

Goal: зафиксировать текущие места отображения ответов и тестовые риски до
правок.

Inputs:

- `src/features/mission/ui/MissionInteractionBoards.tsx`
- `src/features/mission/lib/useMissionSceneState.ts`
- `src/features/mission/lib/missionAnswerHelpers.ts`
- `src/shared/api/content/publicContentProjection.ts`
- `src/entities/mission/lib/missionEngine.ts`
- `e2e/project-z.spec.ts`

Work:

- Подтвердить, что UI рендерит варианты напрямую из public массивов:
  `options`, `chips`, `items`, `targets`, `fragments`.
- Подтвердить, что scoring и submit используют ids, а не позицию карточки.
- Найти e2e assertions, которые могут зависеть от порядка карточек или
  `.nth(...)`, особенно для `chip-ordering`.
- Зафиксировать, какие banks должны и не должны перемешиваться по решению выше.
- Не менять код.

Acceptance:

- Агентский ответ содержит список touch points и порядок реализации.
- Отмечены e2e-сценарии, которые нужно проверить после перемешивания.
- Нет изменений в репозитории.

Prompt:

```text
Выполни ADS-00 из docs/product/answer-display-shuffle-subtasks-2026-06-04.md: сделай baseline inventory для display shuffle. Подтверди UI touch points, что submit/scoring идут по id, и найди e2e-селекторы с риском зависимости от порядка. Код не меняй.
```

### ADS-00 Baseline Note

Статус: выполнено 2026-06-04, код не менялся.

Touch points:

- `MissionInteractionBoards.tsx` рендерит публичные банки напрямую:
  `scenario-decision` через `mission.options.map(...)`, `chip-picker` через
  `mission.chips.map(...)`, `chip-ordering` source bank
  `aria-label="Карточки для сборки"` через `mission.chips.map(...)`.
- `chip-ordering` также использует `mission.chips.find(...)` как lookup для
  уже выбранных `selectedChipIds` в `aria-label="Текущий порядок"`; этот
  `order-track` не перемешивать.
- `pair-matching.items`, `pair-matching.targets`, `prompt-assembly.slots` и
  `prompt-assembly.fragments` тоже рендерятся напрямую, но по пользовательскому
  решению их authored order сохраняется.
- `publicContentProjection.ts` уже отдает только public `id`/`label`/public
  fields и не раскрывает authored answer-key поля.

Submit/scoring:

- `useMissionSceneState.ts` хранит выбор как ids: `selectedOptionId`,
  `selectedChipIds`, `Record<itemId, targetId>` для pair matching и
  `Record<slotId, fragmentId>` для prompt assembly.
- `submitAnswer()` передает raw answer ids/records; boss answers keyed by
  `round.id`. Позиция карточки не отправляется.
- `MissionPage.tsx` и `HttpMissionAttemptService` отправляют normal submit как
  `{ answer, chapterId, clientAttemptId, contentVersion }`; QA PASS идет в
  отдельный endpoint без `answer`.
- `missionEngine.ts` оценивает по ids: scenario ищет option by id,
  chip-picker сравнивает selected ids с correct ids, chip-ordering сравнивает
  пользовательский ordered id list с `correctOrder`.

E2E risks to re-check after ADS-02/ADS-03:

- `e2e/project-z.spec.ts` keyboard test uses
  `.choice-grid button.first()`. It does not assert a specific authored answer,
  but it is the only answer-card selector that intentionally depends on first
  displayed position.
- Chapter 4 inventory ordering test clicks chips by accessible name/text and
  should survive shuffle; keep it in focused verification because it checks the
  source bank below actions and order-track count.
- Ordering/boss completion tests mostly click chips by accessible name/text and
  should survive shuffle; keep Chapter 3/6/7/8 ordering and boss flows in the
  regression run.
- `.boss-round-dot.nth(...)` checks authored boss round order, not answer-card
  order; preserve it because `mission.rounds` must not be shuffled.
- Failed-answer leakage tests click by text/name and should keep verifying that
  shuffled display order does not reveal missed correct answers or exact
  ordering.

Implementation order from the baseline:

1. Add helper/tests in ADS-01 with no UI integration.
2. In ADS-02 shuffle only `scenario-decision.options`, `chip-picker.chips` and
   the `chip-ordering` source bank using stable `bankKey`s.
3. Do not shuffle `selectedChipIds`/`order-track`, pair matching, prompt
   assembly, or `mission.rounds`.
4. In ADS-03 add regression coverage and revisit the single `.choice-grid
   button.first()` keyboard selector.

## ADS-01: Stable Launch Shuffle Helper

Goal: добавить переиспользуемый helper для стабильного перемешивания внутри
одной загрузки приложения.

Primary files:

- `src/features/mission/lib/answerDisplayShuffle.ts`
- `src/features/mission/lib/answerDisplayShuffle.test.ts`

Work:

- Добавить pure seeded shuffle для массивов объектов с `id`.
- Не мутировать входные массивы.
- Сохранять все элементы ровно один раз.
- Сделать порядок стабильным для одного `seed + bankKey + ids`.
- Сделать порядок разным для разных seed, когда у банка больше одного элемента.
- Добавить browser launch seed, создаваемый при загрузке JS module.
- Добавить in-memory cache по `bankKey + ids`, чтобы в рамках одной загрузки
  порядок не менялся между render/remount.
- Для строгого "новый запуск меняет порядок" добавить lightweight guard от
  немедленного повтора предыдущей раскладки:
  - хранить только public ids в `localStorage`;
  - если новая раскладка совпала с предыдущей для того же bank key и элементов
    больше одного, применить deterministic rotate/reverse;
  - не использовать storage для scoring, submit или правильных ответов.
- Сделать helper безопасным для SSR/test окружения: если `window`, `crypto` или
  `localStorage` недоступны, работать через переданный seed и no-op storage.

Acceptance:

- Unit tests покрывают:
  - стабильность одного seed;
  - различие двух seed или fallback rotate при совпадении;
  - отсутствие мутации входа;
  - сохранение всех ids;
  - no-op behavior для массивов длиной `0` и `1`;
  - стабильность cache внутри одного launch key.
- Helper не импортирует domain/private mission types и не знает про правильные
  ответы.

Suggested checks:

- `npm run test:unit -- src/features/mission/lib/answerDisplayShuffle.test.ts`
- `npm run typecheck`

Prompt:

```text
Выполни ADS-01: добавь src/features/mission/lib/answerDisplayShuffle.ts с pure seeded shuffle для объектов с id, browser launch seed, in-memory cache и guard от немедленного повтора предыдущего public-id порядка через localStorage. Добавь focused unit tests. Не подключай UI.
```

### ADS-01 Completion Note

Статус: выполнено 2026-06-04, UI не подключался.

- Добавлен `src/features/mission/lib/answerDisplayShuffle.ts` с generic
  helper для объектов `{ id: string }`: pure seeded shuffle, module-level
  browser launch seed, cache внутри текущей загрузки по `bankKey + ids`,
  no-op storage fallback и localStorage repeat guard, который хранит только
  public ids.
- Добавлен `src/features/mission/lib/answerDisplayShuffle.test.ts`.
  Покрыто: стабильность одного seed, отсутствие мутации входа, сохранение всех
  ids, no-op для `0`/`1`, стабильность launch cache, fallback rotate при
  немедленном повторе stored public-id order и storage без private fields.
- Checks passed: `npm run test:unit -- src/features/mission/lib/answerDisplayShuffle.test.ts`,
  `npm run typecheck`, `npm run lint`, `npm run build`.
- Следующий шаг: ADS-02, подключить helper в `MissionInteractionBoards.tsx`
  только для `scenario-decision.options`, `chip-picker.chips` и source bank
  `chip-ordering.chips`.

## ADS-02: Mission Interaction UI Integration

Goal: применить перемешанный display order в mission UI без изменения submit
shape.

Primary file:

- `src/features/mission/ui/MissionInteractionBoards.tsx`

Related files only if needed:

- `src/features/mission/lib/useMissionSceneState.ts`
- `src/features/mission/lib/missionAnswerHelpers.ts`

Work:

- Подключить helper к рендеру:
  - `ScenarioDecisionBoard`: перемешивать `mission.options`;
  - `ChipPickerBoard`: перемешивать `mission.chips`;
  - `ChipOrderingBoard`: перемешивать только банк `mission.chips` в
    `aria-label="Карточки для сборки"`.
- Использовать стабильные `bankKey`, например:
  - `${mission.id}:scenario-options`;
  - `${mission.id}:chip-picker`;
  - `${mission.id}:chip-ordering-bank`.
- Не перемешивать:
  - `selectedChipIds` в `order-track`;
  - `pair-matching` items/targets;
  - `prompt-assembly` slots/fragments;
  - boss round order.
- Сохранить все обработчики выбора, drag/drop и disable states.
- Не менять public content projection, backend API, `missionEngine` или QA PASS.

Acceptance:

- Пользовательский выбор продолжает отправлять те же ids, независимо от позиции
  карточки.
- Reset/retry в текущей загрузке не меняет порядок отображения.
- `chip-ordering` drag/drop и click-to-pick работают с перемешанным банком.
- Public bundle answer-key guard не затрагивается.

Suggested checks:

- `npm run typecheck`
- `npm run test:unit`

Prompt:

```text
Выполни ADS-02: подключи answerDisplayShuffle к MissionInteractionBoards. Перемешай только scenario options, chip-picker chips и chip-ordering source bank. Не трогай pair-matching, prompt-assembly, selected order-track, backend/API/scoring/QA PASS.
```

## ADS-03: Regression Tests For Display Shuffle

Goal: зафиксировать поведение тестами и не сломать существующие e2e.

Likely files:

- `src/features/mission/lib/answerDisplayShuffle.test.ts`
- `src/features/mission/ui/MissionScene.qaPass.test.ts`
- `e2e/project-z.spec.ts`

Work:

- Добавить focused coverage для UI или helper-level поведения:
  - одинаковый launch seed дает одинаковый порядок при повторном рендере;
  - другой launch seed меняет порядок для банка из нескольких вариантов;
  - selected ids не зависят от позиции.
- Проверить, что существующие e2e кликают ответы по accessible name/text, а не
  по позиции. Если найден порядок-зависимый selector, заменить на name-based.
- Добавить один lightweight e2e или component-style тест только если unit/helper
  tests не доказывают интеграцию с UI:
  - открыть regular mission с `scenario-decision` или `chip-picker`;
  - выбрать ответ по тексту;
  - submit проходит/показывает ожидаемый feedback.
- Не добавлять flaky тест, который требует случайного отличия без управляемого
  seed.

Acceptance:

- Тесты доказывают стабильность внутри запуска и смену порядка между seed.
- Существующие mission e2e не завязаны на индекс карточки.
- Failed-answer leakage tests продолжают проверять отсутствие раскрытия ключей.

Suggested checks:

- `npm run test:unit`
- `npm run test:e2e -- --grep "does not reveal correct answers|chapter 4 inventory ordering|reworked ordering"`

Prompt:

```text
Выполни ADS-03: добавь regression tests для display shuffle. Покрой стабильность внутри launch, смену порядка между seed, сохранение ids и отсутствие зависимости e2e от позиции карточек. Не делай flaky random-only assertions.
```

### ADS-03 Completion Note

Статус: выполнено 2026-06-04.

- Расширен `src/features/mission/lib/answerDisplayShuffle.test.ts`: добавлены
  deterministic проверки смены порядка между двумя seed для multi-answer банка
  и сохранения selection identity через public `id`, а не позицию карточки.
- В `e2e/project-z.spec.ts` keyboard mission choice test больше не использует
  `.choice-grid button.first()`; выбор answer-card теперь идет по accessible
  name/text.
- Повторная проверка e2e-селекторов показала, что оставшиеся `.choice-grid` /
  `.chip-grid` обращения не выбирают ответ по индексу: chapter 4 ordering
  фильтрует chip по тексту, `.choice-grid` используется для layout bounds, а
  `.boss-round-dot.nth(...)` проверяет порядок раундов босса, не карточек
  ответов.
- Checks passed: `npm run test:unit -- src/features/mission/lib/answerDisplayShuffle.test.ts`,
  `npm run test:unit`, `npm run typecheck`, `npm run lint`,
  `npm run test:e2e -- --grep "does not reveal correct answers|chapter 4 inventory ordering|reworked ordering"`,
  `npm run test:e2e -- --grep "keyboard navigation on map and mission choices"`.
  Focused e2e сначала уперся в sandbox `listen EPERM 127.0.0.1:5174`, затем
  прошел после approved rerun вне sandbox.

## ADS-04: Final Verification And Handoff

Goal: финально доказать, что перемешивание работает и не открыло новые утечки.

Work:

- Запустить доступные проверки:
  - `npm run test:unit`;
  - `npm run typecheck`;
  - `npm run lint`;
  - `npm run build`.
- Если sandbox не позволяет e2e server binding, запросить approved rerun или
  явно зафиксировать blocker.
- При возможности вручную проверить в браузере:
  - открыть одну `scenario-decision` mission;
  - открыть одну `chip-picker` mission;
  - открыть одну `chip-ordering` mission;
  - refresh/new tab меняет порядок;
  - reset/retry внутри загрузки порядок не меняет;
  - submit работает по тексту/выбору.
- Добавить короткую verification note в финальный ответ или в этот файл, если
  проектная практика текущего потока требует handoff notes.

Acceptance:

- Все доступные checks pass или blocker указан с exact command.
- `npm run build` проходит вместе с `check-browser-bundle-answer-keys`.
- Browser/manual QA подтверждает target state либо явно отмечено как не
  выполненное.

Prompt:

```text
Выполни ADS-04: проведи final verification для answer display shuffle. Запусти unit/typecheck/lint/build, focused e2e если доступен, и browser smoke для scenario, chip-picker, chip-ordering. Зафиксируй pass/blockers и не меняй поведение вне shuffle.
```

### ADS-04 Completion Note

Статус: выполнено 2026-06-04.

- Checks passed: `npm run test:unit` (23 files / 176 tests),
  `npm run typecheck`, `npm run lint`, `npm run build`.
- `npm run build` прошел полный production build и
  `scripts/check-browser-bundle-answer-keys.mjs`.
- Focused e2e сначала ожидаемо уперся в sandbox server binding:
  `listen EPERM 127.0.0.1:5174`; approved rerun вне sandbox прошел:
  `npm run test:e2e -- --grep "does not reveal correct answers|chapter 4 inventory ordering|reworked ordering|keyboard navigation on map and mission choices"`
  (4 passed).
- Browser smoke выполнен через production `dist` и временный in-memory API
  server: проверены `scenario-decision`, `chip-picker` и `chip-ordering`.
  Для всех трех типов reset/retry сохранили текущий display order, reload
  изменил display order, submit по выбранным текстам/ids прошел. Для
  `chip-ordering` подтверждено, что source bank перемешивается, а
  `order-track` сохраняет пользовательский порядок.
- New-tab browser smoke не завершен из-за ограничения in-app browser single-tab
  session: при попытке открыть вторую вкладку старый tab handle стал
  недействительным (`Tab 8 is not part of browser session`). Refresh/reload
  smoke целевого поведения прошел.
