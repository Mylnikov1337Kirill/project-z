# Agent Trail AI-ready prep pack

Этот пакет нужен, чтобы Agent Trail сам жил по правилам, которым учит: понятный repo context перед agentic diff, явные проверки и self-review перед передачей результата дальше.

Используй эти документы перед следующими AI-assisted изменениями в проекте:

1. Открой `repo-context-inventory.md`, чтобы быстро восстановить форму проекта, команды, ограничения и known pitfalls.
2. Перед backend/Supabase/Pachca или local-mode cleanup работой открой `../backend-only-cutover-subtasks-2026-06-02.md`, `integration-next-steps.md` и `../architecture-backend-migration-audit-2026-06-01.md`.
3. После diff заполни `verification-and-self-review.md`: там verification matrix, self-review и stop conditions.
4. Перед финальным ответом пройди `session-closeout.md` и обнови документы, если repo truth изменился.
5. Если работа меняет gameplay UI, дополнительно соблюдай правила из `../../AGENTS.md`.
6. Если работа меняет prep briefing, resource list, missions, quiz copy, ответы, feedback, artifact markdown или badge/mentor teaching copy, открой соответствующий education module/template из таблицы ниже.
7. Если работа меняет иконки табличек на карте, используй `map-landmark-icon-style.md` как контракт стиля и критерии приёмки.
8. Если работа меняет retry hints после ошибки, обнови `retry-principle-content-matrix.md` и проверь, что подсказки не раскрывают скрытые правильные ответы или точный порядок.
9. Если работа касается расширения курса новой главой Rules & Skills, используй `rules-and-skills-mlp-plan.md` и `rules-and-skills-mlp-subtasks.md` как базовый handoff.

## Что входит

- `repo-context-inventory.md` -- адаптированный repo context inventory для Agent Trail.
- `../backend-only-cutover-subtasks-2026-06-02.md` -- активная разбивка/status BOC-00..BOC-12 для backend-only cutover.
- `integration-next-steps.md` -- Phase 9 checklist для backend, Supabase и Pachca без реализации интеграций.
- `../architecture-backend-migration-audit-2026-06-01.md` -- исторический аудит pre-cutover frontend/local-first архитектуры и карта кандидатов на backend/DB.
- `verification-and-self-review.md` -- проверка результата и AI-assisted self-review.
- `session-closeout.md` -- обязательный чеклист обновления docs после каждой AI-assisted сессии.
- `map-landmark-icon-style.md` -- контракт стиля и критерии приёмки для внутренних пиктограмм табличек на карте мира.
- `retry-principle-content-matrix.md` -- Phase 35 inventory: источники, навыки, ловушки и authored non-leaking retry principles для всех mission-like сцен.
- `rules-and-skills-content-expansion.md` -- исходное продуктово-контентное предложение по теме rules/skills.
- `rules-and-skills-mlp-plan.md` -- базовый MLP-план обязательной главы Rules & Skills.
- `rules-and-skills-mlp-subtasks.md` -- нарезка MLP на автономные сабтаски для handoff в другие чаты.

## Источники

Пакет адаптирован из education kit:

- `/Users/kirillmylnikov/Dev/Obsidian/main/AI/Reports/agentic-tools-awareness/education/README.md`
- `/Users/kirillmylnikov/Dev/Obsidian/main/AI/Reports/agentic-tools-awareness/education/templates/task-brief.md`
- `/Users/kirillmylnikov/Dev/Obsidian/main/AI/Reports/agentic-tools-awareness/education/templates/repo-context-inventory.md`
- `/Users/kirillmylnikov/Dev/Obsidian/main/AI/Reports/agentic-tools-awareness/education/templates/verification-matrix.md`
- `/Users/kirillmylnikov/Dev/Obsidian/main/AI/Reports/agentic-tools-awareness/education/templates/ai-pr-self-review.md`
- `/Users/kirillmylnikov/Dev/Obsidian/main/AI/Reports/agentic-tools-awareness/education/templates/token-hygiene-checklist.md`

## Content Source Map

Use these files before changing teaching content for each chapter:

| Agent Trail content | Education sources |
| --- | --- |
| Chapter 1: ИИ как инженерный инструмент | `modules/01-ai-as-engineering-tool.md`, `templates/ai-pr-self-review.md` |
| Chapter 2: Постановка задачи | `modules/02-task-framing.md`, `templates/task-brief.md` |
| Chapter 3: Работа от плана | `modules/04-plan-first-agentic-workflow.md`, `templates/task-brief.md` |
| Chapter 4: Контекст проекта | `modules/03-context-engineering.md`, `templates/repo-context-inventory.md`, `templates/agents-md-v0.md` |
| Chapter 5: Rules & Skills | `modules/08-rules-and-skills.md`, `templates/rules-inventory.md`, `templates/skill-draft.md` |
| Chapter 6: Гигиена контекста | `modules/05-token-hygiene.md`, `templates/token-hygiene-checklist.md` |
| Chapter 7: Дисциплина проверки | `modules/06-verification-discipline.md`, `templates/verification-matrix.md`, `templates/ai-pr-self-review.md` |
| Chapter 8: Рабочие сценарии | `modules/07-playbooks.md`, `templates/playbook-template.md`, `templates/clinic-case-capture.md` |

Full education kit root:

```text
/Users/kirillmylnikov/Dev/Obsidian/main/AI/Reports/agentic-tools-awareness/education
```

## Границы

- Это не новая продуктовая фича и не gameplay content.
- Здесь нет backend, Supabase, Pachca integration или LLM calls.
- Документы нужно обновлять после каждой AI-assisted сессии, если изменились статус, команды, scope, проверки, риски или правила будущей работы.
