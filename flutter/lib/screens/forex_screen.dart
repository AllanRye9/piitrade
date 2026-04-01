import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/forex_signal.dart';
import '../models/forex_technical.dart';
import '../models/forex_news.dart';
import '../services/api_service.dart';

// ── Supported currency pairs ──────────────────────────────────────────────────

const _kMajorPairs = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF',
  'AUD/USD', 'USD/CAD', 'NZD/USD',
];
const _kCrossPairs = [
  'EUR/GBP', 'EUR/JPY', 'EUR/AUD', 'EUR/CAD',
  'GBP/JPY', 'GBP/CHF', 'AUD/JPY',
];
const _kCommodityPairs = ['XAU/USD'];
const _kAllPairs = [
  ..._kMajorPairs, ..._kCrossPairs, ..._kCommodityPairs,
];

// ── Colors ────────────────────────────────────────────────────────────────────

const _kBuyColor  = Color(0xFF3fb950);
const _kSellColor = Color(0xFFf85149);
const _kHoldColor = Color(0xFFd29922);
const _kBlueAccent = Color(0xFF58a6ff);
const _kCardBg    = Color(0xFF161b22);
const _kBorderColor = Color(0xFF30363d);

// ── Game state ────────────────────────────────────────────────────────────────

const _kGameKey = 'fxHubGame';

// ── Pulse animation ───────────────────────────────────────────────────────────

const double _kPulseMinOpacity = 0.35;
const double _kPulseMaxOpacity = 1.0;

class _GameState {
  int xp;
  int level;
  int streak;
  int signalsWatched;
  List<String> badges;

  _GameState({
    this.xp = 0,
    this.level = 1,
    this.streak = 0,
    this.signalsWatched = 0,
    List<String>? badges,
  }) : badges = badges ?? [];

  factory _GameState.fromPrefs(SharedPreferences prefs) {
    return _GameState(
      xp: prefs.getInt('${_kGameKey}_xp') ?? 0,
      level: prefs.getInt('${_kGameKey}_level') ?? 1,
      streak: prefs.getInt('${_kGameKey}_streak') ?? 0,
      signalsWatched: prefs.getInt('${_kGameKey}_signalsWatched') ?? 0,
      badges: prefs.getStringList('${_kGameKey}_badges') ?? [],
    );
  }

  Future<void> save(SharedPreferences prefs) async {
    await prefs.setInt('${_kGameKey}_xp', xp);
    await prefs.setInt('${_kGameKey}_level', level);
    await prefs.setInt('${_kGameKey}_streak', streak);
    await prefs.setInt('${_kGameKey}_signalsWatched', signalsWatched);
    await prefs.setStringList('${_kGameKey}_badges', badges);
  }
}

const _kXpPerLevel = 100;

// ── Utility helpers ───────────────────────────────────────────────────────────

bool _isJpy(String pair)  => pair.contains('JPY');
bool _isGold(String pair) => pair.startsWith('XAU');

int _pairDecimals(String pair) => (_isJpy(pair) || _isGold(pair)) ? 2 : 4;

String _fmt(double v, String pair) => v.toStringAsFixed(_pairDecimals(pair));

String _fmtDate(String isoStr) {
  try {
    final dt = DateTime.parse(isoStr).toLocal();
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final hh = dt.hour.toString().padLeft(2, '0');
    final mm = dt.minute.toString().padLeft(2, '0');
    return '${months[dt.month - 1]} ${dt.day}, $hh:$mm';
  } catch (_) {
    return isoStr;
  }
}

Color _directionColor(String dir) {
  switch (dir) {
    case 'BUY':  return _kBuyColor;
    case 'SELL': return _kSellColor;
    default:     return _kHoldColor;
  }
}

String _directionArrow(String dir) {
  switch (dir) {
    case 'BUY':  return '▲';
    case 'SELL': return '▼';
    default:     return '→';
  }
}

// ── Badge definitions ─────────────────────────────────────────────────────────

const _kBadgeMap = {
  'first_signal': ('👀', 'First Signal'),
  'first_buy':    ('🟢', 'First BUY'),
  'first_sell':   ('🔴', 'First SELL'),
  'streak_3':     ('🔥', '3-Signal Streak'),
  'streak_5':     ('⚡', '5-Signal Streak'),
  'watched_10':   ('🏅', '10 Signals Watched'),
  'watched_50':   ('🏆', '50 Signals Watched'),
  'high_conf':    ('💎', 'High Confidence Signal'),
};

// ═══════════════════════════════════════════════════════════════════════════════
// ForexScreen
// ═══════════════════════════════════════════════════════════════════════════════

/// The AI Forex Signal Hub – a full-featured tab-based screen that mirrors
/// the web interface at /forex.
class ForexScreen extends StatefulWidget {
  final String serverUrl;
  final VoidCallback? onSettingsTap;

  const ForexScreen({super.key, required this.serverUrl, this.onSettingsTap});

  @override
  State<ForexScreen> createState() => _ForexScreenState();
}

