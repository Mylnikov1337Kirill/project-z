import type { Page, Route } from '@playwright/test'
import { env as processEnv } from 'node:process'
import {
  canOpenMission,
  getMissionSequence,
} from '../src/entities/chapter/lib/chapterProgress'
import { projectLeaderboard } from '../src/entities/chapter/lib/leaderboardProjection'
import {
  applyMissionAttemptProgress,
  completeChapterProgress,
  createInitialProgress,
} from '../src/entities/chapter/lib/progressMutations'
import { chapters } from '../src/entities/chapter/model/chapterCatalog'
import {
  evaluateMission,
  getEncounteredTrapIdsFromEvaluation,
  type MissionAnswer,
} from '../src/entities/mission/lib/missionEngine'
import {
  publicChapters,
  staticContentVersion,
} from '../src/shared/api/content/staticContentRepository'
import type {
  Chapter,
  ChapterCompletion,
  ChapterProgress,
  ChapterReflection,
  LeaderboardEntry,
  Learner,
  Mission,
  MissionAttempt,
  PublicMissionEvaluation,
  TrapConceptId,
} from '../src/shared/types/domain'
import { createQaPassAnswer } from '../server/backend/qaPassAnswer'

type PilotSession = {
  id: string
  publicCode: string | null
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  lastSeenAt: string | null
}

type BackendApiFixtureState = {
  completions: ChapterCompletion[]
  encounteredTrapIds: TrapConceptId[]
  leaderboardEntries: LeaderboardEntry[] | null
  learner: Learner | null
  pendingUnlockChapterId: string | null
  progress: ChapterProgress[]
  reflections: ChapterReflection[]
}

type BackendApiFixtureInput = Partial<BackendApiFixtureState>

type BackendApiFixture = {
  requests: { body: unknown; method: string; path: string }[]
  state: BackendApiFixtureState
}

const createdAt = '2026-06-01T10:00:00.000Z'

export function createBackendLearner(overrides: Partial<Learner> = {}): Learner {
  return {
    fullName: 'Pilot Agent',
    id: 'pilot-agent-1',
    nickname: 'pilot-agent',
    ...overrides,
  }
}

export function createBackendProgress(
  input: {
    completedChapterIds?: string[]
    completedMissionIdsByChapter?: Record<string, string[]>
    openChapterId?: string
  } = {},
): ChapterProgress[] {
  const completedChapterIds = new Set(input.completedChapterIds ?? [])
  const openChapterId = input.openChapterId ?? 'chapter-1'

  return chapters.map((chapter) => ({
    chapterId: chapter.id,
    completedMissionIds:
      input.completedMissionIdsByChapter?.[chapter.id] ?? [],
    status: completedChapterIds.has(chapter.id)
      ? 'completed'
      : chapter.id === openChapterId
        ? 'open'
        : 'locked',
  }))
}

function createPilotSession(): PilotSession {
  return {
    createdAt,
    expiresAt: null,
    id: 'pilot-session-1',
    lastSeenAt: createdAt,
    publicCode: null,
    revokedAt: null,
  }
}

function createCompletionsFromProgress(input: {
  learner: Learner | null
  progress: ChapterProgress[]
}): ChapterCompletion[] {
  if (!input.learner) {
    return []
  }

  let completedChapters = 0

  return chapters.reduce<ChapterCompletion[]>((completions, chapter) => {
    const chapterProgress = input.progress.find(
      (item) => item.chapterId === chapter.id,
    )

    if (chapterProgress?.status !== 'completed') {
      return completions
    }

    completedChapters += 1
    completions.push({
      chapterId: chapter.id,
      completedAt: createdAt,
      completedChapters,
      learnerId: input.learner.id,
    })

    return completions
  }, [])
}

function getCompletedMissionIds(progress: ChapterProgress[]) {
  return Array.from(
    new Set(progress.flatMap((item) => item.completedMissionIds)),
  )
}

function getJsonBody(route: Route) {
  const rawBody = route.request().postData()

  if (!rawBody) {
    return {}
  }

  try {
    const parsedBody = JSON.parse(rawBody)

    return parsedBody && typeof parsedBody === 'object' ? parsedBody : {}
  } catch {
    return {}
  }
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json; charset=utf-8',
    status,
  })
}

