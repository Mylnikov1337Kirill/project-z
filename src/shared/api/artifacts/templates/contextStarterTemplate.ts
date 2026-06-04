export function createContextStarterMarkdown() {
  return `# AGENTS.md и стартовый контекст репозитория

Этот стартовый файл помогает собрать минимальный полезный контекст для первого AI-assisted пилота в репозитории. Заполняйте только то, что реально помогает агенту работать безопасно и предсказуемо.

## AGENTS.md v0

# AGENTS.md

## Обзор проекта

TODO: 1-2 абзаца: что делает проект, кому он нужен, где основные зоны кода.

## Stack

- Runtime / language: TODO
- Frameworks: TODO
- Test frameworks: TODO
- Package manager: TODO
- CI: TODO

## Карта репозитория

- \`path/\` -- TODO: что лежит в этой зоне.
- \`path/\` -- TODO: что лежит в этой зоне.
- \`path/\` -- TODO: что лежит в этой зоне.

## Commands

\`\`\`bash
# install
TODO

# build
TODO

# lint
TODO

# unit tests
TODO

# e2e tests
TODO
\`\`\`

Если команда требует специфичного окружения, напишите это явно.

## Правила кода

- TODO: правило, которое агент должен соблюдать в каждом наборе изменений.
- TODO: где нельзя импровизировать.
- TODO: как держать изменения маленькими.

## Правила проверки

- TODO: какие проверки запускать для обычного изменения.
- TODO: какие проверки нужны для рискованной зоны.
- TODO: как описывать непроверенный результат.

## Правила работы с ИИ

- Начинай с плана до правок для рефакторинга, бизнес-логики, миграций и изменений в нескольких файлах.
- Держи изменения маленькими и пригодными для ревью.
- Не меняй несвязанные файлы.
- Повторяй существующие паттерны вместо новых абстракций без причины.
- Запускай релевантные проверки перед итогом.
- Если ИИ существенно помог с рабочим или тестовым кодом и ты делаешь commit, добавь:

\`\`\`text
AI-assisted: true
\`\`\`

## Чувствительные данные

Нельзя вставлять во внешние модели:

- secrets, tokens, keys, \`.env\` files;
- production dumps;
- raw logs with PII;
- customer personal data;
- payment/financial data;
- internal incidents or contracts unless explicitly approved.

Используйте очищенные примеры. Если очистка убирает смысл, попросите внутренний или доменно-безопасный сценарий работы.

## Типовые ловушки

- TODO: known pitfall #1.
- TODO: known pitfall #2.
- TODO: known pitfall #3.

## Хорошие примеры

- \`path/to/example\` -- TODO: why this is a good example.
- \`path/to/example\` -- TODO: why this is a good example.

## Доменный словарь

- TODO term -- TODO meaning.
- TODO term -- TODO meaning.

## Инвентаризация контекста репозитория

\`\`\`yaml
project:
  name: TODO
  team: TODO
  stack:
    - TODO
  primary_contacts:
    - TODO

paths:
  frontend: TODO
  backend: TODO
  tests: TODO
  e2e: TODO
  docs: TODO
  config: TODO

commands:
  install: TODO
  build: TODO
  lint: TODO
  unit_test: TODO
  e2e_test: TODO
  format: TODO
  typecheck: TODO
\`\`\`

## Архитектура в 5-10 строк

\`\`\`text
TODO: что это за сервис/приложение, где основные модули, какие внешние зависимости важны.
\`\`\`

## Conventions

- TODO: обязательное правило #1.
- TODO: обязательное правило #2.
- TODO: обязательное правило #3.

## Хорошие примеры

- TODO: 1-3 файла или PR, которые агенту стоит повторять по стилю.

## Типовые ловушки

- TODO: где агент может ошибиться в архитектуре.
- TODO: где нельзя делать соседний рефакторинг.
- TODO: какие команды или окружение часто забывают.

## Границы чувствительных данных

Нельзя отправлять в модель:

- секреты / токены / \`.env\`;
- production dumps;
- PII и клиентские данные;
- сырые логи без обфускации;
- TODO: доменные sensitive categories команды.

## Первые пилотные сценарии

- [ ] Playwright/e2e test
- [ ] Unit test
- [ ] Self-review before PR
- [ ] Серверные заготовки
- [ ] Bug + sanitized logs
- [ ] Onboarding / code understanding
- [ ] Other: TODO

## Чего не хватает в контексте

- [ ] Нет актуальных test commands.
- [ ] Нет хороших примеров.
- [ ] Нет glossary.
- [ ] Неясны security boundaries.
- [ ] Нужен контакт доменщика.
- [ ] Другое: TODO

## Что адаптировать под проект

- TODO: реальные пути и команды.
- TODO: 1-3 живых примера.
- TODO: доменный словарь.
- TODO: политика команды по чувствительным данным.
- TODO: ритм ревью: кто обновляет контекст после крупных изменений.
`
}
