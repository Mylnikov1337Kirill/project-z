import { Link } from 'react-router-dom'
import {
  getCurrentRank,
  withQaMode,
} from '../../entities/chapter/lib/chapterProgress'
import { useLeaderboardEntries } from '../../features/leaderboard/lib/useLeaderboardEntries'
import { LeaderboardTable } from '../../features/leaderboard/ui/LeaderboardTable'
import { formatBadgeReward } from '../../features/leaderboard/lib/leaderboardModel'
import { useAppServices } from '../../shared/api/appServices/appServices'
import { useQaShortcutsEnabled } from '../../shared/lib/routing/useQaShortcutsEnabled'
import { GameHud } from '../../shared/ui/GameHud'
import { PixelPanel } from '../../shared/ui/PixelPanel'
import type { GamePageProps } from '../types'

export function LeaderboardPage({
  chapters,
  learner,
  progress,
}: GamePageProps) {
  const qaShortcutsEnabled = useQaShortcutsEnabled()
  const { progressRepository } = useAppServices()
  const currentRank = getCurrentRank(chapters, progress)
  const completedChaptersCount = progress.filter(
    (item) => item.status === 'completed',
  ).length
  const isCourseComplete =
    chapters.length > 0 && completedChaptersCount === chapters.length
  const { error, isLoading, sortedEntries } = useLeaderboardEntries({
    chapters,
    learner,
    progress,
    progressRepository,
  })
  const currentEntry =
    sortedEntries.find((entry) => entry.learnerId === learner.id) ?? null
  const bestClosedChaptersCount = sortedEntries[0]?.closedChaptersCount ?? 0

  return (
    <>
      <GameHud
        eyebrow="Доска лидеров"
        learner={learner}
        rank={currentRank}
        title="Закрытые главы"
      />

      <section className="chapter-stage" aria-label="Доска лидеров Agent Trail">
        <div className="screen-frame leaderboard-screen">
          <div className="leaderboard-layout">
            <PixelPanel className="leaderboard-summary">
              <p className="status-pill status-pill-open">маршрут</p>
              <h2>Твой зачёт на карте</h2>
              <p>
                Доска считает закрытые главы. Чем дальше оператор прошёл по
                маршруту, тем выше строка.
              </p>

              <div
                className="leaderboard-metrics"
                aria-label="Текущий прогресс игрока"
              >
                <span>
                  <strong>
                    {currentEntry?.closedChaptersCount ??
                      completedChaptersCount}
                    /{chapters.length}
                  </strong>
                  закрыто глав
                </span>
                <span>
                  <strong>{currentEntry?.currentRank ?? currentRank}</strong>
                  текущий ранг
                </span>
                <span>
                  <strong>
                    {formatBadgeReward({
                      lastBadgeDate: currentEntry?.lastBadgeDate ?? null,
                      lastBadgeName: currentEntry?.lastBadgeName ?? null,
                    })}
                  </strong>
                  последняя награда
                </span>
              </div>

              <div className="badge-actions">
                {isCourseComplete ? (
                  <Link
                    className="pixel-button"
                    to={withQaMode('/course/complete', qaShortcutsEnabled)}
                  >
                    Архив глав
                  </Link>
                ) : null}
                <Link
                  className={
                    isCourseComplete
                      ? 'pixel-button pixel-button-secondary'
                      : 'pixel-button'
                  }
                  to="/map"
                >
                  На карту
                </Link>
              </div>
            </PixelPanel>

            <PixelPanel className="leaderboard-table-card" title="Рейтинг глав">
              <div className="leaderboard-topline">
                <span>Лучший результат: {bestClosedChaptersCount}</span>
                <span>Всего глав: {chapters.length}</span>
              </div>

              {isLoading ? (
                <p className="leaderboard-message leaderboard-message-loading">
                  Kilian сверяет маршрут...
                </p>
              ) : error ? (
                <p className="leaderboard-message leaderboard-message-error">
                  {error}
                </p>
              ) : sortedEntries.length === 0 ? (
                <p className="leaderboard-message leaderboard-message-empty">
                  Закрой первую главу, чтобы появиться на доске.
                </p>
              ) : (
                <LeaderboardTable
                  chaptersCount={chapters.length}
                  currentLearnerId={learner.id}
                  entries={sortedEntries}
                />
              )}
            </PixelPanel>
          </div>
        </div>
      </section>
    </>
  )
}
