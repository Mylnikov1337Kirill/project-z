import {
  getCompletedMissionIds,
  getMissionLabel,
  getNextPlayableMission,
  isChapterPracticeReady,
  resolveChapterStatus,
} from '../../../entities/chapter/lib/chapterProgress'
import type {
  ChapterProgress,
  ChapterStatus,
  PublicChapter,
  PublicMission,
} from '../../../shared/types/domain'

export const nodePositions = [
  { x: 14, y: 68 },
  { x: 27, y: 48 },
  { x: 40, y: 61 },
  { x: 53, y: 39 },
  { x: 65, y: 54 },
  { x: 77, y: 38 },
  { x: 87, y: 55 },
  { x: 94, y: 29 },
]

export type MapNodePosition = (typeof nodePositions)[number]

export function getPlayerAvatarPosition(position: MapNodePosition) {
  return {
    x: Math.max(7, Math.min(93, position.x - 6)),
    y: Math.max(18, Math.min(86, position.y + 12)),
  }
}

export const landmarkPeekOffsets = [
  { x: -2.4, y: -1.8 },
  { x: 2.4, y: 1.4 },
  { x: -2.4, y: -1.6 },
  { x: 2.3, y: 1.5 },
  { x: -2.5, y: 1.4 },
  { x: 2.2, y: -0.7 },
  { x: -2.3, y: -1.5 },
  { x: 2.1, y: 1.3 },
]

function clampLandmarkPosition(position: MapNodePosition) {
  return {
    x: Math.max(5, Math.min(95, position.x)),
    y: Math.max(16, Math.min(88, position.y)),
  }
}

export function getLandmarkPosition(position: MapNodePosition, index: number) {
  const avatarPosition = getPlayerAvatarPosition(position)
  const peekOffset =
    landmarkPeekOffsets[index % landmarkPeekOffsets.length] ??
    landmarkPeekOffsets[0]

  return clampLandmarkPosition({
    x: avatarPosition.x + peekOffset.x,
    y: avatarPosition.y + peekOffset.y,
  })
}

export const landmarkPositions = nodePositions.map((position, index) =>
  getLandmarkPosition(position, index),
)

export type MapLandmarkPosition = (typeof landmarkPositions)[number]

export function getRoutePoints(positions = nodePositions) {
  return positions.map((position) => `${position.x},${position.y}`).join(' ')
}

export function getRevealedRoutePoints(revealedChapterIndex: number) {
  return revealedChapterIndex > 0
    ? getRoutePoints(nodePositions.slice(0, revealedChapterIndex + 1))
    : ''
}

export function getCompletedRoutePoints(chapterStates: ChapterStatus[]) {
  let completedRouteStopIndex = -1

  for (const [index, state] of chapterStates.entries()) {
    if (state !== 'completed') {
      break
    }

    completedRouteStopIndex = index
  }

  return completedRouteStopIndex > 0
    ? getRoutePoints(nodePositions.slice(0, completedRouteStopIndex + 1))
    : ''
}

export function getOpenRoutePoints(chapterStates: ChapterStatus[]) {
  let completedRouteStopIndex = -1

  for (const [index, state] of chapterStates.entries()) {
    if (state !== 'completed') {
      break
    }

    completedRouteStopIndex = index
  }

  if (completedRouteStopIndex >= nodePositions.length - 1) {
    return ''
  }

  return getRoutePoints(
    nodePositions.slice(Math.max(completedRouteStopIndex, 0)),
  )
}

export function getPlayableChapter(
  chapters: PublicChapter[],
  progressByChapter: Map<string, ChapterProgress>,
) {
  return (
    chapters.find(
      (chapter) => resolveChapterStatus(chapter, progressByChapter) === 'open',
    ) ??
    chapters.find(
      (chapter) =>
        resolveChapterStatus(chapter, progressByChapter) === 'completed',
    ) ??
    chapters[0] ??
    null
  )
}

export function isMapRouteCompleted(
  chapters: PublicChapter[],
  progressByChapter: Map<string, ChapterProgress>,
) {
  return (
    chapters.length > 0 &&
    chapters.every(
      (chapter) =>
        resolveChapterStatus(chapter, progressByChapter) === 'completed',
    )
  )
}

export function getLatestCompletedChapter(
  chapters: PublicChapter[],
  progressByChapter: Map<string, ChapterProgress>,
) {
  return (
    [...chapters]
      .sort((left, right) => right.order - left.order)
      .find(
        (chapter) =>
          resolveChapterStatus(chapter, progressByChapter) === 'completed',
      ) ?? null
  )
}

