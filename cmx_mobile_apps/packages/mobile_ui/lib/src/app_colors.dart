import 'package:flutter/material.dart';

/// CleanMateX Go Brand Spec v1.1 color tokens (Light & Dark modes).
class AppColors {
  const AppColors._();

  // Brand Core (CleanMateX Brand Spec v1.1)
  static const primary = Color(0xFF0AB6D8); // Aqua Blue
  static const primaryText = Color(0xFF0888A3); // WCAG AA >=4.5:1 on white
  static const primaryDark = Color(0xFF38D1EE);
  static const secondary = Color(0xFF0E2A47); // Deep Navy
  static const secondaryDark = Color(0xFFE2EEFA);
  static const accentEmerald = Color(0xFF1DBF73); // Sparkle-X Emerald

  // Semantic Status Colors
  static const success = Color(0xFF14B8A6); // Teal
  static const successText = Color(0xFF0F766E);
  static const successBg = Color(0xFFCCFBF1);
  static const successDarkText = Color(0xFF5EEAD4);
  static const successDarkBg = Color(0xFF134E4A);

  static const warning = Color(0xFFFFB100); // Amber
  static const warningText = Color(0xFF92400E);
  static const warningBg = Color(0xFFFEF3C7);
  static const warningBorder = Color(0xFFFCD34D);
  static const warningDarkText = Color(0xFFFCD34D);
  static const warningDarkBg = Color(0xFF3B2806);

  static const error = Color(0xFFE44D4D); // Coral Red
  static const errorText = Color(0xFFB91C1C);
  static const errorBg = Color(0xFFFEE2E2);
  static const errorBorder = Color(0xFFFECACA);
  static const errorDarkText = Color(0xFFFCA5A5);
  static const errorDarkBg = Color(0xFF451A1A);

  static const info = Color(0xFF0284C7);
  static const infoText = Color(0xFF0369A1);
  static const infoBg = Color(0xFFE0F2FE);
  static const infoDarkText = Color(0xFF7DD3FC);
  static const infoDarkBg = Color(0xFF0C324B);

  // Neutral Surfaces & Borders
  static const background = Color(0xFFF8FAFC);
  static const backgroundDark = Color(0xFF0B111A);

  static const cardSurface = Color(0xFFFFFFFF);
  static const cardSurfaceDark = Color(0xFF131C2B);

  static const surface = Color(0xFFFFFFFF);
  static const surfaceDark = Color(0xFF131C2B);

  static const surfaceMuted = Color(0xFFF1F5F9);
  static const surfaceMutedDark = Color(0xFF1C273A);

  static const textPrimary = Color(0xFF0E2A47);
  static const textPrimaryDark = Color(0xFFF1F5F9);
  static const textMuted = Color(0xFF475569);
  static const textMutedDark = Color(0xFF94A3B8);

  static const border = Color(0xFFE2E8F0);
  static const borderDark = Color(0xFF263449);
}
