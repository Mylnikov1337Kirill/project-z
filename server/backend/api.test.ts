import { afterEach, describe, expect, it, vi } from 'vitest'
import { chapters } from '../../src/entities/chapter/model/chapterCatalog'
import { staticContentVersion } from '../../src/shared/api/content/staticContentRepository'
import type {
  Chapter,
  ChapterProgress,
  Learner,
  ScenarioDecisionMission,
} from '../../src/shared/types/domain'
import type {
  ProjectZDatabase,
  SubmitMissionAttemptInput,
} from '../db/projectZDatabase'
import { ProjectZDatabaseError } from '../db/projectZDatabase'
import { handleProjectZApiRequest, resetProjectZApiRateLimiters } from './api'
import type { BackendRequest } from './http'
import { createProjectZRateLimiter } from './rateLimiting'

type CreatePilotSessionInput = Parameters<
  ProjectZDatabase['createPilotSession']
>[0]
type GetMeInput = Parameters<ProjectZDatabase['getMe']>[0]
type IdentifyLearnerInput = Parameters<
  ProjectZDatabase['identifyLearner']
>[0]
type RecordMissionStartInput = Parameters<
  ProjectZDatabase['recordMissionStart']
>[0]
type RecordSuspiciousEventInput = Parameters<
  ProjectZDatabase['recordSuspiciousEvent']
>[0]
type GetProgressInput = Parameters<ProjectZDatabase['getProgress']>[0]
type GetChapterReflectionInput = Parameters<
  ProjectZDatabase['getChapterReflection']
>[0]
type SaveChapterReflectionInput = Parameters<
  ProjectZDatabase['saveChapterReflection']
>[0]
type MarkUnlockSeenInput = Parameters<
  ProjectZDatabase['markUnlockSeen']
>[0]
type FakeProjectZDatabaseMethod<TInput, TOutput> = (
  input: TInput,
) => Promise<TOutput> | TOutput
type FakeProjectZDatabaseInput = {
  createPilotSession?: FakeProjectZDatabaseMethod<
    CreatePilotSessionInput,
    Awaited<ReturnType<ProjectZDatabase['createPilotSession']>>
  >
  getMe?: FakeProjectZDatabaseMethod<
    GetMeInput,
    Awaited<ReturnType<ProjectZDatabase['getMe']>>
  >
  identifyLearner?: FakeProjectZDatabaseMethod<
    IdentifyLearnerInput,
    Awaited<ReturnType<ProjectZDatabase['identifyLearner']>>
  >
  recordMissionStart?: FakeProjectZDatabaseMethod<
    RecordMissionStartInput,
    Awaited<ReturnType<ProjectZDatabase['recordMissionStart']>>
  >
  recordSuspiciousEvent?: FakeProjectZDatabaseMethod<
    RecordSuspiciousEventInput,
    Awaited<ReturnType<ProjectZDatabase['recordSuspiciousEvent']>>
  >
  getProgress?: FakeProjectZDatabaseMethod<
    GetProgressInput,
    Awaited<ReturnType<ProjectZDatabase['getProgress']>>
  >
  getChapterReflection?: FakeProjectZDatabaseMethod<
    GetChapterReflectionInput,
    Awaited<ReturnType<ProjectZDatabase['getChapterReflection']>>
  >
  saveChapterReflection?: FakeProjectZDatabaseMethod<
    SaveChapterReflectionInput,
    Awaited<ReturnType<ProjectZDatabase['saveChapterReflection']>>
  >
  markUnlockSeen?: FakeProjectZDatabaseMethod<
    MarkUnlockSeenInput,
    Awaited<ReturnType<ProjectZDatabase['markUnlockSeen']>>
  >
  submitMissionAttempt?: FakeProjectZDatabaseMethod<
    SubmitMissionAttemptInput,
    Awaited<ReturnType<ProjectZDatabase['submitMissionAttempt']>>
  >
  getLeaderboardEntries?: () =>
    | Promise<Awaited<ReturnType<ProjectZDatabase['getLeaderboardEntries']>>>
    | Awaited<ReturnType<ProjectZDatabase['getLeaderboardEntries']>>
}

const createdAt = '2026-06-01T10:00:00.000Z'
const pilotSessionId = '11111111-1111-4111-8111-111111111111'
const generatedPilotSessionId = '22222222-2222-4222-8222-222222222222'
const previousPilotSessionCookieName =
  process.env.PROJECT_Z_PILOT_SESSION_COOKIE_NAME
const previousQaPassFlag = process.env.PROJECT_Z_QA_PASS
const orderedChapterIds = [...chapters]
  .sort((left, right) => left.order - right.order)
  .map((chapter) => chapter.id)
const firstChapterId = orderedChapterIds[0] ?? ''
const maliciousDerivedMissionBodyFields = {
  completedMissionIds: ['client-forged-completion'],
  completion: {
    chapterId: 'chapter-8',
    completedAt: '2099-01-01T00:00:00.000Z',
    completedChapters: chapters.length,
    learnerId: 'client-forged-learner',
  },
  isCorrect: true,
  score: 100,
  source: 'client-forged-source',
  trapDiscoveries: [{ id: 'weak-test', isNew: true }],
}

function createPostRequest(
  path: string,
  body: Record<string, unknown>,
): BackendRequest {
  return {
    body: JSON.stringify(body),
    headers: {
      cookie: `project_z_pilot_session_id=${pilotSessionId}`,
    },
    httpMethod: 'POST',
    path,
    rawUrl: `http://localhost${path}`,
  }
}

function createGetRequest(
  path: string,
  headers: BackendRequest['headers'] = {},
): BackendRequest {
  return {
    body: null,
    headers,
    httpMethod: 'GET',
    path,
    rawUrl: `http://localhost${path}`,
  }
}

function createPilotSession(id = pilotSessionId) {
  return {
    createdAt,
    expiresAt: null,
    id,
    lastSeenAt: createdAt,
    publicCode: null,
    revokedAt: null,
  }
}

function createLearner(input: Partial<Learner> = {}): Learner {
  return {
    fullName: 'Pilot Agent',
    id: 'pilot-agent-1',
    nickname: 'pilot-agent',
    ...input,
  }
}

