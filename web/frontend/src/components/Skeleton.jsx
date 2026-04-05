/**
 * Skeleton loading component for cards and content placeholders.
 * Shows animated gray pulsing shimmer until real content loads.
 */

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-bg-card border border-border-default rounded-xl p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="skeleton h-5 w-24" />
        <div className="skeleton h-5 w-16" />
      </div>
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-3/4" />
      <div className="skeleton h-8 w-full rounded-lg" />
    </div>
  )
}

export function SkeletonLine({ width = 'w-full', height = 'h-4', className = '' }) {
  return <div className={`skeleton ${width} ${height} ${className}`} />
}

export function SkeletonChart({ className = '' }) {
  return (
    <div className={`bg-bg-card border border-border-default rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="skeleton h-5 w-32" />
        <div className="skeleton h-5 w-20" />
      </div>
      <div className="flex items-end gap-1 h-32">
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            className="skeleton flex-1"
            style={{ height: `${20 + Math.random() * 80}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function SkeletonSignal({ className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main signal card */}
      <div className="bg-bg-card border border-border-default rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="space-y-2">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-8 w-24" />
          </div>
          <div className="space-y-2 flex flex-col items-end">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-6 w-20" />
          </div>
        </div>
      </div>
      {/* Level cards */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-bg-card border border-border-default rounded-lg p-3 space-y-2">
            <div className="skeleton h-3 w-12" />
            <div className="skeleton h-5 w-16" />
          </div>
        ))}
      </div>
      {/* Confidence */}
      <div className="bg-bg-card border border-border-default rounded-lg p-3 space-y-2">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-2 w-full rounded-full" />
      </div>
    </div>
  )
}

export default SkeletonCard
