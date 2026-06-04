import { describe, expect, it } from 'vitest'

import { getChapterArtifacts } from '../../../shared/lib/content/chapterArtifacts'
import type {
  BossFightMission,
  ChipOrderingMission,
  ChipPickerMission,
  Chapter,
  Mission,
  PairMatchingMission,
  PromptAssemblyMission,
  PublicMission,
  ScenarioDecisionMission,
} from '../../../shared/types/domain'
import { projectChapterCatalogToPublic } from '../../../shared/api/content/publicContentProjection'
import {
  evaluateMission,
  getEncounteredTrapIdsFromEvaluation,
} from '../../mission/lib/missionEngine'
import { chapters } from './chapterCatalog'

function pushIf(issues: string[], condition: boolean, issue: string) {
  if (condition) {
    issues.push(issue)
  }
}

function hasDuplicates(values: string[]) {
  return new Set(values).size !== values.length
}

function validateRequiredText(
  issues: string[],
  scope: string,
  fields: Record<string, string | undefined>,
) {
  for (const [field, value] of Object.entries(fields)) {
    pushIf(issues, !value?.trim(), `${scope} is missing ${field}`)
  }
}

function validateScenarioDecisionMission(
  issues: string[],
  chapter: Chapter,
  mission: ScenarioDecisionMission,
) {
  const optionIds = mission.options.map((option) => option.id)

  pushIf(
    issues,
    mission.options.length < 2,
    `${chapter.id}/${mission.id} needs at least two scenario options`,
  )
  pushIf(
    issues,
    hasDuplicates(optionIds),
    `${chapter.id}/${mission.id} has duplicate option ids`,
  )
  pushIf(
    issues,
    !mission.options.some((option) => option.isCorrect),
    `${chapter.id}/${mission.id} has no correct option`,
  )
  pushIf(
    issues,
    !mission.options.some((option) => !option.isCorrect),
    `${chapter.id}/${mission.id} has no distractor option`,
  )
}

function validateChipPickerMission(
  issues: string[],
  chapter: Chapter,
  mission: ChipPickerMission,
) {
  const chipIds = mission.chips.map((chip) => chip.id)
  const correctCost = mission.chips
    .filter((chip) => chip.isCorrect)
    .reduce((sum, chip) => sum + (chip.cost ?? 1), 0)

  pushIf(
    issues,
    mission.chips.length < 2,
    `${chapter.id}/${mission.id} needs at least two chips`,
  )
  pushIf(
    issues,
    hasDuplicates(chipIds),
    `${chapter.id}/${mission.id} has duplicate chip ids`,
  )
  pushIf(
    issues,
    !mission.chips.some((chip) => chip.isCorrect),
    `${chapter.id}/${mission.id} has no correct chip`,
  )
  pushIf(
    issues,
    !mission.chips.some((chip) => !chip.isCorrect),
    `${chapter.id}/${mission.id} has no distractor chip`,
  )

  if (mission.budget) {
    pushIf(
      issues,
      correctCost > mission.budget.limit,
      `${chapter.id}/${mission.id} budget cannot fit all correct chips`,
    )
  }
}

function validateChipOrderingMission(
  issues: string[],
  chapter: Chapter,
  mission: ChipOrderingMission,
) {
  const chipIds = mission.chips.map((chip) => chip.id)
  const correctChipIds = mission.chips
    .filter((chip) => chip.isCorrect)
    .map((chip) => chip.id)
  const correctOrderIds = new Set(mission.correctOrder)

  pushIf(
    issues,
    mission.chips.length < 2,
    `${chapter.id}/${mission.id} needs at least two ordered chips`,
  )
  pushIf(
    issues,
    hasDuplicates(chipIds),
    `${chapter.id}/${mission.id} has duplicate chip ids`,
  )
  pushIf(
    issues,
    hasDuplicates(mission.correctOrder),
    `${chapter.id}/${mission.id} has duplicate correctOrder ids`,
  )
  pushIf(
    issues,
    mission.correctOrder.some((chipId) => !chipIds.includes(chipId)),
    `${chapter.id}/${mission.id} correctOrder references an unknown chip`,
  )
  pushIf(
    issues,
    correctChipIds.some((chipId) => !correctOrderIds.has(chipId)),
    `${chapter.id}/${mission.id} omits a correct chip from correctOrder`,
  )
  pushIf(
    issues,
    mission.correctOrder.some((chipId) => !correctChipIds.includes(chipId)),
    `${chapter.id}/${mission.id} includes an incorrect chip in correctOrder`,
  )
}

