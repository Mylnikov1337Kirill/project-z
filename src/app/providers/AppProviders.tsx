import { StrictMode, type ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AppServicesProvider } from './AppServicesProvider'
import { GameStateProvider } from './GameStateProvider'

type AppProvidersProps = {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <StrictMode>
      <AppServicesProvider>
        <BrowserRouter>
          <GameStateProvider>{children}</GameStateProvider>
        </BrowserRouter>
      </AppServicesProvider>
    </StrictMode>
  )
}
