import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

class CustomerHomeActiveOrdersCard extends StatelessWidget {
  const CustomerHomeActiveOrdersCard({
    super.key,
    required this.onOpenOrders,
    this.activeCount = 0,
  });

  final VoidCallback onOpenOrders;
  final int activeCount;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;

    return AppCardWidget(
      accentColor: activeCount > 0 ? AppColors.primary : null,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Count badge
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(16),
            ),
            alignment: Alignment.center,
            child: Text(
              activeCount.toString(),
              style: textTheme.headlineMedium?.copyWith(
                color: AppColors.primary,
                fontSize: 22,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          // Text content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  localizations.text('home.activeOrdersTitle'),
                  style: textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  activeCount > 0
                      ? localizations.textWithArg(
                          'home.activeOrdersCount',
                          activeCount.toString(),
                        )
                      : localizations.text('home.activeOrdersBody'),
                  style: textTheme.bodySmall,
                ),
              ],
            ),
          ),
          // Arrow action
          IconButton(
            onPressed: onOpenOrders,
            icon: const Icon(
              Icons.arrow_forward_ios_rounded,
              size: 16,
            ),
            style: IconButton.styleFrom(
              backgroundColor: AppColors.primary.withValues(alpha: 0.08),
              foregroundColor: AppColors.primary,
            ),
          ),
        ],
      ),
    );
  }
}
