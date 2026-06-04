import { describe, expect, it } from 'vitest'
import type { BackendApi } from '../http/backendApiClient'
import type {
  ChapterProgress,
  ChapterReflection,
  LeaderboardEntry,
  Learner,
} from '../../types/domain'
import { HttpProgressRepository } from './httpProgressRepository'

const learner: Learner = {
  fullName: 'Backend Learner',
  id: 'learner-1',
  nickname: 'backend-learner',
}

const progress: ChapterProgress[] = [
  {
    chapterId: 'chapter-1',
    completedMissionIds: ['who-owns-the-diff'],
    status: 'open',
  },
]

const reflection: ChapterReflection = {
  chapterId: 'chapter-1',
  note: 'Проверю ближайший пул-реквест.',
  optionId: 'review',
  optionLabel: 'В ближайшем ревью',
  skipped: false,
  updatedAt: '2026-06-01T10:00:00.000Z',
}

const leaderboardEntry: LeaderboardEntry = {
  closedChaptersCount: 1,
  currentRank: 'Diff Owner',
  fullName: '',
  lastBadgeDate: '2026-06-01T10:00:00.000Z',
  lastBadgeName: 'Ответственный автор',
  learnerId: learner.id,
  nickname: learner.nickname,
}

function createApi() {
  const calls: { body?: unknown; method: 'GET' | 'POST'; path: string }[] = []
  const api: BackendApi = {
    get: async <TResponse,>(path: string) => {
      calls.push({ method: 'GET', path })

      if (path === '/api/me') {
        return {
          learner: null,
          pilotSession: null,
        } as TResponse
      }

      if (path === '/api/progress') {
        return {
          encounteredTrapIds: ['confident-report'],
          learner,
          pendingUnlockChapterId: 'chapter-2',
          progress,
        } as TResponse
      }

      if (path === '/api/traps/discovered') {
        return { trapIds: ['confident-report'] } as TResponse
      }

      if (path === '/api/chapter-reflections/chapter-1') {
        return { reflection } as TResponse
      }

      if (path === '/api/leaderboard') {
        return { entries: [leaderboardEntry] } as TResponse
      }

      throw new Error(`Unexpected GET ${path}`)
    },
    post: async <TResponse,>(path: string, body?: unknown) => {
      calls.push({ body, method: 'POST', path })

      if (path === '/api/pilot-sessions') {
        return { pilotSession: { id: 'session-1' } } as TResponse
      }

      if (path === '/api/learners/identify') {
        return { learner } as TResponse
      }

      if (path === '/api/chapter-reflections/chapter-1') {
        return { reflection } as TResponse
      }

      if (path === '/api/unlocks/chapter-2/seen') {
        return { progress } as TResponse
      }

      throw new Error(`Unexpected POST ${path}`)
    },
  }

  return { api, calls }
}

describe('HttpProgressRepository', () => {
  it('identifies through the backend session/profile endpoints', async () => {
    const { api, calls } = createApi()
    const repository = new HttpProgressRepository(api)

    await expect(
      repository.identify({
        fullName: 'Backend Learner',
        nickname: 'backend-learner',
      }),
    ).resolves.toEqual(learner)

    expect(calls).toEqual([
      { method: 'GET', path: '/api/me' },
      { body: undefined, method: 'POST', path: '/api/pilot-sessions' },
      {
        body: {
          fullName: 'Backend Learner',
          nickname: 'backend-learner',
        },
        method: 'POST',
        path: '/api/learners/identify',
      },
    ])
  })

  it('loads backend progress, traps, unlocks, reflections, and leaderboard', async () => {
    const { api, calls } = createApi()
    const repository = new HttpProgressRepository(api)

    await expect(repository.getProgress(learner.id)).resolves.toEqual(progress)
    await expect(repository.getEncounteredTrapIds(learner.id)).resolves.toEqual(
      ['confident-report'],
    )
    await expect(repository.getPendingChapterUnlock(learner.id)).resolves.toBe(
      'chapter-2',
    )
    await expect(
      repository.getChapterReflection({
        chapterId: 'chapter-1',
        learnerId: learner.id,
      }),
    ).resolves.toEqual(reflection)
    await expect(repository.getLeaderboard()).resolves.toEqual([
      leaderboardEntry,
    ])

    expect(calls).toEqual([
      { method: 'GET', path: '/api/progress' },
      { method: 'GET', path: '/api/traps/discovered' },
      { method: 'GET', path: '/api/progress' },
      { method: 'GET', path: '/api/chapter-reflections/chapter-1' },
      { method: 'GET', path: '/api/leaderboard' },
    ])
  })

  it('saves reflection and unlock-seen writes through backend endpoints', async () => {
    const { api, calls } = createApi()
    const repository = new HttpProgressRepository(api)

    await expect(
      repository.saveChapterReflection({
        chapterId: 'chapter-1',
        learnerId: learner.id,
        note: reflection.note,
        optionId: reflection.optionId,
        optionLabel: reflection.optionLabel,
        skipped: false,
      }),
    ).resolves.toEqual(reflection)
    await repository.markChapterUnlockSeen({
      chapterId: 'chapter-2',
      learnerId: learner.id,
    })

    expect(calls).toEqual([
      {
        body: {
          note: reflection.note,
          optionId: reflection.optionId,
          optionLabel: reflection.optionLabel,
          skipped: false,
        },
        method: 'POST',
        path: '/api/chapter-reflections/chapter-1',
      },
      {
        body: undefined,
        method: 'POST',
        path: '/api/unlocks/chapter-2/seen',
      },
    ])
  })
})
