import { afterEach, describe, expect, it, vi } from 'vitest'
import { BackendConfigurationError } from '../backend/configuration'
import {
  PostgresProjectZDatabase,
  type ProjectZPgClient,
  createProjectZDatabaseFromEnv,
  type ProjectZPgPool,
} from './postgresProjectZDatabase'
import type {
  RecordMissionStartInput,
  SubmitMissionAttemptInput,
} from './projectZDatabase'

type QueryCall = {
  parameters?: readonly unknown[]
  sql: string
}

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}

type FakeProjectZPgPool = ProjectZPgPool & {
  queries: QueryCall[]
  releaseCount(): number
}

function createFakePool(
  resultSets: Record<string, unknown>[][],
): FakeProjectZPgPool {
  const queries: QueryCall[] = []
  let releasedClients = 0

  const query = vi.fn(async (sql, parameters) => {
    queries.push({ parameters, sql })
    const transactionStatement = sql.trim().toLowerCase()

    if (
      transactionStatement === 'begin' ||
      transactionStatement === 'commit' ||
      transactionStatement === 'rollback'
    ) {
      return {
        rows: [],
      }
    }

    return {
      rows: resultSets.shift() ?? [],
    }
  }) as ProjectZPgPool['query']
  const connect = vi.fn(async () => {
    const client: ProjectZPgClient = {
      query,
      release: vi.fn(() => {
        releasedClients += 1
      }),
    }

    return client
  })

  return {
    connect,
    end: vi.fn(async () => {}),
    queries,
    query,
    releaseCount: () => releasedClients,
  }
}

function createMissionAttemptInput(
  input: Partial<SubmitMissionAttemptInput> = {},
): SubmitMissionAttemptInput {
  return {
    answer: 'correct-option',
    badgeNameSnapshot: 'Ответственный автор diff',
    chapterId: 'chapter-1',
    chapterIds: ['chapter-1', 'chapter-2'],
    clientAttemptId: 'attempt-1',
    contentVersion: '2026-06-01',
    encounteredTrapIds: [],
    firstChapterId: 'chapter-1',
    isChapterBoss: false,
    isCorrect: true,
    missionId: 'mission-1',
    nextChapterId: 'chapter-2',
    pilotSessionId,
    requiredPreviousMissionIds: [],
    score: 100,
    ...input,
  }
}

function createMissionStartInput(
  input: Partial<RecordMissionStartInput> = {},
): RecordMissionStartInput {
  return {
    chapterId: 'chapter-1',
    chapterIds: ['chapter-1', 'chapter-2'],
    contentVersion: '2026-06-01',
    firstChapterId: 'chapter-1',
    missionId: 'mission-1',
    pilotSessionId,
    requiredPreviousMissionIds: [],
    ...input,
  }
}

function createMissionAttemptRow(input: Record<string, unknown> = {}) {
  return {
    answer_json: 'correct-option',
    chapter_id: 'chapter-1',
    client_attempt_id: 'attempt-1',
    content_version: '2026-06-01',
    created_at: new Date(createdAt),
    is_correct: true,
    mission_id: 'mission-1',
    score: 100,
    ...input,
  }
}

function createMissionStartRow(input: Record<string, unknown> = {}) {
  return {
    started_at: new Date('2026-06-01T09:59:00.000Z'),
    ...input,
  }
}

function createSuspiciousEventRow(input: Record<string, unknown> = {}) {
  return {
    created_at: new Date(createdAt),
    learner_id: learnerId,
    metadata: {},
    pilot_session_id: pilotSessionId,
    reason: 'mission_completed_too_fast',
    ...input,
  }
}

function getSqlStatements(pool: FakeProjectZPgPool) {
  return pool.queries.map((query) => query.sql)
}

function getNormalizedSqlStatements(pool: FakeProjectZPgPool) {
  return getSqlStatements(pool).map((sql) => sql.trim().toLowerCase())
}

const previousDatabaseUrl = process.env.DATABASE_URL
const previousSupabaseUrl = process.env.SUPABASE_URL
const previousSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const createdAt = '2026-06-01T10:00:00.000Z'
const pilotSessionId = '11111111-1111-4111-8111-111111111111'
const learnerId = '22222222-2222-4222-8222-222222222222'

function createPilotSessionRow(input: Record<string, unknown> = {}) {
  return {
    created_at: new Date(createdAt),
    expires_at: null,
    id: pilotSessionId,
    last_seen_at: new Date('2026-06-01T10:05:00.000Z'),
    public_code: null,
    revoked_at: null,
    ...input,
  }
}

function createLearnerRow(input: Record<string, unknown> = {}) {
  return {
    full_name: 'Pilot Agent',
    id: learnerId,
    nickname: 'pilot-agent',
    ...input,
  }
}

function createReflectionRow(input: Record<string, unknown> = {}) {
  return {
    chapter_id: 'chapter-1',
    note: 'Use the checklist.',
    option_id: 'review',
    option_label: 'In review',
    skipped: false,
    updated_at: new Date(createdAt),
    ...input,
  }
}

afterEach(() => {
  restoreEnvironmentVariable('DATABASE_URL', previousDatabaseUrl)
  restoreEnvironmentVariable('SUPABASE_URL', previousSupabaseUrl)
  restoreEnvironmentVariable(
    'SUPABASE_SERVICE_ROLE_KEY',
    previousSupabaseServiceRoleKey,
  )
})

