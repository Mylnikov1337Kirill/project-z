export type Learner = {
  id: string
  nickname: string
  fullName: string
}

export type ChapterStatus = 'locked' | 'open' | 'completed'

export type MissionKind =
  | 'boss-fight'
  | 'chip-picker'
  | 'chip-ordering'
  | 'pair-matching'
  | 'prompt-assembly'
  | 'scenario-decision'

export type TrapConceptId =
  | 'agent-as-source'
  | 'blind-retry'
  | 'confident-report'
  | 'conflicting-instructions'
  | 'context-dump'
  | 'neighboring-refactor'
  | 'personal-magic'
  | 'prompt-instead-of-skill'
  | 'sensitive-data'
  | 'stale-rule'
  | 'too-broad'
  | 'unsafe-always-on-context'
  | 'weak-test'

export type MissionBase = {
  id: string
  kind: MissionKind
  title: string
  prompt: string
  mentorHint: string
  successFeedback: string
  failureFeedback: string
  retryPrinciple?: string
  takeaway?: string
}

export type PublicMissionChip = {
  id: string
  label: string
  cost?: number
}

export type AuthoredMissionChip = PublicMissionChip & {
  isCorrect: boolean
  feedback?: string
  trapId?: TrapConceptId
  trapLabel?: string
}

export type MissionChip = AuthoredMissionChip

export type PublicChipPickerMission = MissionBase & {
  kind: 'chip-picker'
  chips: PublicMissionChip[]
  budget?: {
    label: string
    limit: number
    unit: string
  }
}

export type AuthoredChipPickerMission = Omit<PublicChipPickerMission, 'chips'> & {
  chips: AuthoredMissionChip[]
}

export type ChipPickerMission = AuthoredChipPickerMission

export type PublicChipOrderingMission = MissionBase & {
  kind: 'chip-ordering'
  chips: PublicMissionChip[]
  targetCount: number
}

export type AuthoredChipOrderingMission = Omit<
  PublicChipOrderingMission,
  'chips' | 'targetCount'
> & {
  chips: AuthoredMissionChip[]
  correctOrder: string[]
  orderFeedback?: Record<string, string>
}

export type ChipOrderingMission = AuthoredChipOrderingMission

export type PublicScenarioOption = {
  id: string
  label: string
}

export type AuthoredScenarioOption = PublicScenarioOption & {
  isCorrect: boolean
  feedback?: string
  failureFeedback?: string
  trapId?: TrapConceptId
  trapLabel?: string
}

export type ScenarioOption = AuthoredScenarioOption

export type PublicScenarioDecisionMission = MissionBase & {
  kind: 'scenario-decision'
  options: PublicScenarioOption[]
}

export type AuthoredScenarioDecisionMission = Omit<
  PublicScenarioDecisionMission,
  'options'
> & {
  options: AuthoredScenarioOption[]
}

export type ScenarioDecisionMission = AuthoredScenarioDecisionMission

export type PublicPairMatchingItem = {
  id: string
  label: string
  description?: string
}

export type AuthoredPairMatchingItem = PublicPairMatchingItem & {
  acceptedTargetIds: string[]
  feedback?: string
  trapId?: TrapConceptId
  trapLabel?: string
}

export type PairMatchingItem = AuthoredPairMatchingItem

export type PairMatchingTarget = {
  id: string
  label: string
  description?: string
}

export type PublicPairMatchingMission = MissionBase & {
  kind: 'pair-matching'
  items: PublicPairMatchingItem[]
  targets: PairMatchingTarget[]
}

export type AuthoredPairMatchingMission = Omit<
  PublicPairMatchingMission,
  'items'
> & {
  items: AuthoredPairMatchingItem[]
}

export type PairMatchingMission = AuthoredPairMatchingMission

export type PublicPromptAssemblySlot = {
  id: string
  label: string
  required?: boolean
}

export type AuthoredPromptAssemblySlot = PublicPromptAssemblySlot & {
  acceptedFragmentIds: string[]
}

export type PromptAssemblySlot = AuthoredPromptAssemblySlot

export type PublicPromptAssemblyFragment = {
  id: string
  label: string
  body: string
  preview?: string
}

export type AuthoredPromptAssemblyFragment = PublicPromptAssemblyFragment & {
  feedback?: string
  trapId?: TrapConceptId
  trapLabel?: string
}

export type PromptAssemblyFragment = AuthoredPromptAssemblyFragment

export type PublicPromptAssemblyMission = MissionBase & {
  kind: 'prompt-assembly'
  brief: {
    teamWants: string
    risk: string
    reviewableResult: string
  }
  slots: PublicPromptAssemblySlot[]
  fragments: PublicPromptAssemblyFragment[]
}

export type AuthoredPromptAssemblyMission = Omit<
  PublicPromptAssemblyMission,
  'slots' | 'fragments'
