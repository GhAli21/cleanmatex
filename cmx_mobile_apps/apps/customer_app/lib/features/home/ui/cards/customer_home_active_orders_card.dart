import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

class CustomerHomeActiveOrdersCard extends StatelessWidget {
  const CustomerHomeActiveOrdersCard({
    super.key,
    required this.onOpenOrders,
  });

  final VoidCallback onOpenOrders;

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
            localizations.text('home.activeOrdersBody'),
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
