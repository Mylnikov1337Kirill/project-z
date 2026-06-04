import { getCurrentRank } from '../../../entities/chapter/lib/chapterProgress'
import type {
  ChapterProgress,
  LeaderboardEntry,
  Learner,
  PublicChapter,
} from '../../../shared/types/domain'

type LeaderboardModelChapter = Pick<
  PublicChapter,
  'badgeName' | 'id' | 'order' | 'rankAfterCompletion'
>

export function formatBadgeDate(value: string | null) {
  if (!value) {
    return 'награды ещё впереди'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'дата не указана'
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatBadgeReward(
  entry: Pick<LeaderboardEntry, 'lastBadgeDate' | 'lastBadgeName'>,
) {
  const badgeName = entry.lastBadgeName?.trim()

  if (badgeName) {
    return badgeName
  }

  return formatBadgeDate(entry.lastBadgeDate)
}

function getClosedChaptersCount(progress: readonly ChapterProgress[]) {
  return progress.filter((item) => item.status === 'completed').length
}

function getLatestCompletedChapter(
  chapters: readonly LeaderboardModelChapter[],
  progress: readonly ChapterProgress[],
) {
  const completedChapterIds = new Set(
    progress
      .filter((item) => item.status === 'completed')
      .map((item) => item.chapterId),
  )

  return [...chapters]
    .sort((left, right) => left.order - right.order)
    .filter((chapter) => completedChapterIds.has(chapter.id))
    .at(-1)
}

export function mergeCurrentLeaderboardEntry(input: {
  chapters: readonly LeaderboardModelChapter[]
  entries: readonly LeaderboardEntry[]
  learner: Learner
  progress: readonly ChapterProgress[]
}) {
  const existingEntry =
    input.entries.find((entry) => entry.learnerId === input.learner.id) ?? null
  const localClosedChaptersCount = getClosedChaptersCount(input.progress)

  if (localClosedChaptersCount === 0 && !existingEntry) {
    return [...input.entries]
  }

  const existingClosedChaptersCount = existingEntry?.closedChaptersCount ?? 0
  const localProgressIsFresh =
    localClosedChaptersCount >= existingClosedChaptersCount
  const closedChaptersCount = Math.max(
    localClosedChaptersCount,
    existingClosedChaptersCount,
  )
  const latestCompletedChapter = getLatestCompletedChapter(
    input.chapters,
    input.progress,
  )
  const currentEntry: LeaderboardEntry = {
    closedChaptersCount,
    currentRank: localProgressIsFresh
      ? getCurrentRank(input.chapters, input.progress)
      : (existingEntry?.currentRank ?? 'Новый участник'),
    fullName: existingEntry?.fullName ?? '',
    lastBadgeDate:
      localProgressIsFresh &&
      localClosedChaptersCount > existingClosedChaptersCount
        ? null
        : (existingEntry?.lastBadgeDate ?? null),
    lastBadgeName: localProgressIsFresh
      ? (latestCompletedChapter?.badgeName ??
        existingEntry?.lastBadgeName ??
        null)
      : (existingEntry?.lastBadgeName ??
        latestCompletedChapter?.badgeName ??
        null),
    learnerId: input.learner.id,
    nickname: input.learner.nickname,
  }

  if (!existingEntry) {
    return [...input.entries, currentEntry]
  }

  return input.entries.map((entry) =>
    entry.learnerId === input.learner.id ? currentEntry : entry,
  )
}

export function sortLeaderboardEntries(entries: LeaderboardEntry[]) {
  return [...entries].sort((firstEntry, secondEntry) => {
    const closedChaptersDiff =
      secondEntry.closedChaptersCount - firstEntry.closedChaptersCount

    if (closedChaptersDiff !== 0) {
      return closedChaptersDiff
    }

    const firstBadgeTime = firstEntry.lastBadgeDate
      ? new Date(firstEntry.lastBadgeDate).getTime()
      : 0
    const secondBadgeTime = secondEntry.lastBadgeDate
      ? new Date(secondEntry.lastBadgeDate).getTime()
      : 0

    return secondBadgeTime - firstBadgeTime
  })
}