function createOpenProgress(chapterId = 'chapter-1'): ChapterProgress[] {
  return chapters.map((chapter) => ({
    chapterId: chapter.id,
    completedMissionIds: [],
    status: chapter.id === chapterId ? 'open' : 'locked',
  }))
}

function getFirstScenarioMission(): {
  chapter: Chapter
  mission: ScenarioDecisionMission
} {
  for (const chapter of chapters) {
    for (const mission of chapter.missions) {
      if (mission.kind === 'scenario-decision') {
        return { chapter, mission }
      }
    }
  }

  throw new Error('Scenario mission fixture not found.')
}

function createMissionAttemptResult(input: {
  duplicate?: boolean
  persistedAnswer?: SubmitMissionAttemptInput['answer']
  persistedIsCorrect?: boolean
  persistedScore?: number
  progress?: ChapterProgress[]
  submission: SubmitMissionAttemptInput
}) {
  return {
    attempt: {
      answer: input.persistedAnswer ?? input.submission.answer,
      chapterId: input.submission.chapterId,
      clientAttemptId: input.submission.clientAttemptId,
      contentVersion: input.submission.contentVersion,
      createdAt,
      isCorrect: input.persistedIsCorrect ?? input.submission.isCorrect,
      missionId: input.submission.missionId,
      score: input.persistedScore ?? input.submission.score,
    },
    completedMissionIds: [],
    completion: null,
    duplicate: input.duplicate ?? false,
    progress:
      input.progress ??
      [
        {
          chapterId: input.submission.chapterId,
          completedMissionIds: [],
          status: 'open' as const,
        },
      ],
    trapDiscoveries: [],
  }
}

function createFakeDb(input: FakeProjectZDatabaseInput = {}) {
  const calls = {
    createPilotSession: [] as CreatePilotSessionInput[],
    getLeaderboardEntries: [] as null[],
    getChapterReflection: [] as GetChapterReflectionInput[],
    getMe: [] as GetMeInput[],
    getProgress: [] as GetProgressInput[],
    identifyLearner: [] as IdentifyLearnerInput[],
    markUnlockSeen: [] as MarkUnlockSeenInput[],
    recordMissionStart: [] as RecordMissionStartInput[],
    recordSuspiciousEvent: [] as RecordSuspiciousEventInput[],
    saveChapterReflection: [] as SaveChapterReflectionInput[],
    submitMissionAttempt: [] as SubmitMissionAttemptInput[],
  }
  const db: ProjectZDatabase = {
    createPilotSession: vi.fn(async (methodInput) => {
      calls.createPilotSession.push(methodInput)

      return input.createPilotSession
        ? await input.createPilotSession(methodInput)
        : { pilotSession: createPilotSession() }
    }),
    getChapterReflection: vi.fn(async (methodInput) => {
      calls.getChapterReflection.push(methodInput)

      return input.getChapterReflection
        ? await input.getChapterReflection(methodInput)
        : { reflection: null }
    }),
    getLeaderboardEntries: vi.fn(async () => {
      calls.getLeaderboardEntries.push(null)

      return input.getLeaderboardEntries
        ? await input.getLeaderboardEntries()
        : []
    }),
    getMe: vi.fn(async (methodInput) => {
      calls.getMe.push(methodInput)

      return input.getMe
        ? await input.getMe(methodInput)
        : { learner: null, pilotSession: createPilotSession() }
    }),
    getPendingAnnouncementDeliveries: vi.fn(async () => []),
    getProgress: vi.fn(async (methodInput) => {
      calls.getProgress.push(methodInput)

      return input.getProgress
        ? await input.getProgress(methodInput)
        : {
            completedMissionIds: [],
            encounteredTrapIds: [],
            learner: createLearner(),
            pendingUnlockChapterId: null,
            progress: createOpenProgress(),
          }
    }),
    identifyLearner: vi.fn(async (methodInput) => {
      calls.identifyLearner.push(methodInput)

      return input.identifyLearner
        ? await input.identifyLearner(methodInput)
        : { learner: createLearner() }
    }),
    recordMissionStart: vi.fn(async (methodInput) => {
      calls.recordMissionStart.push(methodInput)

      return input.recordMissionStart
        ? await input.recordMissionStart(methodInput)
        : { startedAt: createdAt }
    }),
    recordSuspiciousEvent: vi.fn(async (methodInput) => {
      calls.recordSuspiciousEvent.push(methodInput)

      return input.recordSuspiciousEvent
        ? await input.recordSuspiciousEvent(methodInput)
        : {
            event: {
              createdAt,
              learnerId: 'pilot-agent-1',
              metadata: methodInput.metadata,
              pilotSessionId,
              reason: methodInput.reason,
            },
          }
    }),
    markUnlockSeen: vi.fn(async (methodInput) => {
      calls.markUnlockSeen.push(methodInput)

      return input.markUnlockSeen
        ? await input.markUnlockSeen(methodInput)
        : {
            completedMissionIds: [],
            encounteredTrapIds: [],
            pendingUnlockChapterId: null,
            progress: createOpenProgress(),
          }
    }),
    saveChapterReflection: vi.fn(async (methodInput) => {
      calls.saveChapterReflection.push(methodInput)

      return input.saveChapterReflection
        ? await input.saveChapterReflection(methodInput)
        : {
            reflection: {
              chapterId: 'chapter-1',
              note: '',
              optionId: null,
              optionLabel: null,
              skipped: false,
              updatedAt: createdAt,
            },
          }
    }),
    submitMissionAttempt: vi.fn(async (methodInput) => {
      calls.submitMissionAttempt.push(methodInput)

      return input.submitMissionAttempt
        ? await input.submitMissionAttempt(methodInput)
        : createMissionAttemptResult({ submission: methodInput })
    }),
    updateAnnouncementDeliveryStatus: vi.fn(async () => []),
  }

  return { calls, db }
}

function expectNoClientOwnedMissionFields(input: SubmitMissionAttemptInput) {
  expect(Object.keys(input)).not.toEqual(
    expect.arrayContaining([
      'completedMissionIds',
      'completion',
      'source',
      'trapDiscoveries',
    ]),
  )
}

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}

