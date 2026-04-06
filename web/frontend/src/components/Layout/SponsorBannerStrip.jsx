import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'

const BANNERS = [
  { id: 'b1', src: '/img/exness.png',  alt: 'Exness — Trade Smarter',    href: 'https://www.exness.com/' },
  { id: 'b2', src: '/img/exness2.png', alt: 'Exness — Ultra-Low Spreads', href: 'https://www.exness.com/' },
  { id: 'b3', src: '/img/exness3.png', alt: 'Exness — Open Your Account', href: 'https://www.exness.com/' },
]

const CAROUSEL_INTERVAL = 4500
const TAP_GLOW_DURATION_MS = 400 // keep in sync with tapping transition duration (0.4s)

// Glow shadow values — warm golden tone
const GLOW_NONE  = '0 2px 10px rgba(0,0,0,0.35)'
const GLOW_LOW   = '0 0 4px rgba(255,183,0,0.12), 0 2px 10px rgba(0,0,0,0.35)'
const GLOW_HIGH  = '0 0 16px rgba(255,183,0,0.75), 0 0 32px rgba(255,200,50,0.4), 0 2px 10px rgba(0,0,0,0.35)'
const GLOW_HOVER = '0 0 22px rgba(255,235,100,0.95), 0 0 48px rgba(255,210,50,0.55), 0 2px 10px rgba(0,0,0,0.4)'

/**
 * Individual banner card — handles its own glow animation state.
 * loaded: null = pending, true = success, false = error
 */
function BannerCard({ banner, glowIndex, loaded, onLoad, onError, className }) {
  const [hovered, setHovered] = useState(false)
  const [tapping, setTapping] = useState(false)
  const tapTimerRef = useRef(null)

  const handleTouchStart = () => {
    clearTimeout(tapTimerRef.current)
    setTapping(true)
    tapTimerRef.current = setTimeout(() => setTapping(false), TAP_GLOW_DURATION_MS)
  }

  useEffect(() => () => clearTimeout(tapTimerRef.current), [])

  // Build the Framer Motion animate target
  const glowAnimate = (() => {
    if (!loaded) return { boxShadow: GLOW_NONE }
    if (tapping)  return { boxShadow: [GLOW_HOVER, GLOW_LOW] }
    if (hovered)  return { boxShadow: GLOW_HOVER }
    return { boxShadow: [GLOW_LOW, GLOW_HIGH, GLOW_LOW] }
  })()

  const glowTransition = (() => {
    if (!loaded)  return { duration: 0 }
    if (tapping)  return { duration: 0.4, ease: 'easeOut' }
    if (hovered)  return { duration: 0.2, ease: 'easeOut' }
    return {
      boxShadow: {
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: glowIndex * 0.5,
        repeatDelay: 0,
        times: [0, 0.5, 1],
      },
    }
  })()

  if (loaded === false) return null

  return (
    <motion.a
      href={banner.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`relative rounded-lg overflow-hidden cursor-pointer ${className}`}
      style={{ flexShrink: 0 }}
      aria-label={banner.alt}
      title={banner.alt}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onTouchStart={handleTouchStart}
      initial={{ boxShadow: GLOW_NONE }}
      animate={glowAnimate}
      transition={glowTransition}
    >
      {/* Skeleton placeholder while image loads */}
      {loaded === null && (
        <div className="absolute inset-0 skeleton" />
      )}
      <img
        src={banner.src}
        alt={banner.alt}
        className={`h-full w-full object-cover transition-opacity duration-300 ${loaded === true ? 'opacity-100' : 'opacity-0'}`}
        onLoad={onLoad}
        onError={onError}
        draggable="false"
        loading="eager"
      />
    </motion.a>
  )
}

export default function SponsorBannerStrip() {
  // null = loading, true = loaded, false = error
  const [loadedMap, setLoadedMap] = useState(() =>
    Object.fromEntries(BANNERS.map(b => [b.id, null]))
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const intervalRef = useRef(null)
  const touchStartX = useRef(null)

  const handleLoad  = useCallback((id) => setLoadedMap(prev => ({ ...prev, [id]: true })),  [])
  const handleError = useCallback((id) => setLoadedMap(prev => ({ ...prev, [id]: false })), [])

  // Only banners that haven't errored
  const visibleBanners = BANNERS.filter(b => loadedMap[b.id] !== false)
  const visibleLengthRef = useRef(visibleBanners.length)
  visibleLengthRef.current = visibleBanners.length

  const safeIndex = visibleBanners.length > 0
    ? Math.min(activeIndex, visibleBanners.length - 1)
    : 0

  // Restart the auto-advance interval
  const resetInterval = useCallback(() => {
    clearInterval(intervalRef.current)
    if (visibleLengthRef.current > 1) {
      intervalRef.current = setInterval(() => {
        // Read length from ref to avoid stale closure when banners error out
        setActiveIndex(prev => (prev + 1) % visibleLengthRef.current)
      }, CAROUSEL_INTERVAL)
    }
  }, [])

  useEffect(() => {
    resetInterval()
    return () => clearInterval(intervalRef.current)
  }, [resetInterval, visibleBanners.length])

  const goTo = useCallback((idx) => {
    setActiveIndex(idx)
    resetInterval()
  }, [resetInterval])

  // Helper: advance carousel index by ±1 with wrap-around
  const getAdjacentIndex = (current, direction) => {
    const len = visibleLengthRef.current
    return direction === 'next'
      ? (current + 1) % len
      : (current - 1 + len) % len
  }

  // Touch swipe handlers (mobile carousel)
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) {
      goTo(getAdjacentIndex(safeIndex, diff > 0 ? 'next' : 'prev'))
    }
    touchStartX.current = null
  }

  if (visibleBanners.length === 0) return null

  return (
    <div className="w-full bg-bg-secondary/50 border-b border-border-subtle">

      {/* ── Desktop (sm+): all three banners side by side ── */}
      <div className="hidden sm:flex gap-3 px-4 py-2">
        {BANNERS.map((banner, i) => (
          <BannerCard
            key={banner.id}
            banner={banner}
            glowIndex={i}
            loaded={loadedMap[banner.id]}
            onLoad={() => handleLoad(banner.id)}
            onError={() => handleError(banner.id)}
            className="flex-1 min-w-0 h-[62px]"
          />
        ))}
      </div>

      {/* ── Mobile (<sm): single-item carousel ── */}
      <div
        className="sm:hidden px-4 pt-2 pb-3"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Slide container */}
        <div className="relative h-[62px]">
          {visibleBanners.map((banner, i) => (
            <BannerCard
              key={banner.id}
              banner={banner}
              glowIndex={i}
              loaded={loadedMap[banner.id]}
              onLoad={() => handleLoad(banner.id)}
              onError={() => handleError(banner.id)}
              className={`absolute inset-0 transition-opacity duration-500 ${
                i === safeIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            />
          ))}
        </div>

        {/* Dot indicators */}
        {visibleBanners.length > 1 && (
          <div className="flex items-center justify-center gap-2 mt-2">
            {visibleBanners.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-200 ${
                  i === safeIndex
                    ? 'w-5 h-1.5 bg-accent-yellow'
                    : 'w-1.5 h-1.5 bg-text-muted hover:bg-text-secondary'
                }`}
                aria-label={`Go to banner ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
