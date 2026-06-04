export type BackendApi = {
  get<TResponse>(path: string): Promise<TResponse>
  post<TResponse>(path: string, body?: unknown): Promise<TResponse>
}

export class BackendApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'BackendApiError'
    this.status = status
  }
}

type Fetcher = typeof fetch

const defaultFetcher: Fetcher = (input, init) => fetch(input, init)

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: unknown }

    return typeof body.error === 'string'
      ? body.error
      : 'Не удалось выполнить запрос.'
  } catch {
    return 'Не удалось выполнить запрос.'
  }
}

export class BackendApiClient implements BackendApi {
  private readonly fetcher: Fetcher

  constructor(fetcher: Fetcher = defaultFetcher) {
    this.fetcher = fetcher
  }

  async get<TResponse>(path: string) {
    return this.request<TResponse>(path, { method: 'GET' })
  }

  async post<TResponse>(path: string, body?: unknown) {
    return this.request<TResponse>(path, {
      body: JSON.stringify(body ?? {}),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    })
  }

  private async request<TResponse>(path: string, init: RequestInit) {
    const response = await this.fetcher(path, {
      ...init,
      credentials: 'include',
    })

    if (!response.ok) {
      throw new BackendApiError(response.status, await readErrorMessage(response))
    }

    return (await response.json()) as TResponse
  }
}

export const backendApiClient = new BackendApiClient()
