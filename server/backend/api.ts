import { getNextChapterId } from '../../src/entities/chapter/lib/progressMutations'
import { chapters } from '../../src/entities/chapter/model/chapterCatalog'
import {
  evaluateMission,
  getEncounteredTrapIdsFromEvaluation,
  type MissionAnswer,
  type MissionEvaluation,
} from '../../src/entities/mission/lib/missionEngine'
import {
  publicChapters,
  staticContentVersion,
} from '../../src/shared/api/content/staticContentRepository'
import type {
  LeaderboardEntry,
  PublicMissionEvaluation,
} from '../../src/shared/types/domain'
import { BackendConfigurationError } from './configuration'
import {
  createExpiredPilotSessionCookie,
  createPilotSessionCookie,
  getPilotSessionId,
} from './cookies'
import {
  type BackendRequest,
  type BackendResponse,
  type RequestPathOptions,
  RequestError,
  getRequestPath,
  getRouteSegments,
  jsonResponse,
  optionalString,
  readJsonBody,
  requiredString,
} from './http'
import { createQaPassAnswer } from './qaPassAnswer'
import {
  ProjectZRateLimiter,
  createProjectZRateLimiter,
  getClientIpHash,
  type RateLimitDecision,
} from './rateLimiting'
import {
  type MePayload,
  ProjectZDatabaseError,
  type ProjectZDatabase,
  type SubmitMissionAttemptResult,
} from '../db/projectZDatabase'
import { createRuntimeProjectZDatabaseFromEnv } from '../db/runtimeProjectZDatabase'

type ProjectZApiHandlerOptions = RequestPathOptions & {
  db?: ProjectZDatabase
  rateLimiter?: ProjectZRateLimiter
}

const orderedChapters = [...chapters].sort((left, right) => left.order - right.order)
const chapterIds = orderedChapters.map((chapter) => chapter.id)
const firstChapterId = orderedChapters[0]?.id ?? ''
const defaultRateLimiter = createProjectZRateLimiter()
const apiRouteNotFoundBody = { error: 'Маршрут API не найден.' }

class RateLimitExceededError extends RequestError {
  readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super(429, 'Слишком много запросов. Попробуй позже.')
    this.name = 'RateLimitExceededError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function resetProjectZApiRateLimiters() {
  defaultRateLimiter.reset()
}

function getRequestPathOptions(
  options: ProjectZApiHandlerOptions,
): RequestPathOptions {
  return {
    pathPrefix: options.pathPrefix,
    pathReplacement: options.pathReplacement,
  }
}

function requiredPilotSessionId(request: BackendRequest) {
  const pilotSessionId = getPilotSessionId(request)

  if (!pilotSessionId) {
    throw new RequestError(401, 'Нужно открыть пилотную сессию.')
  }

  return pilotSessionId
}

async function createPilotSession(input: {
  db: ProjectZDatabase
  publicCode: string | null
  rateLimiter: ProjectZRateLimiter
  request: BackendRequest
}) {
  enforceRateLimit(
    input.rateLimiter.checkPilotSessionCreation({
      ipHash: getClientIpHash(input.request),
    }),
  )

  const payload = await input.db.createPilotSession({
    publicCode: input.publicCode,
  })

  return {
    cookie: createPilotSessionCookie(input.request, payload.pilotSession.id),
    payload,
  }
}

async function getOrCreatePilotSession(input: {
  db: ProjectZDatabase
  rateLimiter: ProjectZRateLimiter
  request: BackendRequest
}) {
  const pilotSessionId = getPilotSessionId(input.request)

  if (pilotSessionId) {
    return { cookie: null, pilotSessionId }
  }

  const createdSession = await createPilotSession({
    db: input.db,
    publicCode: null,
    rateLimiter: input.rateLimiter,
    request: input.request,
  })

  return {
    cookie: createdSession.cookie,
    pilotSessionId: createdSession.payload.pilotSession.id,
  }
}

