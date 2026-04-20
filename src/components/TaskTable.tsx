import { useMemo, useState } from 'react'
import { filterComparisonRows, formatTierLabel, listRegions, listTiers } from '../comparison'
import type { CompletionStatus, TaskComparisonRow, TaskFilters } from '../types'

interface TaskTableProps {
  rows: TaskComparisonRow[]
  leftName: string
  rightName: string
}

type FilterOption =
  | 'all'
  | 'both'
  | 'left-only'
  | 'right-only'
  | 'neither'
  | 'left-completed'
  | 'right-completed'

const PAGE_SIZE = 80

function formatStatus(status: CompletionStatus, leftName: string, rightName: string): string {
  if (status === 'left-only') {
    return `${leftName} Only`
  }

  if (status === 'right-only') {
    return `${rightName} Only`
  }

  if (status === 'both') {
    return 'Both'
  }

  return 'Neither'
}

function buildFilterLabels(leftName: string, rightName: string): Record<FilterOption, string> {
  return {
    all: 'All Tasks',
    both: 'Completed By Both',
    'left-only': `${leftName} Only`,
    'right-only': `${rightName} Only`,
    neither: 'Incomplete By Both',
    'left-completed': `Completed By ${leftName}`,
    'right-completed': `Completed By ${rightName}`,
  }
}

export function TaskTable({ rows, leftName, rightName }: TaskTableProps) {
  const [filters, setFilters] = useState<TaskFilters>({
    search: '',
    region: 'all',
    tier: 'all',
    status: 'all',
  })
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [page, setPage] = useState(1)

  const regionOptions = useMemo(() => listRegions(rows), [rows])
  const tierOptions = useMemo(() => listTiers(rows), [rows])

  const filteredRows = useMemo(() => filterComparisonRows(rows, filters), [rows, filters])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pagedRows = filteredRows.slice(pageStart, pageStart + PAGE_SIZE)

  const filterLabels = buildFilterLabels(leftName, rightName)

  return (
    <section className="task-card">
      <div className="task-card__toolbar">
        <div className="task-card__meta">
          <span>
            Showing {pagedRows.length} of {filteredRows.length} Tasks
          </span>
        </div>

        <div className="task-card__toolbar-right">
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, search: event.target.value }))
            }
            placeholder="Search Tasks..."
            aria-label="Search Tasks"
            className="toolbar-search"
          />

          <div className="filter-menu">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setShowFilterMenu((value) => !value)}
              aria-expanded={showFilterMenu}
            >
              {filterLabels[filters.status as FilterOption]}
            </button>
            {showFilterMenu ? (
              <div className="filter-menu__panel">
                {(Object.keys(filterLabels) as FilterOption[]).map((option) => (
                  <button
                    type="button"
                    key={option}
                    onClick={() => {
                      setFilters((previous) => ({ ...previous, status: option }))
                      setShowFilterMenu(false)
                    }}
                    className={
                      filters.status === option
                        ? 'filter-option filter-option--active'
                        : 'filter-option'
                    }
                  >
                    {filterLabels[option]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <select
            value={filters.region}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, region: event.target.value }))
            }
            aria-label="Filter By Region"
          >
            <option value="all">All Regions</option>
            {regionOptions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>

          <select
            value={filters.tier}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, tier: event.target.value }))
            }
            aria-label="Filter By Tier"
          >
            <option value="all">All Tiers</option>
            {tierOptions.map((tier) => (
              <option key={tier} value={tier}>
                {formatTierLabel(tier)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Region</th>
              <th>Tier</th>
              <th>Points</th>
              <th>{leftName}</th>
              <th>{rightName}</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="task-title-inline">
                    <strong>{row.name}</strong>
                    <small>#{row.id}</small>
                  </div>
                </td>
                <td>{row.region}</td>
                <td>{formatTierLabel(row.tier)}</td>
                <td>{row.points}</td>
                <td>
                  <CompletionBadge completed={row.leftCompleted} />
                </td>
                <td>
                  <CompletionBadge completed={row.rightCompleted} />
                </td>
                <td>{formatStatus(row.status, leftName, rightName)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination-row">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => setPage((value) => Math.max(1, value - 1))}
          disabled={currentPage <= 1}
        >
          Previous
        </button>
        <span>
          Page {currentPage} / {pageCount}
        </span>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
          disabled={currentPage >= pageCount}
        >
          Next
        </button>
      </div>
    </section>
  )
}

function CompletionBadge({ completed }: { completed: boolean }) {
  if (completed) {
    return <span className="badge badge--yes">Done</span>
  }

  return <span className="badge badge--no">Not Done</span>
}
