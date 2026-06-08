import { expect, test, type Page } from '@playwright/test'
import { env } from 'node:process'
import { chapters } from '../src/entities/chapter/model/chapterCatalog'
import { getChapterArtifacts } from '../src/shared/lib/content/chapterArtifacts'
import type {
  ChapterCompletion,
  ChapterProgress,
  ChapterReflection,
  LeaderboardEntry,
  Learner,
  Mission,
  TrapConceptId,
} from '../src/shared/types/domain'
import { installBackendApiFixture } from './backendApiFixtures'

const rewardCardLearner: Learner = {
  id: 'reward-card-agent',
  nickname: 'reward-card',
  fullName: 'Reward Card Agent',
}

type BackendFixture = Awaited<ReturnType<typeof installBackendApiFixture>>

const backendFixturesByPage = new WeakMap<Page, BackendFixture>()
const seededCompletionTimestamp = '2026-05-29T10:00:00.000Z'
const qaPassBrowserEnabled = env.VITE_PROJECT_Z_QA_PASS === '1'
const qaPassE2eEnabled =
  qaPassBrowserEnabled && env.PROJECT_Z_QA_PASS === '1'

function getChapterIdByOrder(order: number) {
  const chapterId = chapters.find((chapter) => chapter.order === order)?.id

  if (!chapterId) {
    throw new Error(`Chapter order ${order} fixture not found.`)
  }

  return chapterId
}

function getChapterIdsBeforeOrder(order: number) {
  return chapters
    .filter((chapter) => chapter.order < order)
    .map((chapter) => chapter.id)
}

function createProgressState(
  input: {
    completedChapterIds?: string[]
    completedMissionIdsByChapter?: Record<string, string[]>
    openChapterId?: string | null
  } = {},
): ChapterProgress[] {
  const completedChapterIds = new Set(input.completedChapterIds ?? [])
  const openChapterId =
    input.openChapterId === undefined
      ? getChapterIdByOrder(1)
      : input.openChapterId

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

test.beforeEach(async ({ page }) => {
  const fixture = await installBackendApiFixture(page)
  backendFixturesByPage.set(page, fixture)
})

async function enterGame(page: Page) {
  await page.goto('/?qa=1')

  await page.getByLabel('Позывной').fill('boss-agent')
  await page.getByLabel('Имя и фамилия').fill('Boss Agent')
  await page.getByRole('button', { name: 'Войти на карту' }).click()
  await expect(page).toHaveURL(/\/map$/)
}

async function openChapterOneBoss(page: Page) {
  await enterGame(page)
  await writeBackendFixtureState(page, {
    learner: getBackendFixtureLearner(page),
    progress: getChapterOneMissionProgress(getChapterOneMissionIdsBeforeBoss()),
  })
  await page.goto('/chapters/chapter-1/missions/ship-or-stop?qa=1')

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Финальный бой за пул-реквест',
    }),
  ).toBeVisible()
}

async function seedBackendFixtureState(
  page: Page,
  input: {
    completions?: ChapterCompletion[]
    chapterReflections?: ChapterReflection[]
    encounteredTrapIds?: TrapConceptId[]
    learner?: Learner
    pendingUnlockChapterId?: string | null
    progress: ChapterProgress[]
  },
) {
  return setBackendFixtureState(page, input)
}

function getChapterOneMissionProgress(
  completedMissionIds: string[],
): ChapterProgress[] {
  return createProgressState({
    completedMissionIdsByChapter: {
      'chapter-1': completedMissionIds,
    },
    openChapterId: 'chapter-1',
  })
}

function getChapterOneReviewableProgress(): ChapterProgress[] {
  return getChapterOneMissionProgress(['who-owns-the-diff'])
}

function getChapterOneMissionIdsBeforeBoss() {
  return (
    chapters.find((chapter) => chapter.id === 'chapter-1')?.missions.map(
      (mission) => mission.id,
    ) ?? []
  )
}

function getChapterOneCompletedProgress(): ChapterProgress[] {
  return createProgressState({
    completedChapterIds: ['chapter-1'],
    completedMissionIdsByChapter: {
      'chapter-1': [...getChapterOneMissionIdsBeforeBoss(), 'ship-or-stop'],
    },
    openChapterId: 'chapter-2',
  })
}

function getBackendFixtureLearner(page: Page) {
  return backendFixturesByPage.get(page)?.state.learner ?? rewardCardLearner
}

function expectQaPassRequestWithoutAnswer(page: Page, missionId: string) {
  const request = backendFixturesByPage
    .get(page)
    ?.requests.find(
      (item) =>
        item.method === 'POST' &&
        item.path === `/api/missions/${missionId}/qa-pass`,
    )

  expect(request).toBeDefined()

  if (!request) {
    throw new Error(`QA PASS request for ${missionId} was not captured.`)
  }

  expect(request.body).not.toHaveProperty('answer')
}

async function writeBackendFixtureState(
  page: Page,
  input: {
    chapterReflections?: ChapterReflection[]
    completions?: ChapterCompletion[]
    encounteredTrapIds?: TrapConceptId[]
    learner?: Learner
    pendingUnlockChapterId?: string | null
    progress: ChapterProgress[]
  },
) {
  return setBackendFixtureState(page, input)
}

async function setBackendFixtureState(
  page: Page,
  input: {
    chapterReflections?: ChapterReflection[]
    completions?: ChapterCompletion[]
    encounteredTrapIds?: TrapConceptId[]
    learner?: Learner
    pendingUnlockChapterId?: string | null
    progress: ChapterProgress[]
  },
) {
  const learner = input.learner ?? rewardCardLearner
  const fixture =
    backendFixturesByPage.get(page) ??
    (await installBackendApiFixture(page, { learner }))
  const completions =
    input.completions ?? createCompletionsFromProgress(learner, input.progress)

  fixture.state.learner = learner
  fixture.state.progress = input.progress
  fixture.state.completions = completions
  fixture.state.encounteredTrapIds = input.encounteredTrapIds ?? []
  fixture.state.reflections = input.chapterReflections ?? []
  fixture.state.pendingUnlockChapterId = input.pendingUnlockChapterId ?? null
  backendFixturesByPage.set(page, fixture)

  return fixture
}

function createCompletionsFromProgress(
  learner: Learner,
  progress: ChapterProgress[],
) {
  let completedChapters = 0

  return chapters.reduce<ChapterCompletion[]>((completions, chapter) => {
    const chapterProgress = progress.find((item) => item.chapterId === chapter.id)

    if (chapterProgress?.status !== 'completed') {
      return completions
    }

    completedChapters += 1
    completions.push({
      chapterId: chapter.id,
      completedAt: seededCompletionTimestamp,
      completedChapters,
      learnerId: learner.id,
    })

    return completions
  }, [])
}

async function seedCompletedCourse(
  page: Page,
  input: {
    chapterReflections?: ChapterReflection[]
    encounteredTrapIds?: TrapConceptId[]
    learner?: Learner
  } = {},
) {
  return seedBackendFixtureState(page, {
    chapterReflections: input.chapterReflections,
    encounteredTrapIds: input.encounteredTrapIds,
    learner: input.learner,
    progress: createProgressState({
      completedChapterIds: chapters.map((chapter) => chapter.id),
      openChapterId: null,
    }),
  })
}

function getChapterTwoCompletedProgress(): ChapterProgress[] {
  return createProgressState({
    completedChapterIds: getChapterIdsBeforeOrder(3),
    openChapterId: getChapterIdByOrder(3),
  })
}

function getChapterThreeBossReadyProgress(): ChapterProgress[] {
  return chapters.map((chapter) => ({
    chapterId: chapter.id,
    completedMissionIds:
      chapter.id === 'chapter-3'
        ? chapter.missions.map((mission) => mission.id)
        : [],
    status:
      chapter.order < 3
        ? 'completed'
        : chapter.order === 3
          ? 'open'
          : 'locked',
  }))
}

function getChapterFourInventoryReadyProgress(): ChapterProgress[] {
  return chapters.map((chapter) => ({
    chapterId: chapter.id,
    completedMissionIds:
      chapter.id === 'chapter-4'
        ? ['context-before-prompt', 'agents-md-core', 'pick-context-examples']
        : [],
    status:
      chapter.order < 4
        ? 'completed'
        : chapter.order === 4
          ? 'open'
          : 'locked',
  }))
}

function getRulesSkillsMissionProgress(
  completedMissionIds: string[] = [],
): ChapterProgress[] {
  return createProgressState({
    completedChapterIds: getChapterIdsBeforeOrder(5),
    completedMissionIdsByChapter: {
      'chapter-5': completedMissionIds,
    },
    openChapterId: 'chapter-5',
  })
}

function getRulesSkillsBossReadyProgress(): ChapterProgress[] {
  return getRulesSkillsMissionProgress([
    'knowledge-carrier-match',
    'rule-scope-gate',
    'skill-draft-order',
    'instruction-drift-fix',
  ])
}

function getChapterSixCompletedProgress(): ChapterProgress[] {
  return createProgressState({
    completedChapterIds: chapters
      .filter((chapter) => chapter.order <= 7)
      .map((chapter) => chapter.id),
    openChapterId: getChapterIdByOrder(8),
  })
}

function getChapterEightPromptAssemblyProgress(): ChapterProgress[] {
  return createProgressState({
    completedChapterIds: getChapterIdsBeforeOrder(8),
    completedMissionIdsByChapter: {
      'chapter-8': ['playbook-candidate', 'playbook-anatomy'],
    },
    openChapterId: 'chapter-8',
  })
}

function getChapterSixBossReadyProgress(): ChapterProgress[] {
  return createProgressState({
    completedChapterIds: getChapterIdsBeforeOrder(6),
    completedMissionIdsByChapter: {
      'chapter-6': [
        'choose-work-mode',
        'context-budget-loadout',
        'stop-blind-retry',
        'token-checklist-order',
      ],
    },
    openChapterId: 'chapter-6',
  })
}

function getChapterSixOpenProgress(): ChapterProgress[] {
  return createProgressState({
    completedChapterIds: getChapterIdsBeforeOrder(6),
    openChapterId: getChapterIdByOrder(6),
  })
}

function getChapterSevenBossReadyProgress(): ChapterProgress[] {
  return createProgressState({
    completedChapterIds: getChapterIdsBeforeOrder(7),
    completedMissionIdsByChapter: {
      'chapter-7': [
        'evidence-before-review',
        'verification-matrix-builder',
        'observable-checks',
        'reviewer-note-order',
      ],
    },
    openChapterId: 'chapter-7',
  })
}

function getChapterEightBossReadyProgress(): ChapterProgress[] {
  return createProgressState({
    completedChapterIds: getChapterIdsBeforeOrder(8),
    completedMissionIdsByChapter: {
      'chapter-8': [
        'playbook-candidate',
        'playbook-anatomy',
        'prompt-skeleton-assembly',
        'clinic-to-playbook',
      ],
    },
    openChapterId: 'chapter-8',
  })
}

async function seedChapterTwoCompleted(page: Page) {
  return seedBackendFixtureState(page, {
    completions: [
      {
        learnerId: rewardCardLearner.id,
        chapterId: 'chapter-1',
        completedChapters: 1,
        completedAt: '2026-05-29T10:00:00.000Z',
      },
      {
        learnerId: rewardCardLearner.id,
        chapterId: 'chapter-2',
        completedChapters: 2,
        completedAt: '2026-05-29T10:30:00.000Z',
      },
    ],
    progress: getChapterTwoCompletedProgress(),
  })
}

async function seedChapterOneReviewableMission(
  page: Page,
  encounteredTrapIds: TrapConceptId[] = [],
) {
  return seedBackendFixtureState(page, {
    encounteredTrapIds,
    progress: getChapterOneReviewableProgress(),
  })
}

async function expectBadgeLayoutToFit(page: Page) {
  const layoutMetrics = await page.evaluate(() => {
    const toRect = (selector: string) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect()

      return rect
        ? {
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            top: rect.top,
          }
        : null
    }

    const frame = toRect('.badge-screen')
    const layout = toRect('.badge-layout')
    const actions = toRect('.badge-actions')
    const mastery = toRect('.badge-mastery')
    const recap = toRect('.chapter-recap-card')
    const reflection = toRect('.reflection-card')
    const toolbar = toRect('.artifact-toolbar')
    const preview = toRect('.artifact-preview')

    return {
      actions,
      frame,
      layout,
      mastery,
      pageOverflowX: document.documentElement.scrollWidth - window.innerWidth,
      preview,
      recap,
      reflection,
      toolbar,
    }
  })

  expect(layoutMetrics.frame).not.toBeNull()
  expect(layoutMetrics.layout).not.toBeNull()
  expect(layoutMetrics.actions).not.toBeNull()
  expect(layoutMetrics.mastery).not.toBeNull()
  expect(layoutMetrics.recap).not.toBeNull()
  expect(layoutMetrics.toolbar).not.toBeNull()
  expect(layoutMetrics.preview).not.toBeNull()
  expect(layoutMetrics.reflection).not.toBeNull()

  if (
    !layoutMetrics.frame ||
    !layoutMetrics.layout ||
    !layoutMetrics.actions ||
    !layoutMetrics.mastery ||
    !layoutMetrics.recap ||
    !layoutMetrics.toolbar ||
    !layoutMetrics.preview ||
    !layoutMetrics.reflection
  ) {
    return
  }

  expect(layoutMetrics.layout.top).toBeGreaterThanOrEqual(
    layoutMetrics.frame.top - 1,
  )
  expect(layoutMetrics.layout.left).toBeGreaterThanOrEqual(
    layoutMetrics.frame.left - 1,
  )
  expect(layoutMetrics.layout.right).toBeLessThanOrEqual(
    layoutMetrics.frame.right + 1,
  )
  expect(layoutMetrics.layout.bottom).toBeLessThanOrEqual(
    layoutMetrics.frame.bottom + 1,
  )
  expect(layoutMetrics.actions.bottom).toBeLessThanOrEqual(
    layoutMetrics.frame.bottom + 1,
  )
  expect(layoutMetrics.mastery.left).toBeGreaterThanOrEqual(
    layoutMetrics.frame.left - 1,
  )
  expect(layoutMetrics.mastery.right).toBeLessThanOrEqual(
    layoutMetrics.frame.right + 1,
  )
  expect(layoutMetrics.recap.top).toBeGreaterThanOrEqual(
    layoutMetrics.frame.top - 1,
  )
  expect(layoutMetrics.recap.right).toBeLessThanOrEqual(
    layoutMetrics.frame.right + 1,
  )
  expect(layoutMetrics.reflection.right).toBeLessThanOrEqual(
    layoutMetrics.frame.right + 1,
  )
  expect(layoutMetrics.toolbar.right).toBeLessThanOrEqual(
    layoutMetrics.frame.right + 1,
  )
  expect(layoutMetrics.preview.bottom).toBeLessThanOrEqual(
    layoutMetrics.frame.bottom + 1,
  )
  expect(layoutMetrics.preview.bottom - layoutMetrics.preview.top).toBeGreaterThanOrEqual(
    70,
  )
  expect(layoutMetrics.pageOverflowX).toBeLessThanOrEqual(1)
}

async function expectChapterSideStageToFit(page: Page) {
  const layoutMetrics = await page.evaluate(() => {
    const toRect = (selector: string) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect()

      return rect
        ? {
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            top: rect.top,
          }
        : null
    }
    const overlapArea = (
      first: NonNullable<ReturnType<typeof toRect>>,
      second: NonNullable<ReturnType<typeof toRect>>,
    ) => {
      const overlapX = Math.max(
        0,
        Math.min(first.right, second.right) - Math.max(first.left, second.left),
      )
      const overlapY = Math.max(
        0,
        Math.min(first.bottom, second.bottom) -
          Math.max(first.top, second.top),
      )

      return overlapX * overlapY
    }

    const card = toRect('.chapter-card')
    const frame = toRect('.chapter-screen')
    const mentor = toRect('.mentor-dialog')
    const sideStage = toRect('.chapter-side-stage')

    return {
      card,
      frame,
      mentor,
      pageOverflowX: document.documentElement.scrollWidth - window.innerWidth,
      sideCardOverlap:
        sideStage && card ? overlapArea(sideStage, card) : null,
      sideMentorOverlap:
        sideStage && mentor ? overlapArea(sideStage, mentor) : null,
      sideStage,
    }
  })

  expect(layoutMetrics.frame).not.toBeNull()
  expect(layoutMetrics.card).not.toBeNull()
  expect(layoutMetrics.mentor).not.toBeNull()
  expect(layoutMetrics.sideStage).not.toBeNull()

  if (
    !layoutMetrics.frame ||
    !layoutMetrics.card ||
    !layoutMetrics.mentor ||
    !layoutMetrics.sideStage ||
    layoutMetrics.sideCardOverlap === null ||
    layoutMetrics.sideMentorOverlap === null
  ) {
    return
  }

  expect(layoutMetrics.sideStage.top).toBeGreaterThanOrEqual(
    layoutMetrics.frame.top - 1,
  )
  expect(layoutMetrics.sideStage.left).toBeGreaterThanOrEqual(
    layoutMetrics.frame.left - 1,
  )
  expect(layoutMetrics.sideStage.right).toBeLessThanOrEqual(
    layoutMetrics.frame.right + 1,
  )
  expect(layoutMetrics.sideStage.bottom).toBeLessThanOrEqual(
    layoutMetrics.frame.bottom + 1,
  )
  expect(layoutMetrics.sideCardOverlap).toBeLessThanOrEqual(1)
  expect(layoutMetrics.sideMentorOverlap).toBeLessThanOrEqual(1)
  expect(layoutMetrics.pageOverflowX).toBeLessThanOrEqual(1)
}

