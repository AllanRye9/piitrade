import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from './Navbar'
import Footer from './Footer'
import ScrollProgressBar from './ScrollProgressBar'
import BackToTop from './BackToTop'
import ToastContainer from './ToastContainer'

export default function Layout({ children }) {
  const location = useLocation()
  const [pageReady, setPageReady] = useState(false)

  useEffect(() => {
    // Staggered page load: start invisible, then reveal
    const timer = setTimeout(() => setPageReady(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={`min-h-screen flex flex-col bg-bg-primary transition-opacity duration-400 ${pageReady ? 'opacity-100' : 'opacity-0'}`}>
      <ScrollProgressBar />
      <Navbar />

      {/* Main content – full width */}
      <main className="flex-1 min-w-0 pt-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{
              duration: 0.4,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />
      <BackToTop />
      <ToastContainer />
    </div>
  )
}
