import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../cards/customer_home_active_orders_card.dart';
import '../cards/customer_home_service_status_card.dart';

class CustomerHomeScreen extends StatelessWidget {
  const CustomerHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.text('app.title')),
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
            const CustomerHomeActiveOrdersCard(),
            const SizedBox(height: AppSpacing.lg),
            const CustomerHomeServiceStatusCard(),
          ],
        ),
      ),
    );
  }
}