async function expectPrepCarouselLayoutToFit(page: Page) {
  const layoutMetrics = await page.evaluate(() => {
    const toRect = (selector: string) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect()

      return rect
        ? {
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            top: rect.top,
          }
        : null
    }
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('.prep-instruction-card'),
    )
    const activeCard = document.querySelector<HTMLElement>(
      '.prep-instruction-card-active',
    )
    const viewport = document.querySelector<HTMLElement>(
      '.prep-instruction-viewport',
    )
    const viewportRect = viewport?.getBoundingClientRect()
    const nextCardRect = activeCard?.nextElementSibling?.getBoundingClientRect()
    const nextCardPeek =
      viewportRect && nextCardRect
        ? Math.max(
            0,
            Math.min(nextCardRect.right, viewportRect.right) -
              Math.max(nextCardRect.left, viewportRect.left),
          )
        : 0
    const actionButtons = Array.from(
      document.querySelectorAll<HTMLElement>('.prep-actions .pixel-button'),
    )

    return {
      actions: toRect('.prep-actions'),
      actionButtonMaxHeight: Math.max(
        ...actionButtons.map((button) => button.getBoundingClientRect().height),
      ),
      activeCard: toRect('.prep-instruction-card-active'),
      frame: toRect('.prep-screen'),
      hasScrollableTrack:
        (document.querySelector('.prep-instruction-viewport')?.scrollWidth ?? 0) >
        (document.querySelector('.prep-instruction-viewport')?.clientWidth ?? 0) +
          1,
      layout: toRect('.prep-layout'),
      nextCardPeek,
      pageOverflowX: document.documentElement.scrollWidth - window.innerWidth,
      viewport: toRect('.prep-instruction-viewport'),
      cardVerticalOverflow: cards.some(
        (card) => card.scrollHeight > card.clientHeight + 1,
      ),
      cardVerticalScroll: cards.some((card) =>
        ['auto', 'scroll'].includes(getComputedStyle(card).overflowY),
      ),
      isLastCardActive: activeCard === cards.at(-1),
      scrollbarWidth: viewport ? getComputedStyle(viewport).scrollbarWidth : '',
    }
  })

  expect(layoutMetrics.frame).not.toBeNull()
  expect(layoutMetrics.layout).not.toBeNull()
  expect(layoutMetrics.actions).not.toBeNull()
  expect(layoutMetrics.viewport).not.toBeNull()
  expect(layoutMetrics.activeCard).not.toBeNull()

  if (
    !layoutMetrics.frame ||
    !layoutMetrics.layout ||
    !layoutMetrics.actions ||
    !layoutMetrics.viewport ||
    !layoutMetrics.activeCard
  ) {
    return
  }

  expect(layoutMetrics.layout.left).toBeGreaterThanOrEqual(
    layoutMetrics.frame.left - 1,
  )
  expect(layoutMetrics.layout.right).toBeLessThanOrEqual(
    layoutMetrics.frame.right + 1,
  )
  expect(layoutMetrics.layout.bottom).toBeLessThanOrEqual(
    layoutMetrics.frame.bottom + 1,
  )
  expect(layoutMetrics.actions.bottom).toBeLessThanOrEqual(
    layoutMetrics.frame.bottom + 1,
  )
  expect(layoutMetrics.actionButtonMaxHeight).toBeLessThanOrEqual(72)
  expect(layoutMetrics.activeCard.left).toBeGreaterThanOrEqual(
    layoutMetrics.viewport.left - 1,
  )
  expect(layoutMetrics.activeCard.right).toBeLessThanOrEqual(
    layoutMetrics.viewport.right + 1,
  )
  expect(layoutMetrics.hasScrollableTrack).toBe(true)
  expect(layoutMetrics.scrollbarWidth).toBe('none')
  if (!layoutMetrics.isLastCardActive) {
    expect(layoutMetrics.nextCardPeek).toBeGreaterThan(16)
    expect(layoutMetrics.nextCardPeek).toBeLessThanOrEqual(96)
  }
  expect(layoutMetrics.cardVerticalOverflow).toBe(false)
  expect(layoutMetrics.cardVerticalScroll).toBe(false)
  expect(layoutMetrics.pageOverflowX).toBeLessThanOrEqual(1)
}

async function expectChapterRecap(
  page: Page,
  input: {
    nextMove: RegExp | string
    ruleCount?: number
    trapLabel: string
  },
) {
  const recap = page.locator('.chapter-recap-card')

  await expect(recap).toBeVisible()
  await expect(
    recap.getByRole('heading', { name: 'Короткий итог главы' }),
  ).toBeVisible()
  await expect(recap).toContainText('Что забрать')
  await expect(recap).toContainText('Частая ловушка')
  await expect(recap).toContainText('Завтра')
  await expect(recap.locator('li')).toHaveCount(input.ruleCount ?? 3)
  await expect(recap).toContainText(input.trapLabel)
  await expect(recap).toContainText(input.nextMove)
}

async function expectBadgeMastery(
  page: Page,
  input: {
    actions: string[]
  },
) {
  const mastery = page.getByLabel('Ты теперь умеешь')

  await expect(mastery).toBeVisible()
  await expect(mastery).toContainText('Kilian фиксирует навык')
  await expect(
    mastery.getByRole('heading', { name: 'Ты теперь умеешь' }),
  ).toBeVisible()
  await expect(mastery.locator('li')).toHaveCount(input.actions.length)

  for (const action of input.actions) {
    await expect(mastery).toContainText(action)
  }
}

async function expectMentorTakeaway(
  page: Page,
  input: {
    state: 'boss' | 'review' | 'success' | 'trap'
    text: RegExp | string
  },
) {
  const takeaway = page.getByLabel('Короткий итог от Kilian')

  await expect(takeaway).toBeVisible()
  await expect(takeaway).toContainText(input.text)
  await expect(takeaway).toHaveClass(
    new RegExp(`\\bmentor-takeaway-${input.state}\\b`),
  )
  await expect(page.locator(`.mission-mentor-robot-${input.state}`)).toBeVisible()

  const bounds = await page.evaluate(() => {
    const feedback = document
      .querySelector('.mission-feedback')
      ?.getBoundingClientRect()
    const takeawayRect = document
      .querySelector('.mentor-takeaway')
      ?.getBoundingClientRect()

    return {
      feedbackBottom: feedback?.bottom ?? 0,
      feedbackLeft: feedback?.left ?? 0,
      feedbackRight: feedback?.right ?? 0,
      feedbackTop: feedback?.top ?? 0,
      takeawayBottom: takeawayRect?.bottom ?? 0,
      takeawayLeft: takeawayRect?.left ?? 0,
      takeawayRight: takeawayRect?.right ?? 0,
      takeawayTop: takeawayRect?.top ?? 0,
    }
  })

  expect(bounds.takeawayLeft).toBeGreaterThanOrEqual(bounds.feedbackLeft - 1)
  expect(bounds.takeawayRight).toBeLessThanOrEqual(bounds.feedbackRight + 1)
  expect(bounds.takeawayTop).toBeGreaterThanOrEqual(bounds.feedbackTop - 1)
  expect(bounds.takeawayBottom).toBeLessThanOrEqual(bounds.feedbackBottom + 1)
}

async function openChapterEightPromptAssembly(page: Page) {
  await writeBackendFixtureState(page, {
    progress: getChapterEightPromptAssemblyProgress(),
  })
  await page.goto('/chapters/chapter-8/missions/prompt-skeleton-assembly?qa=1')
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Собрать prompt-контракт',
    }),
  ).toBeVisible()
  const briefingDialog = page.getByRole('dialog', {
    name: 'Бриф prompt-контракта',
  })

  await expect(briefingDialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(briefingDialog).toHaveCount(0)
}

async function placePromptFragment(
  page: Page,
  slotLabel: string,
  fragmentName: RegExp,
) {
  const slotChip = page.locator('.prompt-contract-slot-main').filter({
    hasText: slotLabel,
  })

  await expect(slotChip).toHaveCount(1)
  await slotChip.click()
  await clickPromptFragmentByName(page, fragmentName)
}

async function clickPromptFragmentByName(page: Page, fragmentName: RegExp) {
  const fragmentButton = page.locator('.prompt-fragment-card-main').filter({
    hasText: fragmentName,
  })
  const matchCount = await fragmentButton.count()

  if (matchCount > 0) {
    await fragmentButton.first().click()
    return
  }

  throw new Error(`Prompt fragment not found: ${fragmentName}`)
}

async function assembleCorrectPromptContract(page: Page) {
  await placePromptFragment(
    page,
    'Цель',
    /Один e2e-сценарий про видимое поведение/,
  )
  await placePromptFragment(page, 'Контекст', /Бриф, ближайший spec/)
  await placePromptFragment(
    page,
    'Границы',
    /Один поток и ближайшие файлы теста/,
  )
  await placePromptFragment(
    page,
    'Запреты',
    /Не трогать соседние сценарии/,
  )
  await placePromptFragment(page, 'Критерии', /Тест ловит регресс/)
  await placePromptFragment(
    page,
    'Проверка',
    /Назвать команду или ручной сценарий проверки/,
  )
  await placePromptFragment(
    page,
    'План до правок',
    /Сначала план, файлы, риски и подтверждение/,
  )
}

async function assignPairTarget(
  page: Page,
  itemName: RegExp | string,
  targetName: string,
) {
  const itemButton = page.locator('.pair-item-main').filter({ hasText: itemName })
  const targetButton = page
    .locator('.pair-target-main')
    .filter({
      has: page.locator('strong').filter({
        hasText: new RegExp(`^${escapeRegExp(targetName)}$`),
      }),
    })

  await expect(itemButton).toHaveCount(1)
  await itemButton.click()
  await expect(targetButton).toHaveCount(1)
  await targetButton.click()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function completeCarrierPairMatching(page: Page) {
  await assignPairTarget(
    page,
    /Секреты, персональные данные|Никогда не отправлять секреты/,
    'Always-on rule',
  )
  await assignPairTarget(
    page,
    /Failed-answer feedback|failed feedback не показывать/,
    'Scoped rule',
  )
  await assignPairTarget(
    page,
    /Проверить gameplay UI|Gameplay UI QA/,
    'Skill',
  )
  await assignPairTarget(
    page,
    /Добавить новую миссию|Добавление новой миссии/,
    'Playbook',
  )
  await assignPairTarget(
    page,
    /Acceptance criterion|Критерий готовности/,
    'Task brief',
  )
  await assignPairTarget(
    page,
    /Один автор однажды|Личная фраза/,
    'Discard',
  )
}

function collectRetryPrincipleTargets() {
  const targets: {
    chapterTitle: string
    id: string
    mission: Mission
    title: string
  }[] = []

  for (const chapter of chapters) {
    for (const mission of chapter.missions) {
      targets.push({
        chapterTitle: chapter.title,
        id: mission.id,
        mission,
        title: mission.title,
      })
    }

    targets.push({
      chapterTitle: chapter.title,
      id: chapter.boss.id,
      mission: chapter.boss,
      title: chapter.boss.title,
    })

    if (chapter.boss.kind === 'boss-fight') {
      for (const round of chapter.boss.rounds) {
        targets.push({
          chapterTitle: chapter.title,
          id: round.id,
          mission: round,
          title: round.title,
        })
      }
    }
  }

  return targets
}

test('has authored non-leaking retry principles for every playable failure scene', () => {
  const targets = collectRetryPrincipleTargets()
  const missingRetryPrinciples = targets
    .filter((target) => !target.mission.retryPrinciple?.trim())
    .map((target) => `${target.chapterTitle}: ${target.id}`)
  const retryPrinciples = targets.map(
    (target) => target.mission.retryPrinciple ?? '',
  )
  const duplicateRetryPrinciples = retryPrinciples.filter(
    (principle, index) => retryPrinciples.indexOf(principle) !== index,
  )
  const bannedFragments = [
    'placeholder',
    'try again',
    'TODO',
    'а нужен шаг',
    'выбери все',
    'не хватает шага',
    'подумай о цели и проверке',
    'попробуй ещё',
    'правильный ответ',
    'точный порядок',
  ]
  const leakingOrFillerPrinciples = targets
    .filter((target) =>
      bannedFragments.some((fragment) =>
        target.mission.retryPrinciple
          ?.toLocaleLowerCase('ru-RU')
          .includes(fragment.toLocaleLowerCase('ru-RU')),
      ),
    )
    .map((target) => `${target.chapterTitle}: ${target.id}`)

  const expectedTargetCount = chapters.reduce(
    (count, chapter) =>
      count +
      chapter.missions.length +
      1 +
      (chapter.boss.kind === 'boss-fight' ? chapter.boss.rounds.length : 0),
    0,
  )

  expect(targets).toHaveLength(expectedTargetCount)
  expect(missingRetryPrinciples).toEqual([])
  expect(duplicateRetryPrinciples).toEqual([])
  expect(leakingOrFillerPrinciples).toEqual([])
})

test('has authored badge mastery actions for every completed reward', () => {
  const bannedFragments = [
    'placeholder',
    'TODO',
    'сделай нормально',
    'попробуй',
    'подумай',
    'работать с ИИ',
  ]
  const missingOrWrongCount = chapters
    .filter(
      (chapter) =>
        chapter.reward.masteryActions.length < 2 ||
        chapter.reward.masteryActions.length > 3,
    )
    .map((chapter) => chapter.title)
  const duplicateActions = chapters
    .flatMap((chapter) => chapter.reward.masteryActions)
    .filter((action, index, actions) => actions.indexOf(action) !== index)
  const tooLongActions = chapters
    .flatMap((chapter) =>
      chapter.reward.masteryActions.map((action) => ({
        action,
        chapterTitle: chapter.title,
      })),
    )
    .filter(({ action }) => action.length > 72)
    .map(({ action, chapterTitle }) => `${chapterTitle}: ${action}`)
  const fillerActions = chapters
    .flatMap((chapter) =>
      chapter.reward.masteryActions.map((action) => ({
        action,
        chapterTitle: chapter.title,
      })),
    )
    .filter(({ action }) =>
      bannedFragments.some((fragment) =>
        action
          .toLocaleLowerCase('ru-RU')
          .includes(fragment.toLocaleLowerCase('ru-RU')),
      ),
    )
    .map(({ action, chapterTitle }) => `${chapterTitle}: ${action}`)

  expect(missingOrWrongCount).toEqual([])
  expect(duplicateActions).toEqual([])
  expect(tooLongActions).toEqual([])
  expect(fillerActions).toEqual([])
})

test('opens the identity screen', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Agent Trail' }),
  ).toBeVisible()
  await expect(page.getByLabel('Позывной')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Войти на карту' })).toBeVisible()
})

test.describe('QA PASS default runtime', () => {
  test.skip(
    qaPassBrowserEnabled,
    'QA-pass browser build intentionally renders QA PASS.',
  )

  test('hides QA PASS on mission scenes even with QA navigation shortcut', async ({
    page,
  }) => {
    await writeBackendFixtureState(page, {
      progress: getChapterOneMissionProgress([]),
    })
    await page.goto('/chapters/chapter-1/missions/who-owns-the-diff?qa=1')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Кто автор изменений?' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'QA PASS' })).toHaveCount(0)
  })
})

test.describe('QA PASS enabled runtime', () => {
  test.skip(
    !qaPassE2eEnabled,
    'Set VITE_PROJECT_Z_QA_PASS=1 and PROJECT_Z_QA_PASS=1 for QA PASS e2e.',
  )

  test('clicks QA PASS through a regular mission without browser-side answer keys', async ({
    page,
  }) => {
    await writeBackendFixtureState(page, {
      progress: getChapterOneMissionProgress([]),
    })
    await page.goto('/chapters/chapter-1/missions/who-owns-the-diff')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Кто автор изменений?' }),
    ).toBeVisible()

    const qaPassButton = page.getByRole('button', { name: 'QA PASS' })

    await expect(qaPassButton).toBeVisible()
    await qaPassButton.click()
    await expect(
      page.getByRole('heading', { name: 'Сцена зачтена' }),
    ).toBeVisible()
    await expect(qaPassButton).toBeDisabled()
    expectQaPassRequestWithoutAnswer(page, 'who-owns-the-diff')
    expect(
      backendFixturesByPage
        .get(page)
        ?.state.progress.find((item) => item.chapterId === 'chapter-1')
        ?.completedMissionIds,
    ).toContain('who-owns-the-diff')
  })

  test('clicks QA PASS through a boss mission without browser-side answer keys', async ({
    page,
  }) => {
    await writeBackendFixtureState(page, {
      progress: getChapterOneMissionProgress(getChapterOneMissionIdsBeforeBoss()),
    })
    await page.goto('/chapters/chapter-1/missions/ship-or-stop')

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Финальный бой за пул-реквест',
      }),
    ).toBeVisible()

    const qaPassButton = page.getByRole('button', { name: 'QA PASS' })

    await expect(qaPassButton).toBeVisible()
    await qaPassButton.click()
    await expect(
      page.getByRole('heading', { name: 'Босс повержен' }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Забрать награду' }),
    ).toBeVisible()
    expectQaPassRequestWithoutAnswer(page, 'ship-or-stop')

    const chapterProgress = backendFixturesByPage
      .get(page)
      ?.state.progress.find((item) => item.chapterId === 'chapter-1')

    expect(chapterProgress?.status).toBe('completed')
    expect(chapterProgress?.completedMissionIds).toContain('ship-or-stop')
  })
})

