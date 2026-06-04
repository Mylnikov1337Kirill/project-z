import { Link } from 'react-router-dom'
import { getTrapConcept } from '../../../entities/trap/model/trapConcepts'
import type { TrapConceptId } from '../../../shared/types/domain'

export type TrapDiscovery = {
  id: TrapConceptId
  isNew: boolean
}

type TrapDiscoveryPanelProps = {
  discoveries: TrapDiscovery[]
}

export function TrapDiscoveryPanel({
  discoveries,
}: TrapDiscoveryPanelProps) {
  const discoveredConcepts = discoveries.flatMap((discovery) => {
    const concept = getTrapConcept(discovery.id)

    return concept ? [{ concept, discovery }] : []
  })

  if (discoveredConcepts.length === 0) {
    return null
  }

  return (
    <section className="trap-discovery-panel" aria-label="Обнаруженные ловушки">
      <div className="trap-discovery-header">
        <p className="eyebrow">Справочник ловушек</p>
        <h3>
          {discoveredConcepts.length === 1
            ? 'Ловушка обнаружена'
            : 'Ловушки обнаружены'}
        </h3>
      </div>

      <ul className="trap-discovery-list">
        {discoveredConcepts.map(({ concept, discovery }) => (
          <li className="trap-discovery-item" key={concept.id}>
            <div>
              <strong>{concept.label}</strong>
              <p>{concept.description}</p>
            </div>
            <span>{discovery.isNew ? 'Новая запись' : 'Уже встречалась'}</span>
          </li>
        ))}
      </ul>

      <Link className="trap-discovery-link" to="/field-guide">
        Открыть справочник
      </Link>
    </section>
  )
}
