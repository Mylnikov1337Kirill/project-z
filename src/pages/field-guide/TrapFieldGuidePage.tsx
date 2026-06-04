import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentRank } from '../../entities/chapter/lib/chapterProgress'
import {
  getTrapConceptsByIds,
  trapConceptList,
} from '../../entities/trap/model/trapConcepts'
import { useAppServices } from '../../shared/api/appServices/appServices'
import { GameHud } from '../../shared/ui/GameHud'
import { PixelPanel } from '../../shared/ui/PixelPanel'
import type { TrapConceptId } from '../../shared/types/domain'
import type { GamePageProps } from '../types'

type LoadedTrapGuideState = {
  learnerId: string
  trapIds: TrapConceptId[]
}

function mergeTrapIds(...trapIdLists: TrapConceptId[][]) {
  return Array.from(new Set(trapIdLists.flat()))
}

export function TrapFieldGuidePage({
  chapters,
  encounteredTrapIds: initialEncounteredTrapIds = [],
  learner,
  onEncounteredTrapIdsChange,
  progress,
}: GamePageProps) {
  const currentRank = getCurrentRank(chapters, progress)
  const { progressRepository } = useAppServices()
  const [loadedTrapGuideState, setLoadedTrapGuideState] =
    useState<LoadedTrapGuideState | null>(null)
  const encounteredTrapIds = useMemo(() => {
    const persistedTrapIds =
      loadedTrapGuideState?.learnerId === learner.id
        ? loadedTrapGuideState.trapIds
        : []

    return mergeTrapIds(initialEncounteredTrapIds, persistedTrapIds)
  }, [initialEncounteredTrapIds, learner.id, loadedTrapGuideState])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const discoveredTrapConcepts = useMemo(
    () => getTrapConceptsByIds(encounteredTrapIds),
    [encounteredTrapIds],
  )
  const hiddenTrapCount = trapConceptList.length - discoveredTrapConcepts.length

  useEffect(() => {
    let isMounted = true

    async function loadTrapMemory() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const trapIds = await progressRepository.getEncounteredTrapIds(
          learner.id,
        )

        if (isMounted) {
          setLoadedTrapGuideState({ learnerId: learner.id, trapIds })
          onEncounteredTrapIdsChange?.(trapIds)
        }
      } catch {
        if (isMounted) {
          setLoadError(
            'Z-бот не смог открыть записи ловушек. Вернись на карту и попробуй ещё раз.',
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadTrapMemory()

    return () => {
      isMounted = false
    }
  }, [learner.id, onEncounteredTrapIdsChange, progressRepository])

  return (
    <>
      <GameHud
        actions={
          <>
            <Link className="hud-link" to="/map">
              На карту
            </Link>
            <Link className="hud-link" to="/leaderboard">
              Доска лидеров
            </Link>
          </>
        }
        eyebrow="Память маршрута"
        learner={learner}
        rank={currentRank}
        title="Справочник ловушек"
      />

      <section className="chapter-stage" aria-label="Справочник ловушек">
        <div className="screen-frame trap-guide-screen">
          <div className="trap-guide-layout">
            <PixelPanel className="trap-guide-summary">
              <p className="status-pill status-pill-open">записи Z-бота</p>
              <h2>Пойманные сигналы</h2>
              <p>
                Здесь остаются повторяемые ловушки, которые уже встретились в
                сценах. Остальные сигналы скрыты до первой встречи.
              </p>

              <div
                className="trap-guide-metrics"
                aria-label="Прогресс справочника"
              >
                <span>
                  <strong>{discoveredTrapConcepts.length}</strong>
                  открыто
                </span>
                <span>
                  <strong>{hiddenTrapCount}</strong>
                  скрыто
                </span>
              </div>

              <Link className="pixel-button" to="/map">
                Вернуться на карту
              </Link>
            </PixelPanel>

            <PixelPanel
              className="trap-guide-list-card"
              title="Открытые ловушки"
            >
              {isLoading ? (
                <p className="trap-guide-message trap-guide-message-loading">
                  Z-бот сверяет записи...
                </p>
              ) : loadError ? (
                <p className="trap-guide-message trap-guide-message-error">
                  {loadError}
                </p>
              ) : discoveredTrapConcepts.length === 0 ? (
                <p className="trap-guide-message trap-guide-message-empty">
                  Записей пока нет. Когда в сцене встретится повторяемая
                  ловушка, Z-бот добавит её сюда.
                </p>
              ) : (
                <ol className="trap-guide-list" aria-label="Открытые ловушки">
                  {discoveredTrapConcepts.map((concept, index) => (
                    <li className="trap-guide-item" key={concept.id}>
                      <span className="trap-guide-index">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <strong>{concept.label}</strong>
                        <p>{concept.description}</p>
                      </div>
                      <span className="trap-guide-item-state">найдена</span>
                    </li>
                  ))}
                </ol>
              )}
            </PixelPanel>
          </div>
        </div>
      </section>
    </>
  )
}
