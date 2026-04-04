import { useState, useEffect } from 'react'
import { getActiveAds } from '../utils/api'

export function useAds() {
  const [ads, setAds] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getActiveAds()
      .then(setAds)
      .catch(() => setAds([]))
      .finally(() => setLoading(false))
  }, [])

  return { ads, loading }
}

export default useAds
