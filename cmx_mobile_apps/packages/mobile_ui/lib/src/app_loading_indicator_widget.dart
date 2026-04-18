import 'package:flutter/material.dart';

import 'app_spacing.dart';

class AppLoadingIndicator extends StatelessWidget {
  const AppLoadingIndicator({
    super.key,
    this.label,
    this.strokeWidth = 4,
  });

  final String? label;
  final double strokeWidth;

  const AppLoadingIndicator.compact({super.key})
    : label = null,
      strokeWidth = 2.2;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircularProgressIndicator(strokeWidth: strokeWidth),
        if (label != null) ...[
          const SizedBox(height: AppSpacing.md),
          Text(label!, textAlign: TextAlign.center),
        ],
      ],
    );
  }
}