afterEach(() => {
  restoreEnvironmentVariable(
    'PROJECT_Z_PILOT_SESSION_COOKIE_NAME',
    previousPilotSessionCookieName,
  )
  restoreEnvironmentVariable('PROJECT_Z_QA_PASS', previousQaPassFlag)
  resetProjectZApiRateLimiters()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Agent Trail API routing and validation', () => {
  it('returns a stable JSON 404 for unknown API routes', async () => {
    const { db } = createFakeDb()

    const response = await handleProjectZApiRequest(
      createGetRequest('/api/nope'),
      { db },
    )

    expect(response.statusCode).toBe(404)
    expect(response.headers).toMatchObject({
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    })
    expect(JSON.parse(response.body)).toEqual({
      error: 'Маршрут API не найден.',
    })
  })

  it('rejects invalid JSON before touching the database', async () => {
    const { calls, db } = createFakeDb()

    const response = await handleProjectZApiRequest(
      {
        body: '{',
        headers: {},
        httpMethod: 'POST',
        path: '/api/pilot-sessions',
        rawUrl: 'http://localhost/api/pilot-sessions',
      },
      { db },
    )

    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Нужен корректный JSON.',
    })
    expect(Object.values(calls).flat()).toHaveLength(0)
  })
})

describe('Agent Trail pilot session and learner API', () => {
  it('creates a secure httpOnly pilot cookie from forwarded HTTPS requests', async () => {
    const { calls, db } = createFakeDb({
      createPilotSession: (methodInput) => ({
        pilotSession: {
          ...createPilotSession(),
          publicCode: methodInput.publicCode,
        },
      }),
    })

    const response = await handleProjectZApiRequest(
      {
        body: JSON.stringify({ publicCode: 'pilot-alpha' }),
        headers: {
          'x-forwarded-proto': 'https',
        },
        httpMethod: 'POST',
        path: '/api/pilot-sessions',
        rawUrl: 'http://localhost/api/pilot-sessions',
      },
      { db },
    )
    const cookie = response.multiValueHeaders?.['Set-Cookie']?.[0]

    expect(response.statusCode).toBe(200)
    expect(calls.createPilotSession[0]).toMatchObject({
      publicCode: 'pilot-alpha',
    })
    expect(cookie).toContain(`project_z_pilot_session_id=${pilotSessionId}`)
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Max-Age=5184000')
    expect(cookie).toContain('Secure')
  })

  it('uses the default pilot cookie name when the env override is blank', async () => {
    process.env.PROJECT_Z_PILOT_SESSION_COOKIE_NAME = ''
    const { db } = createFakeDb()

    const response = await handleProjectZApiRequest(
      {
        body: JSON.stringify({}),
        headers: {},
        httpMethod: 'POST',
        path: '/api/pilot-sessions',
        rawUrl: 'http://localhost/api/pilot-sessions',
      },
      { db },
    )
    const cookie = response.multiValueHeaders?.['Set-Cookie']?.[0]
    const progressResponse = await handleProjectZApiRequest(
      createGetRequest('/api/progress', {
        cookie: `project_z_pilot_session_id=${pilotSessionId}`,
      }),
      { db },
    )

    expect(response.statusCode).toBe(200)
    expect(cookie).toContain(`project_z_pilot_session_id=${pilotSessionId}`)
    expect(cookie?.startsWith('=')).toBe(false)
    expect(progressResponse.statusCode).toBe(200)
  })

  it('ignores invalid pilot session cookie values on /api/me', async () => {
    const { calls, db } = createFakeDb()

    const response = await handleProjectZApiRequest(
      createGetRequest('/api/me', {
        cookie: 'project_z_pilot_session_id=not-a-uuid',
      }),
      { db },
    )

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      learner: null,
      pilotSession: null,
    })
    expect(calls.getMe).toHaveLength(0)
  })

  it('returns /api/me through the database abstraction for active sessions', async () => {
    const learner = createLearner()
    const { calls, db } = createFakeDb({
      getMe: () => ({
        learner,
        pilotSession: createPilotSession(),
      }),
    })

    const response = await handleProjectZApiRequest(
      createGetRequest('/api/me', {
        cookie: `project_z_pilot_session_id=${pilotSessionId}`,
      }),
      { db },
    )

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      learner,
      pilotSession: createPilotSession(),
    })
    expect(calls.getMe[0]).toEqual({ pilotSessionId })
  })

  it('expires invalid pilot cookies when /api/me sees a revoked session', async () => {
    const { db } = createFakeDb({
      getMe: () => {
        throw new ProjectZDatabaseError('invalid_pilot_session')
      },
    })

    const response = await handleProjectZApiRequest(
      createGetRequest('/api/me', {
        cookie: `project_z_pilot_session_id=${pilotSessionId}`,
      }),
      { db },
    )

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      learner: null,
      pilotSession: null,
    })
    expect(response.multiValueHeaders?.['Set-Cookie']?.[0]).toContain(
      'Max-Age=0',
    )
  })

  it('identifies a learner and creates a session when the cookie is absent', async () => {
    const learner = createLearner({
      fullName: 'Route Pilot',
      nickname: 'route-pilot',
    })
    const { calls, db } = createFakeDb({
      createPilotSession: () => ({
        pilotSession: createPilotSession(generatedPilotSessionId),
      }),
      identifyLearner: () => ({ learner }),
    })

    const response = await handleProjectZApiRequest(
      {
        body: JSON.stringify({
          fullName: 'Route Pilot',
          nickname: 'route-pilot',
        }),
        headers: {},
        httpMethod: 'POST',
        path: '/api/learners/identify',
        rawUrl: 'http://localhost/api/learners/identify',
      },
      { db },
    )

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({ learner })
    expect(calls.createPilotSession).toHaveLength(1)
    expect(calls.identifyLearner[0]).toMatchObject({
      fullName: 'Route Pilot',
      nickname: 'route-pilot',
      pilotSessionId: generatedPilotSessionId,
    })
    expect(calls.identifyLearner[0]?.chapterIds).toEqual(
      chapters.map((chapter) => chapter.id),
    )
    expect(calls.identifyLearner[0]?.firstChapterId).toBe(chapters[0]?.id)
    expect(response.multiValueHeaders?.['Set-Cookie']?.[0]).toContain(
      `project_z_pilot_session_id=${generatedPilotSessionId}`,
    )
  })

  it('rejects missing and blank identity fields before identifying the learner', async () => {
    const cases = [
      {
        body: { fullName: 'Route Pilot' },
        error: 'Нужно указать никнейм.',
      },
      {
        body: { fullName: 'Route Pilot', nickname: '   ' },
        error: 'Нужно указать никнейм.',
      },
      {
        body: { nickname: 'route-pilot' },
        error: 'Нужно указать имя и фамилию.',
      },
      {
        body: { fullName: '   ', nickname: 'route-pilot' },
        error: 'Нужно указать имя и фамилию.',
      },
    ]

    for (const testCase of cases) {
      const { calls, db } = createFakeDb()
      const response = await handleProjectZApiRequest(
        createPostRequest('/api/learners/identify', testCase.body),
        { db },
      )

      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body)).toEqual({ error: testCase.error })
      expect(calls.createPilotSession).toHaveLength(0)
      expect(calls.identifyLearner).toHaveLength(0)
    }
  })

  it('maps database full name validation failures to a 400 response', async () => {
    const { db } = createFakeDb({
      identifyLearner: () => {
        throw new ProjectZDatabaseError('full_name_required')
      },
    })

    const response = await handleProjectZApiRequest(
      createPostRequest('/api/learners/identify', {
        fullName: 'Route Pilot',
        nickname: 'route-pilot',
      }),
      { db },
    )

    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Нужно указать имя и фамилию.',
    })
  })

  it('rate limits new pilot sessions by forwarded client IP', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-02T10:00:00.000Z'))
    const { calls, db } = createFakeDb()
    const rateLimiter = createProjectZRateLimiter()
    const createRequest = () => ({
      body: JSON.stringify({ publicCode: 'pilot-alpha' }),
      headers: {
        'x-forwarded-for': '203.0.113.10, 127.0.0.1',
      },
      httpMethod: 'POST',
      path: '/api/pilot-sessions',
      rawUrl: 'http://localhost/api/pilot-sessions',
    })

    for (let index = 0; index < 10; index += 1) {
      const response = await handleProjectZApiRequest(createRequest(), {
        db,
        rateLimiter,
      })

      expect(response.statusCode).toBe(200)
    }

    const limitedResponse = await handleProjectZApiRequest(createRequest(), {
      db,
      rateLimiter,
    })

    expect(limitedResponse.statusCode).toBe(429)
    expect(JSON.parse(limitedResponse.body)).toEqual({
      error: 'Слишком много запросов. Попробуй позже.',
      retryAfterSeconds: 3600,
    })
    expect(calls.createPilotSession).toHaveLength(10)
  })

  it('resets the pilot session creation limit after an hour', async () => {
    vi.useFakeTimers()
    const startedAt = new Date('2026-06-02T10:00:00.000Z')
    vi.setSystemTime(startedAt)
    const { calls, db } = createFakeDb()
    const rateLimiter = createProjectZRateLimiter()
    const request = {
      body: JSON.stringify({}),
      headers: {
        'x-real-ip': '203.0.113.11',
      },
      httpMethod: 'POST',
      path: '/api/pilot-sessions',
      rawUrl: 'http://localhost/api/pilot-sessions',
    }

    for (let index = 0; index < 10; index += 1) {
      await handleProjectZApiRequest(request, { db, rateLimiter })
    }

    vi.setSystemTime(new Date(startedAt.getTime() + 60 * 60 * 1000))
    const response = await handleProjectZApiRequest(request, {
      db,
      rateLimiter,
    })

    expect(response.statusCode).toBe(200)
    expect(calls.createPilotSession).toHaveLength(11)
  })

  it('reads progress and discovered traps from the same progress payload', async () => {
    const progress = createOpenProgress()
    const { calls, db } = createFakeDb({
      getProgress: () => ({
        completedMissionIds: ['who-owns-the-diff'],
        encounteredTrapIds: ['confident-report'],
        learner: createLearner(),
        pendingUnlockChapterId: 'chapter-2',
        progress,
      }),
    })

    const progressResponse = await handleProjectZApiRequest(
      createGetRequest('/api/progress', {
        cookie: `project_z_pilot_session_id=${pilotSessionId}`,
      }),
      { db },
    )
    const trapsResponse = await handleProjectZApiRequest(
      createGetRequest('/api/traps/discovered', {
        cookie: `project_z_pilot_session_id=${pilotSessionId}`,
      }),
      { db },
    )

    expect(progressResponse.statusCode).toBe(200)
    expect(JSON.parse(progressResponse.body)).toMatchObject({
      completedMissionIds: ['who-owns-the-diff'],
      encounteredTrapIds: ['confident-report'],
      pendingUnlockChapterId: 'chapter-2',
      progress,
    })
    expect(trapsResponse.statusCode).toBe(200)
    expect(JSON.parse(trapsResponse.body)).toEqual({
      trapIds: ['confident-report'],
    })
    expect(calls.getProgress).toHaveLength(2)
    expect(calls.getProgress[0]).toMatchObject({ pilotSessionId })
    expect(calls.getProgress[1]).toMatchObject({ pilotSessionId })
  })

  it('maps unidentified progress reads to the existing API error', async () => {
    const { db } = createFakeDb({
      getProgress: () => {
        throw new ProjectZDatabaseError('learner_not_identified')
      },
    })

    const response = await handleProjectZApiRequest(
      createGetRequest('/api/progress', {
        cookie: `project_z_pilot_session_id=${pilotSessionId}`,
      }),
      { db },
    )

    expect(response.statusCode).toBe(409)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Нужно представиться перед продолжением.',
    })
  })

  it('rejects progress reads without a pilot session before touching the database', async () => {
    const { calls, db } = createFakeDb()

    const response = await handleProjectZApiRequest(
      createGetRequest('/api/progress'),
      { db },
    )

    expect(response.statusCode).toBe(401)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Нужно открыть пилотную сессию.',
    })
    expect(calls.getProgress).toHaveLength(0)
  })

  it('maps incomplete chapter reflection gates to the blocked API error', async () => {
    const { calls, db } = createFakeDb({
      getChapterReflection: () => {
        throw new ProjectZDatabaseError('chapter_not_completed')
      },
    })

    const response = await handleProjectZApiRequest(
      createGetRequest('/api/chapter-reflections/chapter-2', {
        cookie: `project_z_pilot_session_id=${pilotSessionId}`,
      }),
      { db },
    )

    expect(response.statusCode).toBe(409)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Глава ещё не завершена.',
    })
    expect(calls.getChapterReflection[0]).toMatchObject({
      chapterId: 'chapter-2',
      chapterIds: orderedChapterIds,
      pilotSessionId,
    })
  })

  it('maps blocked chapter reflection writes to the existing API error', async () => {
    const { calls, db } = createFakeDb({
      saveChapterReflection: () => {
        throw new ProjectZDatabaseError('chapter_not_completed')
      },
    })

    const response = await handleProjectZApiRequest(
      createPostRequest('/api/chapter-reflections/chapter-2', {
        note: 'direct browser note',
        optionId: 'tomorrow-review',
        optionLabel: 'Tomorrow review',
        skipped: false,
      }),
      { db },
    )

    expect(response.statusCode).toBe(409)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Глава ещё не завершена.',
    })
    expect(calls.saveChapterReflection[0]).toMatchObject({
      chapterId: 'chapter-2',
      chapterIds: orderedChapterIds,
      note: 'direct browser note',
      optionId: 'tomorrow-review',
      optionLabel: 'Tomorrow review',
      pilotSessionId,
      skipped: false,
    })
  })

  it('maps locked and unknown unlock-seen writes to the existing API error', async () => {
    const cases = ['chapter-2', 'chapter-99']

    for (const chapterId of cases) {
      const { calls, db } = createFakeDb({
        markUnlockSeen: () => {
          throw new ProjectZDatabaseError('chapter_not_open')
        },
      })

      const response = await handleProjectZApiRequest(
        createPostRequest(`/api/unlocks/${chapterId}/seen`, {}),
        { db },
      )

      expect(response.statusCode).toBe(409)
      expect(JSON.parse(response.body)).toEqual({
        error: 'Глава ещё закрыта.',
      })
      expect(calls.markUnlockSeen[0]).toEqual({
        chapterId,
        chapterIds: orderedChapterIds,
        firstChapterId,
        pilotSessionId,
      })
    }
  })
})

