import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../widgets/common_widgets.dart';

// ── Trading sessions ──────────────────────────────────────────────────────────
class _Session {
  final String name;
  final String flag;
  final int startH;
  final int endH;
  final Color color;
  const _Session(this.name, this.flag, this.startH, this.endH, this.color);
}

const _sessions = [
  _Session('Sydney', '🇦🇺', 21, 6, Color(0xFF58A6FF)),
  _Session('Tokyo', '🇯🇵', 0, 9, Color(0xFFA78BFA)),
  _Session('London', '🇬🇧', 7, 16, Color(0xFFF0883E)),
  _Session('New York', '🇺🇸', 13, 22, Color(0xFF3FB950)),
];

const _pairCategories = ['major', 'minor', 'exotic'];
const _pairSignalBatchSize = 6;

String _categoryLabel(String category) {
  switch (category) {
    case 'major':
      return 'Major Pairs';
    case 'minor':
      return 'Minor Pairs';
    case 'exotic':
      return 'Exotic Pairs';
    default:
      return category;
  }
}

bool _isSessionActive(_Session s, int nowH) {
  if (s.startH > s.endH) {
    return nowH >= s.startH || nowH < s.endH;
  }
  return nowH >= s.startH && nowH < s.endH;
}

// ── Forex screen ──────────────────────────────────────────────────────────────
class ForexScreen extends StatefulWidget {
  const ForexScreen({super.key});

  @override
  State<ForexScreen> createState() => _ForexScreenState();
}

class _ForexScreenState extends State<ForexScreen> {
  // Pair state
  Map<String, List<String>> _livePairsByCategory = {
    for (final category in _pairCategories) category: <String>[],
  };
  String _selectedPair = 'EUR/USD';
  final TextEditingController _pairCtrl =
      TextEditingController(text: 'EUR/USD');
  bool _loadingPairs = true;
  String? _pairsError;

  // Signal / tech state
  Map<String, dynamic>? _signal;
  Map<String, dynamic>? _tech;
  bool _loadingSignal = false;
  bool _loadingTech = false;
  String? _signalError;
  String? _techError;

  // News / calendar
  List<dynamic> _news = [];
  List<dynamic> _calendar = [];

  // Risk calculator
  final _balanceCtrl = TextEditingController(text: '10000');
  final _riskCtrl = TextEditingController(text: '1');
  final _entryCtrl = TextEditingController();
  final _slCtrl = TextEditingController();
  final _tpCtrl = TextEditingController();
  String _pairType = 'forex';

  // Analysis popup open?
  bool _showAnalysis = false;

  // Session clock
  late final Stream<DateTime> _clockStream;

  @override
  void initState() {
    super.initState();
    _clockStream = Stream.periodic(
        const Duration(seconds: 1), (_) => DateTime.now().toUtc());
    _loadInitial();
  }

