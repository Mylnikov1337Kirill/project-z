import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  PublicBossFightRoundMission,
  PublicChipOrderingMission,
  PublicChipPickerMission,
  PublicPairMatchingMission,
  PublicPromptAssemblyMission,
  PublicPromptAssemblySlot,
  PublicScenarioDecisionMission,
} from '../../../shared/types/domain'
import { useModalEscapeClose } from '../../../shared/lib/a11y/useModalEscapeClose'
import {
  canSelectChipWithinBudget,
  getChipCost,
} from '../lib/missionAnswerHelpers'
import { getLaunchStableAnswerDisplayItems } from '../lib/answerDisplayShuffle'
import type { MissionSceneController } from '../lib/useMissionSceneState'

type ScenarioDecisionBoardProps = {
  isSubmitting: boolean
  mission: PublicScenarioDecisionMission
  onSelect: (optionId: string) => void
  selectedOptionId: string
}

type ChipPickerBoardProps = {
  isSubmitting: boolean
  mission: PublicChipPickerMission
  selectedBudgetCost: number
  selectedChipIds: string[]
  selectedChipSet: Set<string>
  onToggleChip: (chipId: string) => void
}

type ChipOrderingBoardProps = {
  controller: MissionSceneController
  isSubmitting: boolean
  mission: PublicChipOrderingMission
}

type PromptAssemblyBoardProps = {
  controller: MissionSceneController
  isSubmitting: boolean
  mission: PublicPromptAssemblyMission
  missionAction: string
}

type PairMatchingBoardProps = {
  controller: MissionSceneController
  isSubmitting: boolean
  mission: PublicPairMatchingMission
}

type PromptHelpButtonProps = {
  children: string
  label: string
  tooltipId: string
}

export type PromptDossierTarget =
  | {
      type: 'brief'
    }
  | {
      type: 'contract'
    }
  | {
      slotId: string
      type: 'slot'
    }
  | {
      fragmentId: string
      type: 'fragment'
    }

type MissionInteractionBoardProps = {
  controller: MissionSceneController
  isSubmitting: boolean
  mission: PublicBossFightRoundMission
  missionAction?: string
}

export const PROMPT_DOSSIER_REQUEST_EVENT =
  'project-z:open-prompt-dossier'

function getCardCountLabel(count: number) {
  const lastTwoDigits = count % 100

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${count} карточек`
  }

  const lastDigit = count % 10

  if (lastDigit === 1) {
    return `${count} карточка`
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${count} карточки`
  }

  return `${count} карточек`
}

