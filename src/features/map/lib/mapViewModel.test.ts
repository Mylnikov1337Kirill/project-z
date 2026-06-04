import { describe, expect, it } from 'vitest'
import type {
  ChapterProgress,
  PublicChapter,
  PublicScenarioDecisionMission,
} from '../../../shared/types/domain'
import {
  getLandmarkPosition,
  getPlayerAvatarPosition,
  getRoutePoints,
  getInitialMapChapter,
  getLatestCompletedChapter,
  getSelectedChapterDetails,
  isMapRouteCompleted,
  landmarkPeekOffsets,
  landmarkPositions,
  nodePositions,
} from './mapViewModel'

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

function createChapter(
  order: number,
  overrides: Partial<PublicChapter> = {},
): PublicChapter {
  const id = overrides.id ?? `chapter-${order}`

  return {
    badgeName: `Badge ${order}`,
    boss: createMission(`${id}-boss`),
    id,
    missions: [createMission(`${id}-mission`)],
    order,
    rankAfterCompletion: `Rank ${order}`,
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
    title: `Chapter ${order}`,
    ...overrides,
  }
}

function createCompletedProgress(
  chapters: PublicChapter[],
): ChapterProgress[] {
  return chapters.map((chapter) => ({
    chapterId: chapter.id,
    completedMissionIds: [chapter.missions[0]?.id, chapter.boss.id].filter(
      (missionId): missionId is string => typeof missionId === 'string',
    ),
    status: 'completed',
  }))
}

function toProgressByChapter(progress: ChapterProgress[]) {
  return new Map(progress.map((item) => [item.chapterId, item]))
}

describe('map view model', () => {
  it('keeps the visible route model aligned to the eight-chapter catalog', () => {
    const expectedNodePositions = [
      { x: 14, y: 68 },
      { x: 27, y: 48 },
      { x: 40, y: 61 },
      { x: 53, y: 39 },
      { x: 65, y: 54 },
      { x: 77, y: 38 },
      { x: 87, y: 55 },
      { x: 94, y: 29 },
    ]
    const expectedLandmarkPositions = [
      { x: 5.6, y: 78.2 },
      { x: 23.4, y: 61.4 },
      { x: 31.6, y: 71.4 },
      { x: 49.3, y: 52.5 },
      { x: 56.5, y: 67.4 },
      { x: 73.2, y: 49.3 },
      { x: 78.7, y: 65.5 },
      { x: 90.1, y: 42.3 },
    ]

    expect(nodePositions).toHaveLength(8)
    expect(landmarkPositions).toHaveLength(nodePositions.length)
    expect(nodePositions).toEqual(expectedNodePositions)
    expect(landmarkPositions).toEqual(expectedLandmarkPositions)
    expect(
      nodePositions.map((position, index) =>
        getLandmarkPosition(position, index),
      ),
    ).toEqual(expectedLandmarkPositions)
    expect(getRoutePoints()).toBe(
      '14,68 27,48 40,61 53,39 65,54 77,38 87,55 94,29',
    )
    const actualPeekOffsets = landmarkPositions.map((position, index) => {
      const avatarPosition = getPlayerAvatarPosition(nodePositions[index])

      return {
        x: Number((position.x - avatarPosition.x).toFixed(1)),
        y: Number((position.y - avatarPosition.y).toFixed(1)),
      }
    })
    const peekQuadrants = new Set(
      actualPeekOffsets.map(
        (offset) => `${Math.sign(offset.x)},${Math.sign(offset.y)}`,
      ),
    )

    expect(actualPeekOffsets).toEqual(landmarkPeekOffsets)
    expect(peekQuadrants).toEqual(new Set(['-1,-1', '1,1', '-1,1', '1,-1']))
    expect(
      actualPeekOffsets.every(
        (offset) => Math.abs(offset.x) <= 2.5 && Math.abs(offset.y) <= 1.8,
      ),
    ).toBe(true)
    expect(getPlayerAvatarPosition(nodePositions[0])).toEqual({
      x: 8,
      y: 80,
    })
  })

  it('opens a completed route without defaulting the mentor prompt to chapter 1', () => {
    const chapters = Array.from({ length: 8 }, (_, index) => {
      const order = index + 1

      if (order === 1) {
        return createChapter(order, {
          badgeName: 'Ответственный автор',
          title: 'ИИ как инженерный инструмент',
        })
      }

      if (order === 8) {
        return createChapter(order, {
          badgeName: 'Сценарий оформлен',
          title: 'Финальный playbook',
        })
      }

      return createChapter(order)
    })
    const progress = createCompletedProgress(chapters)
    const progressByChapter = toProgressByChapter(progress)

    expect(isMapRouteCompleted(chapters, progressByChapter)).toBe(true)
    expect(getInitialMapChapter({ chapters, progressByChapter })).toBeNull()
    expect(getLatestCompletedChapter(chapters, progressByChapter)).toBe(
      chapters[7],
    )

    const details = getSelectedChapterDetails({
      chapter: null,
      isRouteCompleted: true,
      progress,
      progressByChapter,
      revealedChapterId: null,
    })

    expect(details.mentorPrompt.title).toBe('Маршрут закрыт')
    expect(details.mentorPrompt.copy).toContain('архив')
    expect(details.mentorPrompt.title).not.toContain('Ответственный автор')
    expect(details.mentorPrompt.copy).not.toContain(
      'ИИ как инженерный инструмент',
    )
  })

  it('keeps completed chapter reward copy for an explicit chapter selection', () => {
    const chapters = [
      createChapter(1, {
        badgeName: 'Ответственный автор',
        title: 'ИИ как инженерный инструмент',
      }),
      createChapter(2),
    ]
    const progress = createCompletedProgress(chapters)
    const progressByChapter = toProgressByChapter(progress)

    const details = getSelectedChapterDetails({
      chapter: chapters[0],
      isRouteCompleted: true,
      progress,
      progressByChapter,
      revealedChapterId: null,
    })

    expect(details.mentorPrompt.title).toBe(
      'Награда получена: «Ответственный автор»',
    )
    expect(details.mentorPrompt.copy).toContain('ИИ как инженерный инструмент')
  })
})
