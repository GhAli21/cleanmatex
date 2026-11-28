import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Canonical CleanMateX semantic tones shared across badges, banners, and status UI.
enum CmxSemanticTone {
  neutral,
  info,
  brand,
  success,
  warning,
  danger,
}

/// Immutable color set for one semantic tone.
class CmxToneColors {
  const CmxToneColors({
    required this.background,
    required this.foreground,
    required this.border,
    required this.solid,
    required this.onSolid,
  });

  final Color background;
  final Color foreground;
  final Color border;
  final Color solid;
  final Color onSolid;

  static CmxToneColors lerp(CmxToneColors a, CmxToneColors b, double t) {
    return CmxToneColors(
      background: Color.lerp(a.background, b.background, t) ?? b.background,
      foreground: Color.lerp(a.foreground, b.foreground, t) ?? b.foreground,
      border: Color.lerp(a.border, b.border, t) ?? b.border,
      solid: Color.lerp(a.solid, b.solid, t) ?? b.solid,
      onSolid: Color.lerp(a.onSolid, b.onSolid, t) ?? b.onSolid,
    );
  }
}

/// Optional per-Organization brand accent override with WCAG AA contrast guard.
class CmxOrgThemeOverride {
  const CmxOrgThemeOverride({
    this.primaryHex,
    this.logoUrl,
  });

  final String? primaryHex;
  final String? logoUrl;

  /// Parses `#RRGGBB` or `RRGGBB`; returns null when invalid.
  Color? parsePrimaryColor() {
    final raw = primaryHex?.trim();
    if (raw == null || raw.isEmpty) return null;
    final clean = raw.startsWith('#') ? raw.substring(1) : raw;
    if (clean.length != 6) return null;
    final value = int.tryParse(clean, radix: 16);
    if (value == null) return null;
    return Color(0xFF000000 | value);
  }

  /// Resolves an accessible primary accent color for [brightness], darkening or
  /// lightening custom Organization brand colors to keep text readable.
  Color resolvePrimary(Brightness brightness) {
    final parsed = parsePrimaryColor();
    if (parsed == null) {
      return brightness == Brightness.dark
          ? AppColors.primaryDark
          : AppColors.primary;
    }
    final hsl = HSLColor.fromColor(parsed);
    if (brightness == Brightness.dark) {
      final adjusted = hsl.lightness < 0.55 ? hsl.withLightness(0.62) : hsl;
      return adjusted.toColor();
    }
    final adjusted = hsl.lightness > 0.50 ? hsl.withLightness(0.42) : hsl;
    return adjusted.toColor();
  }

  /// Resolves an accessible text-on-surface brand color (>= 4.5:1 WCAG AA).
  Color resolvePrimaryText(Brightness brightness) {
    final base = resolvePrimary(brightness);
    final surface = brightness == Brightness.dark
        ? AppColors.cardSurfaceDark
        : AppColors.cardSurface;
    if (_contrastRatio(base, surface) >= 4.5) return base;
    final hsl = HSLColor.fromColor(base);
    return brightness == Brightness.dark
        ? hsl.withLightness(0.72).toColor()
        : hsl.withLightness(0.32).toColor();
  }

  static double _contrastRatio(Color a, Color b) {
    final l1 = a.computeLuminance();
    final l2 = b.computeLuminance();
    final bright = math.max(l1, l2);
    final dark = math.min(l1, l2);
    return (bright + 0.05) / (dark + 0.05);
  }
}

/// Flutter ThemeExtension holding semantic status colors and surface tokens.
class CmxStatusThemeExtension extends ThemeExtension<CmxStatusThemeExtension> {
  const CmxStatusThemeExtension({
    required this.neutral,
    required this.info,
    required this.brand,
    required this.success,
    required this.warning,
    required this.danger,
    required this.surfaceMuted,
    required this.border,
    required this.brandText,
  });

  final CmxToneColors neutral;
  final CmxToneColors info;
  final CmxToneColors brand;
  final CmxToneColors success;
  final CmxToneColors warning;
  final CmxToneColors danger;
  final Color surfaceMuted;
  final Color border;
  final Color brandText;

  /// Muted secondary text color matching the active brightness.
  Color get textMuted => neutral.foreground;

  /// Alias for [danger] tone colors.
  CmxToneColors get error => danger;

  CmxToneColors tone(CmxSemanticTone semanticTone) {
    switch (semanticTone) {
      case CmxSemanticTone.neutral:
        return neutral;
      case CmxSemanticTone.info:
        return info;
      case CmxSemanticTone.brand:
        return brand;
      case CmxSemanticTone.success:
        return success;
      case CmxSemanticTone.warning:
        return warning;
      case CmxSemanticTone.danger:
        return danger;
    }
  }

