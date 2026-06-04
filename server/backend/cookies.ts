import { type BackendRequest, getHeader } from './http'

const defaultPilotSessionCookieName = 'project_z_pilot_session_id'
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getPilotSessionCookieName() {
  return (
    process.env.PROJECT_Z_PILOT_SESSION_COOKIE_NAME?.trim() ||
    defaultPilotSessionCookieName
  )
}

export function parseCookies(cookieHeader: string | undefined) {
  const cookies = new Map<string, string>()

  if (!cookieHeader) {
    return cookies
  }

  for (const cookie of cookieHeader.split(';')) {
    const [name, ...valueParts] = cookie.trim().split('=')

    if (name) {
      cookies.set(name, decodeURIComponent(valueParts.join('=')))
    }
  }

  return cookies
}

export function getPilotSessionId(request: BackendRequest) {
  const cookieValue = parseCookies(getHeader(request.headers, 'cookie')).get(
    getPilotSessionCookieName(),
  )

  return cookieValue && uuidPattern.test(cookieValue) ? cookieValue : null
}

export function shouldUseSecureCookie(request: BackendRequest) {
  const forwardedProtocol = getHeader(request.headers, 'x-forwarded-proto')

  if (forwardedProtocol) {
    return forwardedProtocol === 'https'
  }

  return request.rawUrl?.startsWith('https://') ?? false
}

export function createPilotSessionCookie(
  request: BackendRequest,
  sessionId: string,
) {
  const cookieParts = [
    `${getPilotSessionCookieName()}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=5184000',
  ]

  if (shouldUseSecureCookie(request)) {
    cookieParts.push('Secure')
  }

  return cookieParts.join('; ')
}

export function createExpiredPilotSessionCookie(request: BackendRequest) {
  const cookieParts = [
    `${getPilotSessionCookieName()}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ]

  if (shouldUseSecureCookie(request)) {
    cookieParts.push('Secure')
  }

  return cookieParts.join('; ')
}