describe('Agent Trail mission attempt API', () => {
  it('records mission starts through the database without returning fraud details', async () => {
    const { chapter, mission } = getFirstScenarioMission()
    const { calls, db } = createFakeDb()

    const response = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/start`, {
        chapterId: chapter.id,
        contentVersion: staticContentVersion,
      }),
      { db },
    )

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({ startedAt: createdAt })
    expect(calls.recordMissionStart[0]).toEqual({
      chapterId: chapter.id,
      chapterIds: orderedChapterIds,
      contentVersion: staticContentVersion,
      firstChapterId,
      missionId: mission.id,
      pilotSessionId,
      requiredPreviousMissionIds: [],
    })
  })

  it('maps locked chapter mission starts to the existing API error', async () => {
    const chapter = chapters[1]
    const mission = chapter?.missions[0]

    if (!chapter || !mission) {
      throw new Error('Locked chapter mission fixture not found.')
    }

    const { calls, db } = createFakeDb({
      recordMissionStart: () => {
        throw new ProjectZDatabaseError('chapter_not_open')
      },
    })

    const response = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/start`, {
        chapterId: chapter.id,
        contentVersion: staticContentVersion,
      }),
      { db },
    )

    expect(response.statusCode).toBe(409)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Глава ещё закрыта.',
    })
    expect(calls.recordMissionStart[0]).toEqual({
      chapterId: chapter.id,
      chapterIds: orderedChapterIds,
      contentVersion: staticContentVersion,
      firstChapterId,
      missionId: mission.id,
      pilotSessionId,
      requiredPreviousMissionIds: [],
    })
  })

  it('maps skipped previous-mission starts to the existing API error', async () => {
    const chapter = chapters[0]
    const mission = chapter?.boss

    if (!chapter || !mission) {
      throw new Error('Boss mission fixture not found.')
    }

    const { calls, db } = createFakeDb({
      recordMissionStart: () => {
        throw new ProjectZDatabaseError('mission_not_open')
      },
    })

    const response = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/start`, {
        chapterId: chapter.id,
        contentVersion: staticContentVersion,
      }),
      { db },
    )

    expect(response.statusCode).toBe(409)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Сцена ещё закрыта.',
    })
    expect(calls.recordMissionStart[0]).toMatchObject({
      chapterId: chapter.id,
      missionId: mission.id,
      requiredPreviousMissionIds: chapter.missions.map((item) => item.id),
    })
  })

  it('rejects mission start requests for stale content before touching the database', async () => {
    const { chapter, mission } = getFirstScenarioMission()
    const { calls, db } = createFakeDb()

    const response = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/start`, {
        chapterId: chapter.id,
        contentVersion: 'stale-content',
      }),
      { db },
    )

    expect(response.statusCode).toBe(409)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Контент обновился. Перезагрузи маршрут и попробуй снова.',
    })
    expect(calls.recordMissionStart).toHaveLength(0)
  })

  it('evaluates the raw answer server-side and ignores client-sent derived fields', async () => {
    const { chapter, mission } = getFirstScenarioMission()
    const wrongOption = mission.options.find((option) => !option.isCorrect)

    if (!wrongOption) {
      throw new Error('Wrong option fixture not found.')
    }

    const { calls, db } = createFakeDb({
      submitMissionAttempt: (submission) =>
        createMissionAttemptResult({ submission }),
    })

    const response = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/attempts`, {
        answer: wrongOption.id,
        chapterId: chapter.id,
        clientAttemptId: 'attempt-client-trust',
        contentVersion: staticContentVersion,
        ...maliciousDerivedMissionBodyFields,
      }),
      { db },
    )
    const responseBody = JSON.parse(response.body) as {
      completion: unknown
      evaluation: { passed: boolean; score: number }
      trapDiscoveries: unknown[]
    }
    const submission = calls.submitMissionAttempt[0]

    if (!submission) {
      throw new Error('Mission attempt database call was not captured.')
    }

    expect(response.statusCode).toBe(200)
    expect(responseBody.evaluation).toMatchObject({
      passed: false,
      score: 0,
    })
    expect(responseBody.completion).toBeNull()
    expect(responseBody.trapDiscoveries).toEqual([])
    expectNoClientOwnedMissionFields(submission)
    expect(submission).toMatchObject({
      answer: wrongOption.id,
      encounteredTrapIds: ['weak-test'],
      isCorrect: false,
      score: 0,
    })
  })

  it('passes required previous missions to the transactional database boundary', async () => {
    const chapter = chapters[0]
    const boss = chapter.boss
    const { calls, db } = createFakeDb({
      submitMissionAttempt: (submission) =>
        createMissionAttemptResult({ submission }),
    })

    const response = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${boss.id}/attempts`, {
        answer: {},
        chapterId: chapter.id,
        clientAttemptId: 'attempt-boss-gate',
        contentVersion: staticContentVersion,
      }),
      { db },
    )

    expect(response.statusCode).toBe(200)
    expect(calls.submitMissionAttempt[0]).toMatchObject({
      isChapterBoss: true,
      requiredPreviousMissionIds: chapter.missions.map(
        (mission) => mission.id,
      ),
    })
  })

  it('maps mission gate failures from the database to a closed-scene API error', async () => {
    const { chapter, mission } = getFirstScenarioMission()
    const { db } = createFakeDb({
      submitMissionAttempt: () => {
        throw new ProjectZDatabaseError('mission_not_open')
      },
    })

    const response = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/attempts`, {
        answer: mission.options[0]?.id,
        chapterId: chapter.id,
        clientAttemptId: 'attempt-locked-scene',
        contentVersion: staticContentVersion,
      }),
      { db },
    )

    expect(response.statusCode).toBe(409)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Сцена ещё закрыта.',
    })
  })

  it('maps locked chapter mission attempts to the existing API error', async () => {
    const chapter = chapters[1]
    const mission = chapter?.missions[0]

    if (!chapter || !mission || mission.kind !== 'scenario-decision') {
      throw new Error('Locked scenario mission fixture not found.')
    }

    const { calls, db } = createFakeDb({
      submitMissionAttempt: () => {
        throw new ProjectZDatabaseError('chapter_not_open')
      },
    })

    const response = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/attempts`, {
        answer: mission.options[0]?.id,
        chapterId: chapter.id,
        clientAttemptId: 'attempt-locked-chapter',
        contentVersion: staticContentVersion,
      }),
      { db },
    )

    expect(response.statusCode).toBe(409)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Глава ещё закрыта.',
    })
    expect(calls.submitMissionAttempt[0]).toMatchObject({
      chapterId: chapter.id,
      chapterIds: orderedChapterIds,
      firstChapterId,
      missionId: mission.id,
      pilotSessionId,
      requiredPreviousMissionIds: [],
    })
  })

  it('rate limits mission attempts per session and mission for one-minute bursts', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-02T11:00:00.000Z'))
    const { chapter, mission } = getFirstScenarioMission()
    const optionId = mission.options[0]?.id
    const { calls, db } = createFakeDb({
      submitMissionAttempt: (submission) =>
        createMissionAttemptResult({ submission }),
    })
    const rateLimiter = createProjectZRateLimiter()

    for (let index = 0; index < 8; index += 1) {
      const response = await handleProjectZApiRequest(
        createPostRequest(`/api/missions/${mission.id}/attempts`, {
          answer: optionId,
          chapterId: chapter.id,
          clientAttemptId: `attempt-minute-${index}`,
          contentVersion: staticContentVersion,
        }),
        { db, rateLimiter },
      )

      expect(response.statusCode).toBe(200)
    }

    const limitedResponse = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/attempts`, {
        answer: optionId,
        chapterId: chapter.id,
        clientAttemptId: 'attempt-minute-limited',
        contentVersion: staticContentVersion,
      }),
      { db, rateLimiter },
    )

    expect(limitedResponse.statusCode).toBe(429)
    expect(JSON.parse(limitedResponse.body)).toEqual({
      error: 'Слишком много запросов. Попробуй позже.',
      retryAfterSeconds: 60,
    })
    expect(calls.submitMissionAttempt).toHaveLength(8)
  })

  it('resets the per-mission attempt limit after one minute', async () => {
    vi.useFakeTimers()
    const startedAt = new Date('2026-06-02T11:00:00.000Z')
    vi.setSystemTime(startedAt)
    const { chapter, mission } = getFirstScenarioMission()
    const { calls, db } = createFakeDb({
      submitMissionAttempt: (submission) =>
        createMissionAttemptResult({ submission }),
    })
    const rateLimiter = createProjectZRateLimiter()

    for (let index = 0; index < 8; index += 1) {
      await handleProjectZApiRequest(
        createPostRequest(`/api/missions/${mission.id}/attempts`, {
          answer: mission.options[0]?.id,
          chapterId: chapter.id,
          clientAttemptId: `attempt-reset-${index}`,
          contentVersion: staticContentVersion,
        }),
        { db, rateLimiter },
      )
    }

    vi.setSystemTime(new Date(startedAt.getTime() + 60 * 1000))
    const response = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/attempts`, {
        answer: mission.options[0]?.id,
        chapterId: chapter.id,
        clientAttemptId: 'attempt-reset-allowed',
        contentVersion: staticContentVersion,
      }),
      { db, rateLimiter },
    )

    expect(response.statusCode).toBe(200)
    expect(calls.submitMissionAttempt).toHaveLength(9)
  })

  it('rate limits mission attempts per session across ten-minute windows', async () => {
    vi.useFakeTimers()
    const startedAt = new Date('2026-06-02T11:00:00.000Z')
    vi.setSystemTime(startedAt)
    const { chapter, mission } = getFirstScenarioMission()
    const { calls, db } = createFakeDb({
      submitMissionAttempt: (submission) =>
        createMissionAttemptResult({ submission }),
    })
    const rateLimiter = createProjectZRateLimiter()

    for (let index = 0; index < 20; index += 1) {
      if (index === 8) {
        vi.setSystemTime(new Date(startedAt.getTime() + 60 * 1000))
      }

      if (index === 16) {
        vi.setSystemTime(new Date(startedAt.getTime() + 120 * 1000))
      }

      const response = await handleProjectZApiRequest(
        createPostRequest(`/api/missions/${mission.id}/attempts`, {
          answer: mission.options[0]?.id,
          chapterId: chapter.id,
          clientAttemptId: `attempt-session-${index}`,
          contentVersion: staticContentVersion,
        }),
        { db, rateLimiter },
      )

      expect(response.statusCode).toBe(200)
    }

    const limitedResponse = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/attempts`, {
        answer: mission.options[0]?.id,
        chapterId: chapter.id,
        clientAttemptId: 'attempt-session-limited',
        contentVersion: staticContentVersion,
      }),
      { db, rateLimiter },
    )

    expect(limitedResponse.statusCode).toBe(429)
    expect(JSON.parse(limitedResponse.body)).toEqual({
      error: 'Слишком много запросов. Попробуй позже.',
      retryAfterSeconds: 480,
    })
    expect(calls.submitMissionAttempt).toHaveLength(20)
  })

  it('allows accepted duplicate client attempt retries after the burst limit is reached', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-02T11:00:00.000Z'))
    const { chapter, mission } = getFirstScenarioMission()
    const { calls, db } = createFakeDb({
      submitMissionAttempt: (submission) =>
        createMissionAttemptResult({
          duplicate: submission.clientAttemptId === 'attempt-duplicate-repeat',
          submission,
        }),
    })
    const rateLimiter = createProjectZRateLimiter()

    for (let index = 0; index < 8; index += 1) {
      const clientAttemptId =
        index === 0 ? 'attempt-duplicate-repeat' : `attempt-fill-${index}`

      const response = await handleProjectZApiRequest(
        createPostRequest(`/api/missions/${mission.id}/attempts`, {
          answer: mission.options[0]?.id,
          chapterId: chapter.id,
          clientAttemptId,
          contentVersion: staticContentVersion,
        }),
        { db, rateLimiter },
      )

      expect(response.statusCode).toBe(200)
    }

    const retryResponse = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/attempts`, {
        answer: mission.options[0]?.id,
        chapterId: chapter.id,
        clientAttemptId: 'attempt-duplicate-repeat',
        contentVersion: staticContentVersion,
      }),
      { db, rateLimiter },
    )

    expect(retryResponse.statusCode).toBe(200)
    expect(calls.submitMissionAttempt).toHaveLength(9)
  })

  it('does not log raw payloads, cookies or private notes on backend errors', async () => {
    const { chapter, mission } = getFirstScenarioMission()
    const wrongOption = mission.options.find((option) => !option.isCorrect)
    const privateNote = 'private reflection note from the browser body'
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { db } = createFakeDb({
      submitMissionAttempt: () => {
        throw new Error('database transport failed')
      },
    })

    if (!wrongOption) {
      throw new Error('Wrong option fixture not found.')
    }

    const response = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/attempts`, {
        answer: wrongOption.id,
        chapterId: chapter.id,
        clientAttemptId: 'attempt-log-redaction',
        contentVersion: staticContentVersion,
        privateNote,
      }),
      { db },
    )
    const logged = JSON.stringify(consoleError.mock.calls)

    expect(response.statusCode).toBe(500)
    expect(consoleError).toHaveBeenCalledWith('Agent Trail API error', {
      message: 'database transport failed',
      method: 'POST',
      path: `/api/missions/${mission.id}/attempts`,
    })
    expect(logged).not.toContain(privateNote)
    expect(logged).not.toContain(wrongOption.id)
    expect(logged).not.toContain(pilotSessionId)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Сервер не смог обработать запрос.',
    })
  })

  it('returns the persisted duplicate attempt evaluation instead of the retried answer', async () => {
    const { chapter, mission } = getFirstScenarioMission()
    const correctOption = mission.options.find((option) => option.isCorrect)
    const wrongOption = mission.options.find((option) => !option.isCorrect)

    if (!correctOption || !wrongOption) {
      throw new Error('Scenario duplicate fixture options not found.')
    }

    const { calls, db } = createFakeDb({
      submitMissionAttempt: (submission) =>
        createMissionAttemptResult({
          duplicate: true,
          persistedAnswer: wrongOption.id,
          persistedIsCorrect: false,
          persistedScore: 0,
          submission,
        }),
    })

    const response = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/attempts`, {
        answer: correctOption.id,
        chapterId: chapter.id,
        clientAttemptId: 'attempt-duplicate-retry',
        contentVersion: staticContentVersion,
      }),
      { db },
    )
    const responseBody = JSON.parse(response.body) as {
      evaluation: { passed: boolean; score: number }
    }

    expect(response.statusCode).toBe(200)
    expect(calls.submitMissionAttempt[0]).toMatchObject({
      answer: correctOption.id,
      clientAttemptId: 'attempt-duplicate-retry',
      isCorrect: true,
      score: 100,
    })
    expect(responseBody.evaluation).toMatchObject({
      passed: false,
      score: 0,
    })
  })
})

