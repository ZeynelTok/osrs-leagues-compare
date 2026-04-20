interface PlayerStatsProps {
  username: string
  points: number
  tasksCompleted: number
  totalLevel: number
  variant: 'left' | 'right'
}

export function PlayerStats({
  username,
  points,
  tasksCompleted,
  totalLevel,
  variant,
}: PlayerStatsProps) {
  const sideClass = variant === 'left' ? 'player-card--left' : 'player-card--right'

  return (
    <article className={`player-card ${sideClass}`}>
      <header className="player-card__header">
        <div className="player-card__avatar" aria-hidden="true">
          <span>{username.slice(0, 1).toUpperCase()}</span>
        </div>
        <div>
          <h2>{username}</h2>
          <p>League Profile</p>
        </div>
      </header>

      <div className="player-card__stats">
        <Stat title="Points" value={points.toLocaleString()} />
        <Stat title="Tasks" value={tasksCompleted.toLocaleString()} />
        <Stat title="Total level" value={totalLevel.toLocaleString()} />
      </div>
    </article>
  )
}

interface StatProps {
  title: string
  value: string
}

function Stat({ title, value }: StatProps) {
  return (
    <div className="metric">
      <p>{value}</p>
      <span>{title}</span>
    </div>
  )
}
