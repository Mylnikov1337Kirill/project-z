import { Navigate, Route, Routes } from 'react-router-dom'
import { BadgePage } from '../../pages/badge/BadgePage'
import { ChapterPage } from '../../pages/chapter/ChapterPage'
import { ChapterPrepPage } from '../../pages/chapter/ChapterPrepPage'
import { CourseCloseoutPage } from '../../pages/closeout/CourseCloseoutPage'
import { TrapFieldGuidePage } from '../../pages/field-guide/TrapFieldGuidePage'
import { IdentityPage } from '../../pages/identity/IdentityPage'
import { LeaderboardPage } from '../../pages/leaderboard/LeaderboardPage'
import { MapPage } from '../../pages/map/MapPage'
import { MissionPage } from '../../pages/mission/MissionPage'
import { ErrorScreen, LoadingScreen } from '../../pages/system/SystemScreens'
import { GameShell } from '../layout/GameShell'
import { useGameState } from '../providers/gameStateContext'

export function AppRouter() {
  const {
    chapters,
    contentVersion,
    encounteredTrapIds,
    learner,
    progress,
    isLoading,
    loadError,
    identify,
    recordTrapDiscoveries,
    replaceEncounteredTrapIds,
    replaceProgress,
  } = useGameState()

  if (isLoading) {
    return (
      <GameShell>
        <LoadingScreen />
      </GameShell>
    )
  }

  if (loadError) {
    return (
      <GameShell>
        <ErrorScreen message={loadError} />
      </GameShell>
    )
  }

  return (
    <GameShell className={learner ? '' : 'identity-shell'}>
      <Routes>
        <Route
          path="/"
          element={
            learner ? (
              <Navigate replace to="/map" />
            ) : (
              <IdentityPage onIdentify={identify} />
            )
          }
        />
        <Route
          path="/map"
          element={
            learner ? (
              <MapPage
                chapters={chapters}
                encounteredTrapIds={encounteredTrapIds}
                learner={learner}
                onEncounteredTrapIdsChange={replaceEncounteredTrapIds}
                progress={progress}
              />
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/leaderboard"
          element={
            learner ? (
              <LeaderboardPage
                chapters={chapters}
                learner={learner}
                progress={progress}
              />
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/field-guide"
          element={
            learner ? (
              <TrapFieldGuidePage
                chapters={chapters}
                encounteredTrapIds={encounteredTrapIds}
                learner={learner}
                onEncounteredTrapIdsChange={replaceEncounteredTrapIds}
                progress={progress}
              />
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/chapters/:chapterId"
          element={
            learner ? (
              <ChapterPage
                chapters={chapters}
                learner={learner}
                progress={progress}
              />
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/chapters/:chapterId/prep"
          element={
            learner ? (
              <ChapterPrepPage
                chapters={chapters}
                learner={learner}
                progress={progress}
              />
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/chapters/:chapterId/missions/:missionId"
          element={
            learner ? (
              <MissionPage
                chapters={chapters}
                contentVersion={contentVersion}
                learner={learner}
                onProgressChange={replaceProgress}
                onTrapDiscoveriesChange={recordTrapDiscoveries}
                progress={progress}
              />
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/chapters/:chapterId/badge"
          element={
            learner ? (
              <BadgePage
                chapters={chapters}
                learner={learner}
                progress={progress}
              />
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="/course/complete"
          element={
            learner ? (
              <CourseCloseoutPage
                chapters={chapters}
                learner={learner}
                progress={progress}
              />
            ) : (
              <Navigate replace to="/" />
            )
          }
        />
        <Route
          path="*"
          element={<Navigate replace to={learner ? '/map' : '/'} />}
        />
      </Routes>
    </GameShell>
  )
}
