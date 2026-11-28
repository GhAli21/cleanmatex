import 'package:flutter/material.dart';

import 'app_custom_button_widget.dart';
import 'app_radii.dart';
import 'app_spacing.dart';
import 'cmx_theme_extension.dart';

/// Reusable recoverable error state widget with optional retry action.
class AppErrorWidget extends StatelessWidget {
  const AppErrorWidget({
    super.key,
    required this.title,
    required this.message,
    this.retryLabel,
    this.onRetry,
    this.icon = Icons.error_outline_rounded,
  });

  final String title;
  final String message;
  final String? retryLabel;
  final VoidCallback? onRetry;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: ext.danger.background,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: ext.danger.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 36, color: ext.danger.foreground),
          const SizedBox(height: AppSpacing.sm),
          Text(
            title,
            textAlign: TextAlign.center,
            style: theme.textTheme.titleMedium?.copyWith(
              color: ext.danger.foreground,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            message,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall?.copyWith(
              color: ext.danger.foreground,
            ),
          ),
          if (retryLabel != null && onRetry != null) ...[
            const SizedBox(height: AppSpacing.md),
            AppCustomButtonWidget(
              label: retryLabel!,
              onPressed: onRetry,
              isPrimary: false,
            ),
          ],
        ],
      ),
    );
  }
}
