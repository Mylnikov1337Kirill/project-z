import { chapters } from '../../src/entities/chapter/model/chapterCatalog'
import { BackendConfigurationError } from './configuration'
import {
  type BackendRequest,
  type BackendResponse,
  RequestError,
  getHeader,
  jsonResponse,
} from './http'
import {
  type AnnouncementDelivery,
  type AnnouncementStatus,
  ProjectZDatabaseError,
  type ProjectZDatabase,
} from '../db/projectZDatabase'
import { createRuntimeProjectZDatabaseFromEnv } from '../db/runtimeProjectZDatabase'

type DeliveryMode = 'dry-run'

type AnnouncementWorkerOptions = {
  db?: ProjectZDatabase
}

const defaultBatchLimit = 10
const defaultMaxAttempts = 3
const maxBatchLimit = 25

function getRequiredEnvironmentVariable(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new BackendConfigurationError('Announcement worker is not configured.')
  }

  return value
}

function getBoundedIntegerFromEnv(input: {
  defaultValue: number
  maxValue: number
  minValue: number
  name: string
}) {
  const rawValue = process.env[input.name]
  const parsedValue = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN

  if (!Number.isFinite(parsedValue)) {
    return input.defaultValue
  }

  return Math.min(Math.max(parsedValue, input.minValue), input.maxValue)
}

function requireWorkerAuthorization(request: BackendRequest) {
  const expectedToken = getRequiredEnvironmentVariable(
    'PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN',
  )
  const authorization = getHeader(request.headers, 'authorization') ?? ''
  const actualToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1]

  if (actualToken !== expectedToken) {
    throw new RequestError(401, 'Announcement worker token is invalid.')
  }
}

function getDeliveryMode(): DeliveryMode {
  const mode = process.env.PROJECT_Z_PACHCA_DELIVERY_MODE ?? 'dry-run'

  if (mode !== 'dry-run') {
    throw new RequestError(
      409,
      'Live Pachca delivery is not enabled yet. Use dry-run mode first.',
    )
  }

  return mode
}

function getChapterTitle(chapterId: string) {
  return chapters.find((chapter) => chapter.id === chapterId)?.title ?? chapterId
}

function createDryRunPreview(delivery: AnnouncementDelivery) {
  const badgeAward = delivery.badgeAward
  const learner = badgeAward?.learner

  if (!badgeAward || !learner) {
    throw new RequestError(422, 'Announcement delivery payload is incomplete.')
  }

  return (
    `@${learner.nickname} закрыл главу «${getChapterTitle(
      badgeAward.chapterId,
    )}» в Project Z и получил награду «${badgeAward.badgeNameSnapshot}». ` +
    `Прогресс маршрута: ${badgeAward.completedChapters}/${chapters.length}.`
  )
}

async function getPendingDeliveries(input: {
  db: ProjectZDatabase
  limit: number
  maxAttempts: number
}) {
  return input.db.getPendingAnnouncementDeliveries({
    limit: input.limit,
    maxAttempts: input.maxAttempts,
  })
}

async function updateDeliveryStatus(input: {
  attemptsCount: number
  db: ProjectZDatabase
  delivery: AnnouncementDelivery
  lastError: string | null
  maxAttempts: number
  status: AnnouncementStatus
}) {
  return input.db.updateAnnouncementDeliveryStatus({
    attemptsCount: input.attemptsCount,
    deliveryId: input.delivery.id,
    lastError: input.lastError,
    maxAttempts: input.maxAttempts,
    status: input.status,
  })
}

async function markDryRun(input: {
  db: ProjectZDatabase
  delivery: AnnouncementDelivery
  maxAttempts: number
}) {
  return updateDeliveryStatus({
    attemptsCount: input.delivery.attemptsCount + 1,
    db: input.db,
    delivery: input.delivery,
    lastError: null,
    maxAttempts: input.maxAttempts,
    status: 'dry_run',
  })
}

async function markFailed(input: {
  db: ProjectZDatabase
  delivery: AnnouncementDelivery
  error: string
  maxAttempts: number
}) {
  return updateDeliveryStatus({
    attemptsCount: input.delivery.attemptsCount + 1,
    db: input.db,
    delivery: input.delivery,
    lastError: input.error.slice(0, 500),
    maxAttempts: input.maxAttempts,
    status: 'failed',
  })
}