class _ForexScreenState extends State<ForexScreen>
    with TickerProviderStateMixin {

  late final TabController _tabController;
  late final ApiService _api;

  // Auto-refresh interval: reload signal data every 5 minutes
  static const _kAutoRefreshInterval = Duration(minutes: 5);
  Timer? _refreshTimer;

  // ── State ──────────────────────────────────────────────────────────────────
  String _currentPair = 'EUR/USD';
  ForexSignal? _signal;
  // Unique key for AnimatedSwitcher – changes each time a new signal arrives
  Key _signalKey = UniqueKey();
  ForexTechnical? _technical;
  List<ForexNewsItem> _news = [];
  bool _loadingSignal = false;
  bool _loadingTech = false;
  bool _loadingNews = false;
  String? _signalError;
  String? _techError;
  String? _newsError;

  // Success rate cache: pair → {accuracy, total, correct, direction}
  final Map<String, Map<String, dynamic>> _successCache = {};
  bool _loadingAllPairs = false;
  String? _previousDirection;

  // Gamification
  _GameState _game = _GameState();
  SharedPreferences? _prefs;

  // Risk calculator
  final _balanceCtrl   = TextEditingController(text: '10000');
  final _riskPctCtrl   = TextEditingController(text: '2');
  final _entryCtrl     = TextEditingController();
  final _slCtrl        = TextEditingController();
  final _tpCtrl        = TextEditingController();
  String _leverage     = '100';
  String _lotType      = 'standard';

  // Risk results
  String _resRiskAmt   = '–';
  String _resPosSz     = '–';
  String _resPipVal    = '–';
  String _resPipsSl    = '–';
  String _resPipsTp    = '–';
  String _resRr        = '–';
  Color  _resRrColor   = Colors.white70;
  String _resProfit    = '–';
  String _resMargin    = '–';

  // Alert subscription
  final _emailCtrl = TextEditingController();
  final _alertPairs = <String>{
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'XAU/USD',
  };
  String? _subscribeStatus;
  bool _subscribeOk = false;
  bool _subscribing = false;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 6, vsync: this);
    _api = ApiService(widget.serverUrl);
    _loadPrefs();
    _loadSignal();
    _loadNews();
    // Auto-refresh signal data periodically
    _refreshTimer = Timer.periodic(_kAutoRefreshInterval, (_) {
      if (!mounted) return;
      // Fire-and-forget; each method has its own internal error handling
      // that updates the UI error state, so we just ignore the Future here.
      _loadSignal().ignore();
      _loadNews().ignore();
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _tabController.dispose();
    _balanceCtrl.dispose();
    _riskPctCtrl.dispose();
    _entryCtrl.dispose();
    _slCtrl.dispose();
    _tpCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadPrefs() async {
    _prefs = await SharedPreferences.getInstance();
    if (mounted) {
      setState(() => _game = _GameState.fromPrefs(_prefs!));
    }
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  Future<void> _loadSignal() async {
    setState(() {
      _loadingSignal = true;
      _signalError = null;
    });
    try {
      final s = await _api.getForexSignal(_currentPair);
      if (!mounted) return;
      final isNew = _previousDirection != null &&
          s.direction != _previousDirection;
      setState(() {
        _signal = s;
        _signalKey = UniqueKey(); // triggers AnimatedSwitcher transition
        _loadingSignal = false;
      });
      _autoFillCalculator(s);
      _runCalculator();
      _loadTechnical();
      _updateSuccessCache(_currentPair, s);
      _awardGameXp(isNew: isNew, signal: s);
      _previousDirection = s.direction;
    } catch (e) {
      if (mounted) {
        setState(() {
          _signalError = e.toString();
          _loadingSignal = false;
        });
      }
    }
  }

  Future<void> _loadTechnical() async {
    setState(() {
      _loadingTech = true;
      _techError = null;
    });
    try {
      final t = await _api.getForexTechnical(_currentPair);
      if (mounted) setState(() { _technical = t; _loadingTech = false; });
    } catch (e) {
      if (mounted) {
        setState(() { _techError = e.toString(); _loadingTech = false; });
      }
    }
  }

  Future<void> _loadNews() async {
    setState(() { _loadingNews = true; _newsError = null; });
    try {
      final items = await _api.getForexNews();
      if (mounted) setState(() { _news = items; _loadingNews = false; });
    } catch (e) {
      if (mounted) {
        setState(() { _newsError = e.toString(); _loadingNews = false; });
      }
    }
  }

  void _onPairChanged(String? pair) {
    if (pair == null || pair == _currentPair) return;
    setState(() => _currentPair = pair);
    _loadSignal();
  }

  // ── Gamification ───────────────────────────────────────────────────────────

  void _awardGameXp({required bool isNew, required ForexSignal signal}) {
    final g = _game;
    g.signalsWatched++;
    g.xp += 5;

    final directionChanged = isNew;
    if (directionChanged) {
      g.streak = 1;
      g.xp += 20;
    } else {
      g.streak++;
    }

    final newLevel = g.xp ~/ _kXpPerLevel + 1;
    if (newLevel > g.level) {
      g.level = newLevel;
      _showSnack('🎖️ Level $newLevel reached! ${g.xp} XP total.');
    }

    void checkBadge(String id, bool cond) {
      if (cond && !g.badges.contains(id)) {
        g.badges.add(id);
        final info = _kBadgeMap[id];
        if (info != null) _showSnack('${info.$1} Badge unlocked: ${info.$2}');
      }
    }

    checkBadge('first_signal', g.signalsWatched >= 1);
    checkBadge('watched_10',   g.signalsWatched >= 10);
    checkBadge('watched_50',   g.signalsWatched >= 50);
    checkBadge('first_buy',    signal.direction == 'BUY');
    checkBadge('first_sell',   signal.direction == 'SELL');
    checkBadge('high_conf',    signal.confidence >= 75);
    checkBadge('streak_3',     g.streak >= 3);
    checkBadge('streak_5',     g.streak >= 5);

    if (mounted) setState(() => _game = g);
    if (_prefs != null) g.save(_prefs!);
  }

  void _showSnack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), duration: const Duration(seconds: 3)),
    );
  }

  // ── Success rate cache ─────────────────────────────────────────────────────

  void _updateSuccessCache(String pair, ForexSignal s) {
    final hist = s.history;
    if (hist.isEmpty) return;
    final correct = hist.where((h) => h.correct).length;
    final accuracy = (correct / hist.length * 100).round();
    if (mounted) {
      setState(() => _successCache[pair] = {
        'accuracy': accuracy,
        'total': hist.length,
        'correct': correct,
        'direction': s.direction,
      });
    }
  }

  Future<void> _loadAllPairSuccessRates() async {
    setState(() => _loadingAllPairs = true);
    for (final pair in _kAllPairs) {
      if (_successCache.containsKey(pair)) continue;
      try {
        final s = await _api.getForexSignal(pair);
        _updateSuccessCache(pair, s);
        // Small delay to be rate-limit friendly
        await Future<void>.delayed(const Duration(milliseconds: 120));
      } catch (_) { /* skip */ }
    }
    if (mounted) setState(() => _loadingAllPairs = false);
  }

  // ── Risk Calculator ────────────────────────────────────────────────────────

  void _autoFillCalculator(ForexSignal s) {
    _entryCtrl.text = s.entryPrice.toString();
    _slCtrl.text    = s.stopLoss.toString();
    _tpCtrl.text    = s.takeProfit.toString();
  }

  void _runCalculator() {
    final balance  = double.tryParse(_balanceCtrl.text) ?? 0;
    final riskPct  = double.tryParse(_riskPctCtrl.text) ?? 0;
    final entry    = double.tryParse(_entryCtrl.text) ?? 0;
    final sl       = double.tryParse(_slCtrl.text) ?? 0;
    final tp       = double.tryParse(_tpCtrl.text) ?? 0;
    final leverage = double.tryParse(_leverage) ?? 100;

    if (balance == 0 || riskPct == 0 || entry == 0 || sl == 0) {
      setState(() {
        _resRiskAmt = '–'; _resPosSz = '–'; _resPipVal = '–';
        _resPipsSl  = '–'; _resPipsTp = '–'; _resRr = '–';
        _resProfit  = '–'; _resMargin = '–';
        _resRrColor = Colors.white70;
      });
      return;
    }

    final pair     = _currentPair;
    final lotMult  = _lotType == 'standard' ? 1.0
                   : _lotType == 'mini'     ? 0.1
                   : 0.01;
    final pipSize  = _isJpy(pair) ? 0.01 : (_isGold(pair) ? 1.0 : 0.0001);

    final riskAmt  = balance * riskPct / 100;
    final pipsSl   = sl > 0 ? (entry - sl).abs() / pipSize : 0.0;
    final pipsTp   = tp > 0 ? (tp - entry).abs() / pipSize : 0.0;

    final pvStd    = _pipValuePerStdLot(pair, entry);
    final pvLot    = pvStd * lotMult;

    final posLots  = pipsSl > 0 ? riskAmt / (pipsSl * pvLot) : 0.0;
    final posUnits = posLots * 100000 * lotMult;

    final rr       = (pipsSl > 0 && pipsTp > 0) ? pipsTp / pipsSl : 0.0;
    final profit   = posLots * pipsTp * pvLot;
    final margin   = posUnits * entry / leverage;

    Color rrColor = Colors.white70;
    if (rr >= 2) rrColor = _kBuyColor;
    else if (rr > 0 && rr < 1) rrColor = _kSellColor;

    setState(() {
      _resRiskAmt  = '\$${riskAmt.toStringAsFixed(2)}';
      _resPosSz    = '${posLots.toStringAsFixed(2)} lots';
      _resPipVal   = '\$${pvLot.toStringAsFixed(2)}';
      _resPipsSl   = '${pipsSl.toStringAsFixed(1)} pips';
      _resPipsTp   = tp > 0 ? '${pipsTp.toStringAsFixed(1)} pips' : '–';
      _resRr       = rr > 0 ? '1 : ${rr.toStringAsFixed(2)}' : '–';
      _resRrColor  = rrColor;
      _resProfit   = profit > 0 ? '\$${profit.toStringAsFixed(2)}' : '–';
      _resMargin   = '\$${margin.toStringAsFixed(2)}';
    });
  }

  double _pipValuePerStdLot(String pair, double entryPrice) {
    const lot = 100000.0;
    const goldLot = 100.0;
    final jpy  = _isJpy(pair);
    final gold = _isGold(pair);
    final pip  = gold ? 1.0 : (jpy ? 0.01 : 0.0001);
    final parts = pair.split('/');
    final quoteCcy = parts.length > 1 ? parts[1] : '';
    final baseCcy  = parts[0];
    if (gold) return pip * goldLot;
    if (quoteCcy == 'USD') return pip * lot;
    if (baseCcy  == 'USD') return (pip * lot) / entryPrice;
    if (jpy)               return (pip * lot) / entryPrice * 100;
    return pip * lot;
  }

  // ── Alert subscription ─────────────────────────────────────────────────────

  Future<void> _submitSubscription() async {
    final email = _emailCtrl.text.trim();
    if (email.isEmpty) {
      setState(() { _subscribeStatus = 'Please enter your email.'; _subscribeOk = false; });
      return;
    }
    if (_alertPairs.isEmpty) {
      setState(() { _subscribeStatus = 'Please select at least one pair.'; _subscribeOk = false; });
      return;
    }
    setState(() { _subscribing = true; _subscribeStatus = null; });
    try {
      final result = await _api.subscribeForexAlerts(
        email: email,
        pairs: _alertPairs.toList(),
      );
      if (mounted) {
        final ok = result['success'] == true;
        setState(() {
          _subscribeOk = ok;
          _subscribeStatus = ok
              ? result['message'] as String? ?? 'Subscribed!'
              : result['error']   as String? ?? 'Subscription failed.';
          if (ok) _emailCtrl.clear();
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() { _subscribeStatus = 'Network error. $e'; _subscribeOk = false; });
      }
    } finally {
      if (mounted) setState(() => _subscribing = false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Build
  // ══════════════════════════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      backgroundColor: cs.surface,
      appBar: _buildAppBar(cs),
      body: Column(
        children: [
          _buildGameBar(cs),
          _buildTabBar(cs),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildSignalTab(cs),
                _buildRiskCalcTab(cs),
                _buildTechnicalTab(cs),
                _buildSuccessTab(cs),
                _buildNewsTab(cs),
                _buildAlertsTab(cs),
              ],
            ),
          ),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(ColorScheme cs) {
    return AppBar(
      backgroundColor: const Color(0xFF0d1117),
      elevation: 0,
      title: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('📈', style: TextStyle(fontSize: 22)),
          SizedBox(width: 8),
          Flexible(
            child: Text(
              'AI Forex Signal Hub',
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: _loadingSignal
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.refresh),
          tooltip: 'Refresh signals',
          onPressed: _loadingSignal ? null : _loadSignal,
        ),
        if (widget.onSettingsTap != null)
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'Settings',
            onPressed: widget.onSettingsTap,
          ),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(height: 1, color: _kBorderColor),
      ),
    );
  }

  // ── Gamification bar ───────────────────────────────────────────────────────

  Widget _buildGameBar(ColorScheme cs) {
    final xpInLevel = _game.xp % _kXpPerLevel;
    final xpPct     = xpInLevel / _kXpPerLevel;
    return Container(
      decoration: BoxDecoration(
        color: _kCardBg,
        border: const Border(
          bottom: BorderSide(color: _kBorderColor),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: cs.primary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: cs.primary.withValues(alpha: 0.4)),
              ),
              child: Text(
                'Lv ${_game.level}',
                style: TextStyle(
                    color: cs.primary,
                    fontSize: 11,
                    fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: xpPct,
                  backgroundColor: _kBorderColor,
                  color: cs.primary,
                  minHeight: 7,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text('${_game.xp} XP',
                style: TextStyle(
                    color: cs.primary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600)),
            const SizedBox(width: 14),
            Row(children: [
              const Text('🔥', style: TextStyle(fontSize: 13)),
              const SizedBox(width: 3),
              Text('${_game.streak}',
                  style: const TextStyle(fontSize: 12, color: Colors.white70)),
            ]),
            const SizedBox(width: 10),
            Row(children: [
              const Text('✅', style: TextStyle(fontSize: 13)),
              const SizedBox(width: 3),
              Text('${_game.signalsWatched}',
                  style: const TextStyle(fontSize: 12, color: Colors.white70)),
            ]),
          ]),
          if (_game.badges.isNotEmpty) ...[
            const SizedBox(height: 7),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: _game.badges
                  .where((id) => _kBadgeMap.containsKey(id))
                  .map((id) {
                final info = _kBadgeMap[id]!;
                return Tooltip(
                  message: info.$2,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: _kBorderColor,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(info.$1,
                        style: const TextStyle(fontSize: 16)),
                  ),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }

  // ── Tab bar ────────────────────────────────────────────────────────────────

  Widget _buildTabBar(ColorScheme cs) {
    return Container(
      color: _kCardBg,
      child: TabBar(
        controller: _tabController,
        isScrollable: true,
        tabAlignment: TabAlignment.start,
        labelColor: cs.primary,
        unselectedLabelColor: cs.onSurface.withValues(alpha: 0.5),
        indicatorColor: cs.primary,
        tabs: const [
          Tab(text: '📊 Signal'),
          Tab(text: '📐 Risk Calc'),
          Tab(text: '🔍 Technical'),
          Tab(text: '🏆 Success Rates'),
          Tab(text: '📰 News'),
          Tab(text: '🔔 Alerts'),
        ],
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Tab 1 – Signal
  // ══════════════════════════════════════════════════════════════════════════════

  Widget _buildSignalTab(ColorScheme cs) {
    return RefreshIndicator(
      onRefresh: () async {
        await _loadSignal();
        await _loadNews();
      },
      color: cs.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildPairSelector(cs),
            const SizedBox(height: 16),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 400),
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeInCubic,
              transitionBuilder: (child, animation) => FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0, 0.08),
                    end: Offset.zero,
                  ).animate(animation),
                  child: child,
                ),
              ),
              child: _loadingSignal
                  ? const Center(
                      key: ValueKey('loading'),
                      child: Padding(
                        padding: EdgeInsets.all(48),
                        child: CircularProgressIndicator(),
                      ))
                  : _signalError != null
                      ? _buildErrorCard(
                          _signalError!, _loadSignal, cs,
                          key: ValueKey('error'),
                        )
                      : _signal != null
                          ? Column(
                              key: _signalKey,
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                _buildSignalCard(_signal!, cs),
                                const SizedBox(height: 16),
                                _buildHistoryChart(
                                    _signal!.history, _currentPair, cs),
                              ],
                            )
                          : const SizedBox(key: ValueKey('empty')),
            ),
          ],
        ),
      ),
    );
  }

  // Pair selector + refresh row
  Widget _buildPairSelector(ColorScheme cs) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: _kCardBg,
        border: Border.all(color: _kBorderColor),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(children: [
        Text('Pair: ',
            style: TextStyle(
                color: cs.onSurface.withValues(alpha: 0.6),
                fontWeight: FontWeight.w500)),
        Expanded(
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _currentPair,
              isExpanded: true,
              dropdownColor: _kCardBg,
              style: const TextStyle(
                  color: Colors.white, fontWeight: FontWeight.w600),
              onChanged: _onPairChanged,
              items: [
                const DropdownMenuItem<String>(
                  enabled: false,
                  value: null,
                  child: Text('── Major Pairs ──',
                      style: TextStyle(
                          color: Colors.white38, fontSize: 13)),
                ),
                ..._kMajorPairs.map((p) =>
                    DropdownMenuItem(value: p, child: Text(p))),
                const DropdownMenuItem<String>(
                  enabled: false,
                  value: null,
                  child: Text('── Cross Pairs ──',
                      style: TextStyle(
                          color: Colors.white38, fontSize: 13)),
                ),
                ..._kCrossPairs.map((p) =>
                    DropdownMenuItem(value: p, child: Text(p))),
                const DropdownMenuItem<String>(
                  enabled: false,
                  value: null,
                  child: Text('── Commodities ──',
                      style: TextStyle(
                          color: Colors.white38, fontSize: 13)),
                ),
                ..._kCommodityPairs.map((p) =>
                    DropdownMenuItem(value: p, child: Text(p))),
              ],
            ),
          ),
        ),
        if (_signal != null) ...[
          const SizedBox(width: 6),
          if (_signal!.isLive)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _PulseDot(color: _kBuyColor),
                const SizedBox(width: 4),
                const Text('Live',
                    style: TextStyle(
                        fontSize: 11,
                        color: _kBuyColor,
                        fontWeight: FontWeight.w600)),
              ],
            )
          else
            Text('Cached',
                style: TextStyle(
                    fontSize: 11, color: _kHoldColor)),
        ],
        IconButton(
          icon: _loadingSignal
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.refresh, size: 20),
          onPressed: _loadingSignal ? null : _loadSignal,
          tooltip: 'Refresh signal',
          padding: const EdgeInsets.all(8),
          constraints: const BoxConstraints(),
        ),
      ]),
    );
  }

  // Signal card
  Widget _buildSignalCard(ForexSignal s, ColorScheme cs) {
    final dir      = s.direction;
    final dirColor = _directionColor(dir);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _kCardBg,
        border: Border.all(color: dirColor.withValues(alpha: 0.5), width: 1.5),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: dirColor.withValues(alpha: 0.12),
            blurRadius: 24,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Direction badge + date + live indicator
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  color: dirColor.withValues(alpha: 0.15),
                  border: Border.all(color: dirColor),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${_directionArrow(dir)} $dir',
                  style: TextStyle(
                    color: dirColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 22,
                    letterSpacing: 1,
                  ),
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (s.isLive)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _PulseDot(color: _kBuyColor),
                        const SizedBox(width: 5),
                        const Text('Live',
                            style: TextStyle(
                                color: _kBuyColor,
                                fontSize: 12,
                                fontWeight: FontWeight.w600)),
                      ],
                    )
                  else
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                            width: 7,
                            height: 7,
                            decoration: const BoxDecoration(
                                color: _kHoldColor,
                                shape: BoxShape.circle)),
                        const SizedBox(width: 5),
                        const Text('Cached',
                            style: TextStyle(
                                color: _kHoldColor, fontSize: 12)),
                      ],
                    ),
                  const SizedBox(height: 4),
                  Text(
                    _fmtDate(s.generatedAt),
                    style: TextStyle(
                      color: cs.onSurface.withValues(alpha: 0.45),
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Confidence bar
          Row(children: [
            Text('Confidence ',
                style: TextStyle(
                    color: cs.onSurface.withValues(alpha: 0.7))),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: s.confidence / 100,
                  backgroundColor: _kBorderColor,
                  color: dirColor,
                  minHeight: 8,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text('${s.confidence.toStringAsFixed(1)}%',
                style: TextStyle(
                    color: dirColor, fontWeight: FontWeight.bold)),
          ]),
          const SizedBox(height: 8),
          // 30-day accuracy
          RichText(
            text: TextSpan(
              style: TextStyle(
                  color: cs.onSurface.withValues(alpha: 0.7),
                  fontSize: 13),
              children: [
                const TextSpan(text: '30-day accuracy: '),
                TextSpan(
                  text: '${s.accuracy30d.toStringAsFixed(1)}%',
                  style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Price levels
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.25),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(children: [
              Expanded(
                  child: _priceLevelTile('Entry Price',
                      _fmt(s.entryPrice, _currentPair), Colors.white, cs)),
              Container(width: 1, height: 40, color: _kBorderColor),
              Expanded(
                  child: _priceLevelTile('Take Profit',
                      _fmt(s.takeProfit, _currentPair), _kBuyColor, cs)),
              Container(width: 1, height: 40, color: _kBorderColor),
              Expanded(
                  child: _priceLevelTile('Stop Loss',
                      _fmt(s.stopLoss, _currentPair), _kSellColor, cs)),
            ]),
          ),
          const SizedBox(height: 12),
          // Model info
          Wrap(spacing: 8, runSpacing: 4, children: [
            Text('Model: ',
                style: TextStyle(
                    color: cs.onSurface.withValues(alpha: 0.6),
                    fontSize: 12)),
            Text(s.modelVersion,
                style: const TextStyle(fontSize: 12)),
            ...s.featuresUsed.map((f) => Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: cs.primary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(f,
                  style: TextStyle(fontSize: 11, color: cs.primary)),
            )),
          ]),
        ],
      ),
    );
  }
  Widget _priceLevelTile(String label, String value, Color valueColor, ColorScheme cs) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(label, style: TextStyle(fontSize: 11, color: cs.onSurface.withValues(alpha: 0.5))),
        const SizedBox(height: 4),
        Text(value, style: TextStyle(fontSize: 15, color: valueColor, fontWeight: FontWeight.w600)),
      ],
    );
  }

  // ── Historical accuracy chart ──────────────────────────────────────────────

  Widget _buildHistoryChart(List<ForexHistory> history, String pair, ColorScheme cs) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _kCardBg,
        border: Border.all(color: _kBorderColor),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('📉 Historical Accuracy – Last 30 Days',
              style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          SizedBox(
            height: 200,
            child: history.isEmpty
                ? const Center(child: Text('No history data'))
                : CustomPaint(
                    painter: _AccuracyChartPainter(history: history, pair: pair),
                    size: Size.infinite,
                  ),
          ),
          const SizedBox(height: 8),
          // Legend
          Row(children: [
            Container(width: 20, height: 2, color: _kBlueAccent),
            const SizedBox(width: 6),
            const Text('Actual exit price', style: TextStyle(fontSize: 12)),
            const SizedBox(width: 16),
            Container(
              width: 10, height: 10,
              decoration: const BoxDecoration(color: _kBuyColor, shape: BoxShape.circle),
            ),
            const SizedBox(width: 6),
            const Text('Correct', style: TextStyle(fontSize: 12)),
            const SizedBox(width: 12),
            Container(
              width: 10, height: 10,
              decoration: const BoxDecoration(color: _kSellColor, shape: BoxShape.circle),
            ),
            const SizedBox(width: 6),
            const Text('Incorrect', style: TextStyle(fontSize: 12)),
          ]),
        ],
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Tab 2 – Risk Calc
  // ══════════════════════════════════════════════════════════════════════════════

  Widget _buildRiskCalcTab(ColorScheme cs) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('📐 Risk Management Calculator',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          // Inputs grid
          _calcCard(
            child: Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _calcInput('Account Balance (\$)', _balanceCtrl, TextInputType.number),
                _calcInput('Risk per Trade (%)',   _riskPctCtrl, TextInputType.number),
                _calcInput('Entry Price',  _entryCtrl, TextInputType.number),
                _calcInput('Stop Loss',    _slCtrl,    TextInputType.number),
                _calcInput('Take Profit',  _tpCtrl,    TextInputType.number),
                _leverageDropdown(cs),
                _lotTypeDropdown(cs),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Results
          _calcCard(
            child: Column(
              children: [
                _resultRow('Risk Amount',         _resRiskAmt,  cs.primary),
                _resultRow('Position Size',       _resPosSz,    Colors.white),
                _resultRow('Pip Value (per lot)', _resPipVal,   Colors.white),
                _resultRow('Pips to Stop Loss',   _resPipsSl,   _kSellColor),
                _resultRow('Pips to Take Profit', _resPipsTp,   _kBuyColor),
                _resultRow('Risk : Reward',       _resRr,       _resRrColor,
                    isHighlight: true),
                _resultRow('Potential Profit',    _resProfit,   _kBuyColor),
                _resultRow('Required Margin',     _resMargin,   Colors.white),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            '⚠️ Pip values are approximated for a USD-denominated account. '
            'For educational purposes only.',
            style: TextStyle(
                color: cs.onSurface.withValues(alpha: 0.5), fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _calcCard({required Widget child}) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: _kCardBg,
      border: Border.all(color: _kBorderColor),
      borderRadius: BorderRadius.circular(12),
    ),
    child: child,
  );

  Widget _calcInput(String label, TextEditingController ctrl, TextInputType kbt) {
    return SizedBox(
      width: 160,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: Colors.white70)),
          const SizedBox(height: 4),
          TextField(
            controller: ctrl,
            keyboardType: kbt,
            style: const TextStyle(fontSize: 14),
            decoration: InputDecoration(
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              filled: true,
              fillColor: _kBorderColor,
              border: OutlineInputBorder(
                  borderSide: BorderSide.none,
                  borderRadius: BorderRadius.circular(8)),
            ),
            onChanged: (_) => _runCalculator(),
          ),
        ],
      ),
    );
  }

  Widget _leverageDropdown(ColorScheme cs) {
    return SizedBox(
      width: 160,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Leverage', style: TextStyle(fontSize: 12, color: Colors.white70)),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: _kBorderColor,
              borderRadius: BorderRadius.circular(8),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _leverage,
                dropdownColor: _kCardBg,
                isExpanded: true,
                style: const TextStyle(fontSize: 14),
                items: ['50', '100', '200', '500'].map((v) =>
                    DropdownMenuItem(value: v, child: Text('$v:1'))).toList(),
                onChanged: (v) {
                  if (v != null) setState(() { _leverage = v; _runCalculator(); });
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _lotTypeDropdown(ColorScheme cs) {
    return SizedBox(
      width: 160,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Lot Type', style: TextStyle(fontSize: 12, color: Colors.white70)),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: _kBorderColor,
              borderRadius: BorderRadius.circular(8),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _lotType,
                dropdownColor: _kCardBg,
                isExpanded: true,
                style: const TextStyle(fontSize: 14),
                items: const [
                  DropdownMenuItem(value: 'standard', child: Text('Standard (100k)')),
                  DropdownMenuItem(value: 'mini',     child: Text('Mini (10k)')),
                  DropdownMenuItem(value: 'micro',    child: Text('Micro (1k)')),
                ],
                onChanged: (v) {
                  if (v != null) setState(() { _lotType = v; _runCalculator(); });
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _resultRow(String label, String value, Color valueColor, {bool isHighlight = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.white70)),
          Text(
            value,
            style: TextStyle(
              color: valueColor,
              fontWeight: isHighlight ? FontWeight.bold : FontWeight.w500,
              fontSize: isHighlight ? 15 : 14,
            ),
          ),
        ],
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Tab 3 – Technical Analysis
  // ══════════════════════════════════════════════════════════════════════════════

  Widget _buildTechnicalTab(ColorScheme cs) {
    if (_loadingTech) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_techError != null) {
      return _buildErrorCard(_techError!, _loadTechnical, cs);
    }
    if (_technical == null) {
      return const Center(child: Text('No data – select a pair'));
    }
    final t = _technical!;
    final dec = _pairDecimals(_currentPair);
    String fmt(double v) => v.toStringAsFixed(dec);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('🔍 Technical Analysis',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          // Support & Resistance
          _taCard(
            title: '📏 Support & Resistance',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Resistance', style: TextStyle(color: _kSellColor, fontWeight: FontWeight.w600)),
                ...t.supportResistance.resistance.reversed.map((r) =>
                    _srLevel('R', r, _kSellColor, fmt(r))),
                const SizedBox(height: 4),
                Text('● Current: ${fmt(t.currentPrice)}',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                const Text('Support', style: TextStyle(color: _kBuyColor, fontWeight: FontWeight.w600)),
                ...t.supportResistance.support.map((s) =>
                    _srLevel('S', s, _kBuyColor, fmt(s))),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // FVG
          _taCard(
            title: '🌀 Fair Value Gaps (FVG)',
            child: Column(
              children: t.fvg.map((g) => _fvgTile(g, fmt, cs)).toList(),
            ),
          ),
          const SizedBox(height: 12),
          // BOS
          _taCard(
            title: '⚡ Break of Structure (BOS)',
            child: Column(
              children: t.bos.map((b) => _bosTile(b, fmt, cs)).toList(),
            ),
          ),
          const SizedBox(height: 12),
          // CHoCH
          _taCard(
            title: '🔄 Change of Character (CHoCH)',
            child: Column(
              children: t.choch.map((c) => _chochTile(c, fmt, cs)).toList(),
            ),
          ),
          const SizedBox(height: 12),
          // Volume zones
          _taCard(
            title: '🔥 High Volume Trade Zones',
            child: Column(
              children: t.highVolumeZones.map((z) => _volumeTile(z, fmt, cs)).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _taCard({required String title, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _kCardBg,
        border: Border.all(color: _kBorderColor),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _srLevel(String badge, double price, Color color, String priceStr) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(children: [
        Container(
          width: 22, height: 22,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.2),
            border: Border.all(color: color),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(badge, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.bold)),
        ),
        const SizedBox(width: 8),
        Text(priceStr, style: TextStyle(color: color)),
      ]),
    );
  }

  Widget _fvgTile(FairValueGap g, String Function(double) fmt, ColorScheme cs) {
    final color = g.type == 'bullish' ? _kBuyColor : _kSellColor;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          border: Border.all(color: color.withValues(alpha: 0.3)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            _badge(g.type.toUpperCase(), color),
            const SizedBox(width: 6),
            _badge(g.filled ? 'Filled' : 'Unfilled',
                g.filled ? Colors.white38 : cs.primary),
            const Spacer(),
            Text(g.created, style: const TextStyle(fontSize: 11, color: Colors.white54)),
          ]),
          const SizedBox(height: 4),
          Text('${fmt(g.bottom)} – ${fmt(g.top)}',
              style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 2),
          Text(g.description, style: const TextStyle(fontSize: 12, color: Colors.white70)),
        ]),
      ),
    );
  }

  Widget _bosTile(BreakOfStructure b, String Function(double) fmt, ColorScheme cs) {
    final color = b.type == 'bullish' ? _kBuyColor : _kSellColor;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          border: Border.all(color: color.withValues(alpha: 0.3)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            _badge('${b.type.toUpperCase()} BOS', color),
            const Spacer(),
            Text(b.date, style: const TextStyle(fontSize: 11, color: Colors.white54)),
          ]),
          const SizedBox(height: 4),
          Text(fmt(b.level), style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 2),
          Text(b.description, style: const TextStyle(fontSize: 12, color: Colors.white70)),
        ]),
      ),
    );
  }

  Widget _chochTile(ChangeOfCharacter c, String Function(double) fmt, ColorScheme cs) {
    final color = c.type == 'bullish' ? _kBuyColor : _kSellColor;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          border: Border.all(color: color.withValues(alpha: 0.3)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            _badge('CHoCH', color),
            const Spacer(),
            Text(c.date, style: const TextStyle(fontSize: 11, color: Colors.white54)),
          ]),
          const SizedBox(height: 4),
          Text(fmt(c.level), style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 2),
          Text(c.description, style: const TextStyle(fontSize: 12, color: Colors.white70)),
        ]),
      ),
    );
  }

  Widget _volumeTile(VolumeZone z, String Function(double) fmt, ColorScheme cs) {
    final color = z.strength == 'high' ? _kHoldColor : cs.primary;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          border: Border.all(color: color.withValues(alpha: 0.3)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            _badge(z.strength.toUpperCase(), color),
            const SizedBox(width: 6),
            Text('${fmt(z.bottom)} – ${fmt(z.top)}',
                style: const TextStyle(fontWeight: FontWeight.w600)),
          ]),
          const SizedBox(height: 4),
          Text(z.description, style: const TextStyle(fontSize: 12, color: Colors.white70)),
        ]),
      ),
    );
  }

  Widget _badge(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.2),
      border: Border.all(color: color.withValues(alpha: 0.6)),
      borderRadius: BorderRadius.circular(4),
    ),
    child: Text(label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // Tab 4 – Success Rates
  // ══════════════════════════════════════════════════════════════════════════════

  Widget _buildSuccessTab(ColorScheme cs) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('🏆 Pair Success Rates',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text(
            'Accuracy is computed from the last 30-day prediction history.',
            style: TextStyle(color: cs.onSurface.withValues(alpha: 0.6), fontSize: 13),
          ),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: _loadingAllPairs ? null : _loadAllPairSuccessRates,
            icon: _loadingAllPairs
                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('⟳'),
            label: Text(_loadingAllPairs ? 'Loading…' : 'Load All Pairs'),
          ),
          const SizedBox(height: 16),
          if (_successCache.isEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text('Select a pair above or tap Load All Pairs.',
                  style: TextStyle(color: cs.onSurface.withValues(alpha: 0.5))),
            )
          else
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: _successCache.entries.map((e) =>
                  _successCard(e.key, e.value, cs)).toList(),
            ),
          const SizedBox(height: 24),
          const Text('🧠 How Our AI Works',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: _kCardBg,
              border: Border.all(color: _kBorderColor),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
              'Our AI analyses 10+ years of historical price data, real-time news sentiment, '
              'and economic events using machine learning to generate buy/sell/hold signals.\n\n'
              'The pipeline uses a LightGBM gradient-boosted tree model trained on features '
              'including RSI, MACD, EMA-20/50, news sentiment scores, CPI delta, and PMI '
              'readings.\n\n'
              '⚠️ Disclaimer: For educational purposes only. Not financial advice. '
              'Forex trading involves significant risk of loss.',
              style: TextStyle(fontSize: 13, color: Colors.white70, height: 1.5),
            ),
          ),
        ],
      ),
    );
  }

  Widget _successCard(String pair, Map<String, dynamic> data, ColorScheme cs) {
    final pct  = data['accuracy'] as int? ?? 0;
    final tot  = data['total'] as int? ?? 0;
    final cor  = data['correct'] as int? ?? 0;
    final dir  = data['direction'] as String? ?? 'HOLD';
    final rateColor = pct >= 60 ? _kBuyColor : pct >= 45 ? _kHoldColor : _kSellColor;
    return SizedBox(
      width: 160,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: _kCardBg,
          border: Border.all(color: _kBorderColor),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text(pair, style: const TextStyle(fontWeight: FontWeight.w600)),
            const Spacer(),
            _badge(dir, _directionColor(dir)),
          ]),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: pct / 100,
              backgroundColor: _kBorderColor,
              color: rateColor,
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 4),
          Text('$pct%', style: TextStyle(color: rateColor, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text('$cor/$tot correct',
              style: TextStyle(color: cs.onSurface.withValues(alpha: 0.5), fontSize: 11)),
        ]),
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Tab 5 – News
  // ══════════════════════════════════════════════════════════════════════════════

  Widget _buildNewsTab(ColorScheme cs) {
    if (_loadingNews) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_newsError != null) {
      return _buildErrorCard(_newsError!, _loadNews, cs);
    }
    if (_news.isEmpty) {
      return const Center(child: Text('No news available'));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _news.length + 1,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) {
        if (i == 0) {
          return const Text('📰 News Sentiment Feed',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600));
        }
        return _newsTile(_news[i - 1], cs);
      },
    );
  }

  Widget _newsTile(ForexNewsItem item, ColorScheme cs) {
    final sentimentIcon  = item.sentiment == 'positive' ? '📈'
                         : item.sentiment == 'negative' ? '📉' : '➡️';
    final sentimentColor = item.sentiment == 'positive' ? _kBuyColor
                         : item.sentiment == 'negative' ? _kSellColor
                         : _kHoldColor;
    return Container(
      decoration: BoxDecoration(
        color: _kCardBg,
        border: Border(
          left: BorderSide(color: sentimentColor, width: 3),
          top: const BorderSide(color: _kBorderColor),
          right: const BorderSide(color: _kBorderColor),
          bottom: const BorderSide(color: _kBorderColor),
        ),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(sentimentIcon, style: const TextStyle(fontSize: 22)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(item.headline,
                  style: const TextStyle(
                      fontWeight: FontWeight.w500, fontSize: 14)),
              const SizedBox(height: 5),
              Row(children: [
                Text(item.source,
                    style: TextStyle(
                        color: cs.onSurface.withValues(alpha: 0.5),
                        fontSize: 12)),
                const SizedBox(width: 10),
                Text(_fmtDate(item.publishedAt),
                    style: TextStyle(
                        color: cs.onSurface.withValues(alpha: 0.4),
                        fontSize: 12)),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: sentimentColor.withValues(alpha: 0.15),
                    border: Border.all(
                        color: sentimentColor.withValues(alpha: 0.5)),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(item.sentiment,
                      style:
                          TextStyle(fontSize: 11, color: sentimentColor)),
                ),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Tab 6 – Alerts
  // ══════════════════════════════════════════════════════════════════════════════

  Widget _buildAlertsTab(ColorScheme cs) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('🔔 Get Signal Alerts',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text(
            'Receive an email the moment a new AI signal is generated for your chosen pairs.',
            style: TextStyle(color: cs.onSurface.withValues(alpha: 0.6), fontSize: 13),
          ),
          const SizedBox(height: 20),
          // Email input
          TextField(
            controller: _emailCtrl,
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(
              labelText: 'Email address',
              hintText: 'your@email.com',
              filled: true,
              fillColor: _kCardBg,
              border: OutlineInputBorder(
                borderSide: BorderSide(color: _kBorderColor),
                borderRadius: BorderRadius.circular(10),
              ),
              enabledBorder: OutlineInputBorder(
                borderSide: BorderSide(color: _kBorderColor),
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Pair checkboxes
          const Text('Pairs to receive alerts for:',
              style: TextStyle(fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          Column(
            children: _kAllPairs.map((p) => CheckboxListTile(
              title: Text(p, style: const TextStyle(fontSize: 13)),
              value: _alertPairs.contains(p),
              dense: true,
              controlAffinity: ListTileControlAffinity.leading,
              onChanged: (v) => setState(() {
                if (v == true) _alertPairs.add(p);
                else _alertPairs.remove(p);
              }),
            )).toList(),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _subscribing ? null : _submitSubscription,
            style: ElevatedButton.styleFrom(
              backgroundColor: cs.primary,
              foregroundColor: cs.onPrimary,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: _subscribing
                ? const SizedBox(
                    height: 20, width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Subscribe', style: TextStyle(fontWeight: FontWeight.w600)),
          ),
          if (_subscribeStatus != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _subscribeOk
                    ? _kBuyColor.withValues(alpha: 0.15)
                    : _kSellColor.withValues(alpha: 0.15),
                border: Border.all(
                    color: _subscribeOk ? _kBuyColor : _kSellColor,
                    width: 0.8),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                _subscribeStatus!,
                style: TextStyle(
                    color: _subscribeOk ? _kBuyColor : _kSellColor),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ── Shared error card ──────────────────────────────────────────────────────

  Widget _buildErrorCard(String error, VoidCallback retry, ColorScheme cs,
      {Key? key}) {
    return Center(
      key: key,
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.wifi_off_outlined, color: cs.error, size: 48),
            const SizedBox(height: 12),
            Text('Could not load data', style: TextStyle(color: cs.error)),
            const SizedBox(height: 4),
            Text(error,
                style: TextStyle(
                    color: cs.onSurface.withValues(alpha: 0.5), fontSize: 12),
                textAlign: TextAlign.center),
            const SizedBox(height: 16),
            TextButton(onPressed: retry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Historical Accuracy Chart – CustomPainter
// ══════════════════════════════════════════════════════════════════════════════

class _AccuracyChartPainter extends CustomPainter {
  final List<ForexHistory> history;
  final String pair;

  const _AccuracyChartPainter({required this.history, required this.pair});

  @override
  void paint(Canvas canvas, Size size) {
    if (history.isEmpty) return;

    const padLeft   = 52.0;
    const padRight  = 12.0;
    const padTop    = 14.0;
    const padBottom = 36.0;

    final cw = size.width  - padLeft - padRight;
    final ch = size.height - padTop  - padBottom;

    // Collect price range
    final prices = history.expand((h) => [h.entry, h.exit]).toList();
    final minP   = prices.reduce(math.min);
    final maxP   = prices.reduce(math.max);
    final range  = (maxP - minP) == 0 ? 1.0 : maxP - minP;

    double xOf(int i) => padLeft + (i / (history.length - 1)) * cw;
    double yOf(double p) => padTop + ch - ((p - minP) / range) * ch;

    // ── Grid lines ──
    final gridPaint = Paint()
      ..color = const Color(0xFF30363d)
      ..strokeWidth = 1;
    final labelStyle = const TextStyle(color: Color(0xFF8B949E), fontSize: 10);

    const gridLines = 4;
    final dec = _isJpy(pair) || _isGold(pair) ? 2 : 4;
    for (int g = 0; g <= gridLines; g++) {
      final y = padTop + (g / gridLines) * ch;
      canvas.drawLine(Offset(padLeft, y), Offset(padLeft + cw, y), gridPaint);

      final price = maxP - (g / gridLines) * range;
      _drawText(canvas, price.toStringAsFixed(dec), Offset(padLeft - 4, y - 6),
          labelStyle, textAlign: TextAlign.right, maxWidth: padLeft - 6);
    }

    // ── Axis lines ──
    final axisPaint = Paint()
      ..color = const Color(0xFF30363d)
      ..strokeWidth = 1;
    canvas.drawLine(Offset(padLeft, padTop), Offset(padLeft, padTop + ch + 6), axisPaint);
    canvas.drawLine(
        Offset(padLeft - 4, padTop + ch), Offset(padLeft + cw, padTop + ch), axisPaint);

    // ── Exit price line ──
    final linePaint = Paint()
      ..color = const Color(0xFF58a6ff)
      ..strokeWidth = 2
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    final path = Path();
    for (int i = 0; i < history.length; i++) {
      final x = xOf(i);
      final y = yOf(history[i].exit);
      if (i == 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
    canvas.drawPath(path, linePaint);

    // ── Prediction dots ──
    final dotBorder = Paint()
      ..color = const Color(0xFF0d1117)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;
    for (int i = 0; i < history.length; i++) {
      final h = history[i];
      final x = xOf(i);
      final y = yOf(h.exit);
      final dotFill = Paint()
        ..color = h.correct ? const Color(0xFF3fb950) : const Color(0xFFf85149);
      canvas.drawCircle(Offset(x, y), 4.5, dotFill);
      canvas.drawCircle(Offset(x, y), 4.5, dotBorder);
    }

    // ── X-axis date labels ──
    final step = math.max(1, (history.length / 6).ceil());
    for (int i = 0; i < history.length; i++) {
      if (i % step != 0 && i != history.length - 1) continue;
      final x    = xOf(i);
      final day  = history[i].day.length > 5 ? history[i].day.substring(5) : history[i].day;
      _drawText(canvas, day, Offset(x - 15, size.height - padBottom + 6),
          labelStyle, maxWidth: 30);
    }
  }

  void _drawText(
    Canvas canvas,
    String text,
    Offset offset,
    TextStyle style, {
    TextAlign textAlign = TextAlign.left,
    double maxWidth = 200,
  }) {
    final tp = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
      textAlign: textAlign,
    )..layout(maxWidth: maxWidth);
    tp.paint(canvas, offset);
  }

  @override
  bool shouldRepaint(_AccuracyChartPainter old) =>
      old.history != history || old.pair != pair;
}

// ══════════════════════════════════════════════════════════════════════════════
// _PulseDot – animated pulsing circle for live signal indicator
// ══════════════════════════════════════════════════════════════════════════════

class _PulseDot extends StatefulWidget {
  final Color color;
  const _PulseDot({required this.color});

  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _anim = Tween<double>(begin: _kPulseMinOpacity, end: _kPulseMaxOpacity).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) => Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(
          color: widget.color.withValues(alpha: _anim.value),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: widget.color.withValues(alpha: _anim.value * 0.6),
              blurRadius: 6,
              spreadRadius: 1,
            ),
          ],
        ),
      ),
    );
  }
}
