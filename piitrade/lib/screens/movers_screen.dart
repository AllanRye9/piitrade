import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../widgets/common_widgets.dart';

class MoversScreen extends StatefulWidget {
  const MoversScreen({super.key});

  @override
  State<MoversScreen> createState() => _MoversScreenState();
}

class _MoversScreenState extends State<MoversScreen> {
  Map<String, dynamic>? _volData;
  Map<String, dynamic>? _reversalsData;
  bool _loadingVol = true;
  bool _loadingRev = true;
  String? _volError;
  String? _revError;
  String _timeframe = '24h';

  @override
  void initState() {
    super.initState();
    _loadVolatility();
    _loadReversals();
  }

  Future<void> _loadVolatility([String? tf]) async {
    final timeframe = tf ?? _timeframe;
    setState(() {
      _loadingVol = true;
      _volError = null;
    });
    try {
      final data = await ApiService.getVolatile(timeframe);
      if (mounted) setState(() => _volData = data);
    } on DioException catch (e) {
      if (mounted) setState(() => _volError = e.message ?? 'Failed to load');
    } finally {
      if (mounted) setState(() => _loadingVol = false);
    }
  }

  Future<void> _loadReversals() async {
    setState(() {
      _loadingRev = true;
      _revError = null;
    });
    try {
      final data = await ApiService.getReversals();
      if (mounted) setState(() => _reversalsData = data);
    } on DioException catch (e) {
      if (mounted) setState(() => _revError = e.message ?? 'Failed to load');
    } finally {
      if (mounted) setState(() => _loadingRev = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pairs =
        (_volData?['pairs'] as List<dynamic>? ?? []);
    final reversals =
        (_reversalsData?['pairs'] as List<dynamic>? ?? []);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Market Movers'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: PiiColors.accent),
            onPressed: () {
              _loadVolatility();
              _loadReversals();
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: PiiColors.accent,
        backgroundColor: PiiColors.surface,
        onRefresh: () async {
          await Future.wait([_loadVolatility(), _loadReversals()]);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Volatile pairs
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Row(
                            children: [
                              const Text('🌡️ Volatile Pairs',
                                  style: TextStyle(
                                      color: PiiColors.text,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 16)),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                    color: PiiColors.border,
                                    borderRadius: BorderRadius.circular(6)),
                                child: Text('${pairs.length} pairs',
                                    style: const TextStyle(
                                        color: PiiColors.textMuted,
                                        fontSize: 11)),
                              ),
                            ],
                          ),
                        ),
                        // Timeframe buttons
                        ...['1h', '4h', '24h'].map((tf) => Padding(
                              padding: const EdgeInsets.only(left: 6),
                              child: GestureDetector(
                                onTap: () {
                                  setState(() => _timeframe = tf);
                                  _loadVolatility(tf);
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: tf == _timeframe
                                        ? PiiColors.accent.withOpacity(0.15)
                                        : Colors.transparent,
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(
                                        color: tf == _timeframe
                                            ? PiiColors.accent
                                            : PiiColors.border),
                                  ),
                                  child: Text(tf,
                                      style: TextStyle(
                                          color: tf == _timeframe
                                              ? PiiColors.accent
                                              : PiiColors.textMuted,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500)),
                                ),
                              ),
                            )),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (_loadingVol)
                      const PiiLoading()
                    else if (_volError != null)
                      PiiError(message: _volError!, onRetry: _loadVolatility)
                    else if (pairs.isEmpty)
                      const Text('No data',
                          style: TextStyle(
                              color: PiiColors.textMuted, fontSize: 13))
                    else
                      Column(
                        children: pairs.map((p) {
                          final vol = (p['volatility_pct'] as num?)?.toDouble() ?? 0;
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            child: Column(
                              children: [
                                Row(
                                  children: [
                                    SizedBox(
                                      width: 80,
                                      child: Text(
                                          p['pair']?.toString() ?? '',
                                          style: const TextStyle(
                                              color: PiiColors.accent,
                                              fontFamily: 'monospace',
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13)),
                                    ),
                                    Expanded(
                                        child: _VolatilityBar(value: vol)),
                                    const SizedBox(width: 8),
                                    DirectionBadge(
                                        direction:
                                            p['direction']?.toString()),
                                  ],
                                ),
                                const Divider(
                                    color: PiiColors.border, height: 12),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Reversal signals
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Text('🔄 Reversal Signals',
                            style: TextStyle(
                                color: PiiColors.text,
                                fontWeight: FontWeight.w600,
                                fontSize: 16)),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                              color: PiiColors.border,
                              borderRadius: BorderRadius.circular(6)),
                          child: Text('${reversals.length} pairs',
                              style: const TextStyle(
                                  color: PiiColors.textMuted, fontSize: 11)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (_loadingRev)
                      const PiiLoading()
                    else if (_revError != null)
                      PiiError(message: _revError!, onRetry: _loadReversals)
                    else if (reversals.isEmpty)
                      const Text('No reversal signals detected',
                          style: TextStyle(
                              color: PiiColors.textMuted, fontSize: 13))
                    else
                      Column(
                        children: reversals.map((r) {
                          final isBullish = (r['reversal_type']
                                      ?.toString()
                                      .toLowerCase() ??
                                  '')
                              .contains('bullish');
                          final Color typeColor =
                              isBullish ? PiiColors.buy : PiiColors.sell;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: PiiColors.bg,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: PiiColors.border),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Text(
                                                r['pair']?.toString() ?? '',
                                                style: const TextStyle(
                                                    color: PiiColors.accent,
                                                    fontFamily: 'monospace',
                                                    fontWeight:
                                                        FontWeight.bold,
                                                    fontSize: 14)),
                                            const Spacer(),
                                            Text(
                                                isBullish ? '📈' : '📉',
                                                style: const TextStyle(
                                                    fontSize: 16)),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Row(
                                          children: [
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 8,
                                                      vertical: 2),
                                              decoration: BoxDecoration(
                                                color: typeColor
                                                    .withOpacity(0.15),
                                                borderRadius:
                                                    BorderRadius.circular(4),
                                              ),
                                              child: Text(
                                                  r['reversal_type']
                                                          ?.toString() ??
                                                      '',
                                                  style: TextStyle(
                                                      color: typeColor,
                                                      fontSize: 11,
                                                      fontWeight:
                                                          FontWeight.w600)),
                                            ),
                                            if (r['strength'] != null) ...[
                                              const SizedBox(width: 8),
                                              Text(
                                                  'Strength: ${r['strength']}',
                                                  style: const TextStyle(
                                                      color:
                                                          PiiColors.textMuted,
                                                      fontSize: 11)),
                                            ],
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Row(
                                          children: [
                                            const Text('Entry ',
                                                style: TextStyle(
                                                    color:
                                                        PiiColors.textMuted,
                                                    fontSize: 12)),
                                            Text(
                                                r['entry_price']
                                                        ?.toString() ??
                                                    '—',
                                                style: const TextStyle(
                                                    fontFamily: 'monospace',
                                                    color: PiiColors.text,
                                                    fontSize: 12)),
                                            if (r['confidence'] != null) ...[
                                              const Spacer(),
                                              Text(
                                                  '${(r['confidence'] as num).toStringAsFixed(1)}% conf',
                                                  style: const TextStyle(
                                                      color:
                                                          PiiColors.textMuted,
                                                      fontSize: 11)),
                                            ],
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

class _VolatilityBar extends StatelessWidget {
  final double value;
  const _VolatilityBar({required this.value});

  @override
  Widget build(BuildContext context) {
    const double maxPct = 3.0;
    final width = (value / maxPct).clamp(0.0, 1.0);
    final Color color = value > 1.5
        ? PiiColors.sell
        : value > 0.8
            ? PiiColors.hold
            : PiiColors.buy;
    return Row(
      children: [
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
              value: width,
              backgroundColor: PiiColors.border,
              color: color,
              minHeight: 5,
            ),
          ),
        ),
        const SizedBox(width: 6),
        SizedBox(
          width: 52,
          child: Text('${value.toStringAsFixed(3)}%',
              textAlign: TextAlign.right,
              style: TextStyle(
                  color: color,
                  fontFamily: 'monospace',
                  fontSize: 11)),
        ),
      ],
    );
  }
}
