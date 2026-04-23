import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';
import '../../providers/customer_order_detail_provider.dart';
import '../cards/customer_order_timeline_step_card.dart';

class CustomerOrderDetailScreen extends StatefulWidget {
  const CustomerOrderDetailScreen({
    super.key,
    required this.orderId,
  });

  final String orderId;

  @override
  State<CustomerOrderDetailScreen> createState() =>
      _CustomerOrderDetailScreenState();
}

class _CustomerOrderDetailScreenState extends State<CustomerOrderDetailScreen> {
  late final CustomerOrderDetailProvider _provider;
  bool _hasStartedInitialLoad = false;

  @override
  void initState() {
    super.initState();
    _provider = CustomerOrderDetailProvider();
  }

  @override
  void dispose() {
    _provider.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final appController = CustomerAppScope.of(context);

    if (!_hasStartedInitialLoad) {
      _hasStartedInitialLoad = true;
      _provider.load(
        session: appController.session,
        orderNumber: widget.orderId,
      );
    }

    return AnimatedBuilder(
      animation: _provider,
      builder: (context, _) {
        final order = _provider.order;

        return Scaffold(
          appBar: AppBar(
            title: Text(localizations.text('orders.detailTitle')),
            actions: const [
              CustomerLocaleSwitchWidget(),
            ],
          ),
          body: SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                if (_provider.isLoading)
                  AppLoadingIndicator(
                    label: localizations.text('orders.detailLoading'),
                  )
                else if (_provider.errorMessageKey != null)
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
                          localizations.text(_provider.errorMessageKey!),
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        SizedBox(
                          width: double.infinity,
                          child: AppCustomButtonWidget(
                            label: localizations.text('orders.retryAction'),
                            onPressed: () => _provider.load(
                              session: appController.session,
                              orderNumber: widget.orderId,
                            ),
                          ),
                        ),
                      ],
                    ),
                  )
                else if (order != null) ...[
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
                            padding:
                                const EdgeInsets.only(bottom: AppSpacing.lg),
                            child: CustomerOrderTimelineStepCard(step: step),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
