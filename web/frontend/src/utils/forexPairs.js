export function normalizeTradingPairInput(value) {
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '/')
  if (/^[A-Z]{6}$/.test(cleaned)) {
    return `${cleaned.slice(0, 3)}/${cleaned.slice(3)}`
  }
  return cleaned
}
