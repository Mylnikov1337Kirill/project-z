export class BackendConfigurationError extends Error {
  constructor(message = 'Серверный режим не настроен.') {
    super(message)
    this.name = 'BackendConfigurationError'
  }
}

export function getRequiredEnvironmentVariable(
  name: string,
  message?: string,
) {
  const value = process.env[name]

  if (!value) {
    throw new BackendConfigurationError(message)
  }

  return value
}
