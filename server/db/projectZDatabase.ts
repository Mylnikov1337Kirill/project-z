import type { MissionAnswer } from '../../src/entities/mission/lib/missionEngine'
import type {
  ChapterCompletion,
  ChapterProgress,
  ChapterReflection,
  Learner,
  TrapConceptId,
} from '../../src/shared/types/domain'

export type PilotSession = {
  id: string
  publicCode: string | null
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  lastSeenAt: string | null
}

export type ProgressPayload = {
  completedMissionIds: string[]
  encounteredTrapIds: TrapConceptId[]
  learner: Learner
  pendingUnlockChapterId: string | null
  progress: ChapterProgress[]
}

export type MePayload = {
  learner: Learner | null
  pilotSession: PilotSession | null
}

export type SubmitMissionAttemptInput = {
  answer: MissionAnswer
  badgeNameSnapshot: string
  chapterId: string
  chapterIds: string[]
  clientAttemptId: string
  contentVersion: string
  encounteredTrapIds: TrapConceptId[]
  firstChapterId: string
  isChapterBoss: boolean
  isCorrect: boolean
  missionId: string
  nextChapterId: string | null
  pilotSessionId: string
  requiredPreviousMissionIds: string[]
  score: number
}

export type RecordMissionStartInput = {
  chapterId: string
  chapterIds: string[]
  contentVersion: string
  firstChapterId: string
  missionId: string
  pilotSessionId: string
  requiredPreviousMissionIds: string[]
}

export type RecordMissionStartResult = {
  startedAt: string
}

export type SuspiciousEventReason =
  | 'mission_completed_too_fast'
  | 'mission_start_missing'

export type SuspiciousEvent = {
  createdAt: string
  learnerId: string
  metadata: Record<string, unknown>
  pilotSessionId: string
  reason: SuspiciousEventReason
}

export type RecordSuspiciousEventInput = {
  metadata: Record<string, unknown>
  pilotSessionId: string
  reason: SuspiciousEventReason
}

export type RecordSuspiciousEventResult = {
  event: SuspiciousEvent
}

export type SubmitMissionAttemptResult = {
  attempt: {
    answer: MissionAnswer
    chapterId: string
    clientAttemptId: string
    contentVersion: string
    createdAt: string
    isCorrect: boolean
    missionId: string
    score: number
  }
  completedMissionIds: string[]
  completion: ChapterCompletion | null
  duplicate: boolean
  progress: ChapterProgress[]
  trapDiscoveries: {
    id: TrapConceptId
    isNew: boolean
  }[]
}

export type LeaderboardDatabaseEntry = {
  closedChaptersCount: number
  lastBadgeDate: string | null
  lastBadgeName: string | null
  learnerId: string
  nickname: string
}

export type AnnouncementStatus = 'pending' | 'dry_run' | 'sent' | 'failed'

export type AnnouncementDelivery = {
  attemptsCount: number
  badgeAward: {
    awardedAt: string
    badgeNameSnapshot: string
    chapterId: string
    completedChapters: number
    learner: {
      nickname: string
    } | null
  } | null
  badgeAwardId: string
  channel: string
  id: string
  idempotencyKey: string
  status: AnnouncementStatus
}

export type ProjectZDatabase = {
  createPilotSession(input: {
    publicCode: string | null
  }): Promise<{ pilotSession: PilotSession }>
  getMe(input: { pilotSessionId: string }): Promise<MePayload>
  identifyLearner(input: {
    chapterIds: string[]
    firstChapterId: string
    fullName: string
    nickname: string
    pilotSessionId: string
  }): Promise<{ learner: Learner }>
  getProgress(input: {
    chapterIds: string[]
    firstChapterId: string
    pilotSessionId: string
  }): Promise<ProgressPayload>
  recordMissionStart(
    input: RecordMissionStartInput,
  ): Promise<RecordMissionStartResult>
  recordSuspiciousEvent(
    input: RecordSuspiciousEventInput,
  ): Promise<RecordSuspiciousEventResult>
  submitMissionAttempt(
    input: SubmitMissionAttemptInput,
  ): Promise<SubmitMissionAttemptResult>
  getChapterReflection(input: {
    chapterId: string
    chapterIds: string[]
    pilotSessionId: string
  }): Promise<{ reflection: ChapterReflection | null }>
  saveChapterReflection(input: {
    chapterId: string
    chapterIds: string[]
    note: string
    optionId: string | null
    optionLabel: string | null
    pilotSessionId: string
    skipped: boolean
  }): Promise<{ reflection: ChapterReflection }>
  markUnlockSeen(input: {
    chapterId: string
    chapterIds: string[]
    firstChapterId: string
    pilotSessionId: string
  }): Promise<Omit<ProgressPayload, 'learner'>>
  getLeaderboardEntries(): Promise<LeaderboardDatabaseEntry[]>
  getPendingAnnouncementDeliveries(input: {
    limit: number
    maxAttempts: number
  }): Promise<AnnouncementDelivery[]>
  updateAnnouncementDeliveryStatus(input: {
    attemptsCount: number
    deliveryId: string
    lastError: string | null
    maxAttempts: number
    status: AnnouncementStatus
  }): Promise<AnnouncementDelivery[]>
}

export class ProjectZDatabaseError extends Error {
  readonly status: number | null

  constructor(
    message = 'database_request_failed',
    options: { cause?: unknown; status?: number | null } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'ProjectZDatabaseError'
    this.status = options.status ?? null
  }
}
