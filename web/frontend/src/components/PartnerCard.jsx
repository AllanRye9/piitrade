import { ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'

const PARTNERS = [
  {
    id: 'taptap',
    name: 'TapTap',
    tagline: 'Discover Great Games',
    description: 'Join millions of gamers on TapTap — find, share, and review the hottest mobile games from around the world. Independent, honest, and community-driven.',
    cta: 'Explore Games',
    href: 'https://www.taptap.io/',
    accentColor: '#f59e0b',
    accentBg: 'rgba(245,158,11,0.1)',
    accentBorder: 'rgba(245,158,11,0.25)',
    icon: '🎮',
  },
  {
    id: 'exness',
    name: 'Exness',
    tagline: 'Trade Smarter',
    description: 'Trade forex, metals, crypto, and stocks with ultra-low spreads and instant withdrawals. Trusted by millions of traders in 190+ countries worldwide.',
    cta: 'Open Account',
    href: 'https://www.exness.com/',
    accentColor: '#38bdf8',
    accentBg: 'rgba(56,189,248,0.1)',
    accentBorder: 'rgba(56,189,248,0.25)',
    icon: '📈',
  },
]

function PartnerCardItem({ partner }) {
  return (
    <motion.a
      href={partner.href}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group flex flex-col gap-3 p-5 rounded-2xl border bg-bg-card transition-all duration-200 hover:shadow-lg no-underline"
      style={{
        borderColor: partner.accentBorder,
        background: `linear-gradient(135deg, ${partner.accentBg} 0%, transparent 60%)`,
      }}
    >
      {/* Sponsor label */}
      <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">Partner</span>

      {/* Icon + Name */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: partner.accentBg, border: `1px solid ${partner.accentBorder}` }}
        >
          {partner.icon}
        </div>
        <div>
          <p className="text-text-primary font-bold text-base leading-tight">{partner.name}</p>
          <p className="text-xs font-medium" style={{ color: partner.accentColor }}>{partner.tagline}</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-text-secondary text-sm leading-relaxed">{partner.description}</p>

      {/* CTA */}
      <div
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white self-start transition-all duration-200 group-hover:gap-2.5"
        style={{ background: partner.accentColor }}
      >
        {partner.cta}
        <ExternalLink size={13} />
      </div>
    </motion.a>
  )
}

export default function PartnerCards({ className = '' }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${className}`}>
      {PARTNERS.map((p) => (
        <PartnerCardItem key={p.id} partner={p} />
      ))}
    </div>
  )
}
