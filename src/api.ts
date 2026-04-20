import type { PlayerProfile, SyncApiResponse } from './types'

function normalizeUsername(raw: string): string {
  return raw.trim()
}

function formatApiError(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }

  if (value instanceof Error) {
    return value.message
  }

  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return '[unserializable error details]'
    }
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return null
}

export async function fetchPlayerProfile(username: string): Promise<PlayerProfile> {
  const safeUsername = normalizeUsername(username)

  if (!safeUsername) {
    throw new Error('Username is required.')
  }

  const response = await fetch(`/api/player/${encodeURIComponent(safeUsername)}`, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: unknown; details?: unknown; code?: string }
      | null

    if (payload?.code === 'NO_USER_DATA') {
      throw new Error(`No RuneScape Wiki sync data found for ${safeUsername}.`)
    }

    const message =
      formatApiError(payload?.details) ||
      formatApiError(payload?.error) ||
      `API returned ${response.status}.`
    throw new Error(`Failed to fetch ${safeUsername}. ${message}`)
  }

  const payload = (await response.json()) as Partial<SyncApiResponse>

  if (!payload.username && (payload as { code?: string }).code === 'NO_USER_DATA') {
    throw new Error(`No RuneScape Wiki sync data found for ${safeUsername}.`)
  }

  if (!payload.username || typeof payload.username !== 'string') {
    throw new Error(`Unexpected API payload for ${safeUsername}: missing username.`)
  }

  if (!payload.levels || typeof payload.levels !== 'object') {
    throw new Error(`Unexpected API payload for ${safeUsername}: missing levels.`)
  }

  if (!Array.isArray(payload.league_tasks)) {
    throw new Error(
      `Unexpected API payload for ${safeUsername}: missing league_tasks array.`,
    )
  }

  const completedTaskIds = new Set<number>()
  for (const id of payload.league_tasks) {
    if (typeof id === 'number' && Number.isFinite(id)) {
      completedTaskIds.add(id)
    }
  }

  const levels: Record<string, number> = {}
  for (const [skill, value] of Object.entries(payload.levels)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      levels[skill] = value
    }
  }

  return {
    username: payload.username,
    levels,
    completedTaskIds,
  }
}
