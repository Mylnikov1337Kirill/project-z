export type AnswerDisplayShuffleItem = {
  id: string
}

export type AnswerDisplayShuffleStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type SeededAnswerDisplayShuffleOptions = {
  bankKey: string
  seed: string
}

export type LaunchStableAnswerDisplayShuffleOptions = {
  seed?: string
  storage?: AnswerDisplayShuffleStorage | null
}

const STORAGE_KEY_PREFIX = 'agent-trail:answer-display-shuffle:v1'
const KEY_SEPARATOR = '\u001f'
const SSR_LAUNCH_SEED = 'agent-trail-answer-display-ssr-launch'

const launchOrderCache = new Map<string, string[]>()

export const answerDisplayLaunchSeed = createAnswerDisplayLaunchSeed()

export function seededShuffleAnswerDisplayItems<
  TItem extends AnswerDisplayShuffleItem,
>(
  items: readonly TItem[],
  options: SeededAnswerDisplayShuffleOptions,
): TItem[] {
  if (items.length <= 1) {
    return [...items]
  }

  const canonicalItems = [...items].sort((left, right) =>
    left.id.localeCompare(right.id),
  )
  const seedMaterial = [
    options.seed,
    options.bankKey,
    ...canonicalItems.map((item) => item.id),
  ].join(KEY_SEPARATOR)
  const random = createSeededRandom(seedMaterial)
  const shuffledItems = [...canonicalItems]

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const currentItem = shuffledItems[index]!
    shuffledItems[index] = shuffledItems[swapIndex]!
    shuffledItems[swapIndex] = currentItem
  }

  return shuffledItems
}

export function getLaunchStableAnswerDisplayItems<
  TItem extends AnswerDisplayShuffleItem,
>(
  items: readonly TItem[],
  bankKey: string,
  options: LaunchStableAnswerDisplayShuffleOptions = {},
): TItem[] {
  if (items.length <= 1) {
    return [...items]
  }

  const itemIds = items.map((item) => item.id)
  const cacheKey = getOrderCacheKey(bankKey, itemIds)
  const cachedOrderIds = launchOrderCache.get(cacheKey)

  if (cachedOrderIds) {
    return orderItemsByIds(items, cachedOrderIds)
  }

  const seed = options.seed ?? answerDisplayLaunchSeed
  const shuffledItems = seededShuffleAnswerDisplayItems(items, {
    bankKey,
    seed,
  })
  const shuffledIds = shuffledItems.map((item) => item.id)
  const guardedIds = applyImmediateRepeatGuard({
    bankKey,
    itemIds,
    orderIds: shuffledIds,
    seed,
    storage: options.storage ?? getBrowserLocalStorage(),
  })

  launchOrderCache.set(cacheKey, guardedIds)

  return orderItemsByIds(items, guardedIds)
}

export function clearAnswerDisplayShuffleCache() {
  launchOrderCache.clear()
}

function applyImmediateRepeatGuard(input: {
  bankKey: string
  itemIds: string[]
  orderIds: string[]
  seed: string
  storage: AnswerDisplayShuffleStorage | null
}) {
  const { bankKey, itemIds, orderIds, seed, storage } = input

  if (!storage || orderIds.length <= 1) {
    return orderIds
  }

  const storageKey = getStorageKey(bankKey, itemIds)
  const previousOrderIds = readStoredOrderIds(storage, storageKey)
  const nextOrderIds =
    previousOrderIds &&
    haveSamePublicIds(previousOrderIds, itemIds) &&
    areStringArraysEqual(previousOrderIds, orderIds)
      ? createRepeatFallbackOrder(orderIds, seed, bankKey)
      : orderIds

  writeStoredOrderIds(storage, storageKey, nextOrderIds)

  return nextOrderIds
}

function createRepeatFallbackOrder(
  orderIds: string[],
  seed: string,
  bankKey: string,
) {
  if (orderIds.length <= 1) {
    return orderIds
  }

  const offset =
    (hashString(
      ['repeat-guard', seed, bankKey, ...orderIds].join(KEY_SEPARATOR),
    ) %
      (orderIds.length - 1)) +
    1
  const rotatedIds = [
    ...orderIds.slice(offset),
    ...orderIds.slice(0, offset),
  ]

  if (!areStringArraysEqual(rotatedIds, orderIds)) {
    return rotatedIds
  }

  return [...orderIds].reverse()
}

function orderItemsByIds<TItem extends AnswerDisplayShuffleItem>(
  items: readonly TItem[],
  orderIds: string[],
) {
  const itemQueues = new Map<string, TItem[]>()

  for (const item of items) {
    const existingQueue = itemQueues.get(item.id)

    if (existingQueue) {
      existingQueue.push(item)
    } else {
      itemQueues.set(item.id, [item])
    }
  }

  const orderedItems = orderIds
    .map((id) => itemQueues.get(id)?.shift())
    .filter((item): item is TItem => Boolean(item))

  return orderedItems.length === items.length ? orderedItems : [...items]
}

function getOrderCacheKey(bankKey: string, itemIds: string[]) {
  return [
    bankKey,
    ...getCanonicalPublicIds(itemIds),
  ].join(KEY_SEPARATOR)
}

function getStorageKey(bankKey: string, itemIds: string[]) {
  const bankHash = hashString(bankKey).toString(36)
  const itemHash = hashString(
    getCanonicalPublicIds(itemIds).join(KEY_SEPARATOR),
  ).toString(36)

  return `${STORAGE_KEY_PREFIX}:${bankHash}:${itemHash}`
}

function getCanonicalPublicIds(itemIds: string[]) {
  return [...itemIds].sort((left, right) => left.localeCompare(right))
}

function haveSamePublicIds(left: string[], right: string[]) {
  return areStringArraysEqual(
    getCanonicalPublicIds(left),
    getCanonicalPublicIds(right),
  )
}

function areStringArraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  )
}

function readStoredOrderIds(
  storage: AnswerDisplayShuffleStorage,
  storageKey: string,
) {
  try {
    const storedValue = storage.getItem(storageKey)

    if (!storedValue) {
      return null
    }

    const parsedValue: unknown = JSON.parse(storedValue)

    return Array.isArray(parsedValue) &&
      parsedValue.every((item) => typeof item === 'string')
      ? parsedValue
      : null
  } catch {
    return null
  }
}

function writeStoredOrderIds(
  storage: AnswerDisplayShuffleStorage,
  storageKey: string,
  orderIds: string[],
) {
  try {
    storage.setItem(storageKey, JSON.stringify(orderIds))
  } catch {
    // Storage is a display-order hint only; unavailable storage should not block.
  }
}

function getBrowserLocalStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function createAnswerDisplayLaunchSeed() {
  if (typeof window === 'undefined') {
    return SSR_LAUNCH_SEED
  }

  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(4)
    window.crypto.getRandomValues(values)

    return Array.from(values, (value) => value.toString(36)).join('-')
  }

  return [
    'agent-trail-answer-display-browser-launch',
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
  ].join('-')
}

function createSeededRandom(seedMaterial: string) {
  let state = hashString(seedMaterial) || 0x6d2b79f5

  return () => {
    state += 0x6d2b79f5

    let result = state
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)

    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(value: string) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}
