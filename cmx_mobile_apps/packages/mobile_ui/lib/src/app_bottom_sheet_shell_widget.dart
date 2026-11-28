import 'package:flutter/material.dart';

import 'app_radii.dart';
import 'app_spacing.dart';
import 'cmx_theme_extension.dart';

/// Standardized modal bottom sheet shell with drag handle, header, and safe area.
class AppBottomSheetShellWidget extends StatelessWidget {
  const AppBottomSheetShellWidget({
    super.key,
    required this.title,
    this.subtitle,
    required this.child,
    this.closeTooltip = 'Close',
  });

  final String title;
  final String? subtitle;
  final Widget child;
  final String closeTooltip;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.only(
          left: AppSpacing.md,
          right: AppSpacing.md,
          top: AppSpacing.sm,
          bottom: MediaQuery.viewInsetsOf(context).bottom + AppSpacing.md,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: ext.border,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                ),
              ),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: theme.textTheme.titleLarge),
                        if (subtitle != null && subtitle!.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(subtitle!, style: theme.textTheme.bodySmall),
                        ],
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: closeTooltip,
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              child,
            ],
          ),
        ),
      ),
    );
  }
}
