import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import 'features/home/ui/screens/customer_home_screen.dart';

class CustomerApp extends StatelessWidget {
  const CustomerApp({super.key});

  @override
  Widget build(BuildContext context) {
    final config = AppConfig.fromEnvironment();
    AppLogger.info(
      'CustomerApp bootstrap: env=${config.appEnv}, hasApiBaseUrl=${config.hasApiBaseUrl}',
    );

    return MaterialApp(
      debugShowCheckedModeBanner: false,
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
      home: const CustomerHomeScreen(),
    );
  }
}
