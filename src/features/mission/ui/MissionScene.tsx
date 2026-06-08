import { useState } from 'react'
import { Link } from 'react-router-dom'
import type {
  PublicChapter,
  PublicMission,
  PublicMissionEvaluation,
  PublicPromptAssemblyMission,
} from '../../../shared/types/domain'
import type { MissionAnswer } from '../../../entities/mission/lib/missionEngine'
import { useModalEscapeClose } from '../../../shared/lib/a11y/useModalEscapeClose'
import { useMissionSceneState } from '../lib/useMissionSceneState'
import { BossArena } from './BossArena'
import { BossDossierPanel } from './BossDossierPanel'
import { MissionFeedbackPanel } from './MissionFeedbackPanel'
import { MissionInteractionBoard } from './MissionInteractionBoards'
import type { TrapDiscovery } from './TrapDiscoveryPanel'

type MissionSceneProps = {
  chapter: PublicChapter
  mission: PublicMission
  result: PublicMissionEvaluation | null
  trapDiscoveries?: TrapDiscovery[]
  isSubmitting: boolean
  nextHref: string | null
  nextLabel: string
  qaPassEnabled: boolean
  onQaPassSubmit: () => Promise<void>
  onReset: () => void
  onSubmit: (answer: MissionAnswer) => Promise<void>
}

type MissionBrief = {
  action: string
  context: string
  focusLabel: string | null
  typeLabel: string
}

const actionSentenceStarters = [
  'Выбери',
  'Выберите',
  'Отметь',
  'Отметьте',
  'Собери',
  'Соберите',
  'Расставь',
  'Расставьте',
  'Проверь',
  'Проверьте',
  'Найди',
  'Найдите',
  'Что',
  'Какой',
  'Какая',
  'Какие',
  'Какое',
  'Когда',
  'Где',
  'Куда',
  'Кому',
  'Почему',
  'Как',
]

function getMissionLayoutClass(
  mission: PublicMission,
  activeMissionKind: string,
  hasResult: boolean,
) {
  const isBossFight = mission.kind === 'boss-fight'
  const isPromptAssemblyScene = mission.kind === 'prompt-assembly'

  return `mission-layout mission-layout-${activeMissionKind} ${
    isBossFight ? 'mission-layout-boss' : ''
  } ${
    isPromptAssemblyScene && !isBossFight && hasResult
      ? 'mission-layout-prompt-reviewed'
      : ''
  }`
}

function getMissionConsoleClass(
  activeMissionKind: string,
  isBossFight: boolean,
  hasBossFinalReveal: boolean,
) {
  return `mission-console mission-console-${activeMissionKind} ${
    isBossFight ? 'mission-console-boss' : ''
  } ${hasBossFinalReveal ? 'mission-console-boss-reveal' : ''}`
}

function getMissionTypeLabel(mission: PublicMission) {
  if (mission.kind === 'boss-fight') {
    return 'Финал'
  }

  if (mission.kind === 'scenario-decision') {
    return 'Выбор решения'
  }

  if (mission.kind === 'chip-ordering') {
    return 'Порядок шагов'
  }

  if (mission.kind === 'prompt-assembly') {
    return 'Сборка prompt-контракта'
  }

  if (mission.kind === 'pair-matching') {
    return 'Соедини пару'
  }

  return mission.budget ? 'Бюджет выбора' : 'Мультивыбор'
}

function getActionFallback(mission: PublicMission) {
  if (mission.kind === 'boss-fight') {
    return 'Пройди раунды и собери решение до финального шлюза.'
  }

  if (mission.kind === 'scenario-decision') {
    return 'Выбери решение, которое удерживает задачу в инженерной рамке.'
  }

  if (mission.kind === 'chip-ordering') {
    return 'Расставь шаги в правильном порядке.'
  }

  if (mission.kind === 'prompt-assembly') {
    return 'Собери prompt-контракт из фрагментов.'
  }

  if (mission.kind === 'pair-matching') {
    return 'Соедини каждый пример с подходящим носителем знания.'
  }

  return mission.budget
    ? 'Собери набор пунктов в пределах лимита.'
    : 'Отметь все подходящие пункты.'
}

