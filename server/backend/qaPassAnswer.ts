import type {
  BossFightRoundMission,
  ChipOrderingMission,
  ChipPickerMission,
  Mission,
  PairMatchingMission,
  PromptAssemblyMission,
  ScenarioDecisionMission,
} from '../../src/shared/types/domain'
import type {
  BasicMissionAnswer,
  BossFightAnswer,
  MissionAnswer,
  PromptAssemblyAnswer,
} from '../../src/entities/mission/lib/missionEngine'

class QaPassAnswerError extends Error {
  constructor(mission: Mission | BossFightRoundMission, reason: string) {
    super(`QA pass answer is unavailable for mission "${mission.id}": ${reason}`)
    this.name = 'QaPassAnswerError'
  }
}

function getChipCost(chip: { cost?: number }) {
  return chip.cost ?? 1
}

function createScenarioDecisionAnswer(
  mission: ScenarioDecisionMission,
): BasicMissionAnswer {
  const correctOption = mission.options.find((option) => option.isCorrect)

  if (!correctOption) {
    throw new QaPassAnswerError(mission, 'correct scenario option was not found')
  }

  return correctOption.id
}

function createChipPickerAnswer(mission: ChipPickerMission): BasicMissionAnswer {
  const correctChips = mission.chips.filter((chip) => chip.isCorrect)
  const answer = correctChips.map((chip) => chip.id)
  const selectedCost = correctChips.reduce(
    (sum, chip) => sum + getChipCost(chip),
    0,
  )

  if (mission.budget && selectedCost > mission.budget.limit) {
    throw new QaPassAnswerError(
      mission,
      'correct chip set exceeds the configured budget',
    )
  }

  return answer
}

function createChipOrderingAnswer(
  mission: ChipOrderingMission,
): BasicMissionAnswer {
  const chipIds = new Set(mission.chips.map((chip) => chip.id))
  const missingChipId = mission.correctOrder.find((chipId) => !chipIds.has(chipId))

  if (missingChipId) {
    throw new QaPassAnswerError(
      mission,
      'correct order references a chip that is not in the mission',
    )
  }

  return [...mission.correctOrder]
}

function createPairMatchingAnswer(
  mission: PairMatchingMission,
): BasicMissionAnswer {
  if (mission.items.length === 0) {
    throw new QaPassAnswerError(mission, 'pair-matching items are empty')
  }

  const targetIds = new Set(mission.targets.map((target) => target.id))

  return Object.fromEntries(
    mission.items.map((item) => {
      const targetId = item.acceptedTargetIds.find((candidateId) =>
        targetIds.has(candidateId),
      )

      if (!targetId) {
        throw new QaPassAnswerError(
          mission,
          'accepted pair-matching target was not found',
        )
      }

      return [item.id, targetId]
    }),
  )
}

function createPromptAssemblyAnswer(
  mission: PromptAssemblyMission,
): BasicMissionAnswer {
  const fragmentsById = new Map(
    mission.fragments.map((fragment) => [fragment.id, fragment]),
  )
  const usedFragmentIds = new Set<string>()
  const answer: PromptAssemblyAnswer = {}
  const requiredSlots = mission.slots.filter((slot) => slot.required !== false)

  if (requiredSlots.length === 0) {
    throw new QaPassAnswerError(mission, 'required prompt slots are empty')
  }

  for (const slot of requiredSlots) {
    const fragmentId = slot.acceptedFragmentIds.find((candidateId) => {
      const fragment = fragmentsById.get(candidateId)

      return (
        fragment &&
        !fragment.trapId &&
        !fragment.trapLabel &&
        !usedFragmentIds.has(candidateId)
      )
    })

    if (!fragmentId) {
      throw new QaPassAnswerError(
        mission,
        'accepted non-trap prompt fragment was not found for a required slot',
      )
    }

    usedFragmentIds.add(fragmentId)
    answer[slot.id] = fragmentId
  }

  return answer
}

function createBasicQaPassAnswer(
  mission: BossFightRoundMission,
): BasicMissionAnswer {
  if (mission.kind === 'scenario-decision') {
    return createScenarioDecisionAnswer(mission)
  }

  if (mission.kind === 'chip-picker') {
    return createChipPickerAnswer(mission)
  }

  if (mission.kind === 'chip-ordering') {
    return createChipOrderingAnswer(mission)
  }

  if (mission.kind === 'pair-matching') {
    return createPairMatchingAnswer(mission)
  }

  return createPromptAssemblyAnswer(mission)
}

export function createQaPassAnswer(mission: Mission): MissionAnswer {
  if (mission.kind !== 'boss-fight') {
    return createBasicQaPassAnswer(mission)
  }

  if (mission.rounds.length === 0) {
    throw new QaPassAnswerError(mission, 'boss rounds are empty')
  }

  const answer: BossFightAnswer = {}

  for (const round of mission.rounds) {
    answer[round.id] = createBasicQaPassAnswer(round)
  }

  return answer
}
