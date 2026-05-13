import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';

class RiskCalculatorScreen extends StatefulWidget {
  const RiskCalculatorScreen({super.key});

  @override
  State<RiskCalculatorScreen> createState() => _RiskCalculatorScreenState();
}

class _RiskCalculatorScreenState extends State<RiskCalculatorScreen> {
  final _balanceCtrl = TextEditingController(text: '10000');
  final _riskCtrl = TextEditingController(text: '1');
  final _entryCtrl = TextEditingController();
  final _slCtrl = TextEditingController();
  final _tpCtrl = TextEditingController();
  String _pairType = 'forex';

  @override
  void initState() {
    super.initState();
    for (final ctrl in [
      _balanceCtrl,
      _riskCtrl,
      _entryCtrl,
      _slCtrl,
      _tpCtrl
    ]) {
      ctrl.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    for (final ctrl in [
      _balanceCtrl,
      _riskCtrl,
      _entryCtrl,
      _slCtrl,
      _tpCtrl
    ]) {
      ctrl.dispose();
    }
    super.dispose();
  }

  Map<String, dynamic>? get _result {
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
      'slPips': slPips,
      'tpPips': tpPips,
      'lots': lots,
      'units': units,
      'rr': rr,
      'riskPct': riskPct,
    };
  }

  double get _riskPct => double.tryParse(_riskCtrl.text) ?? 0;

  @override
  Widget build(BuildContext context) {
    final result = _result;
    final riskLevel = _riskPct <= 1
        ? 'Conservative'
        : _riskPct <= 2
            ? 'Moderate'
            : _riskPct <= 3
                ? 'Aggressive'
                : 'Very High Risk';
    final Color riskColor = _riskPct <= 1
        ? PiiColors.buy
        : _riskPct <= 2
            ? PiiColors.hold
            : PiiColors.sell;

    return Scaffold(
      appBar: AppBar(title: const Text('Risk Calculator')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Position Size Calculator',
                      style: TextStyle(
                          color: PiiColors.text,
                          fontWeight: FontWeight.bold,
                          fontSize: 16)),
                  const SizedBox(height: 4),
                  const Text(
                      'Calculate your optimal position size based on account risk.',
                      style:
                          TextStyle(color: PiiColors.textMuted, fontSize: 13)),
                  const SizedBox(height: 16),

                  // Risk meter
                  if (_riskPct > 0) ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Risk Level',
                            style: TextStyle(
                                color: PiiColors.textMuted, fontSize: 12)),
                        Text(riskLevel,
                            style: TextStyle(
                                color: riskColor,
                                fontSize: 12,
                                fontWeight: FontWeight.w600)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: (_riskPct / 5).clamp(0, 1),
                        backgroundColor: PiiColors.border,
                        color: riskColor,
                        minHeight: 8,
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  _InputRow(
                    label: 'Account Balance',
                    controller: _balanceCtrl,
                    suffix: 'USD',
                    hint: 'Your available trading capital',
                  ),
                  const SizedBox(height: 12),
                  _InputRow(
                    label: 'Risk Per Trade',
                    controller: _riskCtrl,
                    suffix: '%',
                    hint: 'Most disciplined traders stay around 1–2%',
                  ),
                  const SizedBox(height: 12),
                  _InputRow(
                    label: 'Entry Price',
                    controller: _entryCtrl,
                    hint: 'Planned market entry',
                  ),
                  const SizedBox(height: 12),
                  _InputRow(
                    label: 'Stop Loss',
                    controller: _slCtrl,
                    hint: 'Invalidates the trade if reached',
                  ),
                  const SizedBox(height: 12),
                  _InputRow(
                    label: 'Take Profit',
                    controller: _tpCtrl,
                    hint: 'Optional target for reward calculations',
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _pairType,
                    onChanged: (v) => setState(() => _pairType = v!),
                    dropdownColor: PiiColors.surface,
                    decoration:
                        const InputDecoration(labelText: 'Instrument Type'),
                    items: const [
                      DropdownMenuItem(
                          value: 'forex',
                          child: Text('Forex (non-JPY)',
                              style: TextStyle(
                                  color: PiiColors.text, fontSize: 13))),
                      DropdownMenuItem(
                          value: 'jpy',
                          child: Text('Forex JPY pairs',
                              style: TextStyle(
                                  color: PiiColors.text, fontSize: 13))),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Results
            if (result != null)
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Results',
                        style: TextStyle(
                            color: PiiColors.text,
                            fontWeight: FontWeight.bold,
                            fontSize: 16)),
                    const SizedBox(height: 12),
                    _ResultRow(
                        label: 'Account Risk',
                        value:
                            '\$${(result['riskAmount'] as double).toStringAsFixed(2)}',
                        color: PiiColors.sell,
                        large: true),
                    _ResultRow(
                        label: 'Stop Loss Distance',
                        value:
                            '${(result['slPips'] as double).toStringAsFixed(1)} pips'),
                    _ResultRow(
                        label: 'Position Size',
                        value:
                            '${(result['units'] as double).toStringAsFixed(0)} units',
                        color: PiiColors.accent,
                        large: true),
                    _ResultRow(
                        label: 'Standard Lots',
                        value: (result['lots'] as double).toStringAsFixed(2),
                        color: PiiColors.accent),
                    if (result['rr'] != null) ...[
                      _ResultRow(
                          label: 'Risk : Reward',
                          value:
                              '1:${(result['rr'] as double).toStringAsFixed(2)}',
                          color: (result['rr'] as double) >= 2
                              ? PiiColors.buy
                              : PiiColors.hold),
                      _ResultRow(
                          label: 'Take Profit Distance',
                          value:
                              '${(result['tpPips'] as double).toStringAsFixed(1)} pips'),
                    ],
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: PiiColors.hold.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                            color: PiiColors.hold.withValues(alpha: 0.3)),
                      ),
                      child: const Text(
                          '⚠️ Always verify position size with your broker before placing a live trade.',
                          style: TextStyle(
                              color: PiiColors.textMuted,
                              fontSize: 12,
                              height: 1.4)),
                    ),
                  ],
                ),
              )
            else
              SectionCard(
                child: Column(
                  children: [
                    const Text('📊', style: TextStyle(fontSize: 36)),
                    const SizedBox(height: 8),
                    const Text(
                        'Fill in your account balance, risk %, entry price, and stop loss above to calculate the optimal position size.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            color: PiiColors.textMuted,
                            fontSize: 13,
                            height: 1.5)),
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

class _InputRow extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final String? suffix;
  final String? hint;

  const _InputRow({
    required this.label,
    required this.controller,
    this.suffix,
    this.hint,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(),
            style: const TextStyle(
                color: PiiColors.textMuted,
                fontSize: 10,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.5)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          style: const TextStyle(
              color: PiiColors.text, fontFamily: 'monospace', fontSize: 14),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            hintText: hint,
            suffixText: suffix,
            suffixStyle: const TextStyle(
                color: PiiColors.textMuted,
                fontSize: 12,
                fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}

class _ResultRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? color;
  final bool large;

  const _ResultRow({
    required this.label,
    required this.value,
    this.color,
    this.large = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(color: PiiColors.textMuted, fontSize: 13)),
          Text(value,
              style: TextStyle(
                  color: color ?? PiiColors.text,
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.bold,
                  fontSize: large ? 16 : 13)),
        ],
      ),
    );
  }
}
