// Data models for the AI Forex Signal Hub.

class ForexHistory {
  final String day;
  final double entry;
  final double exit;
  final bool correct;
  final String direction;

  const ForexHistory({
    required this.day,
    required this.entry,
    required this.exit,
    required this.correct,
    required this.direction,
  });

  factory ForexHistory.fromJson(Map<String, dynamic> j) => ForexHistory(
        day: j['day'] as String? ?? '',
        entry: (j['entry'] as num?)?.toDouble() ?? 0.0,
        exit: (j['exit'] as num?)?.toDouble() ?? 0.0,
        correct: j['correct'] as bool? ?? false,
        direction: (j['predicted'] as String?) ?? (j['direction'] as String?) ?? '',
      );
}

class ForexSignal {
  final String pair;
  final String direction;
  final double confidence;
  final double entryPrice;
  final double takeProfit;
  final double stopLoss;
  final double accuracy30d;
  final String modelVersion;
  final List<String> featuresUsed;
  final String generatedAt;
  final bool isLive;
  final String dataSource;
  final List<ForexHistory> history;

  const ForexSignal({
    required this.pair,
    required this.direction,
    required this.confidence,
    required this.entryPrice,
    required this.takeProfit,
    required this.stopLoss,
    required this.accuracy30d,
    required this.modelVersion,
    required this.featuresUsed,
    required this.generatedAt,
    required this.isLive,
    required this.dataSource,
    required this.history,
  });

  factory ForexSignal.fromJson(Map<String, dynamic> j) => ForexSignal(
        pair: j['pair'] as String? ?? '',
        direction: j['direction'] as String? ?? 'HOLD',
        confidence: (j['confidence'] as num?)?.toDouble() ?? 0.0,
        entryPrice: (j['entry_price'] as num?)?.toDouble() ?? 0.0,
        takeProfit: (j['take_profit'] as num?)?.toDouble() ?? 0.0,
        stopLoss: (j['stop_loss'] as num?)?.toDouble() ?? 0.0,
        accuracy30d: (j['accuracy_30d'] as num?)?.toDouble() ?? 0.0,
        modelVersion: j['model_version'] as String? ?? '',
        featuresUsed: (j['features_used'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
        generatedAt: j['generated_at'] as String? ?? '',
        isLive: j['is_live'] as bool? ?? false,
        dataSource: j['data_source'] as String? ?? '',
        history: (j['history'] as List<dynamic>?)
                ?.map((e) => ForexHistory.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
      );
}
