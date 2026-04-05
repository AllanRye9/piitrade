/**
 * Horizontal scrolling price ticker for major Forex pairs.
 * Continuous smooth scroll with CSS animation, pauses on hover.
 * Content is duplicated for seamless loop (PART 5.1).
 */
import { TrendingUp, TrendingDown } from 'lucide-react'

const defaultTickers = [
  { pair: 'EUR/USD', price: '1.0842', change: '+0.12%', up: true },
  { pair: 'GBP/USD', price: '1.2650', change: '-0.08%', up: false },
  { pair: 'USD/JPY', price: '154.82', change: '+0.25%', up: true },
  { pair: 'AUD/USD', price: '0.6541', change: '+0.05%', up: true },
  { pair: 'USD/CAD', price: '1.3590', change: '-0.11%', up: false },
  { pair: 'USD/CHF', price: '0.8925', change: '+0.03%', up: true },
  { pair: 'NZD/USD', price: '0.5980', change: '-0.15%', up: false },
  { pair: 'EUR/GBP', price: '0.8572', change: '+0.07%', up: true },
  { pair: 'GBP/JPY', price: '195.85', change: '-0.20%', up: false },
  { pair: 'EUR/JPY', price: '167.92', change: '+0.18%', up: true },
]

export default function PriceTicker({ data = defaultTickers }) {
  const items = data.length > 0 ? data : defaultTickers

  const renderItem = (item, idx) => (
    <div
      key={`${item.pair}-${idx}`}
      className="flex items-center gap-2 px-4 py-1.5 flex-shrink-0"
    >
      <span className="text-text-secondary text-xs font-medium">{item.pair}</span>
      <span className="text-text-primary text-xs font-mono font-semibold">{item.price}</span>
      <span className={`flex items-center gap-0.5 text-xs font-medium ${item.up ? 'text-accent-green' : 'text-accent-red'}`}>
        {item.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {item.change}
      </span>
    </div>
  )

  return (
    <div className="w-full overflow-hidden bg-bg-card border border-border-default rounded-lg">
      <div className="ticker-track">
        {/* Original items */}
        {items.map((item, i) => renderItem(item, i))}
        {/* Duplicated items for seamless loop */}
        {items.map((item, i) => renderItem(item, `dup-${i}`))}
      </div>
    </div>
  )
}
