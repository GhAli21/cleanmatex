import 'package:flutter/material.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

class CustomerOrderSummaryCard extends StatelessWidget {
  const CustomerOrderSummaryCard({
    super.key,
    required this.order,
    required this.onOpen,
  });

  final OrderSummaryModel order;
  final VoidCallback onOpen;

  Color _statusColor() {
    switch (order.statusCode) {
      case 'out_for_delivery':
      case 'completed':
      case 'delivered':
        return AppColors.success;
      case 'ready':
      case 'ready_for_delivery':
      case 'ready_for_pickup':
        return AppColors.primary;
      case 'processing':
      default:
        return AppColors.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;

    return AppCardWidget(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(order.orderNumber, style: textTheme.titleLarge),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
                decoration: BoxDecoration(
                  color: _statusColor().withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  localizations.text(order.statusLabelKey),
                  style: textTheme.bodyMedium?.copyWith(color: _statusColor()),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            localizations.textWithArg(
              'orders.garmentCount',
              order.garmentCount.toString(),
            ),
            style: textTheme.bodyLarge,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            order.promisedWindow,
            style: textTheme.bodyMedium,
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: double.infinity,
            child: AppCustomButtonWidget(
              label: localizations.text('orders.openDetailAction'),
              onPressed: onOpen,
              isPrimary: false,
            ),
          ),
        ],
      ),
    );
  }
}
