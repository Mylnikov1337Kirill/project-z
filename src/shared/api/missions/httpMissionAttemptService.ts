import type { BackendApi } from '../http/backendApiClient'
import { backendApiClient } from '../http/backendApiClient'
import type {
  MissionAttemptService,
  SubmitMissionAttemptCommand,
  SubmitMissionAttemptResult,
  SubmitQaPassMissionAttemptCommand,
} from './MissionAttemptService'

export class HttpMissionAttemptService implements MissionAttemptService {
  private readonly api: BackendApi

  constructor(api: BackendApi = backendApiClient) {
    this.api = api
  }

  async recordMissionStart(command: {
    chapterId: string
    contentVersion: string
    missionId: string
  }) {
    return this.api.post<{ startedAt: string }>(
      `/api/missions/${encodeURIComponent(command.missionId)}/start`,
      {
        chapterId: command.chapterId,
        contentVersion: command.contentVersion,
      },
    )
  }

  async submitMissionAttempt(command: SubmitMissionAttemptCommand) {
    return this.api.post<SubmitMissionAttemptResult>(
      `/api/missions/${encodeURIComponent(command.missionId)}/attempts`,
      {
        answer: command.answer,
        chapterId: command.chapterId,
        clientAttemptId: command.clientAttemptId,
        contentVersion: command.contentVersion,
      },
    )
  }

  async submitQaPassMissionAttempt(command: SubmitQaPassMissionAttemptCommand) {
    return this.api.post<SubmitMissionAttemptResult>(
      `/api/missions/${encodeURIComponent(command.missionId)}/qa-pass`,
      {
        chapterId: command.chapterId,
        clientAttemptId: command.clientAttemptId,
        contentVersion: command.contentVersion,
      },
    )
  }
}
