# ADR-0005: Контент как markdown и типизированные конфиги миссий

Дата: 2026-05-27

## Статус

Принято

## Решение

Образовательные объяснения живут в markdown. Интерактивные миссии описываются типизированными TypeScript или JSON конфигами.

Обновление от 2026-06-01: глава остаётся единицей authoring review. Публичный каталог экспортируется из `src/entities/chapter/model/chapterCatalog.ts`, но содержимое разнесено по модулям `src/entities/chapter/model/chapters/chapter*.ts`; общие authored feedback/retry patches вынесены в `src/entities/chapter/model/missionFeedback.ts`.

Markdown-артефакты текущего продукта остаются client-generated downloads через `ArtifactService`, `artifactTemplateRegistry` и шаблоны в `src/shared/api/artifacts/templates`. Перенос артефактов в backend-generated downloads не входит в текущий backend-срез и требует отдельного ADR.

## Контекст

Markdown легко редактировать и ревьюить. Интерактивным миссиям нужны детерминированный scoring, типизированные варианты ответов и схемы, которые удобно валидировать.

## Последствия

- Приложению нужна небольшая схема миссий.
- Контент проверяется командой `npm run validate:content`.
- Экраны должны рендерить контент из repositories, а не зашивать логику миссий внутрь UI.
