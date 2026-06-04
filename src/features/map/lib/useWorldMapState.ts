import { useEffect, useRef, useState } from 'react'
import { resolveChapterStatus } from '../../../entities/chapter/lib/chapterProgress'
import type { ProgressRepository } from '../../../shared/api/progress/ProgressRepository'
import type {
  ChapterProgress,
  ChapterStatus,
  PublicChapter,
} from '../../../shared/types/domain'
import {
  getInitialMapChapter,
  getLatestCompletedChapter,
  getPlayableChapter,
  getSelectedChapterDetails,
  isMapRouteCompleted,
} from './mapViewModel'

type UseWorldMapStateInput = {
  chapters: PublicChapter[]
  initialChapterId?: string
  learnerId: string
  progress: ChapterProgress[]
  progressByChapter: Map<string, ChapterProgress>
  progressRepository: ProgressRepository
}

export function useWorldMapState({
  chapters,
  initialChapterId,
  learnerId,
  progress,
  progressByChapter,
  progressRepository,
}: UseWorldMapStateInput) {
  const didMountAvatarRef = useRef(false)
  const playableChapter = getPlayableChapter(chapters, progressByChapter)
  const isRouteCompleted = isMapRouteCompleted(chapters, progressByChapter)
  const initialChapter = getInitialMapChapter({
    chapters,
    preferredChapterId: initialChapterId,
    progressByChapter,
  })
  const initialAvatarChapter =
    initialChapter ??
    (isRouteCompleted
      ? getLatestCompletedChapter(chapters, progressByChapter)
      : null)
  const [selectedChapterId, setSelectedChapterId] = useState(
    initialChapter?.id ?? '',
  )
  const [avatarChapterId, setAvatarChapterId] = useState(
    initialAvatarChapter?.id ?? '',
  )
  const [isAvatarRunning, setIsAvatarRunning] = useState(false)
  const [revealedChapterId, setRevealedChapterId] = useState<string | null>(
    null,
  )
  const [hasCheckedPendingUnlock, setHasCheckedPendingUnlock] = useState(false)
  const selectedChapter =
    chapters.find((chapter) => chapter.id === selectedChapterId) ??
    (isRouteCompleted ? null : playableChapter)
  const fallbackAvatarChapter = isRouteCompleted
    ? getLatestCompletedChapter(chapters, progressByChapter)
    : (playableChapter ?? selectedChapter)
  const storedAvatarChapter =
    chapters.find((chapter) => chapter.id === avatarChapterId) ??
    fallbackAvatarChapter
  const storedAvatarStatus = storedAvatarChapter
    ? resolveChapterStatus(storedAvatarChapter, progressByChapter)
    : 'locked'
  const avatarChapter =
    storedAvatarStatus === 'locked' ? fallbackAvatarChapter : storedAvatarChapter
  const selectedDetails = getSelectedChapterDetails({
    chapter: selectedChapter,
    isRouteCompleted,
    progress,
    progressByChapter,
    revealedChapterId,
  })

  useEffect(() => {
    if (!avatarChapterId) {
      return undefined
    }

    if (!didMountAvatarRef.current) {
      didMountAvatarRef.current = true
      return undefined
    }

    setIsAvatarRunning(true)
    const stopRunning = window.setTimeout(() => {
      setIsAvatarRunning(false)
    }, 560)

    return () => window.clearTimeout(stopRunning)
  }, [avatarChapterId])

  useEffect(() => {
    let isMounted = true
    let clearRevealTimeout: number | undefined

    async function revealPendingUnlock() {
      setHasCheckedPendingUnlock(false)

      try {
        const pendingChapterId =
          await progressRepository.getPendingChapterUnlock(learnerId)

        if (!isMounted || !pendingChapterId) {
          return
        }

        const pendingChapter = chapters.find(
          (chapter) => chapter.id === pendingChapterId,
        )
        const pendingStatus = pendingChapter
          ? resolveChapterStatus(pendingChapter, progressByChapter)
          : 'locked'

        if (!pendingChapter || pendingStatus !== 'open') {
          await progressRepository.markChapterUnlockSeen({
            learnerId,
            chapterId: pendingChapterId,
          })
          return
        }

        await progressRepository.markChapterUnlockSeen({
          learnerId,
          chapterId: pendingChapterId,
        })

        if (!isMounted) {
          return
        }

        setSelectedChapterId(pendingChapterId)
        setAvatarChapterId(pendingChapterId)
        setRevealedChapterId(pendingChapterId)

        clearRevealTimeout = window.setTimeout(() => {
          setRevealedChapterId((currentChapterId) =>
            currentChapterId === pendingChapterId ? null : currentChapterId,
          )
        }, 4200)
      } catch {
        if (isMounted) {
          setRevealedChapterId(null)
        }
      } finally {
        if (isMounted) {
          setHasCheckedPendingUnlock(true)
        }
      }
    }

    if (chapters.length > 0) {
      void revealPendingUnlock()
    }

    return () => {
      isMounted = false

      if (clearRevealTimeout) {
        window.clearTimeout(clearRevealTimeout)
      }
    }
  }, [chapters, learnerId, progressByChapter, progressRepository])

  function selectChapterPreview(chapter: PublicChapter, state: ChapterStatus) {
    setSelectedChapterId(chapter.id)

    if (state !== 'locked') {
      setAvatarChapterId(chapter.id)
    }
  }

  function selectLockedChapter(chapter: PublicChapter) {
    setSelectedChapterId(chapter.id)
  }

  return {
    avatarChapter,
    hasCheckedPendingUnlock,
    isAvatarRunning,
    playableChapter,
    revealedChapterId,
    selectChapterPreview,
    selectLockedChapter,
    selectedChapter,
    selectedChapterStatus: selectedDetails.status,
    selectedCompletedMissionIds: selectedDetails.completedMissionIds,
    selectedNextMission: selectedDetails.nextMission,
    mentorPrompt: selectedDetails.mentorPrompt,
  }
}
