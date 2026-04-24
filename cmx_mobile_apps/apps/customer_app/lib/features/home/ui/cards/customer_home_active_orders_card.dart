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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            localizations.text('home.activeOrdersTitle'),
            style: textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            activeCount > 0
                ? localizations.textWithArg(
                    'home.activeOrdersCount',
                    activeCount.toString(),
                  )
                : localizations.text('home.activeOrdersBody'),
            style: textTheme.bodyLarge,
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: double.infinity,
            child: AppCustomButtonWidget(
              label: localizations.text('home.primaryAction'),
              onPressed: onOpenOrders,
              icon: Icons.local_laundry_service_outlined,
            ),
          ),
        ],
      ),
    );
  }
}
