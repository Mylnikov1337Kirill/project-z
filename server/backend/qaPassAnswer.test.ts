import { describe, expect, it } from 'vitest'
import { chapters } from '../../src/entities/chapter/model/chapterCatalog'
import { evaluateMission } from '../../src/entities/mission/lib/missionEngine'
import type { Mission } from '../../src/shared/types/domain'
import { createQaPassAnswer } from './qaPassAnswer'

function getCatalogMissions() {
  return chapters.flatMap((chapter) => [
    ...chapter.missions.map((mission) => ({
      chapterId: chapter.id,
      mission,
    })),
    {
      chapterId: chapter.id,
      mission: chapter.boss,
    },
  ])
}

describe('createQaPassAnswer', () => {
  it('generates passing server-only answers for every private catalog mission', () => {
    const failures: string[] = []
    const catalogMissions = getCatalogMissions()

    for (const { chapterId, mission } of catalogMissions) {
      try {
        const answer = createQaPassAnswer(mission)
        const evaluation = evaluateMission(mission, answer)

        if (!evaluation.isCorrect) {
          failures.push(`${chapterId}/${mission.id}: evaluated as not passing`)
        }

        if (mission.kind === 'boss-fight') {
          const failedRounds =
            evaluation.roundResults
              ?.filter((round) => !round.isCorrect)
              .map((round) => round.roundId) ?? []

          if (failedRounds.length > 0) {
            failures.push(
              `${chapterId}/${mission.id}: failed rounds ${failedRounds.join(
                ', ',
              )}`,
            )
          }
        }
      } catch (error) {
        failures.push(
          `${chapterId}/${mission.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }

    expect(failures).toEqual([])
    expect(catalogMissions.length).toBeGreaterThan(0)
  })

  it('uses each prompt fragment at most once across required slots', () => {
    const mission: Mission = {
      brief: {
        reviewableResult: 'Patch with a focused check.',
        risk: 'A reused fragment hides a missing contract part.',
        teamWants: 'A deterministic prompt contract.',
      },
      failureFeedback: 'Try again.',
      fragments: [
        {
          body: 'Covers the goal.',
          id: 'goal',
          label: 'Goal',
        },
        {
          body: 'Covers the boundary.',
          id: 'boundary',
          label: 'Boundary',
        },
      ],
      id: 'prompt-no-duplicate-reuse',
      kind: 'prompt-assembly',
      mentorHint: 'Pick unique fragments.',
      prompt: 'Assemble the contract.',
      slots: [
        {
          acceptedFragmentIds: ['goal'],
          id: 'goal-slot',
          label: 'Goal slot',
        },
        {
          acceptedFragmentIds: ['goal', 'boundary'],
          id: 'boundary-slot',
          label: 'Boundary slot',
        },
      ],
      successFeedback: 'Accepted.',
      title: 'Prompt assembly',
    }

    const answer = createQaPassAnswer(mission)

    expect(answer).toEqual({
      'boundary-slot': 'boundary',
      'goal-slot': 'goal',
    })
    expect(evaluateMission(mission, answer).isCorrect).toBe(true)
  })
})
