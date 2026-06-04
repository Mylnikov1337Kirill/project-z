import type { ReactNode } from 'react'
import type { Learner } from '../types/domain'

type PlayerRankCardProps = {
  learner: Learner
  rank: string
}

type GameHudProps = {
  actions?: ReactNode
  eyebrow: string
  learner: Learner
  rank: string
  title: string
}

export function PlayerRankCard({ learner, rank }: PlayerRankCardProps) {
  return (
    <div className="player-rank" aria-label="Профиль игрока">
      <span>Оператор @{learner.nickname}</span>
      <small>{learner.fullName}</small>
      <strong>{rank}</strong>
    </div>
  )
}

export function GameHud({
  actions,
  eyebrow,
  learner,
  rank,
  title,
}: GameHudProps) {
  return (
    <header className="game-hud">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      {actions ? (
        <div className="hud-actions">
          {actions}
          <PlayerRankCard learner={learner} rank={rank} />
        </div>
      ) : (
        <PlayerRankCard learner={learner} rank={rank} />
      )}
    </header>
  )
}
