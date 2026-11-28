import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../../home/ui/screens/customer_home_screen.dart';
import '../../../orders/ui/screens/customer_orders_screen.dart';
import '../../../profile/ui/screens/customer_profile_screen.dart';
import '../../../receipts/ui/screens/customer_receipts_screen.dart';

/// Root 4-tab persistent navigation shell for CleanMateX Go:
/// - 0: Home (active laundry pill + live hero + Fast Quick Drop / Detailed Order)
/// - 1: Orders (Active · Requests · History)
/// - 2: Receipts (Digital VAT invoices & Always-Light sheet)
/// - 3: Account (Profile, addresses, care prefs, saved order note, theme/locale)
class CustomerShellScreen extends ConsumerStatefulWidget {
  const CustomerShellScreen({super.key, this.initialIndex = 0});

  final int initialIndex;

  @override
  ConsumerState<CustomerShellScreen> createState() =>
      _CustomerShellScreenState();
}

class _CustomerShellScreenState extends ConsumerState<CustomerShellScreen> {
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex.clamp(0, 3);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final flow = ref.watch(customerSessionFlowProvider);
    final isGuest = flow.session?.isGuest == true;

    final tabs = <Widget>[
      const CustomerHomeScreen(),
      if (isGuest)
        _GuestSignInPrompt(
          icon: Icons.local_laundry_service_outlined,
          title: l10n.text('orders.title'),
          message: l10n.text('guest.signInRequiredOrders'),
        )
      else
        const CustomerOrdersScreen(),
      if (isGuest)
        _GuestSignInPrompt(
          icon: Icons.receipt_long_outlined,
          title: l10n.text('receipts.title'),
          message: l10n.text('guest.signInRequiredReceipts'),
        )
      else
        const CustomerReceiptsScreen(),
      if (isGuest)
        _GuestSignInPrompt(
          icon: Icons.person_outline_rounded,
          title: l10n.text('profile.title'),
          message: l10n.text('guest.signInRequiredProfile'),
        )
      else
        const CustomerProfileScreen(),
    ];

    return Scaffold(
      body: Column(
        children: [
          if (flow.hasConnectivityIssue)
            SafeArea(
              bottom: false,
              child: AppOfflineBannerWidget(
                message: l10n.text('offline.bannerMessage'),
                retryLabel: l10n.text('common.retry'),
                onRetry: () => ref
                    .read(customerSessionFlowProvider.notifier)
                    .refreshConnectivityStatus(),
              ),
            ),
          Expanded(
            child: IndexedStack(
              index: _currentIndex,
              children: tabs,
            ),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          HapticFeedback.selectionClick();
          setState(() => _currentIndex = index);
        },
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home_rounded),
            label: l10n.text('nav.home'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.local_laundry_service_outlined),
            selectedIcon: const Icon(Icons.local_laundry_service_rounded),
            label: l10n.text('nav.orders'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.receipt_long_outlined),
            selectedIcon: const Icon(Icons.receipt_long_rounded),
            label: l10n.text('nav.receipts'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline_rounded),
            selectedIcon: const Icon(Icons.person_rounded),
            label: l10n.text('nav.account'),
          ),
        ],
      ),
    );
  }
}

class _GuestSignInPrompt extends StatelessWidget {
  const _GuestSignInPrompt({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Center(
            child: AppEmptyStateWidget(
              icon: icon,
              title: title,
              description: message,
              actionLabel: l10n.text('entry.signInAction'),
              onAction: () =>
                  Navigator.of(context).pushNamed(AppRoute.loginEntry),
            ),
          ),
        ),
      ),
    );
  }
}
