import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
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

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.text('orders.detailTitle')),
        actions: const [
          CustomerLocaleSwitchWidget(),
        ],
      ),
      body: SafeArea(
        child: async.when(
          data: (order) => ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              AppHeaderWidget(
                title: order.orderNumber,
                subtitle:
                    '${localizations.text(order.statusLabelKey)} • ${order.promisedWindow}',
              ),
              const SizedBox(height: AppSpacing.lg),
              AppCardWidget(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      localizations.text('orders.detailSummaryTitle'),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      localizations.textWithArg(
                        'orders.garmentCount',
                        order.garmentCount.toString(),
                      ),
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      localizations.text(order.deliveryModeLabelKey),
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              AppCardWidget(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      localizations.text('orders.timelineTitle'),
                      style: Theme.of(context).textTheme.titleLarge,
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
          ),
          error: (e, _) {
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
          loading: () => ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              AppLoadingIndicator(
                label: localizations.text('orders.detailLoading'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
