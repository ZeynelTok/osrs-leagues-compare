const SYNC_BASE_URL = 'https://sync.runescape.wiki/runelite/player'
const MIRROR_BASE_URL = 'https://r.jina.ai/http://sync.runescape.wiki/runelite/player'
const DEFAULT_LEAGUE_ID = 'DEMONIC_PACTS_LEAGUE'
const REQUEST_TIMEOUT_MS = readPositiveInteger(process.env.REQUEST_TIMEOUT_MS, 8000)
const RATE_LIMIT_WINDOW_MS = readPositiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 60_000)
const RATE_LIMIT_MAX_REQUESTS = readPositiveInteger(process.env.RATE_LIMIT_MAX_REQUESTS, 60)
const CACHE_TTL_MS = readPositiveInteger(process.env.CACHE_TTL_MS, 15_000)
const USERNAME_PATTERN = /^[A-Za-z0-9 _-]{1,12}$/
const RATE_LIMIT_BUCKETS = new Map()
const PLAYER_CACHE = new Map()

class UpstreamError extends Error {
  constructor(message, statusCode = 502, details) {
    super(message)
    this.name = 'UpstreamError'
    this.statusCode = statusCode
    this.details = details
  }
}

function readPositiveInteger(rawValue, fallback) {
  const parsed = Number.parseInt(rawValue ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(JSON.stringify(payload))
}

function safeUsername(value) {
  return value.trim().replace(/\s+/g, ' ')
}

function decodePathSegment(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function isValidUsername(value) {
  return USERNAME_PATTERN.test(value)
}

function buildRemoteUrl(baseUrl, username, leagueId) {
  return `${baseUrl}/${encodeURIComponent(username)}/${encodeURIComponent(leagueId)}`
}

function extractJsonObject(rawText) {
  const firstBrace = rawText.indexOf('{')
  const lastBrace = rawText.lastIndexOf('}')

  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error('No JSON object found in mirrored response.')
  }

  return JSON.parse(rawText.slice(firstBrace, lastBrace + 1))
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new UpstreamError(
        `Upstream timeout after ${REQUEST_TIMEOUT_MS}ms.`,
        504,
        'Request aborted by timeout.',
      )
    }

    const message = error instanceof Error ? error.message : 'Unknown fetch error'
    throw new UpstreamError('Network error while contacting upstream.', 502, message)
  } finally {
    clearTimeout(timeoutId)
  }
}

async function readDirect(remoteUrl) {
  const response = await fetchWithTimeout(remoteUrl, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const message = text.trim() || `Remote API returned ${response.status}`
    throw new UpstreamError('Direct upstream request failed.', response.status, message)
  }

  return response.json()
}

