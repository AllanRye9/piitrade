import 'package:flutter/material.dart';

extension ColorCompat on Color {
  Color withValues({double? alpha, double? red, double? green, double? blue}) {
    assert(
      red == null && green == null && blue == null,
      'ColorCompat.withValues only supports alpha in this project.',
    );

    if (alpha == null) {
      return this;
    }

    return Color.fromARGB(
      (alpha.clamp(0.0, 1.0) * 255).round(),
      this.red,
      this.green,
      this.blue,
    );
  }
}