export function getInitialMapChapter(input: {
  chapters: PublicChapter[]
  preferredChapterId?: string
  progressByChapter: Map<string, ChapterProgress>
}) {
  const { chapters, preferredChapterId, progressByChapter } = input
  const preferredChapter = preferredChapterId
    ? chapters.find((chapter) => chapter.id === preferredChapterId)
    : null

  if (
    preferredChapter &&
    resolveChapterStatus(preferredChapter, progressByChapter) !== 'locked'
  ) {
    return preferredChapter
  }

  if (isMapRouteCompleted(chapters, progressByChapter)) {
    return null
  }

  return getPlayableChapter(chapters, progressByChapter)
}

export function getMapNodeStateLabel(state: ChapterStatus) {
  if (state === 'completed') {
    return 'пройдена'
  }

  if (state === 'open') {
    return 'открыта'
  }

  return 'заблокирована'
}

export function getMapMentorPrompt(input: {
  chapter: PublicChapter
  completedMissionIds: Set<string>
  isFreshUnlock?: boolean
  nextMission: PublicMission | null
  status: ChapterStatus
}) {
  const { chapter, completedMissionIds, isFreshUnlock, nextMission, status } =
    input

  if (status === 'completed') {
    return {
      title: `Награда получена: «${chapter.badgeName}»`,
      copy: `Ты закрыл главу «${chapter.title}». Повтори её, если хочешь освежить практику, или двигайся дальше по карте.`,
    }
  }

  if (status === 'locked') {
    return {
      title: 'Маршрут сюда ещё не дошёл',
      copy:
        'Сначала закрой открытую практику. Как только появится нужная награда, этот узел станет частью маршрута.',
    }
  }

  if (isFreshUnlock) {
    return {
      title: `Открыт новый узел: ${chapter.title}`,
      copy: `Глава ${String(chapter.order).padStart(2, '0')} появилась на маршруте. Сначала загляни в короткий брифинг, потом забирай следующую практику.`,
    }
  }

  if (!isChapterPracticeReady(chapter)) {
    return {
      title: `Открыта глава ${String(chapter.order).padStart(2, '0')}`,
      copy: `Следующая тема уже на карте. Главное правило узла: ${chapter.summary}`,
    }
  }

  if (!nextMission) {
    return {
      title: 'Остался последний штрих',
      copy:
        'Практика зачтена. Забери награду главы и возвращайся на карту за следующим узлом.',
    }
  }

  if (completedMissionIds.size > 0) {
    return {
      title: `Продолжай: ${getMissionLabel(chapter, nextMission)}`,
      copy: `Следующая сцена: ${nextMission.title}. Держи фокус на маленьком, понятном и проверяемом результате.`,
    }
  }

  if (chapter.order === 1) {
    return {
      title: 'Начни с ответственности за изменения',
      copy:
        'Если агент написал код, это всё равно твой пул-реквест. Перед ревью разберись в существенных изменениях, убери лишнее и проверь результат.',
    }
  }

  return {
    title: `Начни главу ${String(chapter.order).padStart(2, '0')}`,
    copy: `Сначала короткий брифинг, потом практика. Тема узла: ${chapter.summary}`,
  }
}

export function getRouteCompleteMentorPrompt() {
  return {
    title: 'Маршрут закрыт',
    copy:
      'Все главы пройдены. Открой архив, чтобы забрать markdown-шаблоны маршрута и вернуться к материалам без привязки к одной главе.',
  }
}

export function getSelectedChapterDetails(input: {
  chapter: PublicChapter | null
  isRouteCompleted?: boolean
  progress: ChapterProgress[]
  progressByChapter: Map<string, ChapterProgress>
  revealedChapterId: string | null
}) {
  const {
    chapter,
    isRouteCompleted = false,
    progress,
    progressByChapter,
    revealedChapterId,
  } = input
  const status = chapter
    ? resolveChapterStatus(chapter, progressByChapter)
    : 'locked'
  const completedMissionIds = chapter
    ? getCompletedMissionIds(chapter, progress)
    : new Set<string>()
  const nextMission =
    chapter && status !== 'completed'
      ? getNextPlayableMission(chapter, completedMissionIds)
      : null
  const mentorPrompt = chapter
    ? getMapMentorPrompt({
        chapter,
        completedMissionIds,
        isFreshUnlock: chapter.id === revealedChapterId,
        nextMission,
        status,
      })
    : isRouteCompleted
      ? getRouteCompleteMentorPrompt()
    : {
        title: 'Выбери узел маршрута',
        copy: 'Наведи фокус на главу, чтобы увидеть сигнал Z-бота.',
      }

  return {
    completedMissionIds,
    mentorPrompt,
    nextMission,
    status,
  }
}
