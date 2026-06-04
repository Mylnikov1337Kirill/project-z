import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chapters } from '../src/entities/chapter/model/chapterCatalog'
import { staticContentVersion } from '../src/shared/api/content/staticContentRepository'
import type {
  Chapter,
  ChapterProgress,
  Learner,
  ScenarioDecisionMission,
} from '../src/shared/types/domain'
import { handleProjectZNodeRequest } from './nodeHttp'
import type { BackendRequest } from './backend/http'
import type {
  AnnouncementDelivery,
  ProjectZDatabase,
  SubmitMissionAttemptInput,
} from './db/projectZDatabase'

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
type GetPendingAnnouncementDeliveriesInput = Parameters<
  ProjectZDatabase['getPendingAnnouncementDeliveries']
>[0]
type UpdateAnnouncementDeliveryStatusInput = Parameters<
  ProjectZDatabase['updateAnnouncementDeliveryStatus']
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
  submitMissionAttempt?: FakeProjectZDatabaseMethod<
    SubmitMissionAttemptInput,
    Awaited<ReturnType<ProjectZDatabase['submitMissionAttempt']>>
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
  getLeaderboardEntries?: () =>
    | Promise<Awaited<ReturnType<ProjectZDatabase['getLeaderboardEntries']>>>
    | Awaited<ReturnType<ProjectZDatabase['getLeaderboardEntries']>>
  getPendingAnnouncementDeliveries?: FakeProjectZDatabaseMethod<
    GetPendingAnnouncementDeliveriesInput,
    Awaited<ReturnType<ProjectZDatabase['getPendingAnnouncementDeliveries']>>
  >
  updateAnnouncementDeliveryStatus?: FakeProjectZDatabaseMethod<
    UpdateAnnouncementDeliveryStatusInput,
    Awaited<ReturnType<ProjectZDatabase['updateAnnouncementDeliveryStatus']>>
  >
}

const createdAt = '2026-06-01T10:00:00.000Z'
const pilotSessionId = '11111111-1111-4111-8111-111111111111'
const generatedPilotSessionId = '22222222-2222-4222-8222-222222222222'
const previousWorkerToken = process.env.PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN
const previousDeliveryMode = process.env.PROJECT_Z_PACHCA_DELIVERY_MODE
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

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}

function createRequest(input: {
  body?: Record<string, unknown> | null
  headers?: BackendRequest['headers']
  method?: string
  path: string
}): BackendRequest {
  return {
    body: input.body === undefined ? null : JSON.stringify(input.body),
    headers: input.headers ?? {},
    httpMethod: input.method ?? 'GET',
    path: input.path,
    rawUrl: `http://localhost${input.path}`,
  }
}

