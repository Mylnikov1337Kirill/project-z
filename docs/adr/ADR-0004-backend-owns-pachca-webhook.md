# ADR-0004: Backend владеет Pachca webhook

Дата: 2026-05-27

## Статус

Принято

## Решение

Frontend никогда не хранит и не вызывает Pachca webhook напрямую. Интеграцией с Pachca владеет backend или serverless function.

## Контекст

Webhook URL и секреты не должны попадать в браузерный код. Интеграции также нужны повторы и логирование статуса, а это server-side ответственность.

## Последствия

- Первый срез показывает только mock preview объявления.
- Реальная отправка в Pachca требует backend env vars.
- Webhook secret не попадает во frontend assets.
