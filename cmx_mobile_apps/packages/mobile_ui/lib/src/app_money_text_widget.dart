import 'package:flutter/material.dart';

import 'app_text_styles.dart';
import 'cmx_theme_extension.dart';

/// LTR-isolated tabular-numerals currency display safe inside Arabic RTL sentences.
/// Accepts either a pre-formatted [formattedAmount] or numeric [amount] + [currencyCode].
class AppMoneyTextWidget extends StatelessWidget {
  const AppMoneyTextWidget({
    super.key,
    this.formattedAmount,
    this.amount,
    this.currencyCode,
    this.decimalDigits = 3,
    this.style,
    this.tone,
    this.fontWeight = FontWeight.w700,
  }) : assert(
          formattedAmount != null || amount != null,
          'Either formattedAmount or amount must be provided.',
        );

  final String? formattedAmount;
  final double? amount;
  final String? currencyCode;
  final int decimalDigits;
  final TextStyle? style;
  final CmxSemanticTone? tone;
  final FontWeight fontWeight;

  String _resolveText() {
    if (formattedAmount != null) return formattedAmount!;
    final value = amount ?? 0;
    final prefix = value < 0 ? '-' : '';
    final formatted = value.abs().toStringAsFixed(decimalDigits);
    final code = currencyCode?.trim();
    if (code != null && code.isNotEmpty) {
      return '$prefix$formatted $code';
    }
    return '$prefix$formatted';
  }

  @override
  Widget build(BuildContext context) {
    final ext = CmxStatusThemeExtension.of(context);
    final baseStyle = style ?? Theme.of(context).textTheme.bodyMedium;
    final resolvedColor =
        tone != null ? ext.tone(tone!).foreground : baseStyle?.color;

    return Directionality(
      textDirection: TextDirection.ltr,
      child: Text(
        _resolveText(),
        style: AppTextStyles.tabular(baseStyle).copyWith(
          color: resolvedColor,
          fontWeight: fontWeight,
        ),
      ),
    );
  }
}
