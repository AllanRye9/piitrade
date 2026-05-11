import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../widgets/common_widgets.dart';

class AdvanceScreen extends StatefulWidget {
  const AdvanceScreen({super.key});

  @override
  State<AdvanceScreen> createState() => _AdvanceScreenState();
}

class _AdvanceScreenState extends State<AdvanceScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Advanced Tools'),
        bottom: TabBar(
          controller: _tabController,
          labelColor: PiiColors.accent,
          unselectedLabelColor: PiiColors.textMuted,
          indicatorColor: PiiColors.accent,
          isScrollable: true,
          tabs: const [
            Tab(text: 'FVG Scanner'),
            Tab(text: 'S/R Breakouts'),
            Tab(text: 'Patterns'),
            Tab(text: 'Calendar'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          _FvgScannerTab(),
          _SrBreakoutsTab(),
          _PatternScannerTab(),
          _EconomicCalendarTab(),
        ],
      ),
    );
  }
}

// ── FVG Scanner ───────────────────────────────────────────────────────────────
class _FvgScannerTab extends StatefulWidget {
  const _FvgScannerTab();

  @override
  State<_FvgScannerTab> createState() => _FvgScannerTabState();
}

class _FvgScannerTabState extends State<_FvgScannerTab> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;
  int _tabIdx = 0;
  final _filterCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    _filterCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _filterCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ApiService.getFvgScanner();
      if (mounted) setState(() => _data = data);
    } on DioException catch (e) {
      if (mounted) setState(() => _error = e.message ?? 'Failed to load');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const tabs = ['approaching', 'reached', 'rejected'];
    final grouped = _data?['grouped'] as Map<String, dynamic>? ?? {};
    final items = ((grouped[tabs[_tabIdx]] as List<dynamic>? ?? []))
        .where((item) =>
            _filterCtrl.text.isEmpty ||
            (item['pair']?.toString().toLowerCase() ?? '')
                .contains(_filterCtrl.text.toLowerCase()))
        .toList();

    return _loading
        ? const Center(child: PiiLoading())
        : _error != null
            ? Center(child: PiiError(message: _error!, onRetry: _load))
            : Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      children: [
                        PiiTabBar(
                          tabs: tabs
                              .map((t) =>
                                  '${t[0].toUpperCase()}${t.substring(1)} '
                                  '(${(grouped[t] as List?)?.length ?? 0})')
                              .toList(),
                          selectedIndex: _tabIdx,
                          onTap: (i) => setState(() => _tabIdx = i),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _filterCtrl,
                          style: const TextStyle(
                              color: PiiColors.text,
                              fontFamily: 'monospace',
                              fontSize: 13),
                          decoration: const InputDecoration(
                            hintText: 'Filter pair, e.g. EUR/USD',
                            prefixIcon: Icon(Icons.search,
                                color: PiiColors.textMuted, size: 18),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: items.isEmpty
                        ? Center(
                            child: Text(
                                'No ${tabs[_tabIdx]} FVG zones found',
                                style: const TextStyle(
                                    color: PiiColors.textMuted,
                                    fontSize: 13)))
                        : ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            itemCount: items.length,
                            itemBuilder: (context, i) {
                              final item = items[i];
                              final isBullish = (item['fvg_type']
                                          ?.toString() ??
                                      '')
                                  .toLowerCase() ==
                                  'bullish';
                              return Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: PiiColors.surface,
                                  borderRadius: BorderRadius.circular(10),
                                  border:
                                      Border.all(color: PiiColors.border),
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      flex: 2,
                                      child: Text(
                                          item['pair']?.toString() ?? '',
                                          style: const TextStyle(
                                              color: PiiColors.accent,
                                              fontFamily: 'monospace',
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13)),
                                    ),
                                    Expanded(
                                      flex: 2,
                                      child: Text(
                                          item['fvg_type']?.toString() ??
                                              '—',
                                          style: TextStyle(
                                              color: isBullish
                                                  ? PiiColors.buy
                                                  : PiiColors.sell,
                                              fontSize: 12)),
                                    ),
                                    Expanded(
                                      flex: 3,
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.end,
                                        children: [
                                          Text(
                                              'T: ${item['top'] ?? '—'}',
                                              style: const TextStyle(
                                                  color: PiiColors.sell,
                                                  fontFamily: 'monospace',
                                                  fontSize: 11)),
                                          Text(
                                              'B: ${item['bottom'] ?? '—'}',
                                              style: const TextStyle(
                                                  color: PiiColors.buy,
                                                  fontFamily: 'monospace',
                                                  fontSize: 11)),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                ],
              );
  }
}

// ── S/R Breakouts ─────────────────────────────────────────────────────────────
class _SrBreakoutsTab extends StatefulWidget {
  const _SrBreakoutsTab();

  @override
  State<_SrBreakoutsTab> createState() => _SrBreakoutsTabState();
}

class _SrBreakoutsTabState extends State<_SrBreakoutsTab> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;
  final _filterCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    _filterCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _filterCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ApiService.getSrBreakouts();
      if (mounted) setState(() => _data = data);
    } on DioException catch (e) {
      if (mounted) setState(() => _error = e.message ?? 'Failed to load');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final groups = _data?['sr_groups'] as Map<String, dynamic>? ?? {};
    final items = ((groups['soon_touching'] as List<dynamic>? ?? []))
        .where((item) =>
            _filterCtrl.text.isEmpty ||
            (item['pair']?.toString().toLowerCase() ?? '')
                .contains(_filterCtrl.text.toLowerCase()))
        .toList();

    return _loading
        ? const Center(child: PiiLoading())
        : _error != null
            ? Center(child: PiiError(message: _error!, onRetry: _load))
            : Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 8),
                                decoration: BoxDecoration(
                                  color: PiiColors.accent.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                      color: PiiColors.accent),
                                ),
                                child: const Text(
                                    'Soon Touching',
                                    style: TextStyle(
                                        color: PiiColors.accent,
                                        fontWeight: FontWeight.w500,
                                        fontSize: 13)),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.refresh,
                                  color: PiiColors.textMuted, size: 20),
                              onPressed: _load,
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _filterCtrl,
                          style: const TextStyle(
                              color: PiiColors.text,
                              fontFamily: 'monospace',
                              fontSize: 13),
                          decoration: const InputDecoration(
                            hintText: 'Filter pair, e.g. XAU/USD',
                            prefixIcon: Icon(Icons.search,
                                color: PiiColors.textMuted, size: 18),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: items.isEmpty
                        ? const Center(
                            child: Text('No soon-touching breakouts found',
                                style: TextStyle(
                                    color: PiiColors.textMuted,
                                    fontSize: 13)))
                        : ListView.builder(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 12),
                            itemCount: items.length,
                            itemBuilder: (context, i) {
                              final item = items[i];
                              return Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: PiiColors.surface,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                      color: PiiColors.border),
                                ),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                            item['pair']?.toString() ?? '',
                                            style: const TextStyle(
                                                color: PiiColors.accent,
                                                fontFamily: 'monospace',
                                                fontWeight: FontWeight.bold,
                                                fontSize: 13)),
                                        const Spacer(),
                                        Text(
                                            item['level']?.toString() ?? '—',
                                            style: const TextStyle(
                                                color: PiiColors.text,
                                                fontFamily: 'monospace',
                                                fontSize: 13)),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(item['type']?.toString() ?? '—',
                                        style: const TextStyle(
                                            color: PiiColors.textMuted,
                                            fontSize: 12)),
                                    if (item['description'] != null)
                                      Text(item['description'].toString(),
                                          style: const TextStyle(
                                              color: PiiColors.textMuted,
                                              fontSize: 12)),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                ],
              );
  }
}

