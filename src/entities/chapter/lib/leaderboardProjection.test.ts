import { describe, expect, it } from 'vitest'
import { projectLeaderboard, type LeaderboardChapter } from './leaderboardProjection'

const chapters: LeaderboardChapter[] = [
  {
    badgeName: 'Badge One',
    id: 'chapter-1',
    order: 1,
    rankAfterCompletion: 'Rank One',
  },
  {
    badgeName: 'Badge Two',
    id: 'chapter-2',
    order: 2,
    rankAfterCompletion: 'Rank Two',
  },
]

describe('leaderboard projection', () => {
  it('returns no entries before learner identity exists', () => {
    expect(
      projectLeaderboard({
        chapters,
        completions: [],
        learner: null,
        progress: [],
      }),
    ).toEqual([])
  })

  it('projects learner progress, current rank, and latest badge date', () => {
    expect(
      projectLeaderboard({
        chapters,
        completions: [
          {
            chapterId: 'chapter-1',
            completedAt: '2026-06-01T10:00:00.000Z',
            completedChapters: 1,
            learnerId: 'learner-1',
          },
          {
            chapterId: 'chapter-2',
            completedAt: '2026-06-01T11:00:00.000Z',
            completedChapters: 2,
            learnerId: 'learner-1',
          },
        ],
        learner: {
          fullName: 'Casey Reviewer',
          id: 'learner-1',
          nickname: 'casey',
        },
        progress: [
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
        ],
      }),
    ).toEqual([
      {
        closedChaptersCount: 2,
        currentRank: 'Rank Two',
        fullName: 'Casey Reviewer',
        lastBadgeDate: '2026-06-01T11:00:00.000Z',
        lastBadgeName: 'Badge Two',
        learnerId: 'learner-1',
        nickname: 'casey',
      },
    ])
  })
})
