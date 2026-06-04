import type { ReactNode } from 'react'
import { artifactService } from '../../shared/api/artifacts/markdownArtifactService'
import type { AppServices } from '../../shared/api/appServices/appServices'
import { AppServicesContext } from '../../shared/api/appServices/appServices'
import { contentRepository } from '../../shared/api/content/httpContentRepository'
import { HttpMissionAttemptService } from '../../shared/api/missions/httpMissionAttemptService'
import { HttpProgressRepository } from '../../shared/api/progress/httpProgressRepository'

type AppServicesProviderProps = {
  children: ReactNode
}

const httpProgressRepository = new HttpProgressRepository()

const appServices: AppServices = {
  artifactService,
  contentRepository,
  missionAttemptService: new HttpMissionAttemptService(),
  progressRepository: httpProgressRepository,
}

export function AppServicesProvider({ children }: AppServicesProviderProps) {
  return (
    <AppServicesContext.Provider value={appServices}>
      {children}
    </AppServicesContext.Provider>
  )
}
