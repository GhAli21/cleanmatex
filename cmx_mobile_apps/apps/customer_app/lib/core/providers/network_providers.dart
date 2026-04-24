import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_services/mobile_services.dart';

import '../../features/auth/data/repositories/customer_auth_repository.dart';

/// HTTP client for auth and unauthenticated public calls (no 401 → refresh loop).
final plainHttpClientProvider = Provider<MobileHttpClient>(
  (ref) => MobileHttpClient(config: AppConfig.fromEnvironment()),
);

/// Auth API; uses [plainHttpClientProvider] so refresh calls never recurse through
/// the session-aware [customerApiHttpClientProvider].
final customerAuthRepositoryProvider = Provider<CustomerAuthRepository>(
  (ref) => CustomerAuthRepository(
    authApiService: AuthApiService(
      httpClient: ref.read(plainHttpClientProvider),
    ),
  ),
);
