export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">About PiiTrade</h1>
      <p className="mb-10" style={{ color: 'var(--text-muted)' }}>
        AI-powered forex signals, built for traders of all levels.
      </p>

      <div className="flex flex-col gap-5">
        <div className="card">
          <h2 className="font-semibold text-lg mb-3">Our Mission</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            PiiTrade was built to democratize access to institutional-grade forex analysis. We believe every
            retail trader should have access to the same AI-powered tools that professional trading desks use —
            completely free of charge.
          </p>
        </div>

        <div className="card">
          <h2 className="font-semibold text-lg mb-3">What We Offer</h2>
          <ul className="flex flex-col gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            {[
              'Free AI forex signals for 35+ currency pairs',
              'LightGBM machine learning model with 10+ years of training data',
              'Fair Value Gap (FVG) scanner and S/R breakout detection',
              'Multi-timeframe pattern recognition',
              'Real-time economic calendar and market news',
              'Volatility rankings and reversal signal detection',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span style={{ color: 'var(--buy)' }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2 className="font-semibold text-lg mb-3">Technology Stack</h2>
          <div className="flex flex-wrap gap-2">
            {['LightGBM', 'Python', 'FastAPI', 'React 19', 'ECB Data Feed', 'Technical Analysis'].map(tech => (
              <span key={tech} className="text-xs px-2.5 py-1 rounded border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                {tech}
              </span>
            ))}
          </div>
        </div>

        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <h2 className="font-semibold text-lg mb-2" style={{ color: 'var(--accent)' }}>100% Free</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            All features on PiiTrade are free to use. We're committed to keeping core signals and analysis
            tools accessible to everyone. No credit card required, no hidden fees.
          </p>
        </div>
      </div>
    </div>
  )
}
