import { createHash } from 'node:crypto'
import type { BackendRequest } from './http'
import { getHeader } from './http'

type RateLimitPolicy = {
  key: string
  limit: number
  windowMs: number
}

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

export const missionAttemptPerMissionLimit = {
  limit: 8,
  windowMs: 60 * 1000,
}

export const missionAttemptPerSessionLimit = {
  limit: 20,
  windowMs: 10 * 60 * 1000,
}

export const pilotSessionCreationIpLimit = {
  limit: 10,
  windowMs: 60 * 60 * 1000,
}

function firstCommaSeparatedValue(value: string | undefined) {
  return value?.split(',')[0]?.trim() || null
}

function normalizeForwardedFor(value: string) {
  const withoutPrefix = value.replace(/^for=/i, '').trim()
  const withoutQuotes = withoutPrefix.replace(/^"|"$/g, '')

  return withoutQuotes.replace(/^\[|\]$/g, '').trim()
}

function getForwardedHeaderClientIp(request: BackendRequest) {
  const forwardedHeader = firstCommaSeparatedValue(
    getHeader(request.headers, 'forwarded'),
  )

  if (!forwardedHeader) {
    return null
  }

  const forPair = forwardedHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith('for='))

  return forPair ? normalizeForwardedFor(forPair) : null
}

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 24)
}

export function getClientIpHash(request: BackendRequest) {
  const clientIp =
    firstCommaSeparatedValue(getHeader(request.headers, 'x-forwarded-for')) ??
    firstCommaSeparatedValue(getHeader(request.headers, 'x-real-ip')) ??
    firstCommaSeparatedValue(getHeader(request.headers, 'cf-connecting-ip')) ??
    getForwardedHeaderClientIp(request) ??
    'missing-client-ip'

  return hashValue(clientIp.toLowerCase())
}

export class ProjectZRateLimiter {
  private readonly acceptedMissionAttemptClientIds = new Map<string, number>()
  private readonly buckets = new Map<string, number[]>()

  reset() {
    this.acceptedMissionAttemptClientIds.clear()
    this.buckets.clear()
  }

  checkMissionAttempt(input: {
    clientAttemptId: string
    missionId: string
    nowMs?: number
    pilotSessionId: string
  }): RateLimitDecision {
    if (this.hasAcceptedMissionAttemptClientId(input)) {
      return { allowed: true }
    }

    return this.consume(
      [
        {
          key: [
            'mission-attempt',
            'session-mission',
            input.pilotSessionId,
            input.missionId,
          ].join(':'),
          ...missionAttemptPerMissionLimit,
        },
        {
          key: ['mission-attempt', 'session', input.pilotSessionId].join(':'),
          ...missionAttemptPerSessionLimit,
        },
      ],
      input.nowMs,
    )
  }

  rememberAcceptedMissionAttemptClientId(input: {
    clientAttemptId: string
    missionId: string
    nowMs?: number
    pilotSessionId: string
  }) {
    const nowMs = input.nowMs ?? Date.now()

    this.pruneAcceptedMissionAttemptClientIds(nowMs)
    this.acceptedMissionAttemptClientIds.set(
      this.getMissionAttemptClientIdKey(input),
      nowMs,
    )
  }

  checkPilotSessionCreation(input: {
    ipHash: string
    nowMs?: number
  }): RateLimitDecision {
    return this.consume(
      [
        {
          key: ['pilot-session-create', 'ip', input.ipHash].join(':'),
          ...pilotSessionCreationIpLimit,
        },
      ],
      input.nowMs,
    )
  }

  private consume(
    policies: RateLimitPolicy[],
    nowMs = Date.now(),
  ): RateLimitDecision {
    const bucketEntries = policies.map((policy) => ({
      policy,
      timestamps: this.getActiveTimestamps(policy, nowMs),
    }))
    const exceededBucket = bucketEntries.find(
      (entry) => entry.timestamps.length >= entry.policy.limit,
    )

    if (exceededBucket) {
      return {
        allowed: false,
        retryAfterSeconds: this.getRetryAfterSeconds(
          exceededBucket.policy,
          exceededBucket.timestamps,
          nowMs,
        ),
      }
    }

    for (const entry of bucketEntries) {
      this.buckets.set(entry.policy.key, [...entry.timestamps, nowMs])
    }

    return { allowed: true }
  }

  private getActiveTimestamps(policy: RateLimitPolicy, nowMs: number) {
    const cutoff = nowMs - policy.windowMs

    return (this.buckets.get(policy.key) ?? []).filter(
      (timestamp) => timestamp > cutoff,
    )
  }

  private getMissionAttemptClientIdKey(input: {
    clientAttemptId: string
    missionId: string
    pilotSessionId: string
  }) {
    return [
      input.pilotSessionId,
      input.missionId,
      input.clientAttemptId.trim(),
    ].join(':')
  }

  private getRetryAfterSeconds(
    policy: RateLimitPolicy,
    timestamps: number[],
    nowMs: number,
  ) {
    const oldestTimestamp = timestamps[0] ?? nowMs
    const retryAfterMs = policy.windowMs - (nowMs - oldestTimestamp)

    return Math.max(1, Math.ceil(retryAfterMs / 1000))
  }

  private hasAcceptedMissionAttemptClientId(input: {
    clientAttemptId: string
    missionId: string
    pilotSessionId: string
  }) {
    this.pruneAcceptedMissionAttemptClientIds(Date.now())

    return this.acceptedMissionAttemptClientIds.has(
      this.getMissionAttemptClientIdKey(input),
    )
  }

  private pruneAcceptedMissionAttemptClientIds(nowMs: number) {
    const cutoff = nowMs - missionAttemptPerSessionLimit.windowMs

    for (const [key, acceptedAt] of this.acceptedMissionAttemptClientIds) {
      if (acceptedAt <= cutoff) {
        this.acceptedMissionAttemptClientIds.delete(key)
      }
    }
  }
}

export function createProjectZRateLimiter() {
  return new ProjectZRateLimiter()
}
