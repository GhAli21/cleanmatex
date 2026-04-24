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
    final statusColor = _statusColor();

    return Card(
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.md,
          ),
          child: Row(
            children: [
              // Status color dot
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: statusColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              // Order info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(order.orderNumber, style: textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.sm,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: statusColor.withValues(alpha: 0.10),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            localizations.text(order.statusLabelKey),
                            style: textTheme.bodySmall?.copyWith(
                              color: statusColor,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Flexible(
                          child: Text(
                            localizations.textWithArg(
                              'orders.garmentCount',
                              order.garmentCount.toString(),
                            ),
                            style: textTheme.bodySmall,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      order.promisedWindow,
                      style: textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.textMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
