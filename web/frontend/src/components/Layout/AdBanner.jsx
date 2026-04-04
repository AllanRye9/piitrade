import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink } from 'lucide-react'

const sizeMap = {
  'banner-top': 'w-full h-16 sm:h-20',
  'banner-bottom': 'w-full h-16 sm:h-20',
  sidebar: 'w-full h-64',
  inline: 'w-full h-24 sm:h-32',
}

export default function AdBanner({ placement, ads = [] }) {
  const [dismissed, setDismissed] = useState(false)

  const filtered = ads.filter((a) => a.placement === placement && a.active)
  if (!filtered.length || dismissed) return null

  const ad = filtered[0]

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
          className={`relative ${sizeMap[placement] || 'w-full h-20'} rounded-xl overflow-hidden bg-bg-card border border-border-default group`}
        >
          <span className="absolute top-1 left-2 text-[10px] text-text-muted z-10 tracking-widest uppercase">
            Advertisement
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-1 right-2 z-10 text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={12} />
          </button>
          <a
            href={ad.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full h-full"
          >
            {ad.image_url ? (
              <img
                src={ad.image_url}
                alt={ad.title || 'Advertisement'}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center gap-2 text-text-secondary hover:text-accent-blue transition-colors">
                <ExternalLink size={14} />
                <span className="text-sm">{ad.title || 'Sponsored'}</span>
              </div>
            )}
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
