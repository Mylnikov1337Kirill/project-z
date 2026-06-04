import { chapters } from '../../../entities/chapter/model/chapterCatalog'
import type { PublicChapter } from '../../types/domain'
import type { ContentRepository } from './ContentRepository'
import { staticContentVersion } from './contentVersion'
import { projectChapterCatalogToPublic } from './publicContentProjection'

const publicChapters = projectChapterCatalogToPublic(chapters)

export class StaticContentRepository implements ContentRepository {
  async getContentVersion() {
    return staticContentVersion
  }

  async listChapters() {
    return publicChapters
  }

  async getChapter(chapterId: string) {
    const chapter = publicChapters.find((item) => item.id === chapterId)

    if (!chapter) {
      throw new Error(`Глава не найдена: ${chapterId}`)
    }

    return chapter
  }
}

export const contentRepository = new StaticContentRepository()

export { publicChapters, staticContentVersion }
export type { PublicChapter }
