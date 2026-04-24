import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_spacing.dart';

class AppHeaderWidget extends StatelessWidget {
  const AppHeaderWidget({
    super.key,
    required this.title,
    required this.subtitle,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: textTheme.headlineMedium),
              const SizedBox(height: 6),
              Text(
                subtitle,
                style: textTheme.bodyLarge?.copyWith(
                  color: AppColors.textMuted,
                ),
              ),
            ],
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: AppSpacing.md),
          trailing!,
        ],
      ],
    );
  }
}
