import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAppServices } from '../../shared/api/appServices/appServices'
import type {
  ChapterProgress,
  Learner,
  PublicChapter,
  TrapConceptId,
} from '../../shared/types/domain'
import {
  GameStateContext,
  type IdentifyInput,
} from './gameStateContext'

type GameStateProviderProps = {
  children: ReactNode
}

export function GameStateProvider({ children }: GameStateProviderProps) {
  const { contentRepository, progressRepository } = useAppServices()
  const [chapters, setChapters] = useState<PublicChapter[]>([])
  const [contentVersion, setContentVersion] = useState('')
  const [encounteredTrapIds, setEncounteredTrapIds] = useState<TrapConceptId[]>(
    [],
  )
  const [learner, setLearner] = useState<Learner | null>(null)
  const [progress, setProgress] = useState<ChapterProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refreshProgress = useCallback(
    async (learnerId: string) => {
      const nextProgress = await progressRepository.getProgress(learnerId)
      setProgress(nextProgress)
      return nextProgress
    },
    [progressRepository],
  )
  const replaceProgress = useCallback((nextProgress: ChapterProgress[]) => {
    setProgress(nextProgress)
  }, [])
  const replaceEncounteredTrapIds = useCallback(
    (nextTrapIds: TrapConceptId[]) => {
      setEncounteredTrapIds(Array.from(new Set(nextTrapIds)))
    },
    [],
  )
  const refreshEncounteredTrapIds = useCallback(
    async (learnerId: string) => {
      const nextTrapIds =
        await progressRepository.getEncounteredTrapIds(learnerId)
      const uniqueTrapIds = Array.from(new Set(nextTrapIds))

      setEncounteredTrapIds(uniqueTrapIds)
      return uniqueTrapIds
    },
    [progressRepository],
  )
  const recordTrapDiscoveries = useCallback(
    (discoveries: { id: TrapConceptId }[]) => {
      if (discoveries.length === 0) {
        return
      }

      setEncounteredTrapIds((currentTrapIds) =>
        Array.from(
          new Set([
            ...currentTrapIds,
            ...discoveries.map((discovery) => discovery.id),
          ]),
        ),
      )
    },
    [],
  )

  useEffect(() => {
    let isMounted = true

    async function loadGameState() {
      try {
        const [loadedChapters, loadedContentVersion, savedLearner] =
          await Promise.all([
            contentRepository.listChapters(),
            contentRepository.getContentVersion(),
            progressRepository.getLearner(),
          ])
        const [savedProgress, savedTrapIds] = savedLearner
          ? await Promise.all([
              progressRepository.getProgress(savedLearner.id),
              progressRepository
                .getEncounteredTrapIds(savedLearner.id)
                .catch(() => []),
            ])
          : [[], []]

        if (!isMounted) {
          return
        }

        setChapters(loadedChapters)
        setContentVersion(loadedContentVersion)
        setEncounteredTrapIds(Array.from(new Set(savedTrapIds)))
        setLearner(savedLearner)
        setProgress(savedProgress)
      } catch (error) {
        if (isMounted) {
          setLoadError(
            error instanceof Error ? error.message : 'Не удалось загрузить игру',
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadGameState()

    return () => {
      isMounted = false
    }
  }, [contentRepository, progressRepository])

  const identify = useCallback(
    async (input: IdentifyInput) => {
      const nextLearner = await progressRepository.identify(input)
      const [nextProgress, nextTrapIds] = await Promise.all([
        refreshProgress(nextLearner.id),
        refreshEncounteredTrapIds(nextLearner.id).catch(() => []),
      ])

      setLearner(nextLearner)
      setEncounteredTrapIds(nextTrapIds)
      setProgress(nextProgress)
    },
    [progressRepository, refreshEncounteredTrapIds, refreshProgress],
  )

  const value = useMemo(
    () => ({
      chapters,
      contentVersion,
      encounteredTrapIds,
      learner,
      progress,
      isLoading,
      loadError,
      identify,
      recordTrapDiscoveries,
      replaceEncounteredTrapIds,
      replaceProgress,
      refreshEncounteredTrapIds,
      refreshProgress,
    }),
    [
      chapters,
      contentVersion,
      encounteredTrapIds,
      learner,
      progress,
      isLoading,
      loadError,
      identify,
      recordTrapDiscoveries,
      replaceEncounteredTrapIds,
      replaceProgress,
      refreshEncounteredTrapIds,
      refreshProgress,
    ],
  )

  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  )
}
