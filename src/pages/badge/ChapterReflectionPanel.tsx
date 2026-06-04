import { useMemo, useState } from 'react'
import type { ChapterReflection } from '../../shared/types/domain'

type ReflectionOption = {
  id: string
  label: string
}

type ReflectionDraft = {
  optionId: string | null
  optionLabel: string | null
  note: string
  skipped: boolean
}

type ChapterReflectionPanelProps = {
  chapterId: string
  isLoading: boolean
  onSave: (draft: ReflectionDraft) => Promise<void>
  onSkip: () => Promise<void>
  reflection: ChapterReflection | null
}

const maxReflectionNoteLength = 180

const reflectionOptionsByChapterId: Record<string, ReflectionOption[]> = {
  'chapter-1': [
    { id: 'review', label: 'В ближайшем ревью' },
    { id: 'pull-request', label: 'В описании пул-реквеста' },
    { id: 'handoff', label: 'Перед передачей изменений' },
  ],
  'chapter-2': [
    { id: 'task-brief', label: 'В следующем брифе' },
    { id: 'acceptance', label: 'В критериях приёмки' },
    { id: 'examples', label: 'В подборе примеров' },
  ],
  'chapter-3': [
    { id: 'plan', label: 'Перед первым изменением' },
    { id: 'review-scope', label: 'При сужении изменений' },
    { id: 'stop-condition', label: 'В условии остановки' },
  ],
  'chapter-4': [
    { id: 'repo-context', label: 'В контексте репозитория' },
    { id: 'source-map', label: 'В карте источников' },
    { id: 'agent-rules', label: 'В правилах агента' },
  ],
  'chapter-5': [
    { id: 'rules-inventory', label: 'В inventory правил' },
    { id: 'skill-draft', label: 'В черновике skill' },
    { id: 'instruction-cleanup', label: 'В чистке инструкций' },
  ],
  'chapter-6': [
    { id: 'context-budget', label: 'Перед загрузкой контекста' },
    { id: 'retry', label: 'Перед повторным запуском' },
    { id: 'summary', label: 'В коротком итоге' },
  ],
  'chapter-7': [
    { id: 'check-command', label: 'В команде проверки' },
    { id: 'manual-qa', label: 'В ручном сценарии' },
    { id: 'review-note', label: 'В заметке ревьюеру' },
  ],
  'chapter-8': [
    { id: 'playbook', label: 'В командном сценарии' },
    { id: 'clinic', label: 'После практического кейса' },
    { id: 'onboarding', label: 'В онбординге коллеги' },
  ],
}

const fallbackReflectionOptions: ReflectionOption[] = [
  { id: 'next-task', label: 'В ближайшей задаче' },
  { id: 'review', label: 'В следующем ревью' },
  { id: 'team-note', label: 'В заметке команде' },
]

function getReflectionOptions(chapterId: string) {
  return reflectionOptionsByChapterId[chapterId] ?? fallbackReflectionOptions
}

function getReflectionSummary(reflection: ChapterReflection) {
  if (reflection.skipped) {
    return 'Заметка пропущена. Можно добавить её позже с этого экрана.'
  }

  return [reflection.optionLabel, reflection.note].filter(Boolean).join(' · ')
}

export function ChapterReflectionPanel({
  chapterId,
  isLoading,
  onSave,
  onSkip,
  reflection,
}: ChapterReflectionPanelProps) {
  const options = useMemo(() => getReflectionOptions(chapterId), [chapterId])
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedOptionId, setSelectedOptionId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function startEditing() {
    const savedOptionId =
      reflection?.optionId &&
      options.some((option) => option.id === reflection.optionId)
        ? reflection.optionId
        : ''

    setSelectedOptionId(savedOptionId)
    setNote(reflection && !reflection.skipped ? reflection.note : '')
    setError(null)
    setIsEditing(true)
  }

  const selectedOption = options.find(
    (option) => option.id === selectedOptionId,
  )
  const trimmedNote = note.trim()
  const canSave = Boolean(selectedOption || trimmedNote) && !isSaving
  const shouldShowForm = !isLoading && (isEditing || !reflection)

  async function handleSave() {
    if (!canSave) {
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave({
        optionId: selectedOption?.id ?? null,
        optionLabel: selectedOption?.label ?? null,
        note: trimmedNote,
        skipped: false,
      })
      setIsEditing(false)
    } catch {
      setError('Не удалось сохранить заметку.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSkip() {
    setIsSaving(true)
    setError(null)

    try {
      await onSkip()
      setSelectedOptionId('')
      setNote('')
      setIsEditing(false)
    } catch {
      setError('Не удалось обновить заметку.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="reflection-card" aria-label="Локальная заметка к награде">
      <div className="reflection-card-topline">
        <span>Переход в работу</span>
        {reflection && !reflection.skipped ? (
          <strong>Заметка сохранена</strong>
        ) : null}
      </div>

      <h2>Где применишь это завтра?</h2>

      {isLoading ? (
        <p className="reflection-muted">Сверяем заметку на этом устройстве.</p>
      ) : null}

      {!isLoading && !isEditing && reflection ? (
        <div className="reflection-summary">
          <p>{getReflectionSummary(reflection)}</p>
          <button
            className="pixel-button pixel-button-secondary"
            onClick={startEditing}
            type="button"
          >
            Изменить
          </button>
        </div>
      ) : null}

      {shouldShowForm ? (
        <div className="reflection-form">
          <div className="reflection-options" aria-label="Варианты применения">
            {options.map((option) => (
              <button
                aria-pressed={selectedOptionId === option.id}
                className="reflection-option"
                key={option.id}
                onClick={() => setSelectedOptionId(option.id)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="reflection-note-field">
            <span>Короткая заметка</span>
            <textarea
              maxLength={maxReflectionNoteLength}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Один конкретный шаг"
              rows={2}
              value={note}
            />
          </label>

          <div className="reflection-form-footer">
            <span>{note.length} / {maxReflectionNoteLength}</span>
            {error ? <strong role="alert">{error}</strong> : null}
          </div>

          <div className="reflection-actions">
            <button
              className="pixel-button"
              disabled={!canSave}
              onClick={handleSave}
              type="button"
            >
              Сохранить заметку
            </button>
            <button
              className="pixel-button pixel-button-secondary"
              disabled={isSaving}
              onClick={handleSkip}
              type="button"
            >
              Пропустить
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
