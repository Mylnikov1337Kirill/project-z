import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PixelPanel } from '../../shared/ui/PixelPanel'

export type IdentityInput = {
  nickname: string
  fullName: string
}

type IdentityScreenProps = {
  onIdentify: (input: IdentityInput) => Promise<void>
}

export function IdentityScreen({ onIdentify }: IdentityScreenProps) {
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [fullName, setFullName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedNickname = nickname.trim().replace(/^@+/, '')
    const trimmedFullName = fullName.trim()

    if (!trimmedNickname || !trimmedFullName) {
      setError('Z-боту нужны позывной и имя для маршрута.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onIdentify({
        nickname: trimmedNickname,
        fullName: trimmedFullName,
      })
      navigate('/map')
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Не удалось сохранить профиль',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <section className="identity-stage" aria-label="Вход в Project Z">
        <div className="identity-hero" aria-label="Интро Project Z">
          <div className="intro-copy">
            <p className="eyebrow intro-kicker">Вход на карту</p>
            <h1>Project Z</h1>
            <p className="identity-tagline">
              Игра про работу с ИИ-агентами: ставь задачи, принимай изменения,
              находи риски, проверяй результат.
            </p>
          </div>

          <div className="intro-mentor">
            <div className="identity-bot" aria-hidden="true">
              <span className="avatar-eye avatar-eye-left" />
              <span className="avatar-eye avatar-eye-right" />
            </div>

            <div className="intro-bubble">
              <p className="eyebrow">Z-бот</p>
              <h2>
                Привет, я Z-бот. Пойдём разбирать задачи для ИИ-агентов,
                мутные изменения и риски перед ревью.
              </h2>
              <div className="intro-script">
                <p>
                  <span>01</span> На карте 8 глав: ответственность за изменения,
                  постановка задач, контекст, управление агентом, проверки и
                  командные сценарии.
                </p>
                <p>
                  <span>02</span> Внутри короткие сцены: выбрать ход, найти
                  риск, собрать чек-лист, пройти финальное испытание.
                </p>
                <p>
                  <span>03</span> За закрытую главу получаешь награду. Первая:
                  Ответственный автор.
                </p>
              </div>
            </div>
          </div>
        </div>

        <PixelPanel className="identity-card" title="Назови оператора">
          <p className="identity-card-copy">
            Выбери позывной для карты. Z-бот будет обращаться к тебе так в
            брифингах и наградах.
          </p>

          <form className="identity-form" onSubmit={handleSubmit}>
            <label>
              <span>Позывной</span>
              <input
                autoComplete="nickname"
                autoFocus
                maxLength={24}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="agent-k"
                type="text"
                value={nickname}
              />
            </label>

            <label>
              <span>Имя и фамилия</span>
              <input
                autoComplete="name"
                maxLength={60}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Кирилл Мыльников"
                type="text"
                value={fullName}
              />
            </label>

            {error ? <p className="form-error">{error}</p> : null}

            <button
              className="pixel-button"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'Запускаю...' : 'Войти на карту'}
            </button>
          </form>
        </PixelPanel>
      </section>
    </>
  )
}
