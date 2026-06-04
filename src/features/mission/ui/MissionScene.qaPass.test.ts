import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { PublicChapter, PublicMission } from '../../../shared/types/domain'
import { MissionScene } from './MissionScene'

const mission: PublicMission = {
  failureFeedback: 'Нужно допроверить.',
  id: 'qa-pass-scene',
  kind: 'scenario-decision',
  mentorHint: 'Выбери устойчивый вариант.',
  options: [
    {
      id: 'option-a',
      label: 'Остановить и проверить вводные',
    },
  ],
  prompt: 'Выбери устойчивое решение.',
  successFeedback: 'Сцена зачтена.',
  takeaway: 'Сначала проверяем рамку задачи.',
  title: 'QA pass scene',
}

const chapter: PublicChapter = {
  badgeName: 'QA Badge',
  boss: mission,
  id: 'chapter-qa',
  missions: [mission],
  order: 1,
  rankAfterCompletion: 'QA',
  recap: {
    commonTrap: {
      note: 'Не выдавать клиенту ответы.',
      trapId: 'too-broad',
    },
    nextMove: 'Проверить серверный endpoint.',
    rules: ['QA PASS gated by build flag'],
  },
  reward: {
    applyTomorrow: 'Проверить флаг в сборке.',
    emblem: 'Q',
    masteryActions: ['Проверить UI', 'Проверить submit'],
    motif: 'QA',
    motto: 'Only in QA',
    nextTeaser: 'Server-side answer',
    skill: 'QA pass',
  },
  summary: 'QA test chapter',
  title: 'QA chapter',
}

type MissionSceneProps = Parameters<typeof MissionScene>[0]

function renderMissionScene(overrides: Partial<MissionSceneProps> = {}) {
  const props: MissionSceneProps = {
    chapter,
    isSubmitting: false,
    mission,
    nextHref: '/chapters/chapter-qa/badge',
    nextLabel: 'Дальше',
    onQaPassSubmit: async () => undefined,
    onReset: () => undefined,
    onSubmit: async () => undefined,
    qaPassEnabled: false,
    result: null,
    trapDiscoveries: [],
    ...overrides,
  }

  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/chapters/chapter-qa/missions/qa-pass-scene'] },
      createElement(MissionScene, props),
    ),
  )
}

function getQaPassButtonMarkup(html: string) {
  const match = html.match(/<button[^>]*>QA PASS<\/button>/u)

  expect(match).not.toBeNull()
  return match?.[0] ?? ''
}

describe('MissionScene QA PASS action', () => {
  it('hides QA PASS when the QA-pass build flag is disabled', () => {
    expect(renderMissionScene()).not.toContain('QA PASS')
  })

  it('shows QA PASS when the QA-pass build flag is enabled', () => {
    const qaPassButton = getQaPassButtonMarkup(
      renderMissionScene({ qaPassEnabled: true }),
    )

    expect(qaPassButton).not.toContain('disabled=""')
  })

  it('disables QA PASS while submitting', () => {
    const qaPassButton = getQaPassButtonMarkup(
      renderMissionScene({ isSubmitting: true, qaPassEnabled: true }),
    )

    expect(qaPassButton).toContain('disabled=""')
  })

  it('disables QA PASS after a passed result', () => {
    const qaPassButton = getQaPassButtonMarkup(
      renderMissionScene({
        qaPassEnabled: true,
        result: {
          feedback: 'Сцена зачтена.',
          passed: true,
          score: 100,
        },
      }),
    )

    expect(qaPassButton).toContain('disabled=""')
  })
})