function createSessionRequest(input: {
  body?: Record<string, unknown> | null
  headers?: BackendRequest['headers']
  method?: string
  path: string
}): BackendRequest {
  return createRequest({
    ...input,
    headers: {
      cookie: `project_z_pilot_session_id=${pilotSessionId}`,
      ...(input.headers ?? {}),
    },
  })
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
  submission: SubmitMissionAttemptInput
  progress?: ChapterProgress[]
}) {
  return {
    attempt: {
      answer: input.submission.answer,
      chapterId: input.submission.chapterId,
      clientAttemptId: input.submission.clientAttemptId,
      contentVersion: input.submission.contentVersion,
      createdAt,
      isCorrect: input.submission.isCorrect,
      missionId: input.submission.missionId,
      score: input.submission.score,
    },
    completedMissionIds: [],
    completion: null,
    duplicate: false,
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

function createPendingDelivery(): AnnouncementDelivery {
  return {
    attemptsCount: 0,
    badgeAward: {
      awardedAt: createdAt,
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
  }
}

function createFakeDb(input: FakeProjectZDatabaseInput = {}) {
  const calls = {
    createPilotSession: [] as CreatePilotSessionInput[],
    getChapterReflection: [] as GetChapterReflectionInput[],
    getLeaderboardEntries: [] as null[],
    getMe: [] as GetMeInput[],
    getPendingAnnouncementDeliveries:
      [] as GetPendingAnnouncementDeliveriesInput[],
    getProgress: [] as GetProgressInput[],
    identifyLearner: [] as IdentifyLearnerInput[],
    markUnlockSeen: [] as MarkUnlockSeenInput[],
    recordMissionStart: [] as RecordMissionStartInput[],
    recordSuspiciousEvent: [] as RecordSuspiciousEventInput[],
    saveChapterReflection: [] as SaveChapterReflectionInput[],
    submitMissionAttempt: [] as SubmitMissionAttemptInput[],
    updateAnnouncementDeliveryStatus:
      [] as UpdateAnnouncementDeliveryStatusInput[],
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
    getPendingAnnouncementDeliveries: vi.fn(async (methodInput) => {
      calls.getPendingAnnouncementDeliveries.push(methodInput)

      return input.getPendingAnnouncementDeliveries
        ? await input.getPendingAnnouncementDeliveries(methodInput)
        : []
    }),
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
              chapterId: methodInput.chapterId,
              note: methodInput.note,
              optionId: methodInput.optionId,
              optionLabel: methodInput.optionLabel,
              skipped: methodInput.skipped,
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
    updateAnnouncementDeliveryStatus: vi.fn(async (methodInput) => {
      calls.updateAnnouncementDeliveryStatus.push(methodInput)

      return input.updateAnnouncementDeliveryStatus
        ? await input.updateAnnouncementDeliveryStatus(methodInput)
        : []
    }),
  }

  return { calls, db }
}

function expectNoClientDerivedMissionFields(input: SubmitMissionAttemptInput) {
  expect(Object.keys(input)).not.toEqual(
    expect.arrayContaining(Object.keys(maliciousDerivedMissionBodyFields)),
  )
}

beforeEach(() => {
  process.env.PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN = 'worker-token'
  delete process.env.PROJECT_Z_PACHCA_DELIVERY_MODE
})

afterEach(() => {
  restoreEnvironmentVariable(
    'PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN',
    previousWorkerToken,
  )
  restoreEnvironmentVariable(
    'PROJECT_Z_PACHCA_DELIVERY_MODE',
    previousDeliveryMode,
  )
})

describe('Node API parity for learner sessions', () => {
  it('creates pilot sessions with the same secure httpOnly cookie contract', async () => {
    const { calls, db } = createFakeDb({
      createPilotSession: () => ({
        pilotSession: {
          ...createPilotSession(),
          publicCode: 'pilot-alpha',
        },
      }),
    })

    const response = await handleProjectZNodeRequest(
      createRequest({
        body: { publicCode: 'pilot-alpha' },
        headers: {
          'x-forwarded-proto': 'https',
        },
        method: 'POST',
        path: '/api/pilot-sessions',
      }),
      { db },
    )
    const cookie = response.multiValueHeaders?.['Set-Cookie']?.[0]

    expect(response.statusCode).toBe(200)
    expect(response.headers).toMatchObject({
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    })
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

  it('returns /api/me through the Node route with the active pilot session', async () => {
    const learner = createLearner()
    const { calls, db } = createFakeDb({
      getMe: () => ({
        learner,
        pilotSession: createPilotSession(),
      }),
    })

    const response = await handleProjectZNodeRequest(
      createSessionRequest({ path: '/api/me' }),
      { db },
    )

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      learner,
      pilotSession: createPilotSession(),
    })
    expect(calls.getMe[0]).toMatchObject({
      pilotSessionId,
    })
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

    const response = await handleProjectZNodeRequest(
      createRequest({
        body: {
          fullName: 'Route Pilot',
          nickname: 'route-pilot',
        },
        method: 'POST',
        path: '/api/learners/identify',
      }),
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
    expect(response.multiValueHeaders?.['Set-Cookie']?.[0]).toContain(
      `project_z_pilot_session_id=${generatedPilotSessionId}`,
    )
  })
})

describe('Node API parity for progress reads and learner-owned writes', () => {
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

    const progressResponse = await handleProjectZNodeRequest(
      createSessionRequest({ path: '/api/progress' }),
      { db },
    )
    const trapsResponse = await handleProjectZNodeRequest(
      createSessionRequest({ path: '/api/traps/discovered' }),
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

  it('saves and reads chapter reflections through Node /api routes', async () => {
    const savedReflection = {
      chapterId: 'chapter-1',
      note: 'Use the review checklist.',
      optionId: 'review',
      optionLabel: 'In review',
      skipped: false,
      updatedAt: createdAt,
    }
    const { calls, db } = createFakeDb({
      getChapterReflection: () => ({ reflection: null }),
      saveChapterReflection: () => ({ reflection: savedReflection }),
    })

    const readResponse = await handleProjectZNodeRequest(
      createSessionRequest({ path: '/api/chapter-reflections/chapter-1' }),
      { db },
    )
    const saveResponse = await handleProjectZNodeRequest(
      createSessionRequest({
        body: {
          note: savedReflection.note,
          optionId: savedReflection.optionId,
          optionLabel: savedReflection.optionLabel,
          skipped: false,
        },
        method: 'POST',
        path: '/api/chapter-reflections/chapter-1',
      }),
      { db },
    )

    expect(readResponse.statusCode).toBe(200)
    expect(JSON.parse(readResponse.body)).toEqual({ reflection: null })
    expect(saveResponse.statusCode).toBe(200)
    expect(JSON.parse(saveResponse.body)).toEqual({
      reflection: savedReflection,
    })
    expect(calls.getChapterReflection[0]).toMatchObject({
      chapterId: 'chapter-1',
      pilotSessionId,
    })
    expect(calls.saveChapterReflection[0]).toMatchObject({
      chapterId: 'chapter-1',
      note: savedReflection.note,
      optionId: savedReflection.optionId,
      optionLabel: savedReflection.optionLabel,
      pilotSessionId,
      skipped: false,
    })
  })

  it('marks unlock cues seen at acceptance time and returns the updated progress', async () => {
    const progress = createOpenProgress('chapter-2')
    const { calls, db } = createFakeDb({
      markUnlockSeen: () => ({
        completedMissionIds: [],
        encounteredTrapIds: [],
        pendingUnlockChapterId: null,
        progress,
      }),
    })

    const response = await handleProjectZNodeRequest(
      createSessionRequest({
        body: {},
        method: 'POST',
        path: '/api/unlocks/chapter-2/seen',
      }),
      { db },
    )

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({ progress })
    expect(calls.markUnlockSeen[0]).toMatchObject({
      chapterId: 'chapter-2',
      pilotSessionId,
    })
  })
})

describe('Node API parity for mission submit and leaderboard', () => {
  it('records mission starts through the Node route without exposing fraud metadata', async () => {
    const { chapter, mission } = getFirstScenarioMission()
    const { calls, db } = createFakeDb()

    const response = await handleProjectZNodeRequest(
      createSessionRequest({
        body: {
          chapterId: chapter.id,
          contentVersion: staticContentVersion,
        },
        method: 'POST',
        path: `/api/missions/${mission.id}/start`,
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

  it('ignores client-sent mission scoring, completion, source and trap fields', async () => {
    const { chapter, mission } = getFirstScenarioMission()
    const wrongOption = mission.options.find((option) => !option.isCorrect)

    if (!wrongOption) {
      throw new Error('Wrong option fixture not found.')
    }

    const { calls, db } = createFakeDb({
      submitMissionAttempt: (submission) =>
        createMissionAttemptResult({ submission }),
    })

    const response = await handleProjectZNodeRequest(
      createSessionRequest({
        body: {
          answer: wrongOption.id,
          chapterId: chapter.id,
          clientAttemptId: 'attempt-node-client-trust',
          contentVersion: staticContentVersion,
          ...maliciousDerivedMissionBodyFields,
        },
        method: 'POST',
        path: `/api/missions/${mission.id}/attempts`,
      }),
      { db },
    )
    const body = JSON.parse(response.body) as {
      completion: unknown
      evaluation: { passed: boolean; score: number }
      trapDiscoveries: unknown[]
    }
    const submission = calls.submitMissionAttempt[0]

    if (!submission) {
      throw new Error('Mission attempt database call was not captured.')
    }

    expect(response.statusCode).toBe(200)
    expectNoClientDerivedMissionFields(submission)
    expect(submission).toMatchObject({
      answer: wrongOption.id,
      encounteredTrapIds: ['weak-test'],
      isCorrect: false,
      score: 0,
    })
    expect(body).toMatchObject({
      completion: null,
      evaluation: {
        passed: false,
        score: 0,
      },
      trapDiscoveries: [],
    })
  })

  it('submits missions through Node and returns persisted duplicate evaluations', async () => {
    const { chapter, mission } = getFirstScenarioMission()
    const correctOption = mission.options.find((option) => option.isCorrect)
    const wrongOption = mission.options.find((option) => !option.isCorrect)

    if (!correctOption || !wrongOption) {
      throw new Error('Scenario duplicate fixture options not found.')
    }

    const { calls, db } = createFakeDb({
      submitMissionAttempt: (submission) => ({
        ...createMissionAttemptResult({
          submission: {
            ...submission,
            answer: wrongOption.id,
            isCorrect: false,
            score: 0,
          },
        }),
        duplicate: true,
      }),
    })

    const response = await handleProjectZNodeRequest(
      createSessionRequest({
        body: {
          answer: correctOption.id,
          chapterId: chapter.id,
          clientAttemptId: 'attempt-duplicate-retry',
          contentVersion: staticContentVersion,
          isCorrect: false,
          score: 0,
        },
        method: 'POST',
        path: `/api/missions/${mission.id}/attempts`,
      }),
      { db },
    )
    const body = JSON.parse(response.body) as {
      evaluation: { passed: boolean; score: number }
    }

    expect(response.statusCode).toBe(200)
    expect(calls.submitMissionAttempt[0]).toMatchObject({
      answer: correctOption.id,
      clientAttemptId: 'attempt-duplicate-retry',
      isCorrect: true,
      score: 100,
    })
    expect(body.evaluation).toMatchObject({
      passed: false,
      score: 0,
    })
  })

  it('returns leaderboard aggregates without full names', async () => {
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

    const response = await handleProjectZNodeRequest(
      createRequest({ path: '/api/leaderboard' }),
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

describe('Node API parity for the announcement worker', () => {
  it('requires the worker token before touching the database', async () => {
    const { calls, db } = createFakeDb()

    const response = await handleProjectZNodeRequest(
      createRequest({
        headers: {
          authorization: 'Bearer wrong-token',
        },
        method: 'POST',
        path: '/api/admin/announcement-worker',
      }),
      { db },
    )

    expect(response.statusCode).toBe(401)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Announcement worker token is invalid.',
    })
    expect(calls.getPendingAnnouncementDeliveries).toHaveLength(0)
    expect(calls.updateAnnouncementDeliveryStatus).toHaveLength(0)
  })

  it('records pending Pachca announcements as dry-run status transitions', async () => {
    const pendingDelivery = createPendingDelivery()
    const { calls, db } = createFakeDb({
      getPendingAnnouncementDeliveries: () => [pendingDelivery],
      updateAnnouncementDeliveryStatus: (statusUpdate) => [
        {
          ...pendingDelivery,
          attemptsCount: statusUpdate.attemptsCount,
          status: statusUpdate.status,
        },
      ],
    })

    const response = await handleProjectZNodeRequest(
      createRequest({
        headers: {
          authorization: 'Bearer worker-token',
        },
        method: 'POST',
        path: '/api/admin/announcement-worker',
      }),
      { db },
    )
    const body = JSON.parse(response.body) as {
      deliveries: { status: string }[]
      mode: string
      processedCount: number
    }

    expect(response.statusCode).toBe(200)
    expect(body.mode).toBe('dry-run')
    expect(body.processedCount).toBe(1)
    expect(body.deliveries[0]).toMatchObject({ status: 'dry_run' })
    expect(calls.getPendingAnnouncementDeliveries[0]).toMatchObject({
      limit: 10,
      maxAttempts: 3,
    })
    expect(calls.updateAnnouncementDeliveryStatus[0]).toMatchObject({
      attemptsCount: 1,
      deliveryId: pendingDelivery.id,
      lastError: null,
      maxAttempts: 3,
      status: 'dry_run',
    })
  })
})
