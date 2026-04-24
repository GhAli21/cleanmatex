import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../common/ui/widgets/customer_locale_switch_widget.dart';
import '../../providers/customer_order_detail_provider.dart';
import '../cards/customer_order_timeline_step_card.dart';

class CustomerOrderDetailScreen extends ConsumerWidget {
  const CustomerOrderDetailScreen({
    super.key,
    required this.orderId,
  });

  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final localizations = AppLocalizations.of(context);
    final async = ref.watch(customerOrderDetailProvider(orderId));
    AppLogger.info('order_detail_screen.render orderId=$orderId');

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.text('orders.detailTitle')),
        actions: const [
          CustomerLocaleSwitchWidget(),
        ],
      ),
      body: SafeArea(
        child: async.when(
          data: (order) {
            AppLogger.info(
              'order_detail_screen.data_rendered orderNumber=${order.orderNumber}',
            );
            return _OrderDetailBody(order: order, localizations: localizations);
          },
          error: (e, _) {
            AppLogger.error(
              'order_detail_screen.error_rendered orderId=$orderId',
              error: e,
            );
            final key = e is AppException
                ? e.messageKey
                : 'common.remoteRequestError';
            return ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                AppCardWidget(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        localizations.text('orders.detailErrorTitle'),
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        localizations.text(key),
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      SizedBox(
                        width: double.infinity,
                        child: AppCustomButtonWidget(
                          label: localizations.text('orders.retryAction'),
                          onPressed: () {
                            AppLogger.info(
                              'order_detail_screen.retry_requested orderId=$orderId',
                            );
                            ref.invalidate(
                              customerOrderDetailProvider(orderId),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
          loading: () {
            AppLogger.info(
                'order_detail_screen.loading_rendered orderId=$orderId');
            return ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                AppLoadingIndicator(
                  label: localizations.text('orders.detailLoading'),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _OrderDetailBody extends StatelessWidget {
  const _OrderDetailBody({
    required this.order,
    required this.localizations,
  });

  final OrderDetailModel order;
  final AppLocalizations localizations;

  Color _paymentColor(String? status) {
    switch (status) {
      case 'paid':
        return AppColors.success;
      case 'partial':
        return AppColors.warning;
      default:
        return AppColors.error;
    }
  }

  String _formatAmount(double? amount, String? currency, int decimals) {
    if (amount == null) return '—';
    final formatted = amount.toStringAsFixed(decimals);
    return currency != null ? '$formatted $currency' : formatted;
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final hasFinancials = order.total != null || order.subtotal != null;
    final hasItems = order.items.isNotEmpty;
    final decimals = order.currencyDecimalPlaces;
    final currency = order.currencyCode;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        // Header
        AppHeaderWidget(
          title: order.orderNumber,
          subtitle:
              '${localizations.text(order.statusLabelKey)} • ${order.promisedWindow}',
        ),
        const SizedBox(height: AppSpacing.lg),

        // Summary card
        AppCardWidget(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                localizations.text('orders.detailSummaryTitle'),
                style: textTheme.titleLarge,
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
                localizations.text(order.deliveryModeLabelKey),
                style: textTheme.bodyLarge,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),

        // Financial card
        if (hasFinancials || hasItems)
          AppCardWidget(
            accentColor: _paymentColor(order.paymentStatus),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        localizations.text('orders.financialTitle'),
                        style: textTheme.titleLarge,
                      ),
                    ),
                    if (order.paymentStatus != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm,
                          vertical: 3,
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

                // Line items
                if (hasItems) ...[
                  const SizedBox(height: AppSpacing.md),
                  const Divider(height: 1, color: AppColors.border),
                  const SizedBox(height: AppSpacing.md),
                  ...order.items.map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${item.quantity}× ${item.name}',
                              style: textTheme.bodyMedium,
                            ),
                          ),
                          Text(
                            _formatAmount(item.totalPrice, currency, decimals),
                            style: textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],

                // Totals
                const SizedBox(height: AppSpacing.sm),
                const Divider(height: 1, color: AppColors.border),
                const SizedBox(height: AppSpacing.md),

                if (order.subtotal != null && order.subtotal != order.total)
                  _TotalRow(
                    label: localizations.text('orders.subtotal'),
                    value: _formatAmount(order.subtotal, currency, decimals),
                    textTheme: textTheme,
                  ),

                _TotalRow(
                  label: localizations.text('orders.total'),
                  value: _formatAmount(order.total, currency, decimals),
                  textTheme: textTheme,
                  isHighlighted: true,
                ),

                if (order.paidAmount != null && order.paidAmount! > 0) ...[
                  const SizedBox(height: AppSpacing.xs),
                  _TotalRow(
                    label: localizations.text('orders.paidAmount'),
                    value: _formatAmount(order.paidAmount, currency, decimals),
                    textTheme: textTheme,
                    valueColor: AppColors.success,
                  ),
                  if ((order.total ?? 0) - (order.paidAmount ?? 0) > 0.005) ...[
                    const SizedBox(height: AppSpacing.xs),
                    _TotalRow(
                      label: localizations.text('orders.balance'),
                      value: _formatAmount(
                        (order.total ?? 0) - (order.paidAmount ?? 0),
                        currency,
                        decimals,
                      ),
                      textTheme: textTheme,
                      valueColor: AppColors.error,
                    ),
                  ],
                ],
              ],
            ),
          ),

        if (hasFinancials || hasItems) const SizedBox(height: AppSpacing.lg),

        // Timeline card
        AppCardWidget(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                localizations.text('orders.timelineTitle'),
                style: textTheme.titleLarge,
              ),
              const SizedBox(height: AppSpacing.lg),
              ...order.timeline.map(
                (step) => Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                  child: CustomerOrderTimelineStepCard(step: step),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({
    required this.label,
    required this.value,
    required this.textTheme,
    this.isHighlighted = false,
    this.valueColor,
  });

  final String label;
  final String value;
  final TextTheme textTheme;
  final bool isHighlighted;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: isHighlighted
                ? textTheme.titleMedium
                : textTheme.bodyMedium?.copyWith(color: AppColors.textMuted),
          ),
        ),
        Text(
          value,
          style: isHighlighted
              ? textTheme.titleMedium?.copyWith(color: AppColors.primary)
              : textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w500,
                  color: valueColor,
                ),
        ),
      ],
    );
  }
}
