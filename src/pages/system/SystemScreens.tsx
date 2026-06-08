import { Link } from 'react-router-dom'
import { PixelPanel } from '../../shared/ui/PixelPanel'

export function LoadingScreen() {
  return (
    <section className="system-stage" aria-label="Загрузка карты">
      <div className="screen-frame system-screen">
        <PixelPanel className="system-panel system-panel-loading" title="Agent Trail">
          <span className="system-loader" aria-hidden="true" />
          <p>Собираю маршрут и проверяю открытые главы...</p>
        </PixelPanel>
      </div>
    </section>
  )
}

export function ErrorScreen({ message }: { message: string }) {
  const hasErrorSignal = Boolean(message)

  return (
    <section className="system-stage" aria-label="Карта не загрузилась">
      <div className="screen-frame system-screen system-screen-error">
        <PixelPanel className="system-panel system-panel-error" title="Сигнал карты сбился">
          <p>
            Kilian не смог собрать маршрут. Обнови страницу, чтобы попробовать
            заново.
          </p>
          <p className="system-hint">
            {hasErrorSignal
              ? 'Внутренний сигнал сохранён для проверки.'
              : 'Маршрут оборвался до старта.'}
          </p>
          <button
            className="pixel-button pixel-button-secondary"
            onClick={() => window.location.reload()}
            type="button"
          >
            Собрать карту заново
          </button>
        </PixelPanel>
      </div>
    </section>
  )
}

export function ChapterNotFound() {
  return (
    <section className="system-stage" aria-label="Глава не найдена">
      <div className="screen-frame system-screen">
        <PixelPanel className="system-panel" title="Глава не найдена">
          <p>На этой клетке карты ничего нет.</p>
          <Link className="pixel-button pixel-button-secondary" to="/map">
            Назад на карту
          </Link>
        </PixelPanel>
      </div>
    </section>
  )
}

export function MissionNotFound({ chapterId }: { chapterId: string }) {
  return (
    <section className="system-stage" aria-label="Сцена не найдена">
      <div className="screen-frame system-screen">
        <PixelPanel className="system-panel" title="Сцена не найдена">
          <p>На этой ветке маршрута нет практики.</p>
          <Link
            className="pixel-button pixel-button-secondary"
            to={`/chapters/${chapterId}`}
          >
            К брифингу
          </Link>
        </PixelPanel>
      </div>
    </section>
  )
}
