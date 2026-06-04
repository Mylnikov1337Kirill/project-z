import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  canOpenMission,
  getCompletedMissionIds,
  getCurrentRank,
  getMissionLabel,
  getMissionSequence,
  getNextMissionAfter,
  resolveChapterStatus,
  withQaMode,
} from '../../entities/chapter/lib/chapterProgress'
import type { MissionAnswer } from '../../entities/mission/lib/missionEngine'
import { MissionLocked } from '../../features/chapter/LockedScreens'
import { MissionScene } from '../../features/mission/ui/MissionScene'
import { useAppServices } from '../../shared/api/appServices/appServices'
import type { SubmitMissionAttemptResult } from '../../shared/api/missions/MissionAttemptService'
import { useProgressByChapter } from '../../shared/lib/progress/useProgressByChapter'
import {
  useQaPassEnabled,
  useQaShortcutsEnabled,
} from '../../shared/lib/routing/useQaShortcutsEnabled'
import { GameHud } from '../../shared/ui/GameHud'
import type { ChapterProgress } from '../../shared/types/domain'
import { ChapterNotFound, MissionNotFound } from '../system/SystemScreens'
import type { GamePageProps } from '../types'

type MissionPageProps = GamePageProps & {
  contentVersion: string
  onProgressChange: (progress: ChapterProgress[]) => void
  onTrapDiscoveriesChange: (
    discoveries: SubmitMissionAttemptResult['trapDiscoveries'],
  ) => void
}

type MissionPageResultState = SubmitMissionAttemptResult & {
  missionId: string
  wasChapterCompletedBeforeSubmit: boolean
}

function createClientAttemptId() {
  return crypto.randomUUID()
}

export function MissionPage({
  chapters,
  contentVersion,
  learner,
  progress,
  onProgressChange,
  onTrapDiscoveriesChange,
}: MissionPageProps) {
  const { chapterId, missionId } = useParams()
  const qaPassEnabled = useQaPassEnabled()
  const qaShortcutsEnabled = useQaShortcutsEnabled()
  const { missionAttemptService } = useAppServices()
  const progressByChapter = useProgressByChapter(progress)
  const chapter = chapters.find((item) => item.id === chapterId)
  const mission = chapter
    ? getMissionSequence(chapter).find((item) => item.id === missionId)
    : undefined
  const state = chapter
    ? resolveChapterStatus(chapter, progressByChapter)
    : 'locked'
  const completedMissionIds = chapter
    ? getCompletedMissionIds(chapter, progress)
    : new Set<string>()
  const currentRank = getCurrentRank(chapters, progress)
  const canAccessMission = Boolean(
    chapter &&
      mission &&
      state !== 'locked' &&
      canOpenMission(chapter, mission.id, completedMissionIds, state),
  )
  const [resultState, setResultState] =
    useState<MissionPageResultState | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const resetResult = useCallback(() => setResultState(null), [])

  useEffect(() => {
    if (!chapter || !mission || !canAccessMission) {
      return
    }

    void missionAttemptService
      .recordMissionStart({
        chapterId: chapter.id,
        contentVersion,
        missionId: mission.id,
      })
      .catch(() => undefined)
  }, [canAccessMission, chapter, contentVersion, mission, missionAttemptService])

  if (!chapter) {
    return <ChapterNotFound />
  }

  if (!mission) {
    return <MissionNotFound chapterId={chapter.id} />
  }

  if (!canAccessMission) {
    return <MissionLocked chapter={chapter} learner={learner} rank={currentRank} />
  }

  const nextMission = getNextMissionAfter(chapter, mission)
  const isBossMission = mission.id === chapter.boss.id
  const isReplayBadgeHandoff = Boolean(
    isBossMission &&
      resultState?.missionId === mission.id &&
      resultState.wasChapterCompletedBeforeSubmit,
  )
  const badgeHref =
    isReplayBadgeHandoff
      ? `/chapters/${chapter.id}/badge?replay=1`
      : `/chapters/${chapter.id}/badge?earned=1`
  const nextHrefBase = isBossMission
    ? badgeHref
    : nextMission
      ? `/chapters/${chapter.id}/missions/${nextMission.id}`
      : `/chapters/${chapter.id}`
  const nextHref = withQaMode(nextHrefBase, qaShortcutsEnabled)
  const nextLabel = isBossMission
    ? 'Забрать награду'
    : nextMission?.id === chapter.boss.id
      ? 'К финальному вызову'
      : 'Следующая сцена'
  const activeChapter = chapter
  const activeMission = mission
  const result =
    resultState?.missionId === activeMission.id ? resultState.evaluation : null
  const trapDiscoveries =
    resultState?.missionId === activeMission.id
      ? resultState.trapDiscoveries
      : []

  function commitSubmitResult(submitResult: SubmitMissionAttemptResult) {
    onProgressChange(submitResult.progress)
    onTrapDiscoveriesChange(submitResult.trapDiscoveries)
    setResultState({
      ...submitResult,
      missionId: activeMission.id,
      wasChapterCompletedBeforeSubmit: state === 'completed',
    })
  }

  async function submitAnswer(answer: MissionAnswer) {
    setIsSubmitting(true)
    try {
      const submitResult = await missionAttemptService.submitMissionAttempt({
        answer,
        chapterId: activeChapter.id,
        clientAttemptId: createClientAttemptId(),
        contentVersion,
        missionId: activeMission.id,
      })
      commitSubmitResult(submitResult)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleMissionSubmit(answer: MissionAnswer) {
    await submitAnswer(answer)
  }

  async function handleQaPassSubmit() {
    setIsSubmitting(true)

    try {
      const submitResult =
        await missionAttemptService.submitQaPassMissionAttempt({
          chapterId: activeChapter.id,
          clientAttemptId: createClientAttemptId(),
          contentVersion,
          missionId: activeMission.id,
        })
      commitSubmitResult(submitResult)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <GameHud
        eyebrow={getMissionLabel(chapter, mission)}
        learner={learner}
        rank={currentRank}
        title={mission.title}
      />

      <section className="chapter-stage" aria-label={mission.title}>
        <div
          className={`screen-frame mission-screen ${
            isBossMission ? 'mission-screen-final' : ''
          }`}
          data-mission-id={mission.id}
        >
          <MissionScene
            chapter={activeChapter}
            isSubmitting={isSubmitting}
            key={activeMission.id}
            mission={activeMission}
            nextHref={nextHref}
            nextLabel={nextLabel}
            onQaPassSubmit={handleQaPassSubmit}
            onReset={resetResult}
            onSubmit={handleMissionSubmit}
            qaPassEnabled={qaPassEnabled}
            result={result}
            trapDiscoveries={trapDiscoveries}
          />
        </div>
      </section>
    </>
  )
}
