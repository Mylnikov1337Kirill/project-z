import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { handleAnnouncementWorkerRequest } from './backend/announcementWorker'
import { handleProjectZApiRequest } from './backend/api'
import {
  type BackendHeaders,
  type BackendRequest,
  type BackendResponse,
  RequestError,
  getHeader,
  getRequestPath,
  jsonResponse,
  requestBodyLimitBytes,
} from './backend/http'
import type { ProjectZDatabase } from './db/projectZDatabase'

export type ProjectZNodeRuntimeOptions = {
  db?: ProjectZDatabase
  distDirectory?: string
  logger?: Pick<Console, 'error' | 'info'>
}

type NodeServerOptions = ProjectZNodeRuntimeOptions

const fallbackHost = 'localhost'
const fallbackProtocol = 'http'
const indexCacheControl = 'no-store'
const immutableAssetCacheControl = 'public, max-age=31536000, immutable'

function getFirstForwardedValue(value: string | undefined) {
  return value?.split(',')[0]?.trim() || undefined
}

function getRequestTarget(request: IncomingMessage) {
  const target = request.url ?? '/'

  if (target.startsWith('http://') || target.startsWith('https://')) {
    return target
  }

  return target.startsWith('/') ? target : `/${target}`
}

function getAbsoluteRequestUrl(
  target: string,
  headers: BackendHeaders,
) {
  if (target.startsWith('http://') || target.startsWith('https://')) {
    return target
  }

  const forwardedProtocol = getFirstForwardedValue(
    getHeader(headers, 'x-forwarded-proto'),
  )
  const forwardedHost = getFirstForwardedValue(
    getHeader(headers, 'x-forwarded-host'),
  )
  const protocol = forwardedProtocol ?? fallbackProtocol
  const host = forwardedHost ?? getHeader(headers, 'host') ?? fallbackHost

  return `${protocol}://${host}${target}`
}

function getPathFromRequestTarget(target: string) {
  try {
    return new URL(target, `${fallbackProtocol}://${fallbackHost}`).pathname
  } catch {
    return '/'
  }
}

