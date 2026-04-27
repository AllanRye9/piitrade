import { useParams, Link } from 'react-router-dom'

const articles = {
  'what-is-fvg-trading': {
    title: 'What is Fair Value Gap (FVG) Trading?',
    date: '2024-11-15',
    category: 'Education',
    readTime: '5 min',
    content: `
Fair Value Gaps (FVGs) are price imbalances that occur when price moves so quickly that it leaves a "gap" between consecutive candles. These gaps represent areas where institutional orders were filled rapidly, leaving an imbalance in the market.

## How FVGs Form

An FVG forms when:
1. Candle 1 has a high
2. Candle 3 has a low
3. There is no overlap between candle 1's high and candle 3's low (the gap is candle 2's range)

This gap represents an area of **price inefficiency** that the market tends to return to and fill.

## Bullish vs Bearish FVGs

**Bullish FVG**: Forms during a rapid downward move. Price is expected to return upward into this zone.

**Bearish FVG**: Forms during a rapid upward move. Price is expected to return downward into this zone.

## How PiiTrade Uses FVGs

Our FVG Scanner categorizes gaps into four states:
- **Approaching**: Price is moving toward the FVG zone
- **Reached**: Price has entered the FVG zone
- **Passed**: Price has moved through the zone
- **Rejected**: Price entered but was rejected at the zone

## Trading FVGs

When price returns to an FVG zone, traders look for:
1. Confirmation candlestick patterns
2. Confluence with support/resistance levels
3. Volume confirmation
4. Alignment with higher timeframe trend

Always use proper risk management with stop-loss orders placed beyond the FVG zone.
    `,
  },
  'lightgbm-forex-signals': {
    title: 'How LightGBM Powers Our Forex Signals',
    date: '2024-11-08',
    category: 'Technology',
    readTime: '7 min',
    content: `
LightGBM (Light Gradient Boosting Machine) is a high-performance gradient boosting framework developed by Microsoft. It's designed for efficiency, speed, and high accuracy — making it ideal for forex signal generation.

## Why LightGBM for Forex?

Forex prediction is challenging due to:
- Non-linear relationships between indicators
- High noise-to-signal ratio
- Changing market regimes
- Large feature sets (40+ indicators)

LightGBM handles all of these through its **leaf-wise tree growth** algorithm, which finds the best split at each step rather than growing level-wise.

## Our Feature Set

We compute 40+ technical indicators as input features:
- Trend indicators: EMA-20, EMA-50, EMA-200, Ichimoku
- Momentum: RSI, MACD, Stochastic, Williams %R
- Volatility: ATR, Bollinger Bands, Keltner Channels
- Volume: OBV, MFI, VWAP

## Model Output

The model outputs three classes:
- **BUY** (Class 1): Probability of upward price movement
- **SELL** (Class 2): Probability of downward price movement  
- **HOLD** (Class 0): Insufficient directional conviction

The confidence score is the maximum class probability, giving traders insight into signal strength.

## Important Limitations

No ML model is perfect. Markets are influenced by unforeseen events, central bank decisions, and geopolitical factors that no technical model can predict. Always verify signals with your own analysis.
    `,
  },
  'support-resistance-breakouts': {
    title: 'Trading Support & Resistance Breakouts',
    date: '2024-10-28',
    category: 'Strategy',
    readTime: '6 min',
    content: `
Support and resistance levels are price zones where buying or selling pressure has historically been strong enough to halt or reverse price movement. Breakout trading involves entering positions when price decisively moves through these key levels.

## Identifying Key Levels

Strong support and resistance levels are characterized by:
- **Multiple touches**: Levels tested 3+ times are more significant
- **Volume**: High volume at level confirms institutional interest
- **Recency**: More recent levels carry more weight
- **Round numbers**: Psychological levels at round numbers attract orders

## Types of Breakouts

**Genuine Breakout**: Price closes decisively beyond the level with increased volume. This signals a potential trend continuation.

**False Breakout (Fakeout)**: Price temporarily breaches the level but quickly reverses. This can be traded by entering in the original direction after the fakeout.

## PiiTrade S/R Breakout Categories

Our scanner monitors three stages:
1. **Soon Touching**: Price approaching within 0.1% of level
2. **Touched**: Price has tested the level within current session
3. **Broke**: Price has closed beyond the level

## Entry Strategy

For a genuine breakout entry:
1. Wait for a close beyond the level (avoid wicks)
2. Look for a retest of the broken level (old resistance becomes support)
3. Enter on the retest with confirmation
4. Place stop-loss beyond the level

Risk/reward ratio should be at least 1:2 for breakout trades.
    `,
  },
  'bos-choch-explained': {
    title: 'BOS and CHoCH: Smart Money Concepts Explained',
    date: '2024-10-20',
    category: 'Education',
    readTime: '8 min',
    content: `
Break of Structure (BOS) and Change of Character (CHoCH) are core concepts from Smart Money Concepts (SMC) trading methodology. They help traders identify where institutions are positioned and when trends are likely to change.

## Market Structure Basics

Price moves in **swings**: higher highs (HH) and higher lows (HL) in an uptrend, or lower highs (LH) and lower lows (LL) in a downtrend.

## Break of Structure (BOS)

A BOS occurs when price breaks a previous swing high (in an uptrend) or swing low (in a downtrend). It **confirms continuation** of the existing trend.

Example (uptrend): Price forms HH1, pulls back to HL1, then breaks above HH1 → BOS confirmed, trend continues upward.

## Change of Character (CHoCH)

A CHoCH signals a **potential trend reversal**. In an uptrend, a CHoCH occurs when price breaks below the most recent higher low, suggesting institutional selling.

Key distinction:
- BOS = trend continuation signal
- CHoCH = early trend reversal warning

## Using BOS/CHoCH in Trading

1. **Identify the trend** using BOS (series of BOS confirms strong trend)
2. **Watch for CHoCH** as early reversal warning
3. **Wait for confirmation** — one CHoCH isn't enough; look for structural change
4. **Combine with FVGs and S/R** for high-confluence entries

## PiiTrade Implementation

Our technical analysis module automatically detects BOS and CHoCH patterns on the H1 and H4 timeframes, displaying them in the Forex Dashboard for each selected pair.
    `,
  },
  'risk-management-forex': {
    title: 'Risk Management: The Most Important Skill in Forex',
    date: '2024-10-12',
    category: 'Risk Management',
    readTime: '6 min',
    content: `
Professional traders don't succeed because they win every trade. They succeed because they manage losses effectively. Risk management is the foundation of sustainable trading.

## The 1% Rule

Never risk more than 1-2% of your trading capital on a single trade. This means if you have a $10,000 account, your maximum loss per trade should be $100-200.

This simple rule ensures you can survive a losing streak of 10+ trades without blowing your account.

## Position Sizing

Position size = (Account Risk) / (Stop Loss in Pips × Pip Value)

Example:
- Account: $10,000
- Risk per trade: 1% = $100
- Stop loss: 20 pips
- EUR/USD pip value: $10/pip (standard lot)
- Position size: $100 / (20 × $10) = 0.05 lots (mini lot)

## Stop-Loss Orders

Always use stop-loss orders. Place them at:
- Beyond the recent swing high/low
- Beyond key support/resistance levels
- Beyond FVG zones you're trading from

Never move your stop-loss to make it wider — this is how small losses become account-destroying losses.

## Risk/Reward Ratio

Only take trades where your potential profit is at least 2x your potential loss (1:2 R/R minimum). This means you can be wrong 40% of the time and still be profitable.

PiiTrade provides Take Profit and Stop Loss levels with each signal, calculated using ATR (Average True Range) to account for market volatility.

## Psychological Discipline

- Never revenge trade after a loss
- Don't increase position size to "make back" losses  
- Take breaks after 3+ consecutive losses
- Journal every trade to identify patterns in your mistakes

No signal — AI-generated or otherwise — removes the need for disciplined risk management.
    `,
  },
}

