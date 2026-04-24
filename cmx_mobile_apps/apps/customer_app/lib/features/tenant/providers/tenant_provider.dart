import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

import '../../../core/providers/app_dependencies.dart';
import '../../../core/providers/session_manager_provider.dart';

final matchingTenantsProvider =
    FutureProvider.family<List<TenantModel>, String>((ref, phoneNumber) {
  AppLogger.info('matchingTenantsProvider started for phone=$phoneNumber');
  return ref.read(tenantServiceProvider).listTenantsForPhone(phoneNumber);
});

final tenantProvider =
    AsyncNotifierProvider<TenantNotifier, TenantModel?>(TenantNotifier.new);

class TenantNotifier extends AsyncNotifier<TenantModel?> {
  @override
  Future<TenantModel?> build() {
    return ref.read(sessionManagerProvider).restoreTenant();
  }

  Future<TenantModel?> hydrateSavedTenant() async {
    AppLogger.info('Hydrating saved tenant from session storage');
    final tenant = await ref.read(sessionManagerProvider).restoreTenant();
    state = AsyncData(tenant);
    return tenant;
  }

  Future<void> resolveBySlug(String slug) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () async {
        final tenant = await ref.read(tenantServiceProvider).resolveBySlug(slug);
        await ref.read(sessionManagerProvider).saveTenant(tenant);
        return tenant;
      },
    );
  }

  Future<void> selectTenant(TenantModel tenant) async {
    AppLogger.info('Selecting tenant ${tenant.tenantOrgId}');
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      await ref.read(sessionManagerProvider).saveTenant(tenant);
      AppLogger.info('Tenant persisted ${tenant.tenantOrgId}');
      return tenant;
    });
  }

  Future<void> clearTenant() async {
    AppLogger.info('Clearing selected tenant');
    await ref.read(sessionManagerProvider).clearTenant();
    state = const AsyncData(null);
  }
}