// ── Pattern Scanner ───────────────────────────────────────────────────────────
class _PatternScannerTab extends StatefulWidget {
  const _PatternScannerTab();

  @override
  State<_PatternScannerTab> createState() => _PatternScannerTabState();
}

class _PatternScannerTabState extends State<_PatternScannerTab> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;
  String _timeframe = '1h';
  final _filterCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    _filterCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _filterCtrl.dispose();
    super.dispose();
  }

  Future<void> _load([String? tf]) async {
    final timeframe = tf ?? _timeframe;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ApiService.getPatternScanner(timeframe);
      if (mounted) setState(() => _data = data);
    } on DioException catch (e) {
      if (mounted) setState(() => _error = e.message ?? 'Failed to load');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Color _dirColor(String? dir) {
    final d = (dir ?? '').toUpperCase();
    if (d == 'BUY') return PiiColors.buy;
    if (d == 'SELL') return PiiColors.sell;
    return PiiColors.textMuted;
  }

  @override
  Widget build(BuildContext context) {
    final patterns = ((_data?['patterns'] as List<dynamic>? ?? []))
        .where((p) =>
            _filterCtrl.text.isEmpty ||
            (p['pair']?.toString().toLowerCase() ?? '')
                .contains(_filterCtrl.text.toLowerCase()))
        .toList();

    return _loading
        ? const Center(child: PiiLoading())
        : _error != null
            ? Center(child: PiiError(message: _error!, onRetry: _load))
            : Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            ...['30m', '1h', '4h', '1day'].map((tf) => Padding(
                                  padding: const EdgeInsets.only(right: 8),
                                  child: GestureDetector(
                                    onTap: () {
                                      setState(() => _timeframe = tf);
                                      _load(tf);
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 12, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: tf == _timeframe
                                            ? PiiColors.accent
                                                .withOpacity(0.15)
                                            : Colors.transparent,
                                        borderRadius:
                                            BorderRadius.circular(6),
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
                                              fontWeight:
                                                  FontWeight.w500)),
                                    ),
                                  ),
                                )),
                          ],
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _filterCtrl,
                          style: const TextStyle(
                              color: PiiColors.text,
                              fontFamily: 'monospace',
                              fontSize: 13),
                          decoration: const InputDecoration(
                            hintText: 'Filter pair…',
                            prefixIcon: Icon(Icons.search,
                                color: PiiColors.textMuted, size: 18),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: patterns.isEmpty
                        ? Center(
                            child: Text(
                                'No patterns found for $_timeframe',
                                style: const TextStyle(
                                    color: PiiColors.textMuted,
                                    fontSize: 13)))
                        : ListView.builder(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 12),
                            itemCount: patterns.length,
                            itemBuilder: (context, i) {
                              final p = patterns[i];
                              final dir =
                                  p['direction']?.toString() ?? '';
                              final dirUp = dir.toUpperCase();
                              final Color dColor = _dirColor(dir);
                              return Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: PiiColors.surface,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                      color: PiiColors.border),
                                ),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                            p['pair']?.toString() ?? '',
                                            style: const TextStyle(
                                                color: PiiColors.accent,
                                                fontFamily: 'monospace',
                                                fontWeight: FontWeight.bold,
                                                fontSize: 13)),
                                        const SizedBox(width: 8),
                                        Text(
                                            p['type'] ??
                                                p['label'] ??
                                                '—',
                                            style: const TextStyle(
                                                color: PiiColors.text,
                                                fontWeight: FontWeight.w500,
                                                fontSize: 13)),
                                        const Spacer(),
                                        if (dir.isNotEmpty)
                                          Container(
                                            padding:
                                                const EdgeInsets.symmetric(
                                                    horizontal: 8,
                                                    vertical: 2),
                                            decoration: BoxDecoration(
                                              color: dColor
                                                  .withOpacity(0.15),
                                              borderRadius:
                                                  BorderRadius.circular(
                                                      10),
                                            ),
                                            child: Text(
                                                '${dirUp == 'BUY' ? '▲' : dirUp == 'SELL' ? '▼' : '◆'} $dirUp',
                                                style: TextStyle(
                                                    color: dColor,
                                                    fontSize: 11,
                                                    fontWeight:
                                                        FontWeight.bold)),
                                          ),
                                        if (p['impact'] != null) ...[
                                          const SizedBox(width: 6),
                                          ImpactBadge(
                                              impact: p['impact']
                                                  ?.toString()),
                                        ],
                                      ],
                                    ),
                                    if (p['description'] != null) ...[
                                      const SizedBox(height: 4),
                                      Text(p['description'].toString(),
                                          style: const TextStyle(
                                              color: PiiColors.textMuted,
                                              fontSize: 12)),
                                    ],
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                ],
              );
  }
}

