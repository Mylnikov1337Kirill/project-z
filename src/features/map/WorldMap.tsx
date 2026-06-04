import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  formatChapterStatus,
  getCurrentRank,
  resolveChapterStatus,
} from '../../entities/chapter/lib/chapterProgress'
import { getCourseResumeTarget } from '../../entities/chapter/lib/chapterResume'
import { useProgressByChapter } from '../../shared/lib/progress/useProgressByChapter'
import { useQaShortcutsEnabled } from '../../shared/lib/routing/useQaShortcutsEnabled'
import type { ProgressRepository } from '../../shared/api/progress/ProgressRepository'
import { GameHud } from '../../shared/ui/GameHud'
import { MentorDialog } from '../../shared/ui/MentorDialog'
import type {
  ChapterLandmarkId,
  ChapterProgress,
  ChapterStatus,
  Learner,
  PublicChapter,
  TrapConceptId,
} from '../../shared/types/domain'
import {
  getMapNodeStateLabel,
  getCompletedRoutePoints,
  getPlayerAvatarPosition,
  getOpenRoutePoints,
  getRevealedRoutePoints,
  landmarkPositions,
  nodePositions,
} from './lib/mapViewModel'
import { useWorldMapState } from './lib/useWorldMapState'

const fieldGuideCuePrompt = {
  title: 'Новая механика: память ловушек',
  copy:
    'Я завёл справочник пойманных ловушек. Там лежат повторяемые сигналы и короткий разбор, чтобы перед следующей сценой быстро вспомнить, где агенту нельзя импровизировать.',
}

const dismissedFieldGuideCueLearnerIds = new Set<string>()

type LoadedTrapGuideState = {
  learnerId: string
  trapIds: TrapConceptId[]
}

type WorldMapProps = {
  chapters: PublicChapter[]
  encounteredTrapIds: TrapConceptId[]
  initialChapterId?: string
  learner: Learner
  onEncounteredTrapIdsChange?: (trapIds: TrapConceptId[]) => void
  progress: ChapterProgress[]
  progressRepository: ProgressRepository
}

type MapChapterNodeProps = {
  chapter: PublicChapter
  isCurrentChapter: boolean
  isFinalChapter: boolean
  isSelected: boolean
  isUnlockRevealed: boolean
  onOpen: () => void
  onPreview: () => void
  onSelectLocked: () => void
  position: (typeof nodePositions)[number]
  state: ChapterStatus
}

type MapLandmarkProps = {
  chapter: PublicChapter
  position: (typeof landmarkPositions)[number]
  state: ChapterStatus
}

function LandmarkStation({ children }: { children: ReactNode }) {
  return (
    <svg
      className="map-landmark-svg"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="landmark-shadow" x="13" y="56" width="38" height="5" />
      <rect
        className="landmark-shade landmark-stroked"
        x="23"
        y="49"
        width="18"
        height="8"
      />
      <rect className="landmark-line" x="30" y="41" width="4" height="10" />
      <rect
        className="landmark-accent landmark-stroked"
        x="13"
        y="9"
        width="38"
        height="34"
      />
      <rect
        className="landmark-main landmark-stroked"
        x="13"
        y="9"
        width="38"
        height="8"
      />
      {children}
    </svg>
  )
}

function mergeTrapIds(...trapIdLists: TrapConceptId[][]) {
  return Array.from(new Set(trapIdLists.flat()))
}

