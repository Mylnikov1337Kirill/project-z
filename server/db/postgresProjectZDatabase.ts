import { createRequire } from 'node:module'
import { getRequiredEnvironmentVariable } from '../backend/configuration'
import type {
  AnnouncementDelivery,
  AnnouncementStatus,
  LeaderboardDatabaseEntry,
  MePayload,
  PilotSession,
  ProgressPayload,
  ProjectZDatabase,
  RecordMissionStartInput,
  RecordMissionStartResult,
  RecordSuspiciousEventInput,
  RecordSuspiciousEventResult,
  SuspiciousEvent,
  SuspiciousEventReason,
  SubmitMissionAttemptInput,
  SubmitMissionAttemptResult,
} from './projectZDatabase'
import { ProjectZDatabaseError } from './projectZDatabase'
import type {
  ChapterProgress,
  ChapterReflection,
  Learner,
  TrapConceptId,
} from '../../src/shared/types/domain'

type ProjectZQueryRow = Record<string, unknown>

type ProjectZQueryResult<TRow extends ProjectZQueryRow> = {
  rows: TRow[]
}

type ProjectZPgQueryable = {
  query<TRow extends ProjectZQueryRow>(
    sql: string,
    parameters?: readonly unknown[],
  ): Promise<ProjectZQueryResult<TRow>>
}

export type ProjectZPgClient = ProjectZPgQueryable & {
  release(): void
}

export type ProjectZPgPool = ProjectZPgQueryable & {
  connect(): Promise<ProjectZPgClient>
  end(): Promise<void>
}

type PgModule = {
  Pool: new (configuration: { connectionString: string }) => ProjectZPgPool
}

type TimestampValue = Date | string
type NullableTimestampValue = TimestampValue | null

type PilotSessionQueryRow = {
  created_at: TimestampValue
  expires_at: NullableTimestampValue
  id: string
  last_seen_at: NullableTimestampValue
  public_code: string | null
  revoked_at: NullableTimestampValue
}

type LearnerQueryRow = {
  full_name: string | null
  id: string
  nickname: string
}

type ChapterProgressQueryRow = {
  chapter_id: string
  status: ChapterProgress['status']
}

type CompletedMissionQueryRow = {
  chapter_id: string
  mission_id: string
}

type TrapDiscoveryQueryRow = {
  trap_id: TrapConceptId
}

type PendingUnlockQueryRow = {
  chapter_id: string
}

type ChapterReflectionQueryRow = {
  chapter_id: string
  note: string
  option_id: string | null
  option_label: string | null
  skipped: boolean
  updated_at: TimestampValue
}

type MissionAttemptQueryRow = {
  answer_json: unknown
  chapter_id: string
  client_attempt_id: string | null
  content_version: string
  created_at: TimestampValue
  is_correct: boolean
  mission_id: string
  score: number
}

type MissionStartQueryRow = {
  started_at: TimestampValue
}

type SuspiciousEventQueryRow = {
  created_at: TimestampValue
  learner_id: string
  metadata: unknown
  pilot_session_id: string
  reason: SuspiciousEventReason
}

type RequiredMissionQueryRow = {
  required_mission_id: string
}

type ChapterStatusQueryRow = {
  status: ChapterProgress['status']
}

type TrapDiscoveryStatusQueryRow = {
  is_new: boolean
  trap_id: TrapConceptId
}

type CompletedAtQueryRow = {
  completed_at: TimestampValue
}

type CompletedChaptersQueryRow = {
  completed_chapters: number
}

type TrustedRecognitionQueryRow = {
  is_trusted: boolean
}

type BadgeAwardInsertQueryRow = {
  id: string
}

type LeaderboardQueryRow = {
  closed_chapters_count: number
  last_badge_date: Date | string | null
  last_badge_name: string | null
  learner_id: string
  nickname: string
}

type AnnouncementDeliveryQueryRow = {
  attempts_count: number
  awarded_at: Date | string | null
  badge_award_id: string
  badge_name_snapshot: string | null
  channel: string
  chapter_id: string | null
  completed_chapters: number | null
  id: string
  idempotency_key: string
  learner_nickname: string | null
  status: AnnouncementStatus
}

const require = createRequire(import.meta.url)
const { Pool } = require('pg') as PgModule
const impossibleFastMissionSeconds = 2
const suspiciousMetadataMaxDepth = 4
const suspiciousMetadataMaxKeys = 24
const suspiciousMetadataMaxArrayLength = 24
const suspiciousMetadataMaxStringLength = 500

function serializeTimestamp(value: NullableTimestampValue) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  return value
}

function serializeRequiredTimestamp(value: TimestampValue) {
  return serializeTimestamp(value) ?? ''
}

function mapPilotSessionQueryRow(row: PilotSessionQueryRow): PilotSession {
  return {
    createdAt: serializeRequiredTimestamp(row.created_at),
    expiresAt: serializeTimestamp(row.expires_at),
    id: row.id,
    lastSeenAt: serializeTimestamp(row.last_seen_at),
    publicCode: row.public_code,
    revokedAt: serializeTimestamp(row.revoked_at),
  }
}

function mapLearnerQueryRow(row: LearnerQueryRow): Learner {
  return {
    fullName: row.full_name ?? '',
    id: row.id,
    nickname: row.nickname,
  }
}

function mapChapterReflectionQueryRow(
  row: ChapterReflectionQueryRow,
): ChapterReflection {
  return {
    chapterId: row.chapter_id,
    note: row.note,
    optionId: row.option_id,
    optionLabel: row.option_label,
    skipped: row.skipped,
    updatedAt: serializeRequiredTimestamp(row.updated_at),
  }
}

function mapLeaderboardQueryRow(
  row: LeaderboardQueryRow,
): LeaderboardDatabaseEntry {
  return {
    closedChaptersCount: row.closed_chapters_count,
    lastBadgeDate: serializeTimestamp(row.last_badge_date),
    lastBadgeName: row.last_badge_name,
    learnerId: row.learner_id,
    nickname: row.nickname,
  }
}

function mapMissionAttemptQueryRow(row: MissionAttemptQueryRow) {
  return {
    answer: row.answer_json as SubmitMissionAttemptResult['attempt']['answer'],
    chapterId: row.chapter_id,
    clientAttemptId: row.client_attempt_id ?? '',
    contentVersion: row.content_version,
    createdAt: serializeRequiredTimestamp(row.created_at),
    isCorrect: row.is_correct,
    missionId: row.mission_id,
    score: row.score,
  }
}

