import { describe, expect, it } from 'vitest'
import type {
  BossFightMission,
  Chapter,
  PairMatchingMission,
  PromptAssemblyMission,
  ScenarioDecisionMission,
} from '../../../shared/types/domain'
import { projectChapterToPublic } from '../../../shared/api/content/publicContentProjection'
import {
  evaluateMission,
  getEncounteredTrapIdsFromEvaluation,
} from './missionEngine'

const missionCopy = {
  failureFeedback: 'Try again with a smaller move.',
  mentorHint: 'Keep the answer reviewable.',
  prompt: 'Choose the safest move.',
  successFeedback: 'Accepted.',
  title: 'Review gate',
}

const scenarioMission: ScenarioDecisionMission = {
  ...missionCopy,
  id: 'scenario-review',
  kind: 'scenario-decision',
  options: [
    {
      feedback: 'Review in tests before merge.',
      id: 'review-before-merge',
      isCorrect: true,
      label: 'Review before merge',
    },
    {
      failureFeedback: 'Skipped checks leak risk.',
      id: 'skip-review',
      isCorrect: false,
      label: 'Skip review',
      trapId: 'weak-test',
      trapLabel: 'Weak test',
    },
  ],
}

const promptAssemblyMission: PromptAssemblyMission = {
  ...missionCopy,
  brief: {
    reviewableResult: 'A patch with a named verification command.',
    risk: 'A broad answer can touch unrelated code.',
    teamWants: 'A small, testable change.',
  },
  fragments: [
    {
      body: 'State the concrete outcome first.',
      id: 'goal-ok',
      label: 'Goal fragment',
    },
    {
      body: 'Keep the change inside the current module.',
      id: 'boundary-ok',
      label: 'Boundary fragment',
    },
    {
      body: 'Run the named unit command.',
      feedback: 'Hidden proof feedback',
      id: 'proof-ok',
      label: 'Hidden proof fragment',
    },
    {
      body: 'Rewrite nearby architecture while you are here.',
      feedback: 'Wide answer feedback',
      id: 'wide-answer',
      label: 'Wide answer',
      trapId: 'too-broad',
      trapLabel: 'Too broad',
    },
  ],
  id: 'prompt-contract',
  kind: 'prompt-assembly',
  slots: [
    {
      acceptedFragmentIds: ['goal-ok'],
      id: 'goal',
      label: 'Goal',
    },
    {
      acceptedFragmentIds: ['boundary-ok'],
      id: 'boundary',
      label: 'Boundary',
    },
    {
      acceptedFragmentIds: ['proof-ok'],
      id: 'proof',
      label: 'Proof',
    },
  ],
}

const pairMatchingMission: PairMatchingMission = {
  ...missionCopy,
  failureFeedback: 'Pairs need another pass.',
  id: 'carrier-match',
  items: [
    {
      acceptedTargetIds: ['always-on-rule'],
      description: 'Never paste raw production logs with PII.',
      feedback: 'This is a durable safety boundary, not a task note.',
      id: 'pii-safety',
      label: 'PII safety rule',
      trapId: 'sensitive-data',
      trapLabel: 'Sensitive data',
    },
    {
      acceptedTargetIds: ['skill'],
      description: 'Run visual QA with route, viewport and console checks.',
      feedback: 'A repeatable procedure belongs in a skill draft.',
      id: 'browser-qa',
      label: 'Browser QA procedure',
    },
    {
      acceptedTargetIds: ['discard'],
      description: 'A lucky wording from one chat.',
      feedback: 'A lucky phrase is not reusable enough to preserve.',
      id: 'lucky-prompt',
      label: 'Lucky prompt phrasing',
      trapId: 'personal-magic',
      trapLabel: 'Personal magic',
    },
  ],
  kind: 'pair-matching',
  targets: [
    {
      description: 'Durable safety or operating boundary.',
      id: 'always-on-rule',
      label: 'Always-on rule',
    },
    {
      description: 'Repeatable procedure with inputs and verification.',
      id: 'skill',
      label: 'Skill',
    },
    {
      description: 'Do not preserve as durable instruction.',
      id: 'discard',
      label: 'Discard',
    },
  ],
}

const pairMatchingBossMission: BossFightMission = {
  ...missionCopy,
  failureFeedback: 'Boss failed.',
  id: 'instruction-drift',
  kind: 'boss-fight',
  passingScore: 100,
  rounds: [pairMatchingMission],
  successFeedback: 'Boss cleared.',
}

