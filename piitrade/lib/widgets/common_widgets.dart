import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

// Helper function to create color with opacity
Color _withOpacity(Color color, double opacity) {
  return Color.fromRGBO(
    (color.r * 255.0).round(),
    (color.g * 255.0).round(),
    (color.b * 255.0).round(),
    opacity,
  );
}

// ── Direction badge (BUY / SELL / HOLD) ─────────────────────────────────────
class DirectionBadge extends StatelessWidget {
  final String? direction;
  const DirectionBadge({super.key, required this.direction});

  @override
  Widget build(BuildContext context) {
    final d = (direction ?? '').toUpperCase();
    Color color;
    String label;
    if (d == 'BUY') {
      color = PiiColors.buy;
      label = '▲ BUY';
    } else if (d == 'SELL') {
      color = PiiColors.sell;
      label = '▼ SELL';
    } else {
      color = PiiColors.hold;
      label = '◆ HOLD';
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: _withOpacity(color, 0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _withOpacity(color, 0.5)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.bold,
          fontSize: 13,
        ),
      ),
    );
  }
}

// ── Confidence bar ───────────────────────────────────────────────────────────
class ConfidenceBar extends StatelessWidget {
  final double? value;
  const ConfidenceBar({super.key, required this.value});

  @override
  Widget build(BuildContext context) {
    final pct = (value ?? 0).clamp(0.0, 100.0);
    final Color color = pct >= 70
        ? PiiColors.buy
        : pct >= 50
            ? PiiColors.hold
            : PiiColors.sell;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Confidence',
              style: TextStyle(color: PiiColors.textMuted, fontSize: 12),
            ),
            Text(
              '${pct.toStringAsFixed(1)}%',
              style: TextStyle(color: color, fontSize: 12),
            ),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: pct / 100,
            backgroundColor: PiiColors.border,
            color: color,
            minHeight: 6,
          ),
        ),
      ],
    );
  }
}

// ── Price row ────────────────────────────────────────────────────────────────
class PriceRow extends StatelessWidget {
  final String label;
  final dynamic value;
  final Color? color;

  const PriceRow({
    super.key,
    required this.label,
    required this.value,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(color: PiiColors.textMuted, fontSize: 13),
          ),
          Text(
            value?.toString() ?? '—',
            style: TextStyle(
              color: color ?? PiiColors.text,
              fontFamily: 'monospace',
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Section card ─────────────────────────────────────────────────────────────
class SectionCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets? padding;

  const SectionCard({super.key, required this.child, this.padding});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: PiiColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: PiiColors.border),
      ),
      child: child,
    );
  }
}

// ── Loading indicator ────────────────────────────────────────────────────────
class PiiLoading extends StatelessWidget {
  final String? text;
  const PiiLoading({super.key, this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation(PiiColors.accent),
            strokeWidth: 2,
          ),
          if (text != null) ...[
            const SizedBox(height: 12),
            Text(
              text!,
              style: const TextStyle(color: PiiColors.textMuted, fontSize: 13),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }
}

// ── Error widget ─────────────────────────────────────────────────────────────
class PiiError extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;

  const PiiError({super.key, required this.message, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('⚠️', style: TextStyle(fontSize: 28)),
          const SizedBox(height: 8),
          Text(
            message,
            style: const TextStyle(color: PiiColors.textMuted, fontSize: 13),
            textAlign: TextAlign.center,
          ),
          if (onRetry != null) ...[
            const SizedBox(height: 12),
            TextButton(
              onPressed: onRetry,
              child: const Text(
                '↻ Retry',
                style: TextStyle(color: PiiColors.accent),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Pair chip ────────────────────────────────────────────────────────────────
class PairChip extends StatelessWidget {
  final String pair;
  final bool selected;
  final bool active; // has an open signal
  final VoidCallback onTap;

  const PairChip({
    super.key,
    required this.pair,
    required this.selected,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final Color borderColor = active
        ? PiiColors.buy
        : selected
            ? PiiColors.accent
            : PiiColors.border;
    final Color textColor = active
        ? PiiColors.buy
        : selected
            ? PiiColors.accent
            : PiiColors.textMuted;
    final Color bg = active
        ? _withOpacity(PiiColors.buy, 0.12)
        : selected
            ? _withOpacity(PiiColors.accent, 0.1)
            : Colors.transparent;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: borderColor),
        ),
        child: Text(
          pair,
          style: TextStyle(
            color: textColor,
            fontSize: 12,
            fontWeight: FontWeight.w500,
            fontFamily: 'monospace',
          ),
        ),
      ),
    );
  }
}

// ── Tab bar ──────────────────────────────────────────────────────────────────
class PiiTabBar extends StatelessWidget {
  final List<String> tabs;
  final int selectedIndex;
  final ValueChanged<int> onTap;

  const PiiTabBar({
    super.key,
    required this.tabs,
    required this.selectedIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List.generate(tabs.length, (i) {
          final selected = i == selectedIndex;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => onTap(i),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: selected
                      ? _withOpacity(PiiColors.accent, 0.15)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: selected ? PiiColors.accent : PiiColors.border,
                  ),
                ),
                child: Text(
                  tabs[i],
                  style: TextStyle(
                    color: selected ? PiiColors.accent : PiiColors.textMuted,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

// ── Impact badge ─────────────────────────────────────────────────────────────
class ImpactBadge extends StatelessWidget {
  final String? impact;
  const ImpactBadge({super.key, this.impact});

  @override
  Widget build(BuildContext context) {
    if (impact == null || impact!.isEmpty) return const SizedBox.shrink();
    final i = impact!.toLowerCase();
    final Color color = i == 'high'
        ? PiiColors.sell
        : i == 'medium'
            ? const Color(0xFF3B82F6)
            : PiiColors.textMuted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: _withOpacity(color, 0.15),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        impact!.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ── Accent button ────────────────────────────────────────────────────────────
class AccentButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;

  const AccentButton({
    super.key,
    required this.label,
    this.onPressed,
    this.loading = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: loading ? null : onPressed,
      child: loading
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation(PiiColors.bg),
              ),
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 16),
                  const SizedBox(width: 6),
                ],
                Text(label),
              ],
            ),
    );
  }
}
