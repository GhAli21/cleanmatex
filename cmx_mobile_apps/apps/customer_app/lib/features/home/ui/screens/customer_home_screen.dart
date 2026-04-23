import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';
import '../cards/customer_home_active_orders_card.dart';
import '../cards/customer_home_service_status_card.dart';

class CustomerHomeScreen extends StatelessWidget {
  const CustomerHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final controller = CustomerAppScope.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.text('app.title')),
        actions: const [
          CustomerLocaleSwitchWidget(),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            AppHeaderWidget(
              title: localizations.text('home.title'),
              subtitle: localizations.text('home.subtitle'),
            ),
            const SizedBox(height: AppSpacing.lg),
            CustomerHomeActiveOrdersCard(
              onOpenOrders: () {
                Navigator.of(context).pushNamed(AppRoute.orders);
              },
            ),
            const SizedBox(height: AppSpacing.lg),
            CustomerHomeServiceStatusCard(
              onOpenServices: () {
                Navigator.of(context).pushNamed(AppRoute.booking);
              },
            ),
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              width: double.infinity,
              child: AppCustomButtonWidget(
                label: localizations.text('home.signOutAction'),
                onPressed: () async {
                  await controller.clearSession();
                  if (!context.mounted) {
                    return;
                  }

                  Navigator.of(context).pushNamedAndRemoveUntil(
                    AppRoute.entry,
                    (route) => false,
                  );
                },
                isPrimary: false,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
