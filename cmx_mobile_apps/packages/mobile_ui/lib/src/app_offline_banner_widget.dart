import 'package:flutter/material.dart';

import 'app_spacing.dart';
import 'cmx_theme_extension.dart';

/// Non-blocking top offline banner with optional reconnect action.
class AppOfflineBannerWidget extends StatelessWidget {
  const AppOfflineBannerWidget({
    super.key,
    required this.message,
    this.retryLabel,
    this.onRetry,
  });

  final String message;
  final String? retryLabel;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final ext = CmxStatusThemeExtension.of(context);
    final colors = ext.warning;

    return Material(
      color: colors.background,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            children: [
              Icon(Icons.wifi_off_rounded, size: 16, color: colors.foreground),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  message,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colors.foreground,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
              if (retryLabel != null && onRetry != null)
                TextButton(
                  onPressed: onRetry,
                  style: TextButton.styleFrom(
                    foregroundColor: colors.foreground,
                    minimumSize: const Size(44, 36),
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                  ),
                  child: Text(
                    retryLabel!,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
