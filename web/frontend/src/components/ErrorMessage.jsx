export default function ErrorMessage({ message = 'Failed to load data', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="text-3xl">⚠️</div>
      <p className="text-sm" style={{ color: 'var(--sell)' }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-1.5 rounded-md text-sm font-medium border transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          Retry
        </button>
      )}
    </div>
  )
}
