import 'package:flutter/material.dart';

/// Typography scale aligned with CleanMateX Brand Spec v1.1 (Poppins EN + Tajawal AR).
class AppTextStyles {
  const AppTextStyles._();

  static const List<String> _enFontFallback = ['Poppins', 'Segoe UI', 'Roboto'];
  static const List<String> _arFontFallback = ['Tajawal', 'Segoe UI', 'Arial'];

  static TextStyle tabular(TextStyle? base) {
    return (base ?? const TextStyle()).copyWith(
      fontFeatures: const [FontFeature.tabularFigures()],
    );
  }

  static TextTheme textTheme(
    Color textColor,
    Color mutedColor, {
    bool isArabic = false,
  }) {
    final fallback = isArabic ? _arFontFallback : _enFontFallback;
    return TextTheme(
      headlineMedium: TextStyle(
        fontSize: 24,
        fontWeight: FontWeight.w800,
        color: textColor,
        letterSpacing: isArabic ? 0 : -0.4,
        height: 1.25,
        fontFamilyFallback: fallback,
      ),
      titleLarge: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: textColor,
        height: 1.3,
        fontFamilyFallback: fallback,
      ),
      titleMedium: TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        color: textColor,
        height: 1.35,
        fontFamilyFallback: fallback,
      ),
      bodyLarge: TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w400,
        color: textColor,
        height: 1.45,
        fontFamilyFallback: fallback,
      ),
      bodyMedium: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: textColor,
        height: 1.45,
        fontFamilyFallback: fallback,
      ),
      bodySmall: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        color: mutedColor,
        height: 1.4,
        fontFamilyFallback: fallback,
      ),
      labelLarge: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        color: textColor,
        letterSpacing: isArabic ? 0 : 0.1,
        fontFamilyFallback: fallback,
      ),
      labelSmall: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: mutedColor,
        fontFamilyFallback: fallback,
      ),
    );
  }
}
