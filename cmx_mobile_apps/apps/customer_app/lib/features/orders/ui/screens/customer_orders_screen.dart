import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';
import '../../providers/customer_orders_provider.dart';
import '../cards/customer_order_summary_card.dart';

class CustomerOrdersScreen extends StatefulWidget {
  const CustomerOrdersScreen({super.key});

  @override
  State<CustomerOrdersScreen> createState() => _CustomerOrdersScreenState();
}

class _CustomerOrdersScreenState extends State<CustomerOrdersScreen> {
  late final CustomerOrdersProvider _provider;
  bool _hasStartedInitialLoad = false;

  @override
  void initState() {
    super.initState();
    _provider = CustomerOrdersProvider();
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
      _provider.load(appController.session);
    }

    return AnimatedBuilder(
      animation: _provider,
      builder: (context, _) {
        return Scaffold(
          appBar: AppBar(
            title: Text(localizations.text('orders.title')),
            actions: const [
              CustomerLocaleSwitchWidget(),
            ],
          ),
          body: SafeArea(
            child: RefreshIndicator(
              onRefresh: () => _provider.load(appController.session),
              child: ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: [
                  AppHeaderWidget(
                    title: localizations.text('orders.title'),
                    subtitle: localizations.text('orders.subtitle'),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  if (_provider.isLoading)
                    AppLoadingIndicator(
                      label: localizations.text('orders.loading'),
                    )
                  else if (_provider.errorMessageKey != null)
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
                            localizations.text(_provider.errorMessageKey!),
                            style: Theme.of(context).textTheme.bodyLarge,
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          SizedBox(
                            width: double.infinity,
                            child: AppCustomButtonWidget(
                              label: localizations.text('orders.retryAction'),
                              onPressed: () =>
                                  _provider.load(appController.session),
                            ),
                          ),
                        ],
                      ),
                    )
                  else if (_provider.isEmpty)
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
                    ..._provider.orders.map(
                      (order) => Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                        child: CustomerOrderSummaryCard(
                          order: order,
                          onOpen: () {
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
            ),
          ),
        );
      },
    );
  }
}