  @override
  void dispose() {
    _pairCtrl.dispose();
    _balanceCtrl.dispose();
    _riskCtrl.dispose();
    _entryCtrl.dispose();
    _slCtrl.dispose();
    _tpCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadInitial() async {
    await Future.wait<void>([
      _loadPairs(),
      _loadNews(),
      _loadCalendar(),
    ]);
  }

  Future<void> _loadPairs() async {
    if (mounted) {
      setState(() {
        _loadingPairs = true;
        _pairsError = null;
      });
    }

    try {
      final pairs = await ApiService.getPairs();
      final categorizedPairs = <String, List<String>>{
        for (final category in _pairCategories) category: <String>[],
      };
      final pairToCategory = <String, String>{};

      for (final category in _pairCategories) {
        final pairsInCategory = (pairs[category] as List<dynamic>? ?? [])
            .map((pair) => pair.toString())
            .toList();
        for (final pair in pairsInCategory) {
          pairToCategory[pair] = category;
        }
      }

      final candidatePairs =
          (pairs['all'] as List<dynamic>? ?? pairToCategory.keys.toList())
              .map((pair) => pair.toString())
              .where(pairToCategory.containsKey)
              .toSet()
              .toList()
            ..sort();

      final livePairs = await _loadLivePairs(candidatePairs);

      for (final pair in livePairs.whereType<String>()) {
        final category = pairToCategory[pair];
        if (category != null) {
          categorizedPairs[category]!.add(pair);
        }
      }

      for (final category in _pairCategories) {
        categorizedPairs[category]!.sort();
      }

      final livePairsFlat = _flattenPairs(categorizedPairs);
      final nextSelectedPair = livePairsFlat.contains(_selectedPair)
          ? _selectedPair
          : livePairsFlat.isNotEmpty
              ? livePairsFlat.first
              : _selectedPair;

      if (!mounted) return;
      setState(() {
        _livePairsByCategory = categorizedPairs;
        _selectedPair = nextSelectedPair;
        _pairCtrl.text = nextSelectedPair;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() => _pairsError = e.message ?? 'Failed to load live pairs');
    } catch (_) {
      if (!mounted) return;
      setState(() => _pairsError = 'Failed to load live pairs');
    } finally {
      if (mounted) setState(() => _loadingPairs = false);
    }
  }

  Future<void> _loadNews() async {
    try {
      final news = await ApiService.getNews();
      if (mounted) setState(() => _news = news);
    } catch (_) {}
  }

  Future<void> _loadCalendar() async {
    try {
      final cal = await ApiService.getEconomicCalendar();
      if (mounted) setState(() => _calendar = cal);
    } catch (_) {}
  }

  Future<List<String>> _loadLivePairs(List<String> candidatePairs) async {
    final livePairs = <String>[];

    for (var i = 0; i < candidatePairs.length; i += _pairSignalBatchSize) {
      final batch = candidatePairs.skip(i).take(_pairSignalBatchSize).toList();
      final batchResults = await Future.wait<String?>(
        batch.map((pair) async {
          try {
            final signal = await ApiService.getSignal(pair);
            return signal['is_live'] == true ? pair : null;
          } on DioException catch (e) {
            debugPrint(
              'Live pair check failed for $pair: ${e.message ?? e.error}',
            );
            return null;
          }
        }),
      );

      livePairs.addAll(batchResults.whereType<String>());
    }

    return livePairs;
  }

  void _runAnalysis() {
    String pair = _pairCtrl.text.trim().toUpperCase().replaceAll('-', '/');
    if (pair.length == 6 && !pair.contains('/')) {
      pair = '${pair.substring(0, 3)}/${pair.substring(3)}';
    }
    if (pair.isEmpty) return;
    setState(() {
      _selectedPair = pair;
      _signal = null;
      _tech = null;
      _signalError = null;
      _techError = null;
      _showAnalysis = true;
    });
    _fetchSignal(pair);
    _fetchTech(pair);
  }

  Future<void> _fetchSignal(String pair) async {
    setState(() => _loadingSignal = true);
    try {
      final s = await ApiService.getSignal(pair);
      if (mounted) setState(() => _signal = s);
    } on DioException catch (e) {
      if (mounted) {
        setState(() => _signalError = e.message ?? 'Failed to load signal');
      }
    } finally {
      if (mounted) setState(() => _loadingSignal = false);
    }
  }

  Future<void> _fetchTech(String pair) async {
    setState(() => _loadingTech = true);
    try {
      final t = await ApiService.getTechnical(pair);
      if (mounted) setState(() => _tech = t);
    } on DioException catch (e) {
      if (mounted) {
        setState(
            () => _techError = e.message ?? 'Failed to load technical data');
      }
    } finally {
      if (mounted) setState(() => _loadingTech = false);
    }
  }

  void _copyToRiskCalc() {
    if (_signal == null) return;
    final sig = _signal!;
    _entryCtrl.text = sig['entry_price']?.toString() ?? '';
    _slCtrl.text = sig['stop_loss']?.toString() ?? '';
    _tpCtrl.text = sig['take_profit']?.toString() ?? '';
    final pair = _selectedPair;
    _pairType = pair.endsWith('/JPY') ? 'jpy' : 'forex';
    setState(() {});
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
          content: Text('Signal copied to risk calculator'),
          duration: Duration(seconds: 2)),
    );
  }

