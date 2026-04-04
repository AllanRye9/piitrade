import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from './Navbar'
import Footer from './Footer'
import AdBanner from './AdBanner'
import { useAds } from '../../hooks/useAds'

export default function Layout({ children }) {
  const location = useLocation()
  const { ads } = useAds()

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      <Navbar />

      {/* Top ad banner */}
      <div className="fixed top-16 left-0 right-0 z-40 px-4 max-w-7xl mx-auto w-full pointer-events-none">
        <div className="pointer-events-auto">
          <AdBanner placement="banner-top" ads={ads} />
        </div>
      </div>

      <main className="flex-1 pt-16">
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

      <Footer />
    </div>
  )
}
