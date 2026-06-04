import type {
  Chapter,
  ChapterCompletion,
  ChapterProgress,
  MissionAttempt,
} from '../../../shared/types/domain'

export type ProgressChapter = Pick<Chapter, 'id' | 'order'>

export type CompleteChapterProgressInput = {
  chapterId: string
  chapters: readonly ProgressChapter[]
  completedAt: string
  completions: readonly ChapterCompletion[]
  learnerId: string
  pendingUnlockChapterId: string | null
  progress: readonly ChapterProgress[]
}

export type CompleteChapterProgressResult = {
  completion: ChapterCompletion
  completions: ChapterCompletion[]
  pendingUnlockChapterId: string | null
  progress: ChapterProgress[]
}

function getOrderedChapters(chapters: readonly ProgressChapter[]) {
  return [...chapters].sort((left, right) => left.order - right.order)
}

function cloneProgressItem(item: ChapterProgress): ChapterProgress {
  return {
    ...item,
    completedMissionIds: [...item.completedMissionIds],
  }
}

export function createInitialProgress(
  chapters: readonly ProgressChapter[],
): ChapterProgress[] {
  return getOrderedChapters(chapters).map((chapter, index) => ({
    chapterId: chapter.id,
    completedMissionIds: [],
    status: index === 0 ? 'open' : 'locked',
  }))
}

export function getNextChapterId(
  chapters: readonly ProgressChapter[],
  chapterId: string,
) {
  const orderedChapters = getOrderedChapters(chapters)
  const chapterIndex = orderedChapters.findIndex(
    (chapter) => chapter.id === chapterId,
  )

  return chapterIndex >= 0
    ? (orderedChapters[chapterIndex + 1]?.id ?? null)
    : null
}

export function deriveUnlockedProgress(
  chapters: readonly ProgressChapter[],
  progress: readonly ChapterProgress[],
): ChapterProgress[] {
  const completedChapterIds = new Set(
    progress
      .filter((item) => item.status === 'completed')
      .map((item) => item.chapterId),
  )
  const chapterIdsToOpen = new Set(
    [...completedChapterIds]
      .map((chapterId) => getNextChapterId(chapters, chapterId))
      .filter((chapterId): chapterId is string => Boolean(chapterId)),
  )

  return progress.map((item) => {
    const clonedItem = cloneProgressItem(item)

    return clonedItem.status === 'locked' &&
      chapterIdsToOpen.has(clonedItem.chapterId)
      ? { ...clonedItem, status: 'open' }
      : clonedItem
  })
}

export function normalizeProgress(
  chapters: readonly ProgressChapter[],
  progress: readonly ChapterProgress[] | undefined,
): ChapterProgress[] {
  const storedProgressByChapter = new Map(
    progress?.map((item) => [item.chapterId, item]),
  )
  const normalizedProgress = createInitialProgress(chapters).map((item) => {
    const storedItem = storedProgressByChapter.get(item.chapterId)

    if (!storedItem) {
      return item
    }

    return {
      ...item,
      completedMissionIds: [...(storedItem.completedMissionIds ?? [])],
      status: storedItem.status,
    }
  })

  return deriveUnlockedProgress(chapters, normalizedProgress)
}

export function applyMissionAttemptProgress(
  progress: readonly ChapterProgress[],
  attempt: MissionAttempt,
): ChapterProgress[] {
  if (!attempt.isCorrect) {
    return progress.map(cloneProgressItem)
  }

  return progress.map((item) =>
    item.chapterId === attempt.chapterId
      ? {
          ...item,
          completedMissionIds: Array.from(
            new Set([...item.completedMissionIds, attempt.missionId]),
          ),
        }
      : cloneProgressItem(item),
  )
}

export function completeChapterProgress({
  chapterId,
  chapters,
  completedAt,
  completions,
  learnerId,
  pendingUnlockChapterId,
  progress,
}: CompleteChapterProgressInput): CompleteChapterProgressResult {
  const existingCompletion = completions.find(
    (item) => item.learnerId === learnerId && item.chapterId === chapterId,
  )

  if (existingCompletion) {
    return {
      completion: existingCompletion,
      completions: [...completions],
      pendingUnlockChapterId,
      progress: deriveUnlockedProgress(chapters, progress),
    }
  }

  const completedProgress = progress.map((item) =>
    item.chapterId === chapterId
      ? { ...cloneProgressItem(item), status: 'completed' as const }
      : cloneProgressItem(item),
  )
  const nextProgress = deriveUnlockedProgress(chapters, completedProgress)
  const completedChapters = nextProgress.filter(
    (item) => item.status === 'completed',
  ).length
  const completion: ChapterCompletion = {
    chapterId,
    completedAt,
    completedChapters,
    learnerId,
  }

  return {
    completion,
    completions: [...completions, completion],
    pendingUnlockChapterId: getNextChapterId(chapters, chapterId),
    progress: nextProgress,
  }
}