test('keeps the normal map flow for a fresh learner without resume progress', async ({
  page,
}) => {
  await enterGame(page)

  await expect(page).toHaveURL(/\/map$/)
  await expect(
    page.getByRole('heading', { name: 'Карта практик ИИ-разработки' }),
  ).toBeVisible()
  await expect(page.getByLabel('Продолжить маршрут')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: /Глава 1: ИИ как инженерный инструмент/ }),
  ).toBeEnabled()
})

test('places the map robot near the chapter used to return to the map', async ({
  page,
}) => {
  await seedBackendFixtureState(page, {
    progress: getChapterSixOpenProgress(),
  })

  await page.goto('/map?qa=1')
  await expect(page.getByLabel('Робот-игрок у главы 6')).toBeVisible()

  await page.goto('/chapters/chapter-2?qa=1')
  await page.getByRole('link', { name: 'Назад на карту' }).click()

  await expect(page).toHaveURL(/\/map$/)
  await expect(page.getByLabel('Робот-игрок у главы 2')).toBeVisible()
  await expect(page.locator('.chapter-ribbon')).toContainText('Глава 02')
  await expect(page.locator('.map-node-current .node-number')).toHaveText('6')
})

test('shows a resume cue for the next unfinished scene after reload', async ({
  page,
}) => {
  await writeBackendFixtureState(page, {
    progress: getChapterOneReviewableProgress(),
  })
  await page.goto('/')

  await expect(page).toHaveURL(/\/map$/)
  const resumeCue = page.getByLabel('Продолжить маршрут')

  await expect(resumeCue).toBeVisible()
  await expect(resumeCue).toContainText('Возврат в маршрут')
  await expect(resumeCue).toContainText('Продолжить: Сцена 1.2')
  await expect(resumeCue).toContainText('Готово ли это к ревью?')
  await expect(resumeCue).toContainText(
    /Ты отвечаешь за каждое существенное изменение/,
  )

  const resumeLink = resumeCue.getByRole('link', {
    name: 'Продолжить сцену',
  })

  await expect(resumeLink).toHaveAttribute(
    'href',
    /\/chapters\/chapter-1\/missions\/reviewable-or-not$/,
  )
  await resumeLink.click()
  await expect(page).toHaveURL(
    /\/chapters\/chapter-1\/missions\/reviewable-or-not$/,
  )
  await expect(
    page.getByRole('heading', { level: 1, name: 'Готово ли это к ревью?' }),
  ).toBeVisible()
})

test('routes completed-course resume to the final closeout', async ({
  page,
}) => {
  await seedCompletedCourse(page)
  await page.goto('/map?qa=1')

  const resumeCue = page.getByLabel('Продолжить маршрут')

  await expect(resumeCue).toBeVisible()
  await expect(resumeCue).toContainText('Маршрут закрыт')
  await expect(resumeCue).toContainText(
    `Закрыто ${chapters.length}/${chapters.length}`,
  )
  await expect(resumeCue).toContainText('Все главы пройдены')

  const resumeLink = resumeCue.getByRole('link', { name: 'Открыть архив' })
  const href = await resumeLink.getAttribute('href')

  expect(href).toMatch(/\/course\/complete\?qa=1$/)
  expect(href).not.toContain('/missions/')

  await resumeLink.click()
  await expect(page).toHaveURL(/\/course\/complete\?qa=1$/)
  await expect(
    page.getByRole('heading', {
      exact: true,
      level: 1,
      name: 'Архив глав',
    }),
  ).toBeVisible()
})

test('celebrates completed map chapters without conflicting with unlock cues', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seedBackendFixtureState(page, {
    pendingUnlockChapterId: 'chapter-3',
    progress: getChapterTwoCompletedProgress(),
  })
  await page.goto('/map?qa=1')

  await expect(page.locator('.map-landmark-completed')).toHaveCount(2)
  await expect(page.locator('.map-node-completed')).toHaveCount(2)
  await expect(page.locator('.map-node-open')).toHaveCount(1)
  await expect(page.locator('.map-node-locked')).toHaveCount(5)
  await expect(page.locator('.route-completed-line polyline')).toHaveAttribute(
    'points',
    '14,68 27,48',
  )
  await expect(page.locator('.route-line polyline')).toHaveAttribute(
    'points',
    '27,48 40,61 53,39 65,54 77,38 87,55 94,29',
  )
  await expect(page.locator('.route-unlock-line')).toBeVisible()
  await expect(page.locator('.map-node-unlock-reveal')).toHaveCount(1)
  await expect(
    page.getByRole('button', {
      name: /Глава 3: Работа от плана.*Новый узел открыт/,
    }),
  ).toBeEnabled()

  const mapMetrics = await page.evaluate(() => {
    const getRect = (element: Element) => {
      const rect = element.getBoundingClientRect()

      return {
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        top: rect.top,
      }
    }
    const completedLandmarks = [
      ...document.querySelectorAll('.map-landmark-completed'),
    ].map(getRect)
    const nodes = [...document.querySelectorAll('.map-node')].map(getRect)
    const completedLandmarkNodeOverlaps = completedLandmarks.filter(
      (landmark) =>
        nodes.some((node) => {
          const overlapX = Math.max(
            0,
            Math.min(landmark.right, node.right) -
              Math.max(landmark.left, node.left),
          )
          const overlapY = Math.max(
            0,
            Math.min(landmark.bottom, node.bottom) -
              Math.max(landmark.top, node.top),
          )

          return overlapX * overlapY > 0
        }),
    ).length

    return {
      completedLandmarkNodeOverlaps,
      pageOverflowX: document.documentElement.scrollWidth - window.innerWidth,
    }
  })

  expect(mapMetrics.completedLandmarkNodeOverlaps).toBe(0)
  expect(mapMetrics.pageOverflowX).toBeLessThanOrEqual(1)
})

test('does not repeat the fresh unlock cue after reload during the reveal window', async ({
  page,
}) => {
  const fixture = await seedBackendFixtureState(page, {
    pendingUnlockChapterId: 'chapter-3',
    progress: getChapterTwoCompletedProgress(),
  })
  await page.goto('/map?qa=1')

  const mentorDialog = page.getByLabel('Диалог Kilian')

  await expect(mentorDialog).toContainText('Открыт новый узел')
  await expect(page.locator('.route-unlock-line')).toBeVisible()
  await expect(page.locator('.map-node-unlock-reveal')).toHaveCount(1)

  expect(fixture.state.pendingUnlockChapterId).toBeNull()

  await page.reload()

  await expect(page.locator('.route-unlock-line')).toHaveCount(0)
  await expect(page.locator('.map-node-unlock-reveal')).toHaveCount(0)
  await expect(mentorDialog).not.toContainText('Открыт новый узел')
})

test('shows a completed world state across the whole route map', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seedCompletedCourse(page)
  await page.goto('/map?qa=1')

  await expect(page.locator('.map-landmark-completed')).toHaveCount(
    chapters.length,
  )
  await expect(page.locator('.map-node-completed')).toHaveCount(chapters.length)
  await expect(page.locator('.map-node-open')).toHaveCount(0)
  await expect(page.locator('.map-node-locked')).toHaveCount(0)
  await expect(page.locator('.route-line')).toHaveCount(0)
  await expect(page.locator('.route-unlock-line')).toHaveCount(0)
  await expect(page.locator('.route-completed-line polyline')).toHaveAttribute(
    'points',
    '14,68 27,48 40,61 53,39 65,54 77,38 87,55 94,29',
  )

  const mentorDialog = page.getByLabel('Диалог Kilian')

  await expect(mentorDialog).toContainText('Маршрут закрыт')
  await expect(mentorDialog).toContainText('Все главы пройдены')
  await expect(mentorDialog).not.toContainText('Ответственный автор')
  await expect(mentorDialog).not.toContainText('ИИ как инженерный инструмент')
})

test('gates the final closeout until all chapters are completed', async ({
  page,
}) => {
  await enterGame(page)
  await page.goto('/course/complete?qa=1')

  await expect(
    page.getByRole('heading', { name: 'Маршрут ещё открыт' }),
  ).toBeVisible()
  await expect(
    page.getByText(`Архив глав ждёт ${chapters.length}/${chapters.length}`),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Скачать.*\.md/ }),
  ).toHaveCount(0)

  await page.getByRole('link', { name: 'На карту' }).click()
  await expect(page).toHaveURL(/\/map\?qa=1$/)
})

test('previews and exports chapter markdown files from the final archive', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seedCompletedCourse(page, {
    chapterReflections: [
      {
        chapterId: 'chapter-1',
        note: 'Перед ближайшим ревью покажу цель, границы и проверку.',
        optionId: 'review',
        optionLabel: 'В ближайшем ревью',
        skipped: false,
        updatedAt: '2026-05-30T10:00:00.000Z',
      },
      {
        chapterId: 'chapter-2',
        note: '',
        optionId: null,
        optionLabel: null,
        skipped: true,
        updatedAt: '2026-05-30T10:05:00.000Z',
      },
    ],
    encounteredTrapIds: ['confident-report', 'too-broad'],
  })

  await page.goto('/course/complete?qa=1')

  await expect(
    page.getByRole('heading', {
      exact: true,
      level: 1,
      name: 'Архив глав',
    }),
  ).toBeVisible()
  await expect(page.getByLabel('Сводка файлов')).toContainText(
    `${chapters.length}/${chapters.length}`,
  )
  const chapterArtifactCount = chapters.flatMap((chapter) =>
    getChapterArtifacts(chapter),
  ).length
  await expect(
    page.getByLabel('Список md-файлов глав').locator('button'),
  ).toHaveCount(chapterArtifactCount)

  const preview = page.locator('.closeout-artifact-preview')

  await expect(preview).toContainText(
    '# Самопроверка ИИ-помощи перед ревью',
  )
  await expect(preview).toContainText('В ближайшем ревью')
  await expect(preview).toContainText(
    'Перед ближайшим ревью покажу цель, границы и проверку.',
  )
  await expect(preview).not.toContainText(rewardCardLearner.fullName)
  await expect(preview).not.toContainText('# Финальный отчёт Agent Trail')
  await expect(preview).not.toContainText('agent-trail-final-report.md')

  for (const chapter of chapters) {
    for (const artifact of getChapterArtifacts(chapter)) {
      await expect(page.getByLabel('Список md-файлов глав')).toContainText(
        artifact.fileName,
      )
    }
  }

  await page.getByRole('button', { name: /rules-inventory\.md/ }).click()
  await expect(preview).toContainText('# Rules Inventory')
  await expect(preview).toContainText('## Always-on rules')
  await expect(preview).toContainText('## Scoped rules')

  await page.getByRole('button', { name: /skill-draft\.md/ }).click()
  await expect(preview).toContainText('# Skill Draft')
  await expect(preview).toContainText('## When to use')
  await expect(preview).toContainText('## Stop conditions')

  await page.getByRole('button', { name: /task-brief\.md/ }).click()
  await expect(preview).toContainText('# Бриф задачи для ИИ-агента')
  await expect(preview).toContainText('Заметка пропущена на экране награды')

  const downloadPromise = page.waitForEvent('download')

  await page.getByRole('button', { name: 'Скачать .md' }).click()
  await expect((await downloadPromise).suggestedFilename()).toBe(
    'task-brief.md',
  )
})

test('opens final closeout again from the final chapter badge and leaderboard', async ({
  page,
}) => {
  await seedCompletedCourse(page)

  const finalChapter = chapters.at(-1)

  if (!finalChapter) {
    throw new Error('Final chapter fixture not found.')
  }

  await page.goto(`/chapters/${finalChapter.id}/badge?qa=1`)
  const badgeCloseoutLink = page
    .locator('.badge-actions')
    .getByRole('link', { name: 'Архив глав' })

  await expect(badgeCloseoutLink).toBeVisible()
  await expect(badgeCloseoutLink).toHaveAttribute(
    'href',
    /\/course\/complete\?qa=1$/,
  )
  await badgeCloseoutLink.click()
  await expect(page).toHaveURL(/\/course\/complete\?qa=1$/)

  await page.goto('/leaderboard?qa=1')
  await expect(page.getByLabel('Текущий прогресс игрока')).toContainText(
    `${chapters.length}/${chapters.length}`,
  )
  const leaderboardCloseoutLink = page.getByRole('link', {
    name: 'Архив глав',
  })

  await expect(leaderboardCloseoutLink).toHaveAttribute(
    'href',
    /\/course\/complete\?qa=1$/,
  )
  await leaderboardCloseoutLink.click()
  await expect(page).toHaveURL(/\/course\/complete\?qa=1$/)
})

test('keeps completed current operator in leaderboard when backend aggregate is stale', async ({
  page,
}) => {
  const learner: Learner = {
    fullName: 'Codex Browser QA',
    id: 'codex-regress-20260602',
    nickname: 'CODEX-REGRESS-20260602',
  }
  const staleLeaderboardEntries: LeaderboardEntry[] = [
    {
      closedChaptersCount: 3,
      currentRank: 'Mission Planner',
      fullName: '',
      lastBadgeDate: '2026-05-29T10:00:00.000Z',
      lastBadgeName: 'План перед изменениями',
      learnerId: 'stale-peer',
      nickname: 'stale-peer',
    },
  ]
  const fixture = await seedCompletedCourse(page, { learner })

  fixture.state.leaderboardEntries = staleLeaderboardEntries

  await page.goto('/leaderboard?qa=1')

  const currentProgress = page.getByLabel('Текущий прогресс игрока')
  const leaderboard = page.getByRole('table', { name: 'Рейтинг игроков' })

  await expect(currentProgress).toContainText(`${chapters.length}/${chapters.length}`)
  await expect(currentProgress).toContainText('Playbook Crafter')
  await expect(currentProgress).toContainText('Сценарий оформлен')
  await expect(page.getByText(`Лучший результат: ${chapters.length}`)).toBeVisible()
  await expect(leaderboard).toContainText('@CODEX-REGRESS-20260602')
  await expect(leaderboard).toContainText(`${chapters.length}/${chapters.length}`)
  await expect(leaderboard).toContainText('Playbook Crafter')
  await expect(leaderboard).toContainText('Сценарий оформлен')
  await expect(currentProgress).not.toContainText('награды ещё впереди')
})

test('uses chapter-scene numbering for prep and mission labels', async ({
  page,
}) => {
  await seedCompletedCourse(page)

  await page.goto('/chapters/chapter-1/prep?qa=1')
  await expect(page.locator('.game-hud .eyebrow')).toHaveText('Сцена 1.0')
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Сцена 1\.0: принять роль автора/,
    }),
  ).toBeVisible()

  await page.goto('/chapters/chapter-1/missions/who-owns-the-diff?qa=1')
  await expect(page.locator('.game-hud .eyebrow')).toHaveText('Сцена 1.1')
  const firstMissionBrief = page.locator('.mission-brief')
  await expect(firstMissionBrief).not.toContainText('Сцена 1.1')
  await expect(firstMissionBrief).not.toContainText('Кто автор изменений?')
  await expect(firstMissionBrief).toContainText('Бриф сцены')
  await expect(firstMissionBrief).toContainText('Выбор решения')
  await expect(firstMissionBrief).toContainText('Твой ход')

  await page.goto('/chapters/chapter-1/missions/spot-the-ai-risk?qa=1')
  const riskMissionBrief = page.locator('.mission-brief')
  await expect(riskMissionBrief).toContainText('Задача')
  await expect(riskMissionBrief).not.toContainText('Цель')

  await page.goto('/chapters/chapter-1?qa=1')
  const chapterOneMissionList = page.getByRole('list', {
    name: 'Список практик главы',
  })
  await expect(chapterOneMissionList.getByText('1.5 · финал')).toBeVisible()

  await writeBackendFixtureState(page, {
    progress: getChapterOneMissionProgress(getChapterOneMissionIdsBeforeBoss()),
  })
  await page.goto('/chapters/chapter-1?qa=1')
  await expect(
    chapterOneMissionList.getByText('1.5 · финал'),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Финальный бой за пул-реквест' }),
  ).toHaveAttribute(
    'href',
    /\/chapters\/chapter-1\/missions\/ship-or-stop\?qa=1$/,
  )
  await expect(page.getByRole('link', { name: 'Продолжить сцену' }))
    .toHaveAttribute(
      'href',
      /\/chapters\/chapter-1\/missions\/ship-or-stop\?qa=1$/,
    )

  await page.goto('/chapters/chapter-1/missions/ship-or-stop?qa=1')
  await expect(page.locator('.game-hud .eyebrow')).toHaveText('Сцена 1.5')

  await seedCompletedCourse(page)
  await page.goto('/chapters/chapter-8/missions/clinic-to-playbook?qa=1')
  await expect(page.locator('.game-hud .eyebrow')).toHaveText('Сцена 8.4')
  const lateMissionBrief = page.locator('.mission-brief')
  await expect(lateMissionBrief).not.toContainText('Сцена 8.4')
  await expect(lateMissionBrief).toContainText('Бриф сцены')
  await expect(lateMissionBrief).toContainText('Мультивыбор')
  await expect(lateMissionBrief).toContainText('Твой ход')
})