> & {
  slots: AuthoredPromptAssemblySlot[]
  fragments: AuthoredPromptAssemblyFragment[]
}

export type PromptAssemblyMission = AuthoredPromptAssemblyMission

export type PublicBossFightRoundMission =
  | PublicChipPickerMission
  | PublicChipOrderingMission
  | PublicPairMatchingMission
  | PublicPromptAssemblyMission
  | PublicScenarioDecisionMission

export type BossFightRoundMission =
  | ChipPickerMission
  | ChipOrderingMission
  | PairMatchingMission
  | PromptAssemblyMission
  | ScenarioDecisionMission

export type PublicBossFightMission = MissionBase & {
  kind: 'boss-fight'
  rounds: PublicBossFightRoundMission[]
}

export type BossFightMission = MissionBase & {
  kind: 'boss-fight'
  rounds: BossFightRoundMission[]
  passingScore: number
}

export type PublicMission =
  | PublicBossFightMission
  | PublicChipPickerMission
  | PublicChipOrderingMission
  | PublicPairMatchingMission
  | PublicPromptAssemblyMission
  | PublicScenarioDecisionMission

export type Mission =
  | BossFightMission
  | ChipPickerMission
  | ChipOrderingMission
  | PairMatchingMission
  | PromptAssemblyMission
  | ScenarioDecisionMission

export type PrepResource = {
  id: string
  title: string
  type?: string
  language?: string
  source?: string
  sourceLabel: string
  description: string
  url: string
  lastReviewed?: string
  estimatedMinutes: number
}

export type ChapterPrep = {
  title: string
  summary: string
  mentorNote: string
  checklist: string[]
  resources: PrepResource[]
}

export type ChapterArtifactId =
  | 'ai-pr-self-review'
  | 'task-brief'
  | 'plan-first-checklist'
  | 'context-starter'
  | 'token-hygiene-checklist'
  | 'verification-matrix'
  | 'rules-inventory'
  | 'skill-draft'
  | 'playbook-draft'

export type ChapterArtifact = {
  id: ChapterArtifactId
  title: string
  description: string
  fileName: string
}

export type ChapterLandmarkId =
  | 'attention-window'
  | 'brief-tower'
  | 'context-archive'
  | 'diff-forge'
  | 'instruction-router'
  | 'plan-gate'
  | 'playbook-relay'
  | 'verification-lab'

export type ChapterVisual = {
  landmarkId: ChapterLandmarkId
  label: string
  tone: 'blue' | 'gold' | 'green' | 'orange' | 'pink' | 'teal' | 'violet'
}

export type ChapterReward = {
  emblem: string
  motif: string
  skill: string
  motto: string
  masteryActions: [string, string] | [string, string, string]
  applyTomorrow: string
  nextTeaser: string
}

export type ChapterRecap = {
  rules: string[]
  commonTrap: {
    trapId: TrapConceptId
    note: string
  }
  nextMove: string
}

export type Chapter = {
  id: string
  order: number
  title: string
  badgeName: string
  rankAfterCompletion: string
  summary: string
  visual?: ChapterVisual
  reward: ChapterReward
  recap: ChapterRecap
  prep?: ChapterPrep
  artifact?: ChapterArtifact
  artifacts?: ChapterArtifact[]
  missions: Mission[]
  boss: Mission
}

export type PublicChapter = Omit<Chapter, 'missions' | 'boss'> & {
  missions: PublicMission[]
  boss: PublicMission
}

export type ChapterProgress = {
  chapterId: string
  status: ChapterStatus
  completedMissionIds: string[]
}

export type ChapterReflection = {
  chapterId: string
  optionId: string | null
  optionLabel: string | null
  note: string
  skipped: boolean
  updatedAt: string
}

export type MissionAttempt = {
  learnerId: string
  chapterId: string
  missionId: string
  answer: unknown
  clientAttemptId: string
  contentVersion: string
  isCorrect: boolean
  score: number
  createdAt: string
}

export type PublicMissionAnswerDetail = {
  description: string
  id: string
  status: 'correct' | 'missed' | 'neutral' | 'trap'
  title: string
  trapId?: TrapConceptId
  trapLabel?: string
}

export type PublicMissionRoundEvaluation = {
  answerDetails?: PublicMissionAnswerDetail[]
  feedback: string
  passed: boolean
  roundId: string
  score: number
  title: string
}

export type PublicMissionEvaluation = {
  answerDetails?: PublicMissionAnswerDetail[]
  feedback: string
  passed: boolean
  roundResults?: PublicMissionRoundEvaluation[]
  score: number
}

export type ChapterCompletion = {
  learnerId: string
  chapterId: string
  completedChapters: number
  completedAt: string
}

export type LeaderboardEntry = {
  learnerId: string
  nickname: string
  fullName: string
  closedChaptersCount: number
  currentRank: string
  lastBadgeDate: string | null
  lastBadgeName: string | null
}