function mapSuspiciousEventQueryRow(row: SuspiciousEventQueryRow): SuspiciousEvent {
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {}

  return {
    createdAt: serializeRequiredTimestamp(row.created_at),
    learnerId: row.learner_id,
    metadata,
    pilotSessionId: row.pilot_session_id,
    reason: row.reason,
  }
}

function mapAnnouncementDeliveryQueryRow(
  row: AnnouncementDeliveryQueryRow,
): AnnouncementDelivery {
  return {
    attemptsCount: row.attempts_count,
    badgeAward:
      row.chapter_id && row.badge_name_snapshot && row.completed_chapters !== null
        ? {
            awardedAt: serializeTimestamp(row.awarded_at) ?? '',
            badgeNameSnapshot: row.badge_name_snapshot,
            chapterId: row.chapter_id,
            completedChapters: row.completed_chapters,
            learner: row.learner_nickname
              ? {
                  nickname: row.learner_nickname,
                }
              : null,
          }
        : null,
    badgeAwardId: row.badge_award_id,
    channel: row.channel,
    id: row.id,
    idempotencyKey: row.idempotency_key,
    status: row.status,
  }
}

function normalizeProfileText(value: string | null, maxLength: number) {
  return Array.from((value ?? '').trim().replace(/\s+/g, ' '))
    .slice(0, maxLength)
    .join('')
}

function normalizeTrapIds(trapIds: TrapConceptId[]) {
  return [...new Set(trapIds.filter((trapId) => trapId.trim() !== ''))].sort()
}

function normalizeSuspiciousMetadataValue(
  value: unknown,
  depth = 0,
): unknown {
  if (value === null) {
    return null
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return String(value)
    }

    if (typeof value === 'string') {
      return Array.from(value).slice(0, suspiciousMetadataMaxStringLength).join('')
    }

    return value
  }

  if (depth >= suspiciousMetadataMaxDepth) {
    return '[truncated]'
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, suspiciousMetadataMaxArrayLength)
      .map((item) => normalizeSuspiciousMetadataValue(item, depth + 1))
      .filter((item) => item !== undefined)
  }

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {}
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      suspiciousMetadataMaxKeys,
    )

    for (const [key, item] of entries) {
      const normalizedItem = normalizeSuspiciousMetadataValue(item, depth + 1)

      if (normalizedItem !== undefined) {
        output[key] = normalizedItem
      }
    }

    return output
  }

  return undefined
}

function normalizeSuspiciousMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = normalizeSuspiciousMetadataValue(metadata)

  return normalized && typeof normalized === 'object' && !Array.isArray(normalized)
    ? (normalized as Record<string, unknown>)
    : {}
}

function getElapsedSeconds(input: {
  endedAt: TimestampValue
  startedAt: TimestampValue
}) {
  const endedAt = new Date(input.endedAt).getTime()
  const startedAt = new Date(input.startedAt).getTime()

  if (!Number.isFinite(endedAt) || !Number.isFinite(startedAt)) {
    return null
  }

  return Math.max(0, Math.round((endedAt - startedAt) / 1000))
}

export class PostgresProjectZDatabase implements ProjectZDatabase {
  private readonly pool: ProjectZPgPool

  constructor(pool: ProjectZPgPool) {
    this.pool = pool
  }

  async close() {
    await this.pool.end()
  }

  async createPilotSession(input: {
    publicCode: string | null
  }): Promise<{ pilotSession: PilotSession }> {
    const result = await this.pool.query<PilotSessionQueryRow>(
      [
        'with normalized_input as (',
        "  select nullif(btrim($1::text), '') as public_code",
        '),',
        'updated_session as (',
        '  update public.pilot_sessions',
        '  set last_seen_at = now()',
        '  from normalized_input',
        '  where normalized_input.public_code is not null',
        '    and pilot_sessions.public_code = normalized_input.public_code',
        '    and pilot_sessions.revoked_at is null',
        '    and (pilot_sessions.expires_at is null or pilot_sessions.expires_at > now())',
        '  returning',
        '    pilot_sessions.id::text,',
        '    pilot_sessions.public_code,',
        '    pilot_sessions.created_at,',
        '    pilot_sessions.expires_at,',
        '    pilot_sessions.revoked_at,',
        '    pilot_sessions.last_seen_at',
        '),',
        'inserted_session as (',
        '  insert into public.pilot_sessions (public_code, last_seen_at)',
        '  select normalized_input.public_code, now()',
        '  from normalized_input',
        '  where not exists (select 1 from updated_session)',
        '  returning',
        '    id::text,',
        '    public_code,',
        '    created_at,',
        '    expires_at,',
        '    revoked_at,',
        '    last_seen_at',
        ')',
        'select * from updated_session',
        'union all',
        'select * from inserted_session',
        'limit 1',
      ].join('\n'),
      [input.publicCode],
    )
    const row = result.rows[0]

    if (!row) {
      throw new ProjectZDatabaseError('pilot_session_not_created')
    }

    return {
      pilotSession: mapPilotSessionQueryRow(row),
    }
  }

  async getMe(input: { pilotSessionId: string }): Promise<MePayload> {
    const pilotSession = await this.touchActivePilotSession(input.pilotSessionId)
    const learner = await this.getLearnerForPilotSession(pilotSession.id)

    return {
      learner,
      pilotSession,
    }
  }

  async identifyLearner(input: {
    chapterIds: string[]
    firstChapterId: string
    fullName: string | null
    nickname: string
    pilotSessionId: string
  }): Promise<{ learner: Learner }> {
    const nickname = normalizeProfileText(input.nickname, 40)
    const fullName = normalizeProfileText(input.fullName, 120)

    if (nickname === '') {
      throw new ProjectZDatabaseError('nickname_required')
    }

    if (fullName === '') {
      throw new ProjectZDatabaseError('full_name_required')
    }

    const pilotSession = await this.touchActivePilotSession(input.pilotSessionId)
    const result = await this.pool.query<LearnerQueryRow>(
      [
        'insert into public.learners (pilot_session_id, nickname, full_name)',
        'values ($1, $2, $3)',
        'on conflict (pilot_session_id) do update',
        '  set nickname = excluded.nickname,',
        '      full_name = excluded.full_name',
        'returning id::text, nickname, full_name',
      ].join('\n'),
      [pilotSession.id, nickname, fullName],
    )
    const row = result.rows[0]

    if (!row) {
      throw new ProjectZDatabaseError('learner_not_saved')
    }

    const learner = mapLearnerQueryRow(row)

    await this.ensureLearnerProgress({
      chapterIds: input.chapterIds,
      firstChapterId: input.firstChapterId,
      learnerId: learner.id,
    })

    return { learner }
  }

