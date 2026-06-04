import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleAnnouncementWorkerRequest } from './announcementWorker'
import type { BackendRequest } from './http'
import type {
  AnnouncementDelivery,
  ProjectZDatabase,
} from '../db/projectZDatabase'

type GetPendingAnnouncementDeliveriesInput = Parameters<
  ProjectZDatabase['getPendingAnnouncementDeliveries']
>[0]
type UpdateAnnouncementDeliveryStatusInput = Parameters<
  ProjectZDatabase['updateAnnouncementDeliveryStatus']
>[0]
type FakeProjectZDatabaseInput = {
  getPendingAnnouncementDeliveries?: (
    input: GetPendingAnnouncementDeliveriesInput,
  ) => AnnouncementDelivery[] | Promise<AnnouncementDelivery[]>
  updateAnnouncementDeliveryStatus?: (
    input: UpdateAnnouncementDeliveryStatusInput,
  ) => AnnouncementDelivery[] | Promise<AnnouncementDelivery[]>
}

const previousWorkerToken = process.env.PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN
const previousDeliveryMode = process.env.PROJECT_Z_PACHCA_DELIVERY_MODE
const previousBatchLimit = process.env.PROJECT_Z_ANNOUNCEMENT_BATCH_LIMIT
const previousMaxAttempts = process.env.PROJECT_Z_ANNOUNCEMENT_MAX_ATTEMPTS
const createdAt = '2026-06-01T10:00:00.000Z'

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}

function createWorkerRequest(token = 'worker-token'): BackendRequest {
  return {
    body: null,
    headers: {
      authorization: `Bearer ${token}`,
    },
    httpMethod: 'POST',
    path: '/api/admin/announcement-worker',
    rawUrl: 'http://localhost/api/admin/announcement-worker',
  }
}

function createPendingDelivery(
  input: Partial<AnnouncementDelivery> = {},
): AnnouncementDelivery {
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
    ...input,
  }
}

function createFakeDb(input: FakeProjectZDatabaseInput = {}) {
  const calls = {
    getPendingAnnouncementDeliveries:
      [] as GetPendingAnnouncementDeliveriesInput[],
    updateAnnouncementDeliveryStatus:
      [] as UpdateAnnouncementDeliveryStatusInput[],
  }
  const db = {
    createPilotSession: vi.fn(),
    getChapterReflection: vi.fn(),
    getLeaderboardEntries: vi.fn(),
    getMe: vi.fn(),
    getPendingAnnouncementDeliveries: vi.fn(async (methodInput) => {
      calls.getPendingAnnouncementDeliveries.push(methodInput)

      return input.getPendingAnnouncementDeliveries
        ? await input.getPendingAnnouncementDeliveries(methodInput)
        : []
    }),
    getProgress: vi.fn(),
    identifyLearner: vi.fn(),
    markUnlockSeen: vi.fn(),
    recordMissionStart: vi.fn(),
    recordSuspiciousEvent: vi.fn(),
    saveChapterReflection: vi.fn(),
    submitMissionAttempt: vi.fn(),
    updateAnnouncementDeliveryStatus: vi.fn(async (methodInput) => {
      calls.updateAnnouncementDeliveryStatus.push(methodInput)

      return input.updateAnnouncementDeliveryStatus
        ? await input.updateAnnouncementDeliveryStatus(methodInput)
        : []
    }),
  } satisfies ProjectZDatabase

  return { calls, db }
}

beforeEach(() => {
  process.env.PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN = 'worker-token'
  delete process.env.PROJECT_Z_PACHCA_DELIVERY_MODE
  delete process.env.PROJECT_Z_ANNOUNCEMENT_BATCH_LIMIT
  delete process.env.PROJECT_Z_ANNOUNCEMENT_MAX_ATTEMPTS
})

afterEach(() => {
  vi.restoreAllMocks()
  restoreEnvironmentVariable(
    'PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN',
    previousWorkerToken,
  )
  restoreEnvironmentVariable(
    'PROJECT_Z_PACHCA_DELIVERY_MODE',
    previousDeliveryMode,
  )
  restoreEnvironmentVariable(
    'PROJECT_Z_ANNOUNCEMENT_BATCH_LIMIT',
    previousBatchLimit,
  )
  restoreEnvironmentVariable(
    'PROJECT_Z_ANNOUNCEMENT_MAX_ATTEMPTS',
    previousMaxAttempts,
  )
})