function getContextFallback(mission: PublicMission) {
  if (mission.kind === 'boss-fight') {
    return 'Финальный сценарий собирает несколько решений в один проход.'
  }

  if (mission.kind === 'scenario-decision') {
    return 'Перед тобой рабочая ситуация из ревью или постановки задачи.'
  }

  if (mission.kind === 'chip-ordering') {
    return 'Перед тобой набор шагов для сборки в устойчивую последовательность.'
  }

  if (mission.kind === 'prompt-assembly') {
    return 'Перед тобой большая рабочая ситуация и набор фрагментов для prompt-контракта.'
  }

  if (mission.kind === 'pair-matching') {
    return 'Перед тобой примеры знаний, инструкций, процедур или рабочих сценариев.'
  }

  return 'Перед тобой набор вариантов для разбора рабочей ситуации.'
}

function isActionSentence(sentence: string) {
  const normalizedSentence = sentence.replace(/^[«“"`'(\s]+/u, '').trim()

  return (
    normalizedSentence.endsWith('?') ||
    actionSentenceStarters.some((starter) =>
      normalizedSentence.startsWith(starter),
    )
  )
}

function splitPromptSentences(prompt: string) {
  return prompt
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function capitalizeBriefSentence(sentence: string) {
  return sentence.replace(/^([а-яё])/u, (match) => match.toUpperCase())
}

function getMissionBrief(mission: PublicMission): MissionBrief {
  const focusMatch = mission.prompt.match(/^(Цель|Задача):\s*/u)
  const focusLabel = focusMatch ? 'Задача' : null
  const promptWithoutFocus = focusMatch
    ? mission.prompt.slice(focusMatch[0].length).trim()
    : mission.prompt.trim()
  const sentences = splitPromptSentences(promptWithoutFocus)
  const lastSentence = sentences.at(-1)
  const hasActionSentence = lastSentence ? isActionSentence(lastSentence) : false
  const contextSentences = hasActionSentence ? sentences.slice(0, -1) : sentences
  const context = capitalizeBriefSentence(
    contextSentences.join(' ') || getContextFallback(mission),
  )

  return {
    action:
      hasActionSentence && lastSentence ? lastSentence : getActionFallback(mission),
    context,
    focusLabel,
    typeLabel: getMissionTypeLabel(mission),
  }
}

function getPromptSceneLabel(chapter: PublicChapter, mission: PublicMission) {
  const chapterNumber = chapter.id.match(/\d+/u)?.[0]
  const missionIndex = chapter.missions.findIndex(
    (chapterMission) => chapterMission.id === mission.id,
  )

  if (chapterNumber && missionIndex >= 0) {
    return `Сцена ${chapterNumber}.${missionIndex + 1}`
  }

  return 'Сцена'
}

function PromptAssemblyBriefingModal({
  action,
  brief,
  onClose,
}: {
  action: string
  brief: PublicPromptAssemblyMission['brief']
  onClose: () => void
}) {
  useModalEscapeClose(true, onClose)

  return (
    <div className="prompt-briefing-overlay">
      <section
        aria-label="Бриф prompt-контракта"
        aria-modal="true"
        className="prompt-briefing-panel"
        role="dialog"
      >
        <div className="prompt-briefing-header">
          <div className="prompt-briefing-robot" aria-hidden="true">
            <span className="prompt-briefing-light" />
            <span className="prompt-briefing-eye prompt-briefing-eye-left" />
            <span className="prompt-briefing-eye prompt-briefing-eye-right" />
            <span className="prompt-briefing-mouth" />
          </div>
          <div>
            <p className="eyebrow">Входящее задание от Kilian</p>
            <h2>Собери prompt-контракт</h2>
            <p>{action}</p>
          </div>
          <button
            aria-label="Закрыть бриф"
            className="prompt-briefing-close"
            onClick={onClose}
            title="Закрыть бриф"
            type="button"
          >
            x
          </button>
        </div>

        <div className="prompt-briefing-grid">
          <section>
            <span>Цель</span>
            <p>{brief.teamWants}</p>
          </section>
          <section>
            <span>Опасность</span>
            <p>{brief.risk}</p>
          </section>
          <section>
            <span>Финиш</span>
            <p>{brief.reviewableResult}</p>
          </section>
        </div>

        <div className="prompt-briefing-footer">
          <button className="pixel-button" onClick={onClose} type="button">
            К сборке
          </button>
        </div>
      </section>
    </div>
  )
}

export function MissionScene({
  chapter,
  mission,
  result,
  trapDiscoveries = [],
  isSubmitting,
  nextHref,
  nextLabel,
  qaPassEnabled,
  onQaPassSubmit,
  onReset,
  onSubmit,
}: MissionSceneProps) {
  const controller = useMissionSceneState({
    isSubmitting,
    mission,
    onReset,
    onSubmit,
    result,
  })
  const {
    activeMission,
    activeRoundNumber,
    bossDossierItems,
    bossRoundCount,
    bossStageProgress,
    isBossFight,
    isReady,
    primaryActionLabel,
    resetAnswer,
    resetCurrentAnswer,
    submitAnswer,
  } = controller
  const bossRounds = mission.kind === 'boss-fight' ? mission.rounds : []
  const hasBossFinalReveal = isBossFight && Boolean(result?.roundResults)
  const [isBossDossierOpen, setBossDossierOpen] = useState(false)
  const [isBossDossierCueDismissed, setBossDossierCueDismissed] =
    useState(false)
  const hasBossDossierItems = bossDossierItems.length > 0
  const [isBossFinalDossierDismissed, setBossFinalDossierDismissed] =
    useState(false)
  const shouldShowBossDossierCue =
    isBossFight &&
    hasBossDossierItems &&
    !hasBossFinalReveal &&
    !isBossDossierCueDismissed
  const shouldShowBossDossier =
    hasBossDossierItems &&
    (isBossDossierOpen ||
      (hasBossFinalReveal && !isBossFinalDossierDismissed))
  const resultTakeaway =
    result && mission.kind === 'boss-fight'
      ? mission.takeaway
      : result
        ? activeMission.takeaway
        : undefined
  const retryPrinciple =
    result && !result.passed
      ? mission.kind === 'boss-fight'
        ? mission.retryPrinciple
        : activeMission.retryPrinciple
      : undefined
  const missionBrief = getMissionBrief(mission)
  const promptAssemblyBrief =
    activeMission.kind === 'prompt-assembly' ? activeMission.brief : null
  const [isPromptBriefingOpen, setPromptBriefingOpen] = useState(
    () => activeMission.kind === 'prompt-assembly',
  )
  const shouldShowFeedbackPanel =
    mission.kind !== 'prompt-assembly' || Boolean(result)
  const promptAssemblyFilledSlotCount =
    activeMission.kind === 'prompt-assembly'
      ? activeMission.slots.filter(
          (slot) => controller.promptAssemblyAnswer[slot.id],
        ).length
      : 0

  function openBossDossier() {
    setBossDossierOpen(true)
    setBossFinalDossierDismissed(false)
    setBossDossierCueDismissed(true)
  }

  function closeBossDossier() {
    setBossDossierOpen(false)

    if (hasBossFinalReveal) {
      setBossFinalDossierDismissed(true)
    }
  }

  function resetMissionAttempt() {
    setBossDossierOpen(false)
    setBossDossierCueDismissed(false)
    setBossFinalDossierDismissed(false)
    resetAnswer()
  }

  return (
    <div
      className={getMissionLayoutClass(
        mission,
        activeMission.kind,
        Boolean(result),
      )}
    >
      <section
        className={`mission-brief ${
          mission.id === chapter.boss.id ? 'mission-brief-final' : ''
        } ${promptAssemblyBrief ? 'mission-brief-prompt-compact' : ''}`}
        aria-label={`Бриф сцены: ${mission.title}`}
      >
        {promptAssemblyBrief ? (
          <>
            <div className="mission-brief-compact-copy">
              <p className="eyebrow mission-brief-kicker">
                {getPromptSceneLabel(chapter, mission)} · Prompt-контракт ·{' '}
                {promptAssemblyFilledSlotCount}/
                {activeMission.kind === 'prompt-assembly'
                  ? activeMission.slots.length
                  : 0}{' '}
                собрано
              </p>
              <p>Один e2e-сценарий, маленький diff, проверка до ревью</p>
            </div>
            <div className="mission-brief-header-actions">
              <span className="mission-brief-type">{missionBrief.typeLabel}</span>
              {!shouldShowFeedbackPanel ? (
                <Link
                  className="mission-brief-return-link"
                  to={`/chapters/${chapter.id}`}
                >
                  Вернуться к брифингу
                </Link>
              ) : null}
              <button
                className="mission-brief-dossier-button"
                onClick={() => setPromptBriefingOpen(true)}
                type="button"
              >
                Бриф
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mission-brief-header">
              <p className="eyebrow mission-brief-kicker">Бриф сцены</p>
              <div className="mission-brief-header-actions">
                <span className="mission-brief-type">
                  {missionBrief.typeLabel}
                </span>
              </div>
            </div>

            <div className="mission-brief-copy">
              {missionBrief.focusLabel ? (
                <span className="mission-brief-focus-label">
                  {missionBrief.focusLabel}
                </span>
              ) : null}
              <p>{missionBrief.context}</p>
            </div>

            <div className="mission-brief-action">
              <strong>Твой ход</strong>
              <p>{missionBrief.action}</p>
            </div>
          </>
        )}
      </section>

      <section
        className={getMissionConsoleClass(
          activeMission.kind,
          isBossFight,
          hasBossFinalReveal,
        )}
        aria-label="Практическая сцена"
      >
        {isBossFight ? (
          <BossArena
            activeMission={activeMission}
            activeRoundNumber={activeRoundNumber}
            bossDossierItems={bossDossierItems}
            bossRoundCount={bossRoundCount}
            bossStageProgress={bossStageProgress}
            isDossierOpen={shouldShowBossDossier}
            onOpenDossier={openBossDossier}
            rounds={bossRounds}
            showDossierCue={shouldShowBossDossierCue}
          />
        ) : null}

        {!hasBossFinalReveal ? (
          <MissionInteractionBoard
            controller={controller}
            isSubmitting={isSubmitting}
            missionAction={missionBrief.action}
            mission={activeMission}
          />
        ) : null}

        {!hasBossFinalReveal ? (
          <div className="mission-actions">
            <button
              className="pixel-button"
              disabled={!isReady || isSubmitting || Boolean(result?.passed)}
              onClick={submitAnswer}
              type="button"
            >
              {primaryActionLabel}
            </button>
            <button
              className="pixel-button pixel-button-secondary"
              disabled={isSubmitting}
              onClick={resetCurrentAnswer}
              type="button"
            >
              Сбросить
            </button>
            {qaPassEnabled ? (
              <button
                className="pixel-button pixel-button-secondary"
                disabled={isSubmitting || Boolean(result?.passed)}
                onClick={onQaPassSubmit}
                type="button"
              >
                QA PASS
              </button>
            ) : null}
          </div>
        ) : null}

        {isBossFight ? (
          <BossDossierPanel
            bossRoundCount={bossRoundCount}
            isFinalReveal={hasBossFinalReveal}
            isOpen={shouldShowBossDossier}
            items={bossDossierItems}
            onClose={closeBossDossier}
          />
        ) : null}
      </section>

      {shouldShowFeedbackPanel ? (
        <MissionFeedbackPanel
          activeMission={activeMission}
          chapter={chapter}
          isBossFight={isBossFight}
          nextHref={nextHref}
          nextLabel={nextLabel}
          onReset={resetMissionAttempt}
          result={result}
          retryPrinciple={retryPrinciple}
          takeaway={resultTakeaway}
          trapDiscoveries={trapDiscoveries}
        />
      ) : null}

      {promptAssemblyBrief && isPromptBriefingOpen ? (
        <PromptAssemblyBriefingModal
          action={missionBrief.action}
          brief={promptAssemblyBrief}
          onClose={() => setPromptBriefingOpen(false)}
        />
      ) : null}
    </div>
  )
}
