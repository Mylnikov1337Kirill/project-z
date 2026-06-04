import { useEffect, useMemo, useState } from 'react'
import type { ProgressRepository } from '../../../shared/api/progress/ProgressRepository'
import type {
  ChapterProgress,
  LeaderboardEntry,
  Learner,
  PublicChapter,
} from '../../../shared/types/domain'
import {
  mergeCurrentLeaderboardEntry,
  sortLeaderboardEntries,
} from './leaderboardModel'

type LeaderboardState = {
  entries: LeaderboardEntry[]
  error: string | null
  loadedKey: string
}

function getProgressKey(learnerId: string, progress: ChapterProgress[]) {
  const progressSnapshot = progress
    .map(
      (item) =>
        `${item.chapterId}:${item.status}:${item.completedMissionIds.join(',')}`,
    )
    .join('|')

  return `${learnerId}:${progressSnapshot}`
}

export function useLeaderboardEntries(input: {
  chapters: PublicChapter[]
  learner: Learner
  progress: ChapterProgress[]
  progressRepository: ProgressRepository
}) {
  const { chapters, learner, progress, progressRepository } = input
  const requestKey = useMemo(
    () => getProgressKey(learner.id, progress),
    [learner.id, progress],
  )
  const [state, setState] = useState<LeaderboardState>({
    entries: [],
    error: null,
    loadedKey: '',
  })

  useEffect(() => {
    let isMounted = true

    progressRepository
      .getLeaderboard()
      .then((entries) => {
        if (isMounted) {
          setState({
            entries,
            error: null,
            loadedKey: requestKey,
          })
        }
      })
      .catch(() => {
        if (isMounted) {
          setState({
            entries: [],
            error: 'Z-бот не смог собрать доску лидеров.',
            loadedKey: requestKey,
          })
        }
      })

    return () => {
      isMounted = false
    }
  }, [progressRepository, requestKey])

  const entries = useMemo(
    () =>
      mergeCurrentLeaderboardEntry({
        chapters,
        entries: state.entries,
        learner,
        progress,
      }),
    [chapters, learner, progress, state.entries],
  )
  const sortedEntries = useMemo(
    () => sortLeaderboardEntries(entries),
    [entries],
  )
  const isLoading = state.loadedKey !== requestKey

  return {
    entries,
    error: isLoading ? null : state.error,
    isLoading,
    sortedEntries,
  }
}
