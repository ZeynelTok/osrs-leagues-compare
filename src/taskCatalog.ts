import taskRowsRaw from '../tasks_from_wiki.md?raw'
import { parseTaskWikiRows } from './taskParser'
import type { TaskMeta } from './types'

const parsed = parseTaskWikiRows(taskRowsRaw)

if (parsed.warnings.length > 0) {
  // Parsing is expected to be mostly clean, but warnings are retained for diagnostics.
  console.warn('Task catalog parse warnings:', parsed.warnings.slice(0, 20))
}

export const TASK_CATALOG: TaskMeta[] = parsed.tasks
export const TASKS_BY_ID = new Map<number, TaskMeta>(
  TASK_CATALOG.map((task) => [task.id, task]),
)