function getRankForClosedChapters(closedChaptersCount: number) {
  const latestCompletedChapter = orderedChapters[closedChaptersCount - 1]

  return latestCompletedChapter?.rankAfterCompletion ?? 'Новый участник'
}

function getChapterAndMission(input: { chapterId: string; missionId: string }) {
  const chapter = chapters.find((item) => item.id === input.chapterId)

  if (!chapter) {
    throw new RequestError(404, 'Глава не найдена.')
  }

  const missionSequence = [...chapter.missions, chapter.boss]
  const missionIndex = missionSequence.findIndex(
    (item) => item.id === input.missionId,
  )
  const mission = missionIndex >= 0 ? missionSequence[missionIndex] : null

  if (!mission) {
    throw new RequestError(404, 'Сцена не найдена.')
  }

  return {
    chapter,
    mission,
    requiredPreviousMissionIds: missionSequence
      .slice(0, missionIndex)
      .map((item) => item.id),
  }
}

function assertFreshContentVersion(contentVersion: string) {
  if (contentVersion !== staticContentVersion) {
    throw new RequestError(
      409,
      'Контент обновился. Перезагрузи маршрут и попробуй снова.',
    )
  }
}

function toPublicMissionEvaluation(
  evaluation: MissionEvaluation,
): PublicMissionEvaluation {
  return {
    answerDetails: evaluation.answerDetails,
    feedback: evaluation.feedback,
    passed: evaluation.isCorrect,
    roundResults: evaluation.roundResults?.map((round) => ({
      answerDetails: round.answerDetails,
      feedback: round.feedback,
      passed: round.isCorrect,
      roundId: round.roundId,
      score: round.score,
      title: round.title,
    })),
    score: evaluation.score,
  }
}

async function persistMissionAttempt(input: {
  answer: MissionAnswer
  clientAttemptId: string
  contentVersion: string
  db: ProjectZDatabase
  missionContext: ReturnType<typeof getChapterAndMission>
  pilotSessionId: string
}) {
  const { chapter, mission, requiredPreviousMissionIds } = input.missionContext
  const evaluation = evaluateMission(mission, input.answer)
  const trapIds = getEncounteredTrapIdsFromEvaluation(evaluation)
  // Keep derived gameplay writes server-owned; do not forward client body fields.
  const persistenceResult: SubmitMissionAttemptResult =
    await input.db.submitMissionAttempt({
      answer: input.answer,
      badgeNameSnapshot: chapter.badgeName,
      chapterId: chapter.id,
      chapterIds,
      clientAttemptId: input.clientAttemptId,
      contentVersion: input.contentVersion,
      encounteredTrapIds: trapIds,
      firstChapterId,
      isChapterBoss: mission.id === chapter.boss.id,
      isCorrect: evaluation.isCorrect,
      missionId: mission.id,
      nextChapterId: getNextChapterId(orderedChapters, chapter.id),
      pilotSessionId: input.pilotSessionId,
      requiredPreviousMissionIds,
      score: evaluation.score,
    })
  const persistedEvaluation: MissionEvaluation = persistenceResult.duplicate
    ? evaluateMission(mission, persistenceResult.attempt.answer)
    : evaluation

  return {
    missionId: mission.id,
    response: jsonResponse(200, {
      completion: persistenceResult.completion,
      evaluation: toPublicMissionEvaluation(persistedEvaluation),
      progress: persistenceResult.progress,
      trapDiscoveries: persistenceResult.trapDiscoveries,
    }),
  }
}

