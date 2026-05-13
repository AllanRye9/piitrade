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
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;
  String _period = '24h';
  String _sortBy = 'volume';
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
      final data = await ApiService.getMovers(_period, _sortBy);
      if (mounted) setState(() => _data = data);
    } on DioException catch (e) {
      if (mounted)
        setState(() => _error = e.message ?? 'Failed to load movers');
    } catch (e) {
      if (mounted) setState(() => _error = 'Failed to load movers data');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<dynamic> _getFilteredMovers() {
    final movers = (_data?['movers'] as List<dynamic>? ?? []).where((item) {
      if (_filterCtrl.text.isEmpty) return true;
      final pair = (item['pair']?.toString() ?? '').toLowerCase();
      return pair.contains(_filterCtrl.text.toLowerCase());
    }).toList();

    if (_sortBy == 'gainers') {
      movers.sort((a, b) {
        final aChange = (a['change_percent'] as num?)?.toDouble() ?? 0;
        final bChange = (b['change_percent'] as num?)?.toDouble() ?? 0;
        return bChange.compareTo(aChange);
      });
    } else if (_sortBy == 'losers') {
      movers.sort((a, b) {
        final aChange = (a['change_percent'] as num?)?.toDouble() ?? 0;
        final bChange = (b['change_percent'] as num?)?.toDouble() ?? 0;
        return aChange.compareTo(bChange);
      });
    } else if (_sortBy == 'volume') {
      movers.sort((a, b) {
        final aVol = (a['volume'] as num?)?.toDouble() ?? 0;
        final bVol = (b['volume'] as num?)?.toDouble() ?? 0;
        return bVol.compareTo(aVol);
      });
    }

    return movers;
  }

  @override
  Widget build(BuildContext context) {
    final movers = _getFilteredMovers();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Market Movers'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: PiiColors.textMuted),
            onPressed: _load,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: PiiLoading(text: 'Loading market movers…'))
          : _error != null
              ? Center(child: PiiError(message: _error!, onRetry: _load))
              : Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        children: [
                          // Period selector
                          Row(
                            children: [
                              ...[
                                '1h',
                                '4h',
                                '24h',
                                '7d'
                              ].map((period) => Padding(
                                    padding: const EdgeInsets.only(right: 8),
                                    child: GestureDetector(
                                      onTap: () {
                                        setState(() => _period = period);
                                        _load();
                                      },
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 12, vertical: 6),
                                        decoration: BoxDecoration(
                                          color: period == _period
                                              ? PiiColors.accent
                                                  .withValues(alpha: 0.15)
                                              : Colors.transparent,
                                          borderRadius:
                                              BorderRadius.circular(6),
                                          border: Border.all(
                                            color: period == _period
                                                ? PiiColors.accent
                                                : PiiColors.border,
                                          ),
                                        ),
                                        child: Text(
                                          period,
                                          style: TextStyle(
                                            color: period == _period
                                                ? PiiColors.accent
                                                : PiiColors.textMuted,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ),
                                    ),
                                  )),
                            ],
                          ),
                          const SizedBox(height: 10),

                          // Sort and filter row
                          Row(
                            children: [
                              Expanded(
                                child: DropdownButtonFormField<String>(
                                  value: _sortBy,
                                  onChanged: (v) {
                                    setState(() => _sortBy = v!);
                                  },
                                  dropdownColor: PiiColors.surface,
                                  decoration: const InputDecoration(
                                    contentPadding: EdgeInsets.symmetric(
                                        horizontal: 12, vertical: 8),
                                    labelText: 'Sort by',
                                  ),
                                  items: const [
                                    DropdownMenuItem(
                                      value: 'volume',
                                      child: Text('Volume',
                                          style: TextStyle(
                                              color: PiiColors.text,
                                              fontSize: 13)),
                                    ),
                                    DropdownMenuItem(
                                      value: 'gainers',
                                      child: Text('Top Gainers',
                                          style: TextStyle(
                                              color: PiiColors.buy,
                                              fontSize: 13)),
                                    ),
                                    DropdownMenuItem(
                                      value: 'losers',
                                      child: Text('Top Losers',
                                          style: TextStyle(
                                              color: PiiColors.sell,
                                              fontSize: 13)),
                                    ),
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

                    // Movers list
                    Expanded(
                      child: movers.isEmpty
                          ? const Center(
                              child: Text('No movers found',
                                  style: TextStyle(
                                      color: PiiColors.textMuted,
                                      fontSize: 13)))
                          : ListView.builder(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 12),
                              itemCount: movers.length,
                              itemBuilder: (context, index) {
                                final mover = movers[index];
                                final changePercent =
                                    (mover['change_percent'] as num?)
                                            ?.toDouble() ??
                                        0;
                                final isPositive = changePercent >= 0;
                                final changeColor =
                                    isPositive ? PiiColors.buy : PiiColors.sell;
                                final changeIcon = isPositive ? '▲' : '▼';

                                return Container(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: PiiColors.surface,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: PiiColors.border),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          // Rank badge
                                          Container(
                                            width: 28,
                                            height: 28,
                                            decoration: BoxDecoration(
                                              color: index < 3
                                                  ? PiiColors.accent
                                                      .withValues(alpha: 0.15)
                                                  : PiiColors.border,
                                              borderRadius:
                                                  BorderRadius.circular(6),
                                            ),
                                            child: Center(
                                              child: Text(
                                                '${index + 1}',
                                                style: TextStyle(
                                                  color: index < 3
                                                      ? PiiColors.accent
                                                      : PiiColors.textMuted,
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          // Pair name
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  mover['pair']?.toString() ??
                                                      '—',
                                                  style: const TextStyle(
                                                    color: PiiColors.text,
                                                    fontFamily: 'monospace',
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 14,
                                                  ),
                                                ),
                                                if (mover['name'] != null) ...[
                                                  const SizedBox(height: 2),
                                                  Text(
                                                    mover['name'].toString(),
                                                    style: const TextStyle(
                                                      color:
                                                          PiiColors.textMuted,
                                                      fontSize: 11,
                                                    ),
                                                  ),
                                                ],
                                              ],
                                            ),
                                          ),
                                          // Price and change
                                          Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.end,
                                            children: [
                                              Text(
                                                mover['price']?.toString() ??
                                                    '—',
                                                style: const TextStyle(
                                                  color: PiiColors.text,
                                                  fontFamily: 'monospace',
                                                  fontWeight: FontWeight.w600,
                                                  fontSize: 14,
                                                ),
                                              ),
                                              const SizedBox(height: 4),
                                              Container(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                        horizontal: 8,
                                                        vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: changeColor.withValues(
                                                      alpha: 0.12),
                                                  borderRadius:
                                                      BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  '$changeIcon ${changePercent.abs().toStringAsFixed(2)}%',
                                                  style: TextStyle(
                                                    color: changeColor,
                                                    fontSize: 12,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                      if (mover['volume'] != null) ...[
                                        const SizedBox(height: 8),
                                        Row(
                                          children: [
                                            const Icon(Icons.bar_chart,
                                                size: 14,
                                                color: PiiColors.textMuted),
                                            const SizedBox(width: 4),
                                            Text(
                                              'Vol: ${_formatVolume(mover['volume'])}',
                                              style: const TextStyle(
                                                color: PiiColors.textMuted,
                                                fontSize: 11,
                                              ),
                                            ),
                                            const Spacer(),
                                            if (mover['high'] != null &&
                                                mover['low'] != null)
                                              Text(
                                                'H: ${mover['high']} / L: ${mover['low']}',
                                                style: const TextStyle(
                                                  color: PiiColors.textMuted,
                                                  fontSize: 11,
                                                ),
                                              ),
                                          ],
                                        ),
                                      ],
                                    ],
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                ),
    );
  }

  String _formatVolume(dynamic volume) {
    final vol = (volume as num?)?.toDouble() ?? 0;
    if (vol >= 1000000) {
      return '${(vol / 1000000).toStringAsFixed(1)}M';
    } else if (vol >= 1000) {
      return '${(vol / 1000).toStringAsFixed(1)}K';
    }
    return vol.toStringAsFixed(0);
  }
}
