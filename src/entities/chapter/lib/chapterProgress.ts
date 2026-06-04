import { getChapterArtifacts } from '../../../shared/lib/content/chapterArtifacts'
import type {
  ChapterProgress,
  ChapterStatus,
  PublicChapter,
  PublicMission,
} from '../../../shared/types/domain'

export type MissionListItemState =
  | 'after-prep'
  | 'completed'
  | 'current'
  | 'open'
  | 'locked'

export type RankChapter = Pick<
  PublicChapter,
  'id' | 'order' | 'rankAfterCompletion'
>

export function resolveChapterStatus(
  chapter: PublicChapter,
  progressByChapter: Map<string, ChapterProgress>,
): ChapterStatus {
  return (
    progressByChapter.get(chapter.id)?.status ??
    (chapter.order === 1 ? 'open' : 'locked')
  )
}

export function getCurrentRank(
  chapters: readonly RankChapter[],
  progress: readonly ChapterProgress[],
) {
  const progressByChapter = new Map(
    progress.map((item) => [item.chapterId, item]),
  )
  let latestCompletedChapter: RankChapter | null = null

  for (const chapter of [...chapters].sort(
    (left, right) => left.order - right.order,
  )) {
    if (progressByChapter.get(chapter.id)?.status !== 'completed') {
      break
    }

    latestCompletedChapter = chapter
  }

  return latestCompletedChapter?.rankAfterCompletion ?? 'Новый участник'
}

export function formatChapterStatus(status: ChapterStatus) {
  if (status === 'completed') {
    return 'пройдена'
  }

  return status === 'open' ? 'открыта' : 'закрыта'
}

export function getChapterIntroCopy(
  chapter: PublicChapter,
  isPracticeReady: boolean,
) {
  if (isPracticeReady) {
    return `Сначала короткий брифинг, затем практические сцены и финальное испытание. Главное правило узла: ${chapter.summary}`
  }

  return `Маршрут уже показывает следующую тему. Этот узел откроет практику позже; пока держи в фокусе правило: ${chapter.summary}`
}

export function getCompletedMissionIds(
  chapter: PublicChapter,
  progress: ChapterProgress[],
) {
  return new Set(
    progress.find((item) => item.chapterId === chapter.id)
      ?.completedMissionIds ?? [],
  )
}

export function getMissionSequence(chapter: PublicChapter) {
  return [...chapter.missions, chapter.boss]
}

export function getSceneNumber(chapter: PublicChapter, sceneIndex: number) {
  return `${chapter.order}.${sceneIndex}`
}

export function getSceneLabel(chapter: PublicChapter, sceneIndex: number) {
  return `Сцена ${getSceneNumber(chapter, sceneIndex)}`
}

export function getPrepSceneLabel(chapter: PublicChapter) {
  return getSceneLabel(chapter, 0)
}

export function getMissionSceneNumber(
  chapter: PublicChapter,
  mission: PublicMission,
) {
  const missionIndex = getMissionSequence(chapter).findIndex(
    (item) => item.id === mission.id,
  )

  return getSceneNumber(chapter, missionIndex >= 0 ? missionIndex + 1 : 0)
}

export function getMissionLabel(chapter: PublicChapter, mission: PublicMission) {
  return `Сцена ${getMissionSceneNumber(chapter, mission)}`
}

export function getNextPlayableMission(
  chapter: PublicChapter,
  completedMissionIds: Set<string>,
) {
  return (
    getMissionSequence(chapter).find(
      (mission) => !completedMissionIds.has(mission.id),
    ) ?? null
  )
}

export function getNextMissionAfter(
  chapter: PublicChapter,
  mission: PublicMission,
) {
  const missionSequence = getMissionSequence(chapter)
  const currentIndex = missionSequence.findIndex((item) => item.id === mission.id)

  return currentIndex >= 0 ? (missionSequence[currentIndex + 1] ?? null) : null
}

export function isPrepCurrentStep(
  chapter: PublicChapter,
  completedMissionIds: Set<string>,
  status: ChapterStatus,
) {
  return Boolean(
    chapter.prep && status !== 'completed' && completedMissionIds.size === 0,
  )
}

export function shouldStartChapterAtPrep(
  chapter: PublicChapter,
  completedMissionIds: Set<string>,
  status: ChapterStatus,
) {
  return Boolean(
    chapter.prep &&
      (status === 'completed' ||
        isPrepCurrentStep(chapter, completedMissionIds, status)),
  )
}

export function getMissionListItemState(input: {
  chapter: PublicChapter
  mission: PublicMission
  completedMissionIds: Set<string>
  nextMission: PublicMission | null
  status: ChapterStatus
}): MissionListItemState {
  const { chapter, completedMissionIds, mission, nextMission, status } = input

  if (completedMissionIds.has(mission.id)) {
    return 'completed'
  }

  if (
    mission.id === chapter.missions[0]?.id &&
    isPrepCurrentStep(chapter, completedMissionIds, status)
  ) {
    return 'after-prep'
  }

  if (nextMission?.id === mission.id && status !== 'completed') {
    return 'current'
  }

  if (canOpenMission(chapter, mission.id, completedMissionIds, status)) {
    return 'open'
  }

  return 'locked'
}

export function formatMissionListItemStatus(input: {
  isFinal: boolean
  sceneNumber?: string
  state: MissionListItemState
}) {
  const scenePrefix = input.sceneNumber ? `${input.sceneNumber} · ` : ''

  if (input.isFinal) {
    return `${scenePrefix}финал`
  }

  if (input.state === 'completed') {
    return `${scenePrefix}зачтено`
  }

  if (input.state === 'current') {
    return `${scenePrefix}сейчас`
  }

  if (input.state === 'after-prep') {
    return `${scenePrefix}после брифинга`
  }

  if (input.state === 'locked') {
    return `${scenePrefix}закрыто`
  }

  return `${scenePrefix}открыто`
}

export function isChapterPracticeReady(chapter: PublicChapter) {
  return Boolean(chapter.prep || getChapterArtifacts(chapter).length > 0)
}

export function getChapterStartHref(
  chapter: PublicChapter,
  nextMission: PublicMission | null,
  shouldShowPrep: boolean,
  shouldKeepQaMode = false,
) {
  if (shouldShowPrep && chapter.prep) {
    return withQaMode(`/chapters/${chapter.id}/prep`, shouldKeepQaMode)
  }

  const href = nextMission
    ? `/chapters/${chapter.id}/missions/${nextMission.id}`
    : `/chapters/${chapter.id}`

  return withQaMode(href, shouldKeepQaMode)
}

export function withQaMode(href: string, enabled: boolean) {
  if (!enabled) {
    return href
  }

  return `${href}${href.includes('?') ? '&' : '?'}qa=1`
}

export function canOpenMission(
  chapter: PublicChapter,
  missionId: string,
  completedMissionIds: Set<string>,
  chapterStatus: ChapterStatus,
) {
  if (!isChapterPracticeReady(chapter)) {
    return false
  }

  if (chapterStatus === 'completed') {
    return true
  }

  const missionSequence = getMissionSequence(chapter)
  const missionIndex = missionSequence.findIndex((item) => item.id === missionId)

  if (missionIndex < 0) {
    return false
  }

  return missionSequence
    .slice(0, missionIndex)
    .every((mission) => completedMissionIds.has(mission.id))
}
