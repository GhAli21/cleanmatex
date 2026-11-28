import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

class TestAppWrapper extends StatelessWidget {
  const TestAppWrapper({
    super.key,
    required this.child,
    this.overrides = const [],
    this.locale,
    this.theme,
    this.themeMode = ThemeMode.light,
  });

  final Widget child;
  final List<Override> overrides;
  final Locale? locale;
  final ThemeData? theme;
  final ThemeMode themeMode;

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        locale: locale,
        theme: theme ?? AppTheme.light(locale: locale),
        darkTheme: AppTheme.dark(locale: locale),
        themeMode: themeMode,
        supportedLocales: AppLocale.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: child,
      ),
    );
  }
}
