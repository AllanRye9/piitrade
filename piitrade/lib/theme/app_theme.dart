import 'package:flutter/material.dart';

// PiiTrade colour palette — mirrors the web app CSS variables
class PiiColors {
  static const bg = Color(0xFF0D1117);
  static const surface = Color(0xFF161B22);
  static const border = Color(0xFF30363D);
  static const text = Color(0xFFE6EDF3);
  static const textMuted = Color(0xFF8B949E);
  static const accent = Color(0xFF58A6FF);
  static const buy = Color(0xFF3FB950);
  static const sell = Color(0xFFF85149);
  static const hold = Color(0xFFD29922);
}

ThemeData buildAppTheme() {
  return ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: PiiColors.bg,
    colorScheme: const ColorScheme.dark(
      surface: PiiColors.surface,
      primary: PiiColors.accent,
      secondary: PiiColors.buy,
      error: PiiColors.sell,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: PiiColors.surface,
      foregroundColor: PiiColors.text,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: PiiColors.surface,
      selectedItemColor: PiiColors.accent,
      unselectedItemColor: PiiColors.textMuted,
      type: BottomNavigationBarType.fixed,
    ),
    cardTheme: CardThemeData(
      color: PiiColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: PiiColors.border),
      ),
      margin: EdgeInsets.zero,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: PiiColors.bg,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: PiiColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: PiiColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: PiiColors.accent, width: 2),
      ),
      labelStyle: const TextStyle(color: PiiColors.textMuted, fontSize: 13),
      hintStyle: const TextStyle(color: PiiColors.textMuted, fontSize: 13),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: PiiColors.accent,
        foregroundColor: PiiColors.bg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: PiiColors.accent,
      ),
    ),
    dividerTheme: const DividerThemeData(color: PiiColors.border, thickness: 1),
    textTheme: const TextTheme(
      displayLarge: TextStyle(color: PiiColors.text),
      displayMedium: TextStyle(color: PiiColors.text),
      displaySmall: TextStyle(color: PiiColors.text),
      headlineLarge: TextStyle(color: PiiColors.text, fontWeight: FontWeight.bold),
      headlineMedium: TextStyle(color: PiiColors.text, fontWeight: FontWeight.bold),
      headlineSmall: TextStyle(color: PiiColors.text, fontWeight: FontWeight.w600),
      titleLarge: TextStyle(color: PiiColors.text, fontWeight: FontWeight.w600),
      titleMedium: TextStyle(color: PiiColors.text),
      titleSmall: TextStyle(color: PiiColors.textMuted),
      bodyLarge: TextStyle(color: PiiColors.text),
      bodyMedium: TextStyle(color: PiiColors.text),
      bodySmall: TextStyle(color: PiiColors.textMuted),
      labelLarge: TextStyle(color: PiiColors.text),
      labelMedium: TextStyle(color: PiiColors.textMuted),
      labelSmall: TextStyle(color: PiiColors.textMuted),
    ),
    fontFamily: 'monospace',
  );
}
