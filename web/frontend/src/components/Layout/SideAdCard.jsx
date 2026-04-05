import { ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'

const defaults = {
  left: {
    label: 'TapTap',
    headline: 'TapTap – Discover Great Games',
    description: 'Find and share amazing mobile games with a global community.',
    cta: 'Learn More',
    href: 'https://www.taptap.io/',
    bgClass: 'bg-[#2A1F0E] border-[#5C3D11]',
    btnClass: 'bg-amber-600 hover:bg-amber-500 text-white',
    glowClass: '0 0 18px rgba(180,100,20,0.35)',
    glowHoverClass: '0 0 28px rgba(220,130,30,0.55)',
    iconBg: 'bg-amber-700/40',
    initial: { opacity: 0, x: -20 },
  },
  right: {
    label: 'Exness',
    headline: 'Exness – Trade Smarter',
    description: 'Forex, metals, and more with ultra-low spreads.',
    cta: 'Open Account',
    href: 'https://www.exness.com/',
    bgClass: 'bg-[#0F212E] border-[#0D3349]',
    btnClass: 'bg-sky-600 hover:bg-sky-500 text-white',
    glowClass: '0 0 18px rgba(20,100,180,0.35)',
    glowHoverClass: '0 0 28px rgba(30,140,230,0.55)',
    iconBg: 'bg-sky-800/40',
    initial: { opacity: 0, x: 20 },
  },
}

export default function SideAdCard({ side = 'left', ad }) {
  const d = defaults[side]

  const href = ad?.link_url || d.href
  const headline = ad?.title || d.headline
  const description = ad?.description || d.description
  const cta = ad?.cta || ad?.button_text || d.cta
  const imageUrl = ad?.image_url || null

  return (
    <motion.div
      initial={d.initial}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      whileHover={{ scale: 1.04 }}
      className={`relative rounded-2xl border overflow-hidden cursor-pointer select-none ${d.bgClass}`}
      style={{
        boxShadow: d.glowClass,
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = d.glowHoverClass
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = d.glowClass
      }}
    >
      <span className="absolute top-2 left-3 text-[9px] text-white/40 uppercase tracking-widest z-10">
        Ad
      </span>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-3 p-3 pt-7 pb-4 text-center no-underline"
        aria-label={`Advertisement: ${headline}`}
      >
        {/* Icon / image */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden ${d.iconBg}`}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={d.label}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-lg font-bold text-white/80">{d.label.charAt(0)}</span>
          )}
        </div>

        {/* Headline */}
        <p className="text-white/90 font-semibold text-[11px] leading-tight">{headline}</p>

        {/* Description */}
        <p className="text-white/50 text-[10px] leading-snug">{description}</p>

        {/* CTA */}
        <span
          className={`mt-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${d.btnClass}`}
        >
          {cta}
          <ExternalLink size={9} />
        </span>
      </a>
    </motion.div>
  )
}
