import axios from 'axios'

const api = axios.create({
  baseURL: '/',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

export const getSignals = (pair) => api.get('/api/forex/signals', { params: { pair } }).then(r => r.data)
export const getPairs = () => api.get('/api/forex/pairs').then(r => r.data)
export const getTechnical = (pair) => api.get('/api/forex/technical', { params: { pair } }).then(r => r.data)
export const getVolatile = (timeframe = '24h') => api.get('/api/forex/volatile', { params: { timeframe } }).then(r => r.data)
export const getReversals = () => api.get('/api/forex/reversals').then(r => r.data)
export const getFvgScanner = () => api.get('/api/forex/fvg-scanner').then(r => r.data)
export const getSrBreakouts = () => api.get('/api/forex/sr-breakouts').then(r => r.data)
export const getPatternScanner = () => api.get('/api/forex/pattern-scanner').then(r => r.data)
export const getNews = () => api.get('/api/forex/news').then(r => r.data)
export const subscribe = (email) => api.post('/api/forex/subscribe', { email }).then(r => r.data)
export const getAdminStats = () => api.get('/api/admin/stats').then(r => r.data)
export const getAds = () => api.get('/api/admin/ads').then(r => r.data)
export const createAd = (formData) => api.post('/api/admin/ads', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
export const deleteAd = (id) => api.delete(`/api/admin/ads/${id}`).then(r => r.data)
export const toggleAd = (id) => api.patch(`/api/admin/ads/${id}`).then(r => r.data)
export const getActiveAds = () => api.get('/api/ads/active').then(r => r.data)
export const login = (username, password) => api.post('/api/auth/login', { username, password }).then(r => r.data)
export const logout = () => api.post('/api/auth/logout').then(r => r.data)
export const getMe = () => api.get('/api/auth/me').then(r => r.data)

export default api