// ── Economic Calendar ────────────────────────────────────────────────────────
class _EconomicCalendarTab extends StatefulWidget {
  const _EconomicCalendarTab();

  @override
  State<_EconomicCalendarTab> createState() => _EconomicCalendarTabState();
}

class _EconomicCalendarTabState extends State<_EconomicCalendarTab> {
  List<dynamic> _events = [];
  bool _loading = true;
  String? _error;
  String _impactFilter = 'all';
  final _pairFilterCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    _pairFilterCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _pairFilterCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final events = await ApiService.getEconomicCalendar();
      if (mounted) setState(() => _events = events);
    } on DioException catch (e) {
      if (mounted) setState(() => _error = e.message ?? 'Failed to load');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<dynamic> get _filtered {
    return _events.where((ev) {
      final impactMatches = _impactFilter == 'all' ||
          (ev['impact'] ?? '').toString().toLowerCase() == _impactFilter;
      final pf = _pairFilterCtrl.text.toUpperCase();
      bool pairMatches = true;
      if (pf.isNotEmpty) {
        final cur = (ev['currency'] ?? '').toString().toUpperCase();
        if (pf.contains('/')) {
          final parts = pf.split('/');
          pairMatches = parts.contains(cur);
        } else {
          pairMatches = cur.contains(pf);
        }
      }
      return impactMatches && pairMatches;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    return _loading
        ? const Center(child: PiiLoading())
        : _error != null
            ? Center(child: PiiError(message: _error!, onRetry: _load))
            : Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                value: _impactFilter,
                                onChanged: (v) =>
                                    setState(() => _impactFilter = v!),
                                dropdownColor: PiiColors.surface,
                                decoration: const InputDecoration(
                                    contentPadding:
                                        EdgeInsets.symmetric(
                                            horizontal: 12,
                                            vertical: 8)),
                                items: const [
                                  DropdownMenuItem(
                                      value: 'all',
                                      child: Text('All impact',
                                          style: TextStyle(
                                              color: PiiColors.text,
                                              fontSize: 13))),
                                  DropdownMenuItem(
                                      value: 'high',
                                      child: Text('High impact',
                                          style: TextStyle(
                                              color: PiiColors.sell,
                                              fontSize: 13))),
                                  DropdownMenuItem(
                                      value: 'medium',
                                      child: Text('Medium impact',
                                          style: TextStyle(
                                              color: Color(0xFF3B82F6),
                                              fontSize: 13))),
                                  DropdownMenuItem(
                                      value: 'low',
                                      child: Text('Low impact',
                                          style: TextStyle(
                                              color: PiiColors.buy,
                                              fontSize: 13))),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            IconButton(
                              icon: const Icon(Icons.refresh,
                                  color: PiiColors.textMuted, size: 20),
                              onPressed: _load,
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _pairFilterCtrl,
                          style: const TextStyle(
                              color: PiiColors.text,
                              fontFamily: 'monospace',
                              fontSize: 13),
                          decoration: const InputDecoration(
                            hintText: 'Filter by pair, e.g. GBP/JPY',
                            prefixIcon: Icon(Icons.search,
                                color: PiiColors.textMuted, size: 18),
                          ),
                          textCapitalization: TextCapitalization.characters,
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: filtered.isEmpty
                        ? const Center(
                            child: Text('No events found',
                                style: TextStyle(
                                    color: PiiColors.textMuted,
                                    fontSize: 13)))
                        : ListView.builder(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 12),
                            itemCount: filtered.length,
                            itemBuilder: (context, i) {
                              final ev = filtered[i];
                              final impact =
                                  (ev['impact'] ?? '').toString().toLowerCase();
                              final Color impactColor = impact == 'high'
                                  ? PiiColors.sell
                                  : impact == 'medium'
                                      ? const Color(0xFF3B82F6)
                                      : PiiColors.textMuted;
                              return Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: PiiColors.surface,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                      color: PiiColors.border),
                                ),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                              ev['event']?.toString() ?? '',
                                              style: const TextStyle(
                                                  color: PiiColors.text,
                                                  fontWeight:
                                                      FontWeight.w500,
                                                  fontSize: 13),
                                              maxLines: 2,
                                              overflow:
                                                  TextOverflow.ellipsis),
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                            (ev['impact'] ?? '')
                                                .toString()
                                                .toUpperCase(),
                                            style: TextStyle(
                                                color: impactColor,
                                                fontSize: 11,
                                                fontWeight:
                                                    FontWeight.bold)),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    Row(
                                      children: [
                                        Text(
                                            ev['currency']?.toString() ??
                                                '',
                                            style: const TextStyle(
                                                color: PiiColors.accent,
                                                fontFamily: 'monospace',
                                                fontWeight: FontWeight.bold,
                                                fontSize: 12)),
                                        const SizedBox(width: 8),
                                        Text(
                                            ev['time']?.toString() ?? '',
                                            style: const TextStyle(
                                                color: PiiColors.textMuted,
                                                fontSize: 12)),
                                        if (ev['forecast'] != null) ...[
                                          const SizedBox(width: 8),
                                          Text(
                                              'Fcst: ${ev['forecast']}',
                                              style: const TextStyle(
                                                  color:
                                                      PiiColors.textMuted,
                                                  fontSize: 11)),
                                        ],
                                        if (ev['previous'] != null) ...[
                                          const SizedBox(width: 8),
                                          Text(
                                              'Prev: ${ev['previous']}',
                                              style: const TextStyle(
                                                  color:
                                                      PiiColors.textMuted,
                                                  fontSize: 11)),
                                        ],
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                ],
              );
  }
}
