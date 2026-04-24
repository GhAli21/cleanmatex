import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_services/mobile_services.dart';

import '../../../core/app_shell_controller.dart';
import '../../../core/providers/network_providers.dart';
import '../data/repositories/customer_auth_repository.dart';
import '../../../features/tenant/providers/tenant_provider.dart';

@immutable
class PasswordLoginState {
  const PasswordLoginState({
    this.password = '',
    this.isSubmitting = false,
    this.errorMessageKey,
  });

  final String password;
  final bool isSubmitting;
  final String? errorMessageKey;

  PasswordLoginState copyWith({
    String? password,
    bool? isSubmitting,
    String? errorMessageKey,
    bool clearError = false,
  }) {
    return PasswordLoginState(
      password: password ?? this.password,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessageKey: clearError ? null : (errorMessageKey ?? this.errorMessageKey),
    );
  }
}

class CustomerPasswordLoginNotifier extends Notifier<PasswordLoginState> {
  @override
  PasswordLoginState build() => const PasswordLoginState();

  CustomerAuthRepository get _repo => ref.read(customerAuthRepositoryProvider);

  void updatePassword(String value) {
    state = state.copyWith(password: value, clearError: true);
  }

  Future<void> submit({required String phoneNumber}) async {
    if (state.password.length < 8) {
      state = state.copyWith(errorMessageKey: 'auth.passwordMinLengthError');
      return;
    }

    final tenant = ref.read(tenantProvider).valueOrNull;
    if (tenant == null) {
      state = state.copyWith(errorMessageKey: 'loginEntry.genericError');
      return;
    }

    state = state.copyWith(isSubmitting: true, clearError: true);

    try {
      final session = await _repo.loginWithPassword(
        phoneNumber: phoneNumber,
        password: state.password,
        tenantId: tenant.tenantOrgId,
      );
      ref.read(customerSessionFlowProvider.notifier).applyRefreshedSession(session);
    } on AuthServiceException catch (e) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessageKey: e.messageKey,
      );
    } catch (_) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessageKey: 'auth.invalidPasswordError',
      );
    }
  }

  void reset() => state = const PasswordLoginState();
}

final customerPasswordLoginProvider =
    NotifierProvider<CustomerPasswordLoginNotifier, PasswordLoginState>(
  CustomerPasswordLoginNotifier.new,
);
