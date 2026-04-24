import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_services/mobile_services.dart';

import '../../../core/providers/network_providers.dart';
import '../data/repositories/customer_auth_repository.dart';
import '../../../features/tenant/providers/tenant_provider.dart';

@immutable
class SetPasswordState {
  const SetPasswordState({
    this.newPassword = '',
    this.confirmPassword = '',
    this.isSubmitting = false,
    this.isSuccess = false,
    this.errorMessageKey,
  });

  final String newPassword;
  final String confirmPassword;
  final bool isSubmitting;
  final bool isSuccess;
  final String? errorMessageKey;

  SetPasswordState copyWith({
    String? newPassword,
    String? confirmPassword,
    bool? isSubmitting,
    bool? isSuccess,
    String? errorMessageKey,
    bool clearError = false,
  }) {
    return SetPasswordState(
      newPassword: newPassword ?? this.newPassword,
      confirmPassword: confirmPassword ?? this.confirmPassword,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      isSuccess: isSuccess ?? this.isSuccess,
      errorMessageKey: clearError ? null : (errorMessageKey ?? this.errorMessageKey),
    );
  }
}

class CustomerSetPasswordNotifier extends Notifier<SetPasswordState> {
  @override
  SetPasswordState build() => const SetPasswordState();

  CustomerAuthRepository get _repo => ref.read(customerAuthRepositoryProvider);

  void updateNewPassword(String value) =>
      state = state.copyWith(newPassword: value, clearError: true);

  void updateConfirmPassword(String value) =>
      state = state.copyWith(confirmPassword: value, clearError: true);

  Future<void> submit({required String verificationToken}) async {
    if (state.newPassword.length < 8) {
      state = state.copyWith(errorMessageKey: 'auth.passwordMinLengthError');
      return;
    }

    if (state.newPassword != state.confirmPassword) {
      state = state.copyWith(errorMessageKey: 'auth.passwordMismatchError');
      return;
    }

    final tenant = ref.read(tenantProvider).valueOrNull;
    if (tenant == null) {
      state = state.copyWith(errorMessageKey: 'loginEntry.genericError');
      return;
    }

    state = state.copyWith(isSubmitting: true, clearError: true);

    try {
      await _repo.setPassword(
        verificationToken: verificationToken,
        tenantId: tenant.tenantOrgId,
        newPassword: state.newPassword,
      );
      state = state.copyWith(isSubmitting: false, isSuccess: true);
    } on AuthServiceException catch (e) {
      state = state.copyWith(isSubmitting: false, errorMessageKey: e.messageKey);
    } catch (_) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessageKey: 'common.remoteRequestError',
      );
    }
  }

  void reset() => state = const SetPasswordState();
}

final customerSetPasswordProvider =
    NotifierProvider<CustomerSetPasswordNotifier, SetPasswordState>(
  CustomerSetPasswordNotifier.new,
);
