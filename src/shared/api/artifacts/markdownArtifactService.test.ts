import { describe, expect, it } from 'vitest'
import { publicChapters } from '../content/staticContentRepository'
import { getChapterArtifacts } from '../../lib/content/chapterArtifacts'
import type {
  ChapterArtifactId,
  ChapterReflection,
  PublicChapter,
} from '../../types/domain'
import { artifactTemplateRegistry } from './artifactTemplateRegistry'
import { MarkdownArtifactService } from './markdownArtifactService'

const service = new MarkdownArtifactService()

const reflection: ChapterReflection = {
  chapterId: 'chapter-1',
  optionId: 'tomorrow-pr',
  optionLabel: 'Ближайший пул-реквест',
  note: 'Проверю скачанный шаблон.',
  skipped: false,
  updatedAt: '2026-06-01T00:00:00.000Z',
}

describe('MarkdownArtifactService', () => {
  it('creates configured chapter artifacts through the typed registry', () => {
    const configuredArtifactIds = new Set<ChapterArtifactId>()

    for (const chapter of publicChapters) {
      const chapterArtifacts = getChapterArtifacts(chapter)

      if (chapterArtifacts.length === 0) {
        continue
      }

      for (const chapterArtifact of chapterArtifacts) {
        configuredArtifactIds.add(chapterArtifact.id)
      }

      const artifacts = service.createChapterArtifacts(chapter, { reflection })

      expect(artifacts).toHaveLength(chapterArtifacts.length)

      for (const [index, artifact] of artifacts.entries()) {
        const chapterArtifact = chapterArtifacts[index]

        expect(artifact).toMatchObject({
          id: chapterArtifact.id,
          title: chapterArtifact.title,
          description: chapterArtifact.description,
          fileName: chapterArtifact.fileName,
        })
        expect(artifact.content).toContain('## Локальная заметка')
        expect(artifact.content).toContain('- Фокус: Ближайший пул-реквест')
        expect(artifact.content).toContain(
          '- Мой следующий шаг: Проверю скачанный шаблон.',
        )
      }
    }

    expect(Object.keys(artifactTemplateRegistry)).toEqual(
      expect.arrayContaining([...configuredArtifactIds]),
    )
    expect(Object.keys(artifactTemplateRegistry).sort()).toEqual(
      expect.arrayContaining(['rules-inventory', 'skill-draft']),
    )
  })

  it('creates multiple artifacts for a chapter with artifact metadata array', () => {
    const sourceChapter = publicChapters[0]
    const chapterWithMultipleArtifacts: PublicChapter = {
      ...sourceChapter,
      artifact: undefined,
      artifacts: [
        {
          id: 'rules-inventory',
          title: 'Rules Inventory',
          description: 'Инвентаризация постоянных и scoped rules.',
          fileName: 'rules-inventory.md',
        },
        {
          id: 'skill-draft',
          title: 'Skill Draft',
          description: 'Черновик повторяемой процедуры.',
          fileName: 'skill-draft.md',
        },
      ],
    }

    const artifacts = service.createChapterArtifacts(chapterWithMultipleArtifacts, {
      reflection,
    })

    expect(artifacts).toHaveLength(2)
    expect(artifacts.map((artifact) => artifact.fileName)).toEqual([
      'rules-inventory.md',
      'skill-draft.md',
    ])
    expect(artifacts[0]).toMatchObject({
      id: 'rules-inventory',
      title: 'Rules Inventory',
    })
    expect(artifacts[0]?.content).toContain('# Rules Inventory')
    expect(artifacts[0]?.content).toContain('## Always-on rules')
    expect(artifacts[1]).toMatchObject({
      id: 'skill-draft',
      title: 'Skill Draft',
    })
    expect(artifacts[1]?.content).toContain('# Skill Draft')
    expect(artifacts[1]?.content).toContain('## Stop conditions')
    expect(
      service.createChapterArtifact(chapterWithMultipleArtifacts, {
        reflection,
      }),
    ).toMatchObject({
      fileName: 'rules-inventory.md',
    })
  })

  it('returns null when the chapter has no artifact metadata', () => {
    const chapterWithoutArtifact = {
      ...publicChapters[0],
      artifact: undefined,
    } satisfies PublicChapter

    expect(service.createChapterArtifact(chapterWithoutArtifact)).toBeNull()
  })

  it('returns null when an unknown artifact id reaches the markdown adapter', () => {
    const sourceChapter = publicChapters.find((chapter) => chapter.artifact)

    if (!sourceChapter?.artifact) {
      throw new Error('Expected at least one chapter artifact fixture.')
    }

    const chapterWithUnknownArtifact: PublicChapter = {
      ...sourceChapter,
      artifact: {
        ...sourceChapter.artifact,
        id: 'unknown-artifact' as ChapterArtifactId,
      },
    }

    expect(service.createChapterArtifact(chapterWithUnknownArtifact)).toBeNull()
    expect(service.createChapterArtifacts(chapterWithUnknownArtifact)).toEqual([])
  })
})
