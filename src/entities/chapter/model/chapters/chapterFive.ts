import type { Chapter, Mission } from '../../../../shared/types/domain'
import { applyMissionFeedback, applyMissionFeedbackList } from '../missionFeedback'

const carrierTargets = [
  {
    id: 'always-on-rule',
    label: 'Always-on rule',
    description: 'Короткое правило, которое почти всегда снижает риск.',
  },
  {
    id: 'scoped-rule',
    label: 'Scoped rule',
    description: 'Правило для конкретной зоны, типа задачи или workflow.',
  },
  {
    id: 'skill',
    label: 'Skill',
    description: 'Повторяемая процедура с входами, шагами и проверкой.',
  },
  {
    id: 'playbook',
    label: 'Playbook',
    description: 'Командный workflow, который связывает brief, rules, skills и проверку.',
  },
  {
    id: 'task-brief',
    label: 'Task brief',
    description: 'Контекст и критерии для одной текущей задачи.',
  },
  {
    id: 'discard',
    label: 'Discard',
    description: 'Шум, личная магия или знание без безопасного повторения.',
  },
]

const skillAnatomyChips = [
  {
    id: 'when-to-use',
    label: 'When to use: класс задач, где процедура реально помогает',
    isCorrect: true,
  },
  {
    id: 'when-not-to-use',
    label: 'When not to use: риски, исключения и слишком широкие случаи',
    isCorrect: true,
  },
  {
    id: 'required-inputs',
    label: 'Required inputs: бриф, маршрут, ожидаемое поведение и безопасные данные',
    isCorrect: true,
  },
  {
    id: 'workflow-steps',
    label: 'Workflow steps: что сделать по порядку, без привязки к одному инструменту',
    isCorrect: true,
  },
  {
    id: 'forbidden-moves',
    label: 'Forbidden moves: куда агент не должен расширять работу',
    isCorrect: true,
  },
  {
    id: 'verification',
    label: 'Verification: чем доказать результат и что записать как evidence',
    isCorrect: true,
  },
  {
    id: 'stop-conditions',
    label: 'Stop conditions: когда прекратить цикл и вернуть решение человеку',
    isCorrect: true,
  },
  {
    id: 'update-trigger',
    label: 'Update trigger / known bad cases: когда пересмотреть процедуру',
    isCorrect: true,
  },
]

const skillAnatomyOrder = [
  'when-to-use',
  'when-not-to-use',
  'required-inputs',
  'workflow-steps',
  'forbidden-moves',
  'verification',
  'stop-conditions',
  'update-trigger',
]