  async getProgress(input: {
    chapterIds: string[]
    firstChapterId: string
    pilotSessionId: string
  }): Promise<ProgressPayload> {
    const pilotSession = await this.touchActivePilotSession(input.pilotSessionId)
    const learner = await this.getLearnerForPilotSession(pilotSession.id)

    if (!learner) {
      throw new ProjectZDatabaseError('learner_not_identified')
    }

    await this.ensureLearnerProgress({
      chapterIds: input.chapterIds,
      firstChapterId: input.firstChapterId,
      learnerId: learner.id,
    })

    return {
      ...(await this.getProgressPayloadForLearner({
        chapterIds: input.chapterIds,
        firstChapterId: input.firstChapterId,
        learnerId: learner.id,
      })),
      learner,
    }
  }

  async recordMissionStart(
    input: RecordMissionStartInput,
  ): Promise<RecordMissionStartResult> {
    return this.withTransaction(async (client) => {
      const pilotSession = await this.touchActivePilotSession(
        input.pilotSessionId,
        client,
      )
      const learner = await this.getLearnerForPilotSession(
        pilotSession.id,
        client,
      )

      if (!learner) {
        throw new ProjectZDatabaseError('learner_not_identified')
      }

      await this.ensureLearnerProgress(
        {
          chapterIds: input.chapterIds,
          firstChapterId: input.firstChapterId,
          learnerId: learner.id,
        },
        client,
      )

      const chapterStatus = await this.getChapterStatus(
        {
          chapterId: input.chapterId,
          learnerId: learner.id,
        },
        client,
      )

      if (chapterStatus !== 'open' && chapterStatus !== 'completed') {
        throw new ProjectZDatabaseError('chapter_not_open')
      }

      if (chapterStatus !== 'completed') {
        await this.assertRequiredMissionsCompleted(
          {
            chapterId: input.chapterId,
            learnerId: learner.id,
            requiredPreviousMissionIds: input.requiredPreviousMissionIds,
          },
          client,
        )
      }

      const result = await client.query<MissionStartQueryRow>(
        [
          'insert into public.mission_starts (',
          '  learner_id,',
          '  pilot_session_id,',
          '  chapter_id,',
          '  mission_id,',
          '  started_at',
          ')',
          'values ($1, $2, $3, $4, now())',
          'on conflict (learner_id, chapter_id, mission_id) do update',
          '  set started_at = public.mission_starts.started_at',
          'returning started_at',
        ].join('\n'),
        [learner.id, pilotSession.id, input.chapterId, input.missionId],
      )
      const startedAt = result.rows[0]?.started_at

      if (!startedAt) {
        throw new ProjectZDatabaseError('mission_start_not_recorded')
      }

      return {
        startedAt: serializeRequiredTimestamp(startedAt),
      }
    })
  }

  async recordSuspiciousEvent(
    input: RecordSuspiciousEventInput,
  ): Promise<RecordSuspiciousEventResult> {
    const pilotSession = await this.touchActivePilotSession(input.pilotSessionId)
    const learner = await this.getLearnerForPilotSession(pilotSession.id)

    if (!learner) {
      throw new ProjectZDatabaseError('learner_not_identified')
    }

    const event = await this.insertSuspiciousEvent(
      {
        learnerId: learner.id,
        metadata: input.metadata,
        pilotSessionId: pilotSession.id,
        reason: input.reason,
      },
      this.pool,
    )

    return { event }
  }

  async submitMissionAttempt(
    input: SubmitMissionAttemptInput,
  ): Promise<SubmitMissionAttemptResult> {
    if (input.clientAttemptId.trim() === '') {
      throw new ProjectZDatabaseError('client_attempt_id_required')
    }

    if (input.score < 0 || input.score > 100) {
      throw new ProjectZDatabaseError('invalid_score')
    }

    return this.withTransaction(async (client) => {
      const pilotSession = await this.touchActivePilotSession(
        input.pilotSessionId,
        client,
      )
      const learner = await this.getLearnerForPilotSession(
        pilotSession.id,
        client,
      )

      if (!learner) {
        throw new ProjectZDatabaseError('learner_not_identified')
      }

      await this.ensureLearnerProgress(
        {
          chapterIds: input.chapterIds,
          firstChapterId: input.firstChapterId,
          learnerId: learner.id,
        },
        client,
      )

      const chapterStatus = await this.getChapterStatus(
        {
          chapterId: input.chapterId,
          learnerId: learner.id,
        },
        client,
      )

      if (chapterStatus !== 'open' && chapterStatus !== 'completed') {
        throw new ProjectZDatabaseError('chapter_not_open')
      }

      if (chapterStatus !== 'completed') {
        await this.assertRequiredMissionsCompleted(
          {
            chapterId: input.chapterId,
            learnerId: learner.id,
            requiredPreviousMissionIds: input.requiredPreviousMissionIds,
          },
          client,
        )
      }

      const existingAttempt = await this.getMissionAttemptByClientAttemptId(
        {
          clientAttemptId: input.clientAttemptId,
          learnerId: learner.id,
        },
        client,
      )

      if (existingAttempt) {
        if (
          existingAttempt.chapter_id !== input.chapterId ||
          existingAttempt.mission_id !== input.missionId
        ) {
          throw new ProjectZDatabaseError(
            'client_attempt_id_reused_for_different_mission',
          )
        }

        const completion =
          input.isChapterBoss && existingAttempt.is_correct
            ? await this.getCompletedChapterCompletion(
                {
                  chapterId: existingAttempt.chapter_id,
                  learnerId: learner.id,
                },
                client,
              )
            : null
        const progress = await this.getProgressPayloadForLearner(
          {
            chapterIds: input.chapterIds,
            firstChapterId: input.firstChapterId,
            learnerId: learner.id,
          },
          client,
        )

        return {
          attempt: mapMissionAttemptQueryRow(existingAttempt),
          completedMissionIds: progress.completedMissionIds,
          completion,
          duplicate: true,
          progress: progress.progress,
          trapDiscoveries: [],
        }
      }

      const trapIds = normalizeTrapIds(input.encounteredTrapIds)
      const trapDiscoveries = await this.getTrapDiscoveryStatuses(
        {
          learnerId: learner.id,
          trapIds,
        },
        client,
      )
      const insertedAttempt = await this.insertMissionAttempt(
        {
          input,
          learnerId: learner.id,
        },
        client,
      )

      if (input.isCorrect) {
        await this.insertCompletedMission(
          {
            chapterId: input.chapterId,
            learnerId: learner.id,
            missionId: input.missionId,
          },
          client,
        )
      }

      await this.insertTrapDiscoveries(
        {
          learnerId: learner.id,
          trapIds,
        },
        client,
      )
      await this.recordMissionAttemptSuspiciousSignals(
        {
          attemptCreatedAt: insertedAttempt.created_at,
          input,
          learnerId: learner.id,
          pilotSessionId: pilotSession.id,
        },
        client,
      )
      const trustedForPublicRecognition =
        input.isCorrect && input.isChapterBoss
          ? await this.isLearnerTrustedForPublicRecognition(learner.id, client)
          : false

      const completion =
        input.isCorrect && input.isChapterBoss
          ? await this.completeChapterAndCreateBadgeOutbox(
              {
                badgeNameSnapshot: input.badgeNameSnapshot,
                chapterId: input.chapterId,
                learnerId: learner.id,
                nextChapterId: input.nextChapterId,
                trustedForPublicRecognition,
              },
              client,
            )
          : null
      const progress = await this.getProgressPayloadForLearner(
        {
          chapterIds: input.chapterIds,
          firstChapterId: input.firstChapterId,
          learnerId: learner.id,
        },
        client,
      )

      return {
        attempt: mapMissionAttemptQueryRow(insertedAttempt),
        completedMissionIds: progress.completedMissionIds,
        completion,
        duplicate: false,
        progress: progress.progress,
        trapDiscoveries,
      }
    })
  }

