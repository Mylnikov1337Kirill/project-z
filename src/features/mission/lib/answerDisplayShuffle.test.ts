import { beforeEach, describe, expect, it } from 'vitest'
import type { AnswerDisplayShuffleStorage } from './answerDisplayShuffle'
import {
  clearAnswerDisplayShuffleCache,
  getLaunchStableAnswerDisplayItems,
  seededShuffleAnswerDisplayItems,
} from './answerDisplayShuffle'

const answerBank = [
  {
    id: 'plan-first',
    label: 'Plan first',
    privateNote: 'correct',
  },
  {
    id: 'tiny-proof',
    label: 'Tiny proof',
    privateNote: 'correct',
  },
  {
    id: 'wide-refactor',
    label: 'Wide refactor',
    privateNote: 'trap',
  },
  {
    id: 'silent-submit',
    label: 'Silent submit',
    privateNote: 'trap',
  },
]

describe('seededShuffleAnswerDisplayItems', () => {
  it('keeps one seed stable for the same bank key and public ids', () => {
    const firstOrder = publicIds(
      seededShuffleAnswerDisplayItems(answerBank, {
        bankKey: 'chapter-7:mission-review',
        seed: 'launch-a',
      }),
    )
    const secondOrder = publicIds(
      seededShuffleAnswerDisplayItems([...answerBank].reverse(), {
        bankKey: 'chapter-7:mission-review',
        seed: 'launch-a',
      }),
    )

    expect(secondOrder).toEqual(firstOrder)
  })

  it('changes order for different seeds on the same multi-answer bank', () => {
    const firstOrder = publicIds(
      seededShuffleAnswerDisplayItems(answerBank, {
        bankKey: 'chapter-7:mission-review',
        seed: 'seed-a',
      }),
    )
    const secondOrder = publicIds(
      seededShuffleAnswerDisplayItems(answerBank, {
        bankKey: 'chapter-7:mission-review',
        seed: 'seed-b',
      }),
    )

    expect(firstOrder).not.toEqual(secondOrder)
    expect([...firstOrder].sort()).toEqual([...secondOrder].sort())
  })

  it('does not mutate the input bank', () => {
    const originalOrder = publicIds(answerBank)

    const shuffledItems = seededShuffleAnswerDisplayItems(answerBank, {
      bankKey: 'chapter-3:mission-loop',
      seed: 'launch-b',
    })

    expect(shuffledItems).not.toBe(answerBank)
    expect(publicIds(answerBank)).toEqual(originalOrder)
  })

  it('keeps every public id exactly once', () => {
    const shuffledIds = publicIds(
      seededShuffleAnswerDisplayItems(answerBank, {
        bankKey: 'chapter-5:skills',
        seed: 'launch-c',
      }),
    )

    expect([...shuffledIds].sort()).toEqual([...publicIds(answerBank)].sort())
    expect(new Set(shuffledIds).size).toBe(answerBank.length)
  })

  it('keeps selection identity on public ids instead of display positions', () => {
    const firstDisplayOrder = seededShuffleAnswerDisplayItems(answerBank, {
      bankKey: 'chapter-1:scenario-options',
      seed: 'seed-a',
    })
    const secondDisplayOrder = seededShuffleAnswerDisplayItems(answerBank, {
      bankKey: 'chapter-1:scenario-options',
      seed: 'seed-b',
    })
    const selectedId =
      firstDisplayOrder.find((item) => item.label === 'Plan first')?.id ?? ''

    expect(selectedId).toBe('plan-first')
    expect(firstDisplayOrder.findIndex((item) => item.id === selectedId)).not.toBe(
      secondDisplayOrder.findIndex((item) => item.id === selectedId),
    )
    expect(secondDisplayOrder.find((item) => item.id === selectedId)?.label).toBe(
      'Plan first',
    )
  })

  it('keeps empty and single-item banks as no-op orders', () => {
    const singleItemBank = [{ id: 'only-option', label: 'Only option' }]

    expect(
      seededShuffleAnswerDisplayItems([], {
        bankKey: 'empty',
        seed: 'launch-d',
      }),
    ).toEqual([])
    expect(
      seededShuffleAnswerDisplayItems(singleItemBank, {
        bankKey: 'single',
        seed: 'launch-d',
      }),
    ).toEqual(singleItemBank)
  })
})

