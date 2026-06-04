import type { PublicChapter } from '../../types/domain'
import type { ContentRepository } from './ContentRepository'
import type { BackendApi } from '../http/backendApiClient'
import { backendApiClient } from '../http/backendApiClient'

type ContentCatalogResponse = {
  chapters: PublicChapter[]
  contentVersion: string
}

export class HttpContentRepository implements ContentRepository {
  private readonly api: BackendApi
  private catalogPromise: Promise<ContentCatalogResponse> | null = null

  constructor(api: BackendApi = backendApiClient) {
    this.api = api
  }

  async getContentVersion() {
    const catalog = await this.getCatalog()

    return catalog.contentVersion
  }

  async listChapters() {
    const catalog = await this.getCatalog()

    return catalog.chapters
  }

  async getChapter(chapterId: string) {
    const chapters = await this.listChapters()
    const chapter = chapters.find((item) => item.id === chapterId)

    if (!chapter) {
      throw new Error(`Глава не найдена: ${chapterId}`)
    }

    return chapter
  }

  private getCatalog() {
    this.catalogPromise ??=
      this.api.get<ContentCatalogResponse>('/api/content')

    return this.catalogPromise
  }
}

export const contentRepository = new HttpContentRepository()
