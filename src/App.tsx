import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { fetchPlayerProfile } from './api'
import {
  buildBreakdown,
  buildLevelRows,
  buildScoreSummary,
  formatTierLabel,
  createComparisonRows,
} from './comparison'
import { TASKS_BY_ID, TASK_CATALOG } from './taskCatalog'
import type { PlayerProfile } from './types'
import { Header } from './components/Header'
import { PlayerInput } from './components/PlayerInput'
import { PlayerStats } from './components/PlayerStats'
import { TaskTable } from './components/TaskTable'
import './App.css'

function formatDelta(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value}`
}

function sumLevels(levels: Record<string, number>): number {
  return Object.values(levels).reduce((total, current) => total + current, 0)
}

function App() {
  const [leftUsername, setLeftUsername] = useState('')
  const [rightUsername, setRightUsername] = useState('')
  const [leftProfile, setLeftProfile] = useState<PlayerProfile | null>(null)
  const [rightProfile, setRightProfile] = useState<PlayerProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const comparisonRows = useMemo(() => {
    if (!leftProfile || !rightProfile) {
      return []
    }

    return createComparisonRows(leftProfile, rightProfile, TASKS_BY_ID)
  }, [leftProfile, rightProfile])

  const levelRows = useMemo(() => {
    if (!leftProfile || !rightProfile) {
      return []
    }

    return buildLevelRows(leftProfile.levels, rightProfile.levels)
  }, [leftProfile, rightProfile])

  const summary = useMemo(() => buildScoreSummary(comparisonRows), [comparisonRows])
  const regionBreakdown = useMemo(
    () => buildBreakdown(comparisonRows, 'region'),
    [comparisonRows],
  )
  const tierBreakdown = useMemo(
    () => buildBreakdown(comparisonRows, 'tier'),
    [comparisonRows],
  )

  const regionCount = useMemo(() => new Set(TASK_CATALOG.map((task) => task.region)).size, [])

  async function handleCompare(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setErrorMessage('')
    setIsLoading(true)

    try {
      const [left, right] = await Promise.all([
        fetchPlayerProfile(leftUsername),
        fetchPlayerProfile(rightUsername),
      ])

      setLeftProfile(left)
      setRightProfile(right)
    } catch (error) {
      const fallback = 'Failed to compare players. Double-check usernames and try again.'
      setErrorMessage(error instanceof Error ? error.message : fallback)
    } finally {
      setIsLoading(false)
    }
  }

  function handleReset(): void {
    setLeftUsername('')
    setRightUsername('')
    setLeftProfile(null)
    setRightProfile(null)
    setErrorMessage('')
  }

  const leftName = leftProfile?.username || leftUsername || 'Player A'
  const rightName = rightProfile?.username || rightUsername || 'Player B'
  const leftTasksCompleted = summary.bothCount + summary.leftOnlyCount
  const rightTasksCompleted = summary.bothCount + summary.rightOnlyCount
  const leftTotalLevel = leftProfile ? sumLevels(leftProfile.levels) : 0
  const rightTotalLevel = rightProfile ? sumLevels(rightProfile.levels) : 0

  return (
    <div className="app-root">
      <Header />

      <main className="app-main">
        <section className="hero-panel">
          <p className="hero-panel__kicker">Demonic Pacts League</p>
          <h2>Compare League Progress With Friends</h2>
          <div className="hero-panel__chips" aria-label="Catalog summary">
            <span>{TASK_CATALOG.length.toLocaleString()} Tasks</span>
            <span>{regionCount} Regions</span>
            <span>Tier Points: 10 / 30 / 80 / 200 / 400</span>
          </div>
        </section>

        <PlayerInput
          username1={leftUsername}
          username2={rightUsername}
          onUsername1Change={setLeftUsername}
          onUsername2Change={setRightUsername}
          onSubmit={handleCompare}
          onReset={handleReset}
          loading={isLoading}
          hasResults={Boolean(leftProfile && rightProfile)}
        />

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

        {leftProfile && rightProfile ? (
          <div className="results-stack">
            <section className="stats-grid">
              <PlayerStats
                username={leftName}
                points={summary.leftTotal}
                tasksCompleted={leftTasksCompleted}
                totalLevel={leftTotalLevel}
                variant="left"
              />
              <PlayerStats
                username={rightName}
                points={summary.rightTotal}
                tasksCompleted={rightTasksCompleted}
                totalLevel={rightTotalLevel}
                variant="right"
              />
            </section>

            <section className="panel summary-banner">
              <h3>Snapshot</h3>
              <div className="summary-banner__grid">
                <div>
                  <span>Point Difference</span>
                  <p className={summary.delta >= 0 ? 'good' : 'bad'}>{formatDelta(summary.delta)}</p>
                </div>
                <div>
                  <span>Shared Completed</span>
                  <p>{summary.bothCount}</p>
                </div>
                <div>
                  <span>{leftName} Only</span>
                  <p>{summary.leftOnlyCount}</p>
                </div>
                <div>
                  <span>{rightName} Only</span>
                  <p>{summary.rightOnlyCount}</p>
                </div>
              </div>
            </section>

            <section className="comparison-grid">
              <div className="panel comparison-card">
                <h3>Level Comparison</h3>
                <div className="table-wrap comparison-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Skill</th>
                        <th>{leftName}</th>
                        <th>{rightName}</th>
                        <th>Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levelRows.map((row) => (
                        <tr key={row.skill}>
                          <td>{row.skill}</td>
                          <td>{row.left}</td>
                          <td>{row.right}</td>
                          <td className={row.delta >= 0 ? 'good' : 'bad'}>
                            {formatDelta(row.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel comparison-card">
                <h3>Points By Tier</h3>
                <div className="table-wrap comparison-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Tier</th>
                        <th>{leftName}</th>
                        <th>{rightName}</th>
                        <th>Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tierBreakdown.map((row) => (
                        <tr key={row.key}>
                          <td>{formatTierLabel(row.key)}</td>
                          <td>{row.left}</td>
                          <td>{row.right}</td>
                          <td className={row.delta >= 0 ? 'good' : 'bad'}>
                            {formatDelta(row.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel comparison-card">
                <h3>Points By Region</h3>
                <div className="table-wrap comparison-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Region</th>
                        <th>{leftName}</th>
                        <th>{rightName}</th>
                        <th>Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regionBreakdown.map((row) => (
                        <tr key={row.key}>
                          <td>{row.key}</td>
                          <td>{row.left}</td>
                          <td>{row.right}</td>
                          <td className={row.delta >= 0 ? 'good' : 'bad'}>
                            {formatDelta(row.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section>
              <h3 className="section-title">Task Comparison</h3>
              <TaskTable rows={comparisonRows} leftName={leftName} rightName={rightName} />
            </section>
          </div>
        ) : (
          <section className="empty-hint">
            <p>Enter Two Usernames Above To Compare League Progress.</p>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