async function processDelivery(input: {
  db: ProjectZDatabase
  delivery: AnnouncementDelivery
  maxAttempts: number
  mode: DeliveryMode
}) {
  if (input.delivery.channel !== 'pachca') {
    const updatedRows = await markFailed({
      db: input.db,
      delivery: input.delivery,
      error: `Unsupported announcement channel: ${input.delivery.channel}`,
      maxAttempts: input.maxAttempts,
    })

    return {
      error: 'unsupported_channel',
      id: input.delivery.id,
      idempotencyKey: input.delivery.idempotencyKey,
      status: updatedRows.length > 0 ? 'failed' : 'skipped',
    }
  }

  try {
    const preview = createDryRunPreview(input.delivery)
    const updatedRows = await markDryRun({
      db: input.db,
      delivery: input.delivery,
      maxAttempts: input.maxAttempts,
    })

    if (updatedRows.length === 0) {
      return {
        id: input.delivery.id,
        idempotencyKey: input.delivery.idempotencyKey,
        status: 'skipped',
      }
    }

    console.info('Project Z announcement dry-run recorded', {
      deliveryId: input.delivery.id,
      mode: input.mode,
    })

    return {
      id: input.delivery.id,
      idempotencyKey: input.delivery.idempotencyKey,
      preview,
      status: 'dry_run',
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'announcement_payload_failed'
    const updatedRows = await markFailed({
      db: input.db,
      delivery: input.delivery,
      error: message,
      maxAttempts: input.maxAttempts,
    })

    return {
      error: message,
      id: input.delivery.id,
      idempotencyKey: input.delivery.idempotencyKey,
      status: updatedRows.length > 0 ? 'failed' : 'skipped',
    }
  }
}

async function processAnnouncementDeliveries(input: {
  db: ProjectZDatabase
  limit: number
  maxAttempts: number
  mode: DeliveryMode
}) {
  const deliveries = await getPendingDeliveries({
    db: input.db,
    limit: input.limit,
    maxAttempts: input.maxAttempts,
  })
  const results = []

  for (const delivery of deliveries) {
    results.push(
      await processDelivery({
        db: input.db,
        delivery,
        maxAttempts: input.maxAttempts,
        mode: input.mode,
      }),
    )
  }

  return results
}

export async function handleAnnouncementWorkerRequest(
  request: BackendRequest,
  options: AnnouncementWorkerOptions = {},
): Promise<BackendResponse> {
  try {
    if (request.httpMethod.toUpperCase() !== 'POST') {
      throw new RequestError(405, 'Announcement worker expects POST.')
    }

    requireWorkerAuthorization(request)

    const mode = getDeliveryMode()
    const db = options.db ?? createRuntimeProjectZDatabaseFromEnv()
    const limit = getBoundedIntegerFromEnv({
      defaultValue: defaultBatchLimit,
      maxValue: maxBatchLimit,
      minValue: 1,
      name: 'PROJECT_Z_ANNOUNCEMENT_BATCH_LIMIT',
    })
    const maxAttempts = getBoundedIntegerFromEnv({
      defaultValue: defaultMaxAttempts,
      maxValue: 10,
      minValue: 1,
      name: 'PROJECT_Z_ANNOUNCEMENT_MAX_ATTEMPTS',
    })
    const results = await processAnnouncementDeliveries({
      db,
      limit,
      maxAttempts,
      mode,
    })

    return jsonResponse(200, {
      deliveries: results,
      failedCount: results.filter((result) => result.status === 'failed').length,
      mode,
      processedCount: results.filter((result) => result.status === 'dry_run')
        .length,
      skippedCount: results.filter((result) => result.status === 'skipped')
        .length,
    })
  } catch (error) {
    if (error instanceof RequestError) {
      return jsonResponse(error.statusCode, { error: error.message })
    }

    if (error instanceof BackendConfigurationError) {
      return jsonResponse(503, { error: error.message })
    }

    if (error instanceof ProjectZDatabaseError) {
      return jsonResponse(500, { error: 'Announcement worker database failed.' })
    }

    console.error('Project Z announcement worker error', {
      message: error instanceof Error ? error.message : 'unknown',
      path: request.path,
    })

    return jsonResponse(500, {
      error: 'Announcement worker could not process deliveries.',
    })
  }
}
