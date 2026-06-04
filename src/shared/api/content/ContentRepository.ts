import type { PublicChapter } from '../../types/domain'

export interface ContentRepository {
  getContentVersion(): Promise<string>
  listChapters(): Promise<PublicChapter[]>
  getChapter(chapterId: string): Promise<PublicChapter>
}
