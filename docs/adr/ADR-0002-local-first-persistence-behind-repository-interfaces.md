# ADR-0002: Локальное сохранение прогресса за repository-интерфейсами

Дата: 2026-05-27

## Статус

Superseded 2026-06-02 by ADR-0006 and `docs/backend-only-cutover-subtasks-2026-06-02.md`.

This ADR is historical context for the first playable slice. It must not be used
as active guidance to preserve or recreate local mode.

## Решение

Первый срез использовал localStorage для браузерного сохранения прогресса. Доступ к сохранению шёл только через repository-интерфейсы, чтобы backend-реализацию можно было добавить позже.

## Контекст

На момент ADR важнее было быстро получить игровой костяк и ощущение игры. Backend нужно было держать в архитектурном плане, но он не должен был блокировать визуальные итерации и работу над интеракциями.

## Последствия

- Leaderboard в первом срезе был локальный или fake.
- Миграция на Supabase потребовала backend-owned repository/service implementations.
- UI не пришлось переписывать при переносе сохранения прогресса на backend.
- Current active guidance: no supported local persistence mode; browser gameplay state writes must go through Node `/api/*`.