  Map<String, dynamic>? _calcRisk() {
    final balance = double.tryParse(_balanceCtrl.text) ?? 0;
    final riskPct = double.tryParse(_riskCtrl.text) ?? 0;
    final entry = double.tryParse(_entryCtrl.text) ?? 0;
    final sl = double.tryParse(_slCtrl.text) ?? 0;
    final tp = double.tryParse(_tpCtrl.text);
    if (balance <= 0 || riskPct <= 0 || entry <= 0 || sl <= 0) return null;
    final riskAmount = balance * (riskPct / 100);
    final pipSize = _pairType == 'jpy' ? 0.01 : 0.0001;
    final pipValuePerLot = _pairType == 'jpy' ? 1000 / entry : 10.0;
    final slPips = (entry - sl).abs() / pipSize;
    if (slPips == 0) return null;
    final tpPips = tp != null ? (tp - entry).abs() / pipSize : null;
    final lots = riskAmount / (slPips * pipValuePerLot);
    final units = lots * 100000;
    final rr = tpPips != null ? tpPips / slPips : null;
    return {
      'riskAmount': riskAmount,
      'slPips': slPips.toStringAsFixed(1),
      'tpPips': tpPips?.toStringAsFixed(1),
      'lots': lots.toStringAsFixed(2),
      'units': units.toStringAsFixed(0),
      'rr': rr?.toStringAsFixed(2),
      'rrValue': rr,
    };
  }

  List<String> _flattenPairs(Map<String, List<String>> pairsByCategory) {
    return [
      for (final category in _pairCategories) ...pairsByCategory[category] ?? [],
    ];
  }