  async getChapterReflection(input: {
    chapterId: string
    chapterIds: string[]
    pilotSessionId: string
  }): Promise<{ reflection: ChapterReflection | null }> {
    const pilotSession = await this.touchActivePilotSession(input.pilotSessionId)
    const learner = await this.getLearnerForPilotSession(pilotSession.id)

    if (!learner) {
      throw new ProjectZDatabaseError('learner_not_identified')
    }

    const chapterStatus = await this.getKnownChapterStatus({
      chapterId: input.chapterId,
      chapterIds: input.chapterIds,
      learnerId: learner.id,
    })

    if (chapterStatus !== 'completed') {
      throw new ProjectZDatabaseError('chapter_not_completed')
    }

    const result = await this.pool.query<ChapterReflectionQueryRow>(
      [
        'select',
        '  chapter_id,',
        '  option_id,',
        '  option_label,',
        '  note,',
        '  skipped,',
        '  updated_at',
        'from public.chapter_reflections',
        'where learner_id = $1',
        '  and chapter_id = $2',
        'limit 1',
      ].join('\n'),
      [learner.id, input.chapterId],
    )

    return {
      reflection: result.rows[0]
        ? mapChapterReflectionQueryRow(result.rows[0])
        : null,
    }
  }

  async saveChapterReflection(input: {
    chapterId: string
    chapterIds: string[]
    note: string
    optionId: string | null
    optionLabel: string | null
    pilotSessionId: string
    skipped: boolean
  }): Promise<{ reflection: ChapterReflection }> {
    const pilotSession = await this.touchActivePilotSession(input.pilotSessionId)
    const learner = await this.getLearnerForPilotSession(pilotSession.id)

    if (!learner) {
      throw new ProjectZDatabaseError('learner_not_identified')
    }

    const chapterStatus = await this.getKnownChapterStatus({
      chapterId: input.chapterId,
      chapterIds: input.chapterIds,
      learnerId: learner.id,
    })

    if (chapterStatus !== 'completed') {
      throw new ProjectZDatabaseError('chapter_not_completed')
    }

    const normalizedReflection = input.skipped
      ? {
          note: '',
          optionId: null,
          optionLabel: null,
        }
      : {
          note: normalizeProfileText(input.note, 180),
          optionId: normalizeProfileText(input.optionId, 80) || null,
          optionLabel: normalizeProfileText(input.optionLabel, 80) || null,
        }
    const result = await this.pool.query<ChapterReflectionQueryRow>(
      [
        'insert into public.chapter_reflections (',
        '  learner_id,',
        '  chapter_id,',
        '  option_id,',
        '  option_label,',
        '  note,',
        '  skipped,',
        '  updated_at',
        ')',
        'values ($1, $2, $3, $4, $5, $6, now())',
        'on conflict (learner_id, chapter_id) do update',
        '  set option_id = excluded.option_id,',
        '      option_label = excluded.option_label,',
        '      note = excluded.note,',
        '      skipped = excluded.skipped,',
        '      updated_at = now()',
        'returning',
        '  chapter_id,',
        '  option_id,',
        '  option_label,',
        '  note,',
        '  skipped,',
        '  updated_at',
      ].join('\n'),
      [
        learner.id,
        input.chapterId,
        normalizedReflection.optionId,
        normalizedReflection.optionLabel,
        normalizedReflection.note,
        input.skipped,
      ],
    )
    const row = result.rows[0]

    if (!row) {
      throw new ProjectZDatabaseError('chapter_reflection_not_saved')
    }

    return {
      reflection: mapChapterReflectionQueryRow(row),
    }
  }

  async markUnlockSeen(input: {
    chapterId: string
    chapterIds: string[]
    firstChapterId: string
    pilotSessionId: string
  }): Promise<Omit<ProgressPayload, 'learner'>> {
    const pilotSession = await this.touchActivePilotSession(input.pilotSessionId)
    const learner = await this.getLearnerForPilotSession(pilotSession.id)

    if (!learner) {
      throw new ProjectZDatabaseError('learner_not_identified')
    }

    const chapterStatus = await this.getKnownChapterStatus({
      chapterId: input.chapterId,
      chapterIds: input.chapterIds,
      learnerId: learner.id,
    })

    if (chapterStatus !== 'open' && chapterStatus !== 'completed') {
      throw new ProjectZDatabaseError('chapter_not_open')
    }

    await this.pool.query(
      [
        'update public.learner_chapter_progress',
        'set unlock_seen_at = coalesce(unlock_seen_at, now())',
        'where learner_id = $1',
        '  and chapter_id = $2',
      ].join('\n'),
      [learner.id, input.chapterId],
    )

    return this.getProgressPayloadForLearner({
      chapterIds: input.chapterIds,
      firstChapterId: input.firstChapterId,
      learnerId: learner.id,
    })
  }

  async getLeaderboardEntries(): Promise<LeaderboardDatabaseEntry[]> {
    const result = await this.pool.query<LeaderboardQueryRow>(
      [
        'select',
        '  learner_id::text,',
        '  nickname,',
        '  closed_chapters_count,',
        '  last_badge_date,',
        '  last_badge_name',
        'from public.leaderboard_entries',
        'order by closed_chapters_count desc, last_badge_date desc nulls last',
      ].join('\n'),
    )

    return result.rows.map(mapLeaderboardQueryRow)
  }