const chapterFiveMissions: Mission[] = [
  {
    id: 'knowledge-carrier-match',
    kind: 'pair-matching',
    title: 'Куда положить знание',
    prompt:
      'Команда чистит память агента перед новой главой курса. Соедини каждый фрагмент знания с носителем, который сохранит пользу и не превратит контекст в свалку.',
    mentorHint:
      'Сначала спроси: это постоянная граница, правило для зоны, повторяемая процедура, командный workflow, контекст одной задачи или шум?',
    successFeedback:
      'Маршрутизатор инструкций настроен. Правила, skills, playbook, task brief и шум разошлись по разным носителям.',
    failureFeedback:
      'Пары пока смешивают срок жизни и область действия. Не каждое знание должно становиться rule, и не каждый удачный prompt является skill.',
    retryPrinciple:
      'Для каждой пары проверь срок жизни знания: всегда, только в зоне, повторяемая процедура, workflow, одна задача или удалить.',
    takeaway:
      'Управление агентом начинается с выбора носителя знания: rule, skill, playbook, task brief или discard.',
    targets: carrierTargets,
    items: [
      {
        id: 'pii-boundary',
        label: 'Секреты, персональные данные и сырые логи нельзя давать модели',
        description:
          'Граница безопасности нужна почти в каждой задаче и не зависит от конкретного workflow.',
        acceptedTargetIds: ['always-on-rule'],
        feedback:
          'Граница данных должна быть видна постоянно. Если спрятать её в бриф или workflow, агент может увидеть небезопасный контекст раньше правила.',
        trapId: 'unsafe-always-on-context',
      },
      {
        id: 'content-feedback-rule',
        label:
          'Failed-answer feedback в учебной миссии не раскрывает скрытую правильную карту',
        description:
          'Правило важно именно для content-authoring задач и проверок игровых ответов.',
        acceptedTargetIds: ['scoped-rule'],
        feedback:
          'Это полезное правило, но его область -- авторинг учебного контента. Always-on ядро не должно грузить все специализированные правила сразу.',
        trapId: 'context-dump',
      },
      {
        id: 'browser-qa-procedure',
        label:
          'Проверить gameplay UI после изменения миссии: happy path, failed path, layout и evidence',
        description:
          'Процедура повторяется, имеет входы, шаги, запреты, проверку и стоп-условия.',
        acceptedTargetIds: ['skill'],
        feedback:
          'Повторяемая browser QA процедура -- это не одно правило и не один prompt. Ей нужны входы, шаги и проверка.',
        trapId: 'prompt-instead-of-skill',
      },
      {
        id: 'mission-end-to-end',
        label:
          'Добавить новую миссию end to end: source review, config, feedback, validation, QA и artifact',
        description:
          'Большой командный workflow может подключать несколько правил и skills.',
        acceptedTargetIds: ['playbook'],
        feedback:
          'Такой workflow шире одного skill. В этой главе playbook только маршрутизирует знания; детальная анатомия остаётся финальной теме.',
        trapId: 'too-broad',
      },
      {
        id: 'one-bug-acceptance',
        label: 'Acceptance criterion для одной правки копии в конкретной миссии',
        description:
          'Критерий нужен текущей задаче, но не обязан жить в постоянной памяти агента.',
        acceptedTargetIds: ['task-brief'],
        feedback:
          'Критерий приёмки одной задачи не становится долговечной rule. Он должен быть в brief рядом с текущим результатом.',
        trapLabel: 'Task context вместо rule',
      },
      {
        id: 'lucky-prompt',
        label: 'Один автор однажды написал удачный prompt для драматичной обратной связи',
        description:
          'Фраза сработала один раз, но нет входов, проверки, владельца и повторяемого класса задач.',
        acceptedTargetIds: ['discard'],
        feedback:
          'Удачная формулировка без процедуры и проверки -- личная магия. Её можно изучить, но не превращать в rule или skill.',
        trapId: 'personal-magic',
      },
    ],
  },
  {
    id: 'rule-scope-gate',
    kind: 'chip-picker',
    title: 'Отобрать rules',
    prompt:
      'Перед пилотом команда пересматривает кандидатов в долговечные rules. Выбери только те, которые стоит хранить как поддерживаемые always-on или scoped rules.',
    mentorHint:
      'Хорошая rule короткая, безопасная, проверяемая и живёт в понятной области. Старые команды, реальные данные и лозунги не проходят шлюз.',
    successFeedback:
      'Rules отобраны чисто. В системе остались безопасные границы и scoped соглашения, а шум не стал постоянной памятью агента.',
    failureFeedback:
      'Шлюз правил пока пропустил шум или выкинул нужную границу. Проверь безопасность, актуальность, область действия и проверяемость.',
    retryPrinciple:
      'Оставляй только правила, которые помогают повторяемо: короткие, актуальные, безопасные, проверяемые и со scope.',
    takeaway:
      'Rule должна снижать угадывание, а не превращать память агента в архив старых заметок.',
    chips: [
      {
        id: 'no-real-data',
        label:
          'Always-on: не использовать секреты, реальные логи, PII и клиентские примеры как контекст модели',
        isCorrect: true,
        feedback:
          'Граница данных нужна почти всегда и должна быть короткой, явной и безопасной.',
      },
      {
        id: 'scoped-ui-icons',
        label:
          'Scoped UI rule: кнопки инструментов используют понятные иконки, текст -- только для явных команд',
        isCorrect: true,
        feedback:
          'Это правило полезно в UI-задачах, но не должно грузиться в каждую backend или content сессию.',
      },
      {
        id: 'content-feedback-nonleak',
        label:
          'Scoped content rule: failed feedback не раскрывает unselected correct answers и exact ordering',
        isCorrect: true,
        feedback:
          'Область действия ясна: авторинг и проверка учебных миссий.',
      },
      {
        id: 'owner-source',
        label:
          'Durable rule hygiene: у правила есть источник или владелец, который обновляет его при изменении процесса',
        isCorrect: true,
        feedback:
          'Владелец и источник помогают не оставить в памяти агента устаревшую инструкцию.',
      },
      {
        id: 'old-command',
        label:
          'Старая команда проверки, которая больше не запускается, но “может пригодиться агенту”',
        isCorrect: false,
        feedback:
          'Устаревшая команда ведёт агента по старому пути. Её надо удалить или заменить текущей командой.',
        trapId: 'stale-rule',
      },
      {
        id: 'write-good-code',
        label: 'Всегда писать хороший, чистый, понятный и современный код',
        isCorrect: false,
        feedback:
          'Лозунг не даёт проверяемого ограничения. Rule должна говорить, что именно делать или не делать.',
        trapId: 'too-broad',
      },
      {
        id: 'real-log-example',
        label:
          'Реальный фрагмент лога с пользователем, чтобы агент видел “живой формат” ошибки',
        isCorrect: false,
        feedback:
          'Формат показывают синтетикой. Реальные логи и персональные данные не становятся rule или примером.',
        trapId: 'sensitive-data',
      },
      {
        id: 'one-off-debug-note',
        label:
          'Разовая заметка из вчерашнего debug: “в этом компоненте агент обычно путается”',
        isCorrect: false,
        feedback:
          'Разовая заметка может попасть в текущий brief или issue, но не в долговечный набор rules без повторяемого сигнала.',
        trapLabel: 'Разовая заметка',
      },
      {
        id: 'paste-all-skills',
        label: 'Всегда загружать все rules и skills перед любой задачей',
        isCorrect: false,
        feedback:
          'Так skill превращается в контекстную свалку. В сессию подключают только релевантные правила и процедуры.',
        trapId: 'context-dump',
      },
    ],
  },
  {
    id: 'skill-draft-order',
    kind: 'chip-ordering',
    title: 'Собрать skill',
    prompt:
      'Команда хочет оформить skill “проверить gameplay UI после изменения миссии”. Собери секции так, чтобы другой разработчик мог повторить процедуру и проверить результат.',
    mentorHint:
      'Skill начинается с границ применения, затем требует входы, рабочие шаги, запреты, проверку и условия остановки.',
    successFeedback:
      'Skill собран как повторяемая процедура: видно когда применять, чем кормить, как действовать, чем проверять и когда остановиться.',
    failureFeedback:
      'Порядок пока похож на заметку из чата. Сначала определи область применения и входы, затем шаги, запреты, проверку и обновление.',
    retryPrinciple:
      'Собирай skill не как prompt, а как процедуру: use / not use, inputs, steps, forbidden moves, verification, stop, update.',
    takeaway:
      'Skill должен быть повторяемым рабочим ходом, а не красивой формулировкой запроса.',
    chips: skillAnatomyChips,
    correctOrder: skillAnatomyOrder,
    orderFeedback: {
      'when-to-use':
        'Сначала нужен класс задач, иначе процедура начнёт применяться слишком широко.',
      'when-not-to-use':
        'Исключения идут сразу после назначения: они защищают от неверного запуска.',
      'required-inputs':
        'Входы нужны до шагов, чтобы процедура не начиналась с догадок.',
      'workflow-steps':
        'Шаги имеют смысл только после входов и границ применения.',
      'forbidden-moves':
        'Запреты фиксируют, куда агент не должен расширять работу во время процедуры.',
      verification:
        'Проверка доказывает результат, а не просто завершает текст инструкции.',
      'stop-conditions':
        'Стоп-условия нужны до следующего повтора, чтобы не запускать слепой цикл.',
      'update-trigger':
        'Known bad cases и update trigger делают skill поддерживаемым, а не вечной заметкой.',
    },
  },
  {
    id: 'instruction-drift-fix',
    kind: 'chip-picker',
    title: 'Починить drift',
    prompt:
      'В системе инструкций накопился drift: есть текущая safety rule, старая команда, UI-rule стала always-on, browser QA лежит в чате, а критерий одной задачи хотят сохранить “на будущее”. Какие действия чинят систему?',
    mentorHint:
      'Drift лечится обслуживанием носителей: обновить или удалить старое, сузить scope, оформить повторяемую процедуру и оставить task-only контекст в brief.',
    successFeedback:
      'Drift остановлен. Система инструкций стала короче, безопаснее и понятнее: rule со scope, skill с процедурой, brief для текущей задачи.',
    failureFeedback:
      'Drift пока остался. Где-то устаревшее правило, слишком широкий scope или чатовая магия продолжает жить как постоянная инструкция.',
    retryPrinciple:
      'Для maintenance решения спроси: обновить, удалить, сузить scope, оформить skill или оставить в текущем brief.',
    takeaway:
      'Инструкции требуют обслуживания: stale rules удаляются, scoped rules сужаются, повторяемые workflow становятся skill draft.',
    chips: [
      {
        id: 'keep-safety-rule',
        label:
          'Оставить короткую safety rule про секреты, PII, реальные логи и сырые дампы',
        isCorrect: true,
        feedback:
          'Это актуальная always-on граница, которая снижает риск до запуска задачи.',
      },
      {
        id: 'remove-stale-command',
        label: 'Удалить или заменить старую команду, которая больше не запускается',
        isCorrect: true,
        feedback:
          'Устаревшую команду нельзя оставлять как память агента: она будет направлять работу по старому процессу.',
      },
      {
        id: 'scope-ui-rule',
        label:
          'Перенести UI-only convention из always-on ядра в scoped rule для frontend/gameplay задач',
        isCorrect: true,
        feedback:
          'Сужение scope сохраняет пользу правила и не грузит его в нерелевантные задачи.',
      },
      {
        id: 'draft-browser-skill',
        label:
          'Оформить повторяемую browser QA процедуру как skill draft с входами, шагами и проверкой',
        isCorrect: true,
        feedback:
          'Повторяемый workflow из чата становится полезным только после входов, шагов, запретов и verification.',
      },
      {
        id: 'brief-only-acceptance',
        label:
          'Оставить acceptance criterion одной copy-правки в task brief, не в долговечных instructions',
        isCorrect: true,
        feedback:
          'Контекст одной задачи должен закрыться вместе с задачей, если он не стал повторяемым правилом.',
      },
      {
        id: 'keep-old-command',
        label: 'Оставить старую команду как fallback: агент сам поймёт, что она устарела',
        isCorrect: false,
        feedback:
          'Агент не должен угадывать актуальность команд. Старую инструкцию надо удалить или заменить.',
        trapId: 'stale-rule',
      },
      {
        id: 'make-all-always-on',
        label:
          'Сложить safety, UI convention, browser QA и task acceptance в один always-on блок',
        isCorrect: false,
        feedback:
          'Так система снова станет свалкой. Always-on ядро держит только правила, нужные почти всегда.',
        trapId: 'context-dump',
      },
      {
        id: 'call-it-playbook',
        label:
          'Назвать browser QA чатом playbook и не расписывать отдельный skill: так звучит солиднее',
        isCorrect: false,
        feedback:
          'Название не заменяет структуру. Повторяемой QA процедуре сначала нужен skill draft, а playbook может подключить его позже.',
        trapId: 'prompt-instead-of-skill',
      },
      {
        id: 'paste-chat-log',
        label:
          'Сохранить весь чат с удачным QA запуском как пример для будущих задач',
        isCorrect: false,
        feedback:
          'Чат обычно несёт лишний контекст и может содержать данные задачи. Из него извлекают процедуру, а не хранят всё подряд.',
        trapId: 'context-dump',
      },
    ],
  },
]