describe('announcement worker runtime handler', () => {
  it('records Pachca badge announcements as backend dry-runs', async () => {
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

    const response = await handleAnnouncementWorkerRequest(
      createWorkerRequest(),
      { db },
    )
    const body = JSON.parse(response.body) as {
      deliveries: { preview?: string; status: string }[]
      mode: string
      processedCount: number
      skippedCount: number
    }

    expect(response.statusCode).toBe(200)
    expect(body.mode).toBe('dry-run')
    expect(body.processedCount).toBe(1)
    expect(body.skippedCount).toBe(0)
    expect(body.deliveries[0]).toMatchObject({
      status: 'dry_run',
    })
    expect(body.deliveries[0]?.preview).toContain('@pilot-agent')
    expect(calls.getPendingAnnouncementDeliveries).toEqual([
      {
        limit: 10,
        maxAttempts: 3,
      },
    ])
    expect(calls.updateAnnouncementDeliveryStatus).toEqual([
      {
        attemptsCount: 1,
        deliveryId: pendingDelivery.id,
        lastError: null,
        maxAttempts: 3,
        status: 'dry_run',
      },
    ])
  })

  it('passes bounded batch settings to the database selection/update guards', async () => {
    const pendingDelivery = createPendingDelivery({
      attemptsCount: 4,
    })
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

    process.env.PROJECT_Z_ANNOUNCEMENT_BATCH_LIMIT = '250'
    process.env.PROJECT_Z_ANNOUNCEMENT_MAX_ATTEMPTS = '5'

    const response = await handleAnnouncementWorkerRequest(
      createWorkerRequest(),
      { db },
    )

    expect(response.statusCode).toBe(200)
    expect(calls.getPendingAnnouncementDeliveries).toEqual([
      {
        limit: 25,
        maxAttempts: 5,
      },
    ])
    expect(calls.updateAnnouncementDeliveryStatus).toEqual([
      expect.objectContaining({
        attemptsCount: 5,
        maxAttempts: 5,
      }),
    ])
  })

  it('marks unsupported announcement channels as failed', async () => {
    const pendingDelivery = createPendingDelivery({
      channel: 'email',
      id: 'delivery-email',
    })
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

    const response = await handleAnnouncementWorkerRequest(
      createWorkerRequest(),
      { db },
    )
    const body = JSON.parse(response.body) as {
      deliveries: { error?: string; status: string }[]
      failedCount: number
    }

    expect(response.statusCode).toBe(200)
    expect(body.failedCount).toBe(1)
    expect(body.deliveries[0]).toMatchObject({
      error: 'unsupported_channel',
      status: 'failed',
    })
    expect(calls.updateAnnouncementDeliveryStatus).toEqual([
      expect.objectContaining({
        attemptsCount: 1,
        deliveryId: 'delivery-email',
        lastError: 'Unsupported announcement channel: email',
        status: 'failed',
      }),
    ])
  })

  it('marks incomplete announcement payloads as failed', async () => {
    const pendingDelivery = createPendingDelivery({
      badgeAward: null,
      id: 'delivery-incomplete',
    })
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

    const response = await handleAnnouncementWorkerRequest(
      createWorkerRequest(),
      { db },
    )
    const body = JSON.parse(response.body) as {
      deliveries: { error?: string; status: string }[]
      failedCount: number
    }

    expect(response.statusCode).toBe(200)
    expect(body.failedCount).toBe(1)
    expect(body.deliveries[0]).toMatchObject({
      error: 'Announcement delivery payload is incomplete.',
      status: 'failed',
    })
    expect(calls.updateAnnouncementDeliveryStatus).toEqual([
      expect.objectContaining({
        attemptsCount: 1,
        deliveryId: 'delivery-incomplete',
        lastError: 'Announcement delivery payload is incomplete.',
        status: 'failed',
      }),
    ])
  })

  it('skips dry-run rows that were already changed by another worker', async () => {
    const pendingDelivery = createPendingDelivery()
    const { db } = createFakeDb({
      getPendingAnnouncementDeliveries: () => [pendingDelivery],
      updateAnnouncementDeliveryStatus: () => [],
    })

    const response = await handleAnnouncementWorkerRequest(
      createWorkerRequest(),
      { db },
    )
    const body = JSON.parse(response.body) as {
      deliveries: { preview?: string; status: string }[]
      processedCount: number
      skippedCount: number
    }

    expect(response.statusCode).toBe(200)
    expect(body.processedCount).toBe(0)
    expect(body.skippedCount).toBe(1)
    expect(body.deliveries[0]).toEqual({
      id: pendingDelivery.id,
      idempotencyKey: pendingDelivery.idempotencyKey,
      status: 'skipped',
    })
  })

  it('requires a server-side worker token before touching the database', async () => {
    const { calls, db } = createFakeDb()

    const response = await handleAnnouncementWorkerRequest(
      createWorkerRequest('wrong-token'),
      { db },
    )

    expect(response.statusCode).toBe(401)
    expect(calls.getPendingAnnouncementDeliveries).toHaveLength(0)
    expect(calls.updateAnnouncementDeliveryStatus).toHaveLength(0)
  })

  it('keeps live Pachca delivery disabled before touching the database', async () => {
    const { calls, db } = createFakeDb()
    process.env.PROJECT_Z_PACHCA_DELIVERY_MODE = 'live'

    const response = await handleAnnouncementWorkerRequest(
      createWorkerRequest(),
      { db },
    )

    expect(response.statusCode).toBe(409)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Live Pachca delivery is not enabled yet. Use dry-run mode first.',
    })
    expect(calls.getPendingAnnouncementDeliveries).toHaveLength(0)
    expect(calls.updateAnnouncementDeliveryStatus).toHaveLength(0)
  })
})
