import { useState, useEffect, useCallback } from 'react'
import { getSignals } from '../utils/api'

export function useSignals(pair) {
  const [signal, setSignal] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchSignal = useCallback(async () => {
    if (!pair) return
    setLoading(true)
    setError(null)
    try {
      const data = await getSignals(pair)
      setSignal(data)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to fetch signal')
    } finally {
      setLoading(false)
    }
  }, [pair])

  useEffect(() => {
    fetchSignal()
  }, [fetchSignal])

  return { signal, loading, error, refetch: fetchSignal }
}

export default useSignals
