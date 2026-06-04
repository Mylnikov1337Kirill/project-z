import type {
  ChapterProgress,
  ChapterReflection,
  LeaderboardEntry,
  Learner,
  TrapConceptId,
} from '../../types/domain'

export type SaveChapterReflectionInput = {
  learnerId: string
  chapterId: string
  optionId: string | null
  optionLabel: string | null
  note: string
  skipped: boolean
}

export interface ProgressRepository {
  getLearner(): Promise<Learner | null>
  identify(input: { nickname: string; fullName: string }): Promise<Learner>
  getProgress(learnerId: string): Promise<ChapterProgress[]>
  getEncounteredTrapIds(learnerId: string): Promise<TrapConceptId[]>
  getChapterReflection(input: {
    learnerId: string
    chapterId: string
  }): Promise<ChapterReflection | null>
  saveChapterReflection(
    input: SaveChapterReflectionInput,
  ): Promise<ChapterReflection>
  getPendingChapterUnlock(learnerId: string): Promise<string | null>
  markChapterUnlockSeen(input: {
    learnerId: string
    chapterId: string
  }): Promise<void>
  getLeaderboard(): Promise<LeaderboardEntry[]>
}
