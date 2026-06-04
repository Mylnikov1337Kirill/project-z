import { createContext, useContext } from 'react'
import type { ArtifactService } from '../artifacts/ArtifactService'
import type { ContentRepository } from '../content/ContentRepository'
import type { MissionAttemptService } from '../missions/MissionAttemptService'
import type { ProgressRepository } from '../progress/ProgressRepository'

export type AppServices = {
  artifactService: ArtifactService
  contentRepository: ContentRepository
  missionAttemptService: MissionAttemptService
  progressRepository: ProgressRepository
}

export const AppServicesContext = createContext<AppServices | null>(null)

export function useAppServices() {
  const context = useContext(AppServicesContext)

  if (!context) {
    throw new Error('useAppServices must be used inside AppServicesProvider')
  }

  return context
}
