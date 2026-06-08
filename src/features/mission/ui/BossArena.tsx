import type { BossDossierItem } from '../lib/missionAnswerHelpers'
import type { PublicBossFightRoundMission } from '../../../shared/types/domain'

type BossArenaProps = {
  activeMission: PublicBossFightRoundMission
  activeRoundNumber: number
  bossDossierItems: BossDossierItem[]
  bossRoundCount: number
  bossStageProgress: number
  isDossierOpen: boolean
  onOpenDossier: () => void
  rounds: PublicBossFightRoundMission[]
  showDossierCue: boolean
}

function getBossRoundAriaLabel(roundTitle: string, index: number) {
  const normalizedTitle = roundTitle.replace(/^Раунд\s+\d+:\s*/u, '')

  return `Раунд ${index + 1}: ${normalizedTitle}`
}

export function BossArena({
  activeMission,
  activeRoundNumber,
  bossDossierItems,
  bossRoundCount,
  bossStageProgress,
  isDossierOpen,
  onOpenDossier,
  rounds,
  showDossierCue,
}: BossArenaProps) {
  const hasFinalReveal = bossDossierItems.some((item) => item.result)
  const lockedRoundCount = bossDossierItems.length
  const dossierCueId = 'boss-dossier-cue'
  const dossierCueText =
    lockedRoundCount === 1
      ? `Kilian: первый ход сохранён в досье. Открой «Досье ${lockedRoundCount}/${bossRoundCount}», чтобы держать память боя под рукой.`
      : `Kilian: зафиксированные ходы лежат в досье. Открой «Досье ${lockedRoundCount}/${bossRoundCount}», чтобы сверить память боя.`

  return (
    <div className="boss-arena" aria-label="Стадии финального боя">
      <div className="boss-meter">
        <span>Стадии боя</span>
        <strong>
          {activeRoundNumber}/{bossRoundCount}
        </strong>
        <div className="boss-meter-track" aria-hidden="true">
          <span style={{ width: `${bossStageProgress}%` }} />
        </div>
        {lockedRoundCount > 0 ? (
          <button
            className={`boss-dossier-toggle ${
              isDossierOpen ? 'boss-dossier-toggle-active' : ''
            } ${showDossierCue ? 'boss-dossier-toggle-cued' : ''}`}
            aria-expanded={isDossierOpen}
            aria-label={`Открыть журнал раундов, ${lockedRoundCount} из ${bossRoundCount}`}
            aria-describedby={showDossierCue ? dossierCueId : undefined}
            onClick={onOpenDossier}
            type="button"
          >
            <span className="boss-dossier-toggle-icon" aria-hidden="true" />
            <span>
              Досье {lockedRoundCount}/{bossRoundCount}
            </span>
          </button>
        ) : null}
      </div>

      {showDossierCue ? (
        <p className="boss-dossier-cue" id={dossierCueId} role="status">
          {dossierCueText}
        </p>
      ) : null}

      <div className="boss-round-track">
        {rounds.map((round, index) => (
          <span
            className={
              hasFinalReveal
                ? `boss-round-dot ${
                    bossDossierItems[index]?.result?.passed
                      ? 'boss-round-dot-cleared'
                      : 'boss-round-dot-retry'
                  }`
                : index < activeRoundNumber - 1
                  ? 'boss-round-dot boss-round-dot-locked'
                  : index === activeRoundNumber - 1
                    ? 'boss-round-dot boss-round-dot-current'
                    : 'boss-round-dot'
            }
            key={round.id}
            aria-label={getBossRoundAriaLabel(round.title, index)}
          />
        ))}
      </div>

      <div className="boss-round-brief">
        <p className="eyebrow">
          Раунд {activeRoundNumber} из {bossRoundCount}
        </p>
        <h3>{activeMission.title}</h3>
        <p>{activeMission.prompt}</p>
      </div>
    </div>
  )
}
