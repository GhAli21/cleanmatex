import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app_shell_controller.dart';
import '../../features/auth/ui/screens/customer_login_entry_screen.dart';
import '../../features/auth/ui/screens/customer_otp_verification_screen.dart';
import '../../features/bootstrap/ui/screens/customer_splash_screen.dart';
import '../../features/entry/ui/screens/customer_entry_screen.dart';
import '../../features/guest/ui/screens/customer_guest_entry_screen.dart';
import '../../features/home/ui/screens/customer_home_screen.dart';
import '../../features/booking/ui/screens/customer_order_booking_screen.dart';
import '../../features/orders/ui/screens/customer_order_detail_screen.dart';
import '../../features/orders/ui/screens/customer_orders_screen.dart';
import '../../features/system/ui/screens/customer_error_screen.dart';
import '../../features/system/ui/screens/customer_offline_screen.dart';
import '../../features/tenant/ui/screens/customer_tenant_confirm_screen.dart';
import '../../features/tenant/ui/screens/customer_tenant_discovery_screen.dart';
import '../../features/tenant/providers/tenant_provider.dart';
import '../../features/profile/ui/screens/customer_profile_screen.dart';
import '../../features/auth/ui/screens/customer_password_login_screen.dart';
import '../../features/auth/ui/screens/customer_set_password_screen.dart';
import 'app_route.dart';

bool canAccessRoute(WidgetRef ref, String name) {
  final flow = ref.read(customerSessionFlowProvider);
  final tenantV = ref.read(tenantProvider);
  final t = tenantV.hasValue ? tenantV.value : null;

  if (flow.isBootstrapping && name != AppRoute.splash) {
    return false;
  }

  if (flow.hasFatalError) {
    return name == AppRoute.error;
  }
  if (flow.hasConnectivityIssue) {
    return name == AppRoute.offline;
  }
  if (name == AppRoute.splash) {
    return true;
  }
  if (name == AppRoute.tenantDiscovery) {
    return true;
  }
  if (name == AppRoute.tenantConfirm) {
    return t != null;
  }
  if (t == null) {
    return false;
  }
  if (name == AppRoute.home) {
    return flow.hasSession;
  }
  if (name == AppRoute.loginEntry || name == AppRoute.guestEntry) {
    return !flow.hasSession;
  }
  if (name == AppRoute.otpVerify) {
    return flow.pendingChallenge != null && !flow.hasSession;
  }
  if (name == AppRoute.entry) {
    return !flow.hasSession;
  }
  if (name == AppRoute.offline) {
    return true;
  }
  if (name == AppRoute.error) {
    return true;
  }
  if (name == AppRoute.orders ||
      name == AppRoute.booking ||
      name == AppRoute.orderDetail) {
    return flow.hasSession;
  }
  return true;
}

/// Maps [settings] to a page. Uses [ref] to enforce tenant + session guards.
Route<dynamic> onGenerateCustomerRoute(
  WidgetRef ref,
  RouteSettings settings,
) {
  final requested = settings.name ?? AppRoute.error;
  final allowed = canAccessRoute(ref, requested);
  final routeName = allowed
      ? requested
      : resolveGatedDefaultRoute(
          flow: ref.read(customerSessionFlowProvider),
          tenantState: ref.read(tenantProvider),
        );

  switch (routeName) {
    case AppRoute.splash:
      return MaterialPageRoute(
        builder: (_) => const CustomerSplashScreen(),
        settings: settings,
      );
    case AppRoute.tenantDiscovery:
      return MaterialPageRoute(
        builder: (_) => const CustomerTenantDiscoveryScreen(),
        settings: settings,
      );
    case AppRoute.tenantConfirm:
      return MaterialPageRoute(
        builder: (_) => const CustomerTenantConfirmScreen(),
        settings: settings,
      );
    case AppRoute.entry:
      return MaterialPageRoute(
        builder: (_) => const CustomerEntryScreen(),
        settings: settings,
      );
    case AppRoute.loginEntry:
      return MaterialPageRoute(
        builder: (_) => const CustomerLoginEntryScreen(),
        settings: settings,
      );
    case AppRoute.otpVerify:
      return MaterialPageRoute(
        builder: (_) => const CustomerOtpVerificationScreen(),
        settings: settings,
      );
    case AppRoute.guestEntry:
      return MaterialPageRoute(
        builder: (_) => const CustomerGuestEntryScreen(),
        settings: settings,
      );
    case AppRoute.booking:
      return MaterialPageRoute(
        builder: (_) => const CustomerOrderBookingScreen(),
        settings: settings,
      );
    case AppRoute.orders:
      return MaterialPageRoute(
        builder: (_) => const CustomerOrdersScreen(),
        settings: settings,
      );
    case AppRoute.orderDetail:
      final orderId = settings.arguments as String? ?? '';
      return MaterialPageRoute(
        builder: (_) => CustomerOrderDetailScreen(orderId: orderId),
        settings: settings,
      );
    case AppRoute.home:
      return MaterialPageRoute(
        builder: (_) => const CustomerHomeScreen(),
        settings: settings,
      );
    case AppRoute.profile:
      return MaterialPageRoute(
        builder: (_) => const CustomerProfileScreen(),
        settings: settings,
      );
    case AppRoute.passwordLogin:
      final phone = settings.arguments as String? ?? '';
      return MaterialPageRoute(
        builder: (_) => CustomerPasswordLoginScreen(phoneNumber: phone),
        settings: settings,
      );
    case AppRoute.setPassword:
      final token = settings.arguments as String? ?? '';
      return MaterialPageRoute(
        builder: (_) => CustomerSetPasswordScreen(verificationToken: token),
        settings: settings,
      );
    case AppRoute.offline:
      return MaterialPageRoute(
        builder: (_) => const CustomerOfflineScreen(),
        settings: settings,
      );
    case AppRoute.error:
    default:
      return MaterialPageRoute(
        builder: (_) => const CustomerErrorScreen(),
        settings: settings,
      );
  }
}
