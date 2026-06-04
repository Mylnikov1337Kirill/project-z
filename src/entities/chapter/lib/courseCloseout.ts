import type {
  ChapterProgress,
  PublicChapter,
} from '../../../shared/types/domain'

function getProgressStatus(
  chapter: PublicChapter,
  progressByChapter: Map<string, ChapterProgress>,
) {
  return (
    progressByChapter.get(chapter.id)?.status ??
    (chapter.order === 1 ? 'open' : 'locked')
  )
}

export function isCourseCompleted(input: {
  chapters: PublicChapter[]
  progress: ChapterProgress[]
}) {
  if (input.chapters.length === 0) {
    return false
  }

  const progressByChapter = new Map(
    input.progress.map((item) => [item.chapterId, item]),
  )

  return input.chapters.every(
    (chapter) => getProgressStatus(chapter, progressByChapter) === 'completed',
  )
}