describe('Agent Trail QA pass mission API', () => {
  it('returns the existing not-found response when the server QA flag is disabled', async () => {
    delete process.env.PROJECT_Z_QA_PASS
    const { chapter, mission } = getFirstScenarioMission()
    const { calls, db } = createFakeDb()

    const response = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/qa-pass`, {
        chapterId: chapter.id,
        clientAttemptId: 'attempt-qa-hidden',
        contentVersion: staticContentVersion,
      }),
      { db },
    )

    expect(response.statusCode).toBe(404)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Маршрут API не найден.',
    })
    expect(Object.values(calls).flat()).toHaveLength(0)
  })

  it('writes a server-generated passed attempt through the database boundary', async () => {
    process.env.PROJECT_Z_QA_PASS = '1'
    const { chapter, mission } = getFirstScenarioMission()
    const correctOption = mission.options.find((option) => option.isCorrect)
    const { calls, db } = createFakeDb({
      submitMissionAttempt: (submission) =>
        createMissionAttemptResult({ submission }),
    })

    if (!correctOption) {
      throw new Error('Correct option fixture not found.')
    }

    const response = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/qa-pass`, {
        answer: 'client-sent-answer-must-be-ignored',
        chapterId: chapter.id,
        clientAttemptId: 'attempt-qa-pass',
        contentVersion: staticContentVersion,
        ...maliciousDerivedMissionBodyFields,
      }),
      { db },
    )
    const responseBody = JSON.parse(response.body) as {
      completion: unknown
      evaluation: { passed: boolean; score: number }
      progress: unknown
      trapDiscoveries: unknown
    }
    const submission = calls.submitMissionAttempt[0]

    if (!submission) {
      throw new Error('QA pass database call was not captured.')
    }

    expect(response.statusCode).toBe(200)
    expect(Object.keys(responseBody).sort()).toEqual([
      'completion',
      'evaluation',
      'progress',
      'trapDiscoveries',
    ])
    expect(responseBody.evaluation).toMatchObject({
      passed: true,
      score: 100,
    })
    expectNoClientOwnedMissionFields(submission)
    expect(submission).toMatchObject({
      answer: correctOption.id,
      chapterId: chapter.id,
      clientAttemptId: 'attempt-qa-pass',
      contentVersion: staticContentVersion,
      isCorrect: true,
      missionId: mission.id,
      score: 100,
    })
  })

  it('rejects stale QA pass content before touching the database', async () => {
    process.env.PROJECT_Z_QA_PASS = '1'
    const { chapter, mission } = getFirstScenarioMission()
    const { calls, db } = createFakeDb()

    const response = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/qa-pass`, {
        chapterId: chapter.id,
        clientAttemptId: 'attempt-qa-stale',
        contentVersion: 'stale-content',
      }),
      { db },
    )

    expect(response.statusCode).toBe(409)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Контент обновился. Перезагрузи маршрут и попробуй снова.',
    })
    expect(Object.values(calls).flat()).toHaveLength(0)
  })

  it('keeps locked mission gates enforced by the database boundary', async () => {
    process.env.PROJECT_Z_QA_PASS = '1'
    const { chapter, mission } = getFirstScenarioMission()
    const { db } = createFakeDb({
      submitMissionAttempt: () => {
        throw new ProjectZDatabaseError('mission_not_open')
      },
    })

    const response = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/qa-pass`, {
        chapterId: chapter.id,
        clientAttemptId: 'attempt-qa-locked',
        contentVersion: staticContentVersion,
      }),
      { db },
    )

    expect(response.statusCode).toBe(409)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Сцена ещё закрыта.',
    })
  })

  it('returns the persisted duplicate attempt evaluation like the normal submit path', async () => {
    process.env.PROJECT_Z_QA_PASS = '1'
    const { chapter, mission } = getFirstScenarioMission()
    const correctOption = mission.options.find((option) => option.isCorrect)
    const wrongOption = mission.options.find((option) => !option.isCorrect)

    if (!correctOption || !wrongOption) {
      throw new Error('Scenario duplicate fixture options not found.')
    }

    const { calls, db } = createFakeDb({
      submitMissionAttempt: (submission) =>
        createMissionAttemptResult({
          duplicate: true,
          persistedAnswer: wrongOption.id,
          persistedIsCorrect: false,
          persistedScore: 0,
          submission,
        }),
    })

    const response = await handleProjectZApiRequest(
      createPostRequest(`/api/missions/${mission.id}/qa-pass`, {
        chapterId: chapter.id,
        clientAttemptId: 'attempt-qa-duplicate',
        contentVersion: staticContentVersion,
      }),
      { db },
    )
    const responseBody = JSON.parse(response.body) as {
      evaluation: { passed: boolean; score: number }
    }

    expect(response.statusCode).toBe(200)
    expect(calls.submitMissionAttempt[0]).toMatchObject({
      answer: correctOption.id,
      clientAttemptId: 'attempt-qa-duplicate',
      isCorrect: true,
      score: 100,
    })
    expect(responseBody.evaluation).toMatchObject({
      passed: false,
      score: 0,
    })
  })

  it('skips normal mission-attempt rate limits for QA pass bursts', async () => {
    process.env.PROJECT_Z_QA_PASS = '1'
    const { chapter, mission } = getFirstScenarioMission()
    const { calls, db } = createFakeDb({
      submitMissionAttempt: (submission) =>
        createMissionAttemptResult({ submission }),
    })
    const rateLimiter = createProjectZRateLimiter()

    for (let index = 0; index < 9; index += 1) {
      const response = await handleProjectZApiRequest(
        createPostRequest(`/api/missions/${mission.id}/qa-pass`, {
          chapterId: chapter.id,
          clientAttemptId: `attempt-qa-burst-${index}`,
          contentVersion: staticContentVersion,
        }),
        { db, rateLimiter },
      )

      expect(response.statusCode).toBe(200)
    }

    expect(calls.submitMissionAttempt).toHaveLength(9)
  })
})

