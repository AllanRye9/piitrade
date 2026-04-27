export default function Disclaimer() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Disclaimer</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>Last updated: {new Date().getFullYear()}</p>

      <div className="flex flex-col gap-5" style={{ color: 'var(--text-muted)' }}>
        <div className="card">
          <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>No Financial Advice</h2>
          <p className="text-sm leading-relaxed">
            The information provided on PiiTrade, including all forex signals, analysis, and market commentary,
            is for informational and educational purposes only. Nothing on this platform constitutes financial
            advice, investment advice, trading advice, or any other advice.
          </p>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Risk of Loss</h2>
          <p className="text-sm leading-relaxed">
            Forex trading involves a substantial risk of loss and is not suitable for all investors. The high
            degree of leverage that is often obtainable in forex trading can work against you as well as for you.
            You should carefully consider your investment objectives, level of experience, and risk appetite before
            trading.
          </p>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Accuracy of Information</h2>
          <p className="text-sm leading-relaxed">
            While we strive to provide accurate and up-to-date signals, we make no representations or warranties
            of any kind regarding the accuracy, completeness, or timeliness of the information provided. AI-generated
            signals can be wrong and should not be solely relied upon for trading decisions.
          </p>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Past Performance</h2>
          <p className="text-sm leading-relaxed">
            Past performance of our signals is not indicative of future results. The forex market is influenced by
            many unpredictable factors including geopolitical events, economic data releases, and central bank policies.
          </p>
        </div>

        <div className="card" style={{ borderColor: 'var(--sell)' }}>
          <h2 className="font-semibold mb-2" style={{ color: 'var(--sell)' }}>⚠️ Important Warning</h2>
          <p className="text-sm leading-relaxed">
            <strong style={{ color: 'var(--text)' }}>Never trade with money you cannot afford to lose.</strong>{' '}
            Do not rely solely on automated signals. Always conduct your own research, use proper risk management
            including stop-loss orders, and consult a licensed financial advisor before making any trading decisions.
          </p>
        </div>
      </div>
    </div>
  )
}
