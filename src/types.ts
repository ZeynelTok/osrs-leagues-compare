export type TaskTier = 'easy' | 'medium' | 'hard' | 'elite' | 'master'

export type CompletionStatus = 'both' | 'left-only' | 'right-only' | 'neither'

export interface SyncApiResponse {
  username: string
  levels: Record<string, number>
  league_tasks: number[]
}

export interface PlayerProfile {
  username: string
  levels: Record<string, number>
  completedTaskIds: Set<number>
}

export interface TaskMeta {
  id: number
  name: string
  description: string
  tier: TaskTier
  region: string
  points: number
}

export interface TaskComparisonRow {
  id: number
  name: string
  region: string
  tier: TaskTier | 'unknown'
  points: number
  leftCompleted: boolean
  rightCompleted: boolean
  status: CompletionStatus
  hasMetadata: boolean
}

export interface ScoreSummary {
  leftTotal: number
  rightTotal: number
  delta: number
  bothCount: number
  leftOnlyCount: number
  rightOnlyCount: number
}

export interface BreakdownRow {
  key: string
  left: number
  right: number
  delta: number
}

export interface LevelRow {
  skill: string
  left: number
  right: number
  delta: number
}

export interface TaskFilters {
  search: string
  region: string
  tier: string
  status: 'all' | CompletionStatus | 'left-completed' | 'right-completed'
}

export interface ParseResult {
  tasks: TaskMeta[]
  warnings: string[]
}