function mapDatabaseError(error: ProjectZDatabaseError) {
  if (error.message.includes('invalid_pilot_session')) {
    return new RequestError(401, 'Пилотная сессия недоступна.')
  }

  if (error.message.includes('learner_not_identified')) {
    return new RequestError(409, 'Нужно представиться перед продолжением.')
  }

  if (error.message.includes('nickname_required')) {
    return new RequestError(400, 'Нужно указать никнейм.')
  }

  if (error.message.includes('full_name_required')) {
    return new RequestError(400, 'Нужно указать имя и фамилию.')
  }

  if (error.message.includes('client_attempt_id_required')) {
    return new RequestError(400, 'Нужен ключ попытки.')
  }

  if (error.message.includes('client_attempt_id_reused_for_different_mission')) {
    return new RequestError(409, 'Ключ попытки уже использован для другой сцены.')
  }

  if (error.message.includes('chapter_not_open')) {
    return new RequestError(409, 'Глава ещё закрыта.')
  }

  if (error.message.includes('mission_not_open')) {
    return new RequestError(409, 'Сцена ещё закрыта.')
  }

  if (error.message.includes('chapter_not_completed')) {
    return new RequestError(409, 'Глава ещё не завершена.')
  }

  return new RequestError(500, 'Сервер не смог сохранить данные.')
}

function enforceRateLimit(decision: RateLimitDecision) {
  if (!decision.allowed) {
    throw new RateLimitExceededError(decision.retryAfterSeconds)
  }
}

async function handleCreatePilotSession(
  request: BackendRequest,
  db: ProjectZDatabase,
  rateLimiter: ProjectZRateLimiter,
) {
  const body = readJsonBody(request)
  const result = await createPilotSession({
    db,
    publicCode: optionalString(body, 'publicCode'),
    rateLimiter,
    request,
  })

  return jsonResponse(200, result.payload, { cookies: [result.cookie] })
}

async function handleGetMe(request: BackendRequest, db: ProjectZDatabase) {
  const pilotSessionId = getPilotSessionId(request)

  if (!pilotSessionId) {
    return jsonResponse(200, {
      learner: null,
      pilotSession: null,
    } satisfies MePayload)
  }

  try {
    const payload = await db.getMe({ pilotSessionId })

    return jsonResponse(200, payload)
  } catch (error) {
    if (
      error instanceof ProjectZDatabaseError &&
      error.message.includes('invalid_pilot_session')
    ) {
      return jsonResponse(
        200,
        {
          learner: null,
          pilotSession: null,
        } satisfies MePayload,
        { cookies: [createExpiredPilotSessionCookie(request)] },
      )
    }

    throw error
  }
}

async function handleIdentifyLearner(
  request: BackendRequest,
  db: ProjectZDatabase,
  rateLimiter: ProjectZRateLimiter,
) {
  const body = readJsonBody(request)
  const session = await getOrCreatePilotSession({ db, rateLimiter, request })
  const payload = await db.identifyLearner({
    chapterIds,
    firstChapterId,
    fullName: requiredString(body, 'fullName', 'Нужно указать имя и фамилию.'),
    nickname: requiredString(body, 'nickname', 'Нужно указать никнейм.'),
    pilotSessionId: session.pilotSessionId,
  })

  return jsonResponse(200, payload, {
    cookies: session.cookie ? [session.cookie] : undefined,
  })
}

async function getProgressPayload(
  request: BackendRequest,
  db: ProjectZDatabase,
) {
  return db.getProgress({
    chapterIds,
    firstChapterId,
    pilotSessionId: requiredPilotSessionId(request),
  })
}

async function handleSubmitMissionAttempt(
  request: BackendRequest,
  db: ProjectZDatabase,
  rateLimiter: ProjectZRateLimiter,
  missionId: string,
) {
  const body = readJsonBody(request)
  const chapterId = requiredString(body, 'chapterId')
  const clientAttemptId = requiredString(body, 'clientAttemptId')
  const contentVersion = requiredString(body, 'contentVersion')

  if (!('answer' in body)) {
    throw new RequestError(400, 'Нужен ответ.')
  }

  const pilotSessionId = requiredPilotSessionId(request)

  enforceRateLimit(
    rateLimiter.checkMissionAttempt({
      clientAttemptId,
      missionId,
      pilotSessionId,
    }),
  )

  assertFreshContentVersion(contentVersion)

  const missionContext = getChapterAndMission({
    chapterId,
    missionId,
  })
  const answer = body.answer as MissionAnswer
  const result = await persistMissionAttempt({
    answer,
    clientAttemptId,
    contentVersion,
    db,
    missionContext,
    pilotSessionId,
  })
  rateLimiter.rememberAcceptedMissionAttemptClientId({
    clientAttemptId,
    missionId: result.missionId,
    pilotSessionId,
  })

  return result.response
}

