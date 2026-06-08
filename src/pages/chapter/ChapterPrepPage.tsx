import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  getCurrentRank,
  getPrepSceneLabel,
  resolveChapterStatus,
  withQaMode,
} from '../../entities/chapter/lib/chapterProgress'
import { MissionLocked } from '../../features/chapter/LockedScreens'
import { useProgressByChapter } from '../../shared/lib/progress/useProgressByChapter'
import { useQaShortcutsEnabled } from '../../shared/lib/routing/useQaShortcutsEnabled'
import { GameHud } from '../../shared/ui/GameHud'
import { PixelPanel } from '../../shared/ui/PixelPanel'
import { ChapterNotFound } from '../system/SystemScreens'
import type { GamePageProps } from '../types'

const prepStartDelayMs = 15_000
const prepBootStepDelayMs = prepStartDelayMs / 4

const prepBootSteps = [
  {
    label: 'Маршрут сцены',
    detail: 'точка входа найдена',
  },
  {
    label: 'Опорные правила',
    detail: 'чек-лист подсвечен',
  },
  {
    label: 'Канал Kilian',
    detail: 'сигнал стабилен',
  },
  {
    label: 'Материалы',
    detail: 'ресурсы рядом',
  },
]

type PrepInstructionCarouselProps = {
  items: string[]
}

function formatRuleNumber(index: number) {
  return String(index + 1).padStart(2, '0')
}

