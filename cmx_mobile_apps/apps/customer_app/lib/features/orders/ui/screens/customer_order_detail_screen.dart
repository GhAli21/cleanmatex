import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../common/ui/widgets/customer_locale_switch_widget.dart';
import '../../../receipts/ui/widgets/customer_always_light_receipt_sheet_widget.dart';
import '../../providers/customer_order_detail_provider.dart';
import '../../providers/customer_order_statement_provider.dart';
import '../cards/customer_order_statement_card.dart';
import '../widgets/customer_order_item_row_vw.dart';

/// Order Detail Screen with:
/// - Flexible N-stage [AppProgressStepperWidget] at the TOP (Horizontal / Vertical
///   toggle + responsive default, built directly from [order.timeline])
/// - Counter Pickup QR code when order is Ready
/// - POS-parity Financial Summary + Server Statement
/// - 1-tap "View Digital Receipt" opening the Always-Light VAT receipt modal
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
        actions: const [CustomerLocaleSwitchWidget()],
      ),
      body: SafeArea(
        child: async.when(
          data: (order) {
            final statement = ref
                .watch(customerOrderStatementProvider(orderId))
                .valueOrNull;
            return RefreshIndicator(
              onRefresh: () =>
                  ref.refresh(customerOrderDetailProvider(orderId).future),
              child: _OrderDetailBody(
                order: order,
                localizations: localizations,
                statement: statement,
              ),
            );
          },
          error: (e, _) {
            final key = e is AppException
                ? e.messageKey
                : 'common.remoteRequestError';
            return ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                AppErrorWidget(
                  title: localizations.text('orders.detailErrorTitle'),
                  message: localizations.text(key),
                  retryLabel: localizations.text('orders.retryAction'),
                  onRetry: () =>
                      ref.invalidate(customerOrderDetailProvider(orderId)),
                ),
              ],
            );
          },
          loading: () => ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: const [
              AppSkeletonWidget(height: 150),
              SizedBox(height: AppSpacing.md),
              AppSkeletonWidget(height: 120),
              SizedBox(height: AppSpacing.md),
              AppSkeletonWidget(height: 160),
            ],
          ),
        ),
      ),
    );
  }
}

class _OrderDetailBody extends StatelessWidget {
  const _OrderDetailBody({
    required this.order,
    required this.localizations,
    this.statement,
  });

  final OrderDetailModel order;
  final AppLocalizations localizations;
  final OrderFinancialStatementModel? statement;

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

