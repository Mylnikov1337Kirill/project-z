import type {
  ChapterProgress,
  PublicChapter,
  PublicMission,
} from '../../../shared/types/domain'
import {
  getChapterStartHref,
  getCompletedMissionIds,
  getMissionLabel,
  getNextPlayableMission,
  getPrepSceneLabel,
  resolveChapterStatus,
  shouldStartChapterAtPrep,
  withQaMode,
} from './chapterProgress'

export type CourseResumeTarget =
  | {
      actionLabel: string
      chapter: PublicChapter
      completedChaptersCount: number
      href: string
      kind: 'active'
      sceneLabel: string
      sceneTitle: string
      skill: string
    }
  | {
      actionLabel: string
      chapter: null
      completedChaptersCount: number
      href: string
      kind: 'completed'
      sceneLabel: string
      sceneTitle: string
      skill: string
    }

function getCompletedChaptersCount(
  chapters: PublicChapter[],
  progressByChapter: Map<string, ChapterProgress>,
) {
  return chapters.filter(
    (chapter) => resolveChapterStatus(chapter, progressByChapter) === 'completed',
  ).length
}

function hasStartedCourse(progress: ChapterProgress[]) {
  return progress.some(
    (item) => item.status === 'completed' || item.completedMissionIds.length > 0,
  )
}

function getActiveActionLabel(
  chapter: PublicChapter,
  nextMission: PublicMission | null,
) {
  if (!nextMission || nextMission.id === chapter.boss.id) {
    return 'К финальному вызову'
  }

  return 'Продолжить сцену'
}

export function getCourseResumeTarget(input: {
  chapters: PublicChapter[]
  preserveQaMode?: boolean
  progress: ChapterProgress[]
  progressByChapter: Map<string, ChapterProgress>
}): CourseResumeTarget | null {
  const { chapters, preserveQaMode = false, progress, progressByChapter } = input
  const completedChaptersCount = getCompletedChaptersCount(
    chapters,
    progressByChapter,
  )

  if (chapters.length === 0 || !hasStartedCourse(progress)) {
    return null
  }

  if (completedChaptersCount === chapters.length) {
    return {
      actionLabel: 'Открыть архив',
      chapter: null,
      completedChaptersCount,
      href: withQaMode('/course/complete', preserveQaMode),
      kind: 'completed',
      sceneLabel: `${completedChaptersCount}/${chapters.length}`,
      sceneTitle: 'Все главы пройдены',
      skill: 'Архив глав держит все markdown-файлы маршрута в одном месте.',
    }
  }

  const activeChapter = chapters.find(
    (chapter) => resolveChapterStatus(chapter, progressByChapter) === 'open',
  )

  if (!activeChapter) {
    return null
  }

  const completedMissionIds = getCompletedMissionIds(activeChapter, progress)
  const status = resolveChapterStatus(activeChapter, progressByChapter)
  const nextMission = getNextPlayableMission(activeChapter, completedMissionIds)
  const shouldStartAtPrep = shouldStartChapterAtPrep(
    activeChapter,
    completedMissionIds,
    status,
  )
  const href = getChapterStartHref(
    activeChapter,
    nextMission,
    shouldStartAtPrep,
    preserveQaMode,
  )

  if (shouldStartAtPrep && activeChapter.prep) {
    return {
      actionLabel: 'К брифингу',
      chapter: activeChapter,
      completedChaptersCount,
      href,
      kind: 'active',
      sceneLabel: getPrepSceneLabel(activeChapter),
      sceneTitle: activeChapter.prep.title,
      skill: activeChapter.summary,
    }
  }

  return {
    actionLabel: getActiveActionLabel(activeChapter, nextMission),
    chapter: activeChapter,
    completedChaptersCount,
    href,
    kind: 'active',
    sceneLabel: nextMission
      ? getMissionLabel(activeChapter, nextMission)
      : `Глава ${activeChapter.order}`,
    sceneTitle: nextMission?.title ?? activeChapter.title,
    skill: activeChapter.summary,
  }
}
