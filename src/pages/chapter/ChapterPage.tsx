import { Link, useParams } from 'react-router-dom'
import {
  formatChapterStatus,
  formatMissionListItemStatus,
  getChapterIntroCopy,
  getChapterStartHref,
  getCompletedMissionIds,
  getCurrentRank,
  getMissionListItemState,
  getMissionSceneNumber,
  getNextPlayableMission,
  getSceneNumber,
  isPrepCurrentStep,
  isChapterPracticeReady,
  resolveChapterStatus,
  shouldStartChapterAtPrep,
  withQaMode,
} from '../../entities/chapter/lib/chapterProgress'
import { useProgressByChapter } from '../../shared/lib/progress/useProgressByChapter'
import { useQaShortcutsEnabled } from '../../shared/lib/routing/useQaShortcutsEnabled'
import { GameHud } from '../../shared/ui/GameHud'
import { MentorDialog } from '../../shared/ui/MentorDialog'
import { PixelPanel } from '../../shared/ui/PixelPanel'
import { ChapterNotFound } from '../system/SystemScreens'
import type { GamePageProps } from '../types'

export function ChapterPage({ chapters, learner, progress }: GamePageProps) {
  const { chapterId } = useParams()
  const qaShortcutsEnabled = useQaShortcutsEnabled()
  const progressByChapter = useProgressByChapter(progress)
  const chapter = chapters.find((item) => item.id === chapterId)
  const currentRank = getCurrentRank(chapters, progress)

  if (!chapter) {
    return <ChapterNotFound />
  }

  const state = resolveChapterStatus(chapter, progressByChapter)
  const isLocked = state === 'locked'
  const isPracticeReady = isChapterPracticeReady(chapter)
  const completedMissionIds = getCompletedMissionIds(chapter, progress)
  const nextMission =
    state === 'completed'
      ? chapter.missions[0]
      : getNextPlayableMission(chapter, completedMissionIds)
  const isPrepCurrent = isPrepCurrentStep(
    chapter,
    completedMissionIds,
    state,
  )
  const shouldStartAtPrep = shouldStartChapterAtPrep(
    chapter,
    completedMissionIds,
    state,
  )
  const startHref = getChapterStartHref(
    chapter,
    nextMission,
    shouldStartAtPrep,
    qaShortcutsEnabled,
  )
  const startLabel =
    state === 'completed'
      ? 'Повторить главу'
      : shouldStartAtPrep
        ? 'Начать брифинг'
        : 'Продолжить сцену'
  const mentorTitle =
    state === 'completed'
      ? 'Награда уже твоя'
      : isLocked
        ? 'Эта зона пока закрыта'
        : isPracticeReady
          ? 'Брифинг перед практикой'
          : 'Следующая тема открыта'
  const mentorCopy =
    state === 'completed'
      ? `Глава закрыта, навык зафиксирован. Справа лежит твоя награда «${chapter.badgeName}» — открой её, чтобы вернуться к карточке, итогу и артефакту.`
      : isLocked
        ? 'Сначала закрой предыдущие практики. Карта показывает маршрут по порядку.'
        : getChapterIntroCopy(chapter, isPracticeReady)
  const prepSceneNumber = getSceneNumber(chapter, 0)
  const rewardHref = withQaMode(
    `/chapters/${chapter.id}/badge?replay=1`,
    qaShortcutsEnabled,
  )
  const rewardTone = chapter.visual?.tone ?? 'gold'

  return (
    <>
      <GameHud
        eyebrow={`Глава ${String(chapter.order).padStart(2, '0')}`}
        learner={learner}
        rank={currentRank}
        title={chapter.title}
      />

      <section className="chapter-stage" aria-label={`Глава ${chapter.title}`}>
        <div className={`screen-frame chapter-screen chapter-screen-${state}`}>
          <MentorDialog eyebrow="Kilian" title={mentorTitle}>
            <p>{mentorCopy}</p>
          </MentorDialog>

          {state === 'completed' ? (
            <aside
              aria-label="Витрина награды главы"
              className={`chapter-side-stage chapter-reward-showcase chapter-reward-showcase-${rewardTone}`}
            >
              <div className="chapter-reward-topline">
                <span>награда заработана</span>
                <strong>#{String(chapter.order).padStart(2, '0')}</strong>
              </div>

              <div className="chapter-reward-display">
                <div className="chapter-reward-emblem" aria-hidden="true">
                  <span>{chapter.reward.emblem}</span>
                </div>
                <div className="chapter-reward-copy">
                  <span>{chapter.reward.motif}</span>
                  <h3>{chapter.badgeName}</h3>
                  <p>{chapter.reward.skill}</p>
                </div>
              </div>

              <div className="chapter-reward-meta">
                <span>Ранг: {chapter.rankAfterCompletion}</span>
                <span>Глава пройдена</span>
              </div>

              <Link className="pixel-button" to={rewardHref}>
                Открыть награду
              </Link>
            </aside>
          ) : (
            <aside
              aria-label="Kilian патрулирует главу"
              className={`chapter-side-stage chapter-patrol-zone chapter-patrol-zone-${state}`}
            >
              <div className="chapter-patrol-track" aria-hidden="true">
                <div className="chapter-patrol-bot">
                  <span className="chapter-patrol-eye chapter-patrol-eye-left" />
                  <span className="chapter-patrol-eye chapter-patrol-eye-right" />
                  <span className="chapter-patrol-foot chapter-patrol-foot-left" />
                  <span className="chapter-patrol-foot chapter-patrol-foot-right" />
                </div>
              </div>
            </aside>
          )}

          <PixelPanel className="chapter-card">
            <p className={`status-pill status-pill-${state}`}>
              {formatChapterStatus(state)}
            </p>
            <h2>{chapter.title}</h2>
            <p>{chapter.summary}</p>

            <div className="chapter-meta">
              <span>Награда: {chapter.badgeName}</span>
              <span>Ранг после главы: {chapter.rankAfterCompletion}</span>
            </div>

            {isLocked ? (
              <p className="chapter-note">
                Узел виден на карте, но маршрут ещё не дошёл до этой практики.
              </p>
            ) : !isPracticeReady ? (
              <p className="chapter-note">
                Тема отмечена на карте. Сначала закрой текущую практику, а
                затем возвращайся к следующему узлу маршрута.
              </p>
            ) : (
              <ul className="mission-list" aria-label="Список практик главы">
                {chapter.prep ? (
                  <li
                    className={`mission-list-prep ${
                      state === 'completed' || completedMissionIds.size > 0
                        ? 'mission-list-completed'
                        : isPrepCurrent
                          ? 'mission-list-current'
                          : 'mission-list-open'
                    }`}
                  >
                    <span>
                      {state === 'completed' || completedMissionIds.size > 0
                        ? `${prepSceneNumber} · готово`
                        : isPrepCurrent
                          ? `${prepSceneNumber} · сейчас`
                          : `${prepSceneNumber} · открыто`}
                    </span>
                    <Link
                      aria-current={isPrepCurrent ? 'step' : undefined}
                      to={withQaMode(
                        `/chapters/${chapter.id}/prep`,
                        qaShortcutsEnabled,
                      )}
                    >
                      {chapter.prep.title}
                    </Link>
                  </li>
                ) : null}
                {chapter.missions.map((mission, index) => {
                  const missionState = getMissionListItemState({
                    chapter,
                    completedMissionIds,
                    mission,
                    nextMission,
                    status: state,
                  })
                  const canOpen = missionState !== 'locked'
                  const isCurrent = missionState === 'current'

                  return (
                    <li
                      className={`mission-list-${missionState}`}
                      key={mission.id}
                    >
                      <span>
                        {formatMissionListItemStatus({
                          isFinal: false,
                          sceneNumber: getSceneNumber(chapter, index + 1),
                          state: missionState,
                        })}
                      </span>
                      {canOpen ? (
                        <Link
                          aria-current={isCurrent ? 'step' : undefined}
                          to={
                            isPrepCurrent && index === 0
                              ? withQaMode(
                                  `/chapters/${chapter.id}/prep`,
                                  qaShortcutsEnabled,
                                )
                              : withQaMode(
                                  `/chapters/${chapter.id}/missions/${mission.id}`,
                                  qaShortcutsEnabled,
                                )
                          }
                        >
                          {mission.title}
                        </Link>
                      ) : (
                        <strong>{mission.title}</strong>
                      )}
                    </li>
                  )
                })}
                {(() => {
                  const bossState = getMissionListItemState({
                    chapter,
                    completedMissionIds,
                    mission: chapter.boss,
                    nextMission,
                    status: state,
                  })
                  const canOpenBoss = bossState !== 'locked'

                  return (
                    <li
                      className={`mission-list-boss mission-list-final mission-list-${bossState}`}
                    >
                      <span>
                        {formatMissionListItemStatus({
                          isFinal: true,
                          sceneNumber: getMissionSceneNumber(
                            chapter,
                            chapter.boss,
                          ),
                          state: bossState,
                        })}
                      </span>
                      {canOpenBoss ? (
                        <Link
                          aria-current={
                            bossState === 'current' ? 'step' : undefined
                          }
                          to={withQaMode(
                            `/chapters/${chapter.id}/missions/${chapter.boss.id}`,
                            qaShortcutsEnabled,
                          )}
                        >
                          {chapter.boss.title}
                        </Link>
                      ) : (
                        <strong>{chapter.boss.title}</strong>
                      )}
                    </li>
                  )
                })()}
              </ul>
            )}

            {!isLocked && isPracticeReady && nextMission ? (
              <Link className="pixel-button" to={startHref}>
                {startLabel}
              </Link>
            ) : null}

            <Link
              className="pixel-button pixel-button-secondary"
              state={{ focusChapterId: chapter.id }}
              to="/map"
            >
              Назад на карту
            </Link>
          </PixelPanel>
        </div>
      </section>
    </>
  )
}
