# Rules & Skills content expansion

Документ предлагает расширение Project Z про `rules` и `skills` как отдельную часть AI-assisted разработки. Сейчас эта тема частично есть в курсе через `AGENTS.md`, context engineering и playbooks, но не выделена как самостоятельная операционная практика.

## Короткий вывод

Да, это важная недостающая составляющая.

Текущий курс хорошо учит:

- ставить задачу агенту;
- работать от плана;
- собирать контекст проекта;
- держать бюджет контекста;
- проверять результат;
- превращать удачные workflow в playbooks.

Но между "дать агенту контекст" и "сделать командный playbook" не хватает отдельного слоя: **как проектировать устойчивую систему правил и переиспользуемых навыков агента**.

Без этого участник может вынести упрощённый вывод: "надо написать хороший `AGENTS.md` и пару playbooks". На практике зрелая AI-assisted разработка требует более точной модели:

- `rules` задают постоянные и scoped ограничения;
- `skills` описывают повторяемые процедуры;
- `playbooks` связывают rules/skills в командный workflow;
- task brief подключает только то, что нужно в конкретной задаче.

## Что уже было покрыто до вставки главы

В исходной 7-главной структуре Project Z тема частично была разложена так:

| Текущий блок | Что покрывает | Чего не хватает |
| --- | --- | --- |
| Chapter 4: Контекст проекта | `AGENTS.md`, repo context, always-on vs scoped context, sensitive boundaries | Нет отдельного решения: что является rule, где она должна жить, как избежать конфликта правил |
| Будущий `chapter-6`: Гигиена контекста | бюджет внимания, режим работы, stop rule | Нет практики выбора, какие rules/skills подключать в текущую сессию |
| Будущий `chapter-8`: Рабочие сценарии | reusable playbooks, clinic-to-playbook cycle | Skills не отделены от playbooks; нет lifecycle для rules/skills |

Вывод: тему не нужно вставлять с нуля, но её нужно явно назвать и дать ей отдельную механику.

## Базовое решение

Принято базовое направление: **делаем отдельную главу между текущими Chapter 4 и Chapter 5**.

Дальше план прорабатывается не как "расширить пару сцен", а как новая глава курса с собственными learning objectives, миссиями, artifact, boss fight, retry principles и связками с соседними главами.

Зафиксированные решения после ревью:

- Глава обязательная, не advanced/optional.
- Фрейминг: **управление агентом**.
- Термины `rules` и `skills` оставляем английскими как базовые термины. `playbook` остаётся темой финальной главы; в новой главе он упоминается только как следующий уровень упаковки workflow.
- Не привязываемся к конкретному инструменту и не учим файловый формат Codex Skill / `SKILL.md`.
- Глава tool-agnostic: реальные форматы можно упоминать как примеры носителей знания, но не делать их учебной целью.
- Добавляем новый тип миссии: **соедини пару** / pair matching, где игрок связывает знание с правильным носителем.
- Баланс миссий нужно проверить по соседним главам; предварительный baseline -- 4 обычных миссии + boss fight.
- Artifact должен быть двумя отдельными файлами: `Rules Inventory` и `Skill Draft`.
- Выбор реальных Project Z примеров подвешен до отдельной ревизии.
- Новые trap concepts допустимы.
- Планируем сразу MLP, не MVP.

## Рекомендуемое изменение структуры

### Baseline option: новая глава между Chapter 4 и текущей Chapter 5

Добавить новую главу:

**Rules & Skills: операционная память агента**

Поставить её после `Контекст проекта` и перед `Гигиена контекста`.

Обновлённая логика курса:

1. ИИ как инженерный инструмент
2. Постановка задачи
3. Работа от плана
4. Контекст проекта
5. Rules & Skills
6. Гигиена контекста
7. Дисциплина проверки
8. Рабочие сценарии

Почему именно тут:

- Chapter 4 уже объясняет, что агенту нужна среда.
- Новая Chapter 5 объясняет, как превратить эту среду в управляемые правила и навыки.
- Гигиена контекста после этого становится понятнее: участник уже знает, что нельзя грузить все rules/skills всегда.
- Playbooks в финале становятся не "хорошими промптами", а упаковкой rules/skills в командный workflow.

### Rejected alternative: расширить Chapter 4 и Chapter 7 без новой главы

Этот вариант больше не является базовым, но остаётся как fallback, если позже выяснится, что увеличение курса до 8 глав нежелательно.

Что он включал бы:

- добавить 1 миссию в Chapter 4 про классификацию rules;
- добавить 1 миссию в Chapter 7 про skill draft;
- расширить artifact Chapter 7 секцией skills.

