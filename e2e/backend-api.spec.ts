import { expect, test } from '@playwright/test'
import { chapters } from '../src/entities/chapter/model/chapterCatalog'
import { staticContentVersion } from '../src/shared/api/content/staticContentRepository'
import {
  createBackendLearner,
  createBackendProgress,
  installBackendApiFixture,
} from './backendApiFixtures'

test('identifies a fresh learner through backend API fixtures', async ({
  page,
}) => {
  const fixture = await installBackendApiFixture(page)

  await page.goto('/?qa=1')
  await page.getByLabel('Позывной').fill('pilot-agent')
  await page.getByLabel('Имя и фамилия').fill('Pilot Agent')
  await page.getByRole('button', { name: 'Войти на карту' }).click()

  await expect(page).toHaveURL(/\/map$/)
  await expect(
    page.getByRole('heading', { name: 'Карта практик ИИ-разработки' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Глава 1: ИИ как инженерный инструмент/ }),
  ).toBeEnabled()
  expect(fixture.state.learner).toMatchObject({
    fullName: 'Pilot Agent',
    nickname: 'pilot-agent',
  })
  expect(fixture.requests.map((request) => `${request.method} ${request.path}`))
    .toEqual(
      expect.arrayContaining([
        'GET /api/me',
        'POST /api/pilot-sessions',
        'POST /api/learners/identify',
        'GET /api/progress',
      ]),
    )
})

test('loads backend progress, trap memory, and saves badge reflection', async ({
  page,
}) => {
  const learner = createBackendLearner({
    fullName: 'Route Pilot',
    id: 'route-pilot-1',
    nickname: 'route-pilot',
  })
  const fixture = await installBackendApiFixture(page, {
    encounteredTrapIds: ['confident-report'],
    learner,
    progress: createBackendProgress({
      completedChapterIds: ['chapter-1'],
      openChapterId: 'chapter-2',
    }),
  })

  await page.goto('/?qa=1')

  await expect(page).toHaveURL(/\/map$/)
  await expect(page.getByLabel('Профиль игрока')).toContainText('Diff Owner')
  await expect(
    page.getByRole('link', { name: 'Справочник ловушек' }),
  ).toBeVisible()

  await page.goto('/field-guide?qa=1')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Справочник ловушек' }),
  ).toBeVisible()
  await expect(page.getByText('Уверенный отчёт', { exact: true })).toBeVisible()

  await page.goto('/chapters/chapter-1/badge?qa=1')
  const reflection = page.locator('.reflection-card')
  const note =
    'На ближайшем ревью покажу цель, границы и одну проверку результата.'

  await expect(reflection).toBeVisible()
  await reflection.getByRole('button', { name: 'В ближайшем ревью' }).click()
  await reflection.getByLabel('Короткая заметка').fill(note)
  await reflection.getByRole('button', { name: 'Сохранить заметку' }).click()

  await expect(reflection).toContainText('Заметка сохранена')
  expect(fixture.state.reflections).toEqual([
    expect.objectContaining({
      chapterId: 'chapter-1',
      note,
      optionId: 'review',
      optionLabel: 'В ближайшем ревью',
      skipped: false,
    }),
  ])
  expect(fixture.requests.map((request) => `${request.method} ${request.path}`))
    .toEqual(
      expect.arrayContaining([
        'GET /api/me',
        'GET /api/progress',
        'GET /api/traps/discovered',
        'GET /api/chapter-reflections/chapter-1',
        'POST /api/chapter-reflections/chapter-1',
      ]),
    )
})

