const WHITESPACE_PATTERN = /\s+/g
const SIX_LETTER_PAIR_PATTERN = /^[A-Z]{6}$/

export function normalizeTradingPairInput(value) {
  const cleaned = value.trim().toUpperCase().replace(WHITESPACE_PATTERN, '').replace(/-/g, '/')
  if (SIX_LETTER_PAIR_PATTERN.test(cleaned)) {
    return `${cleaned.slice(0, 3)}/${cleaned.slice(3)}`
  }
  return cleaned
}