Минус: тема останется скрытой внутри context/playbook, а не станет самостоятельной компетенцией.

## Learning objective новой главы

После главы участник умеет:

- отличать rule, skill, playbook, task brief и one-off prompt;
- решать, где должно жить знание: always-on rule, scoped rule, tool-specific rule, reusable skill, playbook или текущий бриф;
- писать rules, которые помогают агенту, а не сжигают контекст;
- собирать skill как повторяемую процедуру с входами, шагами, проверкой и stop condition;
- находить конфликтующие, устаревшие и небезопасные инструкции;
- выпускать rules/skills как пилот, а не как "вечную магию" одного разработчика.

Главное правило главы:

> Не каждый удачный промпт должен становиться правилом. Не каждое правило должно грузиться всегда. Не каждый workflow является skill.

## Термины

### Rule

Короткое ограничение или соглашение, которое агент должен учитывать.

Примеры:

- "Не менять соседние модули без отдельного согласования."
- "Для gameplay UI всегда проверять desktop и mobile viewports."
- "Не использовать реальные логи, секреты и PII как контекст модели."
- "Backend contract changes требуют теста API parity."

Хорошая rule:

- короткая;
- применима часто или в понятной зоне;
- проверяема;
- имеет владельца или источник истины;
- не конфликтует с другими правилами.

Плохая rule:

- звучит как лозунг;
- слишком общая;
- устарела;
- повторяет очевидное;
- заставляет агента грузить лишний контекст;
- прячет one-off предпочтение под видом командного стандарта.

### Skill

Повторяемая процедура, которую агент может выполнить в похожем классе задач.

Skill должен содержать:

- when to use;
- when not to use;
- required inputs;
- workflow steps;
- forbidden moves;
- verification;
- stop conditions;
- known bad cases.

Пример skill: "Проверить gameplay UI после изменения миссии".

Это не одна строка промпта, а процедура:

- открыть релевантную миссию;
- пройти happy path;
- проверить ошибочную попытку;
- проверить retry hint;
- снять desktop/mobile screenshots;
- убедиться, что правильный ответ не раскрывается;
- зафиксировать команды и остаточные риски.

### Playbook

Командный сценарий, который связывает rules, skills, task brief и verification для конкретного workflow.

Пример: "Добавление новой миссии в Project Z".

Playbook может подключать несколько skills:

- content source check;
- mission config update;
- answer-key leakage check;
- browser QA;
- retry principle update.

## Новые миссии

### 5.1 Rule or noise

**Цель:** отличить полезные правила от контекстного шума.

Игрок видит набор кандидатов для `AGENTS.md` / scoped rules:

- правила проекта;
- личные предпочтения;
- устаревшие команды;
- чувствительные данные;
- слишком общие лозунги;
- конкретные проверяемые запреты.

Нужно выбрать, что попадёт в always-on ядро, что в scoped section, а что убрать.

Проверяемый навык:

- не превращать всё знание в постоянный контекст.

Типовые ловушки:

- context dump;
- stale rule;
- personal magic;
- sensitive data.

### 5.2 Scope the rule

**Цель:** разложить правила по слоям.

Игрок получает rules и должен положить их в правильные слои:

- root always-on;
- frontend/UI;
- backend/API;
- tests/QA;
- content authoring;
- task brief only;
- not a rule.

Проверяемый навык:

- выбирать правильную область действия правила.

Типовые ловушки:

- слишком широкое правило;
- противоречивые инструкции;
- tool-specific overfitting.

### 5.3 Skill candidate

**Цель:** отличить reusable skill от разового успешного промпта.

Игрок видит несколько кейсов:

- один удачный багфикс;
- повторяемая browser QA процедура;
- доменное правило, требующее человека-источника;
- личный промпт без проверки;
- workflow, который повторился 3 раза и имеет стабильные входы.

Нужно выбрать кандидата в skill.

Проверяемый навык:

- не путать личную заметку, prompt skeleton и reusable skill.

Типовые ловушки:

- prompt instead of skill;
- one-off case;
- weak verification.

### 5.4 Skill anatomy

**Цель:** собрать skill draft из правильных компонентов.

Игрок должен упорядочить части skill:

1. when to use;
2. when not to use;
3. required inputs;
4. steps;
5. forbidden moves;
6. verification;
7. stop conditions;
8. update trigger.

Проверяемый навык:

- skill должен быть процедурой, которую другой разработчик может повторить и проверить.

Типовые ловушки:

- нет входов;
- нет проверки;
- нет stop condition;
- слишком универсальный skill.

