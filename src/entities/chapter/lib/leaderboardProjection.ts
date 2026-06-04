import type {
  Chapter,
  ChapterCompletion,
  ChapterProgress,
  LeaderboardEntry,
  Learner,
} from '../../../shared/types/domain'
import { getCurrentRank } from './chapterProgress'

export type LeaderboardChapter = Pick<
  Chapter,
  'badgeName' | 'id' | 'order' | 'rankAfterCompletion'
>

export function projectLeaderboard(input: {
  chapters: readonly LeaderboardChapter[]
  completions: readonly ChapterCompletion[]
  learner: Learner | null
  progress: readonly ChapterProgress[]
}): LeaderboardEntry[] {
  if (!input.learner) {
    return []
  }

  const learnerCompletions = input.completions.filter(
    (completion) => completion.learnerId === input.learner?.id,
  )
  const latestCompletion = learnerCompletions.at(-1)
  const chaptersById = new Map(
    input.chapters.map((chapter) => [chapter.id, chapter]),
  )
  const closedChaptersCount = input.progress.filter(
    (item) => item.status === 'completed',
  ).length

  return [
    {
      closedChaptersCount,
      currentRank: getCurrentRank(input.chapters, input.progress),
      fullName: input.learner.fullName,
      lastBadgeDate: latestCompletion?.completedAt ?? null,
      lastBadgeName: latestCompletion
        ? (chaptersById.get(latestCompletion.chapterId)?.badgeName ?? null)
        : null,
      learnerId: input.learner.id,
      nickname: input.learner.nickname,
    },
  ]
}