async function handleSubmitQaPassMissionAttempt(
  request: BackendRequest,
  db: ProjectZDatabase,
  missionId: string,
) {
  if (process.env.PROJECT_Z_QA_PASS !== '1') {
    return jsonResponse(404, apiRouteNotFoundBody)
  }

  const body = readJsonBody(request)
  const chapterId = requiredString(body, 'chapterId')
  const clientAttemptId = requiredString(body, 'clientAttemptId')
  const contentVersion = requiredString(body, 'contentVersion')
  const pilotSessionId = requiredPilotSessionId(request)

  assertFreshContentVersion(contentVersion)

  const missionContext = getChapterAndMission({ chapterId, missionId })

  return (
    await persistMissionAttempt({
      answer: createQaPassAnswer(missionContext.mission),
      clientAttemptId,
      contentVersion,
      db,
      missionContext,
      pilotSessionId,
    })
  ).response
}

async function handleRecordMissionStart(
  request: BackendRequest,
  db: ProjectZDatabase,
  missionId: string,
) {
  const body = readJsonBody(request)
  const chapterId = requiredString(body, 'chapterId')
  const contentVersion = requiredString(body, 'contentVersion')

  assertFreshContentVersion(contentVersion)

  const missionContext = getChapterAndMission({ chapterId, missionId })
  const { chapter, mission, requiredPreviousMissionIds } = missionContext

  return jsonResponse(
    200,
    await db.recordMissionStart({
      chapterId: chapter.id,
      chapterIds,
      contentVersion,
      firstChapterId,
      missionId: mission.id,
      pilotSessionId: requiredPilotSessionId(request),
      requiredPreviousMissionIds,
    }),
  )
}

async function handleGetChapterReflection(
  request: BackendRequest,
  db: ProjectZDatabase,
  chapterId: string,
) {
  const payload = await db.getChapterReflection({
    chapterId,
    chapterIds,
    pilotSessionId: requiredPilotSessionId(request),
  })

  return jsonResponse(200, payload)
}

async function handleSaveChapterReflection(
  request: BackendRequest,
  db: ProjectZDatabase,
  chapterId: string,
) {
  const body = readJsonBody(request)
  const payload = await db.saveChapterReflection({
    chapterId,
    chapterIds,
    note: optionalString(body, 'note') ?? '',
    optionId: optionalString(body, 'optionId'),
    optionLabel: optionalString(body, 'optionLabel'),
    pilotSessionId: requiredPilotSessionId(request),
    skipped: body.skipped === true,
  })

  return jsonResponse(200, payload)
}

async function handleLeaderboard(db: ProjectZDatabase) {
  const rows = await db.getLeaderboardEntries()
  const entries: LeaderboardEntry[] = rows.map((row) => ({
    closedChaptersCount: row.closedChaptersCount,
    currentRank: getRankForClosedChapters(row.closedChaptersCount),
    fullName: '',
    lastBadgeDate: row.lastBadgeDate,
    lastBadgeName: row.lastBadgeName,
    learnerId: row.learnerId,
    nickname: row.nickname,
  }))

  return jsonResponse(200, { entries })
}

async function handleMarkUnlockSeen(
  request: BackendRequest,
  db: ProjectZDatabase,
  chapterId: string,
) {
  const payload = await db.markUnlockSeen({
    chapterId,
    chapterIds,
    firstChapterId,
    pilotSessionId: requiredPilotSessionId(request),
  })

  return jsonResponse(200, { progress: payload.progress })
}

