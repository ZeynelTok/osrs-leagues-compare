import type { FormEvent } from 'react'

interface PlayerInputProps {
  username1: string
  username2: string
  onUsername1Change: (value: string) => void
  onUsername2Change: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onReset: () => void
  loading: boolean
  hasResults: boolean
}

export function PlayerInput({
  username1,
  username2,
  onUsername1Change,
  onUsername2Change,
  onSubmit,
  onReset,
  loading,
  hasResults,
}: PlayerInputProps) {
  return (
    <section className="input-card" aria-label="Player selection">
      <form onSubmit={onSubmit}>
        <div className="input-card__grid">
          <label>
            Player 1
            <input
              type="text"
              value={username1}
              onChange={(event) => onUsername1Change(event.target.value)}
              placeholder="Enter username..."
              disabled={loading}
              required
            />
          </label>
          <label>
            Player 2
            <input
              type="text"
              value={username2}
              onChange={(event) => onUsername2Change(event.target.value)}
              placeholder="Enter username..."
              disabled={loading}
              required
            />
          </label>
        </div>

        <div className="input-card__actions">
          {hasResults ? (
            <button
              type="button"
              className="button button--ghost"
              onClick={onReset}
              disabled={loading}
            >
              Clear
            </button>
          ) : null}
          <button
            type="submit"
            className="button button--primary"
            disabled={!username1.trim() || !username2.trim() || loading}
          >
            {loading ? 'Fetching...' : 'Compare'}
          </button>
        </div>
      </form>
    </section>
  )
}
