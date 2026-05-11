import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import 'forex_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Text('📈', style: TextStyle(fontSize: 22)),
            SizedBox(width: 8),
            Text('PiiTrade',
                style: TextStyle(
                    color: PiiColors.accent,
                    fontWeight: FontWeight.bold,
                    fontSize: 18)),
          ],
        ),
      ),
      body: const HomeBody(),
    );
  }
}

/// The scrollable home page content — separated so MainShell can embed it
/// in a custom Scaffold with auth-aware AppBar actions.
class HomeBody extends StatelessWidget {
  const HomeBody({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Live badge
            Center(
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: PiiColors.accent.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                  border:
                      Border.all(color: PiiColors.accent.withOpacity(0.4)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: PiiColors.buy,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                              color: PiiColors.buy.withOpacity(0.5),
                              blurRadius: 4)
                        ],
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Text('Live AI Signals Active',
                        style: TextStyle(
                            color: PiiColors.accent,
                            fontSize: 12,
                            fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Hero
            const Text(
              'Free AI Forex Signals\nfor Every Trader',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: PiiColors.text,
                fontSize: 26,
                fontWeight: FontWeight.bold,
                height: 1.25,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'LightGBM machine learning model trained on 10+ years of data, '
              'analyzing 40+ technical indicators across 35+ currency pairs — completely free.',
              textAlign: TextAlign.center,
              style: TextStyle(color: PiiColors.textMuted, fontSize: 14, height: 1.5),
            ),
            const SizedBox(height: 20),

            // CTA buttons
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const ForexScreen())),
                    child: const Text('Open Dashboard →'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: PiiColors.textMuted,
                      side: const BorderSide(color: PiiColors.border),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const MethodologyScreen())),
                    child: const Text('How It Works'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Stats
            _StatsBar(),
            const SizedBox(height: 24),

            // Feature cards
            const Text('Everything You Need to Trade Smarter',
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: PiiColors.text,
                    fontSize: 18,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            ..._features.map((f) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _FeatureCard(
                      icon: f['icon']!,
                      title: f['title']!,
                      desc: f['desc']!),
                )),
            const SizedBox(height: 24),

            // How it helps
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('How this helps traders in practice',
                      style: TextStyle(
                          color: PiiColors.text,
                          fontWeight: FontWeight.bold,
                          fontSize: 16)),
                  const SizedBox(height: 12),
                  ..._practices.map((p) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(p['title']!,
                                style: const TextStyle(
                                    color: PiiColors.text,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14)),
                            const SizedBox(height: 4),
                            Text(p['desc']!,
                                style: const TextStyle(
                                    color: PiiColors.textMuted,
                                    fontSize: 13,
                                    height: 1.4)),
                          ],
                        ),
                      )),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Final CTA
            SectionCard(
              child: Column(
                children: [
                  const Text('Start Trading with AI Signals Today',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          color: PiiColors.text,
                          fontWeight: FontWeight.bold,
                          fontSize: 18)),
                  const SizedBox(height: 8),
                  const Text(
                    'No subscription required. Access all signals, scanners, and analysis tools for free.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: PiiColors.textMuted, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const ForexScreen())),
                    child: const Text('Launch Dashboard →'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _StatsBar extends StatelessWidget {
  static const _stats = [
    {'label': 'Currency Pairs', 'value': '35+'},
    {'label': 'ML Accuracy (30d)', 'value': '~68%'},
    {'label': 'Training Years', 'value': '10+'},
    {'label': 'Indicators Used', 'value': '40+'},
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      decoration: BoxDecoration(
        color: PiiColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: PiiColors.border),
      ),
      child: Row(
        children: _stats
            .map((s) => Expanded(
                  child: Column(
                    children: [
                      Text(s['value']!,
                          style: const TextStyle(
                              color: PiiColors.accent,
                              fontWeight: FontWeight.bold,
                              fontSize: 18)),
                      const SizedBox(height: 2),
                      Text(s['label']!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                              color: PiiColors.textMuted, fontSize: 10)),
                    ],
                  ),
                ))
            .toList(),
      ),
    );
  }
}

class _FeatureCard extends StatelessWidget {
  final String icon;
  final String title;
  final String desc;
  const _FeatureCard(
      {required this.icon, required this.title, required this.desc});

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(icon, style: const TextStyle(fontSize: 26)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        color: PiiColors.text,
                        fontWeight: FontWeight.w600,
                        fontSize: 14)),
                const SizedBox(height: 4),
                Text(desc,
                    style: const TextStyle(
                        color: PiiColors.textMuted,
                        fontSize: 13,
                        height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

const _features = [
  {
    'icon': '🤖',
    'title': 'AI Signals',
    'desc':
        'LightGBM ML model generating BUY/SELL/HOLD signals with confidence scores for 35+ pairs.',
  },
  {
    'icon': '📊',
    'title': 'FVG Scanner',
    'desc':
        'Fair Value Gap detection — spot approaching, reached, passed, and rejected FVG zones.',
  },
  {
    'icon': '📐',
    'title': 'S&R Analysis',
    'desc':
        'Dynamic support and resistance breakout detection with level strength scoring.',
  },
  {
    'icon': '📰',
    'title': 'Market News',
    'desc':
        'Real-time forex news with sentiment analysis tagged to relevant currency pairs.',
  },
  {
    'icon': '🔍',
    'title': 'Pattern Scanner',
    'desc':
        'Multi-timeframe chart pattern recognition including engulfing, doji, hammer, and more.',
  },
  {
    'icon': '🌡️',
    'title': 'Volatility Rankings',
    'desc':
        'Rank pairs by 1h/4h/24h volatility and spot reversal opportunities instantly.',
  },
];

const _practices = [
  {
    'title': '1) Build a daily routine',
    'desc':
        'Start with high-volatility pairs, confirm structure, then validate entries with risk limits.',
  },
  {
    'title': '2) Reduce emotional trading',
    'desc':
        'Use objective data points (signal confidence, S/R, FVG state) instead of impulsive entries.',
  },
  {
    'title': '3) Review and improve',
    'desc':
        'Compare outcomes over time and refine position sizing instead of chasing every market move.',
  },
];

// Placeholder for methodology screen imported in HomeScreen
class MethodologyScreen extends StatelessWidget {
  const MethodologyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Methodology')),
      body: const SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('How PiiTrade Works',
                style: TextStyle(
                    color: PiiColors.text,
                    fontSize: 22,
                    fontWeight: FontWeight.bold)),
            SizedBox(height: 16),
            _MethodologySection(
              title: '🤖 Machine Learning Model',
              body:
                  'PiiTrade uses a LightGBM gradient boosting model trained on over 10 years of historical '
                  'forex data. The model learns from 40+ technical indicators including RSI, MACD, Bollinger '
                  'Bands, ATR, stochastic oscillator, moving averages, and volume patterns.',
            ),
            SizedBox(height: 16),
            _MethodologySection(
              title: '📊 Signal Generation',
              body:
                  'Each signal includes a direction (BUY/SELL/HOLD), a confidence score (0–100%), '
                  'and auto-calculated entry, take profit, and stop loss levels based on recent '
                  'support/resistance and volatility.',
            ),
            SizedBox(height: 16),
            _MethodologySection(
              title: '📐 Technical Overlays',
              body:
                  'On top of AI signals, PiiTrade provides Fair Value Gap (FVG) detection, '
                  'Support/Resistance breakout alerts, Break of Structure (BOS), Change of Character '
                  '(CHoCH), and multi-timeframe chart pattern recognition.',
            ),
            SizedBox(height: 16),
            _MethodologySection(
              title: '⚠️ Important Disclaimer',
              body:
                  'All signals are for educational and informational purposes only. PiiTrade does not '
                  'provide financial advice. Past model accuracy does not guarantee future results. '
                  'Always manage your risk and never trade with money you cannot afford to lose.',
            ),
          ],
        ),
      ),
    );
  }
}

class _MethodologySection extends StatelessWidget {
  final String title;
  final String body;
  const _MethodologySection({required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  color: PiiColors.text,
                  fontWeight: FontWeight.bold,
                  fontSize: 15)),
          const SizedBox(height: 8),
          Text(body,
              style: const TextStyle(
                  color: PiiColors.textMuted, fontSize: 13, height: 1.5)),
        ],
      ),
    );
  }
}