function PrepInstructionCarousel({ items }: PrepInstructionCarouselProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<(HTMLLIElement | null)[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const activeRuleNumber = formatRuleNumber(activeIndex)
  const totalRuleNumber = formatRuleNumber(items.length - 1)

  function scrollToRule(index: number) {
    const nextIndex = Math.min(Math.max(index, 0), items.length - 1)
    const viewport = viewportRef.current
    const nextCard = cardRefs.current[nextIndex]

    setActiveIndex(nextIndex)

    if (!viewport || !nextCard) {
      return
    }

    const targetLeft =
      nextCard.getBoundingClientRect().left -
      viewport.getBoundingClientRect().left +
      viewport.scrollLeft

    viewport.scrollTo({ left: targetLeft })
  }

  function syncActiveRule() {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    const viewportLeft = viewport.getBoundingClientRect().left
    let closestIndex = 0
    let closestDistance = Number.POSITIVE_INFINITY

    cardRefs.current.forEach((card, index) => {
      if (!card) {
        return
      }

      const distance = Math.abs(card.getBoundingClientRect().left - viewportLeft)

      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    })

    setActiveIndex((currentIndex) =>
      currentIndex === closestIndex ? currentIndex : closestIndex,
    )
  }

  return (
    <section className="prep-instruction-carousel" aria-label="Опорные правила">
      <div className="prep-instruction-header">
        <span>KILIAN INSTRUCTION STACK</span>
        <strong>
          RULE {activeRuleNumber}/{totalRuleNumber}
        </strong>
      </div>

      <div className="prep-instruction-shell">
        <button
          aria-label="Предыдущее правило"
          className="prep-carousel-button"
          disabled={activeIndex === 0}
          onClick={() => scrollToRule(activeIndex - 1)}
          type="button"
        >
          ‹
        </button>
        <div
          className="prep-instruction-viewport"
          onScroll={syncActiveRule}
          ref={viewportRef}
          tabIndex={0}
        >
          <ol className="prep-instruction-track">
            {items.map((item, index) => (
              <li
                aria-current={activeIndex === index ? 'step' : undefined}
                className={`prep-instruction-card ${
                  activeIndex === index ? 'prep-instruction-card-active' : ''
                }`}
                key={item}
                ref={(card) => {
                  cardRefs.current[index] = card
                }}
              >
                <span>RULE {formatRuleNumber(index)}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </div>
        <button
          aria-label="Следующее правило"
          className="prep-carousel-button"
          disabled={activeIndex === items.length - 1}
          onClick={() => scrollToRule(activeIndex + 1)}
          type="button"
        >
          ›
        </button>
      </div>

      <div
        aria-label={`Правило ${activeIndex + 1} из ${items.length}`}
        className="prep-instruction-progress"
      >
        {items.map((item, index) => (
          <span
            className={
              activeIndex === index ? 'prep-instruction-dot-active' : undefined
            }
            key={item}
          />
        ))}
      </div>
    </section>
  )
}

export function ChapterPrepPage({
  chapters,
  learner,
  progress,
}: GamePageProps) {
  const { chapterId } = useParams()
  const qaShortcutsEnabled = useQaShortcutsEnabled()
  const [readyChapterId, setReadyChapterId] = useState<string | undefined>(
    qaShortcutsEnabled ? chapterId : undefined,
  )
  const progressByChapter = useProgressByChapter(progress)
  const chapter = chapters.find((item) => item.id === chapterId)
  const currentRank = getCurrentRank(chapters, progress)
  const isStartReady = qaShortcutsEnabled || readyChapterId === chapterId

  useEffect(() => {
    if (qaShortcutsEnabled) {
      return
    }

    const timerId = window.setTimeout(() => {
      setReadyChapterId(chapterId)
    }, prepStartDelayMs)

    return () => window.clearTimeout(timerId)
  }, [chapterId, qaShortcutsEnabled])

  if (!chapter) {
    return <ChapterNotFound />
  }

  const state = resolveChapterStatus(chapter, progressByChapter)
  const firstMission = chapter.missions[0] ?? chapter.boss

  if (state === 'locked') {
    return <MissionLocked chapter={chapter} learner={learner} rank={currentRank} />
  }

  if (!chapter.prep || !firstMission) {
    return <Navigate replace to={`/chapters/${chapter.id}`} />
  }

  const firstMissionHref = withQaMode(
    `/chapters/${chapter.id}/missions/${firstMission.id}`,
    qaShortcutsEnabled,
  )
  const prepStartStyle = {
    '--prep-start-delay': `${prepStartDelayMs}ms`,
  } as CSSProperties
  const startStateLabel = isStartReady ? 'Сигнал готов' : 'Идёт зарядка входа'
  const startHint = isStartReady
    ? 'Можно переходить к первой сцене.'
    : 'Станция прогоняет короткий брифинг перед стартом.'

  return (
    <>
      <GameHud
        eyebrow={getPrepSceneLabel(chapter)}
        learner={learner}
        rank={currentRank}
        title={chapter.prep.title}
      />

      <section className="chapter-stage" aria-label={chapter.prep.title}>
        <div className="screen-frame prep-screen">
          <div className="prep-layout">
            <PixelPanel className="prep-card">
              <div className="prep-hero">
                <div className="prep-hero-copy">
                  <p className="status-pill status-pill-open">
                    {isStartReady ? 'сигнал готов' : 'подготовка'}
                  </p>
                  <h2>{chapter.prep.summary}</h2>
                  <p>{chapter.prep.mentorNote}</p>
                </div>

                <div className="prep-boot-core" aria-hidden="true">
                  <span className="prep-boot-beam" />
                  <span className="prep-robot-head">
                    <span className="prep-robot-eye prep-robot-eye-left" />
                    <span className="prep-robot-eye prep-robot-eye-right" />
                    <span className="prep-robot-mouth" />
                  </span>
                  <span className="prep-spark prep-spark-one" />
                  <span className="prep-spark prep-spark-two" />
                  <span className="prep-spark prep-spark-three" />
                </div>
              </div>

              <div
                aria-label="Ход подготовки к первой сцене"
                className={`prep-boot-console ${
                  isStartReady ? 'prep-boot-console-ready' : ''
                }`}
                style={prepStartStyle}
              >
                <div className="prep-boot-console-header">
                  <span>Станция подготовки</span>
                  <strong>{startStateLabel}</strong>
                </div>
                <div className="prep-boot-meter" aria-hidden="true">
                  <span />
                </div>
                <ol className="prep-boot-steps">
                  {prepBootSteps.map((step, index) => (
                    <li
                      className="prep-boot-step"
                      key={step.label}
                      style={
                        {
                          '--boot-step-delay': `${prepBootStepDelayMs * index}ms`,
                        } as CSSProperties
                      }
                    >
                      <span>{step.label}</span>
                      <em>{step.detail}</em>
                    </li>
                  ))}
                </ol>
              </div>

              <PrepInstructionCarousel
                items={chapter.prep.checklist}
                key={chapter.id}
              />

              <div className="prep-actions">
                <Link
                  aria-disabled={!isStartReady}
                  aria-label={
                    isStartReady
                      ? 'К первой сцене'
                      : 'К первой сцене. Идёт зарядка входа'
                  }
                  className={`pixel-button prep-start-button ${
                    isStartReady ? 'prep-start-button-ready' : ''
                  }`}
                  key={chapter.id}
                  onClick={(event) => {
                    if (!isStartReady) {
                      event.preventDefault()
                    }
                  }}
                  style={prepStartStyle}
                  tabIndex={isStartReady ? undefined : -1}
                  to={firstMissionHref}
                >
                  <span className="prep-start-button-label">К первой сцене</span>
                  <span className="prep-start-button-state">{startStateLabel}</span>
                </Link>
                <Link
                  className="pixel-button pixel-button-secondary"
                  state={{ focusChapterId: chapter.id }}
                  to="/map"
                >
                  На карту
                </Link>
              </div>
              <p className="prep-start-hint">{startHint}</p>
            </PixelPanel>

            <PixelPanel className="prep-resources" title="Материалы перед стартом">
              <div className="resource-grid">
                {chapter.prep.resources.map((resource) => (
                  <a
                    className="resource-card"
                    href={resource.url}
                    key={resource.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span>
                      {resource.sourceLabel} · {resource.estimatedMinutes} мин
                    </span>
                    <strong>{resource.title}</strong>
                    <p>{resource.description}</p>
                  </a>
                ))}
              </div>
            </PixelPanel>
          </div>
        </div>
      </section>
    </>
  )
}
