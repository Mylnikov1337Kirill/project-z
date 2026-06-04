import type {
  BossFightRoundMission,
  Mission,
  PairMatchingMission,
  PromptAssemblyMission,
  TrapConceptId,
} from '../../../shared/types/domain'

export type PromptAssemblyAnswer = Record<string, string | null | undefined>
export type PairMatchingAnswer = Record<string, string | null | undefined>
export type ChoiceMissionAnswer = string | string[]
export type BasicMissionAnswer =
  | ChoiceMissionAnswer
  | PairMatchingAnswer
  | PromptAssemblyAnswer
export type BossFightAnswer = Record<string, BasicMissionAnswer>
export type MissionAnswer = BasicMissionAnswer | BossFightAnswer
export type MissionAnswerDetail = {
  description: string
  id: string
  status: 'correct' | 'missed' | 'neutral' | 'trap'
  title: string
  trapId?: TrapConceptId
  trapLabel?: string
}

export type MissionEvaluation = {
  isCorrect: boolean
  score: number
  feedback: string
  answerDetails?: MissionAnswerDetail[]
  roundResults?: {
    answerDetails?: MissionAnswerDetail[]
    feedback: string
    isCorrect: boolean
    roundId: string
    score: number
    title: string
  }[]
}

function sameIds(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((item, index) => item === right[index])
}

function scoreExactSet(answerIds: string[], correctIds: string[], allIds: string[]) {
  const selectedIds = new Set(answerIds)
  const correctIdSet = new Set(correctIds)
  const matches = allIds.filter((id) =>
    correctIdSet.has(id) ? selectedIds.has(id) : !selectedIds.has(id),
  ).length

  return Math.round((matches / allIds.length) * 100)
}

function toIdList(answer: BasicMissionAnswer) {
  if (Array.isArray(answer)) {
    return answer
  }

  return typeof answer === 'string' ? [answer] : []
}

function isRecordAnswer(
  answer: BasicMissionAnswer,
): answer is Record<string, string | null | undefined> {
  return typeof answer === 'object' && !Array.isArray(answer) && answer !== null
}

function isBossFightAnswer(answer: MissionAnswer): answer is BossFightAnswer {
  return typeof answer === 'object' && !Array.isArray(answer) && answer !== null
}

function toBasicAnswer(answer: BasicMissionAnswer | undefined) {
  return answer ?? []
}

function getChipCost(chip: { cost?: number }) {
  return chip.cost ?? 1
}

function getChipPickerRetryFeedback(input: {
  isBudgetExceeded: boolean
  mission: Extract<BossFightRoundMission, { kind: 'chip-picker' }>
  selectedCost: number
}) {
  const baseFeedback =
    'Набор пока не прошёл проверку. Пересмотри выбранное: убери лишнее и проверь, не пропущен ли обязательный критерий.'

  if (input.isBudgetExceeded && input.mission.budget) {
    return `${baseFeedback} Бюджет контекста превышен: ${input.selectedCost}/${input.mission.budget.limit} ${input.mission.budget.unit}.`
  }

  return baseFeedback
}

function getChipOrderingRetryDetails(
  mission: Extract<BossFightRoundMission, { kind: 'chip-ordering' }>,
): MissionAnswerDetail[] {
  return [
    {
      description:
        'Порядок пока не проходит проверку. Пересобери цепочку по причинности: что нужно понять до действия, что доказывает результат и что закрывает работу.',
      id: `${mission.id}-order-review`,
      status: 'neutral',
      title: 'Порядок не сошёлся',
    },
  ]
}

function getChipOrderingRetryFeedback() {
  return 'Порядок пока не прошёл проверку. Пересобери цепочку по причинности и контрольным точкам, затем проверь ход снова.'
}

function getPromptAssemblyRetryFeedback() {
  return 'Каркас пока не держит рабочий контракт. Пересобери фрагменты по роли: что задаёт цель, что ограничивает работу, что доказывает результат и где нужен план до изменений.'
}

