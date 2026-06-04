import { useMemo } from 'react'
import type { ChapterProgress } from '../../types/domain'

export function useProgressByChapter(progress: ChapterProgress[]) {
  return useMemo(
    () => new Map(progress.map((item) => [item.chapterId, item])),
    [progress],
  )
}
