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
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isPrimary;
  final bool isLoading;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final child = Row(
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
      ],
    );

    if (isPrimary) {
      return Semantics(
        button: true,
        enabled: !isLoading && onPressed != null,
        label: label,
        child: ElevatedButton(
          onPressed: isLoading ? null : onPressed,
          child: child,
        ),
      );
    }

    return Semantics(
      button: true,
      enabled: !isLoading && onPressed != null,
      label: label,
      child: OutlinedButton(
        onPressed: isLoading ? null : onPressed,
        child: child,
      ),
    );
  }
}
