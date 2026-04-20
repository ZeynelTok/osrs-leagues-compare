import { useTheme } from '../themeContext'

export function Header() {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="brand">
          <div className="brand__badge" aria-hidden="true">
            <span>🏆</span>
          </div>
          <div>
            <h1>Leagues Compare</h1>
            <p>OSRS Task Tracker</p>
          </div>
        </div>
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          <span aria-hidden="true">{theme === 'light' ? '☾' : '☀'}</span>
        </button>
      </div>
    </header>
  )
}