describe('evaluateMission', () => {
  it('accepts a successful scenario decision', () => {
    const result = evaluateMission(scenarioMission, 'review-before-merge')

    expect(result).toMatchObject({
      feedback: 'Accepted.',
      isCorrect: true,
      score: 100,
    })
    expect(result.answerDetails).toEqual([
      expect.objectContaining({
        id: 'review-before-merge',
        status: 'correct',
      }),
    ])
    expect(getEncounteredTrapIdsFromEvaluation(result)).toEqual([])
  })

  it('records selected trap details for a failed scenario decision', () => {
    const result = evaluateMission(scenarioMission, 'skip-review')

    expect(result).toMatchObject({
      feedback: 'Skipped checks leak risk.',
      isCorrect: false,
      score: 0,
    })
    expect(result.answerDetails).toEqual([
      expect.objectContaining({
        id: 'skip-review',
        status: 'trap',
        trapId: 'weak-test',
        trapLabel: 'Weak test',
      }),
    ])
    expect(getEncounteredTrapIdsFromEvaluation(result)).toEqual(['weak-test'])
  })

  it('does not leak missing correct prompt fragments on retry', () => {
    const result = evaluateMission(promptAssemblyMission, {
      boundary: 'boundary-ok',
      goal: 'wide-answer',
    })
    const details = JSON.stringify(result.answerDetails)

    expect(result).toMatchObject({
      isCorrect: false,
      score: 33,
    })
    expect(result.answerDetails).toHaveLength(1)
    expect(details).toContain('Wide answer feedback')
    expect(details).not.toContain('Hidden proof fragment')
    expect(details).not.toContain('Hidden proof feedback')
    expect(getEncounteredTrapIdsFromEvaluation(result)).toEqual(['too-broad'])
  })

  it('accepts a complete pair matching answer', () => {
    const result = evaluateMission(pairMatchingMission, {
      'browser-qa': 'skill',
      'lucky-prompt': 'discard',
      'pii-safety': 'always-on-rule',
    })

    expect(result).toMatchObject({
      feedback: 'Accepted.',
      isCorrect: true,
      score: 100,
    })
    expect(result.answerDetails).toBeUndefined()
  })

  it('scores partial pair matching answers by matched items', () => {
    const result = evaluateMission(pairMatchingMission, {
      'browser-qa': 'skill',
    })

    expect(result).toMatchObject({
      isCorrect: false,
      score: 33,
    })
    expect(result.answerDetails).toBeUndefined()
  })

  it('reports only selected wrong pair matching items without leaking the correct map', () => {
    const result = evaluateMission(pairMatchingMission, {
      'browser-qa': 'skill',
      'lucky-prompt': 'always-on-rule',
      'pii-safety': 'always-on-rule',
    })
    const details = JSON.stringify(result.answerDetails)

    expect(result).toMatchObject({
      feedback: 'Pairs need another pass.',
      isCorrect: false,
      score: 67,
    })
    expect(result.answerDetails).toEqual([
      expect.objectContaining({
        id: 'lucky-prompt',
        status: 'trap',
        trapId: 'personal-magic',
        trapLabel: 'Personal magic',
      }),
    ])
    expect(details).toContain('A lucky phrase is not reusable enough to preserve.')
    expect(details).not.toContain('discard')
    expect(details).not.toContain('Discard')
    expect(getEncounteredTrapIdsFromEvaluation(result)).toEqual([
      'personal-magic',
    ])
  })

  it('treats missing pair matching targets as incomplete without revealing details', () => {
    const result = evaluateMission(pairMatchingMission, {
      'browser-qa': 'skill',
      'lucky-prompt': null,
      'pii-safety': 'always-on-rule',
    })

    expect(result).toMatchObject({
      isCorrect: false,
      score: 67,
    })
    expect(result.answerDetails).toBeUndefined()
  })

  it('evaluates pair matching inside boss rounds', () => {
    const result = evaluateMission(pairMatchingBossMission, {
      'carrier-match': {
        'browser-qa': 'skill',
        'lucky-prompt': 'discard',
        'pii-safety': 'always-on-rule',
      },
    })

    expect(result).toMatchObject({
      feedback: 'Boss cleared.',
      isCorrect: true,
      score: 100,
    })
    expect(result.roundResults).toEqual([
      expect.objectContaining({
        isCorrect: true,
        roundId: 'carrier-match',
        score: 100,
      }),
    ])
  })

  it('projects pair matching missions without authored answer keys or trap metadata', () => {
    const chapter: Chapter = {
      artifact: {
        description: 'Artifact',
        fileName: 'ai-pr-self-review.md',
        id: 'ai-pr-self-review',
        title: 'Artifact',
      },
      badgeName: 'Badge',
      boss: pairMatchingBossMission,
      id: 'chapter-1',
      missions: [pairMatchingMission],
      order: 1,
      rankAfterCompletion: 'Rank',
      recap: {
        commonTrap: {
          note: 'Trap note',
          trapId: 'too-broad',
        },
        nextMove: 'Next',
        rules: ['Rule'],
      },
      reward: {
        applyTomorrow: 'Apply',
        emblem: 'E',
        masteryActions: ['One', 'Two'],
        motif: 'Motif',
        motto: 'Motto',
        nextTeaser: 'Next',
        skill: 'Skill',
      },
      summary: 'Summary',
      title: 'Chapter',
    }
    const publicChapter = projectChapterToPublic(chapter)
    const publicMission = publicChapter.missions[0]

    expect(publicMission?.kind).toBe('pair-matching')
    if (publicMission?.kind !== 'pair-matching') {
      throw new Error('pair matching projection expected')
    }

    expect(publicMission.items).toEqual([
      {
        description: 'Never paste raw production logs with PII.',
        id: 'pii-safety',
        label: 'PII safety rule',
      },
      {
        description: 'Run visual QA with route, viewport and console checks.',
        id: 'browser-qa',
        label: 'Browser QA procedure',
      },
      {
        description: 'A lucky wording from one chat.',
        id: 'lucky-prompt',
        label: 'Lucky prompt phrasing',
      },
    ])
    expect(JSON.stringify(publicMission)).not.toContain('acceptedTargetIds')
    expect(JSON.stringify(publicMission)).not.toContain('trapId')
    expect(JSON.stringify(publicMission)).not.toContain('trapLabel')
    expect(JSON.stringify(publicMission)).not.toContain(
      'A repeatable procedure belongs in a skill draft.',
    )
  })
})