  String _formatAmount(
    BuildContext context,
    double? amount,
    String? currency,
    int decimals,
  ) {
    if (amount == null) return '—';
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

  String? _formatUnitPrice(
    BuildContext context,
    double? price,
    String? currency,
    int decimals,
  ) {
    if (price == null) return null;
    var digits = decimals;
    while (digits < 6 &&
        (price - double.parse(price.toStringAsFixed(digits))).abs() > 1e-9) {
      digits++;
    }
    return _formatAmount(context, price, currency, digits);
  }

  bool get _isReadyForPickup {
    final code = order.statusCode.toUpperCase();
    return code == 'READY' || code == 'OUT_FOR_DELIVERY';
  }

  List<AppProgressStepItem> _buildStepperItems() {
    if (order.timeline.isEmpty) {
      return [
        AppProgressStepItem(
          title: localizations.text(order.statusLabelKey),
          subtitle: order.promisedWindow,
          isActive: true,
        ),
      ];
    }

    // Find the latest completed stage index.
    var activeIdx = order.timeline.lastIndexWhere((s) => s.isCompleted);
    if (activeIdx < 0) activeIdx = 0;

    return [
      for (var i = 0; i < order.timeline.length; i++)
        AppProgressStepItem(
          title: localizations.text(order.timeline[i].titleKey),
          subtitle: localizations.text(order.timeline[i].descriptionKey),
          isCompleted: order.timeline[i].isCompleted && i != activeIdx,
          isActive: i == activeIdx,
        ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final ext = CmxStatusThemeExtension.of(context);
    final hasFinancials = order.total != null || order.subtotal != null;
    final hasItems = order.items.isNotEmpty;
    final decimals = order.currencyDecimalPlaces;
    final currency = order.currencyCode;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        // Order Code + Status Pill Header
        Row(
          children: [
            AppCodeChipWidget(
              code: ltrCode(order.orderNumber),
              copiedFeedbackMessage:
                  localizations.text('common.copiedToClipboard'),
            ),
            const Spacer(),
            AppStatusBadgeWidget(
              label: localizations.text(order.statusLabelKey),
              tone: _isReadyForPickup
                  ? CmxSemanticTone.success
                  : CmxSemanticTone.brand,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),

        // 1. TOP Flexible N-Stage Horizontal/Vertical Live Tracker!
        AppProgressStepperWidget(
          title: localizations.text('orders.timelineTitle'),
          trailingMeta: order.promisedWindow,
          steps: _buildStepperItems(),
          horizontalLabel: localizations.text('tracker.horizontalLabel'),
          verticalLabel: localizations.text('tracker.verticalLabel'),
        ),
        const SizedBox(height: AppSpacing.lg),

        // 2. Pickup QR Code when Ready
        if (_isReadyForPickup) ...[
          AppQrCardWidget(
            payload: 'CMX-PICKUP|${order.orderNumber}',
            title: localizations.text('orders.readyQrTitle'),
            subtitle: localizations.text('orders.readyQrSubtitle'),
            displayCode: ltrCode(order.orderNumber),
            copiedFeedbackMessage:
                localizations.text('common.copiedToClipboard'),
          ),
          const SizedBox(height: AppSpacing.lg),
        ],

        // 3. Summary card
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
              const SizedBox(height: AppSpacing.xs),
              Text(
                localizations.text(order.deliveryModeLabelKey),
                style: textTheme.bodyLarge?.copyWith(color: ext.textMuted),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),

        // 4. Financial card
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
                      AppStatusBadgeWidget(
                        label: localizations.text(
                          'orders.paymentStatus.${order.paymentStatus}',
                        ),
                        tone: order.paymentStatus == 'paid'
                            ? CmxSemanticTone.success
                            : order.paymentStatus == 'partial'
                                ? CmxSemanticTone.warning
                                : CmxSemanticTone.danger,
                      ),
                  ],
                ),
                if (hasItems) ...[
                  const SizedBox(height: AppSpacing.md),
                  Divider(height: 1, color: ext.border),
                  const SizedBox(height: AppSpacing.md),
                  ...order.items.map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                      child: CustomerOrderItemRowVw(
                        item: item,
                        unitPrice: _formatUnitPrice(
                          context,
                          item.qualifier?.measure?.unitPrice,
                          currency,
                          decimals,
                        ),
                        amount: _formatAmount(
                          context,
                          item.totalPrice,
                          currency,
                          decimals,
                        ),
                      ),
                    ),
                  ),
                ],
                if (statement == null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Divider(height: 1, color: ext.border),
                  const SizedBox(height: AppSpacing.md),
                  if (order.subtotal != null && order.subtotal != order.total)
                    _TotalRow(
                      label: localizations.text('orders.subtotal'),
                      value: _formatAmount(
                        context,
                        order.subtotal,
                        currency,
                        decimals,
                      ),
                      textTheme: textTheme,
                    ),
                  _TotalRow(
                    label: localizations.text('orders.total'),
                    value: _formatAmount(
                      context,
                      order.total,
                      currency,
                      decimals,
                    ),
                    textTheme: textTheme,
                    isHighlighted: true,
                  ),
                  if (order.paidAmount != null && order.paidAmount! > 0) ...[
                    const SizedBox(height: AppSpacing.xs),
                    _TotalRow(
                      label: localizations.text('orders.paidAmount'),
                      value: _formatAmount(
                        context,
                        order.paidAmount,
                        currency,
                        decimals,
                      ),
                      textTheme: textTheme,
                      valueColor: AppColors.success,
                    ),
                  ],
                ],
              ],
            ),
          ),

        if (hasFinancials || hasItems) const SizedBox(height: AppSpacing.lg),

        if (statement != null) ...[
          CustomerOrderStatementCard(statement: statement!),
          const SizedBox(height: AppSpacing.lg),
        ],

        // 5. View Always-Light Digital VAT Receipt CTA
        SizedBox(
          width: double.infinity,
          child: AppCustomButtonWidget(
            label: localizations.text('receipts.viewDigitalReceiptAction'),
            icon: Icons.receipt_long_rounded,
            isPrimary: false,
            onPressed: () => showCustomerAlwaysLightReceiptSheet(
              context,
              orderNo: order.orderNumber,
            ),
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
    final ext = CmxStatusThemeExtension.of(context);
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: isHighlighted
                ? textTheme.titleMedium
                : textTheme.bodyMedium?.copyWith(color: ext.textMuted),
          ),
        ),
        Text(
          value,
          style: isHighlighted
              ? textTheme.titleMedium?.copyWith(color: ext.brandText)
              : textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w500,
                  color: valueColor,
                ),
        ),
      ],
    );
  }
}
