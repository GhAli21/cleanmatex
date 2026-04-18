import 'package:flutter/widgets.dart';

class AppLocale {
  const AppLocale._();

  static const english = 'en';
  static const arabic = 'ar';

  static const supportedLanguages = [
    english,
    arabic,
  ];

  static const supportedLocales = [
    Locale(english),
    Locale(arabic),
  ];
}
