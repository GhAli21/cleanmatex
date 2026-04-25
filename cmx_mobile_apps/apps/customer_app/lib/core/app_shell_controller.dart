import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_services/mobile_services.dart';

import 'navigation/app_route.dart';
import 'providers/core_env_providers.dart';
import 'providers/network_providers.dart';
import 'providers/session_manager_provider.dart';
import '../features/auth/data/repositories/customer_auth_repository.dart';
import '../features/tenant/providers/tenant_provider.dart';

const Duration _bootstrapStepTimeout = Duration(milliseconds: 1200);

@immutable
class CustomerSessionFlowState {
  const CustomerSessionFlowState({
    this.isBootstrapping = false,
    this.hasFatalError = false,
    this.hasConnectivityIssue = false,
    this.session,
    this.pendingChallenge,
  });

  final bool isBootstrapping;
  final bool hasFatalError;
  final bool hasConnectivityIssue;
  final CustomerSessionModel? session;
  final CustomerAuthChallengeModel? pendingChallenge;

  bool get hasSession => session != null;

  CustomerSessionFlowState copyWith({
    bool? isBootstrapping,
    bool? hasFatalError,
    bool? hasConnectivityIssue,
    bool clearSession = false,
    CustomerSessionModel? session,
    bool clearPendingChallenge = false,
    CustomerAuthChallengeModel? pendingChallenge,
  }) {
    return CustomerSessionFlowState(
      isBootstrapping: isBootstrapping ?? this.isBootstrapping,
      hasFatalError: hasFatalError ?? this.hasFatalError,
      hasConnectivityIssue: hasConnectivityIssue ?? this.hasConnectivityIssue,
      session: clearSession ? null : (session ?? this.session),
      pendingChallenge: clearPendingChallenge
          ? null
          : (pendingChallenge ?? this.pendingChallenge),
    );
  }
}

class CustomerSessionFlowNotifier extends Notifier<CustomerSessionFlowState> {
  StreamSubscription<bool>? _connectivitySub;

  CustomerAuthRepository get _authRepository =>
      ref.read(customerAuthRepositoryProvider);
  SessionManager get _sessionManager => ref.read(sessionManagerProvider);
  ConnectivityService get _connectivityService =>
      ref.read(connectivityServiceProvider);

  @override
  CustomerSessionFlowState build() {
    ref.onDispose(() {
      _connectivitySub?.cancel();
    });
    return const CustomerSessionFlowState(
      isBootstrapping: true,
    );
  }

  /// Connectivity + session restore (saved tenant is loaded by [tenantProvider]).
  Future<void> bootstrap() async {
    state = state.copyWith(
      isBootstrapping: true,
      hasFatalError: false,
    );

    try {
      await _startConnectivityMonitoring().timeout(
        _bootstrapStepTimeout,
        onTimeout: () {
          AppLogger.warning(
            'Customer bootstrap: connectivity probe timed out; continuing startup.',
          );
        },
      );
      final rest = await _sessionManager.restoreSession().timeout(
        _bootstrapStepTimeout,
        onTimeout: () {
          AppLogger.warning(
            'Customer bootstrap: session restore timed out; continuing without saved session.',
          );
          return null;
        },
      );
      state = state.copyWith(
        session: rest,
        isBootstrapping: false,
        hasFatalError: false,
      );
    } catch (error, stackTrace) {
      AppLogger.error(
        'Customer bootstrap failed.',
        error: error,
        stackTrace: stackTrace,
      );
      state = state.copyWith(
        isBootstrapping: false,
        hasFatalError: true,
        clearSession: true,
        clearPendingChallenge: true,
      );
    }
  }

  Future<void> enterGuestMode() async {
    final t = _currentTenant;
    if (t == null) {
      return;
    }

    final branch = t.branches.length == 1 ? t.branches.first : null;
    final s = CustomerSessionModel(
      customerId: 'guest-customer',
      phoneNumber: '',
      isGuest: true,
      tenantOrgId: t.tenantOrgId,
      branchId: branch?.id,
      branchName: branch?.name,
      branchName2: branch?.name2,
    );
    state = state.copyWith(
      session: s,
      clearPendingChallenge: true,
    );
    await _sessionManager.saveSession(state.session!);
  }

  Future<void> signInWithPhone({required String phoneNumber}) async {
    final challenge =
        await _authRepository.requestOtp(phoneNumber: phoneNumber);
    state = state.copyWith(
      pendingChallenge: challenge,
    );
  }

  Future<void> signInDirectWithFixedOtp({
    required String phoneNumber,
    String otpCode = '123456',
  }) async {
    AppLogger.info(
      'Starting direct customer sign-in for phone=$phoneNumber using fixed OTP flow',
    );
    await signInWithPhone(phoneNumber: phoneNumber);
    await verifyOtpCode(otpCode: otpCode);
    AppLogger.info(
      'Direct customer sign-in completed for phone=$phoneNumber',
    );
  }

