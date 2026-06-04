import { useEffect, useRef, useState, type ReactNode } from 'react'

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void
  webkitFullscreenElement?: Element | null
  webkitFullscreenEnabled?: boolean
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

type GameShellProps = {
  children: ReactNode
  className?: string
}

function getFullscreenElement() {
  const fullscreenDocument = document as FullscreenDocument

  return (
    document.fullscreenElement ??
    fullscreenDocument.webkitFullscreenElement ??
    null
  )
}

function isFullscreenApiSupported() {
  const fullscreenDocument = document as FullscreenDocument

  return Boolean(
    document.fullscreenEnabled || fullscreenDocument.webkitFullscreenEnabled,
  )
}

export function GameShell({ children, className = '' }: GameShellProps) {
  const shellRef = useRef<HTMLElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isFullscreenSupported, setIsFullscreenSupported] = useState(
    isFullscreenApiSupported,
  )

  useEffect(() => {
    function syncFullscreenState() {
      setIsFullscreen(getFullscreenElement() === shellRef.current)
    }

    document.addEventListener('fullscreenchange', syncFullscreenState)
    document.addEventListener('webkitfullscreenchange', syncFullscreenState)

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState)
    }
  }, [])

  async function handleFullscreenToggle() {
    const fullscreenDocument = document as FullscreenDocument
    const fullscreenElement = getFullscreenElement()

    try {
      if (fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
          return
        }

        await fullscreenDocument.webkitExitFullscreen?.()
        return
      }

      const shell = shellRef.current as FullscreenElement | null

      if (!shell) {
        return
      }

      if (shell.requestFullscreen) {
        await shell.requestFullscreen()
        return
      }

      await shell.webkitRequestFullscreen?.()
    } catch {
      setIsFullscreenSupported(false)
    }
  }

  const fullscreenLabel = isFullscreen
    ? 'Выйти из полного экрана'
    : 'На полный экран'

  return (
    <main
      className={`game-shell ${
        isFullscreen ? 'game-shell-fullscreen' : ''
      } ${className}`.trim()}
      ref={shellRef}
    >
      {isFullscreenSupported ? (
        <button
          aria-label={fullscreenLabel}
          aria-pressed={isFullscreen}
          className={`fullscreen-toggle ${
            isFullscreen ? 'fullscreen-toggle-active' : ''
          }`}
          onClick={handleFullscreenToggle}
          title={fullscreenLabel}
          type="button"
        >
          <span className="fullscreen-icon" aria-hidden="true">
            <span className="fullscreen-corner fullscreen-corner-top-left" />
            <span className="fullscreen-corner fullscreen-corner-top-right" />
            <span className="fullscreen-corner fullscreen-corner-bottom-left" />
            <span className="fullscreen-corner fullscreen-corner-bottom-right" />
          </span>
        </button>
      ) : null}
      {children}
    </main>
  )
}
