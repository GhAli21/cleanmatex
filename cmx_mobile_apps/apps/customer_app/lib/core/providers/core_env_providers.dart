import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_services/mobile_services.dart';

/// Shared [ConnectivityService] — used by the session / connectivity flow.
final connectivityServiceProvider = Provider<ConnectivityService>(
  (ref) => ConnectivityService(),
);

/// [TenantService] for slug resolution; uses the same [AppConfig] as the app.
final tenantServiceProvider = Provider<TenantService>(
  (ref) => TenantService(config: AppConfig.fromEnvironment()),
);