function getSegments(pathname: string) {
  return pathname
    .replace(/^\/api\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
}

function getReflectionForResponse(reflection: ChapterReflection | null) {
  return { reflection }
}

function toPublicMissionEvaluation(
  evaluation: ReturnType<typeof evaluateMission>,
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

function getPrivateMissionSequence(chapter: Chapter): Mission[] {
  return [...chapter.missions, chapter.boss]
}

export async function installBackendApiFixture(
  page: Page,
  input: BackendApiFixtureInput = {},
): Promise<BackendApiFixture> {
  const state: BackendApiFixtureState = {
    encounteredTrapIds: input.encounteredTrapIds ?? [],
    leaderboardEntries: input.leaderboardEntries ?? null,
    learner: input.learner ?? null,
    pendingUnlockChapterId: input.pendingUnlockChapterId ?? null,
    progress: input.progress ?? createInitialProgress(chapters),
    reflections: input.reflections ?? [],
    completions: input.completions ?? [],
  }
  let pilotSession = state.learner ? createPilotSession() : null
  const attempts: MissionAttempt[] = []
  const requests: BackendApiFixture['requests'] = []

  if (state.completions.length === 0) {
    state.completions = createCompletionsFromProgress({
      learner: state.learner,
      progress: state.progress,
    })
  }

  function getMissionAttemptContext(input: {
    chapterId: string
    missionId: string
  }) {
    const chapter =
      chapters.find((item): item is Chapter => item.id === input.chapterId) ??
      null
    const mission = chapter
      ? (getPrivateMissionSequence(chapter).find(
          (item) => item.id === input.missionId,
        ) ?? null)
      : null
    const chapterProgress = state.progress.find(
      (item) => item.chapterId === input.chapterId,
    )
    const completedMissionIds = new Set(
      chapterProgress?.completedMissionIds ?? [],
    )
    const canSubmitMission = Boolean(
      chapter &&
        mission &&
        chapterProgress &&
        canOpenMission(
          chapter,
          mission.id,
          completedMissionIds,
          chapterProgress.status,
        ),
    )

    return { canSubmitMission, chapter, mission }
  }

  async function fulfillMissionAttempt(
    route: Route,
    input: {
      answer: MissionAnswer
      chapter: Chapter
      clientAttemptId: string
      mission: Mission
    },
  ) {
    const existingAttempt = attempts.find(
      (attempt) => attempt.clientAttemptId === input.clientAttemptId,
    )

    if (existingAttempt) {
      await fulfillJson(route, 200, {
        completion: null,
        evaluation: toPublicMissionEvaluation(
          evaluateMission(input.mission, existingAttempt.answer as MissionAnswer),
        ),
        progress: state.progress,
        trapDiscoveries: [],
      })
      return
    }

    const evaluation = evaluateMission(input.mission, input.answer)
    const encounteredTrapIds = getEncounteredTrapIdsFromEvaluation(evaluation)
    const knownTrapIds = new Set(state.encounteredTrapIds)
    const attempt: MissionAttempt = {
      answer: input.answer,
      chapterId: input.chapter.id,
      clientAttemptId: input.clientAttemptId,
      contentVersion: staticContentVersion,
      createdAt,
      isCorrect: evaluation.isCorrect,
      learnerId: state.learner.id,
      missionId: input.mission.id,
      score: evaluation.score,
    }

    attempts.push(attempt)
    state.progress = applyMissionAttemptProgress(state.progress, attempt)
    state.encounteredTrapIds = Array.from(
      new Set([...state.encounteredTrapIds, ...encounteredTrapIds]),
    )

    let completion: ChapterCompletion | null = null

    if (evaluation.isCorrect && input.mission.id === input.chapter.boss.id) {
      const completionResult = completeChapterProgress({
        chapterId: input.chapter.id,
        chapters,
        completedAt: createdAt,
        completions: state.completions,
        learnerId: state.learner.id,
        pendingUnlockChapterId: state.pendingUnlockChapterId,
        progress: state.progress,
      })

      completion = completionResult.completion
      state.completions = completionResult.completions
      state.pendingUnlockChapterId = completionResult.pendingUnlockChapterId
      state.progress = completionResult.progress
    }

    await fulfillJson(route, 200, {
      completion,
      evaluation: toPublicMissionEvaluation(evaluation),
      progress: state.progress,
      trapDiscoveries: encounteredTrapIds.map((trapId) => ({
        id: trapId,
        isNew: !knownTrapIds.has(trapId),
      })),
    })
  }

  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method().toUpperCase()
    const segments = getSegments(url.pathname)
    const body = getJsonBody(route)
    const isQaPassRequest =
      method === 'POST' &&
      segments.length === 3 &&
      segments[0] === 'missions' &&
      segments[2] === 'qa-pass'

    requests.push({ body, method, path: url.pathname })

    if (method === 'GET' && segments.length === 1 && segments[0] === 'me') {
      await fulfillJson(route, 200, {
        learner: state.learner,
        pilotSession,
      })
      return
    }

    if (
      method === 'POST' &&
      segments.length === 1 &&
      segments[0] === 'pilot-sessions'
    ) {
      pilotSession = createPilotSession()
      await fulfillJson(route, 200, { pilotSession })
      return
    }

    if (
      method === 'POST' &&
      segments.length === 2 &&
      segments[0] === 'learners' &&
      segments[1] === 'identify'
    ) {
      pilotSession = pilotSession ?? createPilotSession()
      state.learner = createBackendLearner({
        fullName: typeof body.fullName === 'string' ? body.fullName : '',
        nickname: typeof body.nickname === 'string' ? body.nickname : '',
      })
      state.progress = createInitialProgress(chapters)
      state.completions = []
      await fulfillJson(route, 200, { learner: state.learner })
      return
    }

    if (
      method === 'GET' &&
      segments.length === 1 &&
      segments[0] === 'content'
    ) {
      await fulfillJson(route, 200, {
        chapters: publicChapters,
        contentVersion: staticContentVersion,
      })
      return
    }

    if (isQaPassRequest && processEnv.PROJECT_Z_QA_PASS !== '1') {
      await fulfillJson(route, 404, { error: 'Маршрут API не найден.' })
      return
    }

    if (!state.learner) {
      await fulfillJson(route, 409, {
        error: 'Нужно представиться перед продолжением.',
      })
      return
    }

    if (
      method === 'GET' &&
      segments.length === 1 &&
      segments[0] === 'progress'
    ) {
      await fulfillJson(route, 200, {
        completedMissionIds: getCompletedMissionIds(state.progress),
        encounteredTrapIds: state.encounteredTrapIds,
        learner: state.learner,
        pendingUnlockChapterId: state.pendingUnlockChapterId,
        progress: state.progress,
      })
      return
    }

    if (
      method === 'GET' &&
      segments.length === 2 &&
      segments[0] === 'traps' &&
      segments[1] === 'discovered'
    ) {
      await fulfillJson(route, 200, {
        trapIds: state.encounteredTrapIds,
      })
      return
    }

    if (
      segments.length === 2 &&
      segments[0] === 'chapter-reflections' &&
      method === 'GET'
    ) {
      await fulfillJson(
        route,
        200,
        getReflectionForResponse(
          state.reflections.find(
            (reflection) => reflection.chapterId === segments[1],
          ) ?? null,
        ),
      )
      return
    }

    if (
      segments.length === 2 &&
      segments[0] === 'chapter-reflections' &&
      method === 'POST'
    ) {
      const reflection: ChapterReflection =
        body.skipped === true
          ? {
              chapterId: segments[1],
              note: '',
              optionId: null,
              optionLabel: null,
              skipped: true,
              updatedAt: createdAt,
            }
          : {
              chapterId: segments[1],
              note: typeof body.note === 'string' ? body.note : '',
              optionId:
                typeof body.optionId === 'string' ? body.optionId : null,
              optionLabel:
                typeof body.optionLabel === 'string' ? body.optionLabel : null,
              skipped: false,
              updatedAt: createdAt,
            }

      state.reflections = [
        ...state.reflections.filter((item) => item.chapterId !== segments[1]),
        reflection,
      ]
      await fulfillJson(route, 200, { reflection })
      return
    }

    if (
      method === 'GET' &&
      segments.length === 1 &&
      segments[0] === 'leaderboard'
    ) {
      await fulfillJson(route, 200, {
        entries:
          state.leaderboardEntries ??
          projectLeaderboard({
            chapters,
            completions: state.completions,
            learner: state.learner,
            progress: state.progress,
          }).map((entry) => ({
            ...entry,
            fullName: '',
          })),
      })
      return
    }

    if (
      method === 'POST' &&
      segments.length === 3 &&
      segments[0] === 'unlocks' &&
      segments[2] === 'seen'
    ) {
      if (state.pendingUnlockChapterId === segments[1]) {
        state.pendingUnlockChapterId = null
      }

      await fulfillJson(route, 200, { progress: state.progress })
      return
    }

    if (isQaPassRequest) {
      const chapterId = typeof body.chapterId === 'string' ? body.chapterId : ''
      const clientAttemptId =
        typeof body.clientAttemptId === 'string' ? body.clientAttemptId : ''
      const context = getMissionAttemptContext({
        chapterId,
        missionId: segments[1],
      })

      if (
        !context.chapter ||
        !context.mission ||
        !context.canSubmitMission ||
        body.contentVersion !== staticContentVersion ||
        !clientAttemptId
      ) {
        await fulfillJson(route, 409, {
          error: 'Сервер не смог сохранить данные.',
        })
        return
      }

      await fulfillMissionAttempt(route, {
        answer: createQaPassAnswer(context.mission),
        chapter: context.chapter,
        clientAttemptId,
        mission: context.mission,
      })
      return
    }

    if (
      method === 'POST' &&
      segments.length === 3 &&
      segments[0] === 'missions' &&
      segments[2] === 'start'
    ) {
      const chapterId = typeof body.chapterId === 'string' ? body.chapterId : ''
      const chapter = chapters.find((item) => item.id === chapterId)
      const mission = chapter
        ? getMissionSequence(chapter).find((item) => item.id === segments[1])
        : null
      const chapterProgress = state.progress.find(
        (item) => item.chapterId === chapterId,
      )
      const completedMissionIds = new Set(
        chapterProgress?.completedMissionIds ?? [],
      )
      const canStartMission = Boolean(
        chapter &&
          mission &&
          chapterProgress &&
          canOpenMission(
            chapter,
            mission.id,
            completedMissionIds,
            chapterProgress.status,
          ),
      )

      if (
        !chapter ||
        !mission ||
        !canStartMission ||
        body.contentVersion !== staticContentVersion
      ) {
        await fulfillJson(route, 409, {
          error: 'Сервер не смог сохранить данные.',
        })
        return
      }

      await fulfillJson(route, 200, { startedAt: createdAt })
      return
    }

    if (
      method === 'POST' &&
      segments.length === 3 &&
      segments[0] === 'missions' &&
      segments[2] === 'attempts'
    ) {
      const chapterId = typeof body.chapterId === 'string' ? body.chapterId : ''
      const clientAttemptId =
        typeof body.clientAttemptId === 'string' ? body.clientAttemptId : ''
      const context = getMissionAttemptContext({
        chapterId,
        missionId: segments[1],
      })

      if (
        !context.chapter ||
        !context.mission ||
        !context.canSubmitMission ||
        body.contentVersion !== staticContentVersion ||
        !clientAttemptId
      ) {
        await fulfillJson(route, 409, {
          error: 'Сервер не смог сохранить данные.',
        })
        return
      }

      await fulfillMissionAttempt(route, {
        answer: body.answer as MissionAnswer,
        chapter: context.chapter,
        clientAttemptId,
        mission: context.mission,
      })
      return
    }

    await fulfillJson(route, 404, { error: 'Маршрут API не найден.' })
    },
  )

  return { requests, state }
}
