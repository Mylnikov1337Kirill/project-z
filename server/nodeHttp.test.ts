import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createBackendRequestFromNode,
  handleProjectZNodeRequest,
  writeBackendResponseToNode,
} from './nodeHttp'
import { RequestError, requestBodyLimitBytes } from './backend/http'
import type { ProjectZDatabase } from './db/projectZDatabase'

const previousWorkerToken = process.env.PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}

function createBackendRequest(input: {
  body?: string | null
  headers?: Record<string, string | string[] | undefined>
  method?: string
  path: string
  rawUrl?: string
}) {
  return {
    body: input.body ?? null,
    headers: input.headers ?? {},
    httpMethod: input.method ?? 'GET',
    path: input.path,
    rawUrl: input.rawUrl ?? `http://localhost${input.path}`,
  }
}

function createIncomingMessage(input: {
  body?: string
  headers?: Record<string, string | string[] | undefined>
  method?: string
  url: string
}) {
  const chunks = input.body === undefined ? [] : [input.body]
  const request = Readable.from(chunks) as IncomingMessage
  request.headers = input.headers ?? {}
  request.method = input.method ?? 'GET'
  request.url = input.url

  return request
}

function createFakeDb(input: {
  getLeaderboardEntries?: () => Promise<unknown>
} = {}) {
  return {
    getLeaderboardEntries: vi.fn(input.getLeaderboardEntries ?? (async () => [])),
  } as unknown as ProjectZDatabase
}

beforeEach(() => {
  process.env.PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN = 'worker-token'
})

afterEach(() => {
  restoreEnvironmentVariable(
    'PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN',
    previousWorkerToken,
  )
})

describe('Agent Trail Node HTTP runtime routing', () => {
  it('serves the healthcheck without touching backend dependencies', async () => {
    const response = await handleProjectZNodeRequest(
      createBackendRequest({ path: '/healthz' }),
    )

    expect(response.statusCode).toBe(200)
    expect(response.headers).toMatchObject({
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    })
    expect(JSON.parse(response.body)).toEqual({ status: 'ok' })
  })

  it('routes /api requests through the runtime-neutral API handler', async () => {
    const db = createFakeDb({
      getLeaderboardEntries: async () => [
        {
          closedChaptersCount: 3,
          lastBadgeDate: '2026-06-01T10:00:00.000Z',
          lastBadgeName: 'План перед изменениями',
          learnerId: 'learner-1',
          nickname: 'pilot-agent',
        },
      ],
    })

    const response = await handleProjectZNodeRequest(
      createBackendRequest({ path: '/api/leaderboard' }),
      { db },
    )
    const body = JSON.parse(response.body) as {
      entries: { fullName: string; nickname: string }[]
    }

    expect(response.statusCode).toBe(200)
    expect(body.entries).toEqual([
      expect.objectContaining({
        fullName: '',
        nickname: 'pilot-agent',
      }),
    ])
  })

  it('routes the target worker endpoint through the reusable worker handler', async () => {
    const db = createFakeDb({})

    const response = await handleProjectZNodeRequest(
      createBackendRequest({
        headers: {
          authorization: 'Bearer wrong-token',
        },
        method: 'POST',
        path: '/api/admin/announcement-worker',
      }),
      { db },
    )

    expect(response.statusCode).toBe(401)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Announcement worker token is invalid.',
    })
  })
})