async function routeProjectZApiRequest(
  request: BackendRequest,
  db: ProjectZDatabase,
  pathOptions: RequestPathOptions,
  rateLimiter: ProjectZRateLimiter,
): Promise<BackendResponse> {
  const method = request.httpMethod.toUpperCase()
  const segments = getRouteSegments(request, pathOptions)

  if (method === 'GET' && segments.length === 1 && segments[0] === 'content') {
    return jsonResponse(200, {
      chapters: publicChapters,
      contentVersion: staticContentVersion,
    })
  }

  if (method === 'POST' && segments.length === 1 && segments[0] === 'pilot-sessions') {
    return handleCreatePilotSession(request, db, rateLimiter)
  }

  if (method === 'GET' && segments.length === 1 && segments[0] === 'me') {
    return handleGetMe(request, db)
  }

  if (
    method === 'POST' &&
    segments.length === 2 &&
    segments[0] === 'learners' &&
    segments[1] === 'identify'
  ) {
    return handleIdentifyLearner(request, db, rateLimiter)
  }

  if (method === 'GET' && segments.length === 1 && segments[0] === 'progress') {
    return jsonResponse(200, await getProgressPayload(request, db))
  }

  if (
    method === 'POST' &&
    segments.length === 3 &&
    segments[0] === 'missions' &&
    segments[2] === 'start'
  ) {
    return handleRecordMissionStart(request, db, segments[1])
  }

  if (
    method === 'POST' &&
    segments.length === 3 &&
    segments[0] === 'missions' &&
    segments[2] === 'attempts'
  ) {
    return handleSubmitMissionAttempt(request, db, rateLimiter, segments[1])
  }

  if (
    method === 'POST' &&
    segments.length === 3 &&
    segments[0] === 'missions' &&
    segments[2] === 'qa-pass'
  ) {
    return handleSubmitQaPassMissionAttempt(request, db, segments[1])
  }

  if (
    segments.length === 2 &&
    segments[0] === 'chapter-reflections' &&
    method === 'GET'
  ) {
    return handleGetChapterReflection(request, db, segments[1])
  }

  if (
    segments.length === 2 &&
    segments[0] === 'chapter-reflections' &&
    method === 'POST'
  ) {
    return handleSaveChapterReflection(request, db, segments[1])
  }

  if (
    method === 'GET' &&
    segments.length === 2 &&
    segments[0] === 'traps' &&
    segments[1] === 'discovered'
  ) {
    const progressPayload = await getProgressPayload(request, db)

    return jsonResponse(200, { trapIds: progressPayload.encounteredTrapIds })
  }

  if (method === 'GET' && segments.length === 1 && segments[0] === 'leaderboard') {
    return handleLeaderboard(db)
  }

  if (
    method === 'POST' &&
    segments.length === 3 &&
    segments[0] === 'unlocks' &&
    segments[2] === 'seen'
  ) {
    return handleMarkUnlockSeen(request, db, segments[1])
  }

  return jsonResponse(404, apiRouteNotFoundBody)
}

export async function handleProjectZApiRequest(
  request: BackendRequest,
  options: ProjectZApiHandlerOptions = {},
): Promise<BackendResponse> {
  const pathOptions = getRequestPathOptions(options)

  try {
    const db = options.db ?? createRuntimeProjectZDatabaseFromEnv()
    const rateLimiter = options.rateLimiter ?? defaultRateLimiter

    return await routeProjectZApiRequest(request, db, pathOptions, rateLimiter)
  } catch (error) {
    const mappedError =
      error instanceof ProjectZDatabaseError ? mapDatabaseError(error) : error

    if (mappedError instanceof RateLimitExceededError) {
      return jsonResponse(mappedError.statusCode, {
        error: mappedError.message,
        retryAfterSeconds: mappedError.retryAfterSeconds,
      })
    }

    if (mappedError instanceof RequestError) {
      return jsonResponse(mappedError.statusCode, { error: mappedError.message })
    }

    if (mappedError instanceof BackendConfigurationError) {
      return jsonResponse(503, { error: mappedError.message })
    }

    console.error('Project Z API error', {
      message: mappedError instanceof Error ? mappedError.message : 'unknown',
      method: request.httpMethod,
      path: getRequestPath(request, pathOptions),
    })

    return jsonResponse(500, { error: 'Сервер не смог обработать запрос.' })
  }
}
