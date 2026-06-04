import { describe, expect, it } from 'vitest'
import type {
  ChapterCompletion,
  ChapterProgress,
  MissionAttempt,
} from '../../../shared/types/domain'
import {
  applyMissionAttemptProgress,
  completeChapterProgress,
  createInitialProgress,
  deriveUnlockedProgress,
  normalizeProgress,
  type ProgressChapter,
} from './progressMutations'

const chapters: ProgressChapter[] = [
  { id: 'chapter-1', order: 1 },
  { id: 'chapter-2', order: 2 },
  { id: 'chapter-3', order: 3 },
]

const eightChapterCourse: ProgressChapter[] = [
  { id: 'chapter-1', order: 1 },
  { id: 'chapter-2', order: 2 },
  { id: 'chapter-3', order: 3 },
  { id: 'chapter-4', order: 4 },
  { id: 'chapter-5', order: 5 },
  { id: 'chapter-6', order: 6 },
  { id: 'chapter-7', order: 7 },
  { id: 'chapter-8', order: 8 },
]

function createAttempt(input: {
  chapterId?: string
  isCorrect?: boolean
  missionId?: string
}): MissionAttempt {
  return {
    answer: { value: 'answer' },
    chapterId: input.chapterId ?? 'chapter-1',
    clientAttemptId: `attempt-${input.missionId ?? 'mission-1'}`,
    contentVersion: 'test-content-v1',
    createdAt: '2026-06-01T10:00:00.000Z',
    isCorrect: input.isCorrect ?? true,
    learnerId: 'learner-1',
    missionId: input.missionId ?? 'mission-1',
    score: input.isCorrect === false ? 0 : 100,
  }
}

describe('progress mutations', () => {
  it('creates initial progress from ordered chapters', () => {
    expect(createInitialProgress(chapters)).toEqual([
      {
        chapterId: 'chapter-1',
        completedMissionIds: [],
        status: 'open',
      },
      {
        chapterId: 'chapter-2',
        completedMissionIds: [],
        status: 'locked',
      },
      {
        chapterId: 'chapter-3',
        completedMissionIds: [],
        status: 'locked',
      },
    ])
  })

  it('normalizes stored progress and derives unlocked chapters', () => {
    const storedProgress: ChapterProgress[] = [
      {
        chapterId: 'chapter-1',
        completedMissionIds: ['mission-1'],
        status: 'completed',
      },
    ]

    expect(normalizeProgress(chapters, storedProgress)).toEqual([
      {
        chapterId: 'chapter-1',
        completedMissionIds: ['mission-1'],
        status: 'completed',
      },
      {
        chapterId: 'chapter-2',
        completedMissionIds: [],
        status: 'open',
      },
      {
        chapterId: 'chapter-3',
        completedMissionIds: [],
        status: 'locked',
      },
    ])
  })

  it('adds a missing current chapter row without reinterpreting other ids', () => {
    const storedProgressWithMissingRulesSkills: ChapterProgress[] =
      eightChapterCourse
        .filter((chapter) => chapter.id !== 'chapter-5')
        .map((chapter) => ({
          chapterId: chapter.id,
          completedMissionIds: [`${chapter.id}-boss`],
          status: 'completed' as const,
        }))

    expect(
      normalizeProgress(
        eightChapterCourse,
        storedProgressWithMissingRulesSkills,
      ).map((item) => [item.chapterId, item.status]),
    ).toEqual([
      ['chapter-1', 'completed'],
      ['chapter-2', 'completed'],
      ['chapter-3', 'completed'],
      ['chapter-4', 'completed'],
      ['chapter-5', 'open'],
      ['chapter-6', 'completed'],
      ['chapter-7', 'completed'],
      ['chapter-8', 'completed'],
    ])
  })

  it('records successful mission completion idempotently', () => {
    const progress = createInitialProgress(chapters)
    const firstPass = applyMissionAttemptProgress(
      progress,
      createAttempt({ missionId: 'mission-1' }),
    )
    const replay = applyMissionAttemptProgress(
      firstPass,
      createAttempt({ missionId: 'mission-1' }),
    )

    expect(replay[0]?.completedMissionIds).toEqual(['mission-1'])
  })

  it('leaves completed missions unchanged after failed attempts', () => {
    const progress = applyMissionAttemptProgress(
      createInitialProgress(chapters),
      createAttempt({ missionId: 'mission-1' }),
    )

    expect(
      applyMissionAttemptProgress(
        progress,
        createAttempt({ isCorrect: false, missionId: 'mission-2' }),
      )[0]?.completedMissionIds,
    ).toEqual(['mission-1'])
  })

  it('completes a chapter and marks the next unlock as pending', () => {
    const result = completeChapterProgress({
      chapterId: 'chapter-1',
      chapters,
      completedAt: '2026-06-01T10:00:00.000Z',
      completions: [],
      learnerId: 'learner-1',
      pendingUnlockChapterId: null,
      progress: createInitialProgress(chapters),
    })

    expect(result.completion).toEqual({
      chapterId: 'chapter-1',
      completedAt: '2026-06-01T10:00:00.000Z',
      completedChapters: 1,
      learnerId: 'learner-1',
    })
    expect(result.pendingUnlockChapterId).toBe('chapter-2')
    expect(result.progress.map((item) => [item.chapterId, item.status])).toEqual(
      [
        ['chapter-1', 'completed'],
        ['chapter-2', 'open'],
        ['chapter-3', 'locked'],
      ],
    )
  })

  it('keeps chapter completion idempotent while replaying unlock derivation', () => {
    const existingCompletion: ChapterCompletion = {
      chapterId: 'chapter-1',
      completedAt: '2026-06-01T10:00:00.000Z',
      completedChapters: 1,
      learnerId: 'learner-1',
    }
    const progressMissingDerivedUnlock: ChapterProgress[] = [
      {
        chapterId: 'chapter-1',
        completedMissionIds: [],
        status: 'completed',
      },
      {
        chapterId: 'chapter-2',
        completedMissionIds: [],
        status: 'locked',
      },
    ]

    const result = completeChapterProgress({
      chapterId: 'chapter-1',
      chapters,
      completedAt: '2026-06-01T11:00:00.000Z',
      completions: [existingCompletion],
      learnerId: 'learner-1',
      pendingUnlockChapterId: null,
      progress: progressMissingDerivedUnlock,
    })

    expect(result.completion).toBe(existingCompletion)
    expect(result.completions).toEqual([existingCompletion])
    expect(result.pendingUnlockChapterId).toBeNull()
    expect(result.progress[1]?.status).toBe('open')
  })

  it('derives all pending unlocks from completed chapters', () => {
    expect(
      deriveUnlockedProgress(chapters, [
        {
          chapterId: 'chapter-1',
          completedMissionIds: [],
          status: 'completed',
        },
        {
          chapterId: 'chapter-2',
          completedMissionIds: [],
          status: 'completed',
        },
        {
          chapterId: 'chapter-3',
          completedMissionIds: [],
          status: 'locked',
        },
      ]).map((item) => [item.chapterId, item.status]),
    ).toEqual([
      ['chapter-1', 'completed'],
      ['chapter-2', 'completed'],
      ['chapter-3', 'open'],
    ])
  })
})
