import type { TrapConceptId } from '../../../shared/types/domain'

export type TrapConcept = {
  description: string
  id: TrapConceptId
  label: string
}

export const trapConcepts: Record<TrapConceptId, TrapConcept> = {
  'agent-as-source': {
    description:
      'Модель помогает думать, но источник истины дают тесты, спецификация, доменное правило или человек-владелец.',
    id: 'agent-as-source',
    label: 'Агент как источник',
  },
  'blind-retry': {
    description:
      'Повтор без нового вывода ошибки, доказательства или сужения границ обычно только расширяет проблему.',
    id: 'blind-retry',
    label: 'Попробуй ещё раз без новой информации',
  },
  'confident-report': {
    description:
      'Уверенный отчёт агента не заменяет запуск команды, ручную проверку или понимание автора.',
    id: 'confident-report',
    label: 'Уверенный отчёт',
  },
  'conflicting-instructions': {
    description:
      'Когда инструкции тянут в разные стороны, нужен явный приоритет или владелец, иначе агент будет выбирать наугад.',
    id: 'conflicting-instructions',
    label: 'Конфликт инструкций',
  },
  'context-dump': {
    description:
      'Лишний или слабосвязанный контекст сжигает внимание и мешает увидеть главное правило задачи.',
    id: 'context-dump',
    label: 'Свалка контекста',
  },
  'neighboring-refactor': {
    description:
      'Полезное “заодно” уводит diff из заявленной задачи в соседние модули и усложняет ревью.',
    id: 'neighboring-refactor',
    label: 'Соседний рефакторинг',
  },
  'personal-magic': {
    description:
      'Рабочий ход должен повторить другой участник команды, а не только автор с личным контекстом в голове.',
    id: 'personal-magic',
    label: 'Личная магия',
  },
  'prompt-instead-of-skill': {
    description:
      'Повторяемая процедура, спрятанная в удачной формулировке prompt, теряет входы, шаги, проверки и стоп-условия.',
    id: 'prompt-instead-of-skill',
    label: 'Prompt вместо skill',
  },
  'sensitive-data': {
    description:
      'Реальные секреты, персональные данные, клиентские примеры и сырые логи заменяются безопасными синтетическими данными.',
    id: 'sensitive-data',
    label: 'Чувствительные данные',
  },
  'stale-rule': {
    description:
      'Правило, которое пережило изменение процесса или системы, ведёт агента по старому пути вместо текущего.',
    id: 'stale-rule',
    label: 'Устаревшее правило',
  },
  'too-broad': {
    description:
      'Широкая задача без ясных границ плохо проверяется и быстро превращается в тяжёлый для ревью набор изменений.',
    id: 'too-broad',
    label: 'Слишком широко',
  },
  'unsafe-always-on-context': {
    description:
      'Инструкция для постоянного контекста не должна нести секреты, реальные логи, персональные данные или узкие одноразовые хаки.',
    id: 'unsafe-always-on-context',
    label: 'Небезопасный always-on контекст',
  },
  'weak-test': {
    description:
      'Проверка должна доказывать нужное поведение или риск, а не только сборку, снимок или красивый отчёт.',
    id: 'weak-test',
    label: 'Тест, который ничего не доказывает',
  },
}

export const trapConceptList = Object.values(trapConcepts)

export function getTrapConcept(trapId?: TrapConceptId) {
  return trapId ? trapConcepts[trapId] : null
}

export function getTrapConceptsByIds(trapIds: TrapConceptId[]) {
  const trapIdSet = new Set(trapIds)

  return trapConceptList.filter((concept) => trapIdSet.has(concept.id))
}
