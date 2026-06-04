import {
  IdentityScreen,
  type IdentityInput,
} from '../../features/identity/IdentityScreen'

type IdentityPageProps = {
  onIdentify: (input: IdentityInput) => Promise<void>
}

export function IdentityPage({ onIdentify }: IdentityPageProps) {
  return <IdentityScreen onIdentify={onIdentify} />
}