test('stacks mission panels on mobile scene layouts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 })
  await seedCompletedCourse(page)

  for (const missionId of ['who-owns-the-diff', 'self-review-assembly']) {
    await page.goto(`/chapters/chapter-1/missions/${missionId}?qa=1`)
    await expect(page.locator('.mission-brief')).toBeVisible()
    await expect(page.locator('.mission-console')).toBeVisible()
    await expect(page.locator('.mission-feedback')).toBeVisible()

    const bounds = await page.evaluate(() => {
      function toRect(selector: string) {
        const element = document.querySelector(selector)

        if (!element) {
          return null
        }

        const rect = element.getBoundingClientRect()

        return {
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          top: rect.top,
        }
      }

      return {
        brief: toRect('.mission-brief'),
        consolePanel: toRect('.mission-console'),
        feedback: toRect('.mission-feedback'),
        viewportWidth: window.innerWidth,
      }
    })

    if (!bounds.brief || !bounds.consolePanel || !bounds.feedback) {
      throw new Error('Expected mission panels to render')
    }

    expect(bounds.consolePanel.top).toBeGreaterThanOrEqual(
      bounds.brief.bottom - 1,
    )
    expect(bounds.feedback.top).toBeGreaterThanOrEqual(
      bounds.consolePanel.bottom - 1,
    )

    for (const panel of [bounds.brief, bounds.consolePanel, bounds.feedback]) {
      expect(panel.left).toBeGreaterThanOrEqual(0)
      expect(panel.right).toBeLessThanOrEqual(bounds.viewportWidth + 1)
    }
  }
})

test('keeps chapter prep as the clear current step on a fresh chapter landing', async ({
  page,
}) => {
  await writeBackendFixtureState(page, {
    progress: getChapterOneMissionProgress([]),
  })
  await page.goto('/chapters/chapter-1?qa=1')

  const missionList = page.getByRole('list', {
    name: 'Список практик главы',
  })
  const prepLink = page.getByRole('link', {
    name: 'Сцена 1.0: принять роль автора',
  })
  const firstMissionLink = page.getByRole('link', {
    name: 'Кто автор изменений?',
  })

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'ИИ как инженерный инструмент',
    }),
  ).toBeVisible()
  await expect(missionList.getByText('1.0 · сейчас')).toBeVisible()
  await expect(missionList.getByText('1.1 · после брифинга')).toBeVisible()
  await expect(prepLink).toHaveAttribute('aria-current', 'step')
  await expect(page.getByRole('link', { name: 'Начать брифинг' })).toHaveAttribute(
    'href',
    /\/chapters\/chapter-1\/prep\?qa=1$/,
  )
  await expect(firstMissionLink).toHaveAttribute(
    'href',
    /\/chapters\/chapter-1\/prep\?qa=1$/,
  )
  await expect(firstMissionLink).not.toHaveAttribute('aria-current', 'step')

  await firstMissionLink.click()
  await expect(page).toHaveURL(/\/chapters\/chapter-1\/prep\?qa=1$/)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Сцена 1.0: принять роль автора',
    }),
  ).toBeVisible()

  await page.goto('/chapters/chapter-1/missions/who-owns-the-diff?qa=1')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Кто автор изменений?' }),
  ).toBeVisible()
})

test('shows patrol before completion and a replay reward entry after completion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await writeBackendFixtureState(page, {
    progress: getChapterOneMissionProgress([]),
  })

  await page.goto('/chapters/chapter-1?qa=1')
  await expect(page.locator('.chapter-patrol-zone')).toBeVisible()
  await expect(page.locator('.chapter-patrol-readout')).toHaveCount(0)
  await expect(page.locator('.chapter-reward-showcase')).toHaveCount(0)
  await expectChapterSideStageToFit(page)
  const patrolMetrics = await page.evaluate(() => {
    const toSize = (selector: string) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect()

      return rect
        ? {
            height: rect.height,
            width: rect.width,
          }
        : null
    }

    return {
      track: toSize('.chapter-patrol-track'),
      zone: toSize('.chapter-patrol-zone'),
    }
  })

  expect(patrolMetrics.zone?.width ?? 0).toBeGreaterThanOrEqual(580)
  expect(patrolMetrics.zone?.height ?? 0).toBeGreaterThanOrEqual(400)
  expect(patrolMetrics.track?.height ?? 0).toBeGreaterThanOrEqual(340)

  await writeBackendFixtureState(page, {
    progress: getChapterTwoCompletedProgress(),
  })

  await page.goto('/chapters/chapter-2?qa=1')
  const rewardShowcase = page.locator('.chapter-reward-showcase')
  const rewardLink = page.getByRole('link', { name: 'Открыть награду' })
  const mentorDialog = page.getByLabel('Диалог Kilian')

  await expect(page.locator('.chapter-patrol-zone')).toHaveCount(0)
  await expect(
    page.getByRole('heading', { level: 2, name: 'Награда уже твоя' }),
  ).toBeVisible()
  await expect(mentorDialog).toContainText('Чёткий бриф')
  await expect(mentorDialog).not.toContainText('Брифинг перед практикой')
  await expect(rewardShowcase).toBeVisible()
  await expect(rewardShowcase).toContainText('Чёткий бриф')
  await expect(rewardShowcase).toContainText('Сигнальная башня')
  await expect(rewardShowcase).toContainText('Brief Boss')
  await expect(rewardLink).toHaveAttribute(
    'href',
    /\/chapters\/chapter-2\/badge\?replay=1&qa=1$/,
  )
  await expectChapterSideStageToFit(page)

  await page.setViewportSize({ width: 390, height: 760 })
  await page.goto('/chapters/chapter-2?qa=1')
  await expect(page.getByRole('link', { name: 'Открыть награду' })).toBeVisible()
  await expectChapterSideStageToFit(page)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('link', { name: 'Открыть награду' }).click()
  await expect(page).toHaveURL(
    /\/chapters\/chapter-2\/badge\?replay=1&qa=1$/,
  )
  await expect(page.locator('.badge-card')).toHaveClass(
    /\bbadge-card-static\b/,
  )
  await expect(page.locator('.badge-card')).not.toHaveClass(
    /\bbadge-card-earned\b/,
  )
})

test('shows prep boot sequence while preserving start gating', async ({
  page,
}) => {
  await enterGame(page)

  await page.goto('/chapters/chapter-1/prep')
  const bootConsole = page.getByLabel('Ход подготовки к первой сцене')
  await expect(page.getByText('Станция подготовки')).toBeVisible()
  await expect(bootConsole.getByText('Идёт зарядка входа')).toBeVisible()
  await expect(page.getByText('Маршрут сцены')).toBeVisible()
  await expect(page.getByRole('link', { name: 'На карту' })).toBeVisible()

  const gatedStart = page.getByRole('link', { name: /К первой сцене/ })
  await expect(gatedStart).toHaveAttribute('aria-disabled', 'true')
  await gatedStart.dispatchEvent('click')
  await expect(page).toHaveURL(/\/chapters\/chapter-1\/prep$/)

  await page.goto('/chapters/chapter-1/prep?qa=1')
  await expect(bootConsole.getByText('Сигнал готов')).toBeVisible()
  await page.getByRole('link', { name: 'К первой сцене' }).click()
  await expect(page).toHaveURL(
    /\/chapters\/chapter-1\/missions\/who-owns-the-diff\?qa=1$/,
  )
})

test('renders prep instruction carousel across every chapter prep scene', async ({
  page,
}) => {
  await seedCompletedCourse(page)

  for (const viewport of [
    { height: 900, width: 1440 },
    { height: 720, width: 1280 },
  ]) {
    await page.setViewportSize(viewport)

    for (const chapter of chapters) {
      if (!chapter.prep) {
        continue
      }

      const totalRuleNumber = String(chapter.prep.checklist.length).padStart(
        2,
        '0',
      )

      await page.goto(`/chapters/${chapter.id}/prep?qa=1`)

      const carousel = page.getByLabel('Опорные правила')
      await expect(carousel).toBeVisible()
      await expect(carousel).toContainText('KILIAN INSTRUCTION STACK')
      await expect(carousel).toContainText(`RULE 01/${totalRuleNumber}`)
      await expect(carousel.locator('.prep-instruction-card')).toHaveCount(
        chapter.prep.checklist.length,
      )
      await expectPrepCarouselLayoutToFit(page)

      await page.getByRole('button', { name: 'Следующее правило' }).click()
      await expect(carousel).toContainText(`RULE 02/${totalRuleNumber}`)
      await expectPrepCarouselLayoutToFit(page)
      await expect(page.getByRole('link', { name: 'К первой сцене' })).toBeVisible()
    }
  }
})

test('keeps chapter recap behind completed badge state', async ({ page }) => {
  await writeBackendFixtureState(page, {
    progress: getChapterOneMissionProgress([]),
  })
  await page.goto('/chapters/chapter-1/badge?qa=1')

  await expect(
    page.getByRole('heading', { level: 2, name: 'Сначала финальный вызов' }),
  ).toBeVisible()
  await expect(page.locator('.chapter-recap-card')).toHaveCount(0)
})

test('completes chapter 1 happy path through the badge screen', async ({
  page,
}) => {
  const browserErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    browserErrors.push(error.message)
  })

  await page.goto('/?qa=1')

  await page.getByLabel('Позывной').fill('qa-agent')
  await page.getByLabel('Имя и фамилия').fill('QA Agent')
  await page.getByRole('button', { name: 'Войти на карту' }).click()

  await expect(page).toHaveURL(/\/map$/)
  await expect(
    page.getByRole('heading', { name: 'Карта практик ИИ-разработки' }),
  ).toBeVisible()
  await expect(page.locator('.map-landmark')).toHaveCount(chapters.length)
  await expect(page.getByRole('img', { name: /Кузня ревью/ })).toBeVisible()
  await expect(
    page.getByRole('img', { name: /Коммутатор инструкций/ }),
  ).toBeVisible()
  const landmarkMetrics = await page.evaluate(() => {
    const getRect = (element: Element) => {
      const rect = element.getBoundingClientRect()

      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      }
    }
    const landmarks = [...document.querySelectorAll('.map-landmark')].map(
      getRect,
    )
    const nodes = [...document.querySelectorAll('.map-node')].map(getRect)
    const avatar = document.querySelector('.avatar-bot')
    const openLandmark = document.querySelector('.map-landmark-open')
    const overlaps: string[] = []
    const getOverlapArea = (
      first: ReturnType<typeof getRect>,
      second: ReturnType<typeof getRect>,
    ) => {
      const overlapX = Math.max(
        0,
        Math.min(first.right, second.right) - Math.max(first.left, second.left),
      )
      const overlapY = Math.max(
        0,
        Math.min(first.bottom, second.bottom) -
          Math.max(first.top, second.top),
      )

      return overlapX * overlapY
    }
    const distances = landmarks.map((landmark, index) => {
      const node = nodes[index]
      const landmarkCenter = {
        x: landmark.left + landmark.width / 2,
        y: landmark.top + landmark.height / 2,
      }
      const nodeCenter = {
        x: node.left + node.width / 2,
        y: node.top + node.height / 2,
      }

      for (const [nodeIndex, currentNode] of nodes.entries()) {
        const overlapArea = getOverlapArea(landmark, currentNode)

        if (overlapArea > 0) {
          overlaps.push(
            `landmark ${index + 1} / node ${nodeIndex + 1}: ${Math.round(
              overlapArea,
            )}`,
          )
        }
      }

      return Math.round(
        Math.hypot(landmarkCenter.x - nodeCenter.x, landmarkCenter.y - nodeCenter.y),
      )
    })
    const openLandmarkRect = openLandmark ? getRect(openLandmark) : null
    const avatarRect = avatar ? getRect(avatar) : null
    const openLandmarkAvatarOverlapArea =
      openLandmarkRect && avatarRect
        ? getOverlapArea(openLandmarkRect, avatarRect)
        : null
    const openLandmarkAvatarCenterDelta =
      openLandmarkRect && avatarRect
        ? {
            x: Math.round(
              openLandmarkRect.left +
                openLandmarkRect.width / 2 -
                (avatarRect.left + avatarRect.width / 2),
            ),
            y: Math.round(
              openLandmarkRect.top +
                openLandmarkRect.height / 2 -
                (avatarRect.top + avatarRect.height / 2),
            ),
          }
        : null

    return {
      distances,
      openLandmarkAvatarCenterDelta,
      openLandmarkAvatarOverlapArea,
      overlaps,
    }
  })

  expect(landmarkMetrics.overlaps).toEqual([])
  expect(Math.max(...landmarkMetrics.distances)).toBeLessThanOrEqual(160)
  expect(landmarkMetrics.openLandmarkAvatarOverlapArea).not.toBeNull()
  expect(landmarkMetrics.openLandmarkAvatarOverlapArea).toBeGreaterThan(1800)
  expect(landmarkMetrics.openLandmarkAvatarOverlapArea).toBeLessThan(4300)
  expect(landmarkMetrics.openLandmarkAvatarCenterDelta).not.toBeNull()
  expect(landmarkMetrics.openLandmarkAvatarCenterDelta?.x).toBeGreaterThanOrEqual(
    -36,
  )
  expect(landmarkMetrics.openLandmarkAvatarCenterDelta?.x).toBeLessThanOrEqual(
    -24,
  )
  expect(landmarkMetrics.openLandmarkAvatarCenterDelta?.y).toBeGreaterThanOrEqual(
    -16,
  )
  expect(landmarkMetrics.openLandmarkAvatarCenterDelta?.y).toBeLessThanOrEqual(
    -8,
  )
  expect(browserErrors).toEqual([])

  await page.getByRole('link', { name: 'Доска лидеров' }).click()
  await expect(
    page.getByRole('heading', { name: 'Закрытые главы' }),
  ).toBeVisible()
  await expect(
    page.getByRole('table', { name: 'Рейтинг игроков' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'На карту' }).click()
  await expect(
    page.getByRole('heading', { name: 'Карта практик ИИ-разработки' }),
  ).toBeVisible()

  await writeBackendFixtureState(page, {
    learner: getBackendFixtureLearner(page),
    pendingUnlockChapterId: 'chapter-2',
    progress: getChapterOneCompletedProgress(),
  })
  await page.goto('/chapters/chapter-1/badge?earned=1&qa=1')

  await expect(page).toHaveURL(/\/chapters\/chapter-1\/badge/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Ответственный автор' }),
  ).toBeVisible()
  await expect(page.locator('.badge-card')).toHaveClass(
    /\bbadge-card-earned\b/,
  )
  await expect(page.locator('.badge-card')).toHaveClass(
    /\bbadge-ceremony-seal\b/,
  )
  await expect(page.getByText('глава пройдена')).toBeVisible()
  await expect(page.getByText('Кузня ревью')).toBeVisible()
  await expect(page.getByText(/Код мог написать агент/)).toBeVisible()
  await expectBadgeMastery(page, {
    actions: [
      'Принимать только понятный набор изменений.',
      'Отделять задачу от лишнего рефакторинга.',
      'Показывать ревьюеру проверку и роль ИИ.',
    ],
  })
  await expectChapterRecap(page, {
    nextMove: /запиши цель, границы изменений, что проверено/,
    trapLabel: 'Уверенный отчёт',
  })
  await expect(page.getByRole('button', { name: 'Скачать .md' })).toBeVisible()
  await expect(page.getByText(/Открыта глава 02/)).toBeVisible()
})

