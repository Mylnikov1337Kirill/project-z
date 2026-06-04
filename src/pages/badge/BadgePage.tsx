import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  getCurrentRank,
  resolveChapterStatus,
  withQaMode,
} from '../../entities/chapter/lib/chapterProgress'
import { getTrapConcept } from '../../entities/trap/model/trapConcepts'
import { BadgeLocked } from '../../features/chapter/LockedScreens'
import { useAppServices } from '../../shared/api/appServices/appServices'
import { useProgressByChapter } from '../../shared/lib/progress/useProgressByChapter'
import { useQaShortcutsEnabled } from '../../shared/lib/routing/useQaShortcutsEnabled'
import type {
  ChapterReflection,
  PublicChapter,
} from '../../shared/types/domain'
import { GameHud } from '../../shared/ui/GameHud'
import { PixelPanel } from '../../shared/ui/PixelPanel'
import { ChapterNotFound } from '../system/SystemScreens'
import type { GamePageProps } from '../types'
import { ChapterReflectionPanel } from './ChapterReflectionPanel'

type ReflectionState = {
  chapterId: string | null
  reflection: ChapterReflection | null
}

type RewardTone = NonNullable<PublicChapter['visual']>['tone']
type RewardCeremonyVariant = 'route-seal' | 'seal' | 'signal'

const ceremonyByTone: Record<RewardTone, RewardCeremonyVariant> = {
  blue: 'signal',
  gold: 'seal',
  green: 'route-seal',
  orange: 'seal',
  pink: 'seal',
  teal: 'signal',
  violet: 'signal',
}