function LandmarkIcon({ landmarkId }: { landmarkId: ChapterLandmarkId }) {
  if (landmarkId === 'diff-forge') {
    return (
      <LandmarkStation>
        <rect className="landmark-line" x="22" y="21" width="4" height="4" />
        <rect className="landmark-main" x="20" y="25" width="18" height="5" />
        <polygon className="landmark-main" points="38,25 49,22 49,28 38,30" />
        <rect className="landmark-line" x="24" y="30" width="14" height="5" />
        <rect className="landmark-line" x="20" y="35" width="24" height="5" />
      </LandmarkStation>
    )
  }

  if (landmarkId === 'brief-tower') {
    return (
      <LandmarkStation>
        <path className="landmark-main" d="M20 23h25v14H32l-6 5v-5h-6z" />
        <rect className="landmark-line" x="25" y="28" width="15" height="4" />
      </LandmarkStation>
    )
  }

  if (landmarkId === 'plan-gate') {
    return (
      <LandmarkStation>
        <rect className="landmark-main" x="20" y="23" width="7" height="17" />
        <rect className="landmark-main" x="39" y="23" width="7" height="17" />
        <rect className="landmark-line" x="20" y="21" width="26" height="5" />
        <rect className="landmark-line" x="29" y="31" width="7" height="4" />
        <polygon className="landmark-line" points="36,28 45,32 36,36" />
      </LandmarkStation>
    )
  }

  if (landmarkId === 'context-archive') {
    return (
      <LandmarkStation>
        <path className="landmark-main" d="M18 27h9l4-5h17v18H18z" />
        <rect className="landmark-line" x="22" y="32" width="22" height="5" />
      </LandmarkStation>
    )
  }

  if (landmarkId === 'attention-window') {
    return (
      <LandmarkStation>
        <rect className="landmark-main" x="19" y="22" width="26" height="18" />
        <rect
          className="landmark-symbol-fill"
          x="23"
          y="26"
          width="18"
          height="10"
        />
        <rect className="landmark-line" x="30" y="29" width="5" height="5" />
      </LandmarkStation>
    )
  }

  if (landmarkId === 'verification-lab') {
    return (
      <LandmarkStation>
        <rect className="landmark-line" x="29" y="20" width="8" height="6" />
        <path className="landmark-main" d="M25 26h16l5 14H20z" />
        <rect
          className="landmark-symbol-fill"
          x="25"
          y="33"
          width="16"
          height="4"
        />
      </LandmarkStation>
    )
  }

  if (landmarkId === 'instruction-router') {
    return (
      <LandmarkStation>
        <rect className="landmark-main" x="18" y="20" width="8" height="8" />
        <rect className="landmark-main" x="40" y="20" width="8" height="8" />
        <rect className="landmark-main" x="29" y="34" width="8" height="8" />
        <rect className="landmark-line" x="26" y="23" width="14" height="4" />
        <rect className="landmark-line" x="31" y="28" width="4" height="8" />
        <rect className="landmark-line" x="22" y="31" width="4" height="8" />
        <rect className="landmark-line" x="37" y="31" width="4" height="8" />
      </LandmarkStation>
    )
  }

  return (
    <LandmarkStation>
      <rect className="landmark-main" x="19" y="22" width="18" height="19" />
      <rect className="landmark-line" x="22" y="22" width="4" height="19" />
      <polygon className="landmark-line" points="39,27 49,32 39,37" />
    </LandmarkStation>
  )
}

function MapLandmark({ chapter, position, state }: MapLandmarkProps) {
  const visual = chapter.visual

  if (!visual) {
    return null
  }

  return (
    <div
      aria-label={`${visual.label}. Глава ${chapter.order}: ${
        chapter.title
      }. ${getMapNodeStateLabel(state)}`}
      className={`map-landmark map-landmark-${visual.landmarkId} map-landmark-tone-${visual.tone} map-landmark-${state}`}
      role="img"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
      }}
    >
      <LandmarkIcon landmarkId={visual.landmarkId} />
    </div>
  )
}

function MapChapterNode({
  chapter,
  isCurrentChapter,
  isFinalChapter,
  isSelected,
  isUnlockRevealed,
  onOpen,
  onPreview,
  onSelectLocked,
  position,
  state,
}: MapChapterNodeProps) {
  return (
    <div
      className={`map-node-hotspot map-node-hotspot-${state}`}
      onClick={() => {
        if (state === 'locked') {
          onSelectLocked()
        }
      }}
      onMouseEnter={onPreview}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
      }}
    >
      <button
        className={`map-node map-node-${state} ${
          isSelected ? 'map-node-selected' : ''
        } ${isCurrentChapter ? 'map-node-current' : ''} ${
          isFinalChapter ? 'map-node-final' : ''
        } ${isUnlockRevealed ? 'map-node-unlock-reveal' : ''}`}
        disabled={state === 'locked'}
        onClick={onOpen}
        onFocus={onPreview}
        title={
          state === 'completed'
            ? `${chapter.title}. Пройдена, можно открыть заново`
            : state === 'open'
              ? `${chapter.title}. Награда после прохождения: ${chapter.badgeName}`
              : `${chapter.title}. Откроется позже`
        }
        type="button"
        aria-label={`Глава ${chapter.order}: ${chapter.title}. ${getMapNodeStateLabel(
          state,
        )}${isUnlockRevealed ? '. Новый узел открыт' : ''}`}
      >
        <span className="node-number">{chapter.order}</span>
        {state === 'completed' ? (
          <span className="node-badge-marker" aria-hidden="true">
            ✓
          </span>
        ) : null}
        {isCurrentChapter ? (
          <span className="node-current-marker" aria-hidden="true" />
        ) : null}
      </button>
    </div>
  )
}

