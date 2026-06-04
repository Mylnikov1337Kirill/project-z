import { describe, expect, it } from 'vitest'
import type {
  ChapterProgress,
  PublicChapter,
  PublicMission,
  PublicScenarioDecisionMission,
} from '../../../shared/types/domain'
import {
  canOpenMission,
  getCurrentRank,
  getMissionListItemState,
  getNextPlayableMission,
  resolveChapterStatus,
} from './chapterProgress'

function createMission(id: string): PublicScenarioDecisionMission {
  return {
    failureFeedback: 'Try again.',
    id,
    kind: 'scenario-decision',
    mentorHint: 'Pick the reviewable answer.',
    options: [
      {
        id: `${id}-correct`,
        label: 'Correct',
      },
    ],
    prompt: 'Choose a move.',
    successFeedback: 'Accepted.',
    title: id,
  }
}

function createChapter(input: {
  boss?: PublicMission
  id: string
  missions?: PublicMission[]
  order: number
}): PublicChapter {
  return {
    badgeName: `Badge ${input.order}`,
    boss: input.boss ?? createMission(`${input.id}-boss`),
    id: input.id,
    missions: input.missions ?? [createMission(`${input.id}-mission`)],
    order: input.order,
    prep: {
      checklist: ['Read the brief'],
      mentorNote: 'Start small.',
      resources: [],
      summary: 'A short prep step.',
      title: 'Prep',
    },
    rankAfterCompletion: `Rank ${input.order}`,
    recap: {
      commonTrap: {
        note: 'Too much scope.',
        trapId: 'too-broad',
      },
      nextMove: 'Name the next check.',
      rules: ['Keep changes focused.'],
    },
    reward: {
      applyTomorrow: 'Use a smaller patch.',
      emblem: 'badge',
      masteryActions: ['Name scope', 'Verify result'],
      motif: 'focus',
      motto: 'Small and reviewable.',
      nextTeaser: 'Next chapter',
      skill: 'Scoped delivery',
    },
    summary: 'Keep changes focused.',
    title: `Chapter ${input.order}`,
  }
}

describe('chapter progress rules', () => {
  it('derives rank from the contiguous completed route prefix', () => {
    const chapters = [
      createChapter({ id: 'chapter-1', order: 1 }),
      createChapter({ id: 'chapter-5', order: 2 }),
      createChapter({ id: 'chapter-2', order: 3 }),
    ]

    expect(
      getCurrentRank(chapters, [
        {
          chapterId: 'chapter-1',
          completedMissionIds: [],
          status: 'completed',
        },
        {
          chapterId: 'chapter-5',
          completedMissionIds: [],
          status: 'open',
        },
        {
          chapterId: 'chapter-2',
          completedMissionIds: [],
          status: 'completed',
        },
      ]),
    ).toBe('Rank 1')
  })

  it('derives default chapter statuses from order and stored progress', () => {
    const firstChapter = createChapter({ id: 'chapter-1', order: 1 })
    const secondChapter = createChapter({ id: 'chapter-2', order: 2 })
    const thirdChapter = createChapter({ id: 'chapter-3', order: 3 })
    const progressByChapter = new Map<string, ChapterProgress>([
      [
        'chapter-2',
        {
          chapterId: 'chapter-2',
          completedMissionIds: [],
          status: 'open',
        },
      ],
    ])

    expect(resolveChapterStatus(firstChapter, new Map())).toBe('open')
    expect(resolveChapterStatus(secondChapter, progressByChapter)).toBe('open')
    expect(resolveChapterStatus(thirdChapter, progressByChapter)).toBe('locked')
  })

  it('opens missions in sequence without skipping ahead', () => {
    const firstMission = createMission('mission-1')
    const secondMission = createMission('mission-2')
    const boss = createMission('boss')
    const chapter = createChapter({
      boss,
      id: 'chapter-1',
      missions: [firstMission, secondMission],
      order: 1,
    })
    const noCompletedMissions = new Set<string>()
    const firstMissionCompleted = new Set([firstMission.id])

    expect(getNextPlayableMission(chapter, noCompletedMissions)?.id).toBe(
      firstMission.id,
    )
    expect(
      canOpenMission(chapter, firstMission.id, noCompletedMissions, 'open'),
    ).toBe(true)
    expect(
      canOpenMission(chapter, secondMission.id, noCompletedMissions, 'open'),
    ).toBe(false)
    expect(canOpenMission(chapter, boss.id, firstMissionCompleted, 'open')).toBe(
      false,
    )
    expect(
      getMissionListItemState({
        chapter,
        completedMissionIds: firstMissionCompleted,
        mission: secondMission,
        nextMission: getNextPlayableMission(chapter, firstMissionCompleted),
        status: 'open',
      }),
    ).toBe('current')
  })

  it('allows every mission to be revisited after chapter completion', () => {
    const firstMission = createMission('mission-1')
    const boss = createMission('boss')
    const chapter = createChapter({
      boss,
      id: 'chapter-1',
      missions: [firstMission],
      order: 1,
    })

    expect(canOpenMission(chapter, boss.id, new Set(), 'completed')).toBe(true)
    expect(
      getMissionListItemState({
        chapter,
        completedMissionIds: new Set(),
        mission: firstMission,
        nextMission: getNextPlayableMission(chapter, new Set()),
        status: 'completed',
      }),
    ).toBe('open')
  })
})