test('renders collectible reward cards for every completed badge', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await seedCompletedCourse(page)

  const expectedRewards = [
    {
      badgeName: 'Ответственный автор',
      ceremony: 'seal',
      emblem: 'АВ',
      fileName: 'ai-pr-self-review.md',
      id: 'chapter-1',
      masteryActions: [
        'Принимать только понятный набор изменений.',
        'Отделять задачу от лишнего рефакторинга.',
        'Показывать ревьюеру проверку и роль ИИ.',
      ],
      motif: 'Кузня ревью',
      recapTrap: 'Уверенный отчёт',
      tone: 'gold',
    },
    {
      badgeName: 'Чёткий бриф',
      ceremony: 'signal',
      emblem: 'БР',
      fileName: 'task-brief.md',
      id: 'chapter-2',
      masteryActions: [
        'Переводить просьбу в цель и границы.',
        'Задавать запреты и 1-3 примера до старта.',
        'Фиксировать критерии приёмки и проверку.',
      ],
      motif: 'Сигнальная башня',
      recapTrap: 'Слишком широко',
      tone: 'blue',
    },
    {
      badgeName: 'План перед изменениями',
      ceremony: 'route-seal',
      emblem: 'ПЛ',
      fileName: 'plan-first-checklist.md',
      id: 'chapter-3',
      masteryActions: [
        'Просить план до рискованных правок.',
        'Сужать работу до проверяемого набора изменений.',
        'Останавливать агента, когда план расширяет задачу.',
      ],
      motif: 'Плановый шлюз',
      recapTrap: 'Соседний рефакторинг',
      tone: 'green',
    },
    {
      badgeName: 'Контекст собран',
      ceremony: 'signal',
      emblem: 'КТ',
      fileName: 'agents-context-starter.md',
      id: 'chapter-4',
      masteryActions: [
        'Собирать короткое ядро контекста проекта.',
        'Подбирать 1-3 примера под задачу.',
        'Отсекать секреты, персональные данные и сырые логи.',
      ],
      motif: 'Архив контекста',
      recapTrap: 'Свалка контекста',
      tone: 'teal',
    },
    {
      badgeName: 'Куратор инструкций',
      ceremony: 'signal',
      emblem: 'RS',
      fileName: 'rules-inventory.md',
      id: 'chapter-5',
      masteryActions: [
        'Отбирать короткие, актуальные и безопасные rules.',
        'Описывать skill как повторяемую процедуру.',
        'Удалять stale, unsafe и task-only инструкции из durable context.',
      ],
      motif: 'Коммутатор инструкций',
      recapTrap: 'Prompt вместо skill',
      tone: 'violet',
    },
    {
      badgeName: 'Контекст без шума',
      ceremony: 'seal',
      emblem: 'ТК',
      fileName: 'token-hygiene-checklist.md',
      id: 'chapter-6',
      masteryActions: [
        'Выбирать режим работы под задачу.',
        'Давать только нужные файлы и опоры.',
        'Останавливать повтор без нового факта.',
      ],
      motif: 'Окно внимания',
      recapTrap: 'Попробуй ещё раз без новой информации',
      tone: 'pink',
    },
    {
      badgeName: 'Проверено делом',
      ceremony: 'seal',
      emblem: 'ПР',
      fileName: 'verification-matrix.md',
      id: 'chapter-7',
      masteryActions: [
        'Подбирать проверку под риск изменения.',
        'Отличать поведение от деталей реализации.',
        'Записывать доказательства и остаточный риск.',
      ],
      motif: 'Маяк проверки',
      recapTrap: 'Тест, который ничего не доказывает',
      tone: 'orange',
    },
    {
      badgeName: 'Сценарий оформлен',
      ceremony: 'signal',
      emblem: 'СЦ',
      fileName: 'team-playbook-draft.md',
      id: 'chapter-8',
      masteryActions: [
        'Выбирать повторяемый рабочий сценарий.',
        'Подключать нужные rules/skills без дублирования.',
        'Обновлять сценарий после реальных кейсов.',
      ],
      motif: 'Релейная станция',
      recapTrap: 'Личная магия',
      tone: 'violet',
    },
  ]

  for (const [index, reward] of expectedRewards.entries()) {
    const chapter = chapters.find((item) => item.id === reward.id)

    if (!chapter) {
      throw new Error(`Reward fixture chapter not found: ${reward.id}`)
    }

    await page.goto(`/chapters/${reward.id}/badge`)
    await expect(
      page.getByRole('heading', { level: 1, name: reward.badgeName }),
    ).toBeVisible()

    const card = page.locator('.badge-card')

    await expect(card).toHaveClass(
      new RegExp(`\\bbadge-card-${reward.tone}\\b`),
    )
    await expect(card).toHaveClass(
      new RegExp(`\\bbadge-ceremony-${reward.ceremony}\\b`),
    )
    await expect(card).toHaveClass(/\bbadge-card-static\b/)
    await expect(card).not.toHaveClass(/\bbadge-card-earned\b/)
    await expect(card.locator('.badge-route-mark')).toHaveCount(
      reward.ceremony === 'route-seal' ? 1 : 0,
    )
    await expect(card.getByText(reward.emblem, { exact: true })).toBeVisible()
    await expect(card.getByText(reward.motif, { exact: true })).toBeVisible()
    await expect(
      card.getByText(`#${String(index + 1).padStart(2, '0')}`, {
        exact: true,
      }),
    ).toBeVisible()
    await expectBadgeMastery(page, { actions: reward.masteryActions })
    await expectChapterRecap(page, {
      nextMove: /./,
      ruleCount: chapter.recap.rules.length,
      trapLabel: reward.recapTrap,
    })
    await expect(page.locator('.artifact-toolbar span')).toHaveText(
      reward.fileName,
    )
    await expect(page.locator('.artifact-preview')).toContainText('#')
    await expect(page.locator('.artifact-preview')).not.toContainText(
      rewardCardLearner.fullName,
    )
    await expectBadgeLayoutToFit(page)

    if (reward.id === 'chapter-1') {
      const downloadPromise = page.waitForEvent('download')

      await page.getByRole('button', { name: 'Скачать .md' }).click()
      await expect((await downloadPromise).suggestedFilename()).toBe(
        reward.fileName,
      )
    }
  }
})

test('previews and exports both Rules & Skills badge artifacts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seedCompletedCourse(page)
  await page.goto('/chapters/chapter-5/badge?qa=1')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Куратор инструкций' }),
  ).toBeVisible()

  const artifactSelector = page.getByLabel('Файлы главы')
  const artifactPreview = page.locator('.artifact-preview')

  await expect(artifactSelector).toBeVisible()
  await expect(
    artifactSelector.getByRole('button', { name: 'rules-inventory.md' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    artifactSelector.getByRole('button', { name: 'skill-draft.md' }),
  ).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.artifact-toolbar span')).toHaveText(
    'rules-inventory.md',
  )
  await expect(artifactPreview).toContainText('# Rules Inventory')
  await expect(artifactPreview).toContainText('## Rules to delete')
  await expect(artifactPreview).not.toContainText(rewardCardLearner.fullName)

  const rulesDownloadPromise = page.waitForEvent('download')

  await page.getByRole('button', { name: 'Скачать .md' }).click()
  await expect((await rulesDownloadPromise).suggestedFilename()).toBe(
    'rules-inventory.md',
  )

  await artifactSelector
    .getByRole('button', { name: 'skill-draft.md' })
    .click()
  await expect(page.locator('.artifact-toolbar span')).toHaveText(
    'skill-draft.md',
  )
  await expect(artifactPreview).toContainText('# Skill Draft')
  await expect(artifactPreview).toContainText('## Required inputs')
  await expect(artifactPreview).toContainText('## Known bad cases')
  await expect(artifactPreview).not.toContainText(rewardCardLearner.fullName)
  await expectBadgeLayoutToFit(page)

  const skillDownloadPromise = page.waitForEvent('download')

  await page.getByRole('button', { name: 'Скачать .md' }).click()
  await expect((await skillDownloadPromise).suggestedFilename()).toBe(
    'skill-draft.md',
  )
})

test('keeps a later completed badge connected to map, replay, leaderboard, and artifact export', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seedChapterTwoCompleted(page)
  await page.goto('/chapters/chapter-2/badge?qa=1')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Чёткий бриф' }),
  ).toBeVisible()
  await expect(page.getByText('Сигнальная башня')).toBeVisible()
  await expect(page.getByText(/Открыта глава 03/)).toBeVisible()
  await expectChapterRecap(page, {
    nextMove: /оформи короткий бриф задачи/,
    trapLabel: 'Слишком широко',
  })
  await expect(page.getByText('task-brief.md')).toBeVisible()
  await expect(page.locator('.artifact-preview')).toContainText(
    '# Бриф задачи для ИИ-агента',
  )
  await expect(page.locator('.artifact-preview')).not.toContainText(
    rewardCardLearner.fullName,
  )
  await expectBadgeLayoutToFit(page)

  const downloadPromise = page.waitForEvent('download')

  await page.getByRole('button', { name: 'Скачать .md' }).click()
  await expect((await downloadPromise).suggestedFilename()).toBe(
    'task-brief.md',
  )

  await page.getByRole('link', { name: 'На карту' }).click()
  await expect(page).toHaveURL(/\/map$/)
  await expect(
    page.getByRole('heading', { name: 'Карта практик ИИ-разработки' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Глава 3: Работа от плана/ }),
  ).toBeEnabled()

  await page.goto('/chapters/chapter-2/badge?qa=1')
  await page.getByRole('link', { name: 'Доска лидеров' }).click()
  await expect(page).toHaveURL(/\/leaderboard$/)
  await expect(
    page.getByRole('heading', { name: 'Закрытые главы' }),
  ).toBeVisible()
  await expect(
    page.getByRole('table', { name: 'Рейтинг игроков' }),
  ).toContainText(rewardCardLearner.nickname)
  await expect(
    page.getByLabel('Текущий прогресс игрока'),
  ).toContainText(`2/${chapters.length}`)

  await page.goto('/chapters/chapter-2/badge?qa=1')
  await page.getByRole('link', { name: 'Повторить главу' }).click()
  await expect(page).toHaveURL(/\/chapters\/chapter-2\/prep\?qa=1$/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Собрать бриф задачи' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'К первой сцене' })).toBeVisible()
})

test('shows collection status instead of fresh progress on replayed badges', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seedBackendFixtureState(page, {
    progress: getChapterSixCompletedProgress(),
  })

  await page.goto('/chapters/chapter-1/badge?qa=1')

  const previousReplayStats = page.getByLabel('Статус повторной награды')
  const previousReplayCard = page.locator('.badge-card')

  await expect(previousReplayStats).toBeVisible()
  await expect(previousReplayCard).toHaveClass(/\bbadge-card-static\b/)
  await expect(previousReplayCard).not.toHaveClass(/\bbadge-card-earned\b/)
  await expect(previousReplayStats).toContainText(
    'Повтор главы: награда уже в коллекции',
  )
  await expect(previousReplayStats).toContainText(
    'Ранг этой главы: Diff Owner',
  )
  await expect(previousReplayStats).not.toContainText('Новый ранг')
  await expect(previousReplayStats).not.toContainText('Trust But Tester')
  await expect(previousReplayStats).not.toContainText(
    `Закрыто глав: 7 / ${chapters.length}`,
  )
  await expect(previousReplayStats).not.toContainText('Открыта глава')
  await expectBadgeLayoutToFit(page)

  await page.goto('/chapters/chapter-7/badge?replay=1&qa=1')

  const latestReplayStats = page.getByLabel('Статус повторной награды')
  const latestReplayCard = page.locator('.badge-card')

  await expect(latestReplayCard).toHaveClass(/\bbadge-card-static\b/)
  await expect(latestReplayCard).not.toHaveClass(/\bbadge-card-earned\b/)
  await expect(latestReplayStats).toContainText(
    'Повтор главы: награда уже в коллекции',
  )
  await expect(latestReplayStats).toContainText(
    'Ранг этой главы: Trust But Tester',
  )
  await expect(latestReplayStats).not.toContainText('Новый ранг')
})

test('saves, edits, skips, and exports badge reflection', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const fixture = await writeBackendFixtureState(page, {
    completions: [
      {
        learnerId: rewardCardLearner.id,
        chapterId: 'chapter-1',
        completedChapters: 1,
        completedAt: '2026-05-29T10:00:00.000Z',
      },
    ],
    progress: createProgressState({
      completedChapterIds: ['chapter-1'],
      openChapterId: 'chapter-2',
    }),
  })

  await page.goto('/chapters/chapter-1/badge?qa=1')

  const reflection = page.locator('.reflection-card')
  const artifactPreview = page.locator('.artifact-preview')

  await expect(reflection).toBeVisible()
  await expect(
    reflection.getByRole('heading', { name: 'Где применишь это завтра?' }),
  ).toBeVisible()
  await expect(artifactPreview).toContainText('## Локальная заметка')
  await expect(artifactPreview).toContainText(
    'TODO: выбрать ближайший рабочий сценарий.',
  )

  const firstNote =
    'Завтра перед отправкой небольшого PR запишу цель, границы изменения и одну проверку, чтобы ревьюер видел моё решение, а не только текст от агента.'

  await reflection.getByRole('button', { name: 'В ближайшем ревью' }).click()
  await reflection.getByLabel('Короткая заметка').fill(firstNote)
  await reflection.getByRole('button', { name: 'Сохранить заметку' }).click()

  await expect(reflection).toContainText('Заметка сохранена')
  await expect(artifactPreview).toContainText('Фокус: В ближайшем ревью')
  await expect(artifactPreview).toContainText(firstNote)
  await expectBadgeLayoutToFit(page)

  expect(fixture.state.reflections[0]).toMatchObject({
    chapterId: 'chapter-1',
    note: firstNote,
    optionId: 'review',
    optionLabel: 'В ближайшем ревью',
    skipped: false,
  })

  await page.reload()

  await expect(reflection).toContainText('Заметка сохранена')
  await expect(artifactPreview).toContainText('Фокус: В ближайшем ревью')
  await expect(artifactPreview).toContainText(firstNote)

  await reflection.getByRole('button', { name: 'Изменить' }).click()
  await reflection.getByRole('button', { name: 'В описании пул-реквеста' }).click()
  await reflection
    .getByLabel('Короткая заметка')
    .fill('Добавлю критерий приёмки к задаче.')
  await reflection.getByRole('button', { name: 'Сохранить заметку' }).click()

  await expect(artifactPreview).toContainText(
    'Фокус: В описании пул-реквеста',
  )
  await expect(artifactPreview).toContainText(
    'Добавлю критерий приёмки к задаче.',
  )
  await expect(artifactPreview).not.toContainText(firstNote)

  await reflection.getByRole('button', { name: 'Изменить' }).click()
  await reflection.getByRole('button', { name: 'Пропустить' }).click()

  await expect(reflection).toContainText('Заметка пропущена')
  await expect(artifactPreview).toContainText(
    'Заметка пропущена на экране награды',
  )
  await expect(artifactPreview).not.toContainText('# Финальный отчёт Agent Trail')
  await expect(artifactPreview).not.toContainText('agent-trail-final-report.md')
  await expect(artifactPreview).not.toContainText(
    'Добавлю критерий приёмки к задаче.',
  )

  const downloadPromise = page.waitForEvent('download')

  await page.getByRole('button', { name: 'Скачать .md' }).click()
  await expect((await downloadPromise).suggestedFilename()).toBe(
    'ai-pr-self-review.md',
  )

  await page.getByRole('link', { name: 'На карту' }).click()
  await expect(page).toHaveURL(/\/map$/)
  await expect(
    page.getByRole('button', { name: /Глава 2: Постановка задачи/ }),
  ).toBeEnabled()
})

test('supports keyboard navigation on map and mission choices', async ({
  page,
}) => {
  await page.goto('/?qa=1')

  await page.getByLabel('Позывной').fill('keyboard-agent')
  await page.getByLabel('Имя и фамилия').fill('Keyboard Agent')
  await page.getByRole('button', { name: 'Войти на карту' }).click()
  await expect(page.locator('.map-landmark')).toHaveCount(chapters.length)

  const firstChapterNode = page.getByRole('button', { name: /Глава 1:/ })

  await firstChapterNode.focus()
  await expect(firstChapterNode).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/chapters\/chapter-1$/)

  await page.goto('/chapters/chapter-1/missions/who-owns-the-diff?qa=1')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Кто автор изменений?' }),
  ).toBeVisible()

  const firstAnswer = page.getByRole('button', {
    name: /Остановиться: понять логику/,
  })

  await firstAnswer.focus()
  await expect(firstAnswer).toBeFocused()
  await page.keyboard.press('Space')
  await expect(firstAnswer).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.getByRole('button', { name: 'Проверить решение' }),
  ).toBeEnabled()
})

test('keeps chapter 4 inventory ordering cards clickable below actions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 646, height: 773 })
  await writeBackendFixtureState(page, {
    progress: getChapterFourInventoryReadyProgress(),
  })
  await page.goto('/chapters/chapter-4/missions/context-inventory-order?qa=1')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Собрать inventory' }),
  ).toBeVisible()

  const orderTrack = page.getByLabel('Текущий порядок')
  const primaryAction = page.getByRole('button', {
    name: 'Проверить решение',
  })

  await expect(primaryAction).toBeDisabled()

  await page.getByRole('button', { name: /Идентичность/ }).click()
  await page.getByRole('button', { name: /Архитектурная карта/ }).click()
  await expect(orderTrack.getByRole('button')).toHaveCount(2)

  const navigationChip = page
    .locator('.ordering-board .chip-grid button')
    .filter({ hasText: 'Навигация: важные пути' })

  await navigationChip.scrollIntoViewIfNeeded()
  await expect(navigationChip).toBeVisible()

  const hitTest = await navigationChip.evaluate((chip) => {
    const rect = chip.getBoundingClientRect()
    const hit = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    )

    return {
      hitText: hit?.textContent?.trim() ?? '',
      isChipHit: hit ? chip.contains(hit) : false,
    }
  })

  expect(hitTest.isChipHit).toBe(true)
  expect(hitTest.hitText).not.toBe('Проверить решение')

  await navigationChip.click()
  await expect(orderTrack.getByRole('button')).toHaveCount(3)

  for (const chipName of [
    /Исполняемые проверки/,
    /Рабочие правила/,
    /Примеры/,
    /Риски/,
    /Безопасный пилот/,
  ]) {
    await page.getByRole('button', { name: chipName }).click()
  }

  await expect(orderTrack.getByRole('button')).toHaveCount(8)
  await expect(primaryAction).toBeEnabled()
  await primaryAction.click()
  await expect(page.getByText('Сцена зачтена')).toBeVisible()
})

