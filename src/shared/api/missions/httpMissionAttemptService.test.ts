import { describe, expect, it } from 'vitest'
import type { BackendApi } from '../http/backendApiClient'
import type { SubmitMissionAttemptResult } from './MissionAttemptService'
import { HttpMissionAttemptService } from './httpMissionAttemptService'

const submitResult: SubmitMissionAttemptResult = {
  completion: null,
  evaluation: {
    feedback: 'Проверено сервером.',
    passed: false,
    score: 0,
  },
  progress: [],
  trapDiscoveries: [],
}

describe('HttpMissionAttemptService', () => {
  it('sends only the raw answer and stable attempt identifiers', async () => {
    const calls: { body: unknown; path: string }[] = []
    const api: BackendApi = {
      get: async <TResponse,>() => {
        void (null as TResponse | null)
        throw new Error('Unexpected GET')
      },
      post: async <TResponse,>(path: string, body?: unknown) => {
        calls.push({ body, path })

        if (path.endsWith('/start')) {
          return { startedAt: '2026-06-02T10:00:00.000Z' } as TResponse
        }

        return submitResult as TResponse
      },
    }
    const service = new HttpMissionAttemptService(api)

    await service.recordMissionStart({
      chapterId: 'chapter-1',
      contentVersion: 'content-v1',
      missionId: 'mission-1',
    })
    await service.submitMissionAttempt({
      answer: 'stop-and-explain',
      chapterId: 'chapter-1',
      clientAttemptId: 'attempt-1',
      contentVersion: 'content-v1',
      missionId: 'mission-1',
    })

    expect(calls).toEqual([
      {
        body: {
          chapterId: 'chapter-1',
          contentVersion: 'content-v1',
        },
        path: '/api/missions/mission-1/start',
      },
      {
        body: {
          answer: 'stop-and-explain',
          chapterId: 'chapter-1',
          clientAttemptId: 'attempt-1',
          contentVersion: 'content-v1',
        },
        path: '/api/missions/mission-1/attempts',
      },
    ])
  })

  it('submits QA pass attempts without answer or client-owned scoring fields', async () => {
    const calls: { body: unknown; path: string }[] = []
    const api: BackendApi = {
      get: async <TResponse,>() => {
        void (null as TResponse | null)
        throw new Error('Unexpected GET')
      },
      post: async <TResponse,>(path: string, body?: unknown) => {
        calls.push({ body, path })

        return submitResult as TResponse
      },
    }
    const service = new HttpMissionAttemptService(api)

    await service.submitQaPassMissionAttempt({
      chapterId: 'chapter-1',
      clientAttemptId: 'attempt-qa-1',
      contentVersion: 'content-v1',
      missionId: 'mission-1',
    })

    expect(calls).toEqual([
      {
        body: {
          chapterId: 'chapter-1',
          clientAttemptId: 'attempt-qa-1',
          contentVersion: 'content-v1',
        },
        path: '/api/missions/mission-1/qa-pass',
      },
    ])
    expect(calls[0]?.body).not.toHaveProperty('answer')
    expect(calls[0]?.body).not.toHaveProperty('source')
    expect(calls[0]?.body).not.toHaveProperty('isCorrect')
    expect(calls[0]?.body).not.toHaveProperty('score')
  })
})