test('submits a mission through backend-only API without client-owned scoring', async ({
  page,
}) => {
  const learner = createBackendLearner({
    fullName: 'Submit Pilot',
    id: 'submit-pilot-1',
    nickname: 'submit-pilot',
  })
  const fixture = await installBackendApiFixture(page, { learner })

  await page.goto('/chapters/chapter-1/missions/who-owns-the-diff?qa=1')
  await page.getByRole('button', { name: /Остановиться/ }).click()
  await page.getByRole('button', { name: 'Проверить решение' }).click()

  await expect(page.getByText('Сцена зачтена')).toBeVisible()
  expect(
    fixture.state.progress.find((item) => item.chapterId === 'chapter-1')
      ?.completedMissionIds,
  ).toContain('who-owns-the-diff')

  const submitRequest = fixture.requests.find(
    (request) =>
      request.method === 'POST' &&
      request.path === '/api/missions/who-owns-the-diff/attempts',
  )

  expect(submitRequest).toBeDefined()
  expect(submitRequest?.body).toMatchObject({
    answer: 'stop-and-explain',
    chapterId: 'chapter-1',
  })
  expect(submitRequest?.body).not.toHaveProperty('source')
  expect(submitRequest?.body).not.toHaveProperty('score')
  expect(submitRequest?.body).not.toHaveProperty('isCorrect')
})

test('blocks a direct unopened mission submit through backend API fixtures', async ({
  page,
}) => {
  const chapter = chapters[0]
  const unopenedMission = chapter?.missions[1]
  const learner = createBackendLearner({
    fullName: 'Direct Submit Pilot',
    id: 'direct-submit-pilot-1',
    nickname: 'direct-submit',
  })
  const fixture = await installBackendApiFixture(page, { learner })

  if (!chapter || !unopenedMission) {
    throw new Error('Unopened mission fixture not found.')
  }

  await page.goto('/map?qa=1')

  const response = await page.evaluate(
    async (input) => {
      const result = await fetch(`/api/missions/${input.missionId}/attempts`, {
        body: JSON.stringify({
          answer: 'direct-bypass',
          chapterId: input.chapterId,
          clientAttemptId: 'attempt-direct-locked',
          contentVersion: input.contentVersion,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      return {
        body: (await result.json()) as unknown,
        status: result.status,
      }
    },
    {
      chapterId: chapter.id,
      contentVersion: staticContentVersion,
      missionId: unopenedMission.id,
    },
  )

  expect(response).toEqual({
    body: { error: 'Сервер не смог сохранить данные.' },
    status: 409,
  })
  expect(
    fixture.state.progress.find((item) => item.chapterId === chapter.id)
      ?.completedMissionIds,
  ).toEqual([])
  expect(fixture.requests.map((request) => `${request.method} ${request.path}`))
    .toContain(`POST /api/missions/${unopenedMission.id}/attempts`)
})

test('marks backend unlock cues seen before reload and reads leaderboard aggregate', async ({
  page,
}) => {
  const learner = createBackendLearner({
    fullName: 'Backend Route Pilot',
    id: 'backend-route-pilot-1',
    nickname: 'backend-route',
  })
  const fixture = await installBackendApiFixture(page, {
    learner,
    pendingUnlockChapterId: 'chapter-2',
    progress: createBackendProgress({
      completedChapterIds: ['chapter-1'],
      openChapterId: 'chapter-2',
    }),
  })

  await page.goto('/map?qa=1')

  const mentorDialog = page.getByLabel('Диалог Kilian')

  await expect(mentorDialog).toContainText('Открыт новый узел')
  await expect(page.locator('.route-unlock-line')).toBeVisible()
  expect(fixture.state.pendingUnlockChapterId).toBeNull()
  expect(fixture.requests.map((request) => `${request.method} ${request.path}`))
    .toContain('POST /api/unlocks/chapter-2/seen')

  await page.reload()

  await expect(page.locator('.route-unlock-line')).toHaveCount(0)
  await expect(page.locator('.map-node-unlock-reveal')).toHaveCount(0)
  await expect(mentorDialog).not.toContainText('Открыт новый узел')

  await page.goto('/leaderboard?qa=1')

  await expect(
    page.getByRole('heading', { name: 'Закрытые главы' }),
  ).toBeVisible()
  await expect(
    page.getByRole('table', { name: 'Рейтинг игроков' }),
  ).toContainText('@backend-route')
  await expect(
    page.getByRole('table', { name: 'Рейтинг игроков' }),
  ).not.toContainText('Backend Route Pilot')
  await expect(page.getByLabel('Текущий прогресс игрока')).toContainText(
    `1/${chapters.length}`,
  )
  expect(fixture.requests.map((request) => `${request.method} ${request.path}`))
    .toContain('GET /api/leaderboard')
})