export function WorldMap({
  chapters,
  encounteredTrapIds,
  initialChapterId,
  learner,
  onEncounteredTrapIdsChange,
  progress,
  progressRepository,
}: WorldMapProps) {
  const navigate = useNavigate()
  const qaShortcutsEnabled = useQaShortcutsEnabled()
  const progressByChapter = useProgressByChapter(progress)
  const currentRank = getCurrentRank(chapters, progress)
  const resumeTarget = getCourseResumeTarget({
    chapters,
    preserveQaMode: qaShortcutsEnabled,
    progress,
    progressByChapter,
  })
  const {
    avatarChapter,
    hasCheckedPendingUnlock,
    isAvatarRunning,
    mentorPrompt,
    playableChapter,
    revealedChapterId,
    selectChapterPreview,
    selectLockedChapter,
    selectedChapter,
    selectedChapterStatus,
  } = useWorldMapState({
    chapters,
    initialChapterId,
    learnerId: learner.id,
    progress,
    progressByChapter,
    progressRepository,
  })
  const [loadedTrapGuideState, setLoadedTrapGuideState] =
    useState<LoadedTrapGuideState | null>(null)
  const loadedEncounteredTrapIds = useMemo(() => {
    const persistedTrapIds =
      loadedTrapGuideState?.learnerId === learner.id
        ? loadedTrapGuideState.trapIds
        : []

    return mergeTrapIds(encounteredTrapIds, persistedTrapIds)
  }, [encounteredTrapIds, learner.id, loadedTrapGuideState])
  const [fieldGuideCueDismissed, setFieldGuideCueDismissed] = useState(() =>
    dismissedFieldGuideCueLearnerIds.has(learner.id),
  )
  const selectedChapterIndex = Math.max(
    chapters.findIndex((chapter) => chapter.id === avatarChapter?.id),
    0,
  )
  const selectedNodePosition =
    nodePositions[selectedChapterIndex] ?? nodePositions[0]
  const avatarPosition = getPlayerAvatarPosition(selectedNodePosition)
  const avatarStyle = {
    '--avatar-x': `${avatarPosition.x}%`,
    '--avatar-y': `${avatarPosition.y}%`,
  } as CSSProperties
  const revealedChapterIndex = revealedChapterId
    ? chapters.findIndex((chapter) => chapter.id === revealedChapterId)
    : -1
  const revealedRoutePoints = getRevealedRoutePoints(revealedChapterIndex)
  const chapterStates = chapters.map((chapter) =>
    resolveChapterStatus(chapter, progressByChapter),
  )
  const completedRoutePoints = getCompletedRoutePoints(chapterStates)
  const openRoutePoints = getOpenRoutePoints(chapterStates)
  const hasTrapGuideEntries = loadedEncounteredTrapIds.length > 0
  const shouldShowFieldGuideCue =
    hasTrapGuideEntries &&
    hasCheckedPendingUnlock &&
    !fieldGuideCueDismissed &&
    !revealedChapterId
  const displayedMentorPrompt = shouldShowFieldGuideCue
    ? fieldGuideCuePrompt
    : mentorPrompt

  useEffect(() => {
    let isMounted = true

    async function loadTrapGuideState() {
      try {
        const trapIds = await progressRepository.getEncounteredTrapIds(
          learner.id,
        )

        if (!isMounted) {
          return
        }

        setLoadedTrapGuideState({ learnerId: learner.id, trapIds })
        onEncounteredTrapIdsChange?.(trapIds)
        setFieldGuideCueDismissed(
          dismissedFieldGuideCueLearnerIds.has(learner.id),
        )
      } catch {
        // Keep the optimistic in-memory trap state if the refresh fails.
      }
    }

    void loadTrapGuideState()

    return () => {
      isMounted = false
    }
  }, [learner.id, onEncounteredTrapIdsChange, progressRepository])

  function dismissFieldGuideCue() {
    dismissedFieldGuideCueLearnerIds.add(learner.id)
    setFieldGuideCueDismissed(true)
  }

  function handleNodeOpen(chapter: PublicChapter, state: ChapterStatus) {
    if (state !== 'locked') {
      navigate(`/chapters/${chapter.id}`)
    }
  }

  function handleFieldGuideCueOpen() {
    dismissFieldGuideCue()
    navigate('/field-guide')
  }

  function handleTrapGuideHudOpen() {
    dismissFieldGuideCue()
  }

  return (
    <>
      <GameHud
        actions={
          <>
            {hasTrapGuideEntries ? (
              <Link
                className="hud-link"
                onClick={handleTrapGuideHudOpen}
                to="/field-guide"
              >
                Справочник ловушек
              </Link>
            ) : null}
            <Link className="hud-link" to="/leaderboard">
              Доска лидеров
            </Link>
          </>
        }
        eyebrow="Project Z"
        learner={learner}
        rank={currentRank}
        title="Карта практик ИИ-разработки"
      />

      <section className="map-stage" aria-label="Карта глав Project Z">
        <div className="screen-frame map-screen">
          <div className="map-sky" />

          <MentorDialog eyebrow="Z-бот" title={displayedMentorPrompt.title}>
            <p>{displayedMentorPrompt.copy}</p>
            {shouldShowFieldGuideCue ? (
              <div className="map-trap-guide-actions">
                <button
                  className="pixel-button"
                  onClick={handleFieldGuideCueOpen}
                  type="button"
                >
                  Открыть справочник
                </button>
                <button
                  className="pixel-button pixel-button-secondary"
                  onClick={() => {
                    dismissFieldGuideCue()
                  }}
                  type="button"
                >
                  Понял
                </button>
              </div>
            ) : null}
          </MentorDialog>

          {resumeTarget ? (
            <aside
              aria-label="Продолжить маршрут"
              className={`map-resume-cue map-resume-cue-${resumeTarget.kind}`}
            >
              <div>
                <span className="map-resume-kicker">
                  {resumeTarget.kind === 'completed'
                    ? 'Маршрут закрыт'
                    : 'Возврат в маршрут'}
                </span>
                <strong>
                  {resumeTarget.kind === 'completed'
                    ? `Закрыто ${resumeTarget.sceneLabel}`
                    : `Продолжить: ${resumeTarget.sceneLabel}`}
                </strong>
                <p>{resumeTarget.sceneTitle}</p>
                <small>Навык: {resumeTarget.skill}</small>
              </div>
              <Link className="pixel-button" to={resumeTarget.href}>
                {resumeTarget.actionLabel}
              </Link>
            </aside>
          ) : null}

          <div className="map-landmarks">
            {chapters.map((chapter, index) => {
              const position =
                landmarkPositions[index] ?? landmarkPositions[0]
              const state = chapterStates[index] ?? 'locked'

              return (
                <MapLandmark
                  chapter={chapter}
                  key={`${chapter.id}-landmark`}
                  position={position}
                  state={state}
                />
              )
            })}
          </div>

          {openRoutePoints ? (
            <svg
              className="route-line"
              aria-hidden="true"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <polyline points={openRoutePoints} />
            </svg>
          ) : null}

          {completedRoutePoints ? (
            <svg
              className="route-completed-line"
              aria-hidden="true"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <polyline points={completedRoutePoints} />
            </svg>
          ) : null}

          {revealedRoutePoints ? (
            <svg
              className="route-unlock-line"
              aria-hidden="true"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <polyline points={revealedRoutePoints} />
            </svg>
          ) : null}

          <div
            className={`avatar-bot ${
              isAvatarRunning ? 'avatar-bot-running' : ''
            }`}
            style={avatarStyle}
            aria-label={`Робот-игрок у главы ${avatarChapter?.order ?? 1}`}
          >
            <span className="avatar-eye avatar-eye-left" />
            <span className="avatar-eye avatar-eye-right" />
            <span className="avatar-foot avatar-foot-left" />
            <span className="avatar-foot avatar-foot-right" />
          </div>

          {chapters.map((chapter, index) => {
            const position = nodePositions[index] ?? nodePositions[0]
            const state = chapterStates[index] ?? 'locked'
            const isSelected = chapter.id === selectedChapter?.id
            const isCurrentChapter =
              state === 'open' && chapter.id === playableChapter?.id
            const isFinalChapter = chapter.order === chapters.length
            const isUnlockRevealed = chapter.id === revealedChapterId

            return (
              <MapChapterNode
                chapter={chapter}
                isCurrentChapter={isCurrentChapter}
                isFinalChapter={isFinalChapter}
                isSelected={isSelected}
                isUnlockRevealed={isUnlockRevealed}
                key={chapter.id}
                onOpen={() => handleNodeOpen(chapter, state)}
                onPreview={() => selectChapterPreview(chapter, state)}
                onSelectLocked={() => selectLockedChapter(chapter)}
                position={position}
                state={state}
              />
            )
          })}

          {selectedChapter ? (
            <div
              className={`chapter-ribbon chapter-ribbon-${selectedChapterStatus}`}
            >
              <span>
                Глава {String(selectedChapter.order).padStart(2, '0')} ·{' '}
                {formatChapterStatus(selectedChapterStatus)}
              </span>
              <strong>{selectedChapter.title}</strong>
              <p>{selectedChapter.summary}</p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}