test('completes the Rules & Skills carrier matching mission on desktop and mobile', async ({
  page,
}) => {
  const browserErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    browserErrors.push(error.message)
  })

  for (const viewport of [
    { height: 900, width: 1440 },
    { height: 760, width: 390 },
  ]) {
    await page.setViewportSize(viewport)
    await writeBackendFixtureState(page, {
      progress: getRulesSkillsMissionProgress(),
    })
    await page.goto(
      '/chapters/chapter-5/missions/knowledge-carrier-match?qa=1',
    )

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Куда положить знание',
      }),
    ).toBeVisible()
    await expect(page.getByLabel('Прогресс соединения пар')).toContainText('0/6')
    await expect(
      page.getByRole('button', { name: 'Проверить решение' }),
    ).toBeDisabled()

    const initialLayout = await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      pairBoardVisible: Boolean(document.querySelector('.pair-matching-board')),
    }))

    expect(initialLayout.pairBoardVisible).toBe(true)
    expect(initialLayout.horizontalOverflow).toBeLessThanOrEqual(1)

    await completeCarrierPairMatching(page)

    await expect(page.getByLabel('Прогресс соединения пар')).toContainText('6/6')
    await expect(
      page.getByRole('button', { name: 'Проверить решение' }),
    ).toBeEnabled()
    await page.getByRole('button', { name: 'Проверить решение' }).click()

    await expect(page.getByText('Сцена зачтена')).toBeVisible()
    await expect(page.locator('.mission-feedback')).toContainText(
      'Маршрутизатор инструкций настроен',
    )

    const completedLayout = await page.evaluate(() => ({
      actionsBottom:
        document.querySelector('.mission-actions')?.getBoundingClientRect()
          .bottom ?? 0,
      consoleBottom:
        document.querySelector('.mission-console')?.getBoundingClientRect()
          .bottom ?? 0,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    }))

    expect(completedLayout.actionsBottom).toBeLessThanOrEqual(
      completedLayout.consoleBottom + 1,
    )
    expect(completedLayout.horizontalOverflow).toBeLessThanOrEqual(1)
  }

  expect(browserErrors).toEqual([])
})

test('keeps Rules & Skills pair matching failures non-leaking', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await writeBackendFixtureState(page, {
    progress: getRulesSkillsMissionProgress(),
  })
  await page.goto(
    '/chapters/chapter-5/missions/knowledge-carrier-match?qa=1',
  )

  await assignPairTarget(
    page,
    /Секреты, персональные данные/,
    'Discard',
  )
  await assignPairTarget(page, /Failed-answer feedback/, 'Scoped rule')
  await assignPairTarget(page, /Проверить gameplay UI/, 'Skill')
  await assignPairTarget(page, /Добавить новую миссию/, 'Playbook')
  await assignPairTarget(page, /Acceptance criterion/, 'Task brief')
  await assignPairTarget(page, /Один автор однажды/, 'Always-on rule')
  await page.getByRole('button', { name: 'Проверить решение' }).click()

  const details = page.getByLabel('Разбор ответа')
  const retryPrinciple = page.getByLabel('Подсказка для повторной попытки')

  await expect(page.getByText('Нужно допроверить')).toBeVisible()
  await expect(retryPrinciple).toContainText('срок жизни знания')
  await expect(details).toContainText(
    'Ловушка: Небезопасный always-on контекст',
  )
  await expect(details).toContainText('Ловушка: Личная магия')
  await expect(details).not.toContainText(
    'Повторяемая browser QA процедура -- это не одно правило',
  )
  await expect(details).not.toContainText(
    'Критерий приёмки одной задачи не становится долговечной rule',
  )
  await expect(page.getByText('Пропущено', { exact: true })).toHaveCount(0)
})

test('locks the Rules & Skills boss pair matching round into the dossier', async ({
  page,
}) => {
  const browserErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    browserErrors.push(error.message)
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await writeBackendFixtureState(page, {
    progress: getRulesSkillsBossReadyProgress(),
  })
  await page.goto(
    '/chapters/chapter-5/missions/instruction-drift?qa=1',
  )

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Финальный бой за управление агентом',
    }),
  ).toBeVisible()
  await expect(page.getByText('Раунд 1 из 4')).toBeVisible()
  await expect(page.getByText('Раунд 1: маршрутизатор носителей')).toBeVisible()

  await completeCarrierPairMatching(page)
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()

  await expect(page.getByText('Раунд 2 из 4')).toBeVisible()
  await expect(page.getByText(/первый ход сохранён в досье/)).toBeVisible()

  const dossierToggle = page.getByRole('button', {
    name: /Открыть журнал раундов/,
  })

  await expect(dossierToggle).toBeVisible()
  await dossierToggle.click()

  const dossier = page.getByRole('dialog', { name: 'Досье боя' })

  await expect(dossier).toBeVisible()
  await expect(dossier).toContainText('Раунд 1: маршрутизатор носителей')
  await expect(dossier).toContainText('Always-on rule')
  await expect(dossier).toContainText('Scoped rule')
  await expect(dossier).toContainText('Skill')
  await expect(dossier.getByText('Очищено')).toHaveCount(0)

  expect(browserErrors).toEqual([])
})

test('returns from a mission to the chapter landing page', async ({ page }) => {
  await writeBackendFixtureState(page, {
    progress: getChapterOneMissionProgress([]),
  })
  await page.goto('/chapters/chapter-1/missions/who-owns-the-diff?qa=1')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Кто автор изменений?' }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Вернуться к брифингу' }).click()

  await expect(page).toHaveURL(/\/chapters\/chapter-1$/)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'ИИ как инженерный инструмент',
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Начать брифинг' }),
  ).toBeVisible()
})

test('shows mentor takeaway robot states after mission results', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })

  await writeBackendFixtureState(page, {
    progress: getChapterOneMissionProgress([]),
  })
  await page.goto('/chapters/chapter-1/missions/who-owns-the-diff?qa=1')
  await expect(page.getByLabel('Короткий итог от Kilian')).toHaveCount(0)
  await page
    .getByRole('button', { name: /Остановиться: понять логику/ })
    .click()
  await page.getByRole('button', { name: 'Проверить решение' }).click()
  await expectMentorTakeaway(page, {
    state: 'success',
    text: /не открывай ревью/,
  })

  await writeBackendFixtureState(page, {
    progress: getChapterOneMissionProgress(['who-owns-the-diff']),
  })
  await page.goto('/chapters/chapter-1/missions/reviewable-or-not?qa=1')
  await page
    .getByRole('button', { name: /ИИ уверенно сообщил, что всё правильно/ })
    .click()
  await page.getByRole('button', { name: 'Проверить решение' }).click()
  await expectMentorTakeaway(page, {
    state: 'trap',
    text: /маленький набор изменений/,
  })
  await expect(page.locator('.trap-discovery-panel')).toBeVisible()

  await writeBackendFixtureState(page, {
    progress: getChapterOneMissionProgress([
      'who-owns-the-diff',
      'reviewable-or-not',
      'spot-the-ai-risk',
    ]),
  })
  await page.goto('/chapters/chapter-1/missions/self-review-assembly?qa=1')
  for (const chipName of [
    /отметить ИИ-помощь/i,
    /сверить набор изменений/i,
    /объяснить существенные изменения/i,
    /убрать лишнее форматирование/i,
    /проверить, что секреты/i,
    /запустить проверки/i,
  ]) {
    await page.getByRole('button', { name: chipName }).click()
  }
  await page.getByRole('button', { name: 'Проверить решение' }).click()
  await expectMentorTakeaway(page, {
    state: 'review',
    text: /Самопроверка держится на двух разных воротах/,
  })

  await writeBackendFixtureState(page, {
    progress: getChapterOneMissionProgress([
      'who-owns-the-diff',
      'reviewable-or-not',
      'spot-the-ai-risk',
      'self-review-assembly',
    ]),
  })
  await page.goto('/chapters/chapter-1/missions/ship-or-stop?qa=1')
  await page
    .getByRole('button', { name: /Целевая модалка показывает предупреждение/ })
    .click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  await page
    .getByRole('button', { name: /особенно посмотри права и общий хук/ })
    .click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  await page
    .getByRole('button', { name: /Снимки интерфейса обновились/ })
    .click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  await page
    .getByRole('button', {
      name: /Открыть пул-реквест вместе с `useDangerousActionGuard`/,
    })
    .click()
  await page.getByRole('button', { name: 'Проверить финал' }).click()
  await expectMentorTakeaway(page, {
    state: 'boss',
    text: /финальном шлюзе/,
  })
})

test('unlocks the trap field guide on the map after a recorded trap', async ({
  page,
}) => {
  await writeBackendFixtureState(page, {
    progress: getChapterOneReviewableProgress(),
  })
  await page.goto('/chapters/chapter-1/missions/reviewable-or-not?qa=1')
  await page
    .getByRole('button', { name: /ИИ уверенно сообщил, что всё правильно/ })
    .click()
  await page.getByRole('button', { name: 'Проверить решение' }).click()

  await expect(page.locator('.trap-discovery-panel')).toBeVisible()
  await expect(page.locator('.trap-discovery-panel')).toContainText(
    'Уверенный отчёт',
  )

  await page.goto('/map?qa=1')
  await expect(
    page.getByRole('link', { name: 'Справочник ловушек' }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Справочник ловушек' }).click()
  await expect(page.getByText('Уверенный отчёт', { exact: true })).toBeVisible()
})

test('does not reveal correct answers after failed attempts', async ({ page }) => {
  await writeBackendFixtureState(page, {
    progress: getChapterOneReviewableProgress(),
  })
  await page.goto('/chapters/chapter-1/missions/reviewable-or-not?qa=1')

  await page
    .getByRole('button', { name: /ИИ уверенно сообщил, что всё правильно/ })
    .click()
  await page.getByRole('button', { name: 'Проверить решение' }).click()

  const pickerDetails = page.getByLabel('Разбор ответа')
  const pickerRetryPrinciple = page.getByLabel('Подсказка для повторной попытки')

  await expect(pickerDetails).toBeVisible()
  await expect(pickerRetryPrinciple).toBeVisible()
  await expect(pickerRetryPrinciple).toContainText('Вспомнить правило')
  await expect(pickerRetryPrinciple).toContainText(/объём или уверенность/)
  await expect(pickerDetails).toContainText('Ловушка: Уверенный отчёт')
  await expect(page.getByText('Пропущено', { exact: true })).toHaveCount(0)
  await expect(pickerDetails).not.toContainText(
    'Один результат легче понять, проверить и объяснить на ревью.',
  )
  await expect(pickerDetails).not.toContainText(
    'Критерий приёмки говорит автору и ревьюеру',
  )
  await expect(pickerDetails).not.toContainText(
    'Автор принимает инженерное решение',
  )

  await writeBackendFixtureState(page, {
    progress: getChapterOneMissionProgress([
      'who-owns-the-diff',
      'reviewable-or-not',
      'spot-the-ai-risk',
    ]),
  })
  await page.goto('/chapters/chapter-1/missions/self-review-assembly?qa=1')

  for (const chipName of [
    /отметить ИИ-помощь/i,
    /запустить проверки/i,
    /проверить, что секреты/i,
    /убрать лишнее форматирование/i,
    /объяснить существенные изменения/i,
    /сверить набор изменений/i,
  ]) {
    await page.getByRole('button', { name: chipName }).click()
  }

  await page.getByRole('button', { name: 'Проверить решение' }).click()

  const orderingDetails = page.getByLabel('Разбор ответа')
  const orderingRetryPrinciple = page.getByLabel(
    'Подсказка для повторной попытки',
  )

  await expect(orderingDetails).toBeVisible()
  await expect(orderingRetryPrinciple).toBeVisible()
  await expect(orderingRetryPrinciple).toContainText(/две разные границы/)
  await expect(orderingDetails).toContainText('Порядок не сошёлся')
  await expect(orderingDetails).not.toContainText('а нужен шаг')
  await expect(orderingDetails).not.toContainText('не хватает шага')
  await expect(orderingDetails).not.toContainText(
    'Сверить набор изменений с заявленной задачей',
  )
})

test('assembles the final playbook prompt contract scene', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openChapterEightPromptAssembly(page)

  await expect(page.locator('.mission-brief')).toContainText(
    'Сцена 8.3 · Prompt-контракт · 0/7 собрано',
  )
  await expect(page.locator('.mission-brief')).toContainText(
    'Один e2e-сценарий, маленький diff, проверка до ревью',
  )
  await expect(page.getByLabel('Рабочая ситуация')).toHaveCount(0)
  await expect(page.locator('.prompt-assembly-coach')).toHaveCount(0)
  await expect(page.getByLabel('Слоты prompt-контракта')).toContainText(
    'План до правок',
  )
  await expect(page.getByLabel('Prompt Contract Canvas')).toBeVisible()
  await expect(page.getByLabel('Банк фрагментов')).toContainText(
    'Фрагменты',
  )
  await expect(page.getByLabel('Банк фрагментов')).toContainText('21 карточка')
  await expect(page.getByLabel('Прогресс сборки')).toContainText('0/7')
  await expect(page.locator('.prompt-active-slot')).toHaveCount(0)
  await expect(page.locator('.prompt-micro-brief')).toHaveCount(0)
  await expect(page.locator('.mission-feedback')).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Вернуться к брифингу' }),
  ).toHaveAttribute('href', /\/chapters\/chapter-8$/)

  const fragmentHelp = page.getByRole('button', {
    name: 'О подсказках фрагментов',
  })
  await fragmentHelp.click()
  await expect(fragmentHelp).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('tooltip')).toContainText(
    'Полный фрагмент открыт по i',
  )
  await fragmentHelp.click()

  await page.locator('.mission-brief-dossier-button').click()
  await expect(
    page.getByRole('dialog', { name: 'Бриф prompt-контракта' }),
  ).toContainText('Входящее задание от Kilian')
  await expect(
    page.getByRole('dialog', { name: 'Бриф prompt-контракта' }),
  ).toContainText('Опасность')
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('dialog', { name: 'Бриф prompt-контракта' }),
  ).toHaveCount(0)

  await page
    .getByRole('button', { name: 'Детали фрагмента Видимое поведение' })
    .click()
  await expect(page.getByRole('dialog', { name: 'Prompt-досье' })).toContainText(
    'Фрагмент',
  )
  await expect(page.getByLabel('Детали фрагмента', { exact: true })).toContainText(
    'Добавь или усили один e2e-сценарий',
  )
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Prompt-досье' })).toHaveCount(0)

  await assembleCorrectPromptContract(page)
  await page.getByRole('button', { name: 'Проверить решение' }).click()

  await expect(page.getByText('Сцена зачтена')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Следующая сцена' })).toBeVisible()
  await expect(
    page.getByLabel('Слоты prompt-контракта'),
  ).toContainText('Сначала план, файлы, риски и подтверждение')

  const bounds = await page.evaluate(() => {
    function toRect(selector: string) {
      const element = document.querySelector(selector)

      if (!element) {
        return null
      }

      const rect = element.getBoundingClientRect()

      return {
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        top: rect.top,
      }
    }

    return {
      actions: toRect('.mission-actions'),
      bank: toRect('.prompt-fragment-bank'),
      briefScrollOverflow: Math.max(
        0,
        (document.querySelector('.mission-brief')?.scrollHeight ?? 0) -
          (document.querySelector('.mission-brief')?.clientHeight ?? 0),
      ),
      canvas: toRect('.prompt-contract-canvas'),
      consolePanel: toRect('.mission-console'),
      feedback: toRect('.mission-feedback'),
      fragmentRailOverflow: Math.max(
        0,
        (document.querySelector('.prompt-fragment-grid')?.scrollWidth ?? 0) -
          (document.querySelector('.prompt-fragment-grid')?.clientWidth ?? 0),
      ),
      fragmentRailOverflowStyle: getComputedStyle(
        document.querySelector('.prompt-fragment-grid') as HTMLElement,
      ).overflowX,
      maxPreviewOverflow: Math.max(
        0,
        ...Array.from(
          document.querySelectorAll(
            '.prompt-fragment-preview, .prompt-contract-slot-preview',
          ),
        ).map((preview) => preview.scrollHeight - preview.clientHeight),
      ),
      pageOverflowX: document.documentElement.scrollWidth - window.innerWidth,
      slots: toRect('.prompt-contract-rail'),
    }
  })

  if (
    !bounds.actions ||
    !bounds.bank ||
    !bounds.canvas ||
    !bounds.consolePanel ||
    !bounds.feedback ||
    !bounds.slots
  ) {
    throw new Error('Expected prompt assembly layout elements to render')
  }

  expect(bounds.pageOverflowX).toBeLessThanOrEqual(0)
  expect(bounds.briefScrollOverflow).toBeLessThanOrEqual(1)
  expect(bounds.fragmentRailOverflow).toBeLessThanOrEqual(1)
  expect(bounds.fragmentRailOverflowStyle).toBe('hidden')
  expect(bounds.actions.bottom).toBeLessThanOrEqual(
    bounds.consolePanel.bottom + 1,
  )
  expect(bounds.bank.bottom).toBeLessThanOrEqual(bounds.consolePanel.bottom + 1)
  expect(bounds.canvas.bottom).toBeLessThanOrEqual(
    bounds.consolePanel.bottom + 1,
  )
  expect(bounds.slots.bottom).toBeLessThanOrEqual(bounds.consolePanel.bottom + 1)
  expect(bounds.feedback.bottom).toBeGreaterThan(bounds.feedback.top)
  expect(bounds.maxPreviewOverflow).toBeLessThanOrEqual(1)
})