function validatePromptAssemblyMission(
  issues: string[],
  chapter: Chapter,
  mission: PromptAssemblyMission,
) {
  const slotIds = mission.slots.map((slot) => slot.id)
  const fragmentIds = mission.fragments.map((fragment) => fragment.id)
  const fragmentIdSet = new Set(fragmentIds)

  pushIf(
    issues,
    mission.slots.length === 0,
    `${chapter.id}/${mission.id} has no prompt slots`,
  )
  pushIf(
    issues,
    mission.fragments.length === 0,
    `${chapter.id}/${mission.id} has no prompt fragments`,
  )
  pushIf(
    issues,
    hasDuplicates(slotIds),
    `${chapter.id}/${mission.id} has duplicate slot ids`,
  )
  pushIf(
    issues,
    hasDuplicates(fragmentIds),
    `${chapter.id}/${mission.id} has duplicate fragment ids`,
  )

  for (const slot of mission.slots) {
    pushIf(
      issues,
      slot.acceptedFragmentIds.length === 0,
      `${chapter.id}/${mission.id}/${slot.id} has no accepted fragments`,
    )
    pushIf(
      issues,
      slot.acceptedFragmentIds.some((fragmentId) => !fragmentIdSet.has(fragmentId)),
      `${chapter.id}/${mission.id}/${slot.id} references an unknown fragment`,
    )
  }
}

function validatePairMatchingMission(
  issues: string[],
  chapter: Chapter,
  mission: PairMatchingMission,
) {
  const itemIds = mission.items.map((item) => item.id)
  const targetIds = mission.targets.map((target) => target.id)
  const targetIdSet = new Set(targetIds)

  pushIf(
    issues,
    mission.items.length === 0,
    `${chapter.id}/${mission.id} has no pair matching items`,
  )
  pushIf(
    issues,
    mission.targets.length === 0,
    `${chapter.id}/${mission.id} has no pair matching targets`,
  )
  pushIf(
    issues,
    hasDuplicates(itemIds),
    `${chapter.id}/${mission.id} has duplicate pair matching item ids`,
  )
  pushIf(
    issues,
    hasDuplicates(targetIds),
    `${chapter.id}/${mission.id} has duplicate pair matching target ids`,
  )

  for (const item of mission.items) {
    pushIf(
      issues,
      item.acceptedTargetIds.length === 0,
      `${chapter.id}/${mission.id}/${item.id} has no accepted targets`,
    )
    pushIf(
      issues,
      item.acceptedTargetIds.some((targetId) => !targetIdSet.has(targetId)),
      `${chapter.id}/${mission.id}/${item.id} references an unknown pair matching target`,
    )
  }
}