  async getPendingAnnouncementDeliveries(input: {
    limit: number
    maxAttempts: number
  }): Promise<AnnouncementDelivery[]> {
    const result = await this.pool.query<AnnouncementDeliveryQueryRow>(
      [
        'select',
        '  announcement_deliveries.id::text,',
        '  announcement_deliveries.badge_award_id::text,',
        '  announcement_deliveries.channel,',
        '  announcement_deliveries.status,',
        '  announcement_deliveries.idempotency_key,',
        '  announcement_deliveries.attempts_count,',
        '  badge_awards.chapter_id,',
        '  badge_awards.badge_name_snapshot,',
        '  badge_awards.completed_chapters,',
        '  badge_awards.awarded_at,',
        '  learners.nickname as learner_nickname',
        'from public.announcement_deliveries',
        'left join public.badge_awards',
        '  on badge_awards.id = announcement_deliveries.badge_award_id',
        'left join public.learners',
        '  on learners.id = badge_awards.learner_id',
        "where announcement_deliveries.channel = 'pachca'",
        "  and announcement_deliveries.status = 'pending'",
        '  and announcement_deliveries.attempts_count < $1',
        'order by announcement_deliveries.created_at asc',
        'limit $2',
      ].join('\n'),
      [input.maxAttempts, input.limit],
    )

    return result.rows.map(mapAnnouncementDeliveryQueryRow)
  }

  async updateAnnouncementDeliveryStatus(input: {
    attemptsCount: number
    deliveryId: string
    lastError: string | null
    maxAttempts: number
    status: AnnouncementStatus
  }): Promise<AnnouncementDelivery[]> {
    const result = await this.pool.query<AnnouncementDeliveryQueryRow>(
      [
        'with updated_delivery as (',
        '  update public.announcement_deliveries',
        '  set attempts_count = $1,',
        '      last_error = $2,',
        '      sent_at = null,',
        '      status = $3',
        '  where id = $4',
        "    and status = 'pending'",
        '    and attempts_count < $5',
        '  returning *',
        ')',
        'select',
        '  updated_delivery.id::text,',
        '  updated_delivery.badge_award_id::text,',
        '  updated_delivery.channel,',
        '  updated_delivery.status,',
        '  updated_delivery.idempotency_key,',
        '  updated_delivery.attempts_count,',
        '  badge_awards.chapter_id,',
        '  badge_awards.badge_name_snapshot,',
        '  badge_awards.completed_chapters,',
        '  badge_awards.awarded_at,',
        '  learners.nickname as learner_nickname',
        'from updated_delivery',
        'left join public.badge_awards',
        '  on badge_awards.id = updated_delivery.badge_award_id',
        'left join public.learners',
        '  on learners.id = badge_awards.learner_id',
      ].join('\n'),
      [
        input.attemptsCount,
        input.lastError,
        input.status,
        input.deliveryId,
        input.maxAttempts,
      ],
    )

    return result.rows.map(mapAnnouncementDeliveryQueryRow)
  }

  private async touchActivePilotSession(
    pilotSessionId: string,
    database: ProjectZPgQueryable = this.pool,
  ): Promise<PilotSession> {
    const result = await database.query<PilotSessionQueryRow>(
      [
        'update public.pilot_sessions',
        'set last_seen_at = now()',
        'where id = $1',
        '  and revoked_at is null',
        '  and (expires_at is null or expires_at > now())',
        'returning',
        '  id::text,',
        '  public_code,',
        '  created_at,',
        '  expires_at,',
        '  revoked_at,',
        '  last_seen_at',
      ].join('\n'),
      [pilotSessionId],
    )
    const row = result.rows[0]

    if (!row) {
      throw new ProjectZDatabaseError('invalid_pilot_session')
    }

    return mapPilotSessionQueryRow(row)
  }

  private async getLearnerForPilotSession(
    pilotSessionId: string,
    database: ProjectZPgQueryable = this.pool,
  ): Promise<Learner | null> {
    const result = await database.query<LearnerQueryRow>(
      [
        'select id::text, nickname, full_name',
        'from public.learners',
        'where pilot_session_id = $1',
        'limit 1',
      ].join('\n'),
      [pilotSessionId],
    )
    const row = result.rows[0]

    return row ? mapLearnerQueryRow(row) : null
  }

  private async ensureLearnerProgress(input: {
    chapterIds: string[]
    firstChapterId: string
    learnerId: string
  },
  database: ProjectZPgQueryable = this.pool) {
    await database.query(
      [
        'with ordered_chapters as (',
        '  select chapter_id, ordinality',
        '  from unnest(coalesce($2::text[], array[]::text[]))',
        '    with ordinality as chapters(chapter_id, ordinality)',
        "  where chapter_id is not null and chapter_id <> ''",
        '),',
        'progress_seed as (',
        '  select',
        '    $1::uuid as learner_id,',
        '    ordered_chapters.chapter_id,',
        '    case',
        "      when ordered_chapters.chapter_id = $3 then 'open'",
        "      when previous_progress.status = 'completed' then 'open'",
        "      else 'locked'",
        '    end as status,',
        '    case',
        '      when ordered_chapters.chapter_id = $3',
        "        or previous_progress.status = 'completed'",
        '        then now()',
        '      else null',
        '    end as opened_at,',
        '    case when ordered_chapters.chapter_id = $3 then now() else null end as unlock_seen_at',
        '  from ordered_chapters',
        '  left join ordered_chapters as previous_chapter',
        '    on previous_chapter.ordinality = ordered_chapters.ordinality - 1',
        '  left join public.learner_chapter_progress as previous_progress',
        '    on previous_progress.learner_id = $1',
        '    and previous_progress.chapter_id = previous_chapter.chapter_id',
        ')',
        'insert into public.learner_chapter_progress (',
        '  learner_id,',
        '  chapter_id,',
        '  status,',
        '  opened_at,',
        '  unlock_seen_at',
        ')',
        'select',
        '  learner_id,',
        '  chapter_id,',
        '  status,',
        '  opened_at,',
        '  unlock_seen_at',
        'from progress_seed',
        'on conflict (learner_id, chapter_id) do update',
        '  set status = case',
        "        when public.learner_chapter_progress.status = 'completed'",
        '          then public.learner_chapter_progress.status',
        "        when excluded.status = 'open'",
        "          and public.learner_chapter_progress.status = 'locked'",
        "          then 'open'",
        '        else public.learner_chapter_progress.status',
        '      end,',
        '      opened_at = case',
        "        when excluded.status = 'open'",
        "          and public.learner_chapter_progress.status = 'locked'",
        '          then coalesce(public.learner_chapter_progress.opened_at, excluded.opened_at, now())',
        '        else public.learner_chapter_progress.opened_at',
        '      end,',
        '      unlock_seen_at = case',
        '        when excluded.unlock_seen_at is not null',
        '          then coalesce(public.learner_chapter_progress.unlock_seen_at, excluded.unlock_seen_at)',
        '        else public.learner_chapter_progress.unlock_seen_at',
        '      end',
      ].join('\n'),
      [input.learnerId, input.chapterIds, input.firstChapterId],
    )
  }