test('labels unplaced prompt fragments as actions after the canvas is filled', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openChapterEightPromptAssembly(page)

  await assembleCorrectPromptContract(page)

  const unplacedStatuses = await page
    .locator(
      '.prompt-fragment-card:not(.prompt-fragment-card-used) .prompt-fragment-card-main small',
    )
    .allTextContents()
  const placedStatuses = await page
    .locator('.prompt-fragment-card-used .prompt-fragment-card-main small')
    .allTextContents()

  expect(unplacedStatuses).toHaveLength(14)
  expect(new Set(unplacedStatuses)).toEqual(
    new Set(['Добавить в выбранный слот']),
  )
  expect(unplacedStatuses).not.toContain('В слот: План до правок')
  expect(placedStatuses).toHaveLength(7)
  expect(placedStatuses).toEqual(
    expect.arrayContaining([
      'В слоте: Цель',
      'В слоте: Контекст',
      'В слоте: Границы',
      'В слоте: Запреты',
      'В слоте: Критерии',
      'В слоте: Проверка',
      'В слоте: План до правок',
    ]),
  )
  expect(placedStatuses).not.toContain('В текущем слоте')
  await expect(
    page.getByRole('button', {
      name: /Добавить фрагмент Зелёный прогон в выбранный слот: План до правок/,
    }),
  ).toBeVisible()
})

test('keeps prompt assembly canvas-first layout usable across target viewports', async ({
  page,
}) => {
  const viewports = [
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
    { width: 920, height: 720 },
    { width: 390, height: 844 },
  ]

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await openChapterEightPromptAssembly(page)

    const metrics = await page.evaluate(() => {
      function toRect(selector: string) {
        const element = document.querySelector(selector)

        if (!element) {
          return null
        }

        const rect = element.getBoundingClientRect()

        return {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width,
        }
      }

      const fragmentRail = document.querySelector('.prompt-fragment-grid')
      const brief = document.querySelector('.mission-brief')

      return {
        actions: toRect('.mission-actions'),
        briefScrollOverflow: Math.max(
          0,
          (brief?.scrollHeight ?? 0) - (brief?.clientHeight ?? 0),
        ),
        canvas: toRect('.prompt-contract-canvas'),
        fragmentBank: toRect('.prompt-fragment-bank'),
        fragmentCardCount: document.querySelectorAll('.prompt-fragment-card')
          .length,
        fragmentRailOverflow: Math.max(
          0,
          (fragmentRail?.scrollWidth ?? 0) - (fragmentRail?.clientWidth ?? 0),
        ),
        fragmentRailOverflowStyle: fragmentRail
          ? getComputedStyle(fragmentRail).overflowX
          : '',
        horizontalOverflow:
          document.documentElement.scrollWidth - window.innerWidth,
        layout: toRect('.mission-layout'),
        maxPreviewOverflow: Math.max(
          0,
          ...Array.from(
            document.querySelectorAll(
              '.prompt-fragment-preview, .prompt-contract-slot-preview',
            ),
          ).map((preview) => preview.scrollHeight - preview.clientHeight),
        ),
        workspace: toRect('.prompt-fragment-workspace'),
        removedLeftPanelCount:
          document.querySelectorAll('.prompt-active-slot, .prompt-micro-brief')
            .length,
      }
    })

    if (
      !metrics.actions ||
      !metrics.canvas ||
      !metrics.fragmentBank ||
      !metrics.layout ||
      !metrics.workspace
    ) {
      throw new Error(`Prompt layout did not render at ${viewport.width}px`)
    }

    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0)
    expect(metrics.briefScrollOverflow).toBeLessThanOrEqual(1)
    expect(metrics.fragmentRailOverflow).toBeLessThanOrEqual(1)
    expect(metrics.fragmentRailOverflowStyle).toBe('hidden')
    expect(metrics.fragmentCardCount).toBe(21)
    expect(metrics.maxPreviewOverflow).toBeLessThanOrEqual(1)
    expect(metrics.removedLeftPanelCount).toBe(0)

    if (viewport.width <= 760) {
      expect(metrics.canvas.top).toBeLessThanOrEqual(metrics.workspace.top)
      expect(metrics.fragmentBank.width).toBeGreaterThanOrEqual(260)
    } else {
      expect(metrics.canvas.left).toBeGreaterThan(metrics.workspace.left)
      expect(metrics.fragmentBank.height).toBeGreaterThanOrEqual(240)
    }
  }
})

test('keeps prompt assembly retries non-leaking and resettable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openChapterEightPromptAssembly(page)

  await page
    .getByRole('button', { name: 'Детали фрагмента Расширить заодно' })
    .click()
  await expect(
    page.getByLabel('Детали фрагмента', { exact: true }),
  ).toContainText('Если заметишь устаревшие e2e-паттерны')
  await expect(
    page.getByRole('dialog', { name: 'Prompt-досье' }),
  ).not.toContainText(
    'Фрагмент открывает соседний рефакторинг',
  )
  await expect(
    page.getByRole('dialog', { name: 'Prompt-досье' }),
  ).not.toContainText('too-broad')
  await page
    .getByRole('button', { exact: true, name: 'Поставить в: Цель' })
    .click()
  await expect(page.locator('.prompt-contract-slot-filled')).toHaveCount(1)
  await page.getByRole('button', { name: 'Сбросить' }).click()
  await expect(page.locator('.prompt-contract-slot-filled')).toHaveCount(0)

  await placePromptFragment(page, 'Цель', /Обновить весь e2e-каталог заодно/)
  await placePromptFragment(page, 'Контекст', /Бриф, ближайший spec/)
  await placePromptFragment(
    page,
    'Границы',
    /Один поток и ближайшие файлы теста/,
  )
  await placePromptFragment(
    page,
    'Запреты',
    /Не трогать соседние сценарии/,
  )
  await placePromptFragment(page, 'Критерии', /Тест ловит регресс/)
  await placePromptFragment(
    page,
    'Проверка',
    /Назвать команду или ручной сценарий проверки/,
  )
  await placePromptFragment(
    page,
    'План до правок',
    /Сначала план, файлы, риски и подтверждение/,
  )
  await page.getByRole('button', { name: 'Проверить решение' }).click()

  const details = page.getByLabel('Разбор ответа')
  const retryPrinciple = page.getByLabel('Подсказка для повторной попытки')

  await expect(page.getByText('Нужно допроверить')).toBeVisible()
  await expect(retryPrinciple).toContainText(/цель, контекст, границы/)
  await expect(details).toContainText('Ловушка: Слишком широко')
  await expect(details).not.toContainText(
    'Добавь или усили один e2e-сценарий',
  )
  await expect(details).not.toContainText(
    'После изменений назови конкретную команду',
  )
  await expect(page.getByText('Пропущено', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Пересобрать ход' }).click()
  await expect(page.getByText('Нужно допроверить')).toHaveCount(0)
  await expect(page.locator('.prompt-contract-slot-filled')).toHaveCount(0)

  await assembleCorrectPromptContract(page)
  await page.getByRole('button', { name: 'Проверить решение' }).click()
  await expect(page.getByText('Сцена зачтена')).toBeVisible()
})

test('records canonical trap discoveries across reloads', async ({ page }) => {
  const fixture = await writeBackendFixtureState(page, {
    progress: getChapterOneReviewableProgress(),
  })
  await page.goto('/chapters/chapter-1/missions/reviewable-or-not?qa=1')

  await page
    .getByRole('button', { name: /ИИ уверенно сообщил, что всё правильно/ })
    .click()
  await page.getByRole('button', { name: 'Проверить решение' }).click()

  const trapPanel = page.locator('.trap-discovery-panel')

  await expect(trapPanel).toBeVisible()
  await expect(trapPanel).toContainText('Ловушка обнаружена')
  await expect(trapPanel).toContainText('Уверенный отчёт')
  await expect(trapPanel).toContainText('Новая запись')
  await expect(
    page.getByText('Ловушка: Уверенный отчёт', { exact: true }),
  ).toBeVisible()

  expect(fixture.state.encounteredTrapIds).toContain('confident-report')

  await page.reload()
  await page
    .getByRole('button', { name: /ИИ уверенно сообщил, что всё правильно/ })
    .click()
  await page.getByRole('button', { name: 'Проверить решение' }).click()

  await expect(trapPanel).toBeVisible()
  await expect(trapPanel).toContainText('Уже встречалась')
})

test('keeps trap field guide entrypoint hidden until a canonical trap is found', async ({
  page,
}) => {
  await writeBackendFixtureState(page, {
    progress: getChapterOneMissionProgress([]),
  })

  await page.goto('/map?qa=1')

  await expect(
    page.getByRole('link', { name: 'Справочник ловушек' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Доска лидеров' }),
  ).toBeVisible()

  await page.goto('/field-guide?qa=1')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Справочник ловушек' }),
  ).toBeVisible()
  await expect(page.getByText('Записей пока нет')).toBeVisible()
})

test('shows session-only trap field guide intro on the map after the first canonical trap', async ({
  page,
}) => {
  await writeBackendFixtureState(page, {
    progress: getChapterOneReviewableProgress(),
  })
  await page.goto('/chapters/chapter-1/missions/reviewable-or-not?qa=1')

  await page
    .getByRole('button', { name: /ИИ уверенно сообщил, что всё правильно/ })
    .click()
  await page.getByRole('button', { name: 'Проверить решение' }).click()
  await expect(page.locator('.trap-discovery-panel')).toContainText(
    'Новая запись',
  )

  await page.goto('/map?qa=1')

  const mentorDialog = page.getByLabel('Диалог Kilian')

  await expect(
    page.getByRole('link', { name: 'Справочник ловушек' }),
  ).toBeVisible()
  await expect(mentorDialog).toContainText(
    'Новая механика: память ловушек',
  )
  await expect(mentorDialog).toContainText('Я завёл справочник')

  await page.locator('.map-node-hotspot-locked').first().hover()

  await expect(mentorDialog).toContainText(
    'Новая механика: память ловушек',
  )
  await expect(mentorDialog).toContainText('Я завёл справочник')

  await page.reload()

  await expect(mentorDialog).toContainText(
    'Новая механика: память ловушек',
  )

  await mentorDialog.getByRole('button', { name: 'Понял' }).click()

  await expect(mentorDialog).not.toContainText(
    'Новая механика: память ловушек',
  )
  await expect(
    page.getByRole('link', { name: 'Справочник ловушек' }),
  ).toBeVisible()

  await page.reload()

  await expect(
    page.getByRole('link', { name: 'Справочник ловушек' }),
  ).toBeVisible()
  await expect(mentorDialog).toContainText(
    'Новая механика: память ловушек',
  )
})

test('waits for the fresh unlock cue before showing the trap field guide intro', async ({
  page,
}) => {
  await seedBackendFixtureState(page, {
    encounteredTrapIds: ['confident-report'],
    pendingUnlockChapterId: 'chapter-3',
    progress: getChapterTwoCompletedProgress(),
  })
  await page.goto('/map?qa=1')

  const mentorDialog = page.getByLabel('Диалог Kilian')

  await expect(mentorDialog).toContainText('Открыт новый узел')
  await expect(mentorDialog).not.toContainText(
    'Новая механика: память ловушек',
  )

  await expect(mentorDialog).toContainText(
    'Новая механика: память ловушек',
    { timeout: 6000 },
  )
})

test('opens the trap field guide from the session map intro', async ({
  page,
}) => {
  await writeBackendFixtureState(page, {
    encounteredTrapIds: ['confident-report'],
    progress: getChapterOneReviewableProgress(),
  })
  await page.goto('/map?qa=1')

  const mentorDialog = page.getByLabel('Диалог Kilian')

  await expect(mentorDialog).toContainText(
    'Новая механика: память ловушек',
  )
  await mentorDialog
    .getByRole('button', { name: 'Открыть справочник' })
    .click()

  await expect(page).toHaveURL(/\/field-guide$/)
  await expect(page.getByText('Уверенный отчёт', { exact: true })).toBeVisible()
})

test('opens trap field guide for encountered canonical traps across reloads', async ({
  page,
}) => {
  await writeBackendFixtureState(page, {
    progress: getChapterOneReviewableProgress(),
  })
  await page.goto('/chapters/chapter-1/missions/reviewable-or-not?qa=1')

  await page
    .getByRole('button', { name: /ИИ уверенно сообщил, что всё правильно/ })
    .click()
  await page.getByRole('button', { name: 'Проверить решение' }).click()

  await page.getByRole('link', { name: 'Открыть справочник' }).click()

  await expect(
    page.getByRole('heading', { level: 1, name: 'Справочник ловушек' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Открытые ловушки' }),
  ).toBeVisible()
  await expect(page.getByText('Уверенный отчёт', { exact: true })).toBeVisible()
  await expect(page.getByText('Слишком широко', { exact: true })).toHaveCount(0)

  await page.reload()

  await expect(page.getByText('Уверенный отчёт', { exact: true })).toBeVisible()
  await expect(page.getByText('Слишком широко', { exact: true })).toHaveCount(0)
})

test('keeps chapter-specific trap labels out of trap memory', async ({
  page,
}) => {
  const fixture = await seedChapterOneReviewableMission(page)
  await page.goto('/chapters/chapter-1/missions/reviewable-or-not?qa=1')

  await page
    .getByRole('button', { name: /Ревьюер сам восстановит контекст/ })
    .click()
  await page.getByRole('button', { name: 'Проверить решение' }).click()

  await expect(
    page.getByText('Ловушка: Переложенная проверка', { exact: true }),
  ).toBeVisible()
  await expect(page.locator('.trap-discovery-panel')).toHaveCount(0)

  expect(fixture.state.encounteredTrapIds).toEqual([])

  await page.goto('/map?qa=1')
  await expect(
    page.getByRole('link', { name: 'Справочник ловушек' }),
  ).toHaveCount(0)

  await page.goto('/field-guide')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Справочник ловушек' }),
  ).toBeVisible()
  await expect(page.getByText('Переложенная проверка')).toHaveCount(0)
  await expect(page.getByText('Записей пока нет')).toBeVisible()
})

test('reveals failed boss dossier details and clears them on retry', async ({
  page,
}) => {
  await openChapterOneBoss(page)

  await page
    .getByRole('button', { name: /Целевая модалка показывает предупреждение/ })
    .click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  await expect(page.getByText(/первый ход сохранён в досье/)).toBeVisible()

  const dossierToggle = page.getByRole('button', {
    name: /Открыть журнал раундов/,
  })

  await expect(dossierToggle).toBeVisible()
  await expect(dossierToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(dossierToggle).toHaveClass(/boss-dossier-toggle-cued/)
  await dossierToggle.click()
  await expect(page.getByText(/первый ход сохранён в досье/)).toHaveCount(0)

  const dossier = page.getByRole('dialog', { name: 'Досье боя' })
  await expect(
    dossier.getByText('Раунд зафиксирован', { exact: true }),
  ).toBeVisible()
  await expect(
    dossier
      .getByLabel('Разбор выбранного раунда')
      .getByText(/Целевая модалка/),
  ).toBeVisible()
  await expect(dossier.getByText('Очищено')).toHaveCount(0)
  await expect(dossier.getByText('Нужен разбор')).toHaveCount(0)
  await expect(dossier.getByText(/Ловушка:/)).toHaveCount(0)
  await expect(dossier.getByLabel('Итог раунда от Kilian')).toHaveCount(0)
  await expect(dossierToggle).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Досье боя' })).toHaveCount(0)
  await expect(dossierToggle).toHaveAttribute('aria-expanded', 'false')

  await page
    .getByRole('button', { name: /особенно посмотри права и общий хук/ })
    .click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()

  await page
    .getByRole('button', { name: /Снимки интерфейса обновились/ })
    .click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()

  await page
    .getByRole('button', {
      name: /Открыть пул-реквест вместе с `useDangerousActionGuard`/,
    })
    .click()
  await page.getByRole('button', { name: 'Проверить финал' }).click()

  await expect(page.getByText('Щиты держатся')).toBeVisible()
  await expect(
    page
      .locator('.mission-feedback')
      .getByLabel('Подсказка для повторной попытки', { exact: true }),
  ).toContainText(/автор пул-реквеста/)
  await expect(dossier).toBeVisible()
  await expect(dossier.getByText('Нужен разбор')).toHaveCount(4)
  await expect(
    dossier.getByText('Ловушка: Тест, который ничего не доказывает'),
  ).toBeVisible()
  await expect(dossier.getByText(/Снимок не объясняет/)).toBeVisible()
  await expect(
    dossier.getByLabel('Подсказка для повторной попытки раунда'),
  ).toContainText(/доказательством результата/)
  await expect(dossier.getByLabel('Итог раунда от Kilian')).toBeVisible()
  await expect(dossier.getByLabel('Итог раунда от Kilian')).toContainText(
    /В заметке к ревью называй границы/,
  )

  const dossierBounds = await page.evaluate(() => {
    const overlay = document
      .querySelector('.boss-dossier-overlay')
      ?.getBoundingClientRect()
    const panel = document
      .querySelector('.boss-dossier-panel')
      ?.getBoundingClientRect()

    return {
      overlayLeft: overlay?.left ?? 0,
      overlayWidth: overlay?.width ?? 0,
      panelLeft: panel?.left ?? 0,
      panelWidth: panel?.width ?? 0,
    }
  })

  expect(dossierBounds.panelLeft).toBeLessThanOrEqual(
    dossierBounds.overlayLeft + 4,
  )
  expect(dossierBounds.panelWidth).toBeGreaterThanOrEqual(
    dossierBounds.overlayWidth - 8,
  )

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Досье боя' })).toHaveCount(0)
  await expect(dossierToggle).toHaveAttribute('aria-expanded', 'false')

  await page.getByRole('button', { name: 'Пересобрать ход' }).click()
  await expect(page.getByRole('dialog', { name: 'Досье боя' })).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: /Открыть журнал раундов/ }),
  ).toHaveCount(0)
  await expect(page.getByText(/сохранён в досье/)).toHaveCount(0)
  await expect(page.getByText('Раунд 1 из 4')).toBeVisible()

  await page
    .getByRole('button', { name: /Целевая модалка показывает предупреждение/ })
    .click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  await expect(page.getByRole('dialog', { name: 'Досье боя' })).toHaveCount(0)
  await expect(page.getByText(/первый ход сохранён в досье/)).toBeVisible()
})

test('completes chapter 3 boss ordering round with pointer clicks', async ({
  page,
}) => {
  await writeBackendFixtureState(page, {
    progress: getChapterThreeBossReadyProgress(),
  })
  await page.goto('/chapters/chapter-3/missions/plan-gate?qa=1')

  for (const chipName of [
    /Изменение бизнес-логики/,
    /Баг в старом коде/,
    /Тесты должны закрепить контракт/,
    /Задача затрагивает несколько экранов/,
  ]) {
    await page.getByRole('button', { name: chipName }).click()
  }
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()

  for (const chipName of [
    /Не названы конкретные файлы/,
    /“поправлю всё связанное”/,
    /Улучшение helper-ов/,
    /без конкретной команды/,
  ]) {
    await page.getByRole('button', { name: chipName }).click()
  }
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()

  await page
    .getByRole('button', { name: /Разрешить изменения строго по этому плану/ })
    .click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  await expect(page.getByText('Раунд 4 из 4')).toBeVisible()

  for (const chipName of [
    /Выполнить evidence/,
    /Авторский self-review/,
    /Итог в заметке/,
    /Проверочный след/,
    /Остаточный риск/,
  ]) {
    await page.getByRole('button', { name: chipName }).click()
  }

  const orderTrack = page.getByLabel('Текущий порядок')

  await expect(orderTrack.getByRole('button')).toHaveCount(5)
  await expect(
    page.getByRole('button', { name: 'Проверить финал' }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Проверить финал' }).click()
  await expect(
    page.getByRole('heading', { name: 'Босс повержен' }),
  ).toBeVisible()
})

test('keeps boss controls inside the arena and resets current round safely', async ({
  page,
}) => {
  const pageErrors: string[] = []

  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  await page.setViewportSize({ width: 1580, height: 900 })
  await writeBackendFixtureState(page, {
    learner: {
      id: 'layout-boss-agent',
      nickname: 'layout-boss',
      fullName: 'Layout Boss',
    },
    progress: getChapterSixBossReadyProgress(),
  })
  await page.goto('/chapters/chapter-6/missions/token-gate?qa=1')
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Финальный бой за окно внимания',
    }),
  ).toBeVisible()

  await page
    .getByRole('button', { name: /Одна опечатка в тексте кнопки/ })
    .click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  await expect(page.getByText('Раунд 2 из 4')).toBeVisible()
  await expect(page.getByText(/первый ход сохранён в досье/)).toBeVisible()

  const submitButton = page.getByRole('button', {
    name: 'Зафиксировать раунд',
  })
  const resetButton = page.getByRole('button', { name: 'Сбросить' })

  await expect(submitButton).toBeInViewport()
  await expect(resetButton).toBeInViewport()

  const bounds = await page.evaluate(() => {
    const frame = document.querySelector('.mission-screen')?.getBoundingClientRect()
    const actions = document
      .querySelector('.mission-actions')
      ?.getBoundingClientRect()
    const consolePanel = document
      .querySelector('.mission-console')
      ?.getBoundingClientRect()

    return {
      actionsBottom: actions?.bottom ?? 0,
      consoleBottom: consolePanel?.bottom ?? 0,
      frameBottom: frame?.bottom ?? 0,
    }
  })

  expect(bounds.actionsBottom).toBeLessThanOrEqual(bounds.consoleBottom + 1)
  expect(bounds.actionsBottom).toBeLessThanOrEqual(bounds.frameBottom + 1)

  const contextBriefChip = page.getByRole('button', {
    name: /Бриф: цель, границы, запреты и критерии/,
  })

  await contextBriefChip.click()
  await expect(contextBriefChip).toHaveAttribute('aria-pressed', 'true')
  await resetButton.click()
  await expect(page.getByText('Раунд 2 из 4')).toBeVisible()
  await expect(contextBriefChip).toHaveAttribute('aria-pressed', 'false')

  await contextBriefChip.click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  await page
    .getByRole('button', { name: /Остановить изменения/ })
    .click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  await expect(page.getByText('Раунд 4 из 4')).toBeVisible()
  await expect(page.getByLabel('Прогресс соединения пар')).toContainText('0/5')

  await assignPairTarget(page, /Состояние результата:/, 'State of result')
  await assignPairTarget(page, /Чистка diff:/, 'Diff cleanup')
  await assignPairTarget(page, /Доказательства:/, 'Evidence trail')
  await assignPairTarget(page, /Полезная память:/, 'Reusable workflow memory')
  await assignPairTarget(page, /Плохой кейс:/, 'Known bad case')
  await expect(page.getByLabel('Прогресс соединения пар')).toContainText('5/5')

  const pairBounds = await page.evaluate(() => {
    const frame = document.querySelector('.mission-screen')?.getBoundingClientRect()
    const actions = document
      .querySelector('.mission-actions')
      ?.getBoundingClientRect()
    const consolePanel = document
      .querySelector('.mission-console')
      ?.getBoundingClientRect()
    const pairBoard = document
      .querySelector('.pair-matching-board')
      ?.getBoundingClientRect()

    return {
      actionsBottom: actions?.bottom ?? 0,
      bodyOverflowX: document.documentElement.scrollWidth - window.innerWidth,
      consoleBottom: consolePanel?.bottom ?? 0,
      frameBottom: frame?.bottom ?? 0,
      pairBoardBottom: pairBoard?.bottom ?? 0,
      pairBoardTop: pairBoard?.top ?? 0,
    }
  })

  expect(pairBounds.pairBoardTop).toBeGreaterThan(0)
  expect(pairBounds.pairBoardBottom).toBeGreaterThan(pairBounds.pairBoardTop)
  expect(pairBounds.actionsBottom).toBeLessThanOrEqual(
    pairBounds.consoleBottom + 1,
  )
  expect(pairBounds.actionsBottom).toBeLessThanOrEqual(
    pairBounds.frameBottom + 1,
  )
  expect(pairBounds.bodyOverflowX).toBeLessThanOrEqual(1)
  expect(pageErrors).toEqual([])
})

