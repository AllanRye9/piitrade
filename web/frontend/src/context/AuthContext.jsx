import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { login as apiLogin, logout as apiLogout, getMe } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const loginFn = useCallback(async (username, password) => {
    const data = await apiLogin(username, password)
    const me = await getMe()
    setUser(me)
    return data
  }, [])

  const logoutFn = useCallback(async () => {
    await apiLogout()
    setUser(null)
  }, [])

  const isAdmin = user?.role === 'admin' || user?.is_admin === true

  return (
    <AuthContext.Provider value={{ user, loading, login: loginFn, logout: logoutFn, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default AuthContext
