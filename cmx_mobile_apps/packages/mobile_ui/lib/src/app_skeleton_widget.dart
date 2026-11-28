import 'package:flutter/material.dart';

import 'app_radii.dart';
import 'app_spacing.dart';
import 'cmx_theme_extension.dart';

/// Alias for [AppSkeletonBoxWidget].
typedef AppSkeletonWidget = AppSkeletonBoxWidget;

/// Smooth pulsing skeleton box for loading views without blank screens.
class AppSkeletonBoxWidget extends StatefulWidget {
  const AppSkeletonBoxWidget({
    super.key,
    this.width = double.infinity,
    required this.height,
    this.radius = AppRadii.sm,
  });

  final double width;
  final double height;
  final double radius;

  @override
  State<AppSkeletonBoxWidget> createState() => _AppSkeletonBoxWidgetState();
}

class _AppSkeletonBoxWidgetState extends State<AppSkeletonBoxWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ext = CmxStatusThemeExtension.of(context);
    return FadeTransition(
      opacity: Tween<double>(begin: 0.45, end: 0.95).animate(_controller),
      child: Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: ext.surfaceMuted,
          borderRadius: BorderRadius.circular(widget.radius),
        ),
      ),
    );
  }
}

/// Content-shaped card skeleton for order cards, receipts, and home panels.
class AppSkeletonCardWidget extends StatelessWidget {
  const AppSkeletonCardWidget({super.key, this.lines = 3});

  final int lines;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: ext.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              AppSkeletonBoxWidget(width: 110, height: 22, radius: AppRadii.pill),
              Spacer(),
              AppSkeletonBoxWidget(width: 84, height: 22),
            ],
          ),
          for (var i = 0; i < lines; i++) ...[
            const SizedBox(height: AppSpacing.sm),
            AppSkeletonBoxWidget(
              width: i == lines - 1 ? 160 : double.infinity,
              height: 14,
            ),
          ],
        ],
      ),
    );
  }
}
