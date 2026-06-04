import type { ChapterArtifact } from '../../types/domain'

type ChapterArtifactSource = {
  artifact?: ChapterArtifact
  artifacts?: ChapterArtifact[]
}

export function getChapterArtifacts(chapter: ChapterArtifactSource) {
  if (chapter.artifacts?.length) {
    return chapter.artifacts
  }

  return chapter.artifact ? [chapter.artifact] : []
}
