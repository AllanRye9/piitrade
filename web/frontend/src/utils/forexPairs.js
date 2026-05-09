const WHITESPACE_PATTERN = /\s+/g
const SIX_LETTER_PAIR_PATTERN = /^[A-Z]{6}$/

export const ALL_FOREX_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  'EUR/GBP', 'EUR/JPY', 'EUR/AUD', 'EUR/CAD', 'EUR/CHF', 'EUR/NZD',
  'GBP/JPY', 'GBP/CHF', 'GBP/AUD', 'GBP/CAD', 'GBP/NZD',
  'AUD/JPY', 'AUD/CAD', 'AUD/CHF', 'AUD/NZD',
  'NZD/JPY', 'NZD/CAD', 'NZD/CHF',
  'CAD/JPY', 'CHF/JPY',
  'USD/MXN', 'USD/NOK', 'USD/SEK', 'USD/SGD', 'USD/HKD', 'USD/TRY', 'USD/ZAR', 'USD/CNY',
]

export function normalizeTradingPairInput(value) {
  const cleaned = value.trim().toUpperCase().replace(WHITESPACE_PATTERN, '').replace(/-/g, '/')
  if (SIX_LETTER_PAIR_PATTERN.test(cleaned)) {
    return `${cleaned.slice(0, 3)}/${cleaned.slice(3)}`
  }
  return cleaned
}