describe('Agent Trail leaderboard API', () => {
  it('returns the shared backend aggregate without full names', async () => {
    const { calls, db } = createFakeDb({
      getLeaderboardEntries: () => [
        {
          closedChaptersCount: 2,
          lastBadgeDate: '2026-06-01T10:00:00.000Z',
          lastBadgeName: 'Чёткий бриф',
          learnerId: 'learner-1',
          nickname: 'pilot-agent',
        },
        {
          closedChaptersCount: 1,
          lastBadgeDate: '2026-06-01T09:00:00.000Z',
          lastBadgeName: 'Ответственный автор',
          learnerId: 'learner-2',
          nickname: 'second-agent',
        },
      ],
    })

    const response = await handleProjectZApiRequest(
      createGetRequest('/api/leaderboard'),
      { db },
    )
    const body = JSON.parse(response.body) as {
      entries: {
        closedChaptersCount: number
        fullName: string
        learnerId: string
        nickname: string
      }[]
    }

    expect(response.statusCode).toBe(200)
    expect(calls.getLeaderboardEntries).toHaveLength(1)
    expect(body.entries).toEqual([
      expect.objectContaining({
        closedChaptersCount: 2,
        fullName: '',
        lastBadgeName: 'Чёткий бриф',
        learnerId: 'learner-1',
        nickname: 'pilot-agent',
      }),
      expect.objectContaining({
        closedChaptersCount: 1,
        fullName: '',
        learnerId: 'learner-2',
        nickname: 'second-agent',
      }),
    ])
  })
})
