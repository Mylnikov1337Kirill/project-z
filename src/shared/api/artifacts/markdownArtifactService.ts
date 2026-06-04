import { getChapterArtifacts } from '../../lib/content/chapterArtifacts'
import type {
  ChapterArtifact,
  ChapterReflection,
  PublicChapter,
} from '../../types/domain'
import type {
  ArtifactExport,
  ArtifactService,
  ChapterArtifactOptions,
} from './ArtifactService'
import { getArtifactTemplate } from './artifactTemplateRegistry'

function normalizeMarkdownLine(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, ' ') ?? ''
}

function createReflectionMarkdown(reflection?: ChapterReflection | null) {
  const prompt = 'Где применишь это завтра?'

  if (reflection?.skipped) {
    return `## Локальная заметка

> ${prompt}

Заметка пропущена на экране награды. Вернись к ней позже, если захочешь.
`
  }

  const optionLabel = normalizeMarkdownLine(reflection?.optionLabel)
  const note = normalizeMarkdownLine(reflection?.note)

  if (optionLabel || note) {
    return `## Локальная заметка

> ${prompt}

- Фокус: ${optionLabel || 'TODO: выбрать ближайший рабочий сценарий.'}
- Мой следующий шаг: ${note || 'TODO: дописать один конкретный шаг.'}
`
  }

  return `## Локальная заметка

> ${prompt}

- Фокус: TODO: выбрать ближайший рабочий сценарий.
- Мой следующий шаг: TODO: дописать один конкретный шаг.
`
}

function withReflectionMarkdown(
  content: string,
  reflection?: ChapterReflection | null,
) {
  return `${content.trimEnd()}

${createReflectionMarkdown(reflection)}`
}

export class MarkdownArtifactService implements ArtifactService {
  private createArtifactFromMetadata(
    artifact: ChapterArtifact,
    options: ChapterArtifactOptions,
  ): ArtifactExport | null {
    const createTemplate = getArtifactTemplate(artifact.id)

    if (!createTemplate) {
      return null
    }

    return {
      id: artifact.id,
      title: artifact.title,
      description: artifact.description,
      fileName: artifact.fileName,
      content: withReflectionMarkdown(createTemplate(), options.reflection),
    }
  }

  createChapterArtifact(
    chapter: PublicChapter,
    options: ChapterArtifactOptions = {},
  ): ArtifactExport | null {
    return this.createChapterArtifacts(chapter, options)[0] ?? null
  }

  createChapterArtifacts(
    chapter: PublicChapter,
    options: ChapterArtifactOptions = {},
  ): ArtifactExport[] {
    return getChapterArtifacts(chapter).flatMap((artifact) => {
      const artifactExport = this.createArtifactFromMetadata(artifact, options)

      return artifactExport ? [artifactExport] : []
    })
  }
}

export const artifactService = new MarkdownArtifactService()
