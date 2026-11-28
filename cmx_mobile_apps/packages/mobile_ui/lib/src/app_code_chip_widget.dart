import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_radii.dart';
import 'app_text_styles.dart';
import 'cmx_theme_extension.dart';

/// LTR-isolated monospace code pill with 1-tap clipboard copy + haptic feedback.
class AppCodeChipWidget extends StatelessWidget {
  const AppCodeChipWidget({
    super.key,
    required this.code,
    this.copiedFeedbackMessage,
    this.onCopied,
    this.emphasize = false,
  });

  final String code;
  final String? copiedFeedbackMessage;
  final VoidCallback? onCopied;
  final bool emphasize;

  Future<void> _copy(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: code));
    HapticFeedback.mediumImpact();
    onCopied?.call();
    if (copiedFeedbackMessage != null && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(copiedFeedbackMessage!),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final ext = CmxStatusThemeExtension.of(context);
    final theme = Theme.of(context);
    final bg = emphasize ? ext.brand.background : ext.surfaceMuted;
    final fg = emphasize ? ext.brandText : theme.colorScheme.onSurface;

    return Semantics(
      button: true,
      label: code,
      child: InkWell(
        onTap: () => _copy(context),
        borderRadius: BorderRadius.circular(AppRadii.sm),
        child: Container(
          constraints: const BoxConstraints(minHeight: 32),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(AppRadii.sm),
            border: Border.all(
              color: emphasize ? ext.brand.border : ext.border,
            ),
          ),
          child: Directionality(
            textDirection: TextDirection.ltr,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  code,
                  style: AppTextStyles.tabular(theme.textTheme.labelSmall)
                      .copyWith(
                    color: fg,
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: 6),
                Icon(Icons.copy_rounded, size: 13, color: ext.brandText),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