export function BadgePage({ chapters, learner, progress }: GamePageProps) {
  const { chapterId } = useParams()
  const [searchParams] = useSearchParams()
  const { artifactService, progressRepository } = useAppServices()
  const [reflectionState, setReflectionState] = useState<ReflectionState>({
    chapterId: null,
    reflection: null,
  })
  const qaShortcutsEnabled = useQaShortcutsEnabled()
  const progressByChapter = useProgressByChapter(progress)
  const chapter = chapters.find((item) => item.id === chapterId)
  const activeChapterId = chapter?.id ?? null
  const currentRank = getCurrentRank(chapters, progress)
  const state = chapter
    ? resolveChapterStatus(chapter, progressByChapter)
    : 'locked'
  const reflection =
    reflectionState.chapterId === activeChapterId
      ? reflectionState.reflection
      : null
  const isReflectionLoading = Boolean(
    activeChapterId &&
      state === 'completed' &&
      reflectionState.chapterId !== activeChapterId,
  )
  const artifacts = useMemo(
    () =>
      chapter
        ? artifactService.createChapterArtifacts(chapter, { reflection })
        : [],
    [artifactService, chapter, reflection],
  )
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    null,
  )
  const selectedArtifact =
    artifacts.find((artifact) => artifact.id === selectedArtifactId) ??
    artifacts[0] ??
    null
  const completedChaptersCount = progress.filter(
    (item) => item.status === 'completed',
  ).length
  const isFinalCloseoutAvailable =
    chapter?.order === chapters.length &&
    completedChaptersCount === chapters.length
  const nextChapter = chapter
    ? chapters.find((item) => item.order === chapter.order + 1)
    : null
  const nextChapterStatus = nextChapter
    ? resolveChapterStatus(nextChapter, progressByChapter)
    : null
  const isReplayReward =
    searchParams.get('replay') === '1' ||
    completedChaptersCount > (chapter?.order ?? Number.POSITIVE_INFINITY)

  useEffect(() => {
    let isMounted = true

    if (!activeChapterId || state !== 'completed') {
      return () => {
        isMounted = false
      }
    }

    progressRepository
      .getChapterReflection({
        learnerId: learner.id,
        chapterId: activeChapterId,
      })
      .then((savedReflection) => {
        if (isMounted) {
          setReflectionState({
            chapterId: activeChapterId,
            reflection: savedReflection,
          })
        }
      })

    return () => {
      isMounted = false
    }
  }, [activeChapterId, learner.id, progressRepository, state])

  const saveReflection = useCallback(
    async (draft: {
      optionId: string | null
      optionLabel: string | null
      note: string
      skipped: boolean
    }) => {
      if (!chapter) {
        return
      }

      const savedReflection = await progressRepository.saveChapterReflection({
        learnerId: learner.id,
        chapterId: chapter.id,
        ...draft,
      })

      setReflectionState({
        chapterId: chapter.id,
        reflection: savedReflection,
      })
    },
    [chapter, learner.id, progressRepository],
  )

  const skipReflection = useCallback(async () => {
    await saveReflection({
      optionId: null,
      optionLabel: null,
      note: '',
      skipped: true,
    })
  }, [saveReflection])

  if (!chapter) {
    return <ChapterNotFound />
  }

  function handleDownload() {
    if (!selectedArtifact) {
      return
    }

    const blob = new Blob([selectedArtifact.content], {
      type: 'text/markdown;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = selectedArtifact.fileName
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  if (state !== 'completed') {
    return (
      <BadgeLocked chapter={chapter} learner={learner} rank={currentRank} />
    )
  }

  const reward = chapter.reward
  const rewardTone = chapter.visual?.tone ?? 'gold'
  const rewardCeremony = ceremonyByTone[rewardTone]
  const shouldPlayCeremony =
    searchParams.get('earned') === '1' && !isReplayReward
  const chapterNumber = String(chapter.order).padStart(2, '0')
  const recap = chapter.recap
  const recapTrap = getTrapConcept(recap.commonTrap.trapId)

  return (
    <>
      <GameHud
        eyebrow="Награда получена"
        learner={learner}
        rank={currentRank}
        title={chapter.badgeName}
      />

      <section className="chapter-stage" aria-label="Экран награды">
        <div className="screen-frame badge-screen">
          <div className="badge-layout">
            <PixelPanel
              className={`badge-card badge-card-${rewardTone} badge-ceremony-${rewardCeremony} ${
                shouldPlayCeremony ? 'badge-card-earned' : 'badge-card-static'
              }`}
            >
              <div className="badge-card-topline">
                <p className="status-pill status-pill-completed">глава пройдена</p>
                <span className="badge-card-number">#{chapterNumber}</span>
              </div>

              <div className="badge-card-motif-row">
                <span>{reward.motif}</span>
                <span>{chapter.title}</span>
              </div>

              <div className="badge-emblem-block">
                <div className="badge-emblem" aria-hidden="true">
                  <span>{reward.emblem}</span>
                  {rewardCeremony === 'route-seal' ? (
                    <span className="badge-route-mark" />
                  ) : null}
                </div>
                <div className="badge-emblem-copy">
                  <p className="badge-card-label">награда главы</p>
                  <h2>{chapter.badgeName}</h2>
                </div>
              </div>

              <p className="badge-motto">«{reward.motto}»</p>
              <p className="badge-skill">{reward.skill}</p>

              <div className="badge-mastery" aria-label="Ты теперь умеешь">
                <span className="badge-mastery-kicker">
                  Z-бот фиксирует навык
                </span>
                <h3>Ты теперь умеешь</h3>
                <ul>
                  {reward.masteryActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>

              <div
                className="badge-stats"
                aria-label={
                  isReplayReward
                    ? 'Статус повторной награды'
                    : 'Прогресс после награды'
                }
              >
                {isReplayReward ? (
                  <>
                    <span>Повтор главы: награда уже в коллекции</span>
                    <span>Ранг этой главы: {chapter.rankAfterCompletion}</span>
                  </>
                ) : (
                  <>
                    <span>
                      Закрыто глав: {completedChaptersCount} / {chapters.length}
                    </span>
                    <span>Новый ранг: {currentRank}</span>
                    {nextChapter && nextChapterStatus === 'open' ? (
                      <span>
                        Открыта глава{' '}
                        {String(nextChapter.order).padStart(2, '0')}:{' '}
                        {nextChapter.title}
                      </span>
                    ) : null}
                  </>
                )}
              </div>

              <div className="badge-actions">
                {isFinalCloseoutAvailable ? (
                  <Link
                    className="pixel-button"
                    to={withQaMode('/course/complete', qaShortcutsEnabled)}
                  >
                    Архив глав
                  </Link>
                ) : null}
                <Link
                  className={
                    isFinalCloseoutAvailable
                      ? 'pixel-button pixel-button-secondary'
                      : 'pixel-button'
                  }
                  state={{ focusChapterId: chapter.id }}
                  to="/map"
                >
                  На карту
                </Link>
                <Link
                  className="pixel-button pixel-button-secondary"
                  to="/leaderboard"
                >
                  Доска лидеров
                </Link>
                <Link
                  className="pixel-button pixel-button-secondary"
                  to={withQaMode(
                    `/chapters/${chapter.id}/prep`,
                    qaShortcutsEnabled,
                  )}
                >
                  Повторить главу
                </Link>
              </div>
            </PixelPanel>

            <div className="badge-side-stack">
              <PixelPanel className="chapter-recap-card" title="Короткий итог главы">
                <div className="chapter-recap-grid">
                  <div className="chapter-recap-rules">
                    <span>Что забрать</span>
                    <ul>
                      {recap.rules.map((rule) => (
                        <li key={rule}>{rule}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="chapter-recap-trap">
                    <span>Частая ловушка</span>
                    <strong>{recapTrap?.label ?? 'Ловушка курса'}</strong>
                    <p>{recap.commonTrap.note}</p>
                  </div>
                </div>

                <div className="chapter-recap-next">
                  <span>Завтра</span>
                  <p>{recap.nextMove}</p>
                </div>
              </PixelPanel>

              <ChapterReflectionPanel
                chapterId={chapter.id}
                isLoading={isReflectionLoading}
                key={chapter.id}
                onSave={saveReflection}
                onSkip={skipReflection}
                reflection={reflection}
              />

              {selectedArtifact ? (
                <PixelPanel
                  className="artifact-card"
                  title={selectedArtifact.title}
                >
                  <p>{selectedArtifact.description}</p>
                  {artifacts.length > 1 ? (
                    <div
                      aria-label="Файлы главы"
                      className="artifact-selector"
                    >
                      {artifacts.map((artifact) => (
                        <button
                          aria-pressed={selectedArtifact.id === artifact.id}
                          className="artifact-selector-option"
                          key={artifact.id}
                          onClick={() => setSelectedArtifactId(artifact.id)}
                          type="button"
                        >
                          {artifact.fileName}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="artifact-toolbar">
                    <span>{selectedArtifact.fileName}</span>
                    <button
                      className="pixel-button"
                      onClick={handleDownload}
                      type="button"
                    >
                      Скачать .md
                    </button>
                  </div>
                  <pre className="artifact-preview">{selectedArtifact.content}</pre>
                </PixelPanel>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
