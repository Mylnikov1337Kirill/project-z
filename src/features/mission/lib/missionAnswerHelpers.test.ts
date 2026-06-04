import { describe, expect, it } from 'vitest'
import type { PublicPairMatchingMission } from '../../../shared/types/domain'
import {
  getAnswerSummary,
  getMissionReadyState,
  isPairMatchingReady,
} from './missionAnswerHelpers'

const pairMatchingMission: PublicPairMatchingMission = {
  failureFeedback: 'Try again.',
  id: 'carrier-match',
  items: [
    {
      description: 'Never paste raw production logs with PII.',
      id: 'pii-safety',
      label: 'PII safety rule',
    },
    {
      description: 'Run visual QA with route and viewport checks.',
      id: 'browser-qa',
      label: 'Browser QA procedure',
    },
  ],
  kind: 'pair-matching',
  mentorHint: 'Match each item to a carrier.',
  prompt: 'Connect each item to a carrier.',
  successFeedback: 'Accepted.',
  targets: [
    {
      description: 'Durable safety boundary.',
      id: 'always-on-rule',
      label: 'Always-on rule',
    },
    {
      description: 'Repeatable procedure.',
      id: 'skill',
      label: 'Skill',
    },
  ],
  title: 'Carrier match',
}

describe('missionAnswerHelpers pair matching', () => {
  it('requires every pair matching item to be assigned before submit', () => {
    expect(
      isPairMatchingReady(pairMatchingMission, {
        'browser-qa': 'skill',
      }),
    ).toBe(false)

    expect(
      isPairMatchingReady(pairMatchingMission, {
        'browser-qa': 'skill',
        'pii-safety': 'always-on-rule',
      }),
    ).toBe(true)
  })

  it('wires pair matching ready state through the generic mission helper', () => {
    expect(
      getMissionReadyState({
        activeMission: pairMatchingMission,
        orderLimit: 0,
        pairMatchingAnswer: {
          'browser-qa': 'skill',
          'pii-safety': 'always-on-rule',
        },
        promptAssemblyAnswer: {},
        selectedChipIds: [],
        selectedOptionId: '',
      }),
    ).toBe(true)
  })

  it('summarizes selected pair matching links for the boss dossier', () => {
    expect(
      getAnswerSummary(pairMatchingMission, {
        'browser-qa': 'skill',
        'pii-safety': 'always-on-rule',
      }),
    ).toBe('PII safety rule -> Always-on rule / Browser QA procedure -> Skill')
  })
})
