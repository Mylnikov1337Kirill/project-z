import { describe, expect, it } from 'vitest'
import type { LeaderboardEntry } from '../../../shared/types/domain'
import {
  formatBadgeReward,
  mergeCurrentLeaderboardEntry,
  sortLeaderboardEntries,
} from './leaderboardModel'

function createEntry(
  learnerId: string,
  overrides: Partial<LeaderboardEntry>,
): LeaderboardEntry {
  return {
    closedChaptersCount: 0,
    currentRank: 'New learner',
    fullName: learnerId,
    lastBadgeDate: null,
    lastBadgeName: null,
    learnerId,
    nickname: learnerId,
    ...overrides,
  }
}

const chapters = [
  {
    badgeName: 'Ответственный автор',
    id: 'chapter-1',
    order: 1,
    rankAfterCompletion: 'Diff Owner',
  },
  {
    badgeName: 'Чёткий бриф',
    id: 'chapter-2',
    order: 2,
    rankAfterCompletion: 'Brief Boss',
  },
  {
    badgeName: 'План перед изменениями',
    id: 'chapter-3',
    order: 3,
    rankAfterCompletion: 'Mission Planner',
  },
  {
    badgeName: 'Контекст собран',
    id: 'chapter-4',
    order: 4,
    rankAfterCompletion: 'Context DJ',
  },
  {
    badgeName: 'Куратор инструкций',
    id: 'chapter-5',
    order: 5,
    rankAfterCompletion: 'Agent Controller',
  },
  {
    badgeName: 'Контекст без шума',
    id: 'chapter-6',
    order: 6,
    rankAfterCompletion: 'Token Tamer',
  },
  {
    badgeName: 'Проверено делом',
    id: 'chapter-7',
    order: 7,
    rankAfterCompletion: 'Trust But Tester',
  },
  {
    badgeName: 'Сценарий оформлен',
    id: 'chapter-8',
    order: 8,
    rankAfterCompletion: 'Playbook Crafter',
  },
]

function createCompletedProgress() {
  return chapters.map((chapter) => ({
    chapterId: chapter.id,
    completedMissionIds: [],
    status: 'completed' as const,
  }))
}

describe('sortLeaderboardEntries', () => {
  it('sorts by closed chapters and then by latest badge date', () => {
    const entries = [
      createEntry('two-old', {
        closedChaptersCount: 2,
        lastBadgeDate: '2026-05-01T10:00:00.000Z',
      }),
      createEntry('one-new', {
        closedChaptersCount: 1,
        lastBadgeDate: '2026-06-01T10:00:00.000Z',
      }),
      createEntry('two-new', {
        closedChaptersCount: 2,
        lastBadgeDate: '2026-06-01T10:00:00.000Z',
      }),
      createEntry('zero', {
        closedChaptersCount: 0,
        lastBadgeDate: null,
      }),
    ]

    expect(
      sortLeaderboardEntries(entries).map((entry) => entry.learnerId),
    ).toEqual(['two-new', 'two-old', 'one-new', 'zero'])
  })

  it('does not mutate the original entries', () => {
    const entries = [
      createEntry('first', { closedChaptersCount: 1 }),
      createEntry('second', { closedChaptersCount: 2 }),
    ]

    sortLeaderboardEntries(entries)

    expect(entries.map((entry) => entry.learnerId)).toEqual(['first', 'second'])
  })
})

describe('formatBadgeReward', () => {
  it('prefers the badge name over the badge date', () => {
    expect(
      formatBadgeReward({
        lastBadgeDate: '2026-06-01T10:00:00.000Z',
        lastBadgeName: 'Сценарий оформлен',
      }),
    ).toBe('Сценарий оформлен')
  })
})

describe('mergeCurrentLeaderboardEntry', () => {
  it('adds the current learner when backend rows omit a completed local route', () => {
    const entries = mergeCurrentLeaderboardEntry({
      chapters,
      entries: [
        createEntry('other', {
          closedChaptersCount: 3,
          currentRank: 'Mission Planner',
          lastBadgeDate: '2026-05-31T10:00:00.000Z',
        }),
      ],
      learner: {
        fullName: 'Codex Browser QA',
        id: 'current',
        nickname: 'CODEX-REGRESS-20260602',
      },
      progress: createCompletedProgress(),
    })

    expect(entries).toContainEqual({
      closedChaptersCount: 8,
      currentRank: 'Playbook Crafter',
      fullName: '',
      lastBadgeDate: null,
      lastBadgeName: 'Сценарий оформлен',
      learnerId: 'current',
      nickname: 'CODEX-REGRESS-20260602',
    })
    expect(sortLeaderboardEntries(entries)[0]?.learnerId).toBe('current')
  })

  it('replaces a stale backend row for the current learner', () => {
    const entries = mergeCurrentLeaderboardEntry({
      chapters,
      entries: [
        createEntry('current', {
          closedChaptersCount: 1,
          currentRank: 'Diff Owner',
          lastBadgeDate: '2026-06-01T10:00:00.000Z',
          lastBadgeName: 'Ответственный автор',
        }),
      ],
      learner: {
        fullName: 'Codex Browser QA',
        id: 'current',
        nickname: 'CODEX-REGRESS-20260602',
      },
      progress: createCompletedProgress(),
    })

    expect(entries).toEqual([
      expect.objectContaining({
        closedChaptersCount: 8,
        currentRank: 'Playbook Crafter',
        lastBadgeDate: null,
        lastBadgeName: 'Сценарий оформлен',
        learnerId: 'current',
      }),
    ])
  })
})