  private async getProgressPayloadForLearner(input: {
    chapterIds: string[]
    firstChapterId: string
    learnerId: string
  },
  database: ProjectZPgQueryable = this.pool): Promise<Omit<ProgressPayload, 'learner'>> {
    const [
      progressResult,
      completedMissionResult,
      trapDiscoveryResult,
      pendingUnlockResult,
    ] = await Promise.all([
      database.query<ChapterProgressQueryRow>(
        [
          'select chapter_id, status',
          'from public.learner_chapter_progress',
          'where learner_id = $1',
          '  and chapter_id = any($2::text[])',
          'order by array_position($2::text[], chapter_id)',
        ].join('\n'),
        [input.learnerId, input.chapterIds],
      ),
      database.query<CompletedMissionQueryRow>(
        [
          'select chapter_id, mission_id',
          'from public.completed_missions',
          'where learner_id = $1',
          'order by first_completed_at, mission_id',
        ].join('\n'),
        [input.learnerId],
      ),
      database.query<TrapDiscoveryQueryRow>(
        [
          'select trap_id',
          'from public.trap_discoveries',
          'where learner_id = $1',
          'order by first_seen_at, trap_id',
        ].join('\n'),
        [input.learnerId],
      ),
      database.query<PendingUnlockQueryRow>(
        [
          'select chapter_id',
          'from public.learner_chapter_progress',
          'where learner_id = $1',
          "  and status = 'open'",
          '  and opened_at is not null',
          '  and unlock_seen_at is null',
          '  and chapter_id <> $3',
          'order by array_position($2::text[], chapter_id)',
          'limit 1',
        ].join('\n'),
        [input.learnerId, input.chapterIds, input.firstChapterId],
      ),
    ])
    const statusByChapterId = new Map(
      progressResult.rows.map((row) => [row.chapter_id, row.status]),
    )
    const completedMissionIdsByChapterId = new Map<string, string[]>()

    for (const row of completedMissionResult.rows) {
      const missionIds =
        completedMissionIdsByChapterId.get(row.chapter_id) ?? []

      missionIds.push(row.mission_id)
      completedMissionIdsByChapterId.set(row.chapter_id, missionIds)
    }

    return {
      completedMissionIds: completedMissionResult.rows.map(
        (row) => row.mission_id,
      ),
      encounteredTrapIds: trapDiscoveryResult.rows.map((row) => row.trap_id),
      pendingUnlockChapterId: pendingUnlockResult.rows[0]?.chapter_id ?? null,
      progress: input.chapterIds.map((chapterId) => ({
        chapterId,
        completedMissionIds:
          completedMissionIdsByChapterId.get(chapterId) ?? [],
        status: statusByChapterId.get(chapterId) ?? 'locked',
      })),
    }
  }

