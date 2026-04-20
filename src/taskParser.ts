import { TIER_POINTS } from './constants'
import type { ParseResult, TaskMeta, TaskTier } from './types'

const VALID_TIERS = new Set<TaskTier>([
  'easy',
  'medium',
  'hard',
  'elite',
  'master',
])

function cleanWikiMarkup(value: string): string {
  return value
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\{\{SCP\|([^|}]+)\|([^|}]+)(?:\|[^}]*)?\}\}/g, '$1 $2')
    .replace(/\{\{Coins\|([^}]+)\}\}/g, '$1 coins')
    .replace(/\{\{Fairycode\|([^}]+)\}\}/g, '$1')
    .replace(/\{\{DPL\|([^}]+)\}\}/g, '$1')
    .replace(/\{\{DP known issue\|([^}]+)\}\}/gi, 'Known issue: $1')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/'''/g, '')
    .replace(/''/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitTopLevelPipes(input: string): string[] {
  const result: string[] = []
  let cursor = ''
  let templateDepth = 0
  let linkDepth = 0

  for (let i = 0; i < input.length; i += 1) {
    const pair = input.slice(i, i + 2)

    if (pair === '{{') {
      templateDepth += 1
      cursor += pair
      i += 1
      continue
    }

    if (pair === '}}' && templateDepth > 0) {
      templateDepth -= 1
      cursor += pair
      i += 1
      continue
    }

    if (pair === '[[') {
      linkDepth += 1
      cursor += pair
      i += 1
      continue
    }

    if (pair === ']]' && linkDepth > 0) {
      linkDepth -= 1
      cursor += pair
      i += 1
      continue
    }

    if (input[i] === '|' && templateDepth === 0 && linkDepth === 0) {
      result.push(cursor)
      cursor = ''
      continue
    }

    cursor += input[i]
  }

  result.push(cursor)
  return result
}

function parseRow(rawRow: string, rowNumber: number): { task?: TaskMeta; warning?: string } {
  const row = rawRow.trim().replace(/}}\s*,\s*$/, '}}')

  if (!row.startsWith('{{DPLTaskRow|') || !row.endsWith('}}')) {
    return { warning: `Row ${rowNumber}: malformed row wrapper.` }
  }

  const inner = row.replace(/^\{\{DPLTaskRow\|/, '').replace(/}}$/, '')
  const chunks = splitTopLevelPipes(inner)

  if (chunks.length < 6) {
    return { warning: `Row ${rowNumber}: not enough fields.` }
  }

  const nameRaw = chunks[0]?.trim() ?? ''
  const descriptionRaw = chunks[1]?.trim() ?? ''

  if (!nameRaw) {
    return { warning: `Row ${rowNumber}: missing task name.` }
  }

  let id: number | null = null
  let tierRaw = ''
  let region = ''

  for (const chunk of chunks.slice(2)) {
    const trimmed = chunk.trim()

    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex < 0) {
      continue
    }

    const key = trimmed.slice(0, equalsIndex).trim()
    const value = trimmed.slice(equalsIndex + 1).trim()

    if (key === 'id') {
      const parsedId = Number.parseInt(value, 10)
      if (Number.isFinite(parsedId)) {
        id = parsedId
      }
    }

    if (key === 'tier') {
      tierRaw = value.toLowerCase()
    }

    if (key === 'region') {
      region = cleanWikiMarkup(value)
    }
  }

  if (id === null) {
    return { warning: `Row ${rowNumber}: missing task id for ${nameRaw}.` }
  }

  if (!VALID_TIERS.has(tierRaw as TaskTier)) {
    return { warning: `Row ${rowNumber}: unknown tier "${tierRaw}" on id ${id}.` }
  }

  if (!region) {
    return { warning: `Row ${rowNumber}: missing region on id ${id}.` }
  }

  const tier = tierRaw as TaskTier
  const description = cleanWikiMarkup(descriptionRaw)

  return {
    task: {
      id,
      name: cleanWikiMarkup(nameRaw),
      description,
      tier,
      region,
      points: TIER_POINTS[tier],
    },
  }
}

function extractRowBlocks(input: string): { rows: string[]; warnings: string[] } {
  const rows: string[] = []
  const warnings: string[] = []
  const lines = input.split(/\r?\n/)

  let current: string[] = []
  let openRowLine = -1

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]

    if (current.length === 0 && line.includes('{{DPLTaskRow|')) {
      current = [line]
      openRowLine = i + 1

      if (/\|id=\d+}}\s*,?\s*$/.test(line.trim())) {
        rows.push(current.join('\n'))
        current = []
        openRowLine = -1
      }
      continue
    }

    if (current.length > 0) {
      current.push(line)

      if (/\|id=\d+}}\s*,?\s*$/.test(line.trim())) {
        rows.push(current.join('\n'))
        current = []
        openRowLine = -1
      }
    }
  }

  if (current.length > 0) {
    warnings.push(`Unclosed DPLTaskRow starting at line ${openRowLine}.`)
  }

  return { rows, warnings }
}

export function parseTaskWikiRows(input: string): ParseResult {
  if (!input.trim()) {
    return {
      tasks: [],
      warnings: ['No task source text provided.'],
    }
  }

  const { rows, warnings } = extractRowBlocks(input)
  const tasks: TaskMeta[] = []
  const seenIds = new Set<number>()

  rows.forEach((rawRow, index) => {
    const parsed = parseRow(rawRow, index + 1)

    if (parsed.warning) {
      warnings.push(parsed.warning)
      return
    }

    if (!parsed.task) {
      warnings.push(`Row ${index + 1}: parser returned no task.`)
      return
    }

    if (seenIds.has(parsed.task.id)) {
      warnings.push(`Duplicate task id found: ${parsed.task.id}`)
      return
    }

    seenIds.add(parsed.task.id)
    tasks.push(parsed.task)
  })

  tasks.sort((a, b) => a.id - b.id)

  if (tasks.length === 0 && warnings.length === 0) {
    warnings.push('No DPLTaskRow entries found in the provided text.')
  }

  return { tasks, warnings }
}
