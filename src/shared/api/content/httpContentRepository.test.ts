import { describe, expect, it } from 'vitest'
import type { BackendApi } from '../http/backendApiClient'
import type { PublicChapter } from '../../types/domain'
import { HttpContentRepository } from './httpContentRepository'

const chapter: PublicChapter = {
  badgeName: 'Badge',
  boss: {
    failureFeedback: 'Retry',
    id: 'boss',
    kind: 'boss-fight',
    mentorHint: 'Hint',
    prompt: 'Prompt',
    rounds: [],
    successFeedback: 'Success',
    title: 'Boss',
  },
  id: 'chapter-1',
  missions: [],
  order: 1,
  rankAfterCompletion: 'Rank',
  recap: {
    commonTrap: {
      note: 'Trap note',
      trapId: 'too-broad',
    },
    nextMove: 'Next',
    rules: ['Rule'],
  },
  reward: {
    applyTomorrow: 'Apply',
    emblem: 'E',
    masteryActions: ['One', 'Two'],
    motif: 'Motif',
    motto: 'Motto',
    nextTeaser: 'Next',
    skill: 'Skill',
  },
  summary: 'Summary',
  title: 'Chapter',
}

describe('HttpContentRepository', () => {
  it('loads and caches the public content catalog', async () => {
    const getCalls: string[] = []
    const api: BackendApi = {
      get: async <TResponse,>(path: string) => {
        getCalls.push(path)

        return {
          chapters: [chapter],
          contentVersion: 'content-v1',
        } as TResponse
      },
      post: async <TResponse,>() => {
        return {} as TResponse
      },
    }
    const repository = new HttpContentRepository(api)

    await expect(repository.getContentVersion()).resolves.toBe('content-v1')
    await expect(repository.listChapters()).resolves.toEqual([chapter])
    await expect(repository.getChapter('chapter-1')).resolves.toEqual(chapter)

    expect(getCalls).toEqual(['/api/content'])
  })
})
