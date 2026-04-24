import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';
import '../../../orders/providers/customer_orders_provider.dart';
import '../cards/customer_home_active_orders_card.dart';
import '../cards/customer_home_service_status_card.dart';

class CustomerHomeScreen extends ConsumerWidget {
  const CustomerHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final localizations = AppLocalizations.of(context);
    final session =
        ref.watch(customerSessionFlowProvider.select((f) => f.session));
    final ordersAsync = ref.watch(customerOrdersProvider);
    AppLogger.info(
      'home_screen.render hasSession=${session != null} isGuest=${session?.isGuest == true}',
    );

    final greeting = session?.isGuest == true
        ? localizations.text('home.greetingGuest')
        : localizations.textWithArg(
            'home.greetingTitle',
            session?.displayName ?? session?.phoneNumber ?? '',
          );

    final activeCount = ordersAsync.valueOrNull
            ?.where((o) =>
                o.statusCode != 'completed' && o.statusCode != 'delivered')
            .length ??
        0;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          localizations.text('app.title'),
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: AppColors.primary,
                fontWeight: FontWeight.w800,
              ),
        ),
        actions: [
          IconButton(
            tooltip: localizations.text('home.profileAction'),
            icon: const Icon(Icons.person_outline_rounded),
            onPressed: () {
              AppLogger.info('home_screen.open_profile_tapped');
              Navigator.of(context).pushNamed(AppRoute.profile);
            },
          ),
          const CustomerLocaleSwitchWidget(),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            AppHeaderWidget(
              title: greeting,
              subtitle: localizations.text('home.subtitle'),
            ),
            const SizedBox(height: AppSpacing.lg),
            CustomerHomeActiveOrdersCard(
              activeCount: activeCount,
              onOpenOrders: () {
                AppLogger.info(
                  'home_screen.open_orders_tapped activeCount=$activeCount',
                );
                Navigator.of(context).pushNamed(AppRoute.orders);
              },
            ),
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              width: double.infinity,
              child: AppCustomButtonWidget(
                label: localizations.text('home.bookNewOrderAction'),
                onPressed: () {
                  AppLogger.info('home_screen.open_booking_primary_tapped');
                  Navigator.of(context).pushNamed(AppRoute.booking);
                },
                icon: Icons.add_circle_outline_rounded,
                trailingIcon: Icons.arrow_forward_rounded,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            CustomerHomeServiceStatusCard(
              onOpenServices: () {
                AppLogger.info('home_screen.open_services_tapped');
                Navigator.of(context).pushNamed(AppRoute.booking);
              },
            ),
          ],
        ),
      ),
    );
  }
}