function PromptHelpButton({
  children,
  label,
  tooltipId,
}: PromptHelpButtonProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const containerRef = useRef<HTMLSpanElement>(null)
  const isOpen = isFocused || isHovered || isPinned

  useEffect(() => {
    if (!isPinned) {
      return undefined
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        containerRef.current?.contains(event.target)
      ) {
        return
      }

      setIsFocused(false)
      setIsPinned(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsPinned(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPinned])

  return (
    <span
      className={`prompt-help-popover ${
        isOpen ? 'prompt-help-popover-open' : ''
      }`}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget

        if (
          !(nextTarget instanceof Node) ||
          !event.currentTarget.contains(nextTarget)
        ) {
          setIsFocused(false)
        }
      }}
      onFocus={() => setIsFocused(true)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      ref={containerRef}
    >
      <button
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        aria-label={label}
        className="prompt-help-button"
        onClick={(event) => {
          if (isPinned) {
            setIsFocused(false)
            setIsPinned(false)
            event.currentTarget.blur()
            return
          }

          setIsPinned(true)
        }}
        type="button"
      >
        ?
      </button>
      <span className="prompt-help-tooltip" id={tooltipId} role="tooltip">
        {children}
      </span>
    </span>
  )
}

function ScenarioDecisionBoard({
  isSubmitting,
  mission,
  onSelect,
  selectedOptionId,
}: ScenarioDecisionBoardProps) {
  const displayOptions = useMemo(
    () =>
      getLaunchStableAnswerDisplayItems(
        mission.options,
        `${mission.id}:scenario-options`,
      ),
    [mission.id, mission.options],
  )

  return (
    <div className="choice-grid">
      {displayOptions.map((option) => (
        <button
          className={`answer-card ${
            selectedOptionId === option.id ? 'answer-card-selected' : ''
          }`}
          aria-pressed={selectedOptionId === option.id}
          disabled={isSubmitting}
          key={option.id}
          onClick={() => onSelect(option.id)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function ChipPickerBoard({
  isSubmitting,
  mission,
  onToggleChip,
  selectedBudgetCost,
  selectedChipIds,
  selectedChipSet,
}: ChipPickerBoardProps) {
  const displayChips = useMemo(
    () =>
      getLaunchStableAnswerDisplayItems(
        mission.chips,
        `${mission.id}:chip-picker`,
      ),
    [mission.chips, mission.id],
  )

  return (
    <div className="chip-picker-board">
      <div className="mission-mode-hint">
        <span>
          {mission.budget
            ? mission.budget.label
            : 'Можно выбрать несколько вариантов'}
        </span>
        <strong>
          {mission.budget
            ? `${selectedBudgetCost}/${mission.budget.limit} ${mission.budget.unit}`
            : `${selectedChipIds.length} выбрано`}
        </strong>
      </div>

      <div className="chip-grid" aria-label="Варианты ответа">
        {displayChips.map((chip) => {
          const isSelected = selectedChipSet.has(chip.id)
          const isBudgetLocked =
            !isSelected &&
            !canSelectChipWithinBudget(mission, selectedChipIds, chip.id)

          return (
            <button
              aria-pressed={isSelected}
              className={`mission-chip mission-chip-selectable ${
                isSelected ? 'mission-chip-selected' : ''
              }`}
              disabled={isSubmitting || isBudgetLocked}
              key={chip.id}
              onClick={() => onToggleChip(chip.id)}
              type="button"
            >
              <span className="chip-indicator" aria-hidden="true">
                {isSelected ? '✓' : '+'}
              </span>
              <span>
                {chip.label}
                {mission.budget ? (
                  <small>
                    {getChipCost(chip)} {mission.budget.unit}
                  </small>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ChipOrderingBoard({
  controller,
  isSubmitting,
  mission,
}: ChipOrderingBoardProps) {
  const {
    draggedChipId,
    handleChipDragEnd,
    handleChipDragStart,
    handleChipPointerDown,
    handleOrderDragOver,
    handleOrderDrop,
    handleOrderedChipClick,
    handleOrderPointerUp,
    orderLimit,
    pickOrderChip,
    selectedChipIds,
    selectedChipSet,
  } = controller
  const displayChips = useMemo(
    () =>
      getLaunchStableAnswerDisplayItems(
        mission.chips,
        `${mission.id}:chip-ordering-bank`,
      ),
    [mission.chips, mission.id],
  )

  return (
    <div className="ordering-board">
      <div
        className={`order-track ${draggedChipId ? 'order-track-active' : ''}`}
        aria-label="Текущий порядок"
        onDragOver={handleOrderDragOver}
        onDrop={(event) => handleOrderDrop(event, selectedChipIds.length)}
        onPointerUp={(event) =>
          handleOrderPointerUp(event, selectedChipIds.length)
        }
      >
        {selectedChipIds.length === 0 ? (
          <p>Перетащи карточки сюда или выбери их в нужном порядке.</p>
        ) : (
          selectedChipIds.map((chipId, index) => {
            const chip = mission.chips.find((item) => item.id === chipId)

            return chip ? (
              <button
                className="ordered-chip"
                disabled={isSubmitting}
                draggable={!isSubmitting}
                onDragEnd={handleChipDragEnd}
                onDragOver={handleOrderDragOver}
                onDragStart={(event) => handleChipDragStart(event, chip.id)}
                onDrop={(event) => handleOrderDrop(event, index)}
                onPointerDown={(event) =>
                  handleChipPointerDown(event, chip.id)
                }
                onPointerUp={(event) => handleOrderPointerUp(event, index)}
                key={chip.id}
                onClick={() => handleOrderedChipClick(chip.id)}
                type="button"
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                {chip.label}
              </button>
            ) : null
          })
        )}
      </div>

      <div className="chip-grid" aria-label="Карточки для сборки">
        {displayChips.map((chip) => (
          <button
            className={`mission-chip ${
              selectedChipSet.has(chip.id) ? 'mission-chip-used' : ''
            }`}
            disabled={
              isSubmitting ||
              selectedChipSet.has(chip.id) ||
              selectedChipIds.length >= orderLimit
            }
            draggable={
              !isSubmitting &&
              !selectedChipSet.has(chip.id) &&
              selectedChipIds.length < orderLimit
            }
            key={chip.id}
            onDragEnd={handleChipDragEnd}
            onDragStart={(event) => handleChipDragStart(event, chip.id)}
            onPointerDown={(event) => handleChipPointerDown(event, chip.id)}
            onClick={() => pickOrderChip(chip.id)}
            type="button"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function PairMatchingBoard({
  controller,
  isSubmitting,
  mission,
}: PairMatchingBoardProps) {
  const {
    activePairItemId,
    assignPairItemToTarget,
    clearPairItem,
    pairMatchingAnswer,
    selectPairItem,
  } = controller
  const activeItem = mission.items.find((item) => item.id === activePairItemId)
  const assignedItemCount = mission.items.filter(
    (item) => pairMatchingAnswer[item.id],
  ).length
  const progressPercent =
    mission.items.length > 0
      ? Math.round((assignedItemCount / mission.items.length) * 100)
      : 0

  function getAssignedTargetLabel(itemId: string) {
    const targetId = pairMatchingAnswer[itemId]
    const target = mission.targets.find((candidate) => candidate.id === targetId)

    return target?.label ?? ''
  }

  return (
    <div className="pair-matching-board">
      <div className="pair-matching-status" aria-label="Прогресс соединения пар">
        <div className="mission-mode-hint">
          <span>Назначь носитель</span>
          <strong>
            {assignedItemCount}/{mission.items.length}
          </strong>
        </div>
        <div className="pair-progress-track" aria-hidden="true">
          <span style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="pair-matching-workbench">
        <section className="pair-item-rail" aria-label="Примеры для разбора">
          {mission.items.map((item, index) => {
            const assignedTargetLabel = getAssignedTargetLabel(item.id)
            const isActive = item.id === activePairItemId
            const isAssigned = Boolean(assignedTargetLabel)

            return (
              <article
                className={`pair-item-card ${
                  isActive ? 'pair-item-card-active' : ''
                } ${isAssigned ? 'pair-item-card-assigned' : ''}`}
                key={item.id}
              >
                <button
                  aria-pressed={isActive}
                  className="pair-item-main"
                  disabled={isSubmitting}
                  onClick={() => selectPairItem(item.id)}
                  type="button"
                >
                  <span className="pair-item-marker">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="pair-item-copy">
                    <strong>{item.label}</strong>
                    {item.description ? <small>{item.description}</small> : null}
                    <em>
                      {assignedTargetLabel
                        ? `Выбрано: ${assignedTargetLabel}`
                        : 'Носитель не выбран'}
                    </em>
                  </span>
                </button>
                <button
                  aria-label={`Очистить пару для ${item.label}`}
                  className="pair-clear-button"
                  disabled={isSubmitting || !isAssigned}
                  onClick={() => clearPairItem(item.id)}
                  title="Очистить пару"
                  type="button"
                >
                  x
                </button>
              </article>
            )
          })}
        </section>

        <section className="pair-target-board" aria-label="Носители знания">
          <div className="pair-active-item">
            <span>Активный пример</span>
            <strong>{activeItem?.label ?? 'Выбери пример'}</strong>
          </div>

          <div className="pair-target-grid">
            {mission.targets.map((target) => {
              const isAssignedToActive =
                Boolean(activeItem) &&
                pairMatchingAnswer[activeItem?.id ?? ''] === target.id
              const assignedItems = mission.items.filter(
                (item) => pairMatchingAnswer[item.id] === target.id,
              )

              return (
                <article
                  className={`pair-target-zone ${
                    isAssignedToActive ? 'pair-target-zone-active' : ''
                  }`}
                  key={target.id}
                >
                  <button
                    aria-pressed={isAssignedToActive}
                    className="pair-target-main"
                    disabled={isSubmitting || !activeItem}
                    onClick={() => {
                      if (activeItem) {
                        assignPairItemToTarget(activeItem.id, target.id)
                      }
                    }}
                    type="button"
                  >
                    <strong>{target.label}</strong>
                    {target.description ? <span>{target.description}</span> : null}
                  </button>

                  <div
                    className="pair-target-assignments"
                    aria-label={`Назначено в ${target.label}`}
                  >
                    {assignedItems.length > 0 ? (
                      assignedItems.map((item) => (
                        <button
                          className="pair-assigned-chip"
                          disabled={isSubmitting}
                          key={item.id}
                          onClick={() => selectPairItem(item.id)}
                          type="button"
                        >
                          {item.label}
                        </button>
                      ))
                    ) : (
                      <p>Пока пусто</p>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

function getPromptFragmentPreview(
  fragment: PublicPromptAssemblyMission['fragments'][number],
) {
  return fragment.preview ?? fragment.body
}

function getPromptSlotFragment(
  mission: PublicPromptAssemblyMission,
  promptAssemblyAnswer: Record<string, string | null | undefined>,
  slotId: string,
) {
  return mission.fragments.find(
    (fragment) => fragment.id === promptAssemblyAnswer[slotId],
  )
}

function getPromptFragmentSlot(
  mission: PublicPromptAssemblyMission,
  promptAssemblyAnswer: Record<string, string | null | undefined>,
  fragmentId: string,
) {
  return mission.slots.find(
    (slot) => promptAssemblyAnswer[slot.id] === fragmentId,
  )
}

function getPromptDossierTitle(target: PromptDossierTarget) {
  if (target.type === 'brief') {
    return 'Полный бриф'
  }

  if (target.type === 'contract') {
    return 'Все слоты'
  }

  if (target.type === 'slot') {
    return 'Слот контракта'
  }

  return 'Фрагмент'
}

type PromptAssemblyDossierProps = {
  activeSlot: PublicPromptAssemblySlot | null
  isSubmitting: boolean
  mission: PublicPromptAssemblyMission
  missionAction: string
  onAssignFragmentToActiveSlot: (fragmentId: string) => void
  onClearSlot: (slotId: string) => void
  onClose: () => void
  onOpen: (target: PromptDossierTarget) => void
  promptAssemblyAnswer: Record<string, string | null | undefined>
  target: PromptDossierTarget | null
}

function PromptAssemblyDossier({
  activeSlot,
  isSubmitting,
  mission,
  missionAction,
  onAssignFragmentToActiveSlot,
  onClearSlot,
  onClose,
  onOpen,
  promptAssemblyAnswer,
  target,
}: PromptAssemblyDossierProps) {
  useModalEscapeClose(Boolean(target), onClose)

  if (!target) {
    return null
  }

  const focusedSlot =
    target.type === 'slot'
      ? (mission.slots.find((slot) => slot.id === target.slotId) ?? null)
      : activeSlot
  const focusedSlotFragment = focusedSlot
    ? getPromptSlotFragment(mission, promptAssemblyAnswer, focusedSlot.id)
    : null
  const focusedFragment =
    target.type === 'fragment'
      ? (mission.fragments.find(
          (fragment) => fragment.id === target.fragmentId,
        ) ?? null)
      : focusedSlotFragment
  const focusedFragmentSlot = focusedFragment
    ? getPromptFragmentSlot(mission, promptAssemblyAnswer, focusedFragment.id)
    : null
  const isFocusedFragmentInActiveSlot =
    Boolean(activeSlot && focusedFragment) &&
    promptAssemblyAnswer[activeSlot?.id ?? ''] === focusedFragment?.id
  const focusNavLabel =
    target.type === 'fragment'
      ? 'Фрагмент'
      : target.type === 'slot'
        ? 'Слот'
        : null

  return (
    <div className="prompt-dossier-overlay">
      <section
        className={`prompt-dossier-panel prompt-dossier-panel-${target.type}`}
        aria-label="Prompt-досье"
        aria-modal="true"
        role="dialog"
      >
        <div className="prompt-dossier-panel-header">
          <div>
            <p className="eyebrow">Prompt-досье</p>
            <h3>{getPromptDossierTitle(target)}</h3>
          </div>
          <div className="prompt-dossier-panel-actions">
            <span>
              {Object.values(promptAssemblyAnswer).filter(Boolean).length}/
              {mission.slots.length}
            </span>
            <button
              className="prompt-dossier-close"
              aria-label="Закрыть prompt-досье"
              onClick={onClose}
              type="button"
            >
              x
            </button>
          </div>
        </div>

        <div className="prompt-dossier-nav" aria-label="Разделы prompt-досье">
          <button
            aria-pressed={target.type === 'brief'}
            onClick={() => onOpen({ type: 'brief' })}
            type="button"
          >
            Бриф
          </button>
          <button
            aria-pressed={target.type === 'contract'}
            onClick={() => onOpen({ type: 'contract' })}
            type="button"
          >
            Все слоты
          </button>
          {focusNavLabel ? (
            <button aria-pressed disabled type="button">
              {focusNavLabel}
            </button>
          ) : null}
        </div>

        {target.type === 'brief' ? (
          <div
            className="prompt-dossier-focus prompt-dossier-focus-brief"
            aria-label="Полный бриф"
          >
            <section className="prompt-dossier-brief-section">
              <span>Команда хочет</span>
              <p>{mission.brief.teamWants}</p>
            </section>
            <section className="prompt-dossier-brief-section">
              <span>Риск</span>
              <p>{mission.brief.risk}</p>
            </section>
            <section className="prompt-dossier-brief-section">
              <span>Ревью увидит</span>
              <p>{mission.brief.reviewableResult}</p>
            </section>
            <section className="prompt-dossier-brief-section">
              <span>Твой ход</span>
              <p>{missionAction}</p>
            </section>
          </div>
        ) : null}

        {target.type === 'contract' ? (
          <div className="prompt-dossier-list" aria-label="Все слоты">
            {mission.slots.map((slot, index) => {
              const fragment = getPromptSlotFragment(
                mission,
                promptAssemblyAnswer,
                slot.id,
              )

              return (
                <button
                  className={`prompt-dossier-slot-item ${
                    fragment ? 'prompt-dossier-slot-item-filled' : ''
                  }`}
                  key={slot.id}
                  onClick={() => onOpen({ slotId: slot.id, type: 'slot' })}
                  type="button"
                >
                  <span className="prompt-dossier-marker">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="prompt-dossier-slot-copy">
                    <strong>{slot.label}</strong>
                    {fragment ? (
                      <>
                        <small>{fragment.label}</small>
                        <p>{fragment.body}</p>
                      </>
                    ) : (
                      <p>Слот пока пуст. Полный выбор открыт через детали фрагментов.</p>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}

        {target.type === 'slot' && focusedSlot ? (
          <div
            className="prompt-dossier-focus prompt-dossier-focus-slot"
            aria-label="Детали слота"
          >
            <p className="eyebrow">Слот</p>
            <h4>{focusedSlot.label}</h4>
            {focusedSlotFragment ? (
              <section className="prompt-dossier-selected-fragment">
                <span>Поставленный фрагмент</span>
                <strong>{focusedSlotFragment.label}</strong>
                <p>{focusedSlotFragment.body}</p>
              </section>
            ) : (
              <p className="prompt-dossier-empty">
                Слот ждёт фрагмент. Открой детали подходящего фрагмента и поставь
                его в текущий слот.
              </p>
            )}
          </div>
        ) : null}

        {target.type === 'fragment' && focusedFragment ? (
          <div
            className="prompt-dossier-focus prompt-dossier-focus-fragment"
            aria-label="Детали фрагмента"
          >
            <p className="eyebrow">
              {focusedFragmentSlot
                ? `Уже стоит в слоте: ${focusedFragmentSlot.label}`
                : 'Фрагмент банка'}
            </p>
            <h4>{focusedFragment.label}</h4>
            <p className="prompt-dossier-fragment-body">
              {focusedFragment.body}
            </p>
          </div>
        ) : null}

        <div className="prompt-dossier-footer">
          {target.type === 'brief' ? (
            <button
              className="pixel-button pixel-button-secondary"
              onClick={() => onOpen({ type: 'contract' })}
              type="button"
            >
              Все слоты
            </button>
          ) : null}

          {target.type === 'slot' && focusedSlot ? (
            <>
              <button
                className="pixel-button pixel-button-secondary"
                onClick={() => onOpen({ type: 'contract' })}
                type="button"
              >
                Все слоты
              </button>
              <button
                className="pixel-button pixel-button-secondary"
                disabled={isSubmitting || !focusedSlotFragment}
                onClick={() => {
                  onClearSlot(focusedSlot.id)
                  onClose()
                }}
                type="button"
              >
                Очистить слот
              </button>
            </>
          ) : null}

          {target.type === 'fragment' && focusedFragment ? (
            <button
              className="pixel-button"
              disabled={
                isSubmitting || !activeSlot || isFocusedFragmentInActiveSlot
              }
              onClick={() => {
                onAssignFragmentToActiveSlot(focusedFragment.id)
                onClose()
              }}
              type="button"
            >
              {isFocusedFragmentInActiveSlot
                ? 'Уже в текущем слоте'
                : `Поставить в: ${activeSlot?.label ?? 'слот'}`}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function PromptAssemblyBoard({
  controller,
  isSubmitting,
  mission,
  missionAction,
}: PromptAssemblyBoardProps) {
  const [promptDossierTarget, setPromptDossierTarget] =
    useState<PromptDossierTarget | null>(null)
  const {
    assignPromptFragmentToSlot,
    activePromptSlotId,
    clearPromptSlot,
    promptAssemblyAnswer,
    selectPromptSlot,
  } = controller
  const usedFragmentIds = new Set(
    Object.values(promptAssemblyAnswer).filter(
      (fragmentId): fragmentId is string => Boolean(fragmentId),
    ),
  )
  const filledSlotCount = mission.slots.filter(
    (slot) => promptAssemblyAnswer[slot.id],
  ).length
  const activeSlot =
    mission.slots.find((slot) => slot.id === activePromptSlotId) ?? null
  const activeSlotLabel = activeSlot?.label ?? 'Слот не выбран'
  const progressPercent = Math.round(
    (filledSlotCount / mission.slots.length) * 100,
  )

  useEffect(() => {
    function handlePromptDossierRequest(event: Event) {
      const requestedTarget = (event as CustomEvent<PromptDossierTarget>).detail

      if (requestedTarget?.type) {
        setPromptDossierTarget(requestedTarget)
      }
    }

    window.addEventListener(
      PROMPT_DOSSIER_REQUEST_EVENT,
      handlePromptDossierRequest,
    )

    return () => {
      window.removeEventListener(
        PROMPT_DOSSIER_REQUEST_EVENT,
        handlePromptDossierRequest,
      )
    }
  }, [])

  function assignFragmentToActiveSlot(fragmentId: string) {
    if (!activeSlot) {
      return
    }

    assignPromptFragmentToSlot(activeSlot.id, fragmentId)
  }

  return (
    <div className="prompt-assembly-board">
      <div className="prompt-builder-status" aria-label="Прогресс сборки">
        <div>
          <span>Сборка</span>
          <strong>{filledSlotCount}/{mission.slots.length}</strong>
        </div>
        <div className="prompt-builder-progress" aria-hidden="true">
          <span style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="prompt-assembly-workbench">
        <section
          className="prompt-fragment-workspace"
          aria-label="Рабочая зона фрагментов"
        >
          <div className="prompt-fragment-bank" aria-label="Банк фрагментов">
            <div className="prompt-fragment-bank-header">
              <div className="mission-mode-hint">
                <span>Фрагменты</span>
                <strong>{getCardCountLabel(mission.fragments.length)}</strong>
              </div>
              <PromptHelpButton
                label="О подсказках фрагментов"
                tooltipId="prompt-fragment-help"
              >
                Короткий текст на карточке - только превью. Полный фрагмент
                открыт по i.
              </PromptHelpButton>
            </div>

            <div
              className="prompt-fragment-grid"
              aria-label="Фрагменты для сборки"
            >
              {mission.fragments.map((fragment) => {
                const isUsed = usedFragmentIds.has(fragment.id)
                const usedSlot = getPromptFragmentSlot(
                  mission,
                  promptAssemblyAnswer,
                  fragment.id,
                )
                const statusText = usedSlot
                  ? `В слоте: ${usedSlot.label}`
                  : activeSlot
                    ? 'Добавить в выбранный слот'
                    : 'Выбери слот для размещения'
                const fragmentActionLabel = usedSlot
                  ? `Фрагмент ${fragment.label}. В слоте: ${usedSlot.label}`
                  : activeSlot
                    ? `Добавить фрагмент ${fragment.label} в выбранный слот: ${activeSlotLabel}`
                    : `Фрагмент ${fragment.label}. Выбери слот для размещения`

                return (
                  <article
                    className={`prompt-fragment-card ${
                      isUsed ? 'prompt-fragment-card-used' : ''
                    }`}
                    key={fragment.id}
                  >
                    <button
                      aria-label={fragmentActionLabel}
                      className="prompt-fragment-card-main"
                      disabled={isSubmitting || isUsed || !activeSlot}
                      onClick={() => assignFragmentToActiveSlot(fragment.id)}
                      type="button"
                    >
                      <strong>{fragment.label}</strong>
                      <span className="prompt-fragment-preview">
                        {getPromptFragmentPreview(fragment)}
                      </span>
                      <small>{statusText}</small>
                    </button>
                    <button
                      aria-label={`Детали фрагмента ${fragment.label}`}
                      className="prompt-fragment-detail"
                      onClick={() =>
                        setPromptDossierTarget({
                          fragmentId: fragment.id,
                          type: 'fragment',
                        })
                      }
                      title="Детали фрагмента"
                      type="button"
                    >
                      i
                    </button>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section
          className="prompt-contract-canvas"
          aria-label="Prompt Contract Canvas"
        >
          <div className="prompt-contract-canvas-header">
            <div>
              <p className="eyebrow">Prompt Contract Canvas</p>
              <h3>{filledSlotCount}/{mission.slots.length} slots</h3>
            </div>
            <PromptHelpButton
              label="О схеме prompt-контракта"
              tooltipId="prompt-canvas-help"
            >
              Слоты читаются сверху вниз: цель, контекст, границы, запреты,
              критерии, проверка, план.
            </PromptHelpButton>
          </div>

          <div
            className="prompt-contract-rail"
            aria-label="Слоты prompt-контракта"
          >
            {mission.slots.map((slot, index) => {
              const fragment = getPromptSlotFragment(
                mission,
                promptAssemblyAnswer,
                slot.id,
              )
              const isActive = activePromptSlotId === slot.id
              const marker = String(index + 1).padStart(2, '0')
              const stateClass = fragment
                ? 'prompt-contract-slot-filled'
                : 'prompt-contract-slot-empty'

              return (
                <article
                  className={`prompt-contract-slot ${stateClass} ${
                    isActive ? 'prompt-contract-slot-active' : ''
                  }`}
                  key={slot.id}
                >
                  <button
                    aria-pressed={isActive}
                    className="prompt-contract-slot-main"
                    disabled={isSubmitting}
                    onClick={() => selectPromptSlot(slot.id)}
                    type="button"
                  >
                    <span className="prompt-contract-slot-marker">{marker}</span>
                    <span className="prompt-contract-slot-copy">
                      <strong>{slot.label}</strong>
                      <span className="prompt-contract-slot-preview">
                        {fragment
                          ? getPromptFragmentPreview(fragment)
                          : 'Ждет фрагмент.'}
                      </span>
                    </span>
                  </button>
                  <div className="prompt-contract-slot-actions">
                    <button
                      aria-label={`Детали слота ${slot.label}`}
                      className="prompt-mini-button"
                      onClick={() =>
                        setPromptDossierTarget({
                          slotId: slot.id,
                          type: 'slot',
                        })
                      }
                      title="Детали слота"
                      type="button"
                    >
                      i
                    </button>
                    <button
                      aria-label={`Очистить слот ${slot.label}`}
                      className="prompt-mini-button"
                      disabled={isSubmitting || !fragment}
                      onClick={() => clearPromptSlot(slot.id)}
                      title="Очистить слот"
                      type="button"
                    >
                      x
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </div>

      <PromptAssemblyDossier
        activeSlot={activeSlot}
        isSubmitting={isSubmitting}
        mission={mission}
        missionAction={missionAction}
        onAssignFragmentToActiveSlot={assignFragmentToActiveSlot}
        onClearSlot={clearPromptSlot}
        onClose={() => setPromptDossierTarget(null)}
        onOpen={setPromptDossierTarget}
        promptAssemblyAnswer={promptAssemblyAnswer}
        target={promptDossierTarget}
      />
    </div>
  )
}

export function MissionInteractionBoard({
  controller,
  isSubmitting,
  mission,
  missionAction,
}: MissionInteractionBoardProps) {
  if (mission.kind === 'scenario-decision') {
    return (
      <ScenarioDecisionBoard
        isSubmitting={isSubmitting}
        mission={mission}
        onSelect={controller.selectOption}
        selectedOptionId={controller.selectedOptionId}
      />
    )
  }

  if (mission.kind === 'chip-picker') {
    return (
      <ChipPickerBoard
        isSubmitting={isSubmitting}
        mission={mission}
        onToggleChip={controller.toggleChip}
        selectedBudgetCost={controller.selectedBudgetCost}
        selectedChipIds={controller.selectedChipIds}
        selectedChipSet={controller.selectedChipSet}
      />
    )
  }

  if (mission.kind === 'prompt-assembly') {
    return (
      <PromptAssemblyBoard
        controller={controller}
        isSubmitting={isSubmitting}
        missionAction={missionAction ?? mission.prompt}
        mission={mission}
      />
    )
  }

  if (mission.kind === 'pair-matching') {
    return (
      <PairMatchingBoard
        controller={controller}
        isSubmitting={isSubmitting}
        mission={mission}
      />
    )
  }

  return (
    <ChipOrderingBoard
      controller={controller}
      isSubmitting={isSubmitting}
      mission={mission}
    />
  )
}