describe('getLaunchStableAnswerDisplayItems', () => {
  beforeEach(() => {
    clearAnswerDisplayShuffleCache()
  })

  it('uses an in-memory cache for the same launch bank key and ids', () => {
    const storage = createMemoryStorage()
    const firstOrder = getLaunchStableAnswerDisplayItems(
      answerBank,
      'chapter-1:scenario-options',
      {
        seed: 'cache-seed-a',
        storage,
      },
    )
    const remountedBank = answerBank.map((item) => ({ ...item }))
    const secondOrder = getLaunchStableAnswerDisplayItems(
      remountedBank,
      'chapter-1:scenario-options',
      {
        seed: 'cache-seed-b',
        storage,
      },
    )

    expect(publicIds(secondOrder)).toEqual(publicIds(firstOrder))
    expect(secondOrder.every((item) => remountedBank.includes(item))).toBe(true)
    expect(storage.setCalls).toBe(1)
  })

  it('rotates instead of repeating the previous stored public-id order', () => {
    const storage = createMemoryStorage()
    const firstOrder = getLaunchStableAnswerDisplayItems(
      answerBank,
      'chapter-2:decision-options',
      {
        seed: 'repeat-seed',
        storage,
      },
    )

    clearAnswerDisplayShuffleCache()

    const secondOrder = getLaunchStableAnswerDisplayItems(
      answerBank,
      'chapter-2:decision-options',
      {
        seed: 'repeat-seed',
        storage,
      },
    )

    expect(publicIds(secondOrder)).not.toEqual(publicIds(firstOrder))
    expect([...publicIds(secondOrder)].sort()).toEqual(
      [...publicIds(firstOrder)].sort(),
    )
  })

  it('stores only public ids in the repeat guard', () => {
    const storage = createMemoryStorage()
    const order = getLaunchStableAnswerDisplayItems(
      answerBank,
      'chapter-4:chip-bank',
      {
        seed: 'storage-seed',
        storage,
      },
    )
    const [storedValue] = storage.values()

    expect(JSON.parse(storedValue!)).toEqual(publicIds(order))
    expect(storedValue).not.toContain('correct')
    expect(storedValue).not.toContain('trap')
    expect(storedValue).not.toContain('Plan first')
  })

  it('does not touch storage for empty or single-item banks', () => {
    const storage = createMemoryStorage()
    const singleItemBank = [{ id: 'only-option', label: 'Only option' }]

    expect(
      getLaunchStableAnswerDisplayItems([], 'empty', {
        seed: 'launch-empty',
        storage,
      }),
    ).toEqual([])
    expect(
      getLaunchStableAnswerDisplayItems(singleItemBank, 'single', {
        seed: 'launch-single',
        storage,
      }),
    ).toEqual(singleItemBank)
    expect(storage.setCalls).toBe(0)
  })

  it('falls back to no-op storage when browser storage is unavailable', () => {
    expect(() =>
      getLaunchStableAnswerDisplayItems(
        answerBank,
        'chapter-8:playbook-options',
        {
          seed: 'storage-free-seed',
          storage: null,
        },
      ),
    ).not.toThrow()
  })
})

function publicIds(items: readonly { id: string }[]) {
  return items.map((item) => item.id)
}

function createMemoryStorage() {
  const store = new Map<string, string>()
  const storage: AnswerDisplayShuffleStorage & {
    setCalls: number
    values: () => string[]
  } = {
    getItem(key) {
      return store.get(key) ?? null
    },
    setCalls: 0,
    setItem(key, value) {
      storage.setCalls += 1
      store.set(key, value)
    },
    values() {
      return [...store.values()]
    },
  }

  return storage
}