  Future<void> verifyOtpCode({required String otpCode}) async {
    final challenge = state.pendingChallenge;
    if (challenge == null) {
      return;
    }
    final t = _currentTenant;
    if (t == null) {
      throw const AuthServiceException(
        code: 'auth_missing_tenant',
        messageKey: 'loginEntry.genericError',
      );
    }

    final branch = _selectedBranch;
    final s = await _authRepository.verifyOtp(
      challenge: challenge,
      otpCode: otpCode,
      tenantOrgId: t.tenantOrgId,
      branch: branch,
    );
    state = state.copyWith(
      session: s,
      clearPendingChallenge: true,
    );
    await _sessionManager.saveSession(state.session!);
  }

  Future<void> clearSession() async {
    state = state.copyWith(
      clearSession: true,
      clearPendingChallenge: true,
    );
    await _sessionManager.clearSession();
  }

  /// Persists a refreshed access token and updates in-memory [session] after HTTP 401 recovery.
  void applyRefreshedSession(CustomerSessionModel session) {
    state = state.copyWith(
      session: session,
      clearPendingChallenge: true,
    );
  }

  Future<void> refreshConnectivityStatus() async {
    final isOnline = await _connectivityService.isOnline().timeout(
      _bootstrapStepTimeout,
      onTimeout: () {
        AppLogger.warning(
          'Customer bootstrap: connectivity status timed out; assuming online until stream updates.',
        );
        return true;
      },
    );
    _setConnectivityIssue(!isOnline);
  }

  TenantModel? get _currentTenant {
    final t = ref.read(tenantProvider);
    return t.hasValue ? t.value : null;
  }

  BranchOptionModel? get _selectedBranch {
    final t = _currentTenant;
    if (t == null || t.branches.length != 1) {
      return null;
    }
    return t.branches.first;
  }

  Future<void> _startConnectivityMonitoring() async {
    if (_connectivitySub != null) {
      return;
    }

    await refreshConnectivityStatus();
    _connectivitySub =
        _connectivityService.connectivityChanges().listen((isOnline) {
      _setConnectivityIssue(!isOnline);
    });
  }

  void _setConnectivityIssue(bool hasIssue) {
    if (state.hasConnectivityIssue == hasIssue) {
      return;
    }
    state = state.copyWith(hasConnectivityIssue: hasIssue);
  }
}

class CustomerLocaleNotifier extends Notifier<Locale> {
  @override
  Locale build() => AppLocale.supportedLocales.first;

  void toggleLocale() {
    state =
        state.languageCode == 'en' ? const Locale('ar') : const Locale('en');
  }
}

final customerSessionFlowProvider =
    NotifierProvider<CustomerSessionFlowNotifier, CustomerSessionFlowState>(
  CustomerSessionFlowNotifier.new,
);

final customerLocaleProvider = NotifierProvider<CustomerLocaleNotifier, Locale>(
    CustomerLocaleNotifier.new);

String resolveRouteAfterTenantConfirmation(CustomerSessionFlowState flow) {
  if (flow.isBootstrapping) {
    return AppRoute.splash;
  }
  if (flow.hasFatalError) {
    return AppRoute.error;
  }
  if (flow.hasConnectivityIssue) {
    return AppRoute.offline;
  }
  if (flow.pendingChallenge != null) {
    return AppRoute.otpVerify;
  }
  if (flow.hasSession) {
    return AppRoute.home;
  }
  return AppRoute.entry;
}

String resolveRouteAfterTenantBootstrap({
  required CustomerSessionFlowState flow,
  required TenantModel? tenant,
}) {
  if (flow.isBootstrapping) {
    return AppRoute.splash;
  }
  if (flow.hasFatalError) {
    return AppRoute.error;
  }
  if (flow.hasConnectivityIssue) {
    return AppRoute.offline;
  }
  if (tenant == null) {
    return AppRoute.tenantDiscovery;
  }
  return resolveRouteAfterTenantConfirmation(flow);
}

String resolveGatedDefaultRoute({
  required CustomerSessionFlowState flow,
  required AsyncValue<TenantModel?> tenantState,
}) {
  if (flow.isBootstrapping) {
    return AppRoute.splash;
  }
  final t = tenantState.hasValue ? tenantState.value : null;
  if (flow.hasFatalError) {
    return AppRoute.error;
  }
  if (flow.hasConnectivityIssue) {
    return AppRoute.offline;
  }
  if (t == null) {
    return AppRoute.tenantDiscovery;
  }
  return resolveRouteAfterTenantConfirmation(flow);
}
