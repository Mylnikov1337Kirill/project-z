import { getTrapConcept } from '../../../entities/trap/model/trapConcepts'
import type { MissionAnswerDetail } from '../../../entities/mission/lib/missionEngine'

type AnswerDetailListProps = {
  details: MissionAnswerDetail[]
  label: string
  variant?: 'compact' | 'panel'
}

function getAnswerDetailTitle(detail: MissionAnswerDetail) {
  const trapConcept = getTrapConcept(detail.trapId)

  if (trapConcept) {
    return `Ловушка: ${trapConcept.label}`
  }

  if (detail.trapLabel) {
    return detail.status === 'trap'
      ? `Ловушка: ${detail.trapLabel}`
      : detail.trapLabel
  }

  return detail.title
}

function AnswerDetailItem({ detail }: { detail: MissionAnswerDetail }) {
  const trapConcept = getTrapConcept(detail.trapId)

  return (
    <li className={`answer-detail-item answer-detail-${detail.status}`}>
      <span>{getAnswerDetailTitle(detail)}</span>
      {trapConcept ? <small>{trapConcept.description}</small> : null}
      <p>{detail.description}</p>
    </li>
  )
}

export function AnswerDetailList({
  details,
  label,
  variant = 'panel',
}: AnswerDetailListProps) {
  return (
    <ul
      className={`answer-detail-list answer-detail-list-${variant}`}
      aria-label={label}
    >
      {details.map((detail) => (
        <AnswerDetailItem detail={detail} key={detail.id} />
      ))}
    </ul>
  )
}