function stripSearchAndHash(target: string) {
  const searchIndex = target.search(/[?#]/u)

  return searchIndex >= 0 ? target.slice(0, searchIndex) : target
}

function getRawRequestPathname(request: BackendRequest) {
  const rawTarget = request.rawUrl ?? request.path
  const absoluteUrlSchemeIndex = rawTarget.indexOf('://')

  if (absoluteUrlSchemeIndex >= 0) {
    const authorityStart = absoluteUrlSchemeIndex + '://'.length
    const pathnameStart = rawTarget.indexOf('/', authorityStart)

    return pathnameStart >= 0
      ? stripSearchAndHash(rawTarget.slice(pathnameStart))
      : '/'
  }

  const pathname = stripSearchAndHash(rawTarget)

  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

function hasUnsafeRawPathSegment(rawPathname: string) {
  return rawPathname.split('/').some((rawSegment) => {
    if (!rawSegment) {
      return false
    }

    try {
      const segment = decodeURIComponent(rawSegment)

      return (
        segment === '.' ||
        segment === '..' ||
        segment.includes('/') ||
        segment.includes('\\') ||
        segment.includes('\0')
      )
    } catch {
      return true
    }
  })
}

function decodePathSegments(pathname: string) {
  try {
    return pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
  } catch {
    return null
  }
}

function resolveDistDirectory(options: ProjectZNodeRuntimeOptions) {
  return resolve(options.distDirectory ?? 'dist')
}

function resolveStaticPath(distDirectory: string, pathname: string) {
  const segments = decodePathSegments(pathname)

  if (!segments) {
    return null
  }

  const filePath = resolve(distDirectory, ...segments)
  const rootPrefix = distDirectory.endsWith(sep)
    ? distDirectory
    : `${distDirectory}${sep}`

  return filePath === distDirectory || filePath.startsWith(rootPrefix)
    ? filePath
    : null
}

function getContentType(filePath: string) {
  switch (extname(filePath).toLowerCase()) {
    case '.css':
      return 'text/css; charset=utf-8'
    case '.gif':
      return 'image/gif'
    case '.html':
      return 'text/html; charset=utf-8'
    case '.ico':
      return 'image/x-icon'
    case '.jpeg':
    case '.jpg':
      return 'image/jpeg'
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8'
    case '.json':
    case '.map':
      return 'application/json; charset=utf-8'
    case '.png':
      return 'image/png'
    case '.svg':
      return 'image/svg+xml'
    case '.txt':
      return 'text/plain; charset=utf-8'
    case '.wasm':
      return 'application/wasm'
    case '.webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}

function isTextContentType(contentType: string) {
  return (
    contentType.startsWith('text/') ||
    contentType.includes('json') ||
    contentType === 'image/svg+xml'
  )
}

function isNotFoundFileSystemError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  )
}

async function createStaticFileResponse(input: {
  cacheControl?: string
  filePath: string
  method: string
}): Promise<BackendResponse | null> {
  let fileStat: Awaited<ReturnType<typeof stat>>

  try {
    fileStat = await stat(input.filePath)
  } catch (error) {
    if (isNotFoundFileSystemError(error)) {
      return null
    }

    throw error
  }

  if (!fileStat.isFile()) {
    return null
  }

  const contentType = getContentType(input.filePath)
  const headers: Record<string, string> = {
    'content-length': String(fileStat.size),
    'content-type': contentType,
  }

  if (input.cacheControl) {
    headers['cache-control'] = input.cacheControl
  }

  if (input.method === 'HEAD') {
    return {
      body: '',
      headers,
      statusCode: 200,
    }
  }

  const fileBuffer = await readFile(input.filePath)

  if (isTextContentType(contentType)) {
    return {
      body: fileBuffer.toString('utf8'),
      headers,
      statusCode: 200,
    }
  }

  return {
    body: fileBuffer.toString('latin1'),
    bodyEncoding: 'latin1',
    headers,
    statusCode: 200,
  }
}

function notFoundResponse() {
  return jsonResponse(404, { error: 'Маршрут не найден.' })
}

async function serveIndexHtml(input: {
  distDirectory: string
  method: string
}) {
  const indexPath = resolve(input.distDirectory, 'index.html')

  return (
    (await createStaticFileResponse({
      cacheControl: indexCacheControl,
      filePath: indexPath,
      method: input.method,
    })) ?? notFoundResponse()
  )
}

async function handleStaticSpaRequest(
  request: BackendRequest,
  options: ProjectZNodeRuntimeOptions,
): Promise<BackendResponse | null> {
  const method = request.httpMethod.toUpperCase()

  if (method !== 'GET' && method !== 'HEAD') {
    return null
  }

  if (hasUnsafeRawPathSegment(getRawRequestPathname(request))) {
    return notFoundResponse()
  }

  const pathname = getRequestPath(request)
  const distDirectory = resolveDistDirectory(options)

  if (pathname === '/' || pathname === '/index.html') {
    return serveIndexHtml({ distDirectory, method })
  }

  const filePath = resolveStaticPath(distDirectory, pathname)

  if (!filePath) {
    return notFoundResponse()
  }

  if (pathname.startsWith('/assets/')) {
    return (
      (await createStaticFileResponse({
        cacheControl: immutableAssetCacheControl,
        filePath,
        method,
      })) ?? notFoundResponse()
    )
  }

  const staticFileResponse = await createStaticFileResponse({
    filePath,
    method,
  })

  return staticFileResponse ?? serveIndexHtml({ distDirectory, method })
}

async function readNodeRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = []
  let receivedBytes = 0
  let exceededLimit = false

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    receivedBytes += buffer.byteLength

    if (receivedBytes > requestBodyLimitBytes) {
      exceededLimit = true
      continue
    }

    chunks.push(buffer)
  }

  if (exceededLimit) {
    throw new RequestError(413, 'Запрос слишком большой.')
  }

  return chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : null
}

export async function createBackendRequestFromNode(
  request: IncomingMessage,
): Promise<BackendRequest> {
  const headers: BackendHeaders = request.headers
  const target = getRequestTarget(request)
  const rawUrl = getAbsoluteRequestUrl(target, headers)

  return {
    body: await readNodeRequestBody(request),
    headers,
    httpMethod: request.method ?? 'GET',
    isBase64Encoded: false,
    path: getPathFromRequestTarget(target),
    rawUrl,
  }
}

export async function handleProjectZNodeRequest(
  request: BackendRequest,
  options: ProjectZNodeRuntimeOptions = {},
): Promise<BackendResponse> {
  const method = request.httpMethod.toUpperCase()
  const pathname = getRequestPath(request)

  if (pathname === '/healthz') {
    if (method !== 'GET') {
      return jsonResponse(405, { error: 'Healthcheck expects GET.' })
    }

    return jsonResponse(200, { status: 'ok' })
  }

  if (pathname === '/api/admin/announcement-worker') {
    return handleAnnouncementWorkerRequest(request, {
      db: options.db,
    })
  }

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return handleProjectZApiRequest(request, {
      db: options.db,
    })
  }

  return (await handleStaticSpaRequest(request, options)) ?? notFoundResponse()
}

