import type { LeaderboardEntry } from '../../../shared/types/domain'
import { formatBadgeReward } from '../lib/leaderboardModel'

type LeaderboardTableProps = {
  chaptersCount: number
  currentLearnerId: string
  entries: LeaderboardEntry[]
}

export function LeaderboardTable({
  chaptersCount,
  currentLearnerId,
  entries,
}: LeaderboardTableProps) {
  return (
    <div className="leaderboard-table" role="table" aria-label="Рейтинг игроков">
      <div className="leaderboard-table-head" role="rowgroup">
        <div className="leaderboard-row leaderboard-row-head" role="row">
          <span role="columnheader">место</span>
          <span role="columnheader">оператор</span>
          <span role="columnheader">главы</span>
          <span role="columnheader">ранг</span>
          <span role="columnheader">награда</span>
        </div>
      </div>
      <div className="leaderboard-table-body" role="rowgroup">
        {entries.map((entry, index) => (
          <div
            className={`leaderboard-row ${
              entry.learnerId === currentLearnerId
                ? 'leaderboard-row-current'
                : ''
            }`}
            key={entry.learnerId}
            role="row"
          >
            <span className="leaderboard-place" role="cell">
              #{index + 1}
            </span>
            <span className="leaderboard-operator" role="cell">
              <strong>@{entry.nickname}</strong>
              <small>{entry.fullName}</small>
            </span>
            <span role="cell">
              {entry.closedChaptersCount}/{chaptersCount}
            </span>
            <span role="cell">{entry.currentRank}</span>
            <span role="cell">{formatBadgeReward(entry)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
