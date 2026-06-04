import { createContext, useContext } from 'react'
import type {
  ChapterProgress,
  Learner,
  PublicChapter,
  TrapConceptId,
} from '../../shared/types/domain'

export type IdentifyInput = {
  nickname: string
  fullName: string
}

export type GameStateContextValue = {
  chapters: PublicChapter[]
  contentVersion: string
  encounteredTrapIds: TrapConceptId[]
  learner: Learner | null
  progress: ChapterProgress[]
  isLoading: boolean
  loadError: string | null
  identify(input: IdentifyInput): Promise<void>
  recordTrapDiscoveries(discoveries: { id: TrapConceptId }[]): void
  replaceEncounteredTrapIds(nextTrapIds: TrapConceptId[]): void
  replaceProgress(nextProgress: ChapterProgress[]): void
  refreshEncounteredTrapIds(learnerId: string): Promise<TrapConceptId[]>
  refreshProgress(learnerId: string): Promise<ChapterProgress[]>
}

export const GameStateContext =
  createContext<GameStateContextValue | null>(null)

export function useGameState() {
  const context = useContext(GameStateContext)

  if (!context) {
    throw new Error('useGameState must be used inside GameStateProvider')
  }

  return context
}
