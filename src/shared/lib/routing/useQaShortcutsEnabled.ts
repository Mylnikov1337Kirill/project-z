import { useSearchParams } from 'react-router-dom'

export function useQaPassEnabled() {
  return import.meta.env.VITE_PROJECT_Z_QA_PASS === '1'
}

export function useQaShortcutsEnabled() {
  const [searchParams] = useSearchParams()
  const qaPassEnabled = useQaPassEnabled()

  return qaPassEnabled || searchParams.get('qa') === '1'
}
