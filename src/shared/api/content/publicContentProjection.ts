import type {
  Chapter,
  Mission,
  PublicBossFightRoundMission,
  PublicChapter,
  PublicMission,
} from '../../types/domain'

function projectMission(mission: Mission): PublicMission {
  const base = {
    failureFeedback: mission.failureFeedback,
    id: mission.id,
    kind: mission.kind,
    mentorHint: mission.mentorHint,
    prompt: mission.prompt,
    retryPrinciple: mission.retryPrinciple,
    successFeedback: mission.successFeedback,
    takeaway: mission.takeaway,
    title: mission.title,
  }

  if (mission.kind === 'scenario-decision') {
    return {
      ...base,
      kind: 'scenario-decision',
      options: mission.options.map((option) => ({
        id: option.id,
        label: option.label,
      })),
    }
  }

  if (mission.kind === 'prompt-assembly') {
    return {
      ...base,
      brief: mission.brief,
      fragments: mission.fragments.map((fragment) => ({
        body: fragment.body,
        id: fragment.id,
        label: fragment.label,
        preview: fragment.preview,
      })),
      kind: 'prompt-assembly',
      slots: mission.slots.map((slot) => ({
        id: slot.id,
        label: slot.label,
        required: slot.required,
      })),
    }
  }

  if (mission.kind === 'pair-matching') {
    return {
      ...base,
      items: mission.items.map((item) => ({
        description: item.description,
        id: item.id,
        label: item.label,
      })),
      kind: 'pair-matching',
      targets: mission.targets.map((target) => ({
        description: target.description,
        id: target.id,
        label: target.label,
      })),
    }
  }

  if (mission.kind === 'chip-picker') {
    return {
      ...base,
      budget: mission.budget,
      chips: mission.chips.map((chip) => ({
        cost: chip.cost,
        id: chip.id,
        label: chip.label,
      })),
      kind: 'chip-picker',
    }
  }

  if (mission.kind === 'chip-ordering') {
    return {
      ...base,
      chips: mission.chips.map((chip) => ({
        cost: chip.cost,
        id: chip.id,
        label: chip.label,
      })),
      kind: 'chip-ordering',
      targetCount: mission.correctOrder.length,
    }
  }

  return {
    ...base,
    kind: 'boss-fight',
    rounds: mission.rounds.map((round) =>
      projectMission(round),
    ) as PublicBossFightRoundMission[],
  }
}

export function projectChapterToPublic(chapter: Chapter): PublicChapter {
  return {
    ...chapter,
    boss: projectMission(chapter.boss),
    missions: chapter.missions.map(projectMission),
  }
}

export function projectChapterCatalogToPublic(
  chapters: readonly Chapter[],
): PublicChapter[] {
  return chapters.map(projectChapterToPublic)
}
