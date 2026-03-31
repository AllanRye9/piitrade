/// Data models for the Forex Technical Analysis API response.

class SupportResistance {
  final List<double> support;
  final List<double> resistance;

  const SupportResistance({required this.support, required this.resistance});

  factory SupportResistance.fromJson(Map<String, dynamic> j) =>
      SupportResistance(
        support: (j['support'] as List<dynamic>?)
                ?.map((e) => (e as num).toDouble())
                .toList() ??
            const [],
        resistance: (j['resistance'] as List<dynamic>?)
                ?.map((e) => (e as num).toDouble())
                .toList() ??
            const [],
      );
}

class FairValueGap {
  final String type;
  final double top;
  final double bottom;
  final bool filled;
  final String created;
  final String description;

  const FairValueGap({
    required this.type,
    required this.top,
    required this.bottom,
    required this.filled,
    required this.created,
    required this.description,
  });

  factory FairValueGap.fromJson(Map<String, dynamic> j) => FairValueGap(
        type: j['type'] as String? ?? '',
        top: (j['top'] as num?)?.toDouble() ?? 0.0,
        bottom: (j['bottom'] as num?)?.toDouble() ?? 0.0,
        filled: j['filled'] as bool? ?? false,
        created: j['created'] as String? ?? '',
        description: j['description'] as String? ?? '',
      );
}

class BreakOfStructure {
  final String type;
  final double level;
  final String date;
  final String description;

  const BreakOfStructure({
    required this.type,
    required this.level,
    required this.date,
    required this.description,
  });

  factory BreakOfStructure.fromJson(Map<String, dynamic> j) =>
      BreakOfStructure(
        type: j['type'] as String? ?? '',
        level: (j['level'] as num?)?.toDouble() ?? 0.0,
        date: j['date'] as String? ?? '',
        description: j['description'] as String? ?? '',
      );
}

class ChangeOfCharacter {
  final String type;
  final double level;
  final String date;
  final String description;

  const ChangeOfCharacter({
    required this.type,
    required this.level,
    required this.date,
    required this.description,
  });

  factory ChangeOfCharacter.fromJson(Map<String, dynamic> j) =>
      ChangeOfCharacter(
        type: j['type'] as String? ?? '',
        level: (j['level'] as num?)?.toDouble() ?? 0.0,
        date: j['date'] as String? ?? '',
        description: j['description'] as String? ?? '',
      );
}

class VolumeZone {
  final double top;
  final double bottom;
  final String strength;
  final String description;

  const VolumeZone({
    required this.top,
    required this.bottom,
    required this.strength,
    required this.description,
  });

  factory VolumeZone.fromJson(Map<String, dynamic> j) => VolumeZone(
        top: (j['top'] as num?)?.toDouble() ?? 0.0,
        bottom: (j['bottom'] as num?)?.toDouble() ?? 0.0,
        strength: j['strength'] as String? ?? '',
        description: j['description'] as String? ?? '',
      );
}

class ForexTechnical {
  final String pair;
  final double currentPrice;
  final SupportResistance supportResistance;
  final List<FairValueGap> fvg;
  final List<BreakOfStructure> bos;
  final List<ChangeOfCharacter> choch;
  final List<VolumeZone> highVolumeZones;

  const ForexTechnical({
    required this.pair,
    required this.currentPrice,
    required this.supportResistance,
    required this.fvg,
    required this.bos,
    required this.choch,
    required this.highVolumeZones,
  });

  factory ForexTechnical.fromJson(Map<String, dynamic> j) => ForexTechnical(
        pair: j['pair'] as String? ?? '',
        currentPrice: (j['current_price'] as num?)?.toDouble() ?? 0.0,
        supportResistance: SupportResistance.fromJson(
          j['support_resistance'] as Map<String, dynamic>? ?? {},
        ),
        fvg: (j['fvg'] as List<dynamic>?)
                ?.map((e) => FairValueGap.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
        bos: (j['bos'] as List<dynamic>?)
                ?.map((e) => BreakOfStructure.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
        choch: (j['choch'] as List<dynamic>?)
                ?.map((e) => ChangeOfCharacter.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
        highVolumeZones: (j['high_volume_zones'] as List<dynamic>?)
                ?.map((e) => VolumeZone.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
      );
}
