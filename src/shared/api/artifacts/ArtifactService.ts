import type {
  ChapterArtifactId,
  ChapterReflection,
  PublicChapter,
} from '../../types/domain'

export type ArtifactExport = {
  id: ChapterArtifactId
  title: string
  description: string
  fileName: string
  content: string
}

export type ChapterArtifactOptions = {
  reflection?: ChapterReflection | null
}

export interface ArtifactService {
  createChapterArtifact(
    chapter: PublicChapter,
    options?: ChapterArtifactOptions,
  ): ArtifactExport | null
  createChapterArtifacts(
    chapter: PublicChapter,
    options?: ChapterArtifactOptions,
  ): ArtifactExport[]
}
