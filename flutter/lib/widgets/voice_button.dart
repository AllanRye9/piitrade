import 'package:flutter/material.dart';

/// Animated microphone button used on the presentation screen.
///
/// Set [listening] to `true` while voice recognition is active.
/// Set [unavailable] to `true` when the microphone permission is denied.
class VoiceButton extends StatelessWidget {
  final bool listening;
  final bool unavailable;
  final VoidCallback onTap;

  const VoiceButton({
    super.key,
    required this.listening,
    required this.onTap,
    this.unavailable = false,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    Color bgColor;
    if (unavailable) {
      bgColor = cs.onSurface.withValues(alpha: 0.3);
    } else if (listening) {
      bgColor = cs.error;
    } else {
      bgColor = cs.primary;
    }

    return Tooltip(
      message: unavailable
          ? 'Microphone permission denied'
          : listening
              ? 'Tap to stop listening'
              : 'Tap to speak',
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: bgColor,
            boxShadow: listening
                ? [
                    BoxShadow(
                      color: cs.error.withValues(alpha: 0.5),
                      blurRadius: 16,
                      spreadRadius: 4,
                    )
                  ]
                : [],
          ),
          child: Icon(
            unavailable
                ? Icons.mic_off
                : listening
                    ? Icons.mic
                    : Icons.mic_none,
            color: Colors.white,
            size: 28,
          ),
        ),
      ),
    );
  }
}
