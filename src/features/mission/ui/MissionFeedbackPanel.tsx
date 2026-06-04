import { Link } from 'react-router-dom'
import type {
  PublicChapter,
  PublicMissionEvaluation,
  PublicMission,
} from '../../../shared/types/domain'
import { AnswerDetailList } from './AnswerDetailList'
import {
  TrapDiscoveryPanel,
  type TrapDiscovery,
} from './TrapDiscoveryPanel'

type MissionFeedbackPanelProps = {
  activeMission: Exclude<PublicMission, { kind: 'boss-fight' }>
  chapter: PublicChapter
  isBossFight: boolean
  nextHref: string | null
  nextLabel: string
  onReset: () => void
  result: PublicMissionEvaluation | null
  retryPrinciple?: string
  takeaway?: string
  trapDiscoveries?: TrapDiscovery[]
}

type MentorResultState = 'boss' | 'neutral' | 'review' | 'success' | 'trap'

function hasTrapSignal(result: PublicMissionEvaluation | null) {
  if (!result) {
    return false
  }

  const hasAnswerTrap = result.answerDetails?.some(
    (detail) => detail.status === 'trap' || Boolean(detail.trapId),
  )
  const hasRoundTrap = result.roundResults?.some((round) =>
    round.answerDetails?.some(
      (detail) => detail.status === 'trap' || Boolean(detail.trapId),
    ),
  )

  return Boolean(hasAnswerTrap || hasRoundTrap)
}

function getMentorResultState(input: {
  isBossFight: boolean
  result: PublicMissionEvaluation | null
}) {
  const { isBossFight, result } = input

  if (!result) {
    return 'neutral'
  }

  if (isBossFight) {
    return 'boss'
  }

  if (result.passed) {
    return 'success'
  }

  return hasTrapSignal(result) ? 'trap' : 'review'
}

function getTakeawayTitle(state: MentorResultState) {
  if (state === 'success') {
    return 'Закрепи ход'
  }

  if (state === 'trap') {
    return 'Сигнал ловушки'
  }

  if (state === 'boss') {
    return 'Финальный сигнал'
  }

  return 'Короткий итог'
}

function MentorResultRobot({ state }: { state: MentorResultState }) {
  return (
    <div
      className={`mission-mentor-robot mission-mentor-robot-${state}`}
      aria-hidden="true"
    >
      <span className="mission-mentor-light" />
      <span className="mission-mentor-eye mission-mentor-eye-left" />
      <span className="mission-mentor-eye mission-mentor-eye-right" />
      <span className="mission-mentor-mouth" />
    </div>
  )
}

export function MissionFeedbackPanel({
  activeMission,
  chapter,
  isBossFight,
  nextHref,
  nextLabel,
  onReset,
  result,
  retryPrinciple,
  takeaway,
  trapDiscoveries = [],
}: MissionFeedbackPanelProps) {
  const mentorState = getMentorResultState({ isBossFight, result })
  const shouldShowRetryPrinciple = Boolean(
    result && !result.passed && retryPrinciple,
  )

  return (
    <aside
      className={`mission-feedback ${
        result
          ? result.passed
            ? 'mission-feedback-success'
            : 'mission-feedback-retry'
          : ''
      }`}
      aria-live="polite"
    >
      <div className="mission-feedback-header">
        <MentorResultRobot state={mentorState} />
        <div>
          <p className="eyebrow">Z-бот</p>
          <h2>
            {result
              ? result.passed
                ? isBossFight
                  ? 'Босс повержен'
                  : 'Сцена зачтена'
                : isBossFight
                  ? 'Щиты держатся'
                  : 'Нужно допроверить'
              : 'На что смотреть'}
          </h2>
          <p className="mission-feedback-copy">
            {result ? result.feedback : activeMission.mentorHint}
          </p>
        </div>
      </div>

      {result && takeaway ? (
        <section
          className={`mentor-takeaway mentor-takeaway-${mentorState}`}
          aria-label="Короткий итог от Z-бота"
        >
          <span className="mentor-takeaway-signal" aria-hidden="true" />
          <div>
            <strong>{getTakeawayTitle(mentorState)}</strong>
            <p>{takeaway}</p>
          </div>
        </section>
      ) : null}

      {shouldShowRetryPrinciple ? (
        <section
          className="retry-principle"
          aria-label="Подсказка для повторной попытки"
        >
          <strong>Вспомнить правило</strong>
          <p>{retryPrinciple}</p>
        </section>
      ) : null}

      {result && !result.passed ? (
        <TrapDiscoveryPanel discoveries={trapDiscoveries} />
      ) : null}

      {result?.answerDetails ? (
        <AnswerDetailList details={result.answerDetails} label="Разбор ответа" />
      ) : null}

      {result?.roundResults && !isBossFight ? (
        <ul className="boss-result-list" aria-label="Итоги раундов">
          {result.roundResults.map((round) => (
            <li
              className={
                round.passed ? 'boss-result-cleared' : 'boss-result-retry'
              }
              key={round.roundId}
            >
              <span>{round.passed ? '✓' : '!'}</span>
              <div>
                <strong>{round.title}</strong>
                <p>{round.feedback}</p>
                {round.answerDetails ? (
                  <AnswerDetailList
                    details={round.answerDetails}
                    label="Разбор раунда"
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {result ? (
        <div className="feedback-actions">
          {result.passed && nextHref ? (
            <Link className="pixel-button" to={nextHref}>
              {nextLabel}
            </Link>
          ) : null}
          {!result.passed ? (
            <button className="pixel-button" onClick={onReset} type="button">
              Пересобрать ход
            </button>
          ) : null}
        </div>
      ) : null}

      <Link
        className="mission-back-link"
        to={`/chapters/${chapter.id}`}
      >
        {chapter.prep ? 'Вернуться к брифингу' : 'К списку сцен'}
      </Link>
    </aside>
  )
}