describe('Agent Trail Node static SPA serving', () => {
  const indexHtml =
    '<!doctype html><html><head><title>Agent Trail</title></head><body><div id="root"></div></body></html>'
  const assetBody = 'console.log("project-z");'
  let distDirectory = ''

  beforeEach(async () => {
    distDirectory = await mkdtemp(join(tmpdir(), 'project-z-dist-'))

    await mkdir(join(distDirectory, 'assets'))
    await writeFile(join(distDirectory, 'index.html'), indexHtml)
    await writeFile(join(distDirectory, 'assets', 'index-abc123.js'), assetBody)
  })

  afterEach(async () => {
    if (distDirectory) {
      await rm(distDirectory, { force: true, recursive: true })
    }
  })

  it('serves dist/index.html for the root path with no-store caching', async () => {
    const response = await handleProjectZNodeRequest(
      createBackendRequest({ path: '/' }),
      { distDirectory },
    )

    expect(response.statusCode).toBe(200)
    expect(response.headers).toMatchObject({
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
    })
    expect(response.body).toBe(indexHtml)
  })

  it('serves /index.html directly with no-store caching', async () => {
    const response = await handleProjectZNodeRequest(
      createBackendRequest({ path: '/index.html' }),
      { distDirectory },
    )

    expect(response.statusCode).toBe(200)
    expect(response.headers).toMatchObject({
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
    })
    expect(response.body).toBe(indexHtml)
  })

  it('falls SPA routes back to dist/index.html', async () => {
    const response = await handleProjectZNodeRequest(
      createBackendRequest({ path: '/map' }),
      { distDirectory },
    )

    expect(response.statusCode).toBe(200)
    expect(response.headers).toMatchObject({
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
    })
    expect(response.body).toBe(indexHtml)
  })

  it('serves existing assets with immutable caching', async () => {
    const response = await handleProjectZNodeRequest(
      createBackendRequest({ path: '/assets/index-abc123.js' }),
      { distDirectory },
    )

    expect(response.statusCode).toBe(200)
    expect(response.headers).toMatchObject({
      'cache-control': 'public, max-age=31536000, immutable',
      'content-type': 'text/javascript; charset=utf-8',
    })
    expect(response.body).toBe(assetBody)
  })

  it('supports HEAD for static files without a response body', async () => {
    const response = await handleProjectZNodeRequest(
      createBackendRequest({
        method: 'HEAD',
        path: '/assets/index-abc123.js',
      }),
      { distDirectory },
    )

    expect(response.statusCode).toBe(200)
    expect(response.headers).toMatchObject({
      'cache-control': 'public, max-age=31536000, immutable',
      'content-length': String(Buffer.byteLength(assetBody)),
      'content-type': 'text/javascript; charset=utf-8',
    })
    expect(response.body).toBe('')
  })

  it('returns 404 for missing assets instead of the SPA fallback', async () => {
    const response = await handleProjectZNodeRequest(
      createBackendRequest({ path: '/assets/missing.js' }),
      { distDirectory },
    )

    expect(response.statusCode).toBe(404)
    expect(response.body).not.toBe(indexHtml)
  })

  it.each([
    {
      path: '/index.html',
      rawUrl: 'http://localhost/assets/%2e%2e/index.html',
    },
    {
      path: '/package.json',
      rawUrl: 'http://localhost/%2e%2e/package.json',
    },
  ])('returns a safe 404 for traversal attempts: $rawUrl', async (input) => {
    const response = await handleProjectZNodeRequest(
      createBackendRequest(input),
      { distDirectory },
    )

    expect(response.statusCode).toBe(404)
    expect(response.body).not.toBe(indexHtml)
  })
})

describe('Agent Trail Node request adapter', () => {
  it('preserves forwarded host/protocol headers and request bodies', async () => {
    const request = createIncomingMessage({
      body: '{"publicCode":"pilot-alpha"}',
      headers: {
        host: '127.0.0.1:3000',
        'x-forwarded-host': 'project-z.example',
        'x-forwarded-proto': 'https',
      },
      method: 'POST',
      url: '/api/pilot-sessions?source=smoke',
    })

    const backendRequest = await createBackendRequestFromNode(request)

    expect(backendRequest).toMatchObject({
      body: '{"publicCode":"pilot-alpha"}',
      httpMethod: 'POST',
      path: '/api/pilot-sessions',
      rawUrl: 'https://project-z.example/api/pilot-sessions?source=smoke',
    })
    expect(backendRequest.headers['x-forwarded-host']).toBe('project-z.example')
    expect(backendRequest.headers['x-forwarded-proto']).toBe('https')
  })

  it('rejects request bodies before they exceed the API body limit in memory', async () => {
    const request = createIncomingMessage({
      body: 'x'.repeat(requestBodyLimitBytes + 1),
      method: 'POST',
      url: '/api/pilot-sessions',
    })

    await expect(createBackendRequestFromNode(request)).rejects.toMatchObject({
      statusCode: 413,
    } satisfies Partial<RequestError>)
  })

  it('writes multi-value Set-Cookie headers to the Node response', () => {
    const headers = new Map<string, number | string | string[]>()
    const nodeResponse = {
      end: vi.fn(),
      setHeader: vi.fn((name: string, value: number | string | string[]) => {
        headers.set(name, value)
        return nodeResponse as ServerResponse
      }),
      statusCode: 0,
    } as unknown as ServerResponse

    writeBackendResponseToNode(
      {
        body: '{"ok":true}',
        headers: {
          'cache-control': 'no-store',
          'content-type': 'application/json; charset=utf-8',
        },
        multiValueHeaders: {
          'Set-Cookie': ['a=1; Path=/', 'b=2; Path=/'],
        },
        statusCode: 200,
      },
      nodeResponse,
    )

    expect(nodeResponse.statusCode).toBe(200)
    expect(headers.get('Set-Cookie')).toEqual(['a=1; Path=/', 'b=2; Path=/'])
    expect(nodeResponse.end).toHaveBeenCalledWith('{"ok":true}')
  })
})
