import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from './Navbar'
import Footer from './Footer'
import AdBanner from './AdBanner'
import SideAdCard from './SideAdCard'
import { useAds } from '../../hooks/useAds'

export default function Layout({ children }) {
  const location = useLocation()
  const { ads } = useAds()

  const leftAd = ads.find((a) => a.placement === 'sidebar-left' && a.active)
  const rightAd = ads.find((a) => a.placement === 'sidebar-right' && a.active)

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      <Navbar />

      {/* Mobile top ad banner (visible only below lg) */}
      <div className="lg:hidden mt-16 px-3 pt-2">
        <AdBanner placement="banner-top" ads={ads} />
      </div>

      {/* Three-column body */}
      <div className="flex flex-1 w-full">
        {/* Left ad margin – 4.5% on desktop, hidden on tablet/mobile */}
        <aside
          className="hidden lg:block flex-shrink-0"
          style={{ width: '4.5%' }}
          aria-label="Left advertisement"
        >
          <div className="sticky top-20 px-1 pt-4">
            <SideAdCard side="left" ad={leftAd} />
          </div>
        </aside>

        {/* Main content – 91% on desktop, full width on mobile */}
        <main className="flex-1 min-w-0 pt-16 lg:pt-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Right ad margin – 4.5% on desktop, hidden on tablet/mobile */}
        <aside
          className="hidden lg:block flex-shrink-0"
          style={{ width: '4.5%' }}
          aria-label="Right advertisement"
        >
          <div className="sticky top-20 px-1 pt-4">
            <SideAdCard side="right" ad={rightAd} />
          </div>
        </aside>
      </div>

      {/* Mobile bottom ad banner (visible only below lg) */}
      <div className="lg:hidden px-3 pb-2">
        <AdBanner placement="banner-bottom" ads={ads} />
      </div>

      <Footer />
    </div>
  )
}
