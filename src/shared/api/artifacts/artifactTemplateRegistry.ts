import type { ChapterArtifactId } from '../../types/domain'
import { createContextStarterMarkdown } from './templates/contextStarterTemplate'
import { createPlanFirstChecklistMarkdown } from './templates/planFirstChecklistTemplate'
import { createPlaybookDraftMarkdown } from './templates/playbookDraftTemplate'
import { createRulesInventoryMarkdown } from './templates/rulesInventoryTemplate'
import { createSelfReviewMarkdown } from './templates/selfReviewTemplate'
import { createSkillDraftMarkdown } from './templates/skillDraftTemplate'
import { createTaskBriefMarkdown } from './templates/taskBriefTemplate'
import type { ArtifactTemplateFactory } from './templates/templateTypes'
import { createTokenHygieneChecklistMarkdown } from './templates/tokenHygieneChecklistTemplate'
import { createVerificationMatrixMarkdown } from './templates/verificationMatrixTemplate'

export const artifactTemplateRegistry = {
  'ai-pr-self-review': createSelfReviewMarkdown,
  'task-brief': createTaskBriefMarkdown,
  'plan-first-checklist': createPlanFirstChecklistMarkdown,
  'context-starter': createContextStarterMarkdown,
  'token-hygiene-checklist': createTokenHygieneChecklistMarkdown,
  'verification-matrix': createVerificationMatrixMarkdown,
  'rules-inventory': createRulesInventoryMarkdown,
  'skill-draft': createSkillDraftMarkdown,
  'playbook-draft': createPlaybookDraftMarkdown,
} satisfies Record<ChapterArtifactId, ArtifactTemplateFactory>

export function getArtifactTemplate(artifactId: string) {
  return artifactTemplateRegistry[artifactId as ChapterArtifactId]
}
