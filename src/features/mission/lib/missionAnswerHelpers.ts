import type {
  BasicMissionAnswer,
  BossFightAnswer,
} from '../../../entities/mission/lib/missionEngine'
import type {
  PublicBossFightRoundMission,
  PublicChipPickerMission,
  PublicMissionEvaluation,
  PublicMission,
  PublicMissionChip,
  PublicPairMatchingMission,
} from '../../../shared/types/domain'

export type BossDossierItem = {
  answerSummary: string
  id: string
  result: NonNullable<PublicMissionEvaluation['roundResults']>[number] | undefined
  retryPrinciple?: string
  takeaway?: string
  title: string
}

export function getChipCost(chip: Pick<PublicMissionChip, 'cost'>) {
  return chip.cost ?? 1
}

export function getSelectedChipCost(
  mission: PublicChipPickerMission,
  selectedIds: string[],
) {
  return mission.chips
    .filter((chip) => selectedIds.includes(chip.id))
    .reduce((sum, chip) => sum + getChipCost(chip), 0)
}

export function canSelectChipWithinBudget(
  mission: PublicChipPickerMission,
  selectedIds: string[],
  chipId: string,
) {
  if (!mission.budget || selectedIds.includes(chipId)) {
    return true
  }

  const chip = mission.chips.find((item) => item.id === chipId)

  if (!chip) {
    return false
  }

  return (
    getSelectedChipCost(mission, selectedIds) + getChipCost(chip) <=
    mission.budget.limit
  )
}

export function getAnswerSummary(
  mission: PublicBossFightRoundMission,
  answer: BasicMissionAnswer | undefined,
) {
  if (!answer) {
    return 'Раунд ещё не зафиксирован'
  }

  if (mission.kind === 'scenario-decision') {
    const optionId = Array.isArray(answer) ? answer[0] : answer
    return (
      mission.options.find((option) => option.id === optionId)?.label ??
      'Выбран ход'
    )
  }

  if (mission.kind === 'prompt-assembly') {
    const slotAnswer =
      typeof answer === 'object' && !Array.isArray(answer) ? answer : {}
    const filledSlotLabels = mission.slots
      .filter((slot) => slotAnswer[slot.id])
      .map((slot) => slot.label)

    return filledSlotLabels.length > 0
      ? filledSlotLabels.join(' / ')
      : 'Каркас ещё не собран'
  }

  if (mission.kind === 'pair-matching') {
    const pairAnswer =
      typeof answer === 'object' && !Array.isArray(answer) ? answer : {}
    const matchedPairs = mission.items
      .map((item) => {
        const target = mission.targets.find(
          (candidate) => candidate.id === pairAnswer[item.id],
        )

        return target ? `${item.label} -> ${target.label}` : ''
      })
      .filter(Boolean)

    return matchedPairs.length > 0
      ? matchedPairs.join(' / ')
      : 'Пары ещё не собраны'
  }

  const answerIds = Array.isArray(answer)
    ? answer
    : typeof answer === 'string'
      ? [answer]
      : []
  const labels = answerIds
    .map((chipId, index) => {
      const chip = mission.chips.find((item) => item.id === chipId)
      const prefix = mission.kind === 'chip-ordering' ? `${index + 1}. ` : ''

      return chip ? `${prefix}${chip.label}` : ''
    })
    .filter(Boolean)

  return labels.length > 0 ? labels.join(' / ') : 'Выбор зафиксирован'
}

export function getMissionReadyState(input: {
  activeMission: PublicBossFightRoundMission
  orderLimit: number
  pairMatchingAnswer: Record<string, string | null | undefined>
  promptAssemblyAnswer: Record<string, string | null | undefined>
  selectedChipIds: string[]
  selectedOptionId: string
}) {
  const {
    activeMission,
    orderLimit,
    pairMatchingAnswer,
    promptAssemblyAnswer,
    selectedChipIds,
    selectedOptionId,
  } = input

  if (activeMission.kind === 'scenario-decision') {
    return Boolean(selectedOptionId)
  }

  if (activeMission.kind === 'prompt-assembly') {
    return activeMission.slots
      .filter((slot) => slot.required !== false)
      .every((slot) => Boolean(promptAssemblyAnswer[slot.id]))
  }

  if (activeMission.kind === 'chip-ordering') {
    return selectedChipIds.length === orderLimit
  }

  if (activeMission.kind === 'chip-picker') {
    return selectedChipIds.length > 0
  }

  if (activeMission.kind === 'pair-matching') {
    return isPairMatchingReady(activeMission, pairMatchingAnswer)
  }

  return false
}

export function isPairMatchingReady(
  mission: PublicPairMatchingMission,
  pairMatchingAnswer: Record<string, string | null | undefined>,
) {
  const assignedTargetIds = mission.items
    .map((item) => pairMatchingAnswer[item.id])
    .filter((targetId): targetId is string => Boolean(targetId))

  return (
    mission.items.length > 0 &&
    assignedTargetIds.length === mission.items.length &&
    new Set(assignedTargetIds).size === assignedTargetIds.length
  )
}

export function getPairMatchingAnswerWithAssignment(
  mission: PublicPairMatchingMission,
  pairMatchingAnswer: Record<string, string | null | undefined>,
  itemId: string,
  targetId: string,
) {
  const targetOwnerItem = mission.items.find(
    (item) => item.id !== itemId && pairMatchingAnswer[item.id] === targetId,
  )

  if (targetOwnerItem) {
    return pairMatchingAnswer
  }

  return {
    ...pairMatchingAnswer,
    [itemId]: targetId,
  }
}

export function getPrimaryActionLabel(input: {
  activeBossRoundIndex: number
  bossRoundCount: number
  isBossFight: boolean
  isSubmitting: boolean
}) {
  const {
    activeBossRoundIndex,
    bossRoundCount,
    isBossFight,
    isSubmitting,
  } = input

  if (!isBossFight) {
    return isSubmitting ? 'Проверяю...' : 'Проверить решение'
  }

  const isLastBossRound = activeBossRoundIndex >= bossRoundCount - 1

  if (!isLastBossRound) {
    return 'Зафиксировать раунд'
  }

  return isSubmitting ? 'Проверяю финал...' : 'Проверить финал'
}

export function getBossDossierItems(input: {
  bossRoundAnswers: BossFightAnswer
  result: PublicMissionEvaluation | null
  rounds: PublicBossFightRoundMission[]
}) {
  const { bossRoundAnswers, result, rounds } = input

  return rounds
    .map((round) => {
      const answer = bossRoundAnswers[round.id]

      if (!answer) {
        return null
      }

      return {
        answerSummary: getAnswerSummary(round, answer),
        id: round.id,
        result: result?.roundResults?.find(
          (roundResult) => roundResult.roundId === round.id,
        ),
        retryPrinciple: round.retryPrinciple,
        takeaway: round.takeaway,
        title: round.title,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
}

export function getActiveMission(
  mission: PublicMission,
  activeBossRoundIndex: number,
) {
  if (mission.kind !== 'boss-fight') {
    return mission
  }

  return mission.rounds[activeBossRoundIndex] ?? mission.rounds[0]!
}