function validateMission(
  issues: string[],
  chapter: Chapter,
  mission: Mission,
  seenMissionIds: Set<string>,
) {
  validateRequiredText(issues, `${chapter.id}/${mission.id}`, {
    failureFeedback: mission.failureFeedback,
    mentorHint: mission.mentorHint,
    prompt: mission.prompt,
    retryPrinciple: mission.retryPrinciple,
    successFeedback: mission.successFeedback,
    title: mission.title,
  })

  pushIf(
    issues,
    seenMissionIds.has(mission.id),
    `${chapter.id}/${mission.id} duplicates another mission id`,
  )
  seenMissionIds.add(mission.id)

  switch (mission.kind) {
    case 'scenario-decision':
      validateScenarioDecisionMission(issues, chapter, mission)
      break
    case 'chip-picker':
      validateChipPickerMission(issues, chapter, mission)
      break
    case 'chip-ordering':
      validateChipOrderingMission(issues, chapter, mission)
      break
    case 'prompt-assembly':
      validatePromptAssemblyMission(issues, chapter, mission)
      break
    case 'pair-matching':
      validatePairMatchingMission(issues, chapter, mission)
      break
    case 'boss-fight':
      validateBossFightMission(issues, chapter, mission, seenMissionIds)
      break
  }
}

function validateBossFightMission(
  issues: string[],
  chapter: Chapter,
  mission: BossFightMission,
  seenMissionIds: Set<string>,
) {
  pushIf(
    issues,
    mission.rounds.length === 0,
    `${chapter.id}/${mission.id} has no boss rounds`,
  )
  pushIf(
    issues,
    mission.passingScore < 1 || mission.passingScore > 100,
    `${chapter.id}/${mission.id} has invalid passingScore`,
  )

  for (const round of mission.rounds) {
    validateMission(issues, chapter, round, seenMissionIds)
  }
}

function validateChapterCatalog(catalog: Chapter[]) {
  const issues: string[] = []
  const chapterIds = catalog.map((chapter) => chapter.id)
  const chapterOrders = catalog.map((chapter) => String(chapter.order))
  const artifactIds = catalog.flatMap((chapter) =>
    getChapterArtifacts(chapter).map((artifact) => artifact.id),
  )
  const artifactFileNames = catalog.flatMap((chapter) =>
    getChapterArtifacts(chapter).map((artifact) => artifact.fileName),
  )
  const seenMissionIds = new Set<string>()

  pushIf(issues, catalog.length !== 8, `expected 8 chapters, got ${catalog.length}`)
  pushIf(issues, hasDuplicates(chapterIds), 'chapter ids must be unique')
  pushIf(issues, hasDuplicates(chapterOrders), 'chapter orders must be unique')
  pushIf(issues, hasDuplicates(artifactIds), 'artifact ids must be unique')
  pushIf(issues, hasDuplicates(artifactFileNames), 'artifact filenames must be unique')

  for (const [index, chapter] of catalog.entries()) {
    const expectedOrder = index + 1
    validateRequiredText(issues, chapter.id, {
      badgeName: chapter.badgeName,
      rankAfterCompletion: chapter.rankAfterCompletion,
      summary: chapter.summary,
      title: chapter.title,
    })
    pushIf(
      issues,
      chapter.order !== expectedOrder,
      `${chapter.id} order must be ${expectedOrder}`,
    )
    pushIf(
      issues,
      chapter.missions.length === 0,
      `${chapter.id} has no regular missions`,
    )
    pushIf(issues, !chapter.prep, `${chapter.id} has no prep briefing`)
    pushIf(
      issues,
      getChapterArtifacts(chapter).length === 0,
      `${chapter.id} has no artifact metadata`,
    )
    pushIf(issues, !chapter.visual, `${chapter.id} has no map visual metadata`)
    pushIf(
      issues,
      chapter.reward.masteryActions.length < 2,
      `${chapter.id} needs at least two mastery actions`,
    )
    pushIf(
      issues,
      chapter.prep?.resources.length === 0,
      `${chapter.id} prep has no curated resources`,
    )

    const resourceIds = chapter.prep?.resources.map((resource) => resource.id) ?? []
    pushIf(
      issues,
      hasDuplicates(resourceIds),
      `${chapter.id} prep has duplicate resource ids`,
    )

    for (const resource of chapter.prep?.resources ?? []) {
      validateRequiredText(issues, `${chapter.id}/${resource.id}`, {
        description: resource.description,
        sourceLabel: resource.sourceLabel,
        title: resource.title,
        url: resource.url,
      })
      pushIf(
        issues,
        !resource.url.startsWith('https://'),
        `${chapter.id}/${resource.id} resource URL must use https`,
      )
      pushIf(
        issues,
        resource.estimatedMinutes <= 0,
        `${chapter.id}/${resource.id} resource needs a positive estimate`,
      )
    }

    for (const mission of chapter.missions) {
      validateMission(issues, chapter, mission, seenMissionIds)
    }
    validateMission(issues, chapter, chapter.boss, seenMissionIds)
  }

  return issues
}