function getPairMatchingRetryFeedback(mission: PairMatchingMission) {
  return mission.failureFeedback
}

function collectTrapIdsFromDetails(
  details: MissionAnswerDetail[] | undefined,
) {
  if (!details) {
    return []
  }

  return details
    .filter(
      (detail): detail is MissionAnswerDetail & { trapId: TrapConceptId } =>
        detail.status !== 'correct' && Boolean(detail.trapId),
    )
    .map((detail) => detail.trapId)
}

function evaluateBasicMission(
  mission: BossFightRoundMission,
  answer: BasicMissionAnswer,
): MissionEvaluation {
  if (mission.kind === 'scenario-decision') {
    const optionId = Array.isArray(answer)
      ? answer[0]
      : typeof answer === 'string'
        ? answer
        : ''
    const selectedOption = mission.options.find((option) => option.id === optionId)
    const isCorrect = Boolean(selectedOption?.isCorrect)
    const selectedFeedback =
      selectedOption?.feedback ??
      selectedOption?.failureFeedback ??
      (isCorrect ? mission.successFeedback : mission.failureFeedback)

    return {
      isCorrect,
      score: isCorrect ? 100 : 0,
      feedback: isCorrect ? mission.successFeedback : selectedFeedback,
      answerDetails: selectedOption
        ? [
            {
              description: selectedFeedback,
              id: selectedOption.id,
              status: isCorrect ? 'correct' : 'trap',
              title: isCorrect ? 'Выбранный ход' : 'Сработала ловушка',
              trapId: selectedOption.trapId,
              trapLabel: selectedOption.trapLabel,
            },
          ]
        : undefined,
    }
  }

  if (mission.kind === 'prompt-assembly') {
    return evaluatePromptAssemblyMission(mission, answer)
  }

  if (mission.kind === 'pair-matching') {
    return evaluatePairMatchingMission(mission, answer)
  }

  if (mission.kind === 'chip-picker') {
    const answerIds = toIdList(answer)
    const correctIds = mission.chips
      .filter((chip) => chip.isCorrect)
      .map((chip) => chip.id)
    const allIds = mission.chips.map((chip) => chip.id)
    const selectedCost = mission.chips
      .filter((chip) => answerIds.includes(chip.id))
      .reduce((sum, chip) => sum + getChipCost(chip), 0)
    const isBudgetExceeded = Boolean(
      mission.budget && selectedCost > mission.budget.limit,
    )
    const isExactSelection =
      answerIds.length === correctIds.length &&
      correctIds.every((id) => answerIds.includes(id))
    const isCorrect = isExactSelection && !isBudgetExceeded
    const selectedIncorrectChips = mission.chips.filter(
      (chip) => answerIds.includes(chip.id) && !chip.isCorrect,
    )
    const selectedCorrectChips = mission.chips.filter(
      (chip) => answerIds.includes(chip.id) && chip.isCorrect,
    )
    const answerDetails = [
      ...(isBudgetExceeded && mission.budget
        ? [
            {
              description: `Выбрано ${selectedCost}/${mission.budget.limit} ${mission.budget.unit}. Сначала оставь только самый полезный контекст для этой задачи.`,
              id: `${mission.id}-budget`,
              status: 'trap' as const,
              title: mission.budget.label,
              trapId: 'context-dump' as const,
            },
          ]
        : []),
      ...selectedIncorrectChips.map((chip) => ({
        description:
          chip.feedback ??
          'Этот пункт звучит полезно, но не помогает решить текущую задачу и забирает внимание у важного.',
        id: chip.id,
        status: 'trap' as const,
        title: 'Лишний выбор',
        trapId: chip.trapId,
        trapLabel: chip.trapLabel,
      })),
      ...(isCorrect
        ? selectedCorrectChips
            .filter((chip) => chip.feedback)
            .map((chip) => ({
              description: chip.feedback ?? '',
              id: chip.id,
              status: 'correct' as const,
              title: 'Выбрано верно',
              trapId: chip.trapId,
              trapLabel: chip.trapLabel,
            }))
        : []),
    ]

    return {
      isCorrect,
      score: isCorrect ? 100 : scoreExactSet(answerIds, correctIds, allIds),
      feedback: isCorrect
        ? mission.successFeedback
        : getChipPickerRetryFeedback({
            isBudgetExceeded,
            mission,
            selectedCost,
          }),
      answerDetails: answerDetails.length > 0 ? answerDetails : undefined,
    }
  }

  const answerIds = toIdList(answer)
  const isCorrect = sameIds(answerIds, mission.correctOrder)
  const positionedMatches = mission.correctOrder.filter(
    (id, index) => answerIds[index] === id,
  ).length

  return {
    isCorrect,
    score: isCorrect
      ? 100
      : Math.round((positionedMatches / mission.correctOrder.length) * 100),
    feedback: isCorrect
      ? mission.successFeedback
      : getChipOrderingRetryFeedback(),
    answerDetails: isCorrect
      ? undefined
      : getChipOrderingRetryDetails(mission),
  }
}

