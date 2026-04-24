import 'package:flutter/material.dart';

class AppTextStyles {
  const AppTextStyles._();

  static TextTheme textTheme(Color textColor, Color mutedColor) {
    return TextTheme(
      headlineMedium: TextStyle(
        fontSize: 26,
        fontWeight: FontWeight.w700,
        color: textColor,
        letterSpacing: -0.5,
      ),
      titleLarge: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: textColor,
      ),
      titleMedium: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: textColor,
      ),
      bodyLarge: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        color: textColor,
      ),
      bodyMedium: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: textColor,
      ),
      bodySmall: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        color: mutedColor,
      ),
      labelLarge: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: textColor,
        letterSpacing: 0.1,
      ),
    );
  }
}