const forbiddenPublicMissionFields = [
  'acceptedFragmentIds',
  'acceptedTargetIds',
  'correctOrder',
  'isCorrect',
  'passingScore',
]

function collectForbiddenPublicFields(value: unknown, path: string) {
  const issues: string[] = []

  if (!value || typeof value !== 'object') {
    return issues
  }

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      issues.push(...collectForbiddenPublicFields(item, `${path}[${index}]`))
    }

    return issues
  }

  const record = value as Record<string, unknown>

  for (const key of Object.keys(record)) {
    if (forbiddenPublicMissionFields.includes(key)) {
      issues.push(`${path} exposes ${key}`)
    }

    issues.push(...collectForbiddenPublicFields(record[key], `${path}.${key}`))
  }

  return issues
}

function validatePublicMissionProjection(
  issues: string[],
  authoredMission: Mission,
  publicMission: PublicMission,
) {
  pushIf(
    issues,
    authoredMission.id !== publicMission.id,
    `${authoredMission.id} public mission id changed`,
  )
  pushIf(
    issues,
    authoredMission.kind !== publicMission.kind,
    `${authoredMission.id} public mission kind changed`,
  )

  if (authoredMission.kind === 'chip-ordering') {
    pushIf(
      issues,
      publicMission.kind !== 'chip-ordering' ||
        publicMission.targetCount !== authoredMission.correctOrder.length,
      `${authoredMission.id} public targetCount must match correctOrder length`,
    )
  }

  if (authoredMission.kind === 'pair-matching') {
    if (publicMission.kind !== 'pair-matching') {
      return
    }

    pushIf(
      issues,
      authoredMission.items.length !== publicMission.items.length,
      `${authoredMission.id} public pair matching item count changed`,
    )
    pushIf(
      issues,
      authoredMission.targets.length !== publicMission.targets.length,
      `${authoredMission.id} public pair matching target count changed`,
    )

    for (const [index, item] of authoredMission.items.entries()) {
      pushIf(
        issues,
        publicMission.items[index]?.id !== item.id,
        `${authoredMission.id} public pair matching item id changed`,
      )
    }

    for (const [index, target] of authoredMission.targets.entries()) {
      pushIf(
        issues,
        publicMission.targets[index]?.id !== target.id,
        `${authoredMission.id} public pair matching target id changed`,
      )
    }
  }

  if (authoredMission.kind === 'boss-fight') {
    if (publicMission.kind !== 'boss-fight') {
      return
    }

    pushIf(
      issues,
      authoredMission.rounds.length !== publicMission.rounds.length,
      `${authoredMission.id} public boss round count changed`,
    )

    for (const [index, round] of authoredMission.rounds.entries()) {
      const publicRound = publicMission.rounds[index]

      if (publicRound) {
        validatePublicMissionProjection(issues, round, publicRound)
      }
    }
  }
}

function validatePublicChapterProjection(catalog: Chapter[]) {
  const publicCatalog = projectChapterCatalogToPublic(catalog)
  const issues = collectForbiddenPublicFields(publicCatalog, 'publicCatalog')

  for (const [chapterIndex, chapter] of catalog.entries()) {
    const publicChapter = publicCatalog[chapterIndex]

    if (!publicChapter) {
      issues.push(`${chapter.id} is missing from public catalog`)
      continue
    }

    pushIf(
      issues,
      chapter.missions.length !== publicChapter.missions.length,
      `${chapter.id} public mission count changed`,
    )

    for (const [missionIndex, mission] of chapter.missions.entries()) {
      const publicMission = publicChapter.missions[missionIndex]

      if (publicMission) {
        validatePublicMissionProjection(issues, mission, publicMission)
      }
    }

    validatePublicMissionProjection(issues, chapter.boss, publicChapter.boss)
  }

  return issues
}