  private async withTransaction<T>(
    operation: (client: ProjectZPgClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect()

    try {
      await client.query('begin')
      const result = await operation(client)

      await client.query('commit')

      return result
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }

  private async getChapterStatus(input: {
    chapterId: string
    learnerId: string
  },
  database: ProjectZPgQueryable): Promise<ChapterProgress['status'] | null> {
    const result = await database.query<ChapterStatusQueryRow>(
      [
        'select status',
        'from public.learner_chapter_progress',
        'where learner_id = $1',
        '  and chapter_id = $2',
        'limit 1',
      ].join('\n'),
      [input.learnerId, input.chapterId],
    )

    return result.rows[0]?.status ?? null
  }

  private async getKnownChapterStatus(input: {
    chapterId: string
    chapterIds: string[]
    learnerId: string
  },
  database: ProjectZPgQueryable = this.pool): Promise<ChapterProgress['status'] | null> {
    const result = await database.query<ChapterStatusQueryRow>(
      [
        'select status',
        'from public.learner_chapter_progress',
        'where learner_id = $1',
        '  and chapter_id = $2',
        '  and chapter_id = any($3::text[])',
        'limit 1',
      ].join('\n'),
      [input.learnerId, input.chapterId, input.chapterIds],
    )

    return result.rows[0]?.status ?? null
  }

  private async assertRequiredMissionsCompleted(input: {
    chapterId: string
    learnerId: string
    requiredPreviousMissionIds: string[]
  },
  database: ProjectZPgQueryable) {
    const result = await database.query<RequiredMissionQueryRow>(
      [
        'with required_missions as (',
        '  select required_mission_id, ordinality',
        '  from unnest(coalesce($3::text[], array[]::text[]))',
        '    with ordinality as item(required_mission_id, ordinality)',
        "  where required_mission_id is not null and required_mission_id <> ''",
        ')',
        'select required_mission_id',
        'from required_missions',
        'where not exists (',
        '  select 1',
        '  from public.completed_missions',
        '  where completed_missions.learner_id = $1',
        '    and completed_missions.chapter_id = $2',
        '    and completed_missions.mission_id = required_missions.required_mission_id',
        ')',
        'order by ordinality',
      ].join('\n'),
      [
        input.learnerId,
        input.chapterId,
        input.requiredPreviousMissionIds,
      ],
    )

    if (result.rows.length > 0) {
      throw new ProjectZDatabaseError('mission_not_open')
    }
  }

  private async getMissionAttemptByClientAttemptId(input: {
    clientAttemptId: string
    learnerId: string
  },
  database: ProjectZPgQueryable): Promise<MissionAttemptQueryRow | null> {
    const result = await database.query<MissionAttemptQueryRow>(
      [
        'select',
        '  answer_json,',
        '  chapter_id,',
        '  client_attempt_id,',
        '  content_version,',
        '  created_at,',
        '  is_correct,',
        '  mission_id,',
        '  score',
        'from public.mission_attempts',
        'where learner_id = $1',
        '  and client_attempt_id = $2',
        'limit 1',
      ].join('\n'),
      [input.learnerId, input.clientAttemptId],
    )

    return result.rows[0] ?? null
  }

  private async getTrapDiscoveryStatuses(input: {
    learnerId: string
    trapIds: TrapConceptId[]
  },
  database: ProjectZPgQueryable) {
    if (input.trapIds.length === 0) {
      return []
    }

    const result = await database.query<TrapDiscoveryStatusQueryRow>(
      [
        'select',
        '  requested_traps.trap_id,',
        '  trap_discoveries.trap_id is null as is_new',
        'from unnest($2::text[]) as requested_traps(trap_id)',
        'left join public.trap_discoveries',
        '  on trap_discoveries.learner_id = $1',
        '  and trap_discoveries.trap_id = requested_traps.trap_id',
        'order by requested_traps.trap_id',
      ].join('\n'),
      [input.learnerId, input.trapIds],
    )

    return result.rows.map((row) => ({
      id: row.trap_id,
      isNew: row.is_new,
    }))
  }

  private async insertMissionAttempt(input: {
    input: SubmitMissionAttemptInput
    learnerId: string
  },
  database: ProjectZPgQueryable): Promise<MissionAttemptQueryRow> {
    const result = await database.query<MissionAttemptQueryRow>(
      [
        'insert into public.mission_attempts (',
        '  learner_id,',
        '  chapter_id,',
        '  mission_id,',
        '  answer_json,',
        '  is_correct,',
        '  score,',
        '  content_version,',
        '  client_attempt_id,',
        '  created_at',
        ')',
        'values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, now())',
        'returning',
        '  answer_json,',
        '  chapter_id,',
        '  client_attempt_id,',
        '  content_version,',
        '  created_at,',
        '  is_correct,',
        '  mission_id,',
        '  score',
      ].join('\n'),
      [
        input.learnerId,
        input.input.chapterId,
        input.input.missionId,
        JSON.stringify(input.input.answer ?? null),
        input.input.isCorrect,
        input.input.score,
        input.input.contentVersion,
        input.input.clientAttemptId,
      ],
    )
    const row = result.rows[0]

    if (!row) {
      throw new ProjectZDatabaseError('mission_attempt_not_inserted')
    }

    return row
  }

  private async insertCompletedMission(input: {
    chapterId: string
    learnerId: string
    missionId: string
  },
  database: ProjectZPgQueryable) {
    await database.query(
      [
        'insert into public.completed_missions (',
        '  learner_id,',
        '  chapter_id,',
        '  mission_id,',
        '  first_completed_at',
        ')',
        'values ($1, $2, $3, now())',
        'on conflict (learner_id, chapter_id, mission_id) do nothing',
      ].join('\n'),
      [input.learnerId, input.chapterId, input.missionId],
    )
  }

  private async getMissionStart(input: {
    chapterId: string
    learnerId: string
    missionId: string
  },
  database: ProjectZPgQueryable): Promise<MissionStartQueryRow | null> {
    const result = await database.query<MissionStartQueryRow>(
      [
        'select started_at',
        'from public.mission_starts',
        'where learner_id = $1',
        '  and chapter_id = $2',
        '  and mission_id = $3',
        'limit 1',
      ].join('\n'),
      [input.learnerId, input.chapterId, input.missionId],
    )

    return result.rows[0] ?? null
  }

  private async insertSuspiciousEvent(input: {
    learnerId: string
    metadata: Record<string, unknown>
    pilotSessionId: string
    reason: SuspiciousEventReason
  },
  database: ProjectZPgQueryable): Promise<SuspiciousEvent> {
    const result = await database.query<SuspiciousEventQueryRow>(
      [
        'insert into public.suspicious_events (',
        '  learner_id,',
        '  pilot_session_id,',
        '  reason,',
        '  metadata,',
        '  created_at',
        ')',
        'values ($1, $2, $3, $4::jsonb, now())',
        'returning',
        '  learner_id::text,',
        '  pilot_session_id::text,',
        '  reason,',
        '  metadata,',
        '  created_at',
      ].join('\n'),
      [
        input.learnerId,
        input.pilotSessionId,
        input.reason,
        JSON.stringify(normalizeSuspiciousMetadata(input.metadata)),
      ],
    )
    const row = result.rows[0]

    if (!row) {
      throw new ProjectZDatabaseError('suspicious_event_not_recorded')
    }

    return mapSuspiciousEventQueryRow(row)
  }

  private async recordMissionAttemptSuspiciousSignals(input: {
    attemptCreatedAt: TimestampValue
    input: SubmitMissionAttemptInput
    learnerId: string
    pilotSessionId: string
  },
  database: ProjectZPgQueryable) {
    if (!input.input.isCorrect) {
      return
    }

    const missionStart = await this.getMissionStart(
      {
        chapterId: input.input.chapterId,
        learnerId: input.learnerId,
        missionId: input.input.missionId,
      },
      database,
    )
    const baseMetadata = {
      chapterId: input.input.chapterId,
      clientAttemptId: input.input.clientAttemptId,
      contentVersion: input.input.contentVersion,
      isChapterBoss: input.input.isChapterBoss,
      missionId: input.input.missionId,
      score: input.input.score,
    }

    if (!missionStart) {
      await this.insertSuspiciousEvent(
        {
          learnerId: input.learnerId,
          metadata: baseMetadata,
          pilotSessionId: input.pilotSessionId,
          reason: 'mission_start_missing',
        },
        database,
      )
      return
    }

    const elapsedSeconds = getElapsedSeconds({
      endedAt: input.attemptCreatedAt,
      startedAt: missionStart.started_at,
    })

    if (
      elapsedSeconds !== null &&
      elapsedSeconds < impossibleFastMissionSeconds
    ) {
      await this.insertSuspiciousEvent(
        {
          learnerId: input.learnerId,
          metadata: {
            ...baseMetadata,
            elapsedSeconds,
            thresholdSeconds: impossibleFastMissionSeconds,
          },
          pilotSessionId: input.pilotSessionId,
          reason: 'mission_completed_too_fast',
        },
        database,
      )
    }
  }

  private async isLearnerTrustedForPublicRecognition(
    learnerId: string,
    database: ProjectZPgQueryable,
  ) {
    const result = await database.query<TrustedRecognitionQueryRow>(
      [
        'select not exists (',
        '  select 1',
        '  from public.suspicious_events',
        '  where learner_id = $1',
        ') as is_trusted',
      ].join('\n'),
      [learnerId],
    )

    return result.rows[0]?.is_trusted ?? false
  }

  private async insertTrapDiscoveries(input: {
    learnerId: string
    trapIds: TrapConceptId[]
  },
  database: ProjectZPgQueryable) {
    if (input.trapIds.length === 0) {
      return
    }

    await database.query(
      [
        'insert into public.trap_discoveries (learner_id, trap_id, first_seen_at)',
        'select $1, trap_id, now()',
        'from unnest($2::text[]) as requested_traps(trap_id)',
        'on conflict (learner_id, trap_id) do nothing',
      ].join('\n'),
      [input.learnerId, input.trapIds],
    )
  }

  private async completeChapterAndCreateBadgeOutbox(input: {
    badgeNameSnapshot: string
    chapterId: string
    learnerId: string
    nextChapterId: string | null
    trustedForPublicRecognition: boolean
  },
  database: ProjectZPgQueryable) {
    const completedAt = await this.markChapterCompleted(input, database)

    if (input.nextChapterId?.trim()) {
      await this.openNextChapter(
        {
          chapterId: input.nextChapterId,
          learnerId: input.learnerId,
        },
        database,
      )
    }

    const completedChapters = await this.countCompletedChapters(
      input.learnerId,
      database,
    )
    const eventId = `project-z:badge:${input.learnerId}:${input.chapterId}`
    const badgeAwardId = await this.insertBadgeAward(
      {
        badgeNameSnapshot: input.badgeNameSnapshot,
        chapterId: input.chapterId,
        completedAt,
        completedChapters,
        eventId,
        learnerId: input.learnerId,
      },
      database,
    )

    if (badgeAwardId && input.trustedForPublicRecognition) {
      await this.insertAnnouncementDelivery(
        {
          badgeAwardId,
          eventId,
        },
        database,
      )
    }

    return {
      chapterId: input.chapterId,
      completedAt: serializeRequiredTimestamp(completedAt),
      completedChapters,
      learnerId: input.learnerId,
    }
  }

  private async markChapterCompleted(input: {
    chapterId: string
    learnerId: string
  },
  database: ProjectZPgQueryable): Promise<TimestampValue> {
    const updateResult = await database.query<CompletedAtQueryRow>(
      [
        'update public.learner_chapter_progress',
        "set status = 'completed',",
        '    completed_at = coalesce(completed_at, now())',
        'where learner_id = $1',
        '  and chapter_id = $2',
        'returning completed_at',
      ].join('\n'),
      [input.learnerId, input.chapterId],
    )
    const updatedAt = updateResult.rows[0]?.completed_at

    if (updatedAt) {
      return updatedAt
    }

    const insertResult = await database.query<CompletedAtQueryRow>(
      [
        'insert into public.learner_chapter_progress (',
        '  learner_id,',
        '  chapter_id,',
        '  status,',
        '  opened_at,',
        '  completed_at,',
        '  unlock_seen_at',
        ')',
        "values ($1, $2, 'completed', now(), now(), now())",
        'returning completed_at',
      ].join('\n'),
      [input.learnerId, input.chapterId],
    )
    const insertedAt = insertResult.rows[0]?.completed_at

    if (!insertedAt) {
      throw new ProjectZDatabaseError('chapter_completion_not_saved')
    }

    return insertedAt
  }

  private async openNextChapter(input: {
    chapterId: string
    learnerId: string
  },
  database: ProjectZPgQueryable) {
    await database.query(
      [
        'insert into public.learner_chapter_progress (',
        '  learner_id,',
        '  chapter_id,',
        '  status,',
        '  opened_at,',
        '  unlock_seen_at',
        ')',
        "values ($1, $2, 'open', now(), null)",
        'on conflict (learner_id, chapter_id) do update',
        '  set status = case',
        "        when public.learner_chapter_progress.status = 'completed'",
        '          then public.learner_chapter_progress.status',
        "        else 'open'",
        '      end,',
        '      opened_at = coalesce(public.learner_chapter_progress.opened_at, now())',
      ].join('\n'),
      [input.learnerId, input.chapterId],
    )
  }

  private async countCompletedChapters(
    learnerId: string,
    database: ProjectZPgQueryable,
  ) {
    const result = await database.query<CompletedChaptersQueryRow>(
      [
        'select',
        "  (count(*) filter (where status = 'completed'))::integer as completed_chapters",
        'from public.learner_chapter_progress',
        'where learner_id = $1',
      ].join('\n'),
      [learnerId],
    )

    return result.rows[0]?.completed_chapters ?? 0
  }

  private async insertBadgeAward(input: {
    badgeNameSnapshot: string
    chapterId: string
    completedAt: TimestampValue
    completedChapters: number
    eventId: string
    learnerId: string
  },
  database: ProjectZPgQueryable): Promise<string | null> {
    const result = await database.query<BadgeAwardInsertQueryRow>(
      [
        'insert into public.badge_awards (',
        '  learner_id,',
        '  chapter_id,',
        '  badge_name_snapshot,',
        '  completed_chapters,',
        '  awarded_at,',
        '  event_id',
        ')',
        'values ($1, $2, $3, $4, $5, $6)',
        'on conflict (learner_id, chapter_id) do nothing',
        'returning id::text',
      ].join('\n'),
      [
        input.learnerId,
        input.chapterId,
        input.badgeNameSnapshot,
        input.completedChapters,
        input.completedAt,
        input.eventId,
      ],
    )

    return result.rows[0]?.id ?? null
  }

  private async insertAnnouncementDelivery(input: {
    badgeAwardId: string
    eventId: string
  },
  database: ProjectZPgQueryable) {
    await database.query(
      [
        'insert into public.announcement_deliveries (',
        '  badge_award_id,',
        '  channel,',
        '  status,',
        '  idempotency_key',
        ')',
        "values ($1, 'pachca', 'pending', $2)",
        'on conflict (idempotency_key) do nothing',
      ].join('\n'),
      [input.badgeAwardId, `pachca:${input.eventId}`],
    )
  }

  private async getCompletedChapterCompletion(input: {
    chapterId: string
    learnerId: string
  },
  database: ProjectZPgQueryable) {
    const [completedChapters, completedAtResult] = await Promise.all([
      this.countCompletedChapters(input.learnerId, database),
      database.query<CompletedAtQueryRow>(
        [
          'select completed_at',
          'from public.learner_chapter_progress',
          'where learner_id = $1',
          '  and chapter_id = $2',
          "  and status = 'completed'",
          'limit 1',
        ].join('\n'),
        [input.learnerId, input.chapterId],
      ),
    ])
    const completedAt = completedAtResult.rows[0]?.completed_at

    if (!completedAt) {
      return null
    }

    return {
      chapterId: input.chapterId,
      completedAt: serializeRequiredTimestamp(completedAt),
      completedChapters,
      learnerId: input.learnerId,
    }
  }
}

export function createProjectZDatabaseFromEnv() {
  const databaseUrl = getRequiredEnvironmentVariable('DATABASE_URL')

  return new PostgresProjectZDatabase(
    new Pool({
      connectionString: databaseUrl,
    }),
  )
}
