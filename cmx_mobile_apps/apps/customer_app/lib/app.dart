import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_services/mobile_services.dart';
import 'package:mobile_ui/mobile_ui.dart';

import 'core/app_shell_controller.dart';
import 'core/navigation/app_route.dart';
import 'core/navigation/app_router.dart';

class CustomerApp extends StatefulWidget {
  const CustomerApp({super.key});

  @override
  State<CustomerApp> createState() => _CustomerAppState();
}

class _CustomerAppState extends State<CustomerApp> {
  late final CustomerAppController _controller;
  late final AppRouter _router;
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  bool _lastConnectivityIssue = false;
  bool _lastFatalError = false;

  @override
  void initState() {
    super.initState();
    _controller = CustomerAppController(
      sessionManager: SessionManager(
        storage: FlutterSecureStorageSessionStorage(),
      ),
    );
    _router = AppRouter(_controller);
    _controller.addListener(_handleControllerChanged);
  }

  @override
  void dispose() {
    _controller.removeListener(_handleControllerChanged);
    _controller.dispose();
    super.dispose();
  }

  void _handleControllerChanged() {
    if (!mounted) {
      return;
    }

    final connectivityChanged =
        _lastConnectivityIssue != _controller.hasConnectivityIssue;
    final fatalChanged = _lastFatalError != _controller.hasFatalError;
    _lastConnectivityIssue = _controller.hasConnectivityIssue;
    _lastFatalError = _controller.hasFatalError;

    if (!connectivityChanged && !fatalChanged) {
      return;
    }

    final navigator = _navigatorKey.currentState;
    if (navigator == null || _controller.isBootstrapping) {
      return;
    }

    navigator.pushNamedAndRemoveUntil(
      _controller.resolveInitialRoute(),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final config = AppConfig.fromEnvironment();
    AppLogger.info(
      'CustomerApp bootstrap: env=${config.appEnv}, hasApiBaseUrl=${config.hasApiBaseUrl}, hasTenantOrgId=${config.hasTenantOrgId}',
    );

    return CustomerAppScope(
      controller: _controller,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          return MaterialApp(
            debugShowCheckedModeBanner: false,
            navigatorKey: _navigatorKey,
            locale: _controller.locale,
            onGenerateTitle: (context) => AppLocalizations.of(context).text(
              'app.title',
            ),
            theme: AppTheme.light(),
            darkTheme: AppTheme.dark(),
            supportedLocales: AppLocale.supportedLocales,
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            initialRoute: AppRoute.splash,
            onGenerateRoute: _router.onGenerateRoute,
          );
        },
      ),
    );
  }
}
