import { SUPPORT_EMAIL } from '../utils/site'

export default function Contact() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
      <p className="mb-8" style={{ color: 'var(--text-muted)' }}>
        Have a question, correction request, or product feedback? Contact our support team directly.
      </p>

      <div className="card">
        <h2 className="font-semibold text-lg mb-3">Best way to reach us</h2>
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>
          Email <span style={{ color: 'var(--text)' }}>{SUPPORT_EMAIL}</span> with the page URL, issue
          details, and screenshots when relevant. This helps us investigate quickly and publish fixes or
          corrections.
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Typical response window: 1–3 business days.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card text-center">
          <div className="text-2xl mb-2">📧</div>
          <div className="font-medium text-sm mb-0.5">Email</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{SUPPORT_EMAIL}</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl mb-2">🐦</div>
          <div className="font-medium text-sm mb-0.5">Twitter / X</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>@piitrade</div>
        </div>
      </div>
    </div>
  )
}
