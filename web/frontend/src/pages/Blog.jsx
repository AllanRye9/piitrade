import { Link } from 'react-router-dom'

const posts = [
  {
    slug: 'what-is-fvg-trading',
    title: 'What is Fair Value Gap (FVG) Trading?',
    excerpt: 'Learn how Fair Value Gaps — price imbalances left by institutional orders — can be used as high-probability entry zones.',
    date: '2024-11-15',
    category: 'Education',
    readTime: '5 min',
  },
  {
    slug: 'lightgbm-forex-signals',
    title: 'How LightGBM Powers Our Forex Signals',
    excerpt: 'A deep dive into how we use gradient boosting to generate BUY/SELL/HOLD signals with confidence scoring.',
    date: '2024-11-08',
    category: 'Technology',
    readTime: '7 min',
  },
  {
    slug: 'support-resistance-breakouts',
    title: 'Trading Support & Resistance Breakouts',
    excerpt: 'Support and resistance levels are the backbone of technical analysis. Breakout trading around these levels is one of the most reliable strategies.',
    date: '2024-10-28',
    category: 'Strategy',
    readTime: '6 min',
  },
  {
    slug: 'bos-choch-explained',
    title: 'BOS and CHoCH: Smart Money Concepts Explained',
    excerpt: 'Break of Structure (BOS) and Change of Character (CHoCH) are key smart money concepts used to identify trend changes early.',
    date: '2024-10-20',
    category: 'Education',
    readTime: '8 min',
  },
  {
    slug: 'risk-management-forex',
    title: 'Risk Management: The Most Important Skill in Forex',
    excerpt: 'A consistent winning strategy means nothing without proper risk management. Learn how to protect your capital.',
    date: '2024-10-12',
    category: 'Risk Management',
    readTime: '6 min',
  },
]

const categoryColors = {
  Education: 'var(--accent)',
  Technology: 'var(--hold)',
  Strategy: 'var(--buy)',
  'Risk Management': 'var(--sell)',
}

export default function Blog() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Blog</h1>
      <p className="mb-10" style={{ color: 'var(--text-muted)' }}>
        Forex education, strategy guides, and platform updates.
      </p>

      <div className="flex flex-col gap-5">
        {posts.map(post => {
          const catColor = categoryColors[post.category] || 'var(--text-muted)'
          return (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              className="card hover:border-[var(--accent)] transition-colors block"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{ color: catColor, background: `color-mix(in srgb, ${catColor} 15%, transparent)` }}>
                  {post.category}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{post.readTime} read</span>
                <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                  {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <h2 className="font-semibold text-base mb-1.5">{post.title}</h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{post.excerpt}</p>
              <div className="mt-3 text-sm font-medium" style={{ color: 'var(--accent)' }}>Read more →</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