function evaluatePairMatchingMission(
  mission: PairMatchingMission,
  answer: BasicMissionAnswer,
): MissionEvaluation {
  const pairAnswer = isRecordAnswer(answer) ? answer : {}
  const correctItems = mission.items.filter((item) =>
    item.acceptedTargetIds.includes(pairAnswer[item.id] ?? ''),
  )
  const wrongSelectedItems = mission.items.filter((item) => {
    const selectedTargetId = pairAnswer[item.id]

    return Boolean(
      selectedTargetId && !item.acceptedTargetIds.includes(selectedTargetId),
    )
  })
  const isCorrect =
    mission.items.length > 0 && correctItems.length === mission.items.length
  const answerDetails: MissionAnswerDetail[] = wrongSelectedItems.map((item) => ({
    description:
      item.feedback ??
      'Эта связь выглядит правдоподобно, но смешивает носители знания. Проверь срок жизни, область действия и повторяемость инструкции.',
    id: item.id,
    status: 'trap',
    title: 'Неверная пара',
    trapId: item.trapId,
    trapLabel: item.trapLabel,
  }))

  return {
    isCorrect,
    score: isCorrect
      ? 100
      : mission.items.length > 0
        ? Math.round((correctItems.length / mission.items.length) * 100)
        : 0,
    feedback: isCorrect
      ? mission.successFeedback
      : getPairMatchingRetryFeedback(mission),
    answerDetails: answerDetails.length > 0 ? answerDetails : undefined,
  }
}

