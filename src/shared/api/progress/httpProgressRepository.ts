import type {
  ChapterProgress,
  ChapterReflection,
  LeaderboardEntry,
  Learner,
  TrapConceptId,
} from '../../types/domain'
import type { BackendApi } from '../http/backendApiClient'
import { backendApiClient } from '../http/backendApiClient'
import type {
  ProgressRepository,
  SaveChapterReflectionInput,
} from './ProgressRepository'

type MeResponse = {
  learner: Learner | null
  pilotSession: unknown | null
}

type ProgressResponse = {
  encounteredTrapIds: TrapConceptId[]
  learner: Learner
  pendingUnlockChapterId: string | null
  progress: ChapterProgress[]
}

type ChapterReflectionResponse = {
  reflection: ChapterReflection | null
}

type LeaderboardResponse = {
  entries: LeaderboardEntry[]
}

type TrapDiscoveryResponse = {
  trapIds: TrapConceptId[]
}

export class HttpProgressRepository implements ProgressRepository {
  private readonly api: BackendApi

  constructor(api: BackendApi = backendApiClient) {
    this.api = api
  }

  async getLearner() {
    const response = await this.api.get<MeResponse>('/api/me')

    return response.learner
  }

  async identify(input: { nickname: string; fullName: string }) {
    const currentSession = await this.api.get<MeResponse>('/api/me')

    if (!currentSession.pilotSession) {
      await this.api.post('/api/pilot-sessions')
    }

    const response = await this.api.post<{ learner: Learner }>(
      '/api/learners/identify',
      input,
    )

    return response.learner
  }

  async getProgress(_learnerId: string) {
    void _learnerId

    const response = await this.api.get<ProgressResponse>('/api/progress')

    return response.progress
  }

  async getEncounteredTrapIds(_learnerId: string) {
    void _learnerId

    const response = await this.api.get<TrapDiscoveryResponse>(
      '/api/traps/discovered',
    )

    return response.trapIds
  }

  async getChapterReflection(input: {
    learnerId: string
    chapterId: string
  }) {
    void input.learnerId

    const response = await this.api.get<ChapterReflectionResponse>(
      `/api/chapter-reflections/${encodeURIComponent(input.chapterId)}`,
    )

    return response.reflection
  }

  async saveChapterReflection(input: SaveChapterReflectionInput) {
    const response = await this.api.post<{ reflection: ChapterReflection }>(
      `/api/chapter-reflections/${encodeURIComponent(input.chapterId)}`,
      {
        note: input.note,
        optionId: input.optionId,
        optionLabel: input.optionLabel,
        skipped: input.skipped,
      },
    )

    return response.reflection
  }

  async getPendingChapterUnlock(_learnerId: string) {
    void _learnerId

    const response = await this.api.get<ProgressResponse>('/api/progress')

    return response.pendingUnlockChapterId
  }

  async markChapterUnlockSeen(input: {
    learnerId: string
    chapterId: string
  }) {
    void input.learnerId

    await this.api.post(
      `/api/unlocks/${encodeURIComponent(input.chapterId)}/seen`,
    )
  }

  async getLeaderboard() {
    const response = await this.api.get<LeaderboardResponse>('/api/leaderboard')

    return response.entries
  }
}
