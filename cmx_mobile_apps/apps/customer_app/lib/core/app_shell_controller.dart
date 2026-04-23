import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_services/mobile_services.dart';

import '../features/auth/data/repositories/customer_auth_repository.dart';
import 'navigation/app_route.dart';

class CustomerAppController extends ChangeNotifier {
  CustomerAppController({
    CustomerAuthRepository? authRepository,
    SessionManager? sessionManager,
    ConnectivityService? connectivityService,
  })  : _authRepository = authRepository ?? CustomerAuthRepository(),
        _sessionManager = sessionManager ?? SessionManager(),
        _connectivityService = connectivityService ?? ConnectivityService();

  final CustomerAuthRepository _authRepository;
  final SessionManager _sessionManager;
  final ConnectivityService _connectivityService;
  StreamSubscription<bool>? _connectivitySubscription;

  Locale _locale = AppLocale.supportedLocales.first;
  CustomerSessionModel? _session;
  CustomerAuthChallengeModel? _pendingChallenge;
  bool _hasConnectivityIssue = false;
  bool _hasFatalError = false;
  bool _isBootstrapping = false;

  Locale get locale => _locale;
  bool get hasSession => _session != null;
  CustomerSessionModel? get session => _session;
  CustomerAuthChallengeModel? get pendingChallenge => _pendingChallenge;
  bool get isBootstrapping => _isBootstrapping;
  bool get hasConnectivityIssue => _hasConnectivityIssue;
  bool get hasFatalError => _hasFatalError;

  void toggleLocale() {
    _locale =
        _locale.languageCode == 'en' ? const Locale('ar') : const Locale('en');
    notifyListeners();
  }

  Future<void> bootstrap() async {
    _isBootstrapping = true;
    notifyListeners();

    await _startConnectivityMonitoring();

    try {
      _session = await _sessionManager.restoreSession();
      _hasFatalError = false;
    } catch (_) {
      _hasFatalError = true;
    }

    _isBootstrapping = false;
    notifyListeners();
  }

  Future<void> refreshConnectivityStatus() async {
    final isOnline = await _connectivityService.isOnline();
    _setConnectivityIssue(!isOnline);
  }

  Future<void> enterGuestMode() async {
    _session = const CustomerSessionModel(
      customerId: 'guest-customer',
      phoneNumber: '',
      isGuest: true,
    );
    await _sessionManager.saveSession(_session!);
    notifyListeners();
  }

  Future<void> signInWithPhone({
    required String phoneNumber,
  }) async {
    _pendingChallenge =
        await _authRepository.requestOtp(phoneNumber: phoneNumber);
    notifyListeners();
  }

  Future<void> verifyOtpCode({
    required String otpCode,
  }) async {
    final challenge = _pendingChallenge;
    if (challenge == null) {
      return;
    }

    _session = await _authRepository.verifyOtp(
      challenge: challenge,
      otpCode: otpCode,
    );
    await _sessionManager.saveSession(_session!);
    _pendingChallenge = null;
    notifyListeners();
  }

  Future<void> clearSession() async {
    _session = null;
    _pendingChallenge = null;
    await _sessionManager.clearSession();
    notifyListeners();
  }

  String resolveInitialRoute() {
    if (_isBootstrapping) {
      return AppRoute.splash;
    }

    if (_hasFatalError) {
      return AppRoute.error;
    }

    if (_hasConnectivityIssue) {
      return AppRoute.offline;
    }

    if (_pendingChallenge != null) {
      return AppRoute.otpVerify;
    }

    if (hasSession) {
      return AppRoute.home;
    }

    return AppRoute.entry;
  }

  bool canAccessRoute(String routeName) {
    if (_hasConnectivityIssue && routeName != AppRoute.offline) {
      return false;
    }

    if (routeName == AppRoute.home) {
      return hasSession;
    }

    if (routeName == AppRoute.otpVerify) {
      return _pendingChallenge != null && !hasSession;
    }

    if (routeName == AppRoute.loginEntry || routeName == AppRoute.guestEntry) {
      return !hasSession;
    }

    return true;
  }

  Future<void> _startConnectivityMonitoring() async {
    if (_connectivitySubscription != null) {
      return;
    }

    await refreshConnectivityStatus();
    _connectivitySubscription =
        _connectivityService.connectivityChanges().listen((isOnline) {
      _setConnectivityIssue(!isOnline);
    });
  }

  void _setConnectivityIssue(bool hasConnectivityIssue) {
    if (_hasConnectivityIssue == hasConnectivityIssue) {
      return;
    }

    _hasConnectivityIssue = hasConnectivityIssue;
    notifyListeners();
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    super.dispose();
  }
}

class CustomerAppScope extends InheritedNotifier<CustomerAppController> {
  const CustomerAppScope({
    super.key,
    required CustomerAppController controller,
    required super.child,
  }) : super(notifier: controller);

  static CustomerAppController of(BuildContext context) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<CustomerAppScope>();
    assert(scope != null, 'CustomerAppScope not found in context.');
    return scope!.notifier!;
  }
}
