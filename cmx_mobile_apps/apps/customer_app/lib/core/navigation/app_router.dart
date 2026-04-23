import 'package:flutter/material.dart';

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
import '../app_shell_controller.dart';
import 'app_route.dart';

class AppRouter {
  const AppRouter(this.controller);

  final CustomerAppController controller;

  Route<dynamic> onGenerateRoute(RouteSettings settings) {
    final requestedRoute = settings.name ?? AppRoute.error;
    final routeName = controller.canAccessRoute(requestedRoute)
        ? requestedRoute
        : controller.resolveInitialRoute();

    switch (routeName) {
      case AppRoute.splash:
        return MaterialPageRoute(
          builder: (_) => CustomerSplashScreen(controller: controller),
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
}