async function readMirror(mirrorUrl) {
  const response = await fetchWithTimeout(mirrorUrl, {
    headers: {
      Accept: 'text/plain',
    },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const message = text.trim() || `Mirror returned ${response.status}`
    throw new UpstreamError('Mirror upstream request failed.', response.status, message)
  }

  const text = await response.text()
  return extractJsonObject(text)
}

function getCachedPayload(username) {
  const key = username.toLowerCase()
  const cached = PLAYER_CACHE.get(key)

  if (!cached) {
    return null
  }

  if (cached.expiresAt <= Date.now()) {
    PLAYER_CACHE.delete(key)
    return null
  }

  return cached.payload
}

function setCachedPayload(username, payload) {
  const key = username.toLowerCase()
  PLAYER_CACHE.set(key, {
    payload,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })

  if (PLAYER_CACHE.size <= 500) {
    return
  }

  for (const [entryKey, value] of PLAYER_CACHE.entries()) {
    if (value.expiresAt <= Date.now()) {
      PLAYER_CACHE.delete(entryKey)
    }

    if (PLAYER_CACHE.size <= 500) {
      break
    }
  }
}

async function readRemotePlayer(username) {
  const cached = getCachedPayload(username)
  if (cached) {
    return cached
  }

  const remoteUrl = buildRemoteUrl(SYNC_BASE_URL, username, DEFAULT_LEAGUE_ID)
  const mirrorUrl = buildRemoteUrl(MIRROR_BASE_URL, username, DEFAULT_LEAGUE_ID)

  try {
    const payload = await readDirect(remoteUrl)
    setCachedPayload(username, payload)
    return payload
  } catch (directError) {
    try {
      const payload = await readMirror(mirrorUrl)
      setCachedPayload(username, payload)
      return payload
    } catch (mirrorError) {
      const directMessage =
        directError instanceof Error
          ? `${directError.message}${directError.details ? ` (${directError.details})` : ''}`
          : 'Unknown direct failure'
      const mirrorMessage =
        mirrorError instanceof Error
          ? `${mirrorError.message}${mirrorError.details ? ` (${mirrorError.details})` : ''}`
          : 'Unknown mirror failure'
      throw new UpstreamError(
        'All upstream providers failed.',
        502,
        `Direct: ${directMessage} | Mirror: ${mirrorMessage}`,
      )
    }
  }
}

function isNoUserDataPayload(payload) {
  return payload && typeof payload === 'object' && payload.code === 'NO_USER_DATA'
}

function getClientIp(req) {
  return req.socket?.remoteAddress ?? 'unknown'
}

function consumeRateLimit(key) {
  const now = Date.now()
  let bucket = RATE_LIMIT_BUCKETS.get(key)

  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    bucket = {
      windowStart: now,
      count: 0,
    }
    RATE_LIMIT_BUCKETS.set(key, bucket)
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000),
    )
    return {
      limited: true,
      retryAfterSeconds,
    }
  }

  bucket.count += 1

  if (RATE_LIMIT_BUCKETS.size > 1000) {
    for (const [bucketKey, value] of RATE_LIMIT_BUCKETS.entries()) {
      if (now - value.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
        RATE_LIMIT_BUCKETS.delete(bucketKey)
      }
    }
  }

  return {
    limited: false,
    retryAfterSeconds: 0,
  }
}

function isAllowedOrigin(req) {
  const originHeader = req.headers.origin
  if (!originHeader) {
    return true
  }

  const hostHeader = req.headers.host
  if (!hostHeader) {
    return false
  }

  try {
    const origin = new URL(originHeader)
    return origin.host === hostHeader
  } catch {
    return false
  }
}

function toErrorMessage(error, username) {
  const statusCode = error && typeof error.statusCode === 'number' ? error.statusCode : 502
  const details = error instanceof Error && error.details ? error.details : ''
  const logMessage = error instanceof Error ? error.message : 'Unknown upstream failure'

  return {
    statusCode: statusCode === 504 ? 504 : 502,
    logMessage,
    details,
    body: {
      error: `Could not reach RuneScape Wiki sync API for ${username}.`,
    },
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`)

  if (!isAllowedOrigin(req)) {
    sendJson(res, 403, { error: 'Forbidden origin.' })
    return
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed.' })
    return
  }

  const match = url.pathname.match(/^\/api\/player\/([^/]+)$/)
  if (!match) {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  const decodedUsername = decodePathSegment(match[1] ?? '')
  if (decodedUsername === null) {
    sendJson(res, 400, { error: 'Username has invalid URL encoding.' })
    return
  }

  const username = safeUsername(decodedUsername)
  if (!username) {
    sendJson(res, 400, { error: 'Username is required.' })
    return
  }

  if (!isValidUsername(username)) {
    sendJson(res, 400, {
      error: 'Username must be 1-12 chars using letters, numbers, spaces, underscores, or hyphens.',
    })
    return
  }

  const clientIp = getClientIp(req)
  const rateLimit = consumeRateLimit(clientIp)

  if (rateLimit.limited) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds))
    sendJson(res, 429, {
      error: 'Too many requests. Please try again shortly.',
    })
    return
  }

  try {
    const payload = await readRemotePlayer(username)

    if (isNoUserDataPayload(payload)) {
      sendJson(res, 404, {
        code: 'NO_USER_DATA',
        error: `No RuneScape Wiki sync data found for ${username}.`,
      })
      return
    }

    sendJson(res, 200, payload)
  } catch (error) {
    const formatted = toErrorMessage(error, username)
    console.error(
      `[upstream-failure] user=${username} ip=${clientIp} status=${formatted.statusCode} ${formatted.logMessage}${formatted.details ? ` | ${formatted.details}` : ''}`,
    )
    sendJson(res, formatted.statusCode, formatted.body)
  }
}