## Финальный бой главы

### Boss: Instruction Drift

Сюжетная метафора: агент получает слишком много правил, часть из них устарела, часть конфликтует, часть является личными предпочтениями, а один полезный workflow лежит в чате и не оформлен как skill.

Раунды:

1. **Rule scanner**
   Найти шум, чувствительные данные и устаревшие instructions.

2. **Layering gate**
   Разложить правила по always-on, scoped, task-only и remove.

3. **Skill forge**
   Собрать reusable skill из удачного повторяемого workflow.

4. **Release gate**
   Решить, что выпускать как пилот, что оставить в task brief, что требует владельца, а что удалить.

Финальный takeaway:

> Хорошая система rules/skills не увеличивает власть агента. Она уменьшает угадывание, ограничивает риск и делает удачные практики повторяемыми.

## Новые artifacts

MLP-решение: глава выдаёт два отдельных рабочих файла, а не один смешанный worksheet:

- `rules-inventory.md` -- список always-on/scoped rules, правил к удалению, unsafe examples, владельцев и update triggers;
- `skill-draft.md` -- tool-agnostic черновик reusable skill с условиями применения, входами, шагами, проверкой и stop conditions.

### Rules Inventory

Базовая структура `rules-inventory.md`:

```md
# Rules Inventory

## Always-on rules

- [Rule]
- Source / owner:
- Why always-on:
- How to verify:

## Scoped rules

| Scope | Rule | Source / owner | When loaded |
| --- | --- | --- | --- |
| Frontend |  |  |  |
| Backend |  |  |  |
| Tests / QA |  |  |  |
| Content |  |  |  |

## Rules to delete

| Rule / note | Why delete or replace | Owner |
| --- | --- | --- |
|  |  |  |

## Unsafe examples that must not become context

| Example type | Safe replacement |
| --- | --- |
|  |  |
```

### Skill Draft

Базовая структура `skill-draft.md`:

```md
# Skill Draft

## Skill name

## When to use

## When not to use

## Required inputs

## Steps

## Forbidden moves

## Verification

## Stop conditions

## Known bad cases

## Update trigger
```

Skill candidates can still be discussed during the chapter, but the downloadable artifact is the actual draft, not a candidate table hidden inside a combined inventory.

## Как обновить существующие главы

### Chapter 4: Контекст проекта

Добавить framing:

- `AGENTS.md` это не хранилище всех правил;
- always-on ядро должно быть коротким;
- scoped rules подключаются по зоне;
- examples и glossary не являются rules;
- sensitive boundaries должны быть rules, но без реальных чувствительных данных.

Миссию `agents-md-core` можно слегка усилить: игрок выбирает не только содержимое `AGENTS.md`, но и аргументирует, почему это always-on.

### Visible Chapter 6 / `chapter-6`: Гигиена контекста

После добавления новой главы текущая Chapter 5 станет Chapter 6.

Добавить связь:

- перед агентской сессией выбрать не только файлы и примеры, но и нужные rules/skills;
- не грузить все skills в одну задачу;
- после долгой сессии решить, появился ли новый skill candidate или bad case.

### Visible Chapter 8 / `chapter-8`: Рабочие сценарии

После добавления новой главы текущая Chapter 7 станет Chapter 8.

Усилить playbook:

- playbook должен явно перечислять, какие rules и skills он подключает;
- playbook не должен дублировать все rules внутри себя;
- playbook должен иметь owner, pilot period и update trigger;
- после 2-3 применений skill/playbook обновляется или удаляется.

## Изменения в Source Map

Добавить новый source module:

```text
modules/08-rules-and-skills.md
templates/rules-inventory.md
templates/skill-draft.md
```

Если новая глава вставляется как Chapter 5, source map Project Z должен стать:

| Project Z content | Education sources |
| --- | --- |
| Chapter 1: ИИ как инженерный инструмент | `modules/01-ai-as-engineering-tool.md`, `templates/ai-pr-self-review.md` |
| Chapter 2: Постановка задачи | `modules/02-task-framing.md`, `templates/task-brief.md` |
| Chapter 3: Работа от плана | `modules/04-plan-first-agentic-workflow.md`, `templates/task-brief.md` |
| Chapter 4: Контекст проекта | `modules/03-context-engineering.md`, `templates/repo-context-inventory.md`, `templates/agents-md-v0.md` |
| Chapter 5: Rules & Skills | `modules/08-rules-and-skills.md`, `templates/rules-inventory.md`, `templates/skill-draft.md` |
| Chapter 6: Гигиена контекста | `modules/05-token-hygiene.md`, `templates/token-hygiene-checklist.md` |
| Chapter 7: Дисциплина проверки | `modules/06-verification-discipline.md`, `templates/verification-matrix.md`, `templates/ai-pr-self-review.md` |
| Chapter 8: Рабочие сценарии | `modules/07-playbooks.md`, `templates/playbook-template.md`, `templates/clinic-case-capture.md` |