  List<String> get _allPairs => _flattenPairs(_livePairsByCategory);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Trading Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: PiiColors.accent),
            onPressed: _loadInitial,
            tooltip: 'Refresh data',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Session banner
            _SessionBanner(clockStream: _clockStream),
            const SizedBox(height: 16),

            // Pair analysis panel
            _PairAnalysisPanel(
              controller: _pairCtrl,
              livePairCount: _allPairs.length,
              onAnalyze: _runAnalysis,
            ),
            const SizedBox(height: 16),

            // Pair chips
            if (_loadingPairs)
              const SectionCard(
                child: PiiLoading(text: 'Checking live trading pairs…'),
              )
            else if (_pairsError != null)
              SectionCard(
                child: PiiError(message: _pairsError!, onRetry: _loadPairs),
              )
            else ...[
              _PairChipsSection(
                pairsByCategory: _livePairsByCategory,
                selected: _selectedPair,
                onSelect: (p) {
                  _pairCtrl.text = p;
                  _selectedPair = p;
                  _runAnalysis();
                },
              ),
              const SizedBox(height: 16),
            ],

            // Analysis results (signal + tech)
            if (_showAnalysis) ...[
              if (_loadingSignal)
                const SectionCard(
                    child: PiiLoading(text: 'Loading signal…'))
              else if (_signalError != null)
                SectionCard(
                    child:
                        PiiError(message: _signalError!, onRetry: () => _fetchSignal(_selectedPair)))
              else if (_signal != null)
                _SignalCard(
                  signal: _signal!,
                  onCopyToRisk: _copyToRiskCalc,
                ),
              const SizedBox(height: 16),
              if (_loadingTech)
                const SectionCard(
                    child: PiiLoading(text: 'Loading technical data…'))
              else if (_techError != null)
                SectionCard(
                    child:
                        PiiError(message: _techError!, onRetry: () => _fetchTech(_selectedPair)))
              else if (_tech != null)
                _TechnicalCard(tech: _tech!),
              const SizedBox(height: 16),

              // News related to pair
              _PairNewsCard(
                  pair: _selectedPair,
                  news: _news,
                  calendar: _calendar),
              const SizedBox(height: 16),
            ],

            // Risk calculator
            _RiskCalculatorCard(
              balanceCtrl: _balanceCtrl,
              riskCtrl: _riskCtrl,
              entryCtrl: _entryCtrl,
              slCtrl: _slCtrl,
              tpCtrl: _tpCtrl,
              pairType: _pairType,
              onPairTypeChange: (v) => setState(() => _pairType = v),
              riskResult: _calcRisk(),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

// ── Session banner ────────────────────────────────────────────────────────────
class _SessionBanner extends StatelessWidget {
  final Stream<DateTime> clockStream;
  const _SessionBanner({required this.clockStream});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DateTime>(
      stream: clockStream,
      builder: (context, snap) {
        final now = snap.data ?? DateTime.now().toUtc();
        final h = now.hour;
        final m = now.minute;
        final s = now.second;
        final timeStr =
            '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')} UTC';

        return SectionCard(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                        color: PiiColors.buy, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 6),
                  const Text('Market Sessions',
                      style: TextStyle(
                          color: PiiColors.textMuted,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5)),
                  const Spacer(),
                  Text(timeStr,
                      style: const TextStyle(
                          color: PiiColors.accent,
                          fontFamily: 'monospace',
                          fontWeight: FontWeight.bold,
                          fontSize: 13)),
                ],
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: _sessions.map((s) {
                  final active = _isSessionActive(s, h);
                  return Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: active
                          ? s.color.withOpacity(0.12)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: active ? s.color : PiiColors.border,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(s.flag,
                            style: const TextStyle(fontSize: 13)),
                        const SizedBox(width: 4),
                        Text(s.name,
                            style: TextStyle(
                                color: active
                                    ? PiiColors.text
                                    : PiiColors.textMuted,
                                fontSize: 12,
                                fontWeight: active
                                    ? FontWeight.w600
                                    : FontWeight.normal)),
                        if (active) ...[
                          const SizedBox(width: 4),
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                                color: s.color,
                                shape: BoxShape.circle),
                          ),
                        ],
                      ],
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ── Pair analysis panel ───────────────────────────────────────────────────────
class _PairAnalysisPanel extends StatelessWidget {
  final TextEditingController controller;
  final int livePairCount;
  final VoidCallback onAnalyze;
  const _PairAnalysisPanel(
      {required this.controller,
      required this.livePairCount,
      required this.onAnalyze});

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('🤖', style: TextStyle(fontSize: 16)),
              const SizedBox(width: 6),
              const Text('AI-Powered Pair Analysis',
                  style: TextStyle(
                      color: PiiColors.accent,
                      fontWeight: FontWeight.w600,
                      fontSize: 14)),
              const SizedBox(width: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: PiiColors.buy.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text('● $livePairCount Live',
                    style: const TextStyle(
                        color: PiiColors.buy, fontSize: 11)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  style: const TextStyle(
                      color: PiiColors.text,
                      fontFamily: 'monospace',
                      fontSize: 14),
                  decoration: const InputDecoration(
                    hintText: 'e.g. EUR/USD, GBP/JPY…',
                    prefixIcon:
                        Icon(Icons.search, color: PiiColors.textMuted, size: 18),
                  ),
                  onSubmitted: (_) => onAnalyze(),
                  textCapitalization: TextCapitalization.characters,
                ),
              ),
              const SizedBox(width: 10),
              ElevatedButton(
                onPressed: onAnalyze,
                style: ElevatedButton.styleFrom(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                ),
                child: const Text('Analyze →'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Pair chips section ────────────────────────────────────────────────────────
class _PairChipsSection extends StatelessWidget {
  final Map<String, List<String>> pairsByCategory;
  final String selected;
  final ValueChanged<String> onSelect;
  const _PairChipsSection(
      {required this.pairsByCategory,
      required this.selected,
      required this.onSelect});

  @override
  Widget build(BuildContext context) {
    final visibleCategories = _pairCategories
        .where((category) => (pairsByCategory[category] ?? []).isNotEmpty)
        .toList();

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Live Pairs by Category',
              style: TextStyle(
                  color: PiiColors.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5)),
          const SizedBox(height: 10),
          if (visibleCategories.isEmpty)
            const Text(
              'No trading pairs currently have live data.',
              style: TextStyle(color: PiiColors.textMuted, fontSize: 13),
            )
          else
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: visibleCategories.map((category) {
                final pairs = pairsByCategory[category] ?? [];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            _categoryLabel(category),
                            style: const TextStyle(
                              color: PiiColors.accent,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${pairs.length} live',
                            style: const TextStyle(
                              color: PiiColors.textMuted,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: pairs
                            .map((p) => PairChip(
                                  pair: p,
                                  selected: p == selected,
                                  active: true,
                                  onTap: () => onSelect(p),
                                ))
                            .toList(),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }
}

// ── Signal card ───────────────────────────────────────────────────────────────
class _SignalCard extends StatelessWidget {
  final Map<String, dynamic> signal;
  final VoidCallback? onCopyToRisk;
  const _SignalCard({required this.signal, this.onCopyToRisk});

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              DirectionBadge(direction: signal['direction']),
              const Spacer(),
              if (signal['is_live'] == true)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: PiiColors.buy.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                              color: PiiColors.buy,
                              shape: BoxShape.circle)),
                      const SizedBox(width: 4),
                      const Text('LIVE',
                          style: TextStyle(
                              color: PiiColors.buy,
                              fontSize: 11,
                              fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
            ],
          ),
          if (signal['ai_label'] != null) ...[
            const SizedBox(height: 6),
            Text('🤖 ${signal['ai_label']}',
                style: const TextStyle(
                    color: PiiColors.textMuted, fontSize: 12)),
          ],
          const SizedBox(height: 12),
          ConfidenceBar(value: (signal['confidence'] as num?)?.toDouble()),
          const SizedBox(height: 12),
          const Divider(color: PiiColors.border, height: 1),
          PriceRow(
              label: 'Entry Price',
              value: signal['entry_price'],
              color: PiiColors.accent),
          const Divider(color: PiiColors.border, height: 1),
          PriceRow(
              label: 'Take Profit',
              value: signal['take_profit'],
              color: PiiColors.buy),
          const Divider(color: PiiColors.border, height: 1),
          PriceRow(
              label: 'Stop Loss',
              value: signal['stop_loss'],
              color: PiiColors.sell),
          if (signal['accuracy_30d'] != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: PiiColors.accent.withOpacity(0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('30-day accuracy: ',
                      style: TextStyle(
                          color: PiiColors.textMuted, fontSize: 12)),
                  Text(
                      '${(signal['accuracy_30d'] as num).toStringAsFixed(1)}%',
                      style: const TextStyle(
                          color: PiiColors.accent,
                          fontWeight: FontWeight.bold,
                          fontSize: 13)),
                ],
              ),
            ),
          ],
          if (signal['generated_at'] != null) ...[
            const SizedBox(height: 8),
            Text('Generated: ${signal['generated_at']}',
                textAlign: TextAlign.right,
                style: const TextStyle(
                    color: PiiColors.textMuted, fontSize: 11)),
          ],
          if (onCopyToRisk != null) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: PiiColors.accent,
                  side: const BorderSide(color: PiiColors.accent),
                ),
                onPressed: onCopyToRisk,
                child: const Text('🧮 Copy to Risk Calculator'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Technical card ────────────────────────────────────────────────────────────
class _TechnicalCard extends StatelessWidget {
  final Map<String, dynamic> tech;
  const _TechnicalCard({required this.tech});

  @override
  Widget build(BuildContext context) {
    final sr = tech['support_resistance'] as Map<String, dynamic>? ?? {};
    final supports = (sr['support'] as List<dynamic>? ?? []).take(4).toList();
    final resistances =
        (sr['resistance'] as List<dynamic>? ?? []).take(4).toList();
    final fvgs = ((tech['fvg'] as List<dynamic>? ?? [])
            .where((f) => f['filled'] != true)
            .toList())
        .take(3)
        .toList();
    final bos = (tech['bos'] as List<dynamic>? ?? []).take(2).toList();
    final choch = (tech['choch'] as List<dynamic>? ?? []).take(2).toList();

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('📐 Technical Analysis',
                  style: TextStyle(
                      color: PiiColors.text,
                      fontWeight: FontWeight.w600,
                      fontSize: 15)),
              const SizedBox(width: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: PiiColors.border,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(tech['pair']?.toString() ?? '',
                    style: const TextStyle(
                        color: PiiColors.textMuted,
                        fontFamily: 'monospace',
                        fontSize: 12)),
              ),
            ],
          ),
          if (tech['current_price'] != null) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: PiiColors.border.withOpacity(0.5),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                children: [
                  const Text('Current Price',
                      style: TextStyle(
                          color: PiiColors.textMuted, fontSize: 11)),
                  const SizedBox(height: 4),
                  Text(tech['current_price'].toString(),
                      style: const TextStyle(
                          color: PiiColors.accent,
                          fontFamily: 'monospace',
                          fontWeight: FontWeight.bold,
                          fontSize: 20)),
                ],
              ),
            ),
          ],
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('SUPPORT',
                        style: TextStyle(
                            color: PiiColors.buy,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.5)),
                    const SizedBox(height: 6),
                    if (supports.isEmpty)
                      const Text('None found',
                          style: TextStyle(
                              color: PiiColors.textMuted, fontSize: 12))
                    else
                      ...supports.map((s) => Text(s.toString(),
                          style: const TextStyle(
                              color: PiiColors.buy,
                              fontFamily: 'monospace',
                              fontSize: 12))),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('RESISTANCE',
                        style: TextStyle(
                            color: PiiColors.sell,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.5)),
                    const SizedBox(height: 6),
                    if (resistances.isEmpty)
                      const Text('None found',
                          style: TextStyle(
                              color: PiiColors.textMuted, fontSize: 12))
                    else
                      ...resistances.map((r) => Text(r.toString(),
                          style: const TextStyle(
                              color: PiiColors.sell,
                              fontFamily: 'monospace',
                              fontSize: 12))),
                  ],
                ),
              ),
            ],
          ),
          if (fvgs.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text('FVG Zones (${fvgs.length})',
                style: const TextStyle(
                    color: PiiColors.textMuted,
                    fontSize: 12,
                    fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            ...fvgs.map((f) {
              final isBullish =
                  (f['fvg_type'] ?? f['type'] ?? '').toString() == 'bullish';
              return Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                        '${f['fvg_type'] ?? f['type'] ?? 'FVG'}',
                        style: TextStyle(
                            color: isBullish ? PiiColors.buy : PiiColors.sell,
                            fontSize: 12)),
                    Text('${f['top']} / ${f['bottom']}',
                        style: const TextStyle(
                            color: PiiColors.textMuted,
                            fontFamily: 'monospace',
                            fontSize: 12)),
                  ],
                ),
              );
            }),
          ],
          if (bos.isNotEmpty || choch.isNotEmpty) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                if (bos.isNotEmpty)
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('BOS (${bos.length})',
                            style: const TextStyle(
                                color: PiiColors.accent,
                                fontSize: 12,
                                fontWeight: FontWeight.w600)),
                        ...bos.map((b) => Text(
                            (b['level'] ?? b).toString(),
                            style: const TextStyle(
                                color: PiiColors.textMuted,
                                fontFamily: 'monospace',
                                fontSize: 12))),
                      ],
                    ),
                  ),
                if (choch.isNotEmpty)
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('CHoCH (${choch.length})',
                            style: const TextStyle(
                                color: PiiColors.hold,
                                fontSize: 12,
                                fontWeight: FontWeight.w600)),
                        ...choch.map((c) => Text(
                            (c['level'] ?? c).toString(),
                            style: const TextStyle(
                                color: PiiColors.textMuted,
                                fontFamily: 'monospace',
                                fontSize: 12))),
                      ],
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