function evaluatePromptAssemblyMission(
  mission: PromptAssemblyMission,
  answer: BasicMissionAnswer,
): MissionEvaluation {
  const slotAnswer = isRecordAnswer(answer) ? answer : {}
  const fragmentsById = new Map(
    mission.fragments.map((fragment) => [fragment.id, fragment]),
  )
  const selectedFragmentIds = mission.slots
    .map((slot) => slotAnswer[slot.id])
    .filter((fragmentId): fragmentId is string => Boolean(fragmentId))
  const duplicateFragmentIds = new Set(
    selectedFragmentIds.filter(
      (fragmentId, index) => selectedFragmentIds.indexOf(fragmentId) !== index,
    ),
  )
  const requiredSlots = mission.slots.filter((slot) => slot.required !== false)
  const slotResults = requiredSlots.map((slot) => {
    const fragmentId = slotAnswer[slot.id]
    const fragment = fragmentId ? fragmentsById.get(fragmentId) : undefined

    return {
      fragment,
      hasDuplicate: fragmentId ? duplicateFragmentIds.has(fragmentId) : false,
      isAccepted: fragmentId ? slot.acceptedFragmentIds.includes(fragmentId) : false,
      slotId: slot.id,
    }
  })
  const hasTrap = mission.slots.some((slot) => {
    const fragmentId = slotAnswer[slot.id]
    const fragment = fragmentId ? fragmentsById.get(fragmentId) : undefined

    return Boolean(fragment?.trapId || fragment?.trapLabel)
  })
  const correctRequiredSlots = slotResults.filter(
    (slot) =>
      slot.isAccepted &&
      !slot.hasDuplicate &&
      !slot.fragment?.trapId &&
      !slot.fragment?.trapLabel,
  ).length
  const isCorrect =
    !hasTrap &&
    slotResults.length > 0 &&
    correctRequiredSlots === slotResults.length
  const answerDetails: MissionAnswerDetail[] = []

  for (const slot of mission.slots) {
    const fragmentId = slotAnswer[slot.id]
    const fragment = fragmentId ? fragmentsById.get(fragmentId) : undefined

    if (!fragment || isCorrect) {
      continue
    }

    if (fragment.trapId || fragment.trapLabel) {
      answerDetails.push({
        description:
          fragment.feedback ??
          'Фрагмент звучит уверенно, но ломает границу рабочего контракта.',
        id: `${slot.id}-${fragment.id}`,
        status: 'trap',
        title: 'Сработала ловушка',
        trapId: fragment.trapId,
        trapLabel: fragment.trapLabel,
      })
      continue
    }

    if (duplicateFragmentIds.has(fragment.id)) {
      answerDetails.push({
        description:
          'Один фрагмент закрывает одну роль в контракте. Повтор обычно прячет недостающую границу, проверку или условие остановки.',
        id: `${slot.id}-${fragment.id}-duplicate`,
        status: 'neutral',
        title: 'Фрагмент использован дважды',
      })
      continue
    }

    if (!slot.acceptedFragmentIds.includes(fragment.id)) {
      answerDetails.push({
        description:
          fragment.feedback ??
          'Фрагмент звучит полезно, но в выбранном месте не удерживает свою роль в контракте. Проверь, что именно он ограничивает, доказывает или запрещает.',
        id: `${slot.id}-${fragment.id}-role`,
        status: 'neutral',
        title: 'Роль фрагмента не сошлась',
      })
    }
  }

  return {
    isCorrect,
    score: isCorrect
      ? 100
      : Math.round((correctRequiredSlots / requiredSlots.length) * 100),
    feedback: isCorrect ? mission.successFeedback : getPromptAssemblyRetryFeedback(),
    answerDetails: answerDetails.length > 0 ? answerDetails : undefined,
  }
}

export function evaluateMission(
  mission: Mission,
  answer: MissionAnswer,
): MissionEvaluation {
  if (mission.kind !== 'boss-fight') {
    return evaluateBasicMission(mission, answer as BasicMissionAnswer)
  }

  if (!isBossFightAnswer(answer)) {
    return {
      isCorrect: false,
      score: 0,
      feedback: mission.failureFeedback,
    }
  }

  const roundEvaluations = mission.rounds.map((round) => {
    const evaluation = evaluateBasicMission(round, toBasicAnswer(answer[round.id]))

    return {
      answerDetails: evaluation.answerDetails,
      feedback: evaluation.feedback,
      isCorrect: evaluation.isCorrect,
      roundId: round.id,
      score: evaluation.score,
      title: round.title,
    }
  })
  const totalScore = Math.round(
    roundEvaluations.reduce((sum, round) => sum + round.score, 0) /
      roundEvaluations.length,
  )
  const isCorrect =
    totalScore >= mission.passingScore &&
    roundEvaluations.every((round) => round.isCorrect)

  return {
    isCorrect,
    score: totalScore,
    feedback: isCorrect ? mission.successFeedback : mission.failureFeedback,
    roundResults: roundEvaluations,
  }
}

export function getEncounteredTrapIdsFromEvaluation(
  evaluation: MissionEvaluation,
) {
  const trapIds = evaluation.isCorrect
    ? []
    : collectTrapIdsFromDetails(evaluation.answerDetails)

  for (const round of evaluation.roundResults ?? []) {
    if (!round.isCorrect) {
      trapIds.push(...collectTrapIdsFromDetails(round.answerDetails))
    }
  }

  return Array.from(new Set(trapIds))
}
