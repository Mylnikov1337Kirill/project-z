import {
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  BasicMissionAnswer,
  BossFightAnswer,
  MissionAnswer,
} from '../../../entities/mission/lib/missionEngine'
import type {
  PublicMission,
  PublicMissionEvaluation,
} from '../../../shared/types/domain'
import {
  canSelectChipWithinBudget,
  getActiveMission,
  getBossDossierItems,
  getMissionReadyState,
  getPrimaryActionLabel,
  getSelectedChipCost,
} from './missionAnswerHelpers'

type UseMissionSceneStateInput = {
  mission: PublicMission
  onReset: () => void
  onSubmit: (answer: MissionAnswer) => Promise<void>
  result: PublicMissionEvaluation | null
  isSubmitting: boolean
}

export type MissionSceneController = ReturnType<typeof useMissionSceneState>

export function useMissionSceneState({
  mission,
  onReset,
  onSubmit,
  result,
  isSubmitting,
}: UseMissionSceneStateInput) {
  const [selectedOptionId, setSelectedOptionId] = useState('')
  const [selectedChipIds, setSelectedChipIds] = useState<string[]>([])
  const [promptAssemblyAnswer, setPromptAssemblyAnswer] = useState<
    Record<string, string | null | undefined>
  >({})
  const [pairMatchingAnswer, setPairMatchingAnswer] = useState<
    Record<string, string | null | undefined>
  >({})
  const [selectedPairItemId, setSelectedPairItemId] = useState('')
  const [selectedPromptFragmentId, setSelectedPromptFragmentId] = useState('')
  const [selectedPromptSlotId, setSelectedPromptSlotId] = useState('')
  const [activeBossRoundIndex, setActiveBossRoundIndex] = useState(0)
  const [bossRoundAnswers, setBossRoundAnswers] = useState<BossFightAnswer>({})
  const [draggedChipId, setDraggedChipId] = useState<string | null>(null)
  const pointerDragRef = useRef<{
    chipId: string
    hasMoved: boolean
    startX: number
    startY: number
  } | null>(null)
  const suppressClickRef = useRef(false)
  const isBossFight = mission.kind === 'boss-fight'
  const bossRounds = isBossFight ? mission.rounds : []
  const activeMission = getActiveMission(mission, activeBossRoundIndex)
  const orderLimit =
    activeMission.kind === 'chip-ordering'
      ? activeMission.targetCount
      : 0
  const activeRoundNumber = activeBossRoundIndex + 1
  const bossRoundCount = bossRounds.length
  const bossStageProgress = bossRoundCount
    ? Math.round(
        ((result?.roundResults ? bossRoundCount : activeRoundNumber - 1) /
          bossRoundCount) *
          100,
      )
    : 0
  const selectedBudgetCost =
    activeMission.kind === 'chip-picker' && activeMission.budget
      ? getSelectedChipCost(activeMission, selectedChipIds)
      : 0
  const bossDossierItems = isBossFight
    ? getBossDossierItems({
        bossRoundAnswers,
        result,
        rounds: bossRounds,
      })
    : []
  const activePromptSlotId =
    activeMission.kind === 'prompt-assembly'
      ? activeMission.slots.some((slot) => slot.id === selectedPromptSlotId)
        ? selectedPromptSlotId
        : (activeMission.slots[0]?.id ?? '')
      : ''
  const activePairItemId =
    activeMission.kind === 'pair-matching'
      ? activeMission.items.some((item) => item.id === selectedPairItemId)
        ? selectedPairItemId
        : (activeMission.items.find((item) => !pairMatchingAnswer[item.id])
            ?.id ??
          activeMission.items[0]?.id ??
          '')
      : ''

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const dragState = pointerDragRef.current

      if (!dragState) {
        return
      }

      const dragDistance = Math.hypot(
        event.clientX - dragState.startX,
        event.clientY - dragState.startY,
      )

      if (!dragState.hasMoved && dragDistance > 6) {
        pointerDragRef.current = {
          ...dragState,
          hasMoved: true,
        }
        setDraggedChipId(dragState.chipId)
      }
    }

    function handlePointerUp() {
      const dragState = pointerDragRef.current

      window.setTimeout(() => {
        if (pointerDragRef.current === dragState) {
          pointerDragRef.current = null
          setDraggedChipId(null)
        }
      }, 0)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)

    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
  }, [])

  const selectedChipSet = useMemo(
    () => new Set(selectedChipIds),
    [selectedChipIds],
  )
  const isReady = getMissionReadyState({
    activeMission,
    orderLimit,
    pairMatchingAnswer,
    promptAssemblyAnswer,
    selectedChipIds,
    selectedOptionId,
  })
  const primaryActionLabel = getPrimaryActionLabel({
    activeBossRoundIndex,
    bossRoundCount,
    isBossFight,
    isSubmitting,
  })

  function clearInteractionState() {
    setDraggedChipId(null)
    setSelectedPairItemId('')
    setSelectedPromptFragmentId('')
    setSelectedPromptSlotId('')
    pointerDragRef.current = null
    suppressClickRef.current = false
  }

  function toggleChip(chipId: string) {
    setSelectedChipIds((currentIds) => {
      if (currentIds.includes(chipId)) {
        return currentIds.filter((id) => id !== chipId)
      }

      if (
        activeMission.kind === 'chip-picker' &&
        !canSelectChipWithinBudget(activeMission, currentIds, chipId)
      ) {
        return currentIds
      }

      return [...currentIds, chipId]
    })
  }

  function pickOrderChip(chipId: string) {
    setSelectedChipIds((currentIds) => {
      if (currentIds.includes(chipId) || currentIds.length >= orderLimit) {
        return currentIds
      }

      return [...currentIds, chipId]
    })
  }

  function removeOrderChip(chipId: string) {
    setSelectedChipIds((currentIds) =>
      currentIds.filter((id) => id !== chipId),
    )
  }

  function getNextPromptSlotId(
    currentSlotId: string,
    nextAnswer: Record<string, string | null | undefined>,
  ) {
    if (activeMission.kind !== 'prompt-assembly') {
      return ''
    }

    const currentIndex = activeMission.slots.findIndex(
      (slot) => slot.id === currentSlotId,
    )
    const orderedSlots =
      currentIndex >= 0
        ? [
            ...activeMission.slots.slice(currentIndex + 1),
            ...activeMission.slots.slice(0, currentIndex + 1),
          ]
        : activeMission.slots
    const nextEmptySlot = orderedSlots.find((slot) => !nextAnswer[slot.id])

    return nextEmptySlot?.id ?? currentSlotId
  }

  function placePromptFragmentInSlot(slotId: string, fragmentId: string) {
    if (!fragmentId || activeMission.kind !== 'prompt-assembly') {
      return
    }

    setPromptAssemblyAnswer((currentAnswer) => {
      const nextAnswer = Object.fromEntries(
        Object.entries(currentAnswer).filter(
          ([, currentFragmentId]) => currentFragmentId !== fragmentId,
        ),
      )
      const answerWithFragment = {
        ...nextAnswer,
        [slotId]: fragmentId,
      }

      setSelectedPromptSlotId(getNextPromptSlotId(slotId, answerWithFragment))

      return answerWithFragment
    })
    setSelectedPromptFragmentId('')
  }

  function assignPromptFragmentToSlot(slotId: string, fragmentId: string) {
    placePromptFragmentInSlot(slotId, fragmentId)
  }

  function selectPromptFragment(fragmentId: string) {
    if (activePromptSlotId) {
      placePromptFragmentInSlot(activePromptSlotId, fragmentId)
      return
    }

    setSelectedPromptFragmentId((currentId) =>
      currentId === fragmentId ? '' : fragmentId,
    )
  }

  function selectPromptSlot(slotId: string) {
    setSelectedPromptSlotId(slotId)
  }

  function placePromptFragment(slotId: string) {
    if (!selectedPromptFragmentId) {
      selectPromptSlot(slotId)
      return
    }

    placePromptFragmentInSlot(slotId, selectedPromptFragmentId)
  }

  function clearPromptSlot(slotId: string) {
    setPromptAssemblyAnswer((currentAnswer) => {
      const nextAnswer = { ...currentAnswer }

      delete nextAnswer[slotId]
      return nextAnswer
    })
    setSelectedPromptSlotId(slotId)
  }

  function assignPairItemToTarget(itemId: string, targetId: string) {
    if (activeMission.kind !== 'pair-matching') {
      return
    }

    setPairMatchingAnswer((currentAnswer) => {
      const nextAnswer = {
        ...currentAnswer,
        [itemId]: targetId,
      }
      const nextUnassignedItem = activeMission.items.find(
        (item) => item.id !== itemId && !nextAnswer[item.id],
      )

      setSelectedPairItemId(nextUnassignedItem?.id ?? itemId)

      return nextAnswer
    })
  }

  function clearPairItem(itemId: string) {
    setPairMatchingAnswer((currentAnswer) => {
      const nextAnswer = { ...currentAnswer }

      delete nextAnswer[itemId]
      return nextAnswer
    })
    setSelectedPairItemId(itemId)
  }

  function placeOrderChip(chipId: string, targetIndex: number) {
    setSelectedChipIds((currentIds) => {
      const currentIndex = currentIds.indexOf(chipId)

      if (currentIndex >= 0) {
        const nextIds = currentIds.filter((id) => id !== chipId)
        const safeIndex = Math.min(targetIndex, nextIds.length)

        nextIds.splice(safeIndex, 0, chipId)
        return nextIds
      }

      if (currentIds.length >= orderLimit) {
        return currentIds
      }

      const safeIndex = Math.min(targetIndex, currentIds.length)
      const nextIds = [...currentIds]

      nextIds.splice(safeIndex, 0, chipId)
      return nextIds
    })
  }

  function readDraggedChipId(event: DragEvent<HTMLElement>) {
    return event.dataTransfer.getData('text/plain') || draggedChipId
  }

  function handleChipDragStart(
    event: DragEvent<HTMLButtonElement>,
    chipId: string,
  ) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', chipId)
    setDraggedChipId(chipId)
  }

  function handleChipDragEnd() {
    setDraggedChipId(null)
  }

  function handleChipPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    chipId: string,
  ) {
    if (event.button !== 0 || isSubmitting) {
      return
    }

    pointerDragRef.current = {
      chipId,
      hasMoved: false,
      startX: event.clientX,
      startY: event.clientY,
    }
  }

  function handleOrderDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function handleOrderDrop(
    event: DragEvent<HTMLElement>,
    targetIndex: number,
  ) {
    event.preventDefault()
    event.stopPropagation()

    const chipId = readDraggedChipId(event)

    if (chipId) {
      placeOrderChip(chipId, targetIndex)
    }

    setDraggedChipId(null)
  }

  function handleOrderPointerUp(
    event: ReactPointerEvent<HTMLElement>,
    targetIndex: number,
  ) {
    const dragState = pointerDragRef.current

    if (!dragState?.hasMoved) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    placeOrderChip(dragState.chipId, targetIndex)
    pointerDragRef.current = null
    suppressClickRef.current = true
    setDraggedChipId(null)
  }

  function handleOrderedChipClick(chipId: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    removeOrderChip(chipId)
  }

  function resetAnswer() {
    setSelectedOptionId('')
    setSelectedChipIds([])
    setPromptAssemblyAnswer({})
    setPairMatchingAnswer({})
    setSelectedPromptSlotId('')
    setActiveBossRoundIndex(0)
    setBossRoundAnswers({})
    clearInteractionState()
    onReset()
  }

  function resetCurrentAnswer() {
    setSelectedOptionId('')
    setSelectedChipIds([])
    setPromptAssemblyAnswer({})
    setPairMatchingAnswer({})
    setSelectedPromptSlotId('')
    clearInteractionState()
    onReset()
  }

  function getCurrentAnswer(): BasicMissionAnswer {
    if (activeMission.kind === 'scenario-decision') {
      return selectedOptionId
    }

    if (activeMission.kind === 'prompt-assembly') {
      return promptAssemblyAnswer
    }

    if (activeMission.kind === 'pair-matching') {
      return pairMatchingAnswer
    }

    return selectedChipIds
  }

  function prepareNextBossRound(nextAnswers: BossFightAnswer) {
    setBossRoundAnswers(nextAnswers)
    setActiveBossRoundIndex((currentIndex) => currentIndex + 1)
    setSelectedOptionId('')
    setSelectedChipIds([])
    setPromptAssemblyAnswer({})
    setPairMatchingAnswer({})
    setSelectedPromptSlotId('')
    clearInteractionState()
    onReset()
  }

  async function submitAnswer() {
    if (!isReady) {
      return
    }

    const answer = getCurrentAnswer()

    if (isBossFight) {
      const nextAnswers = {
        ...bossRoundAnswers,
        [activeMission.id]: answer,
      }
      const isLastBossRound = activeBossRoundIndex >= bossRounds.length - 1

      if (!isLastBossRound) {
        prepareNextBossRound(nextAnswers)
        return
      }

      setBossRoundAnswers(nextAnswers)
      await onSubmit(nextAnswers)
      return
    }

    await onSubmit(answer)
  }

  return {
    activeMission,
    activePairItemId,
    activePromptSlotId,
    activeRoundNumber,
    assignPairItemToTarget,
    bossDossierItems,
    bossRoundCount,
    bossStageProgress,
    draggedChipId,
    handleChipDragEnd,
    handleChipDragStart,
    handleChipPointerDown,
    handleOrderDragOver,
    handleOrderDrop,
    handleOrderedChipClick,
    handleOrderPointerUp,
    isBossFight,
    isReady,
    orderLimit,
    assignPromptFragmentToSlot,
    clearPairItem,
    pickOrderChip,
    pairMatchingAnswer,
    placePromptFragment,
    primaryActionLabel,
    promptAssemblyAnswer,
    resetAnswer,
    resetCurrentAnswer,
    clearPromptSlot,
    selectedBudgetCost,
    selectedChipIds,
    selectedChipSet,
    selectedOptionId,
    selectPairItem: setSelectedPairItemId,
    selectedPromptFragmentId,
    selectOption: setSelectedOptionId,
    selectPromptFragment,
    selectPromptSlot,
    submitAnswer,
    toggleChip,
  }
}