// ── News + calendar related to pair ──────────────────────────────────────────
class _PairNewsCard extends StatelessWidget {
  final String pair;
  final List<dynamic> news;
  final List<dynamic> calendar;
  const _PairNewsCard(
      {required this.pair, required this.news, required this.calendar});

  @override
  Widget build(BuildContext context) {
    final currencies = pair.split('/').where((c) => c.isNotEmpty).toList();

    final relatedNews = news.where((n) {
      final text =
          '${n['headline'] ?? ''} ${n['summary'] ?? ''}'.toUpperCase();
      return currencies.any((c) => text.contains(c));
    }).take(4).toList();

    final relatedEvents = calendar.where((ev) {
      final cur = (ev['currency'] ?? '').toString().toUpperCase();
      return currencies.contains(cur);
    }).take(6).toList();

    if (relatedNews.isEmpty && relatedEvents.isEmpty) return const SizedBox.shrink();

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('🤖 AI Analysis — $pair',
              style: const TextStyle(
                  color: PiiColors.text,
                  fontWeight: FontWeight.bold,
                  fontSize: 15)),
          const SizedBox(height: 14),
          if (relatedNews.isNotEmpty) ...[
            const Text('📰 Fundamental News',
                style: TextStyle(
                    color: PiiColors.textMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5)),
            const SizedBox(height: 8),
            ...relatedNews.map((n) {
              final sent = n['sentiment']?.toString() ?? '';
              final Color sentColor = sent == 'bullish'
                  ? PiiColors.buy
                  : sent == 'bearish'
                      ? PiiColors.sell
                      : PiiColors.textMuted;
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: PiiColors.bg,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: PiiColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(n['headline']?.toString() ?? '',
                                style: const TextStyle(
                                    color: PiiColors.text,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis),
                          ),
                          const SizedBox(width: 8),
                          Text(sent,
                              style: TextStyle(
                                  color: sentColor,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                          '${n['source'] ?? ''} · ${n['published_at'] ?? ''}',
                          style: const TextStyle(
                              color: PiiColors.textMuted, fontSize: 11)),
                    ],
                  ),
                ),
              );
            }),
          ],
          if (relatedEvents.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Text('📅 Upcoming Events',
                style: TextStyle(
                    color: PiiColors.textMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5)),
            const SizedBox(height: 8),
            ...relatedEvents.map((ev) {
              final impact = (ev['impact'] ?? '').toString().toLowerCase();
              final Color impactColor = impact == 'high'
                  ? PiiColors.sell
                  : impact == 'medium'
                      ? const Color(0xFF3B82F6)
                      : PiiColors.textMuted;
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: PiiColors.bg,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: PiiColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(ev['event']?.toString() ?? '',
                                style: const TextStyle(
                                    color: PiiColors.text,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis),
                          ),
                          Text(
                              (ev['impact'] ?? '').toString().toUpperCase(),
                              style: TextStyle(
                                  color: impactColor,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Text(ev['currency']?.toString() ?? '',
                              style: const TextStyle(
                                  color: PiiColors.accent,
                                  fontFamily: 'monospace',
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12)),
                          const SizedBox(width: 8),
                          Text(ev['time']?.toString() ?? '',
                              style: const TextStyle(
                                  color: PiiColors.textMuted,
                                  fontSize: 12)),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}

// ── Risk calculator card ──────────────────────────────────────────────────────
class _RiskCalculatorCard extends StatelessWidget {
  final TextEditingController balanceCtrl;
  final TextEditingController riskCtrl;
  final TextEditingController entryCtrl;
  final TextEditingController slCtrl;
  final TextEditingController tpCtrl;
  final String pairType;
  final ValueChanged<String> onPairTypeChange;
  final Map<String, dynamic>? riskResult;

  const _RiskCalculatorCard({
    required this.balanceCtrl,
    required this.riskCtrl,
    required this.entryCtrl,
    required this.slCtrl,
    required this.tpCtrl,
    required this.pairType,
    required this.onPairTypeChange,
    required this.riskResult,
  });

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('🧮',
                  style: TextStyle(fontSize: 16)),
              const SizedBox(width: 6),
              const Text('Risk Calculator',
                  style: TextStyle(
                      color: PiiColors.accent,
                      fontWeight: FontWeight.w600,
                      fontSize: 14)),
            ],
          ),
          const SizedBox(height: 14),
          _RiskField(
              label: 'Account Balance',
              controller: balanceCtrl,
              suffix: 'USD',
              hint: 'Available trading capital'),
          const SizedBox(height: 10),
          _RiskField(
              label: 'Risk Per Trade',
              controller: riskCtrl,
              suffix: '%',
              hint: 'Recommended 1–2%',
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true)),
          const SizedBox(height: 10),
          _RiskField(
              label: 'Entry Price',
              controller: entryCtrl,
              hint: 'Planned market entry'),
          const SizedBox(height: 10),
          _RiskField(
              label: 'Stop Loss',
              controller: slCtrl,
              hint: 'Invalidates the trade if reached'),
          const SizedBox(height: 10),
          _RiskField(
              label: 'Take Profit',
              controller: tpCtrl,
              hint: 'Optional target for reward'),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            value: pairType,
            onChanged: (v) => onPairTypeChange(v!),
            dropdownColor: PiiColors.surface,
            decoration: const InputDecoration(
              labelText: 'Instrument Type',
            ),
            items: const [
              DropdownMenuItem(
                  value: 'forex',
                  child: Text('Forex (non-JPY)',
                      style: TextStyle(color: PiiColors.text, fontSize: 13))),
              DropdownMenuItem(
                  value: 'jpy',
                  child: Text('Forex JPY pairs',
                      style: TextStyle(color: PiiColors.text, fontSize: 13))),
            ],
          ),
          if (riskResult != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: PiiColors.accent.withOpacity(0.07),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: PiiColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('POSITION SUMMARY',
                          style: TextStyle(
                              color: PiiColors.textMuted,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.5)),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: PiiColors.accent.withOpacity(0.14),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Text('Live estimate',
                            style: TextStyle(
                                color: PiiColors.accent, fontSize: 10)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  _RiskResultRow(
                      label: 'Account risk',
                      value:
                          '\$${(riskResult!['riskAmount'] as double).toStringAsFixed(2)}',
                      color: PiiColors.sell),
                  _RiskResultRow(
                      label: 'SL distance',
                      value: '${riskResult!['slPips']} pips'),
                  _RiskResultRow(
                      label: 'Position size',
                      value:
                          '${_fmtUnits(riskResult!['units'] as String)} units',
                      color: PiiColors.accent),
                  _RiskResultRow(
                      label: 'Standard lots',
                      value: riskResult!['lots'] as String,
                      color: PiiColors.accent),
                  if (riskResult!['rr'] != null) ...[
                    _RiskResultRow(
                        label: 'Risk : Reward',
                        value: '1:${riskResult!['rr']}',
                        color:
                            (riskResult!['rrValue'] as double) >= 2
                                ? PiiColors.buy
                                : PiiColors.hold),
                    _RiskResultRow(
                        label: 'TP distance',
                        value: '${riskResult!['tpPips']} pips'),
                  ],
                  const SizedBox(height: 6),
                  const Text(
                      'Double-check the final size with your broker before placing a live trade.',
                      style: TextStyle(
                          color: PiiColors.textMuted, fontSize: 11)),
                ],
              ),
            ),
          ] else ...[
            const SizedBox(height: 10),
            const Text(
                'Fill in balance, risk %, entry and stop loss to calculate position size.',
                style: TextStyle(color: PiiColors.textMuted, fontSize: 12)),
          ],
        ],
      ),
    );
  }

  String _fmtUnits(String v) {
    final n = int.tryParse(v) ?? 0;
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(2)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return v;
  }
}

class _RiskField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final String? suffix;
  final String? hint;
  final TextInputType? keyboardType;

  const _RiskField({
    required this.label,
    required this.controller,
    this.suffix,
    this.hint,
    this.keyboardType,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      style: const TextStyle(
          color: PiiColors.text, fontFamily: 'monospace', fontSize: 14),
      keyboardType: keyboardType ??
          const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        suffixText: suffix,
        suffixStyle: const TextStyle(
            color: PiiColors.textMuted,
            fontSize: 12,
            fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _RiskResultRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? color;
  const _RiskResultRow(
      {required this.label, required this.value, this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  color: PiiColors.textMuted, fontSize: 12)),
          Text(value,
              style: TextStyle(
                  color: color ?? PiiColors.text,
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.bold,
                  fontSize: 13)),
        ],
      ),
    );
  }
}
