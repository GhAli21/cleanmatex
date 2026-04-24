import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_services/mobile_services.dart';

import '../app_shell_controller.dart';
import '../../features/booking/data/repositories/customer_order_booking_repository.dart';
import '../../features/orders/data/repositories/customer_orders_repository.dart';
import 'network_providers.dart';
import 'session_manager_provider.dart';

/// Shared client for authorized customer public APIs: retries once after 401 when refresh succeeds.
final customerApiHttpClientProvider = Provider<MobileHttpClient>(
  (ref) {
    return MobileHttpClient(
      config: AppConfig.fromEnvironment(),
      onSessionRefresh: () => _refreshSessionForUnauthorized(ref),
    );
  },
);

Future<CustomerSessionModel?> _refreshSessionForUnauthorized(Ref ref) async {
  final sm = ref.read(sessionManagerProvider);
  final current = await sm.restoreSession();
  if (current == null || !current.hasVerificationToken) {
    return null;
  }
  try {
    final fresh = await ref.read(customerAuthRepositoryProvider).refreshSession(
          session: current,
        );
    await sm.saveSession(fresh);
    ref.read(customerSessionFlowProvider.notifier).applyRefreshedSession(fresh);
    return fresh;
  } on AuthServiceException {
    return null;
  } catch (_) {
    return null;
  }
}

final customerOrdersRepositoryProvider = Provider<CustomerOrdersRepository>(
  (ref) => CustomerOrdersRepository(
    trackingService: OrderTrackingService(
      httpClient: ref.read(customerApiHttpClientProvider),
    ),
  ),
);

final customerOrderBookingRepositoryProvider =
    Provider<CustomerOrderBookingRepository>(
  (ref) => CustomerOrderBookingRepository(
    bookingService: OrderBookingService(
      httpClient: ref.read(customerApiHttpClientProvider),
    ),
  ),
);