export default function BlogPost() {
  const { slug } = useParams()
  const article = articles[slug]

  if (!article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <div className="text-4xl mb-4">📄</div>
        <h1 className="text-2xl font-bold mb-2">Article Not Found</h1>
        <p className="mb-6" style={{ color: 'var(--text-muted)' }}>
          This article doesn't exist or may have been moved.
        </p>
        <Link to="/blog" className="px-6 py-2 rounded-lg font-medium text-sm"
          style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
          Back to Blog
        </Link>
      </div>
    )
  }

  const paragraphs = article.content.trim().split('\n\n')

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link to="/blog" className="text-sm mb-6 inline-flex items-center gap-1 hover:text-[var(--accent)] transition-colors"
        style={{ color: 'var(--text-muted)' }}>
        ← Back to Blog
      </Link>

      <div className="mt-4 mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs px-2 py-0.5 rounded font-medium"
            style={{ color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}>
            {article.category}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{article.readTime} read</span>
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
            {new Date(article.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <h1 className="text-3xl font-bold leading-tight">{article.title}</h1>
      </div>

      <div className="flex flex-col gap-4">
        {paragraphs.map((para, i) => {
          if (para.startsWith('## ')) {
            return (
              <h2 key={i} className="text-xl font-bold mt-4" style={{ color: 'var(--text)' }}>
                {para.slice(3)}
              </h2>
            )
          }
          if (para.startsWith('**') && para.endsWith('**')) {
            return (
              <p key={i} className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {para.slice(2, -2)}
              </p>
            )
          }
          if (para.includes('\n- ')) {
            const [intro, ...items] = para.split('\n- ')
            return (
              <div key={i}>
                {intro && <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--text-muted)' }}>{intro}</p>}
                <ul className="flex flex-col gap-1.5">
                  {items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--accent)' }}>•</span>
                      <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text)">$1</strong>') }} />
                    </li>
                  ))}
                </ul>
              </div>
            )
          }
          return (
            <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}
              dangerouslySetInnerHTML={{ __html: para.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text)">$1</strong>') }} />
          )
        })}
      </div>

      <div className="mt-10 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
        <Link to="/blog" className="text-sm hover:text-[var(--accent)] transition-colors"
          style={{ color: 'var(--text-muted)' }}>
          ← Back to all articles
        </Link>
      </div>
    </div>
  )
}