const chapterFiveBoss: Mission = {
  id: 'instruction-drift',
  kind: 'boss-fight',
  title: 'Финальный бой за управление агентом',
  prompt:
    'Instruction Drift загрязнил память агента: слишком много правил, старые заметки, unsafe examples, повторяемый workflow в чате и давление назвать всё playbook. Пройди четыре шлюза управления.',
  mentorHint:
    'Финал проверяет не знание терминов, а обслуживание системы инструкций: carrier, scope, skill anatomy и безопасный release.',
  successFeedback:
    'Instruction Drift остановлен. Ты разложил знания по носителям, оставил только безопасные rules, собрал skill и выпустил его как управляемый пилот.',
  failureFeedback:
    'Drift пока сильнее. Где-то знание стало не тем носителем, правило потеряло scope, skill не получил процедуру или release превратился в вечный playbook без проверки.',
  retryPrinciple:
    'Финальный бой проходится слоями: carrier, rule scope, skill anatomy, затем безопасный pilot с владельцем и update trigger.',
  takeaway:
    'Управление агентом начинается не с большого prompt, а с решения, какое знание должно жить как rule, skill, task brief, playbook или быть удалено.',
  passingScore: 100,
  rounds: [
    {
      id: 'gate-carrier-match',
      kind: 'pair-matching',
      title: 'Раунд 1: маршрутизатор носителей',
      prompt:
        'Соедини фрагменты загрязнённой памяти с правильными носителями, не раскрывая агенту лишний постоянный контекст.',
      mentorHint:
        'Пары должны различать постоянную границу, scoped правило, skill, playbook, task brief и discard.',
      successFeedback:
        'Носители выбраны верно. Drift больше не может назвать каждое знание вечной инструкцией.',
      failureFeedback:
        'Маршрутизатор пока путает носители. Проверь срок жизни знания и повторяемость процедуры.',
      retryPrinciple:
        'Не угадывай по звучанию: carrier выбирается по сроку жизни, scope, повторяемости и проверяемости знания.',
      takeaway:
        'Правильный carrier защищает контекст: useful knowledge становится управляемым, а шум не попадает в память.',
      targets: carrierTargets,
      items: [
        {
          id: 'gate-no-secrets',
          label: 'Никогда не отправлять секреты, PII, реальные логи и сырые дампы',
          acceptedTargetIds: ['always-on-rule'],
          feedback:
            'Safety boundary должна жить до любой задачи. Если она станет task-only, агент может получить unsafe контекст раньше.',
          trapId: 'unsafe-always-on-context',
        },
        {
          id: 'gate-content-nonleak',
          label: 'В failed feedback не показывать hidden correct mapping',
          acceptedTargetIds: ['scoped-rule'],
          feedback:
            'Это scoped правило для авторинга учебного контента, а не универсальная инструкция для всех задач.',
          trapId: 'context-dump',
        },
        {
          id: 'gate-qa-skill',
          label: 'Gameplay UI QA: пройти happy path, failed path, layout и evidence',
          acceptedTargetIds: ['skill'],
          feedback:
            'Повторяемая QA процедура требует skill-структуры: inputs, steps, forbidden moves, verification и stop.',
          trapId: 'prompt-instead-of-skill',
        },
        {
          id: 'gate-new-mission-workflow',
          label: 'Добавление новой миссии от source review до browser QA и artifact copy',
          acceptedTargetIds: ['playbook'],
          feedback:
            'Это командный workflow, который может подключать rules и skills. В этой главе не нужно дублировать playbook anatomy.',
          trapId: 'too-broad',
        },
        {
          id: 'gate-copy-bug-brief',
          label: 'Критерий готовности для одной copy-правки в текущей миссии',
          acceptedTargetIds: ['task-brief'],
          feedback:
            'Одна acceptance строка живёт в текущем brief, пока не доказала повторяемость как правило.',
          trapLabel: 'Task context вместо rule',
        },
        {
          id: 'gate-lucky-line',
          label: 'Личная фраза “попроси агента быть строже”, которая сработала один раз',
          acceptedTargetIds: ['discard'],
          feedback:
            'Личная формулировка без входов, проверки и повторяемого класса задач не является skill.',
          trapId: 'personal-magic',
        },
      ],
    },
    {
      id: 'gate-rule-scope',
      kind: 'chip-picker',
      title: 'Раунд 2: scope правил',
      prompt:
        'Drift предлагает оставить всё в долговечных rules. Выбери только безопасные и полезные правила, которые проходят maintenance gate.',
      mentorHint:
        'Оставляй current safety boundary и scoped правила с ясной областью. Убирай stale, broad, unsafe и task-only кандидатов.',
      successFeedback:
        'Scope удержан. В rules остались безопасные ограничения и рабочие scoped соглашения.',
      failureFeedback:
        'Drift пропустил шум или unsafe memory. Проверь, что каждое выбранное правило актуально, безопасно и имеет область действия.',
      retryPrinciple:
        'Rule проходит gate, только если она короткая, актуальная, безопасная, проверяемая и имеет ясный scope.',
      takeaway:
        'Rules должны уменьшать неопределённость, а не загружать все знания проекта в каждую сессию.',
      chips: [
        {
          id: 'gate-safe-boundary',
          label:
            'Always-on: не отправлять в модель секреты, PII, рабочие дампы и сырые логи',
          isCorrect: true,
          feedback:
            'Эта граница должна сработать до выбора задачи и инструмента.',
        },
        {
          id: 'gate-content-scope',
          label:
            'Scoped content rule: failed feedback показывает только выбранную ошибку, без полной правильной карты',
          isCorrect: true,
          feedback:
            'Правило узкое и проверяемое: оно применяется к authoring/review учебных миссий.',
        },
        {
          id: 'gate-qa-scope',
          label:
            'Scoped QA rule: gameplay UI после изменения миссии проверяется на desktop и mobile viewport',
          isCorrect: true,
          feedback:
            'Это полезная scoped граница для gameplay UI задач.',
        },
        {
          id: 'gate-owner-source',
          label: 'Rule получает источник или владельца, если её нельзя проверить из кода',
          isCorrect: true,
          feedback:
            'Так правило можно обновить, когда меняется процесс или доменное решение.',
        },
        {
          id: 'gate-stale-command',
          label: 'Старая команда запуска тестов остаётся “на всякий случай”',
          isCorrect: false,
          feedback:
            'Старое правило не является fallback. Оно заставит агента тратить цикл на несуществующий путь.',
          trapId: 'stale-rule',
        },
        {
          id: 'gate-broad-slogan',
          label: 'Всегда делай максимально качественно и профессионально',
          isCorrect: false,
          feedback:
            'Лозунг не задаёт проверяемое поведение и не помогает агенту выбрать действие.',
          trapId: 'too-broad',
        },
        {
          id: 'gate-raw-log',
          label: 'Хранить реальный лог ошибки как always-on example',
          isCorrect: false,
          feedback:
            'Реальный лог может содержать sensitive data. Формат нужно заменить синтетическим примером.',
          trapId: 'sensitive-data',
        },
        {
          id: 'gate-load-all',
          label: 'Перед каждой задачей загружать все rules и all skills',
          isCorrect: false,
          feedback:
            'Это контекстная свалка под видом дисциплины. Сессию собирают из релевантных правил и процедур.',
          trapId: 'context-dump',
        },
        {
          id: 'gate-one-bug',
          label:
            'Заметку по одному copy-багу сохранить как постоянное правило для всех миссий',
          isCorrect: false,
          feedback:
            'Task-only контекст не становится rule без повторяемого сигнала и владельца.',
          trapLabel: 'Task-only memory',
        },
      ],
    },
    {
      id: 'gate-skill-anatomy',
      kind: 'chip-ordering',
      title: 'Раунд 3: анатомия skill',
      prompt:
        'Drift хочет сохранить удачный browser QA чат как “skill”. Собери настоящий skill draft по секциям, чтобы другой разработчик мог его повторить.',
      mentorHint:
        'Без when not to use, inputs, forbidden moves, verification и stop conditions skill превращается в длинный prompt.',
      successFeedback:
        'Skill draft держит процедуру. Теперь это повторяемый рабочий ход, а не память одного автора.',
      failureFeedback:
        'Анатомия пока распалась. Верни skill к порядку: область применения, входы, шаги, запреты, проверка, остановка и обновление.',
      retryPrinciple:
        'Skill не начинается с prompt skeleton. Сначала назначение и границы, потом inputs, steps, forbidden moves, verification, stop и update.',
      takeaway:
        'Повторяемость skill доказывается структурой: другой человек видит входы, шаги, доказательства и плохие кейсы.',
      chips: skillAnatomyChips,
      correctOrder: skillAnatomyOrder,
    },
    {
      id: 'gate-release-decision',
      kind: 'scenario-decision',
      title: 'Раунд 4: release decision',
      prompt:
        'Команда собрала rules inventory и skill draft для browser QA. Какой release path безопасно закрывает главу, не превращая всё в финальный playbook раньше времени?',
      mentorHint:
        'Нужен пилот, владелец, update trigger и ограниченное обновление соседнего контекста. Playbook остаётся следующим уровнем workflow.',
      successFeedback:
        'Release path безопасен. Skill выходит как пилот с владельцем и update trigger, rules обновлены точечно, playbook не дублирует урок финальной главы.',
      failureFeedback:
        'Release пока либо слишком широкий, либо бесхозный. Пилот должен быть ограниченным, проверяемым и обслуживаемым.',
      retryPrinciple:
        'Выпускай rules/skills как управляемый пилот: owner, update trigger, known bad cases и только релевантные соседние обновления.',
      takeaway:
        'Rules и skills живут после публикации только если у них есть владелец, проверка и причина обновления.',
      options: [
        {
          id: 'pilot-with-owner',
          label:
            'Выпустить skill как пилот: назначить владельца, update trigger и 2-3 проверочных применения; обновить только связанные scoped rules.',
          isCorrect: true,
          feedback:
            'Пилот даёт проверку в реальных задачах и не превращает новую процедуру в вечную инструкцию без владельца.',
        },
        {
          id: 'publish-all-always-on',
          label:
            'Опубликовать весь rules inventory и skill draft как always-on контекст для любой задачи.',
          isCorrect: false,
          failureFeedback:
            'Always-on не выдержит такой объём. Все rules и skills не должны грузиться в каждую сессию.',
          trapId: 'context-dump',
        },
        {
          id: 'make-final-playbook-now',
          label:
            'Сразу написать большой playbook, продублировать в нём все rules и считать workflow закрытым.',
          isCorrect: false,
          failureFeedback:
            'Playbook -- следующий уровень. Сейчас важно не дублировать правила, а проверить skill и его связи.',
          trapId: 'too-broad',
        },
        {
          id: 'leave-chat-memory',
          label:
            'Оставить всё в чате: если кому-то понадобится, он найдёт удачный пример и повторит.',
          isCorrect: false,
          failureFeedback:
            'Чат не является поддерживаемым носителем. Другой разработчик не увидит входы, проверки и known bad cases.',
          trapId: 'personal-magic',
        },
        {
          id: 'agent-decides-owner',
          label:
            'Попросить агента самому выбрать владельца и обновлять skill по своим будущим отчётам.',
          isCorrect: false,
          failureFeedback:
            'Владелец и обновление -- командное решение. Агент не является источником истины для lifecycle инструкции.',
          trapId: 'agent-as-source',
        },
      ],
    },
  ],
}

