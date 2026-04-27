export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm mb-10" style={{ color: 'var(--text-muted)' }}>Last updated: {new Date().getFullYear()}</p>

      <div className="flex flex-col gap-5" style={{ color: 'var(--text-muted)' }}>
        <div className="card">
          <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Information We Collect</h2>
          <p className="text-sm leading-relaxed">
            We collect minimal information necessary to provide our services. When you create an account, we
            store your username and hashed password. We may collect anonymized usage analytics to improve the
            platform, including pages visited and features used.
          </p>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>How We Use Your Information</h2>
          <ul className="text-sm flex flex-col gap-1.5">
            <li className="flex items-start gap-2"><span>•</span>To provide and maintain the platform</li>
            <li className="flex items-start gap-2"><span>•</span>To authenticate your account securely</li>
            <li className="flex items-start gap-2"><span>•</span>To improve platform features and performance</li>
            <li className="flex items-start gap-2"><span>•</span>To send important service updates (if opted in)</li>
          </ul>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Data Security</h2>
          <p className="text-sm leading-relaxed">
            We implement industry-standard security measures including HTTPS encryption, hashed passwords,
            and secure session management. We do not store any financial data or trading credentials.
          </p>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Third-Party Services</h2>
          <p className="text-sm leading-relaxed">
            PiiTrade uses ECB (European Central Bank) for forex rate data. We do not sell or share your
            personal information with third parties for marketing purposes.
          </p>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Cookies</h2>
          <p className="text-sm leading-relaxed">
            We use session cookies for authentication. No third-party tracking cookies are used. You can
            disable cookies in your browser, though this may affect site functionality.
          </p>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Contact</h2>
          <p className="text-sm leading-relaxed">
            For privacy-related inquiries, please use the <a href="/contact" className="hover:text-[var(--accent)] underline">
            contact form</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