describe('PostgresProjectZDatabase factory', () => {
  it('requires DATABASE_URL without depending on Supabase env vars', async () => {
    delete process.env.DATABASE_URL
    process.env.SUPABASE_URL = 'https://project-z.test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    expect(() => createProjectZDatabaseFromEnv()).toThrow(
      BackendConfigurationError,
    )

    process.env.DATABASE_URL = 'postgres://project-z.test/postgres'
    const db = createProjectZDatabaseFromEnv()

    expect(db).toBeInstanceOf(PostgresProjectZDatabase)
    await db.close()
  })
})

describe('PostgresProjectZDatabase query boundary', () => {
  it('creates or reuses pilot sessions through own SQL and maps timestamps', async () => {
    const pool = createFakePool([
      [
        createPilotSessionRow({
          public_code: 'pilot-alpha',
        }),
      ],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.createPilotSession({ publicCode: ' pilot-alpha ' }),
    ).resolves.toEqual({
      pilotSession: {
        createdAt,
        expiresAt: null,
        id: pilotSessionId,
        lastSeenAt: '2026-06-01T10:05:00.000Z',
        publicCode: 'pilot-alpha',
        revokedAt: null,
      },
    })
    expect(pool.queries[0]).toMatchObject({
      parameters: [' pilot-alpha '],
    })
    expect(pool.queries[0]?.sql).toContain('updated_session')
    expect(pool.queries[0]?.sql).toContain('inserted_session')
    expect(pool.queries[0]?.sql).toContain("nullif(btrim($1::text), '')")
  })

  it('touches active sessions and returns /api/me profile data', async () => {
    const pool = createFakePool([[createPilotSessionRow()], [createLearnerRow()]])
    const db = new PostgresProjectZDatabase(pool)

    await expect(db.getMe({ pilotSessionId })).resolves.toEqual({
      learner: {
        fullName: 'Pilot Agent',
        id: learnerId,
        nickname: 'pilot-agent',
      },
      pilotSession: expect.objectContaining({
        id: pilotSessionId,
        lastSeenAt: '2026-06-01T10:05:00.000Z',
      }),
    })
    expect(pool.queries[0]).toMatchObject({
      parameters: [pilotSessionId],
    })
    expect(pool.queries[0]?.sql).toContain('set last_seen_at = now()')
    expect(pool.queries[0]?.sql).toContain('revoked_at is null')
    expect(pool.queries[1]?.sql).toContain('from public.learners')
  })

  it('normalizes learner identity and initializes chapter progress idempotently', async () => {
    const chapterIds = ['chapter-1', 'chapter-2']
    const pool = createFakePool([
      [createPilotSessionRow()],
      [
        createLearnerRow({
          full_name: 'Route Pilot',
          nickname: 'route pilot',
        }),
      ],
      [],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.identifyLearner({
        chapterIds,
        firstChapterId: 'chapter-1',
        fullName: '  Route   Pilot  ',
        nickname: '  route   pilot  ',
        pilotSessionId,
      }),
    ).resolves.toEqual({
      learner: {
        fullName: 'Route Pilot',
        id: learnerId,
        nickname: 'route pilot',
      },
    })
    expect(pool.queries[1]).toMatchObject({
      parameters: [pilotSessionId, 'route pilot', 'Route Pilot'],
    })
    expect(pool.queries[1]?.sql).toContain(
      'on conflict (pilot_session_id) do update',
    )
    expect(pool.queries[2]).toMatchObject({
      parameters: [learnerId, chapterIds, 'chapter-1'],
    })
    expect(pool.queries[2]?.sql).toContain(
      'on conflict (learner_id, chapter_id) do update',
    )
    expect(pool.queries[2]?.sql).toContain(
      "when previous_progress.status = 'completed' then 'open'",
    )
  })

  it('rejects empty normalized learner nicknames before touching Postgres', async () => {
    const pool = createFakePool([])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.identifyLearner({
        chapterIds: ['chapter-1'],
        firstChapterId: 'chapter-1',
        fullName: null,
        nickname: '    ',
        pilotSessionId,
      }),
    ).rejects.toMatchObject({
      message: 'nickname_required',
    })
    expect(pool.queries).toHaveLength(0)
  })

  it('rejects empty normalized learner full names before touching Postgres', async () => {
    const invalidFullNames = [null, '    ']

    for (const fullName of invalidFullNames) {
      const pool = createFakePool([])
      const db = new PostgresProjectZDatabase(pool)

      await expect(
        db.identifyLearner({
          chapterIds: ['chapter-1'],
          firstChapterId: 'chapter-1',
          fullName,
          nickname: 'pilot-agent',
          pilotSessionId,
        }),
      ).rejects.toMatchObject({
        message: 'full_name_required',
      })
      expect(pool.queries).toHaveLength(0)
    }
  })

  it('returns progress payloads with ordered chapters, completed missions and pending unlocks', async () => {
    const chapterIds = ['chapter-1', 'chapter-2', 'chapter-3']
    const pool = createFakePool([
      [createPilotSessionRow()],
      [createLearnerRow()],
      [],
      [
        {
          chapter_id: 'chapter-1',
          status: 'completed',
        },
        {
          chapter_id: 'chapter-2',
          status: 'open',
        },
      ],
      [
        {
          chapter_id: 'chapter-1',
          mission_id: 'who-owns-the-diff',
        },
        {
          chapter_id: 'chapter-1',
          mission_id: 'review-before-submit',
        },
      ],
      [
        {
          trap_id: 'weak-test',
        },
      ],
      [
        {
          chapter_id: 'chapter-2',
        },
      ],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.getProgress({
        chapterIds,
        firstChapterId: 'chapter-1',
        pilotSessionId,
      }),
    ).resolves.toEqual({
      completedMissionIds: ['who-owns-the-diff', 'review-before-submit'],
      encounteredTrapIds: ['weak-test'],
      learner: {
        fullName: 'Pilot Agent',
        id: learnerId,
        nickname: 'pilot-agent',
      },
      pendingUnlockChapterId: 'chapter-2',
      progress: [
        {
          chapterId: 'chapter-1',
          completedMissionIds: [
            'who-owns-the-diff',
            'review-before-submit',
          ],
          status: 'completed',
        },
        {
          chapterId: 'chapter-2',
          completedMissionIds: [],
          status: 'open',
        },
        {
          chapterId: 'chapter-3',
          completedMissionIds: [],
          status: 'locked',
        },
      ],
    })
    expect(pool.queries[2]).toMatchObject({
      parameters: [learnerId, chapterIds, 'chapter-1'],
    })
    expect(pool.queries[3]?.sql).toContain(
      'order by array_position($2::text[], chapter_id)',
    )
    expect(pool.queries[6]?.parameters).toEqual([
      learnerId,
      chapterIds,
      'chapter-1',
    ])
  })

  it('requires an identified learner before returning progress', async () => {
    const pool = createFakePool([[createPilotSessionRow()], []])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.getProgress({
        chapterIds: ['chapter-1'],
        firstChapterId: 'chapter-1',
        pilotSessionId,
      }),
    ).rejects.toMatchObject({
      message: 'learner_not_identified',
    })
    expect(pool.queries).toHaveLength(2)
  })

  it('reconciles inserted catalog chapters after completed predecessor rows', async () => {
    const chapterIds = ['chapter-1', 'chapter-5', 'chapter-6']
    const pool = createFakePool([
      [createPilotSessionRow()],
      [createLearnerRow()],
      [],
      [
        {
          chapter_id: 'chapter-1',
          status: 'completed',
        },
        {
          chapter_id: 'chapter-5',
          status: 'open',
        },
        {
          chapter_id: 'chapter-6',
          status: 'completed',
        },
      ],
      [],
      [],
      [
        {
          chapter_id: 'chapter-5',
        },
      ],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.getProgress({
        chapterIds,
        firstChapterId: 'chapter-1',
        pilotSessionId,
      }),
    ).resolves.toMatchObject({
      pendingUnlockChapterId: 'chapter-5',
      progress: [
        {
          chapterId: 'chapter-1',
          status: 'completed',
        },
        {
          chapterId: 'chapter-5',
          status: 'open',
        },
        {
          chapterId: 'chapter-6',
          status: 'completed',
        },
      ],
    })
    expect(pool.queries[2]).toMatchObject({
      parameters: [learnerId, chapterIds, 'chapter-1'],
    })
    expect(pool.queries[2]?.sql).toContain('progress_seed')
    expect(pool.queries[2]?.sql).toContain(
      "when previous_progress.status = 'completed' then 'open'",
    )
    expect(pool.queries[2]?.sql).toContain(
      "when excluded.status = 'open'",
    )
  })

  it('records mission starts idempotently through active learner sessions', async () => {
    const startedAt = new Date('2026-06-01T10:30:00.000Z')
    const pool = createFakePool([
      [createPilotSessionRow()],
      [createLearnerRow()],
      [],
      [{ status: 'open' }],
      [],
      [createMissionStartRow({ started_at: startedAt })],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.recordMissionStart(createMissionStartInput()),
    ).resolves.toEqual({
      startedAt: '2026-06-01T10:30:00.000Z',
    })
    expect(pool.queries[3]).toMatchObject({
      parameters: [learnerId, ['chapter-1', 'chapter-2'], 'chapter-1'],
    })
    expect(pool.queries[4]).toMatchObject({
      parameters: [learnerId, 'chapter-1'],
    })
    expect(pool.queries[5]).toMatchObject({
      parameters: [learnerId, 'chapter-1', []],
    })
    expect(pool.queries[6]).toMatchObject({
      parameters: [learnerId, pilotSessionId, 'chapter-1', 'mission-1'],
    })
    expect(pool.queries[6]?.sql).toContain(
      'insert into public.mission_starts',
    )
    expect(pool.queries[6]?.sql).toContain(
      'on conflict (learner_id, chapter_id, mission_id) do update',
    )
    expect(getNormalizedSqlStatements(pool)).toContain('commit')
  })

  it('rolls back before inserting mission starts when the chapter is locked', async () => {
    const pool = createFakePool([
      [createPilotSessionRow()],
      [createLearnerRow()],
      [],
      [{ status: 'locked' }],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.recordMissionStart(
        createMissionStartInput({
          chapterId: 'chapter-2',
          missionId: 'mission-2',
        }),
      ),
    ).rejects.toMatchObject({
      message: 'chapter_not_open',
    })

    const normalizedSql = getNormalizedSqlStatements(pool)

    expect(normalizedSql).toContain('begin')
    expect(normalizedSql).toContain('rollback')
    expect(normalizedSql).not.toContain('commit')
    expect(
      getSqlStatements(pool).some((sql) =>
        sql.includes('insert into public.mission_starts'),
      ),
    ).toBe(false)
  })

  it('rolls back before inserting mission starts when previous missions are missing', async () => {
    const pool = createFakePool([
      [createPilotSessionRow()],
      [createLearnerRow()],
      [],
      [{ status: 'open' }],
      [{ required_mission_id: 'mission-0' }],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.recordMissionStart(
        createMissionStartInput({
          missionId: 'mission-1',
          requiredPreviousMissionIds: ['mission-0'],
        }),
      ),
    ).rejects.toMatchObject({
      message: 'mission_not_open',
    })

    const normalizedSql = getNormalizedSqlStatements(pool)

    expect(normalizedSql).toContain('begin')
    expect(normalizedSql).toContain('rollback')
    expect(normalizedSql).not.toContain('commit')
    expect(
      getSqlStatements(pool).some((sql) =>
        sql.includes('insert into public.mission_starts'),
      ),
    ).toBe(false)
  })

  it('records suspicious events with normalized metadata', async () => {
    const longValue = 'x'.repeat(520)
    const pool = createFakePool([
      [createPilotSessionRow()],
      [createLearnerRow()],
      [
        createSuspiciousEventRow({
          metadata: {
            details: {
              dropped: undefined,
              kept: true,
            },
            longValue: longValue.slice(0, 500),
          },
          reason: 'mission_start_missing',
        }),
      ],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.recordSuspiciousEvent({
        metadata: {
          details: {
            dropped: undefined,
            kept: true,
          },
          longValue,
        },
        pilotSessionId,
        reason: 'mission_start_missing',
      }),
    ).resolves.toEqual({
      event: {
        createdAt,
        learnerId,
        metadata: {
          details: {
            kept: true,
          },
          longValue: longValue.slice(0, 500),
        },
        pilotSessionId,
        reason: 'mission_start_missing',
      },
    })
    expect(pool.queries[2]).toMatchObject({
      parameters: [
        learnerId,
        pilotSessionId,
        'mission_start_missing',
        JSON.stringify({
          details: {
            kept: true,
          },
          longValue: longValue.slice(0, 500),
        }),
      ],
    })
    expect(pool.queries[2]?.sql).toContain(
      'insert into public.suspicious_events',
    )
  })

  it('persists correct boss attempts, badge awards and outbox rows in one transaction', async () => {
    const completedAt = new Date('2026-06-01T11:00:00.000Z')
    const pool = createFakePool([
      [createPilotSessionRow()],
      [createLearnerRow()],
      [],
      [{ status: 'open' }],
      [],
      [],
      [{ is_new: true, trap_id: 'weak-test' }],
      [
        createMissionAttemptRow({
          answer_json: { boss: 'answer' },
          client_attempt_id: 'boss-attempt',
          mission_id: 'boss-1',
        }),
      ],
      [],
      [],
      [createMissionStartRow()],
      [{ is_trusted: true }],
      [{ completed_at: completedAt }],
      [],
      [{ completed_chapters: 1 }],
      [{ id: 'badge-award-1' }],
      [],
      [
        {
          chapter_id: 'chapter-1',
          status: 'completed',
        },
        {
          chapter_id: 'chapter-2',
          status: 'open',
        },
      ],
      [
        {
          chapter_id: 'chapter-1',
          mission_id: 'boss-1',
        },
      ],
      [
        {
          trap_id: 'weak-test',
        },
      ],
      [
        {
          chapter_id: 'chapter-2',
        },
      ],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.submitMissionAttempt(
        createMissionAttemptInput({
          answer: { boss: 'answer' },
          clientAttemptId: 'boss-attempt',
          encounteredTrapIds: ['weak-test'],
          isChapterBoss: true,
          missionId: 'boss-1',
          requiredPreviousMissionIds: ['mission-0'],
        }),
      ),
    ).resolves.toEqual({
      attempt: {
        answer: { boss: 'answer' },
        chapterId: 'chapter-1',
        clientAttemptId: 'boss-attempt',
        contentVersion: '2026-06-01',
        createdAt,
        isCorrect: true,
        missionId: 'boss-1',
        score: 100,
      },
      completedMissionIds: ['boss-1'],
      completion: {
        chapterId: 'chapter-1',
        completedAt: '2026-06-01T11:00:00.000Z',
        completedChapters: 1,
        learnerId,
      },
      duplicate: false,
      progress: [
        {
          chapterId: 'chapter-1',
          completedMissionIds: ['boss-1'],
          status: 'completed',
        },
        {
          chapterId: 'chapter-2',
          completedMissionIds: [],
          status: 'open',
        },
      ],
      trapDiscoveries: [{ id: 'weak-test', isNew: true }],
    })

    const normalizedSql = getNormalizedSqlStatements(pool)
    const joinedSql = getSqlStatements(pool).join('\n\n')

    expect(normalizedSql[0]).toBe('begin')
    expect(normalizedSql.at(-1)).toBe('commit')
    expect(pool.releaseCount()).toBe(1)
    expect(joinedSql).toContain('insert into public.mission_attempts')
    expect(joinedSql).toContain('insert into public.completed_missions')
    expect(joinedSql).toContain('insert into public.trap_discoveries')
    expect(joinedSql).toContain('insert into public.badge_awards')
    expect(joinedSql).toContain('insert into public.announcement_deliveries')
    expect(
      pool.queries.find((query) =>
        query.sql.includes('insert into public.announcement_deliveries'),
      )?.parameters,
    ).toEqual([
      'badge-award-1',
      `pachca:project-z:badge:${learnerId}:chapter-1`,
    ])
  })

  it('keeps suspicious boss completions personal and skips public announcement outbox', async () => {
    const completedAt = new Date('2026-06-01T11:00:00.000Z')
    const pool = createFakePool([
      [createPilotSessionRow()],
      [createLearnerRow()],
      [],
      [{ status: 'open' }],
      [],
      [],
      [
        createMissionAttemptRow({
          answer_json: { boss: 'answer' },
          client_attempt_id: 'boss-attempt-suspicious',
          mission_id: 'boss-1',
        }),
      ],
      [],
      [createMissionStartRow({ started_at: new Date(createdAt) })],
      [
        createSuspiciousEventRow({
          metadata: {
            elapsedSeconds: 0,
            thresholdSeconds: 2,
          },
          reason: 'mission_completed_too_fast',
        }),
      ],
      [{ is_trusted: false }],
      [{ completed_at: completedAt }],
      [],
      [{ completed_chapters: 1 }],
      [{ id: 'badge-award-1' }],
      [
        {
          chapter_id: 'chapter-1',
          status: 'completed',
        },
        {
          chapter_id: 'chapter-2',
          status: 'open',
        },
      ],
      [
        {
          chapter_id: 'chapter-1',
          mission_id: 'boss-1',
        },
      ],
      [],
      [
        {
          chapter_id: 'chapter-2',
        },
      ],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.submitMissionAttempt(
        createMissionAttemptInput({
          answer: { boss: 'answer' },
          clientAttemptId: 'boss-attempt-suspicious',
          isChapterBoss: true,
          missionId: 'boss-1',
        }),
      ),
    ).resolves.toMatchObject({
      completion: {
        chapterId: 'chapter-1',
        completedChapters: 1,
        learnerId,
      },
      duplicate: false,
    })

    const joinedSql = getSqlStatements(pool).join('\n\n')

    expect(joinedSql).toContain('insert into public.suspicious_events')
    expect(joinedSql).toContain('insert into public.badge_awards')
    expect(joinedSql).not.toContain('insert into public.announcement_deliveries')
    expect(
      pool.queries.find((query) =>
        query.sql.includes('insert into public.suspicious_events'),
      )?.parameters,
    ).toEqual([
      learnerId,
      pilotSessionId,
      'mission_completed_too_fast',
      JSON.stringify({
        chapterId: 'chapter-1',
        clientAttemptId: 'boss-attempt-suspicious',
        contentVersion: '2026-06-01',
        isChapterBoss: true,
        missionId: 'boss-1',
        score: 100,
        elapsedSeconds: 0,
        thresholdSeconds: 2,
      }),
    ])
  })

  it('records missing mission starts as suspicious without blocking correct progress', async () => {
    const pool = createFakePool([
      [createPilotSessionRow()],
      [createLearnerRow()],
      [],
      [{ status: 'open' }],
      [],
      [],
      [createMissionAttemptRow()],
      [],
      [],
      [
        createSuspiciousEventRow({
          reason: 'mission_start_missing',
        }),
      ],
      [
        {
          chapter_id: 'chapter-1',
          status: 'open',
        },
      ],
      [
        {
          chapter_id: 'chapter-1',
          mission_id: 'mission-1',
        },
      ],
      [],
      [],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.submitMissionAttempt(createMissionAttemptInput()),
    ).resolves.toMatchObject({
      completedMissionIds: ['mission-1'],
      duplicate: false,
      progress: [
        {
          chapterId: 'chapter-1',
          completedMissionIds: ['mission-1'],
          status: 'open',
        },
        {
          chapterId: 'chapter-2',
          completedMissionIds: [],
          status: 'locked',
        },
      ],
    })
    expect(
      pool.queries.find((query) =>
        query.sql.includes('insert into public.suspicious_events'),
      )?.parameters,
    ).toEqual([
      learnerId,
      pilotSessionId,
      'mission_start_missing',
      JSON.stringify({
        chapterId: 'chapter-1',
        clientAttemptId: 'attempt-1',
        contentVersion: '2026-06-01',
        isChapterBoss: false,
        missionId: 'mission-1',
        score: 100,
      }),
    ])
  })

  it('returns persisted duplicate attempts without inserting the retried body', async () => {
    const pool = createFakePool([
      [createPilotSessionRow()],
      [createLearnerRow()],
      [],
      [{ status: 'open' }],
      [],
      [
        createMissionAttemptRow({
          answer_json: 'persisted-wrong-option',
          is_correct: false,
          score: 0,
        }),
      ],
      [
        {
          chapter_id: 'chapter-1',
          status: 'open',
        },
      ],
      [],
      [],
      [],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.submitMissionAttempt(
        createMissionAttemptInput({
          answer: 'client-retry-correct-option',
          encounteredTrapIds: ['weak-test'],
          isCorrect: true,
          score: 100,
        }),
      ),
    ).resolves.toMatchObject({
      attempt: {
        answer: 'persisted-wrong-option',
        isCorrect: false,
        score: 0,
      },
      duplicate: true,
      trapDiscoveries: [],
    })

    expect(
      getSqlStatements(pool).some((sql) =>
        sql.includes('insert into public.mission_attempts'),
      ),
    ).toBe(false)
    expect(getNormalizedSqlStatements(pool)).toContain('commit')
  })

  it('rolls back when a client attempt id is reused for another mission', async () => {
    const pool = createFakePool([
      [createPilotSessionRow()],
      [createLearnerRow()],
      [],
      [{ status: 'open' }],
      [],
      [
        createMissionAttemptRow({
          mission_id: 'different-mission',
        }),
      ],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.submitMissionAttempt(createMissionAttemptInput()),
    ).rejects.toMatchObject({
      message: 'client_attempt_id_reused_for_different_mission',
    })

    const normalizedSql = getNormalizedSqlStatements(pool)

    expect(normalizedSql).toContain('begin')
    expect(normalizedSql).toContain('rollback')
    expect(normalizedSql).not.toContain('commit')
    expect(pool.releaseCount()).toBe(1)
  })

  it('rolls back before inserting attempts when the chapter is locked', async () => {
    const pool = createFakePool([
      [createPilotSessionRow()],
      [createLearnerRow()],
      [],
      [{ status: 'locked' }],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.submitMissionAttempt(
        createMissionAttemptInput({
          chapterId: 'chapter-2',
          missionId: 'mission-2',
        }),
      ),
    ).rejects.toMatchObject({
      message: 'chapter_not_open',
    })

    const normalizedSql = getNormalizedSqlStatements(pool)

    expect(normalizedSql).toContain('begin')
    expect(normalizedSql).toContain('rollback')
    expect(normalizedSql).not.toContain('commit')
    expect(
      getSqlStatements(pool).some((sql) =>
        sql.includes('insert into public.mission_attempts'),
      ),
    ).toBe(false)
    expect(
      getSqlStatements(pool).some((sql) =>
        sql.includes('from public.mission_attempts'),
      ),
    ).toBe(false)
    expect(pool.releaseCount()).toBe(1)
  })

  it('rolls back before inserting attempts when required missions are missing', async () => {
    const pool = createFakePool([
      [createPilotSessionRow()],
      [createLearnerRow()],
      [],
      [{ status: 'open' }],
      [{ required_mission_id: 'mission-0' }],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.submitMissionAttempt(
        createMissionAttemptInput({
          requiredPreviousMissionIds: ['mission-0'],
        }),
      ),
    ).rejects.toMatchObject({
      message: 'mission_not_open',
    })

    expect(getNormalizedSqlStatements(pool)).toContain('rollback')
    expect(
      getSqlStatements(pool).some((sql) =>
        sql.includes('from public.mission_attempts'),
      ),
    ).toBe(false)
  })

  it('rejects empty client attempt ids before opening a transaction', async () => {
    const pool = createFakePool([])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.submitMissionAttempt(
        createMissionAttemptInput({
          clientAttemptId: '    ',
        }),
      ),
    ).rejects.toMatchObject({
      message: 'client_attempt_id_required',
    })
    expect(pool.queries).toHaveLength(0)
    expect(pool.releaseCount()).toBe(0)
  })

  it('reads learner-owned chapter reflections through active session SQL', async () => {
    const chapterIds = ['chapter-1', 'chapter-2']
    const pool = createFakePool([
      [createPilotSessionRow()],
      [createLearnerRow()],
      [{ status: 'completed' }],
      [createReflectionRow()],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.getChapterReflection({
        chapterId: 'chapter-1',
        chapterIds,
        pilotSessionId,
      }),
    ).resolves.toEqual({
      reflection: {
        chapterId: 'chapter-1',
        note: 'Use the checklist.',
        optionId: 'review',
        optionLabel: 'In review',
        skipped: false,
        updatedAt: createdAt,
      },
    })
    expect(pool.queries[0]?.sql).toContain('revoked_at is null')
    expect(pool.queries[2]).toMatchObject({
      parameters: [learnerId, 'chapter-1', chapterIds],
    })
    expect(pool.queries[2]?.sql).toContain('chapter_id = any($3::text[])')
    expect(pool.queries[3]).toMatchObject({
      parameters: [learnerId, 'chapter-1'],
    })
    expect(pool.queries[3]?.sql).toContain('from public.chapter_reflections')
  })

  it('rejects reflection reads for chapters that are not completed or known', async () => {
    const cases = [
      {
        chapterId: 'chapter-2',
        chapterIds: ['chapter-1', 'chapter-2'],
        statusRows: [{ status: 'open' }],
      },
      {
        chapterId: 'chapter-2',
        chapterIds: ['chapter-1', 'chapter-2'],
        statusRows: [{ status: 'locked' }],
      },
      {
        chapterId: 'chapter-99',
        chapterIds: ['chapter-1', 'chapter-2'],
        statusRows: [],
      },
    ]

    for (const testCase of cases) {
      const pool = createFakePool([
        [createPilotSessionRow()],
        [createLearnerRow()],
        testCase.statusRows,
      ])
      const db = new PostgresProjectZDatabase(pool)

      await expect(
        db.getChapterReflection({
          chapterId: testCase.chapterId,
          chapterIds: testCase.chapterIds,
          pilotSessionId,
        }),
      ).rejects.toMatchObject({
        message: 'chapter_not_completed',
      })
      expect(
        getSqlStatements(pool).some((sql) =>
          sql.includes('from public.chapter_reflections'),
        ),
      ).toBe(false)
    }
  })

  it('normalizes and upserts chapter reflections with compatible caps', async () => {
    const chapterIds = ['chapter-1', 'chapter-2']
    const longNote = `${'Use   '.repeat(60)}checklist`
    const pool = createFakePool([
      [createPilotSessionRow()],
      [createLearnerRow()],
      [{ status: 'completed' }],
      [createReflectionRow()],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.saveChapterReflection({
        chapterId: 'chapter-1',
        chapterIds,
        note: longNote,
        optionId: '  review   ',
        optionLabel: '  In   review  ',
        pilotSessionId,
        skipped: false,
      }),
    ).resolves.toEqual({
      reflection: {
        chapterId: 'chapter-1',
        note: 'Use the checklist.',
        optionId: 'review',
        optionLabel: 'In review',
        skipped: false,
        updatedAt: createdAt,
      },
    })
    expect(pool.queries[2]).toMatchObject({
      parameters: [learnerId, 'chapter-1', chapterIds],
    })
    expect(pool.queries[3]).toMatchObject({
      parameters: [
        learnerId,
        'chapter-1',
        'review',
        'In review',
        Array.from(longNote.trim().replace(/\s+/g, ' '))
          .slice(0, 180)
          .join(''),
        false,
      ],
    })
    expect(pool.queries[3]?.sql).toContain(
      'on conflict (learner_id, chapter_id) do update',
    )
  })

  it('rejects reflection saves for incomplete or unknown chapters before upserting', async () => {
    const cases = [
      {
        chapterId: 'chapter-2',
        chapterIds: ['chapter-1', 'chapter-2'],
        statusRows: [{ status: 'open' }],
      },
      {
        chapterId: 'chapter-2',
        chapterIds: ['chapter-1', 'chapter-2'],
        statusRows: [{ status: 'locked' }],
      },
      {
        chapterId: 'chapter-99',
        chapterIds: ['chapter-1', 'chapter-2'],
        statusRows: [],
      },
    ]

    for (const testCase of cases) {
      const pool = createFakePool([
        [createPilotSessionRow()],
        [createLearnerRow()],
        testCase.statusRows,
      ])
      const db = new PostgresProjectZDatabase(pool)

      await expect(
        db.saveChapterReflection({
          chapterId: testCase.chapterId,
          chapterIds: testCase.chapterIds,
          note: 'Client note should not be stored.',
          optionId: 'review',
          optionLabel: 'In review',
          pilotSessionId,
          skipped: false,
        }),
      ).rejects.toMatchObject({
        message: 'chapter_not_completed',
      })
      expect(
        getSqlStatements(pool).some((sql) =>
          sql.includes('insert into public.chapter_reflections'),
        ),
      ).toBe(false)
    }
  })

  it('clears option and note fields for skipped chapter reflections', async () => {
    const pool = createFakePool([
      [createPilotSessionRow()],
      [createLearnerRow()],
      [{ status: 'completed' }],
      [
        createReflectionRow({
          note: '',
          option_id: null,
          option_label: null,
          skipped: true,
        }),
      ],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.saveChapterReflection({
        chapterId: 'chapter-1',
        chapterIds: ['chapter-1', 'chapter-2'],
        note: 'Client note should be cleared.',
        optionId: 'review',
        optionLabel: 'In review',
        pilotSessionId,
        skipped: true,
      }),
    ).resolves.toEqual({
      reflection: {
        chapterId: 'chapter-1',
        note: '',
        optionId: null,
        optionLabel: null,
        skipped: true,
        updatedAt: createdAt,
      },
    })
    expect(pool.queries[3]).toMatchObject({
      parameters: [learnerId, 'chapter-1', null, null, '', true],
    })
  })

  it('marks unlock seen idempotently and returns updated progress', async () => {
    const chapterIds = ['chapter-1', 'chapter-2']
    const pool = createFakePool([
      [createPilotSessionRow()],
      [createLearnerRow()],
      [{ status: 'open' }],
      [],
      [
        {
          chapter_id: 'chapter-1',
          status: 'completed',
        },
        {
          chapter_id: 'chapter-2',
          status: 'open',
        },
      ],
      [
        {
          chapter_id: 'chapter-1',
          mission_id: 'who-owns-the-diff',
        },
      ],
      [],
      [],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.markUnlockSeen({
        chapterId: 'chapter-2',
        chapterIds,
        firstChapterId: 'chapter-1',
        pilotSessionId,
      }),
    ).resolves.toEqual({
      completedMissionIds: ['who-owns-the-diff'],
      encounteredTrapIds: [],
      pendingUnlockChapterId: null,
      progress: [
        {
          chapterId: 'chapter-1',
          completedMissionIds: ['who-owns-the-diff'],
          status: 'completed',
        },
        {
          chapterId: 'chapter-2',
          completedMissionIds: [],
          status: 'open',
        },
      ],
    })
    expect(pool.queries[3]).toMatchObject({
      parameters: [learnerId, 'chapter-2'],
    })
    expect(pool.queries[3]?.sql).toContain(
      'unlock_seen_at = coalesce(unlock_seen_at, now())',
    )
  })

  it('rejects unlock seen for locked or unknown chapters before mutating progress', async () => {
    const cases = [
      {
        chapterId: 'chapter-2',
        chapterIds: ['chapter-1', 'chapter-2'],
        statusRows: [{ status: 'locked' }],
      },
      {
        chapterId: 'chapter-99',
        chapterIds: ['chapter-1', 'chapter-2'],
        statusRows: [],
      },
    ]

    for (const testCase of cases) {
      const pool = createFakePool([
        [createPilotSessionRow()],
        [createLearnerRow()],
        testCase.statusRows,
      ])
      const db = new PostgresProjectZDatabase(pool)

      await expect(
        db.markUnlockSeen({
          chapterId: testCase.chapterId,
          chapterIds: testCase.chapterIds,
          firstChapterId: 'chapter-1',
          pilotSessionId,
        }),
      ).rejects.toMatchObject({
        message: 'chapter_not_open',
      })
      expect(
        getSqlStatements(pool).some((sql) =>
          sql.includes('unlock_seen_at = coalesce(unlock_seen_at, now())'),
        ),
      ).toBe(false)
      expect(
        getSqlStatements(pool).some((sql) =>
          sql.includes('on conflict (learner_id, chapter_id) do update'),
        ),
      ).toBe(false)
    }
  })

  it('maps leaderboard rows from pg into database-domain entries', async () => {
    const pool = createFakePool([
      [
        {
          closed_chapters_count: 2,
          last_badge_date: new Date('2026-06-01T10:00:00.000Z'),
          last_badge_name: 'Чёткий бриф',
          learner_id: 'learner-1',
          nickname: 'pilot-agent',
        },
      ],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(db.getLeaderboardEntries()).resolves.toEqual([
      {
        closedChaptersCount: 2,
        lastBadgeDate: '2026-06-01T10:00:00.000Z',
        lastBadgeName: 'Чёткий бриф',
        learnerId: 'learner-1',
        nickname: 'pilot-agent',
      },
    ])
    expect(pool.queries[0]?.sql).toContain('public.leaderboard_entries')
    expect(pool.queries[0]?.sql).not.toContain('full_name')
    expect(pool.queries[0]?.sql).toContain(
      'order by closed_chapters_count desc',
    )
  })

  it('reads and updates pending announcement deliveries through pg', async () => {
    const deliveryRow = {
      attempts_count: 0,
      awarded_at: new Date('2026-06-01T10:00:00.000Z'),
      badge_award_id: 'badge-award-1',
      badge_name_snapshot: 'Ответственный автор diff',
      channel: 'pachca',
      chapter_id: 'chapter-1',
      completed_chapters: 1,
      id: 'delivery-1',
      idempotency_key: 'pachca:project-z:badge:learner-1:chapter-1',
      learner_nickname: 'pilot-agent',
      status: 'pending',
    }
    const pool = createFakePool([
      [deliveryRow],
      [
        {
          ...deliveryRow,
          attempts_count: 1,
          status: 'dry_run',
        },
      ],
    ])
    const db = new PostgresProjectZDatabase(pool)

    await expect(
      db.getPendingAnnouncementDeliveries({
        limit: 10,
        maxAttempts: 3,
      }),
    ).resolves.toEqual([
      {
        attemptsCount: 0,
        badgeAward: {
          awardedAt: '2026-06-01T10:00:00.000Z',
          badgeNameSnapshot: 'Ответственный автор diff',
          chapterId: 'chapter-1',
          completedChapters: 1,
          learner: {
            nickname: 'pilot-agent',
          },
        },
        badgeAwardId: 'badge-award-1',
        channel: 'pachca',
        id: 'delivery-1',
        idempotencyKey: 'pachca:project-z:badge:learner-1:chapter-1',
        status: 'pending',
      },
    ])
    expect(pool.queries[0]).toMatchObject({
      parameters: [3, 10],
    })
    expect(pool.queries[0]?.sql).toContain(
      "where announcement_deliveries.channel = 'pachca'",
    )
    expect(pool.queries[0]?.sql).toContain(
      "and announcement_deliveries.status = 'pending'",
    )
    expect(pool.queries[0]?.sql).toContain(
      'and announcement_deliveries.attempts_count < $1',
    )
    expect(pool.queries[0]?.sql).toContain(
      'order by announcement_deliveries.created_at asc',
    )
    expect(pool.queries[0]?.sql).toContain('limit $2')

    await expect(
      db.updateAnnouncementDeliveryStatus({
        attemptsCount: 1,
        deliveryId: 'delivery-1',
        lastError: null,
        maxAttempts: 3,
        status: 'dry_run',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        attemptsCount: 1,
        id: 'delivery-1',
        status: 'dry_run',
      }),
    ])
    expect(pool.queries[1]).toMatchObject({
      parameters: [1, null, 'dry_run', 'delivery-1', 3],
    })
    expect(pool.queries[1]?.sql).toContain(
      'update public.announcement_deliveries',
    )
    expect(pool.queries[1]?.sql).toContain('set attempts_count = $1')
    expect(pool.queries[1]?.sql).toContain('last_error = $2')
    expect(pool.queries[1]?.sql).toContain('sent_at = null')
    expect(pool.queries[1]?.sql).toContain("where id = $4")
    expect(pool.queries[1]?.sql).toContain("and status = 'pending'")
    expect(pool.queries[1]?.sql).toContain('and attempts_count < $5')
  })
})
