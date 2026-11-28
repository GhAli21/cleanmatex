import 'package:flutter/material.dart';

import 'app_loading_indicator_widget.dart';
import 'app_spacing.dart';

class AppCustomButtonWidget extends StatelessWidget {
  const AppCustomButtonWidget({
    super.key,
    required this.label,
    this.onPressed,
    this.isPrimary = true,
    this.isLoading = false,
    this.icon,
    this.trailingIcon,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isPrimary;
  final bool isLoading;

  /// Optional leading icon.
  final IconData? icon;

  /// Optional trailing icon (right side of label).
  final IconData? trailingIcon;

  Widget _buildChild(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (isLoading) ...[
          const SizedBox(
            height: 18,
            width: 18,
            child: AppLoadingIndicator.compact(),
          ),
          const SizedBox(width: AppSpacing.sm),
        ] else if (icon != null) ...[
          Icon(icon, size: 18),
          const SizedBox(width: AppSpacing.sm),
        ],
        Flexible(child: Text(label)),
        if (!isLoading && trailingIcon != null) ...[
          const SizedBox(width: AppSpacing.sm),
          Icon(trailingIcon, size: 18),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (isPrimary) {
      return ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: theme.colorScheme.primary,
          foregroundColor: theme.colorScheme.onPrimary,
          disabledBackgroundColor:
              theme.colorScheme.outline.withValues(alpha: 0.35),
          disabledForegroundColor:
              theme.colorScheme.onSurface.withValues(alpha: 0.5),
          minimumSize: const Size.fromHeight(52),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        ),
        child: _buildChild(context),
      );
    }

    return OutlinedButton(
      onPressed: isLoading ? null : onPressed,
      child: _buildChild(context),
    );
  }
}
