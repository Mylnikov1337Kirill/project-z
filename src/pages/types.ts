import type {
  ChapterProgress,
  Learner,
  PublicChapter,
  TrapConceptId,
} from '../shared/types/domain'

export type GamePageProps = {
  chapters: PublicChapter[]
  encounteredTrapIds?: TrapConceptId[]
  learner: Learner
  onEncounteredTrapIdsChange?: (trapIds: TrapConceptId[]) => void
  progress: ChapterProgress[]
}
