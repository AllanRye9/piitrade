export default function EditorialPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Editorial Policy</h1>
      <p className="mb-10" style={{ color: 'var(--text-muted)' }}>
        How we research, review, and publish educational forex content on PiiTrade.
      </p>

      <div className="flex flex-col gap-6">
        <div className="card">
          <h2 className="font-semibold text-lg mb-3">Our publishing standards</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Every article and guide is written for education first. We focus on practical topics such as
            risk management, market structure, and signal interpretation so readers can make informed
            decisions. Content is reviewed for clarity, factual consistency, and alignment with our
            non-advisory position before publication.
          </p>
        </div>

        <div className="card">
          <h2 className="font-semibold text-lg mb-3">How we create analysis content</h2>
          <ul className="flex flex-col gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <li>• We explain the market concept in plain language and define all key terms.</li>
            <li>• We include actionable context: when a setup is valid, invalid, or neutral.</li>
            <li>• We prioritize risk controls, including stop-loss logic and position sizing.</li>
            <li>• We update articles when product behavior or feature labels change.</li>
          </ul>
        </div>

        <div className="card">
          <h2 className="font-semibold text-lg mb-3">Independence and monetization</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            PiiTrade may monetize through advertising and partnerships, but monetization does not determine
            article conclusions or signal explanations. We do not sell guaranteed outcomes and we do not
            publish sponsored claims as facts. Trading outcomes vary by user, broker, execution, and market
            conditions.
          </p>
        </div>

        <div className="card">
          <h2 className="font-semibold text-lg mb-3">Corrections and feedback</h2>
          <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--text-muted)' }}>
            If you find an error or outdated section, contact us and include the page URL plus a short note
            describing the issue. Verified corrections are prioritized and updated in the next editorial cycle.
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Contact: <span style={{ color: 'var(--text)' }}>support@piitrade.com</span>
          </p>
        </div>
      </div>
    </div>
  )
}
