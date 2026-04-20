import { SKILL_ORDER, TIER_ORDER } from './constants'
import type {
  BreakdownRow,
  CompletionStatus,
  LevelRow,
  PlayerProfile,
  ScoreSummary,
  TaskComparisonRow,
  TaskFilters,
  TaskMeta,
  TaskTier,
} from './types'

function resolveStatus(
  leftCompleted: boolean,
  rightCompleted: boolean,
): CompletionStatus {
  if (leftCompleted && rightCompleted) {
    return 'both'
  }

  if (leftCompleted && !rightCompleted) {
    return 'left-only'
  }

  if (!leftCompleted && rightCompleted) {
    return 'right-only'
  }

  return 'neither'
}

export function createComparisonRows(
  left: PlayerProfile,
  right: PlayerProfile,
  taskMap: Map<number, TaskMeta>,
): TaskComparisonRow[] {
  const taskIds = new Set<number>()

  if (taskMap.size > 0) {
    taskMap.forEach((_, id) => {
      taskIds.add(id)
    })
  } else {
    left.completedTaskIds.forEach((id) => taskIds.add(id))
    right.completedTaskIds.forEach((id) => taskIds.add(id))
  }

  const rows: TaskComparisonRow[] = []

  taskIds.forEach((id) => {
    const leftCompleted = left.completedTaskIds.has(id)
    const rightCompleted = right.completedTaskIds.has(id)
    const status = resolveStatus(leftCompleted, rightCompleted)
    const task = taskMap.get(id)

    rows.push({
      id,
      name: task?.name ?? `Task #${id}`,
      region: task?.region ?? 'Unknown',
      tier: task?.tier ?? 'unknown',
      points: task?.points ?? 0,
      leftCompleted,
      rightCompleted,
      status,
      hasMetadata: Boolean(task),
    })
  })

  rows.sort((a, b) => a.id - b.id)

  return rows
}

export function formatTierLabel(tier: string): string {
  if (!tier) {
    return tier
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()
}

export function filterComparisonRows(
  rows: TaskComparisonRow[],
  filters: TaskFilters,
): TaskComparisonRow[] {
  const needle = filters.search.trim().toLowerCase()

  return rows.filter((row) => {
    if (needle && !row.name.toLowerCase().includes(needle)) {
      return false
    }

    if (filters.region !== 'all' && row.region !== filters.region) {
      return false
    }

    if (filters.tier !== 'all' && row.tier !== filters.tier) {
      return false
    }

    if (filters.status === 'left-completed' && !row.leftCompleted) {
      return false
    }

    if (filters.status === 'right-completed' && !row.rightCompleted) {
      return false
    }

    if (
      filters.status !== 'all' &&
      filters.status !== 'left-completed' &&
      filters.status !== 'right-completed' &&
      row.status !== filters.status
    ) {
      return false
    }

    return true
  })
}

export function buildScoreSummary(rows: TaskComparisonRow[]): ScoreSummary {
  let leftTotal = 0
  let rightTotal = 0
  let bothCount = 0
  let leftOnlyCount = 0
  let rightOnlyCount = 0

  for (const row of rows) {
    if (row.leftCompleted) {
      leftTotal += row.points
    }

    if (row.rightCompleted) {
      rightTotal += row.points
    }

    if (row.status === 'both') {
      bothCount += 1
    }

    if (row.status === 'left-only') {
      leftOnlyCount += 1
    }

    if (row.status === 'right-only') {
      rightOnlyCount += 1
    }

  }

  return {
    leftTotal,
    rightTotal,
    delta: leftTotal - rightTotal,
    bothCount,
    leftOnlyCount,
    rightOnlyCount,
  }
}

export function buildBreakdown(
  rows: TaskComparisonRow[],
  by: 'region' | 'tier',
): BreakdownRow[] {
  const scoreMap = new Map<string, { left: number; right: number }>()

  for (const row of rows) {
    if (!row.hasMetadata) {
      continue
    }

    const key = by === 'region' ? row.region : row.tier

    if (!scoreMap.has(key)) {
      scoreMap.set(key, { left: 0, right: 0 })
    }

    const bucket = scoreMap.get(key)
    if (!bucket) {
      continue
    }

    if (row.leftCompleted) {
      bucket.left += row.points
    }

    if (row.rightCompleted) {
      bucket.right += row.points
    }
  }

  const rowsOut: BreakdownRow[] = []
  scoreMap.forEach((value, key) => {
    rowsOut.push({
      key,
      left: value.left,
      right: value.right,
      delta: value.left - value.right,
    })
  })

  rowsOut.sort((a, b) => {
    if (by === 'tier') {
      const order = [...TIER_ORDER, 'unknown']
      return order.indexOf(a.key) - order.indexOf(b.key)
    }

    return a.key.localeCompare(b.key)
  })

  return rowsOut
}

function skillSort(a: string, b: string): number {
  const aIndex = SKILL_ORDER.indexOf(a)
  const bIndex = SKILL_ORDER.indexOf(b)

  if (aIndex >= 0 && bIndex >= 0) {
    return aIndex - bIndex
  }

  if (aIndex >= 0) {
    return -1
  }

  if (bIndex >= 0) {
    return 1
  }

  return a.localeCompare(b)
}

export function buildLevelRows(
  leftLevels: Record<string, number>,
  rightLevels: Record<string, number>,
): LevelRow[] {
  const skillSet = new Set<string>()

  Object.keys(leftLevels).forEach((skill) => skillSet.add(skill))
  Object.keys(rightLevels).forEach((skill) => skillSet.add(skill))

  return Array.from(skillSet)
    .sort(skillSort)
    .map((skill) => {
      const left = leftLevels[skill] ?? 0
      const right = rightLevels[skill] ?? 0

      return {
        skill,
        left,
        right,
        delta: left - right,
      }
    })
}

export function listRegions(rows: TaskComparisonRow[]): string[] {
  const set = new Set<string>()
  rows.forEach((row) => set.add(row.region))
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

export function listTiers(rows: TaskComparisonRow[]): string[] {
  const set = new Set<TaskTier | 'unknown'>()
  rows.forEach((row) => set.add(row.tier))
  const ordered: Array<TaskTier | 'unknown'> = [...TIER_ORDER, 'unknown']
  return ordered.filter((tier) => set.has(tier))
}