Номер `08-rules-and-skills.md` выбран, чтобы не переименовывать существующие source modules. Внутри Project Z глава может быть Chapter 5.

## Что нужно будет поменять в проекте при реализации

Минимальный implementation scope:

- добавить новый chapter config в `src/entities/chapter/model/chapters`;
- подключить его в `chapterCatalog.ts`;
- добавить artifact templates для `Rules Inventory` и `Skill Draft`;
- обновить `docs/product/README.md` и `retry-principle-content-matrix.md`;
- добавить content test coverage для новой главы;
- проверить navigation/map/badge flow после увеличения количества глав.

Расширенный scope:

- обновить текущие главы 4, 5 и 7 для связки терминов;
- добавить новые trap concepts: `stale-rule`, `conflicting-instructions`, `prompt-instead-of-skill`, `unsafe-always-on-context`;
- добавить финального босса новой главы;
- пересмотреть course closeout, чтобы итоговый артефакт курса включал rules/skills inventory.

## Questions for plan refinement

### Product framing

1. Насколько явно нужно говорить, что rules/skills -- это способ снизить зависимость от личной магии сильного пользователя?
2. Нужно ли в этой главе затрагивать governance: владелец правила, дата обновления, удаление устаревших правил?

### Terminology

3. Какой русский подзаголовок лучше для главы: "управление агентом", "правила и навыки агента", "инструкции, которые работают", другой вариант?
4. Нужно ли заменить `Rule` на более широкое `Instruction`, или `rule` лучше потому что подчёркивает ограничение и проверяемость?

### Tool specificity

5. Нужно ли вообще показывать реальные форматы вроде `AGENTS.md`, Cursor rules, Claude/Codex instructions как иллюстрации, или оставить только общие носители знания?
6. Есть ли риск, что даже иллюстративные tool-specific детали быстро устареют?

### Chapter mechanics

7. Достаточно ли 4 обычных миссий + boss fight, или глава требует 5 миссий?
8. Какая миссия должна быть центральной: классификация rules, сборка skill, конфликт инструкций или rollout?
9. Нужна ли отдельная миссия про конфликтующие инструкции, где агент получает несовместимые rules?
10. Нужна ли отдельная миссия про устаревшее правило, которое когда-то было полезным, но теперь ломает работу?
11. Должен ли boss быть про "слишком много правил" или про "удачный workflow не оформлен в skill"?

### Artifact

12. Должны ли `Rules Inventory` и `Skill Draft` быть ближе к реальным рабочим документам или учебным шаблонам для размышления?
13. Нужно ли в `Rules Inventory` включить секцию "rules to delete"?
14. Нужно ли включить "owner / update trigger" как обязательное поле или оставить это для playbooks?
15. Должны ли оба artifact новой главы попадать в финальный course closeout?

### Examples and domain fit

16. Какие реальные примеры Project Z лучше использовать как material: browser QA, mission content update, backend API parity, retry principle update?
17. Нужно ли сделать один сквозной пример skill по ходу главы, который постепенно собирается миссиями?
18. Можно ли использовать реальные Project Z rules как учебный материал, или лучше синтетические примеры, чтобы не смешивать курс и его реализацию?
19. Должны ли примеры быть больше про frontend/gameplay, backend/API или content authoring?

### Scope and implementation

20. При реализации сразу перенумеровываем видимые главы в UI на 8 глав или можно технически добавить новую главу без сильного переписывания старого текста?
21. Нужно ли одновременно обновлять текущие Chapter 4, 5 и 7, или сначала добавить новую главу, а соседние главы поправить вторым этапом?
22. Какие trap concepts обязательны для MLP, а какие можно оставить на polish?
23. Какие примеры Project Z берём после ревизии источников?

## Recommended decision

Решение: делать отдельную главу.

Причина: rules/skills это не частный случай context engineering и не просто playbook. Это отдельная зрелость работы с агентами: команда перестаёт надеяться на удачный промпт и начинает управлять постоянными инструкциями, scoped процедурами, проверками и обновлениями.

Самая сильная учебная связка:

```text
Context gives the agent a map.
Rules define the boundaries.
Skills define repeatable moves.
Playbooks combine them into team workflows.
Verification proves the result.
```