export function writeBackendResponseToNode(
  response: BackendResponse,
  nodeResponse: ServerResponse,
) {
  nodeResponse.statusCode = response.statusCode

  for (const [name, value] of Object.entries(response.headers ?? {})) {
    nodeResponse.setHeader(name, value)
  }

  for (const [name, values] of Object.entries(response.multiValueHeaders ?? {})) {
    nodeResponse.setHeader(name, values)
  }

  if (response.bodyEncoding) {
    nodeResponse.end(response.body, response.bodyEncoding)
    return
  }

  nodeResponse.end(response.body)
}

function logRequest(input: {
  durationMs: number
  logger: Pick<Console, 'info'>
  request: BackendRequest
  response: BackendResponse
}) {
  input.logger.info('Project Z Node request', {
    durationMs: input.durationMs,
    method: input.request.httpMethod,
    path: getRequestPath(input.request),
    statusCode: input.response.statusCode,
  })
}

export async function handleIncomingNodeRequest(
  nodeRequest: IncomingMessage,
  nodeResponse: ServerResponse,
  options: ProjectZNodeRuntimeOptions = {},
) {
  const logger = options.logger ?? console
  const startedAt = Date.now()
  let backendRequest: BackendRequest | null = null

  try {
    backendRequest = await createBackendRequestFromNode(nodeRequest)
    const backendResponse = await handleProjectZNodeRequest(
      backendRequest,
      options,
    )

    writeBackendResponseToNode(backendResponse, nodeResponse)
    logRequest({
      durationMs: Date.now() - startedAt,
      logger,
      request: backendRequest,
      response: backendResponse,
    })
  } catch (error) {
    const backendResponse =
      error instanceof RequestError
        ? jsonResponse(error.statusCode, { error: error.message })
        : jsonResponse(500, { error: 'Сервер не смог обработать запрос.' })

    if (!(error instanceof RequestError)) {
      logger.error('Project Z Node request failed', {
        message: error instanceof Error ? error.message : 'unknown',
        method: nodeRequest.method ?? 'GET',
        path: backendRequest ? getRequestPath(backendRequest) : '/',
      })
    }

    writeBackendResponseToNode(backendResponse, nodeResponse)
  }
}

export function createProjectZNodeServer(options: NodeServerOptions = {}) {
  return createServer((request, response) => {
    void handleIncomingNodeRequest(request, response, options)
  })
}
