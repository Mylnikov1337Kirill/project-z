import { useState } from 'react'
import { useModalEscapeClose } from '../../../shared/lib/a11y/useModalEscapeClose'
import type { BossDossierItem } from '../lib/missionAnswerHelpers'
import { AnswerDetailList } from './AnswerDetailList'

type BossDossierPanelProps = {
  bossRoundCount: number
  isFinalReveal: boolean
  isOpen: boolean
  items: BossDossierItem[]
  onClose: () => void
}

function getPrimaryDossierDetails(item: BossDossierItem) {
  const details = item.result?.answerDetails ?? []
  const priorityDetail =
    details.find((detail) => detail.status === 'trap') ??
    details.find((detail) => detail.status === 'missed') ??
    details[0]

  return priorityDetail ? [priorityDetail] : []
}

function getInitialFocusedItem(items: BossDossierItem[]) {
  return (
    items.find((item) =>
      getPrimaryDossierDetails(item).some((detail) => detail.trapId),
    ) ??
    items.find((item) => item.result && !item.result.passed) ??
    items[0]
  )
}

export function BossDossierPanel({
  bossRoundCount,
  isFinalReveal,
  isOpen,
  items,
  onClose,
}: BossDossierPanelProps) {
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null)
  useModalEscapeClose(isOpen && items.length > 0, onClose)

  if (!isOpen || items.length === 0) {
    return null
  }

  const focusedItem =
    items.find((item) => item.id === focusedItemId) ?? getInitialFocusedItem(items)
  const focusedDetails = focusedItem ? getPrimaryDossierDetails(focusedItem) : []

  return (
    <div className="boss-dossier-overlay">
      <section
        className={`boss-dossier-panel ${
          isFinalReveal ? 'boss-dossier-panel-reveal' : ''
        }`}
        aria-label="Досье боя"
        aria-modal="true"
        role="dialog"
      >
        <div className="boss-dossier-panel-header">
          <div>
            <p className="eyebrow">Досье боя</p>
            <h3>
              {isFinalReveal ? 'Финальный разбор' : 'Зафиксированные раунды'}
            </h3>
          </div>
          <div className="boss-dossier-panel-actions">
            <span>
              {items.length}/{bossRoundCount}
            </span>
            <button
              className="boss-dossier-close"
              aria-label="Закрыть панель"
              onClick={onClose}
              type="button"
            >
              x
            </button>
          </div>
        </div>

        <div className="boss-dossier" aria-label="Карточки досье">
          {items.map((item, index) => {
            return (
              <button
                className={`boss-dossier-item ${
                  item.result
                    ? item.result.passed
                      ? 'boss-dossier-item-cleared'
                      : 'boss-dossier-item-retry'
                    : 'boss-dossier-item-locked'
                } ${focusedItem?.id === item.id ? 'boss-dossier-item-active' : ''}`}
                aria-pressed={focusedItem?.id === item.id}
                key={item.id}
                onClick={() => setFocusedItemId(item.id)}
                type="button"
              >
                <span className="boss-dossier-marker">
                  {item.result
                    ? item.result.passed
                      ? '✓'
                      : '!'
                    : index + 1}
                </span>
                <div className="boss-dossier-body">
                  <div className="boss-dossier-heading">
                    <strong>{item.title}</strong>
                    <small>
                      {item.result
                        ? item.result.passed
                          ? 'Очищено'
                          : 'Нужен разбор'
                        : 'Раунд зафиксирован'}
                    </small>
                  </div>
                  <p className="boss-dossier-answer">{item.answerSummary}</p>
                </div>
              </button>
            )
          })}
        </div>

        {focusedItem ? (
          <div className="boss-dossier-focus" aria-label="Разбор выбранного раунда">
            <p className="eyebrow">{focusedItem.title}</p>
            <p className="boss-dossier-focus-answer">
              {focusedItem.answerSummary}
            </p>
            {isFinalReveal && focusedItem.takeaway ? (
              <section
                className={`boss-dossier-takeaway ${
                  focusedItem.result?.passed
                    ? 'boss-dossier-takeaway-cleared'
                    : 'boss-dossier-takeaway-review'
                }`}
                aria-label="Итог раунда от Kilian"
              >
                <span className="boss-dossier-takeaway-signal" aria-hidden="true" />
                <div>
                  <strong>
                    {focusedItem.result?.passed
                      ? 'Сильный ход'
                      : 'Следующий ход'}
                  </strong>
                  <p>{focusedItem.takeaway}</p>
                </div>
              </section>
            ) : null}
            {isFinalReveal &&
            focusedItem.result &&
            !focusedItem.result.passed &&
            focusedItem.retryPrinciple ? (
              <section
                className="boss-dossier-retry-principle"
                aria-label="Подсказка для повторной попытки раунда"
              >
                <strong>Вспомнить правило</strong>
                <p>{focusedItem.retryPrinciple}</p>
              </section>
            ) : null}
            {focusedItem.result ? (
              <p className="boss-dossier-focus-feedback">
                {focusedItem.result.feedback}
              </p>
            ) : (
              <p className="boss-dossier-focus-note">
                Запись сохранена. Разбор откроется после последнего раунда.
              </p>
            )}
            {!focusedItem.result?.passed && focusedDetails.length > 0 ? (
              <AnswerDetailList
                details={focusedDetails}
                label={`Разбор: ${focusedItem.title}`}
                variant="compact"
              />
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}
