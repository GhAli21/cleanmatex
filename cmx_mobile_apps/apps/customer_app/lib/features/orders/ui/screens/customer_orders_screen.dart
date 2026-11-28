import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/navigation/app_route.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';
import '../../../quick_drop/providers/customer_quick_drop_provider.dart';
import '../../providers/customer_orders_provider.dart';
import '../cards/customer_order_summary_card.dart';

enum _OrdersSegment { active, requests, history }

/// Unified Orders Hub with 3 segments:
/// - **Active**: Live in-progress orders
/// - **Requests**: Fast Quick Drop unpriced requests (`REQ-*`) with 1-tap bridge
///   to the linked order once branch staff convert it
/// - **History**: Completed / delivered / cancelled orders
class CustomerOrdersScreen extends ConsumerStatefulWidget {
  const CustomerOrdersScreen({super.key});

  @override
  ConsumerState<CustomerOrdersScreen> createState() =>
      _CustomerOrdersScreenState();
}

class _CustomerOrdersScreenState extends ConsumerState<CustomerOrdersScreen> {
  _OrdersSegment _segment = _OrdersSegment.active;

  bool _isTerminalStatus(String code) {
    final upper = code.toUpperCase();
    return upper == 'DELIVERED' ||
        upper == 'CLOSED' ||
        upper == 'CANCELLED' ||
        upper == 'COMPLETED';
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final ordersAsync = ref.watch(customerOrdersProvider);
    final requestsAsync = ref.watch(customerQuickDropRequestsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.text('orders.title')),
        actions: const [CustomerLocaleSwitchWidget()],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.sm,
              ),
              child: AppSegmentedControlWidget<_OrdersSegment>(
                selectedValue: _segment,
                onChanged: (next) => setState(() => _segment = next),
                options: [
                  AppSegmentOption(
                    value: _OrdersSegment.active,
                    label: localizations.text('orders.segmentActive'),
                  ),
                  AppSegmentOption(
                    value: _OrdersSegment.requests,
                    label: localizations.text('orders.segmentRequests'),
                  ),
                  AppSegmentOption(
                    value: _OrdersSegment.history,
                    label: localizations.text('orders.segmentHistory'),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _segment == _OrdersSegment.requests
                  ? _buildRequestsTab(context, localizations, requestsAsync)
                  : _buildOrdersTab(
                      context,
                      localizations,
                      ordersAsync,
                      showHistory: _segment == _OrdersSegment.history,
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOrdersTab(
    BuildContext context,
    AppLocalizations localizations,
    AsyncValue<List<OrderSummaryModel>> ordersAsync, {
    required bool showHistory,
  }) {
    return ordersAsync.when(
      loading: () => ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: const [
          AppSkeletonWidget(height: 112),
          SizedBox(height: AppSpacing.md),
          AppSkeletonWidget(height: 112),
        ],
      ),
      error: (e, _) => ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          AppErrorWidget(
            title: localizations.text('orders.errorTitle'),
            message: localizations.text(
              e is AppException ? e.messageKey : 'common.remoteRequestError',
            ),
            retryLabel: localizations.text('orders.retryAction'),
            onRetry: () => ref.invalidate(customerOrdersProvider),
          ),
        ],
      ),
      data: (orders) {
        final filtered = orders
            .where((o) =>
                showHistory
                    ? _isTerminalStatus(o.statusCode)
                    : !_isTerminalStatus(o.statusCode))
            .toList(growable: false);

        return RefreshIndicator(
          onRefresh: () => ref.refresh(customerOrdersProvider.future),
          child: filtered.isEmpty
              ? ListView(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  children: [
                    AppEmptyStateWidget(
                      icon: showHistory
                          ? Icons.history_rounded
                          : Icons.local_laundry_service_outlined,
                      title: localizations.text(
                        showHistory
                            ? 'orders.emptyHistoryTitle'
                            : 'orders.emptyTitle',
                      ),
                      description: localizations.text(
                        showHistory
                            ? 'orders.emptyHistoryBody'
                            : 'orders.emptyBody',
                      ),
                      actionLabel: showHistory
                          ? null
                          : localizations.text('home.detailedOrderCta'),
                      onAction: showHistory
                          ? null
                          : () =>
                              Navigator.of(context).pushNamed(AppRoute.booking),
                    ),
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) =>
                      const SizedBox(height: AppSpacing.md),
                  itemBuilder: (context, index) {
                    final order = filtered[index];
                    return CustomerOrderSummaryCard(
                      order: order,
                      onOpen: () {
                        Navigator.of(context).pushNamed(
                          AppRoute.orderDetail,
                          arguments: order.orderNumber,
                        );
                      },
                    );
                  },
                ),
        );
      },
    );
  }

  Widget _buildRequestsTab(
    BuildContext context,
    AppLocalizations l10n,
    AsyncValue<List<QuickDropRequestModel>> requestsAsync,
  ) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

    return requestsAsync.when(
      loading: () => ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: const [
          AppSkeletonWidget(height: 112),
          SizedBox(height: AppSpacing.md),
          AppSkeletonWidget(height: 112),
        ],
      ),
      error: (e, _) => ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          AppErrorWidget(
            title: l10n.text('orders.errorTitle'),
            message: l10n.text(
              e is AppException ? e.messageKey : 'common.remoteRequestError',
            ),
            retryLabel: l10n.text('orders.retryAction'),
            onRetry: () => ref.invalidate(customerQuickDropRequestsProvider),
          ),
        ],
      ),
      data: (requests) => RefreshIndicator(
        onRefresh: () => ref.refresh(customerQuickDropRequestsProvider.future),
        child: requests.isEmpty
            ? ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: [
                  AppEmptyStateWidget(
                    icon: Icons.bolt_rounded,
                    title: l10n.text('orders.emptyRequestsTitle'),
                    description: l10n.text('orders.emptyRequestsBody'),
                    actionLabel: l10n.text('home.quickDropCta'),
                    onAction: () =>
                        Navigator.of(context).pushNamed(AppRoute.quickDrop),
                  ),
                ],
              )
            : ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.lg),
                itemCount: requests.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(height: AppSpacing.md),
                itemBuilder: (context, index) {
                  final req = requests[index];
                  final isConverted = req.requestStatusCode == 'CONVERTED' &&
                      (req.linkedOrderNo?.isNotEmpty ?? false);
                  return AppCardWidget(
                    accentColor: isConverted
                        ? ext.success.foreground
                        : theme.colorScheme.primary,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            AppCodeChipWidget(
                              code: ltrCode(req.requestNo),
                              copiedFeedbackMessage:
                                  l10n.text('common.copiedToClipboard'),
                            ),
                            const Spacer(),
                            AppStatusBadgeWidget(
                              label: req.requestStatusCode,
                              tone: isConverted
                                  ? CmxSemanticTone.success
                                  : req.requestStatusCode == 'CANCELLED' ||
                                          req.requestStatusCode == 'DECLINED'
                                      ? CmxSemanticTone.danger
                                      : CmxSemanticTone.info,
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          '${req.estimatedTotalBags} ${l10n.text('quickDrop.estimatedBagsLabel')} · '
                          '${req.estimatedTotalPieces} ${l10n.text('quickDrop.estimatedPiecesLabel')}',
                          style: theme.textTheme.bodyMedium,
                        ),
                        if ((req.customerNotes ?? '').trim().isNotEmpty) ...[
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            req.customerNotes!,
                            style: theme.textTheme.bodySmall
                                ?.copyWith(color: ext.textMuted),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                        if (isConverted) ...[
                          const SizedBox(height: AppSpacing.md),
                          SizedBox(
                            width: double.infinity,
                            child: AppCustomButtonWidget(
                              label:
                                  '${l10n.text('orders.openLinkedOrderAction')} (${ltrCode(req.linkedOrderNo!)})',
                              icon: Icons.arrow_forward_rounded,
                              onPressed: () {
                                Navigator.of(context).pushNamed(
                                  AppRoute.orderDetail,
                                  arguments: req.linkedOrderNo!,
                                );
                              },
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
      ),
    );
  }
}
