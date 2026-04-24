import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
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

  Color _paymentColor(String? status) {
    switch (status) {
      case 'paid':
        return AppColors.success;
      case 'partial':
        return AppColors.warning;
      case 'unpaid':
      default:
        return AppColors.error;
    }
  }

  String _formatAmount({
    required BuildContext context,
    required double amount,
    required String? currency,
    required int decimals,
  }) {
    final localeTag = Localizations.localeOf(context).toLanguageTag();
    final formatter = NumberFormat.currency(
      locale: localeTag,
      name: currency,
      decimalDigits: decimals,
      symbol: '',
    );
    final formatted = formatter.format(amount).trim();
    return currency != null && currency.isNotEmpty
        ? '$formatted $currency'
        : formatted;
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
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top row: order number + status badge + chevron
              Row(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: statusColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(order.orderNumber, style: textTheme.titleMedium),
                  ),
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
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.textMuted,
                    size: 18,
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              // Meta row: garment count + window
              Row(
                children: [
                  Text(
                    localizations.textWithArg(
                      'orders.garmentCount',
                      order.garmentCount.toString(),
                    ),
                    style: textTheme.bodySmall,
                  ),
                  if (order.promisedWindow.isNotEmpty) ...[
                    Text(' • ', style: textTheme.bodySmall),
                    Flexible(
                      child: Text(
                        order.promisedWindow,
                        style: textTheme.bodySmall,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ],
              ),
              // Financial row — only shown when total is available
              if (order.total != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Text(
                      _formatAmount(
                        context: context,
                        amount: order.total!,
                        currency: order.currencyCode,
                        decimals: 2,
                      ),
                      style: textTheme.titleMedium?.copyWith(
                        color: AppColors.primary,
                      ),
                    ),
                    const Spacer(),
                    if (order.paymentStatus != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: _paymentColor(order.paymentStatus)
                              .withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          localizations.text(
                            'orders.paymentStatus.${order.paymentStatus}',
                          ),
                          style: textTheme.bodySmall?.copyWith(
                            color: _paymentColor(order.paymentStatus),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
