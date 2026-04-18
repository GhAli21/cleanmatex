import 'package:flutter/material.dart';

import 'app_spacing.dart';

class AppCardWidget extends StatelessWidget {
  const AppCardWidget({
    super.key,
    required this.child,
  });

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: child,
      ),
    );
  }
}
