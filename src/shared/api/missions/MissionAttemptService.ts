import type { MissionAnswer } from '../../../entities/mission/lib/missionEngine'
import type {
  ChapterCompletion,
  ChapterProgress,
  PublicMissionEvaluation,
  TrapConceptId,
} from '../../types/domain'

export type MissionTrapDiscovery = {
  id: TrapConceptId
  isNew: boolean
}

export type SubmitMissionAttemptCommand = {
  answer: MissionAnswer
  chapterId: string
  clientAttemptId: string
  contentVersion: string
  missionId: string
}

export type SubmitQaPassMissionAttemptCommand = {
  chapterId: string
  clientAttemptId: string
  contentVersion: string
  missionId: string
}

export type RecordMissionStartCommand = {
  chapterId: string
  contentVersion: string
  missionId: string
}

export type RecordMissionStartResult = {
  startedAt: string
}

export type SubmitMissionAttemptResult = {
  completion: ChapterCompletion | null
  evaluation: PublicMissionEvaluation
  progress: ChapterProgress[]
  trapDiscoveries: MissionTrapDiscovery[]
}

export interface MissionAttemptService {
  recordMissionStart(
    command: RecordMissionStartCommand,
  ): Promise<RecordMissionStartResult>
  submitMissionAttempt(
    command: SubmitMissionAttemptCommand,
  ): Promise<SubmitMissionAttemptResult>
  submitQaPassMissionAttempt(
    command: SubmitQaPassMissionAttemptCommand,
  ): Promise<SubmitMissionAttemptResult>
}
