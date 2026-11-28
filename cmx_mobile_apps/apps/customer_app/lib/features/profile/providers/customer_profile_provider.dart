import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

import '../../../core/app_shell_controller.dart';
import '../../../core/providers/customer_api_client_providers.dart';
import '../../tenant/providers/tenant_provider.dart';

/// Loads and mutates the authenticated customer's full CleanMateX profile
/// (customer code, verified contacts, dual-scope addresses, care preferences,
/// saved default order note + auto-apply flag).
final customerProfileProvider =
    AsyncNotifierProvider<CustomerProfileNotifier, CustomerProfileModel?>(
  CustomerProfileNotifier.new,
);

class CustomerProfileNotifier extends AsyncNotifier<CustomerProfileModel?> {
  @override
  Future<CustomerProfileModel?> build() async {
    final session =
        ref.watch(customerSessionFlowProvider.select((f) => f.session));
    final token = session?.verificationToken;
    if (session == null || session.isGuest || token == null || token.isEmpty) {
      return null;
    }
    final tenant = ref.watch(tenantProvider).valueOrNull;
    final tenantId = tenant?.tenantOrgId ?? session.tenantOrgId;
    if (tenantId == null || tenantId.isEmpty) {
      return null;
    }
    return ref.read(customerProfileServiceProvider).fetchProfile(
          tenantId: tenantId,
          bearerToken: token,
        );
  }

  ({String tenantId, String token}) _requireAuth() {
    final session = ref.read(customerSessionFlowProvider).session;
    final tenant = ref.read(tenantProvider).valueOrNull;
    final tenantId = tenant?.tenantOrgId ?? session?.tenantOrgId ?? '';
    final token = session?.verificationToken ?? '';
    return (tenantId: tenantId, token: token);
  }

  Future<void> updateContact({
    String? name,
    String? mobile,
    String? email,
  }) async {
    final auth = _requireAuth();
    final updated = await ref.read(customerProfileServiceProvider).updateProfile(
          tenantId: auth.tenantId,
          bearerToken: auth.token,
          name: name,
          mobile: mobile,
          email: email,
        );
    state = AsyncData(updated);
    AppLogger.info('profile_provider.contact_updated');
  }

  Future<void> updatePreferences(Map<String, Object?> preferences) async {
    final auth = _requireAuth();
    final updated = await ref.read(customerProfileServiceProvider).updateProfile(
          tenantId: auth.tenantId,
          bearerToken: auth.token,
          preferences: preferences,
        );
    state = AsyncData(updated);
    AppLogger.info('profile_provider.preferences_updated');
  }

  Future<void> updateDefaultOrderNote({
    required String defaultOrderNote,
    required bool autoApplyOrderDefaultNote,
  }) async {
    final auth = _requireAuth();
    final updated = await ref.read(customerProfileServiceProvider).updateProfile(
          tenantId: auth.tenantId,
          bearerToken: auth.token,
          defaultOrderNote: defaultOrderNote,
          autoApplyOrderDefaultNote: autoApplyOrderDefaultNote,
        );
    state = AsyncData(updated);
    AppLogger.info(
      'profile_provider.default_order_note_updated autoApply=$autoApplyOrderDefaultNote',
    );
  }

  Future<void> addAddress({
    required String label,
    String addressType = 'home',
    String? building,
    String? floor,
    String? apartment,
    String? street,
    String? area,
    String? city,
    String? deliveryNotes,
    bool isDefault = false,
  }) async {
    final auth = _requireAuth();
    final created = await ref.read(customerProfileServiceProvider).createAddress(
          tenantId: auth.tenantId,
          bearerToken: auth.token,
          label: label,
          addressType: addressType,
          building: building,
          floor: floor,
          apartment: apartment,
          street: street,
          area: area,
          city: city,
          deliveryNotes: deliveryNotes,
          isDefault: isDefault,
        );
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncData(
        current.copyWith(addresses: [...current.addresses, created]),
      );
    } else {
      ref.invalidateSelf();
    }
    AppLogger.info('profile_provider.address_added id=${created.id}');
  }
}
