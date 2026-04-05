import { useEffect, useRef, useState } from 'react'

/**
 * Hook for scroll-reveal animations using Intersection Observer.
 * Elements animate once when they enter the viewport (PART 10.1).
 *
 * @param {Object} options
 * @param {number} options.threshold - Intersection threshold (default 0.1)
 * @param {string} options.rootMargin - Root margin (default '-50px')
 * @returns {{ ref, isVisible }}
 */
export function useScrollReveal({ threshold = 0.1, rootMargin = '-50px' } = {}) {
  const ref = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(el) // Only animate once
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, rootMargin])

  return { ref, isVisible }
}

export default useScrollReveal
