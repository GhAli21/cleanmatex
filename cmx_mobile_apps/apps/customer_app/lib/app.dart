import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import 'core/app_shell_controller.dart';
import 'core/navigation/app_route.dart';
import 'core/navigation/app_router.dart';
import 'features/tenant/providers/tenant_provider.dart';

class CustomerApp extends ConsumerStatefulWidget {
  const CustomerApp({super.key});

  @override
  ConsumerState<CustomerApp> createState() => _CustomerAppState();
}

class _CustomerAppState extends ConsumerState<CustomerApp> {
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  bool _lastConnectivityIssue = false;
  bool _lastFatalError = false;

  @override
  Widget build(BuildContext context) {
    final config = AppConfig.fromEnvironment();
    final locale = ref.watch(customerLocaleProvider);
    ref.listen<CustomerSessionFlowState>(
      customerSessionFlowProvider,
      (previous, next) {
        if (previous == null) {
          _lastConnectivityIssue = next.hasConnectivityIssue;
          _lastFatalError = next.hasFatalError;
          return;
        }
        if (next.isBootstrapping) {
          return;
        }
        final connectivityChanged =
            _lastConnectivityIssue != next.hasConnectivityIssue;
        final fatalChanged = _lastFatalError != next.hasFatalError;
        _lastConnectivityIssue = next.hasConnectivityIssue;
        _lastFatalError = next.hasFatalError;

        if (!connectivityChanged && !fatalChanged) {
          return;
        }

        final navigator = _navigatorKey.currentState;
        if (navigator == null) {
          return;
        }

        navigator.pushNamedAndRemoveUntil(
          resolveGatedDefaultRoute(
            flow: next,
            tenantState: ref.read(tenantProvider),
          ),
          (route) => false,
        );
      },
    );

    AppLogger.info(
      'CustomerApp: env=${config.appEnv}, hasApiBaseUrl=${config.hasApiBaseUrl}',
    );

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      navigatorKey: _navigatorKey,
      locale: locale,
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
      onGenerateRoute: (settings) =>
          onGenerateCustomerRoute(ref, settings),
    );
  }
}
