import { describe, expect, it } from 'vitest'
import type { PublicChapter } from '../../../shared/types/domain'
import { isCourseCompleted } from './courseCloseout'

function createChapter(id: string, order: number): PublicChapter {
  return { id, order } as PublicChapter
}

const eightChapterCourse = [
  createChapter('chapter-1', 1),
  createChapter('chapter-2', 2),
  createChapter('chapter-3', 3),
  createChapter('chapter-4', 4),
  createChapter('chapter-5', 5),
  createChapter('chapter-6', 6),
  createChapter('chapter-7', 7),
  createChapter('chapter-8', 8),
]

describe('isCourseCompleted', () => {
  it('does not treat an empty course as completed', () => {
    expect(isCourseCompleted({ chapters: [], progress: [] })).toBe(false)
  })

  it('requires every chapter to be completed', () => {
    const chapters = [
      createChapter('chapter-1', 1),
      createChapter('chapter-2', 2),
    ]

    expect(
      isCourseCompleted({
        chapters,
        progress: [
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
        ],
      }),
    ).toBe(false)
    expect(
      isCourseCompleted({
        chapters,
        progress: chapters.map((chapter) => ({
          chapterId: chapter.id,
          completedMissionIds: ['mission-1'],
          status: 'completed' as const,
        })),
      }),
    ).toBe(true)
  })

  it('requires the current Rules & Skills row in the 8-chapter course', () => {
    const completedWithoutRulesSkills = eightChapterCourse
      .filter((chapter) => chapter.id !== 'chapter-5')
      .map((chapter) => ({
        chapterId: chapter.id,
        completedMissionIds: ['boss'],
        status: 'completed' as const,
      }))

    expect(
      isCourseCompleted({
        chapters: eightChapterCourse,
        progress: [
          ...completedWithoutRulesSkills,
          {
            chapterId: 'chapter-5',
            completedMissionIds: [],
            status: 'open',
          },
        ],
      }),
    ).toBe(false)
    expect(
      isCourseCompleted({
        chapters: eightChapterCourse,
        progress: [
          ...completedWithoutRulesSkills,
          {
            chapterId: 'chapter-5',
            completedMissionIds: ['instruction-drift'],
            status: 'completed',
          },
        ],
      }),
    ).toBe(true)
  })
})
