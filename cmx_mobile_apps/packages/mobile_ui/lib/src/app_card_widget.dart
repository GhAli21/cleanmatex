import 'package:flutter/material.dart';

import 'app_spacing.dart';

class AppCardWidget extends StatelessWidget {
  const AppCardWidget({
    super.key,
    required this.child,
    this.accentColor,
  });

  final Widget child;

  /// Optional left-edge accent strip color (4px wide). Used to draw attention
  /// to high-priority cards such as active orders.
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final card = Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.lg,
        ),
        child: child,
      ),
    );

    if (accentColor == null) return card;

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 4, color: accentColor),
            Expanded(child: card),
          ],
        ),
      ),
    );
  }
}