test('completes the reworked ordering and pair-matching rounds', async ({
  page,
}) => {
  const pageErrors: string[] = []

  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  await writeBackendFixtureState(page, {
    progress: createProgressState({
      completedChapterIds: getChapterIdsBeforeOrder(7),
      completedMissionIdsByChapter: {
        'chapter-7': [
          'evidence-before-review',
          'verification-matrix-builder',
          'observable-checks',
        ],
      },
      openChapterId: 'chapter-7',
    }),
  })
  await page.goto('/chapters/chapter-7/missions/reviewer-note-order?qa=1')
  for (const chipName of [
    /Результат:/,
    /Доказательства:/,
    /Доменный источник:/,
    /Остаточный риск:/,
    /Фокус ревью:/,
  ]) {
    await page.getByRole('button', { name: chipName }).click()
  }
  await page.getByRole('button', { name: 'Проверить решение' }).click()
  await expect(page.getByText('Сцена зачтена')).toBeVisible()

  await writeBackendFixtureState(page, {
    progress: getChapterSixBossReadyProgress(),
  })
  await page.goto('/chapters/chapter-6/missions/token-gate?qa=1')
  for (const chipName of [
    /Одна опечатка/,
    /Повторить существующий паттерн/,
    /Изменить биллинговую логику/,
    /Самопроверка пул-реквеста/,
  ]) {
    await page.getByRole('button', { name: chipName }).click()
  }
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  for (const chipName of [
    /Бриф: цель/,
    /ближайший e2e-пример формы/,
    /npm run test:e2e/,
    /доступные labels/,
    /не переписывать тестовые данные/,
  ]) {
    await page.getByRole('button', { name: chipName }).click()
  }
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  await page
    .getByRole('button', { name: /Остановить изменения/ })
    .click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  await expect(page.getByText('Раунд 4 из 4')).toBeVisible()
  await assignPairTarget(page, /Состояние результата:/, 'State of result')
  await assignPairTarget(page, /Чистка diff:/, 'Diff cleanup')
  await assignPairTarget(page, /Доказательства:/, 'Evidence trail')
  await assignPairTarget(page, /Полезная память:/, 'Reusable workflow memory')
  await assignPairTarget(page, /Плохой кейс:/, 'Known bad case')
  await page.getByRole('button', { name: 'Проверить финал' }).click()
  await expect(
    page.getByRole('heading', { name: 'Босс повержен' }),
  ).toBeVisible()

  await writeBackendFixtureState(page, {
    progress: getChapterSevenBossReadyProgress(),
  })
  await page.goto('/chapters/chapter-7/missions/verification-gate?qa=1')
  for (const chipName of [
    /Сборка\/lint/,
    /Точечный регрессионный тест/,
    /пользователь видит предупреждение/,
    /Доменное правило:/,
    /Записать крайние случаи/,
  ]) {
    await page.getByRole('button', { name: chipName }).click()
  }
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  await page.getByRole('button', { name: /Переделать тест/ }).click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  for (const chipName of [
    /Актуальная спецификация/,
    /Подтверждение владельца домена/,
    /Существующий эталонный тест/,
  ]) {
    await page.getByRole('button', { name: chipName }).click()
  }
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  for (const chipName of [
    /Результат:/,
    /Доказательства:/,
    /Доменный источник:/,
    /Остаточный риск:/,
    /Фокус ревью:/,
  ]) {
    await page.getByRole('button', { name: chipName }).click()
  }
  await page.getByRole('button', { name: 'Проверить финал' }).click()
  await expect(
    page.getByRole('heading', { name: 'Босс повержен' }),
  ).toBeVisible()

  await writeBackendFixtureState(page, {
    progress: getChapterEightBossReadyProgress(),
  })
  await page.goto('/chapters/chapter-8/missions/playbook-gate?qa=1')
  for (const chipName of [
    /Playwright\/e2e-тесты/,
    /Самопроверка перед пул-реквестом/,
    /Серверные заготовки/,
    /Баг \+ очищенные логи/,
  ]) {
    await page.getByRole('button', { name: chipName }).click()
  }
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  await page
    .getByRole('button', { name: /Применять: один пользовательский сценарий/ })
    .click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  await expect(page.getByText('Раунд 3 из 4')).toBeVisible()
  for (const chipName of [
    /Назначение:/,
    /Применимость:/,
    /Входы\/rules\/skills:/,
    /Prompt-каркас:/,
    /Workflow:/,
    /Приёмка\/проверка:/,
    /Известные плохие кейсы:/,
    /Примеры\/обновление:/,
  ]) {
    await page.getByRole('button', { name: chipName }).click()
  }
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  await page
    .getByRole('button', { name: /Оставить статус черновика\/пилота/ })
    .click()
  await page.getByRole('button', { name: 'Проверить финал' }).click()
  await expect(
    page.getByRole('heading', { name: 'Босс повержен' }),
  ).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('keeps long boss round briefs contained on narrow viewports', async ({
  page,
}) => {
  await page.setViewportSize({ width: 710, height: 456 })
  await writeBackendFixtureState(page, {
    progress: getChapterOneMissionProgress([
      'who-owns-the-diff',
      'reviewable-or-not',
      'spot-the-ai-risk',
      'self-review-assembly',
    ]),
  })
  await page.goto('/chapters/chapter-1/missions/ship-or-stop?qa=1')
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Финальный бой за пул-реквест',
    }),
  ).toBeVisible()

  const bossRoundDots = page.locator('.boss-round-dot')
  const expectedRoundLabels = [
    'Раунд 1: сканер риска',
    'Раунд 2: ход автора',
    'Раунд 3: заряд доказательств',
    'Раунд 4: ревью-шлюз',
  ]

  for (const [index, label] of expectedRoundLabels.entries()) {
    await expect(bossRoundDots.nth(index)).toHaveAttribute('aria-label', label)
  }

  await page
    .getByRole('button', { name: /`canDeleteProject` меняет поведение/ })
    .click()
  await page
    .getByRole('button', { name: /Новый общий guard меняет тексты/ })
    .click()
  await page
    .getByRole('button', { name: /Тест кликает “Удалить”/ })
    .click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  await page
    .getByRole('button', { name: /Сузить пул-реквест до модалки/ })
    .click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()

  for (const chipName of [
    /Границы: пул-реквест меняет только удаление проекта/,
    /Проверка покрывает сценарии/,
    /Доменное правило сверено/,
    /В заметке к ревью указано/,
  ]) {
    await page.getByRole('button', { name: chipName }).click()
  }

  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()
  await expect(page.getByText('Раунд 4 из 4')).toBeVisible()
  await expect(page.getByText('Раунд 4: ревью-шлюз')).toBeVisible()

  const bounds = await page.evaluate(() => {
    function toRect(selector: string) {
      const element = document.querySelector(selector)

      if (!element) {
        return null
      }

      const rect = element.getBoundingClientRect()

      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      }
    }

    const brief = document.querySelector('.boss-round-brief')
    const briefStyles = brief ? getComputedStyle(brief) : null

    return {
      actions: toRect('.mission-actions'),
      arena: toRect('.boss-arena'),
      brief: toRect('.boss-round-brief'),
      briefClientHeight: brief?.clientHeight ?? 0,
      briefOverflowY: briefStyles?.overflowY ?? '',
      briefScrollHeight: brief?.scrollHeight ?? 0,
      choices: toRect('.choice-grid'),
      consolePanel: toRect('.mission-console'),
    }
  })

  if (
    !bounds.actions ||
    !bounds.arena ||
    !bounds.brief ||
    !bounds.choices ||
    !bounds.consolePanel
  ) {
    throw new Error('Expected boss layout elements to render')
  }

  expect(bounds.brief.top).toBeGreaterThanOrEqual(bounds.arena.top - 1)
  expect(bounds.brief.bottom).toBeLessThanOrEqual(bounds.arena.bottom + 1)
  expect(bounds.choices.top).toBeGreaterThanOrEqual(bounds.arena.bottom - 1)
  expect(bounds.actions.bottom).toBeLessThanOrEqual(
    bounds.consolePanel.bottom + 1,
  )
  expect(bounds.briefOverflowY).toBe('auto')
  expect(bounds.briefScrollHeight).toBeGreaterThan(bounds.briefClientHeight)
})

test('keeps successful boss completion connected to the reward route', async ({
  page,
}) => {
  await openChapterOneBoss(page)

  await page
    .getByRole('button', { name: /`canDeleteProject` меняет поведение/ })
    .click()
  await page
    .getByRole('button', { name: /Новый общий guard меняет тексты/ })
    .click()
  await page
    .getByRole('button', { name: /Тест кликает “Удалить”/ })
    .click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()

  await page
    .getByRole('button', { name: /Сузить пул-реквест до модалки/ })
    .click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()

  await page
    .getByRole('button', { name: /пул-реквест меняет только удаление проекта/ })
    .click()
  await page
    .getByRole('button', { name: /“есть активный деплой”/ })
    .click()
  await page
    .getByRole('button', { name: /Доменное правило сверено/ })
    .click()
  await page
    .getByRole('button', { name: /ИИ помогал с тестом/ })
    .click()
  await page.getByRole('button', { name: 'Зафиксировать раунд' }).click()

  await page
    .getByRole('button', { name: /Открыть пул-реквест без общего хука/ })
    .click()
  await page.getByRole('button', { name: 'Проверить финал' }).click()

  await expect(
    page.getByRole('heading', { name: 'Босс повержен' }),
  ).toBeVisible()
  await expect(
    page.getByRole('dialog', { name: 'Досье боя' }).getByText('Очищено'),
  ).toHaveCount(4)

  await page.getByRole('link', { name: 'Забрать награду' }).click()
  await expect(page).toHaveURL(/\/chapters\/chapter-1\/badge/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Ответственный автор' }),
  ).toBeVisible()
})