describe('chapter catalog content validation', () => {
  it('keeps split chapter configs internally consistent', () => {
    expect(validateChapterCatalog(chapters)).toEqual([])
  })

  it('keeps the public projection browser-safe and aligned with authored content', () => {
    expect(validatePublicChapterProjection(chapters)).toEqual([])
  })

  it('exposes the Rules & Skills chapter with two separate artifacts', () => {
    const chapter = chapters.find((item) => item.id === 'chapter-5')

    expect(chapter).toMatchObject({
      order: 5,
      title: 'Rules & Skills',
      visual: {
        landmarkId: 'instruction-router',
      },
    })
    expect(chapter?.missions.map((mission) => mission.id)).toEqual([
      'knowledge-carrier-match',
      'rule-scope-gate',
      'skill-draft-order',
      'instruction-drift-fix',
    ])
    expect(chapter?.boss.id).toBe('instruction-drift')
    expect(getChapterArtifacts(chapter ?? {}).map((artifact) => artifact.fileName)).toEqual([
      'rules-inventory.md',
      'skill-draft.md',
    ])
  })

  it('records recurring traps from the opening chapter scenario', () => {
    const chapterOne = chapters.find((chapter) => chapter.id === 'chapter-1')
    const openingMission = chapterOne?.missions.find(
      (mission) => mission.id === 'who-owns-the-diff',
    )

    expect(openingMission?.kind).toBe('scenario-decision')
    if (!openingMission || openingMission.kind !== 'scenario-decision') {
      throw new Error('chapter-1 opening mission must be a scenario decision')
    }

    const result = evaluateMission(openingMission, 'merge')

    expect(getEncounteredTrapIdsFromEvaluation(result)).toEqual(['weak-test'])
  })

  it('keeps chapter 7 boss domain source choices aligned with the prompt', () => {
    const chapterSeven = chapters.find((chapter) => chapter.id === 'chapter-7')

    if (!chapterSeven || chapterSeven.boss.kind !== 'boss-fight') {
      throw new Error('chapter-7 must define a boss fight')
    }

    const gateOracleRound = chapterSeven.boss.rounds.find(
      (round) => round.id === 'gate-oracle',
    )

    expect(gateOracleRound?.kind).toBe('chip-picker')
    if (!gateOracleRound || gateOracleRound.kind !== 'chip-picker') {
      throw new Error('chapter-7 gate-oracle round must be a chip-picker')
    }

    const domainSourceIds = ['product-spec', 'domain-owner', 'existing-test']
    const acceptedResult = evaluateMission(gateOracleRound, domainSourceIds)
    const syntheticExampleResult = evaluateMission(gateOracleRound, [
      ...domainSourceIds,
      'safe-example',
    ])

    expect(acceptedResult).toMatchObject({
      isCorrect: true,
      score: 100,
    })
    expect(acceptedResult.answerDetails).toEqual([
      expect.objectContaining({ id: 'product-spec', status: 'correct' }),
      expect.objectContaining({ id: 'domain-owner', status: 'correct' }),
      expect.objectContaining({ id: 'existing-test', status: 'correct' }),
    ])
    expect(syntheticExampleResult).toMatchObject({
      isCorrect: false,
      score: 83,
    })
    expect(syntheticExampleResult.answerDetails).toEqual([
      expect.objectContaining({
        id: 'safe-example',
        status: 'trap',
        trapLabel: 'Не источник истины',
      }),
    ])
  })
})