export const chapterFive: Chapter = {
  id: 'chapter-5',
  order: 5,
  title: 'Rules & Skills',
  badgeName: 'Куратор инструкций',
  rankAfterCompletion: 'Agent Controller',
  summary:
    'Управляй агентом через короткие rules, scoped rules и reusable skills вместо свалки prompt-магии.',
  visual: {
    landmarkId: 'instruction-router',
    label: 'Коммутатор инструкций',
    tone: 'violet',
  },
  reward: {
    emblem: 'RS',
    motif: 'Коммутатор инструкций',
    skill:
      'Классифицировать знания как rule, scoped rule, skill, playbook, task brief или discard.',
    motto: 'Не каждое знание должно жить в постоянной памяти агента.',
    masteryActions: [
      'Отбирать короткие, актуальные и безопасные rules.',
      'Описывать skill как повторяемую процедуру.',
      'Удалять stale, unsafe и task-only инструкции из durable context.',
    ],
    applyTomorrow:
      'Возьми один повторяемый рабочий ход: отдели always-on rules, scoped rules, skill draft и task-only контекст.',
    nextTeaser:
      'Дальше ты научишься подключать только релевантные rules и skills под бюджет внимания.',
  },
  recap: {
    rules: [
      'Always-on rules короткие, безопасные и нужны почти всегда; scoped rules подключаются только в своей зоне.',
      'Skill -- это процедура с входами, шагами, запретами, проверкой, stop conditions и update trigger.',
      'Playbook может связывать rules и skills, но task brief и one-off prompt не становятся долговечной памятью.',
    ],
    commonTrap: {
      trapId: 'prompt-instead-of-skill',
      note:
        'Удачная формулировка prompt не является skill, пока в ней нет условий применения, входов, шагов, проверки и остановки.',
    },
    nextMove:
      'Собери mini inventory: какие rules оставить always-on, какие сделать scoped, какую повторяемую процедуру оформить как skill draft и что удалить.',
  },
  prep: {
    title: 'Сцена 5.0: настроить управление агентом',
    summary:
      'Перед практикой разложи знания по носителям: rules задают границы, skills описывают повторяемые ходы, playbook связывает workflow, а task brief живёт только в текущей задаче.',
    mentorNote:
      'Главная ловушка главы -- назвать всё правилом, skill или playbook. Так память агента быстро устаревает, конфликтует и грузит лишний контекст. Хорошая система инструкций короткая, scoped, безопасная и поддерживаемая.',
    checklist: [
      'Отличай always-on rule от scoped rule: первая нужна почти всегда, вторая только в понятной зоне.',
      'Не превращай один удачный prompt или разовую задачу в skill.',
      'Skill описывай как процедуру: когда применять, когда нельзя, входы, шаги, запреты, проверка и stop conditions.',
      'Удаляй stale rules, unsafe examples, реальные логи и task-only заметки из durable instructions.',
      'Playbook упоминай как carrier для большого workflow, но не дублируй его анатомию в этой главе.',
    ],
    resources: [
      {
        id: 'habr-team-agreements-rules',
        title: 'Фиксация соглашений в команде',
        type: 'article',
        language: 'ru',
        source: 'Habr',
        sourceLabel: 'Habr',
        description:
          'Как хранить командные соглашения так, чтобы они оставались понятными, актуальными и пригодными для ревью.',
        url: 'https://habr.com/ru/articles/684470/',
        lastReviewed: '2026-06-02',
        estimatedMinutes: 8,
      },
      {
        id: 'developer-experience-runbook-skill',
        title: 'Runbook как повторяемая инструкция',
        type: 'article',
        language: 'en',
        source: 'Developer Experience Knowledge Base',
        sourceLabel: 'Developer Experience',
        description:
          'Короткая база о repeatable procedure: когда использовать, какие входы нужны и как другой инженер повторяет рабочий ход.',
        url: 'https://developerexperience.io/articles/runbook',
        lastReviewed: '2026-06-02',
        estimatedMinutes: 5,
      },
      {
        id: 'owasp-sensitive-information-rules',
        title: 'Утечки чувствительной информации в LLM-сценариях',
        type: 'security reference',
        language: 'en',
        source: 'OWASP',
        sourceLabel: 'OWASP',
        description:
          'Почему секреты, персональные данные, raw logs и конфиденциальные материалы нельзя превращать в постоянный контекст модели.',
        url: 'https://genai.owasp.org/llmrisk2023-24/llm06-sensitive-information-disclosure/',
        lastReviewed: '2026-06-02',
        estimatedMinutes: 8,
      },
    ],
  },
  artifacts: [
    {
      id: 'rules-inventory',
      title: 'Rules Inventory',
      description:
        'Рабочий список always-on rules, scoped rules, rules to delete и конфликтов, которые нужно обслужить.',
      fileName: 'rules-inventory.md',
    },
    {
      id: 'skill-draft',
      title: 'Skill Draft',
      description:
        'Tool-agnostic черновик reusable skill с условиями применения, входами, шагами, проверкой и stop conditions.',
      fileName: 'skill-draft.md',
    },
  ],
  missions: applyMissionFeedbackList(chapterFiveMissions),
  boss: applyMissionFeedback(chapterFiveBoss),
}
