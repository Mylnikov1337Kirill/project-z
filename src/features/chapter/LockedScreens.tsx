import { Link } from 'react-router-dom'
import type { Learner, PublicChapter } from '../../shared/types/domain'
import { GameHud } from '../../shared/ui/GameHud'
import { PixelPanel } from '../../shared/ui/PixelPanel'

export function MissionLocked({
  chapter,
  learner,
  rank,
}: {
  chapter: PublicChapter
  learner: Learner
  rank: string
}) {
  return (
    <>
      <GameHud
        eyebrow="Маршрут закрыт"
        learner={learner}
        rank={rank}
        title={chapter.title}
      />
      <section className="chapter-stage" aria-label="Закрытая сцена">
        <div className="screen-frame locked-screen">
          <PixelPanel className="system-panel system-panel-locked" title="Сначала предыдущая сцена">
            <p>
              Kilian держит маршрут по порядку: вернись к брифингу и продолжи с
              доступной практики.
            </p>
            <Link
              className="pixel-button pixel-button-secondary"
              to={`/chapters/${chapter.id}`}
            >
              К брифингу
            </Link>
          </PixelPanel>
        </div>
      </section>
    </>
  )
}

export function BadgeLocked({
  chapter,
  learner,
  rank,
}: {
  chapter: PublicChapter
  learner: Learner
  rank: string
}) {
  return (
    <>
      <GameHud
        eyebrow="Награда ждёт"
        learner={learner}
        rank={rank}
        title={chapter.title}
      />
      <section className="chapter-stage" aria-label="Награда закрыта">
        <div className="screen-frame locked-screen">
          <PixelPanel className="system-panel system-panel-locked" title="Сначала финальный вызов">
            <p>
              Пройди практику до конца: награда выдаётся после решения финальной
              сцены.
            </p>
            <Link
              className="pixel-button pixel-button-secondary"
              to={`/chapters/${chapter.id}`}
            >
              К брифингу
            </Link>
          </PixelPanel>
        </div>
      </section>
    </>
  )
}
