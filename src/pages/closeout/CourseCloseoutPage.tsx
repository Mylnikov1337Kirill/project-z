import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { isCourseCompleted } from '../../entities/chapter/lib/courseCloseout'
import {
  getCurrentRank,
  withQaMode,
} from '../../entities/chapter/lib/chapterProgress'
import type { ArtifactExport } from '../../shared/api/artifacts/ArtifactService'
import { useAppServices } from '../../shared/api/appServices/appServices'
import { useQaShortcutsEnabled } from '../../shared/lib/routing/useQaShortcutsEnabled'
import type { ChapterReflection } from '../../shared/types/domain'
import { GameHud } from '../../shared/ui/GameHud'
import { PixelPanel } from '../../shared/ui/PixelPanel'
import type { GamePageProps } from '../types'

type CloseoutDataState = {
  dataKey: string | null
  error: string | null
  reflections: ChapterReflection[]
}

type CourseCloseoutArtifact = ArtifactExport & {
  artifactKey: string
  badgeName: string
  chapterId: string
  chapterOrder: number
  chapterTitle: string
  skill: string
}

const initialCloseoutData: CloseoutDataState = {
  dataKey: null,
  error: null,
  reflections: [],
}

export function CourseCloseoutPage({
  chapters,
  learner,
  progress,
}: GamePageProps) {
  const qaShortcutsEnabled = useQaShortcutsEnabled()
  const { artifactService, progressRepository } = useAppServices()
  const currentRank = getCurrentRank(chapters, progress)
  const isCompleted = isCourseCompleted({ chapters, progress })
  const closeoutDataKey = `${learner.id}:${chapters
    .map((chapter) => chapter.id)
    .join('|')}:${progress
    .map((item) => `${item.chapterId}:${item.status}`)
    .join('|')}`
  const [dataState, setDataState] =
    useState<CloseoutDataState>(initialCloseoutData)
  const isCloseoutDataReady = dataState.dataKey === closeoutDataKey
  const isCloseoutLoading = isCompleted && !isCloseoutDataReady
  const completedChaptersCount = progress.filter(
    (item) => item.status === 'completed',
  ).length
  const reflectionByChapter = useMemo(() => {
    const reflectionMap = new Map<string, ChapterReflection>()

    if (!isCloseoutDataReady) {
      return reflectionMap
    }

    for (const reflection of dataState.reflections) {
      reflectionMap.set(reflection.chapterId, reflection)
    }

    return reflectionMap
  }, [dataState.reflections, isCloseoutDataReady])
  const artifacts = useMemo<CourseCloseoutArtifact[]>(
    () =>
      chapters.flatMap((chapter) => {
        const chapterArtifacts = artifactService.createChapterArtifacts(chapter, {
          reflection: reflectionByChapter.get(chapter.id) ?? null,
        })

        return chapterArtifacts.map((artifact) => ({
          ...artifact,
          artifactKey: `${chapter.id}:${artifact.id}`,
          badgeName: chapter.badgeName,
          chapterId: chapter.id,
          chapterOrder: chapter.order,
          chapterTitle: chapter.title,
          skill: chapter.reward.skill,
        }))
      }),
    [artifactService, chapters, reflectionByChapter],
  )
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    null,
  )
  const selectedArtifact =
    artifacts.find((artifact) => artifact.artifactKey === selectedArtifactId) ??
    artifacts[0] ??
    null
  const selectedArtifactPosition = selectedArtifact
    ? artifacts.findIndex(
        (artifact) => artifact.artifactKey === selectedArtifact.artifactKey,
      ) + 1
    : 0

  useEffect(() => {
    let isMounted = true

    if (!isCompleted) {
      return () => {
        isMounted = false
      }
    }

    async function loadCloseoutData() {
      try {
        const reflections = await Promise.all(
          chapters.map((chapter) =>
            progressRepository.getChapterReflection({
              chapterId: chapter.id,
              learnerId: learner.id,
            }),
          ),
        )

        if (!isMounted) {
          return
        }

        setDataState({
          dataKey: closeoutDataKey,
          error: null,
          reflections: reflections.filter(
            (reflection): reflection is ChapterReflection =>
              reflection !== null,
          ),
        })
      } catch {
        if (isMounted) {
          setDataState({
            dataKey: closeoutDataKey,
            error: 'Kilian не смог загрузить локальные заметки.',
            reflections: [],
          })
        }
      }
    }

    void loadCloseoutData()

    return () => {
      isMounted = false
    }
  }, [chapters, closeoutDataKey, isCompleted, learner.id, progressRepository])

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

  if (!isCompleted) {
    return (
      <>
        <GameHud
          eyebrow="Архив глав"
          learner={learner}
          rank={currentRank}
          title="Маршрут ещё открыт"
        />

        <section className="chapter-stage" aria-label="Архив глав закрыт">
          <div className="screen-frame closeout-screen closeout-screen-locked">
            <PixelPanel className="closeout-locked-card">
              <p className="status-pill status-pill-locked">закрыто</p>
              <h2>
                Архив глав ждёт {chapters.length}/{chapters.length}
              </h2>
              <p>
                Сначала закрой все главы маршрута. После последней награды здесь
                появятся markdown-файлы глав с локальными заметками.
              </p>
              <Link
                className="pixel-button"
                to={withQaMode('/map', qaShortcutsEnabled)}
              >
                На карту
              </Link>
            </PixelPanel>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <GameHud
        eyebrow="Маршрут закрыт"
        learner={learner}
        rank={currentRank}
        title="Архив глав"
      />

      <section className="chapter-stage" aria-label="Архив глав Agent Trail">
        <div className="screen-frame closeout-screen">
          <div className="closeout-layout">
            <PixelPanel className="closeout-library-card" title="Файлы глав">
              <p className="status-pill status-pill-completed">
                {completedChaptersCount}/{chapters.length} закрыто
              </p>

              <p className="closeout-library-intro">
                Выбери шаблон из любой главы, проверь превью и скачай отдельный
                md-файл для своей рабочей задачи.
              </p>

              <div className="closeout-metrics" aria-label="Сводка файлов">
                <span>
                  <strong>
                    {completedChaptersCount}/{chapters.length}
                  </strong>
                  главы закрыты
                </span>
                <span>
                  <strong>{artifacts.length}</strong>
                  md-файлов
                </span>
              </div>

              <ol
                aria-label="Список md-файлов глав"
                className="closeout-artifact-list"
              >
                {artifacts.map((artifact) => {
                  const isSelected =
                    selectedArtifact?.artifactKey === artifact.artifactKey

                  return (
                    <li key={artifact.artifactKey}>
                      <button
                        aria-pressed={isSelected}
                        className="closeout-artifact-option"
                        disabled={isCloseoutLoading}
                        onClick={() =>
                          setSelectedArtifactId(artifact.artifactKey)
                        }
                        type="button"
                      >
                        <span className="closeout-artifact-number">
                          #{String(artifact.chapterOrder).padStart(2, '0')}
                        </span>
                        <span className="closeout-artifact-copy">
                          <strong>{artifact.fileName}</strong>
                          <span>{artifact.chapterTitle}</span>
                          <small>{artifact.badgeName}</small>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>

              <div className="closeout-actions">
                <Link
                  className="pixel-button"
                  to={withQaMode('/map', qaShortcutsEnabled)}
                >
                  На карту
                </Link>
                <Link
                  className="pixel-button pixel-button-secondary"
                  to={withQaMode('/leaderboard', qaShortcutsEnabled)}
                >
                  Доска лидеров
                </Link>
              </div>

              {dataState.error ? (
                <p className="closeout-data-note">{dataState.error}</p>
              ) : isCloseoutLoading ? (
                <p className="closeout-data-note">
                  Kilian собирает локальные заметки...
                </p>
              ) : null}
            </PixelPanel>

            <PixelPanel
              className="closeout-preview-card"
              title={selectedArtifact?.title ?? 'Превью файла'}
            >
              {selectedArtifact ? (
                <>
                  <div className="closeout-selected-meta">
                    <span>
                      Глава {selectedArtifact.chapterOrder} /{' '}
                      {selectedArtifact.chapterTitle}
                    </span>
                    <strong>
                      {selectedArtifactPosition}/{artifacts.length}
                    </strong>
                  </div>
                  <p className="closeout-selected-skill">
                    {selectedArtifact.skill}
                  </p>
                  <p className="closeout-selected-description">
                    {selectedArtifact.description}
                  </p>
                  <div className="artifact-toolbar">
                    <span>{selectedArtifact.fileName}</span>
                    <button
                      className="pixel-button"
                      disabled={isCloseoutLoading}
                      onClick={handleDownload}
                      type="button"
                    >
                      Скачать .md
                    </button>
                  </div>
                  <pre className="closeout-artifact-preview">{selectedArtifact.content}</pre>
                </>
              ) : (
                <div className="closeout-empty-state">
                  <p>Для пройденных глав пока не настроены markdown-файлы.</p>
                  <Link
                    className="pixel-button"
                    to={withQaMode('/map', qaShortcutsEnabled)}
                  >
                    На карту
                  </Link>
                </div>
              )}
            </PixelPanel>
          </div>
        </div>
      </section>
    </>
  )
}
