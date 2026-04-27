export default function Roadmap() {
  const items = [
    {
      status: 'done',
      quarter: 'Q1 2024',
      title: 'Core AI Signal Engine',
      items: ['LightGBM model deployment', 'EUR/USD, GBP/USD signals', 'Entry/TP/SL calculation'],
    },
    {
      status: 'done',
      quarter: 'Q2 2024',
      title: 'Expanded Pair Coverage',
      items: ['35+ currency pairs', 'FVG Scanner', 'S/R Breakout Detection'],
    },
    {
      status: 'done',
      quarter: 'Q3 2024',
      title: 'Advanced Analysis',
      items: ['Pattern Scanner', 'Volatility Rankings', 'Economic Calendar integration'],
    },
    {
      status: 'in-progress',
      quarter: 'Q4 2024',
      title: 'Platform Improvements',
      items: ['Real-time price streaming', 'TradingView chart integration', 'Mobile app (beta)'],
    },
    {
      status: 'upcoming',
      quarter: 'Q1 2025',
      title: 'User Features',
      items: ['Custom alerts & notifications', 'Portfolio tracking', 'Signal history export'],
    },
    {
      status: 'upcoming',
      quarter: 'Q2 2025',
      title: 'Pro Features',
      items: ['Multi-timeframe analysis', 'Backtesting tool', 'API access for traders'],
    },
  ]

  const statusConfig = {
    done: { icon: '✅', color: 'var(--buy)', label: 'Completed' },
    'in-progress': { icon: '🚀', color: 'var(--accent)', label: 'In Progress' },
    upcoming: { icon: '📋', color: 'var(--text-muted)', label: 'Planned' },
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Roadmap</h1>
      <p className="mb-10" style={{ color: 'var(--text-muted)' }}>
        What we've built and what's coming next for PiiTrade.
      </p>

      <div className="flex flex-col gap-4">
        {items.map(({ status, quarter, title, items: features }) => {
          const cfg = statusConfig[status]
          return (
            <div key={quarter} className="card" style={{
              borderColor: status === 'in-progress' ? 'var(--accent)' : 'var(--border)',
              opacity: status === 'upcoming' ? 0.8 : 1,
            }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{quarter}</div>
                  <h3 className="font-semibold">{title}</h3>
                </div>
                <span className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{ color: cfg.color, background: `color-mix(in srgb, ${cfg.color} 15%, transparent)` }}>
                  {cfg.icon} {cfg.label}
                </span>
              </div>
              <ul className="flex flex-col gap-1">
                {features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: cfg.color }}>
                      {status === 'done' ? '•' : status === 'in-progress' ? '›' : '○'}
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
