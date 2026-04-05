import { ExternalLink } from 'lucide-react'

export default function TopAdStrip() {
  return (
    <div className="w-full bg-bg-secondary/80 border-b border-border-subtle overflow-hidden h-7 flex items-center flex-shrink-0">
      <div className="ad-marquee whitespace-nowrap flex items-center gap-8 text-[11px]">
        {/* Duplicate content for seamless loop */}
        {[0, 1].map((copy) => (
          <span key={copy} className="inline-flex items-center gap-8 pr-8">
            {/* TapTap ad */}
            <a
              href="https://www.taptap.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition-colors"
            >
              <span className="font-semibold">🎮 TapTap</span>
              <span className="text-text-muted">— Discover Great Games</span>
              <ExternalLink size={9} className="opacity-50" />
            </a>

            <span className="text-border-default">|</span>

            {/* Exness ad */}
            <a
              href="https://www.exness.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 transition-colors"
            >
              <span className="font-semibold">📈 Exness</span>
              <span className="text-text-muted">— Trade Smarter, Ultra-Low Spreads</span>
              <ExternalLink size={9} className="opacity-50" />
            </a>

            <span className="text-border-default">|</span>

            {/* TapTap repeat */}
            <a
              href="https://www.taptap.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition-colors"
            >
              <span className="font-semibold">🎮 TapTap</span>
              <span className="text-text-muted">— Play, Share, Discover</span>
              <ExternalLink size={9} className="opacity-50" />
            </a>

            <span className="text-border-default">|</span>

            {/* Exness repeat */}
            <a
              href="https://www.exness.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 transition-colors"
            >
              <span className="font-semibold">📈 Exness</span>
              <span className="text-text-muted">— Open Your Trading Account</span>
              <ExternalLink size={9} className="opacity-50" />
            </a>
          </span>
        ))}
      </div>
    </div>
  )
}
