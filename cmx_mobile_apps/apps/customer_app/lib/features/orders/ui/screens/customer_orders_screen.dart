import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/navigation/app_route.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';
import '../../providers/customer_orders_provider.dart';
import '../cards/customer_order_summary_card.dart';

class CustomerOrdersScreen extends ConsumerWidget {
  const CustomerOrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final localizations = AppLocalizations.of(context);
    final async = ref.watch(customerOrdersProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.text('orders.title')),
        actions: const [
          CustomerLocaleSwitchWidget(),
        ],
      ),
      body: SafeArea(
        child: async.when(
          data: (orders) {
            AppLogger.info('orders_screen.data_rendered ordersCount=${orders.length}');
            return _OrdersBody(
              localizations: localizations,
              orders: orders,
              onRefresh: () {
                AppLogger.info('orders_screen.refresh_requested');
                return ref.refresh(customerOrdersProvider.future);
              },
            );
          },
          error: (e, _) {
            AppLogger.error('orders_screen.error_rendered', error: e);
            return _OrdersError(
              localizations: localizations,
              messageKey: e is AppException
                  ? e.messageKey
                  : 'common.remoteRequestError',
              onRetry: () {
                AppLogger.info('orders_screen.retry_requested');
                ref.invalidate(customerOrdersProvider);
              },
            );
          },
          loading: () {
            AppLogger.info('orders_screen.loading_rendered');
            return ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                AppHeaderWidget(
                  title: localizations.text('orders.title'),
                  subtitle: localizations.text('orders.subtitle'),
                ),
                const SizedBox(height: AppSpacing.lg),
                AppLoadingIndicator(
                  label: localizations.text('orders.loading'),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _OrdersBody extends StatelessWidget {
  const _OrdersBody({
    required this.localizations,
    required this.orders,
    required this.onRefresh,
  });

  final AppLocalizations localizations;
  final List<OrderSummaryModel> orders;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          AppHeaderWidget(
            title: localizations.text('orders.title'),
            subtitle: localizations.text('orders.subtitle'),
          ),
          const SizedBox(height: AppSpacing.lg),
          if (orders.isEmpty)
            AppCardWidget(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    localizations.text('orders.emptyTitle'),
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    localizations.text('orders.emptyBody'),
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ],
              ),
            )
          else
            ...orders.map(
              (order) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                child: CustomerOrderSummaryCard(
                  order: order,
                  onOpen: () {
                    AppLogger.info(
                      'orders_screen.open_order_detail orderNumber=${order.orderNumber}',
                    );
                    Navigator.of(context).pushNamed(
                      AppRoute.orderDetail,
                      arguments: order.orderNumber,
                    );
                  },
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _OrdersError extends StatelessWidget {
  const _OrdersError({
    required this.localizations,
    required this.messageKey,
    required this.onRetry,
  });

  final AppLocalizations localizations;
  final String messageKey;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        AppHeaderWidget(
          title: localizations.text('orders.title'),
          subtitle: localizations.text('orders.subtitle'),
        ),
        const SizedBox(height: AppSpacing.lg),
        AppCardWidget(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                localizations.text('orders.errorTitle'),
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                localizations.text(messageKey),
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: AppSpacing.lg),
              SizedBox(
                width: double.infinity,
                child: AppCustomButtonWidget(
                  label: localizations.text('orders.retryAction'),
                  onPressed: onRetry,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
