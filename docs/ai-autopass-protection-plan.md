# План защиты курса от AI-автопрохождения

## Цель

Сделать так, чтобы агент не мог просто открыть страницу, прочитать ответы из frontend bundle/DOM и пройти курс за пользователя.

Полностью запретить автоматизацию невозможно, поэтому цель решения:

- убрать легкий обход через чтение клиентского кода;
- ограничить брутфорс и массовые попытки;
- собирать сигналы подозрительного прохождения;
- не пускать подозрительные результаты в доверенный leaderboard без проверки.

## P0: закрыть прямой обход

### 1. Вынести answer keys из frontend

- Разделить контент миссий на public view и private answer key.
- В клиентский bundle не должны попадать `isCorrect`, `correctOrder`, `acceptedFragmentIds`, passing answer maps и аналогичные поля.
- Backend получает полный server-only config и сам оценивает ответы.
- Клиент видит только текст, варианты, labels, ids и UI-метаданные.

### 2. Усилить backend submit gate

- В `POST /api/missions/:missionId/attempts` проверять не только ответ, но и право на попытку.
- Условия допуска: learner identified, session active, chapter открыт, mission принадлежит chapter.
- Boss должен быть доступен только после завершения обязательных миссий главы.
- Закрытие главы запрещено, если предыдущие mission completions отсутствуют.
- Повторное прохождение completed chapter не должно менять leaderboard/badge state.

### 3. Добавить rate limiting

- Лимитировать попытки по `pilotSessionId`, IP и mission id.
- Базовая политика: 5-10 attempts/minute на миссию, cooldown после серии ошибок.
- Отдельно лимитировать создание pilot sessions.
- При превышении возвращать `429` с понятным retry message.
- Хранить события в БД или в managed layer вроде Netlify/edge/KV, если он доступен.

## P1: снизить ценность автоматизации

### 4. Ввести server-side mission lifecycle

- Добавить `mission_started_at`, `submitted_at`, `interaction_count`, `answer_changed_count`.
- Начало миссии фиксировать отдельным endpoint или лениво при первом submit/read.
- Не блокировать только по времени, но помечать невозможные паттерны: весь курс за минуты, идеальные ответы без пауз, burst submits.

### 5. Сделать suspicious flag

- Добавить флаг/таблицу `suspicious_events` или поля в attempts/session summary.
- Leaderboard может скрывать или понижать записи с высоким fraud score до ручной проверки.
- В UI не раскрывать пользователю детали fraud score, чтобы не обучать обходу.

### 6. Добавить adaptive challenge

- Подключить Turnstile/CAPTCHA не везде, а только при риске: много попыток, новая сессия с быстрым прогрессом, финальный badge/leaderboard write.
- Challenge token проверять на backend перед записью badge/leaderboard-significant completion.

## P2: усложнить массовый скриптинг

### 7. Персонализировать варианты миссий

- Backend выдает `variantSeed` на session/mission.
- Порядок вариантов перемешивается server-side.
- Для части миссий подготовить несколько равноценных answer-key вариантов.
- Submit проверяет ответ против конкретного variant seed.

### 8. Добавить финальную human check опционально

- Для high-stakes режима добавить финальную короткую рефлексию, peer review или ручную проверку suspicious completions.
- Для обычного игрового режима оставить мягкую защиту, чтобы не ухудшать UX.

## Тест-план

- Unit: server evaluation не зависит от клиентских `isCorrect`/`score`.
- API: нельзя отправить boss до завершения обязательных миссий.
- API: нельзя пройти locked chapter.
- API: duplicate `clientAttemptId` возвращает idempotent result, но не создает новый progress.
- API: rate limit возвращает `429` после превышения.
- Security regression: frontend bundle не содержит answer-key полей.
- E2E: нормальный пользователь проходит курс без CAPTCHA до risk threshold.
- E2E: burst automation получает cooldown/challenge и не попадает в trusted leaderboard.

## Приоритет реализации

Сначала делать P0:

1. server-only answer keys;
2. backend gates;
3. rate limit.

Это закрывает самый дешевый обход. Потом добавлять telemetry и suspicious leaderboard policy.

CAPTCHA и варианты миссий лучше вводить после этого, иначе они будут компенсировать архитектурную дыру, а не решать ее.
