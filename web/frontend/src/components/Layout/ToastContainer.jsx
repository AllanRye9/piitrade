import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react'

// Toast context for global access
const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

let toastListeners = []
let toastId = 0

export function showToast(message, type = 'info', duration = 3000) {
  const id = ++toastId
  toastListeners.forEach((fn) => fn({ id, message, type, duration }))
  return id
}

const iconMap = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertTriangle,
  info: Info,
}

const colorMap = {
  success: 'border-accent-green/40 bg-accent-green/10',
  warning: 'border-accent-yellow/40 bg-accent-yellow/10',
  error: 'border-accent-red/40 bg-accent-red/10',
  info: 'border-accent-blue/40 bg-accent-blue/10',
}

const iconColorMap = {
  success: 'text-accent-green',
  warning: 'text-accent-yellow',
  error: 'text-accent-red',
  info: 'text-accent-blue',
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((toast) => {
    setToasts((prev) => [...prev.slice(-4), toast])
    if (toast.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, toast.duration)
    }
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    toastListeners.push(addToast)
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== addToast)
    }
  }, [addToast])

  return (
    <div className="fixed top-20 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = iconMap[toast.type] || iconMap.info
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.34, 1.3, 0.55, 1] }}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-lg min-w-[280px] max-w-[380px] ${colorMap[toast.type] || colorMap.info}`}
            >
              <Icon size={16} className={iconColorMap[toast.type] || iconColorMap.info} />
              <span className="text-text-primary text-sm flex-1">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
              >
                <X size={14} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
