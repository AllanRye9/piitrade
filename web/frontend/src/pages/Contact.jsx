import { useState } from 'react'

export default function Contact() {
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', message: '' })

  const handleSubmit = e => {
    e.preventDefault()
    // Placeholder - would POST to backend in production
    setSent(true)
  }

  const field = (name, label, type = 'text', textarea = false) => (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      {textarea ? (
        <textarea
          rows={4}
          value={form[name]}
          onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
          required
          className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors focus:border-[var(--accent)] resize-none"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
      ) : (
        <input
          type={type}
          value={form[name]}
          onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
          required
          className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors focus:border-[var(--accent)]"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
      )}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
      <p className="mb-8" style={{ color: 'var(--text-muted)' }}>
        Have a question, suggestion, or found a bug? Reach out below.
      </p>

      {sent ? (
        <div className="card text-center py-10">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="font-semibold text-lg mb-1">Message Sent!</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Thanks for reaching out. We'll get back to you soon.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
          {field('name', 'Name')}
          {field('email', 'Email', 'email')}
          {field('message', 'Message', 'text', true)}
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            Send Message
          </button>
        </form>
      )}

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card text-center">
          <div className="text-2xl mb-2">📧</div>
          <div className="font-medium text-sm mb-0.5">Email</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>support@piitrade.com</div>
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
