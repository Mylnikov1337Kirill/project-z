import { useLocation } from 'react-router-dom'
import { WorldMap } from '../../features/map/WorldMap'
import { useAppServices } from '../../shared/api/appServices/appServices'
import type { GamePageProps } from '../types'

type MapLocationState = {
  focusChapterId?: unknown
}

function getFocusChapterId(locationState: unknown) {
  if (typeof locationState !== 'object' || locationState === null) {
    return undefined
  }

  const { focusChapterId } = locationState as MapLocationState

  return typeof focusChapterId === 'string' ? focusChapterId : undefined
}

export function MapPage({
  encounteredTrapIds = [],
  onEncounteredTrapIdsChange,
  ...props
}: GamePageProps) {
  const location = useLocation()
  const { progressRepository } = useAppServices()

  return (
    <WorldMap
      {...props}
      encounteredTrapIds={encounteredTrapIds}
      initialChapterId={getFocusChapterId(location.state)}
      onEncounteredTrapIdsChange={onEncounteredTrapIdsChange}
      progressRepository={progressRepository}
    />
  )
}