  factory CmxStatusThemeExtension.light({CmxOrgThemeOverride? orgOverride}) {
    final brandSolid =
        orgOverride?.resolvePrimary(Brightness.light) ?? AppColors.primary;
    final brandText =
        orgOverride?.resolvePrimaryText(Brightness.light) ?? AppColors.primaryText;

    return CmxStatusThemeExtension(
      neutral: const CmxToneColors(
        background: AppColors.surfaceMuted,
        foreground: AppColors.textMuted,
        border: AppColors.border,
        solid: AppColors.secondary,
        onSolid: Colors.white,
      ),
      info: const CmxToneColors(
        background: AppColors.infoBg,
        foreground: AppColors.infoText,
        border: Color(0xFFBAE6FD),
        solid: AppColors.info,
        onSolid: Colors.white,
      ),
      brand: CmxToneColors(
        background: brandSolid.withValues(alpha: 0.12),
        foreground: brandText,
        border: brandSolid.withValues(alpha: 0.35),
        solid: brandSolid,
        onSolid: Colors.white,
      ),
      success: const CmxToneColors(
        background: AppColors.successBg,
        foreground: AppColors.successText,
        border: Color(0xFF99F6E4),
        solid: AppColors.success,
        onSolid: Colors.white,
      ),
      warning: const CmxToneColors(
        background: AppColors.warningBg,
        foreground: AppColors.warningText,
        border: AppColors.warningBorder,
        solid: AppColors.warning,
        onSolid: Color(0xFF101828),
      ),
      danger: const CmxToneColors(
        background: AppColors.errorBg,
        foreground: AppColors.errorText,
        border: AppColors.errorBorder,
        solid: AppColors.error,
        onSolid: Colors.white,
      ),
      surfaceMuted: AppColors.surfaceMuted,
      border: AppColors.border,
      brandText: brandText,
    );
  }

  factory CmxStatusThemeExtension.dark({CmxOrgThemeOverride? orgOverride}) {
    final brandSolid =
        orgOverride?.resolvePrimary(Brightness.dark) ?? AppColors.primaryDark;
    final brandText =
        orgOverride?.resolvePrimaryText(Brightness.dark) ?? AppColors.primaryDark;

    return CmxStatusThemeExtension(
      neutral: const CmxToneColors(
        background: AppColors.surfaceMutedDark,
        foreground: AppColors.textMutedDark,
        border: AppColors.borderDark,
        solid: AppColors.secondaryDark,
        onSolid: Color(0xFF0B111A),
      ),
      info: const CmxToneColors(
        background: AppColors.infoDarkBg,
        foreground: AppColors.infoDarkText,
        border: Color(0xFF0369A1),
        solid: AppColors.infoDarkText,
        onSolid: Color(0xFF0B111A),
      ),
      brand: CmxToneColors(
        background: brandSolid.withValues(alpha: 0.16),
        foreground: brandText,
        border: brandSolid.withValues(alpha: 0.40),
        solid: brandSolid,
        onSolid: const Color(0xFF0B111A),
      ),
      success: const CmxToneColors(
        background: AppColors.successDarkBg,
        foreground: AppColors.successDarkText,
        border: Color(0xFF0F766E),
        solid: AppColors.successDarkText,
        onSolid: Color(0xFF0B111A),
      ),
      warning: const CmxToneColors(
        background: AppColors.warningDarkBg,
        foreground: AppColors.warningDarkText,
        border: Color(0xFF92400E),
        solid: AppColors.warning,
        onSolid: Color(0xFF0B111A),
      ),
      danger: const CmxToneColors(
        background: AppColors.errorDarkBg,
        foreground: AppColors.errorDarkText,
        border: Color(0xFF991B1B),
        solid: AppColors.error,
        onSolid: Colors.white,
      ),
      surfaceMuted: AppColors.surfaceMutedDark,
      border: AppColors.borderDark,
      brandText: brandText,
    );
  }

  static CmxStatusThemeExtension of(BuildContext context) {
    final ext = Theme.of(context).extension<CmxStatusThemeExtension>();
    if (ext != null) return ext;
    return Theme.of(context).brightness == Brightness.dark
        ? CmxStatusThemeExtension.dark()
        : CmxStatusThemeExtension.light();
  }

  @override
  CmxStatusThemeExtension copyWith({
    CmxToneColors? neutral,
    CmxToneColors? info,
    CmxToneColors? brand,
    CmxToneColors? success,
    CmxToneColors? warning,
    CmxToneColors? danger,
    Color? surfaceMuted,
    Color? border,
    Color? brandText,
  }) {
    return CmxStatusThemeExtension(
      neutral: neutral ?? this.neutral,
      info: info ?? this.info,
      brand: brand ?? this.brand,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      danger: danger ?? this.danger,
      surfaceMuted: surfaceMuted ?? this.surfaceMuted,
      border: border ?? this.border,
      brandText: brandText ?? this.brandText,
    );
  }

  @override
  CmxStatusThemeExtension lerp(
    covariant ThemeExtension<CmxStatusThemeExtension>? other,
    double t,
  ) {
    if (other is! CmxStatusThemeExtension) return this;
    return CmxStatusThemeExtension(
      neutral: CmxToneColors.lerp(neutral, other.neutral, t),
      info: CmxToneColors.lerp(info, other.info, t),
      brand: CmxToneColors.lerp(brand, other.brand, t),
      success: CmxToneColors.lerp(success, other.success, t),
      warning: CmxToneColors.lerp(warning, other.warning, t),
      danger: CmxToneColors.lerp(danger, other.danger, t),
      surfaceMuted: Color.lerp(surfaceMuted, other.surfaceMuted, t) ?? other.surfaceMuted,
      border: Color.lerp(border, other.border, t) ?? other.border,
      brandText: Color.lerp(brandText, other.brandText, t) ?? other.brandText,
    );
  }
}
