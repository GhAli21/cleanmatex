import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_text_styles.dart';

class AppTheme {
  const AppTheme._();

  static ThemeData light() {
    return ThemeData(
      colorScheme: const ColorScheme.light(
        primary: AppColors.primary,
        surface: AppColors.cardSurface,
        error: AppColors.error,
      ),
      scaffoldBackgroundColor: AppColors.background,
      textTheme: AppTextStyles.textTheme(
        AppColors.textPrimary,
        AppColors.textMuted,
      ),
      cardTheme: CardThemeData(
        elevation: 2,
        shadowColor: const Color(0x0D000000),
        margin: EdgeInsets.zero,
        color: AppColors.cardSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.cardSurface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.cardSurface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        shape: Border(
          bottom: BorderSide(color: AppColors.border, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(54),
          tapTargetSize: MaterialTapTargetSize.padded,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(54),
          tapTargetSize: MaterialTapTargetSize.padded,
          side: const BorderSide(color: AppColors.border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          minimumSize: const Size(48, 48),
          tapTargetSize: MaterialTapTargetSize.padded,
        ),
      ),
      useMaterial3: true,
    );
  }

  static ThemeData dark() {
    return ThemeData(
      colorScheme: const ColorScheme.dark(
        primary: AppColors.primaryDark,
        surface: AppColors.cardSurfaceDark,
        error: AppColors.error,
      ),
      scaffoldBackgroundColor: AppColors.backgroundDark,
      textTheme: AppTextStyles.textTheme(
        AppColors.textPrimaryDark,
        AppColors.textMutedDark,
      ),
      cardTheme: CardThemeData(
        elevation: 2,
        shadowColor: const Color(0x26000000),
        margin: EdgeInsets.zero,
        color: AppColors.cardSurfaceDark,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.cardSurfaceDark,
        foregroundColor: AppColors.textPrimaryDark,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        shape: Border(
          bottom: BorderSide(color: AppColors.borderDark, width: 1),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          minimumSize: const Size(48, 48),
          tapTargetSize: MaterialTapTargetSize.padded,
        ),
      ),
      useMaterial3: true,
    );
  }
}
