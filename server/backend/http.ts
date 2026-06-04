export type BackendHeaders = Record<string, string | string[] | undefined>

export type BackendRequest = {
  body: string | null
  headers: BackendHeaders
  httpMethod: string
  isBase64Encoded?: boolean
  path: string
  rawUrl?: string
}

export type BackendResponse = {
  body: string
  bodyEncoding?: BufferEncoding
  headers?: Record<string, string>
  multiValueHeaders?: Record<string, string[]>
  statusCode: number
}

export type RequestPathOptions = {
  pathPrefix?: string
  pathReplacement?: string
}

export class RequestError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'RequestError'
    this.statusCode = statusCode
  }
}

export const requestBodyLimitBytes = 64 * 1024

export function jsonResponse(
  statusCode: number,
  body: unknown,
  options: { cookies?: string[] } = {},
): BackendResponse {
  return {
    body: JSON.stringify(body),
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    },
    multiValueHeaders:
      options.cookies && options.cookies.length > 0
        ? {
            'Set-Cookie': options.cookies,
          }
        : undefined,
    statusCode,
  }
}

export function getHeader(headers: BackendHeaders, headerName: string) {
  const normalizedHeaderName = headerName.toLowerCase()
  const foundHeader = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === normalizedHeaderName,
  )?.[1]

  return Array.isArray(foundHeader) ? foundHeader[0] : foundHeader
}

export function getRequestPath(
  request: BackendRequest,
  options: RequestPathOptions = {},
) {
  const rawUrl = request.rawUrl ?? `http://localhost${request.path}`
  const url = new URL(rawUrl, 'http://localhost')
  let pathname = url.pathname

  if (options.pathPrefix && pathname.startsWith(options.pathPrefix)) {
    pathname = `${options.pathReplacement ?? ''}${pathname.slice(
      options.pathPrefix.length,
    )}`
  }

  return pathname || '/'
}

export function getRouteSegments(
  request: BackendRequest,
  options: RequestPathOptions = {},
) {
  const pathname = getRequestPath(request, options)

  if (!pathname.startsWith('/api')) {
    return []
  }

  return pathname
    .replace(/^\/api\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

export function readJsonBody(request: BackendRequest) {
  if (!request.body) {
    return {}
  }

  const body = request.isBase64Encoded
    ? Buffer.from(request.body, 'base64').toString('utf8')
    : request.body

  if (Buffer.byteLength(body, 'utf8') > requestBodyLimitBytes) {
    throw new RequestError(413, 'Запрос слишком большой.')
  }

  try {
    return asRecord(JSON.parse(body))
  } catch {
    throw new RequestError(400, 'Нужен корректный JSON.')
  }
}

export function requiredString(
  body: Record<string, unknown>,
  key: string,
  message = `Поле ${key} обязательно.`,
) {
  const value = body[key]

  if (typeof value !== 'string' || value.trim() === '') {
    throw new RequestError(400, message)
  }

  return value
}

export function optionalString(body: Record<string, unknown>, key: string) {
  const value = body[key]

  return typeof value === 'string' && value.trim() !== '' ? value : null
}
