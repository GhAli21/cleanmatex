import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

class AppLocalizations {
  const AppLocalizations(this.locale);

  final Locale locale;

  static const delegate = _AppLocalizationsDelegate();

  static const localizationsDelegates = [
    delegate,
  ];

  static AppLocalizations of(BuildContext context) {
    final localization = Localizations.of<AppLocalizations>(
      context,
      AppLocalizations,
    );

    assert(localization != null, 'AppLocalizations not found in context.');
    return localization!;
  }

  static const _localizedValues = <String, Map<String, String>>{
    'en': {
      'app.title': 'CleanMateX Customer',
      'bootstrap.title': 'Customer mobile foundation',
      'bootstrap.body':
          'The workspace bootstrap is complete and shared mobile foundations are now wired into the app shell.',
      'bootstrap.status': 'Milestone 2 foundations in progress',
      'home.title': 'Your laundry, clearly in view',
      'home.subtitle':
          'Track active orders, spot important updates quickly, and move into your next task without friction.',
      'home.activeOrdersTitle': 'Active orders',
      'home.activeOrdersBody':
          'Current orders, live status changes, and the next reassurance touchpoint will surface here as Milestone 3 expands.',
      'home.statusTitle': 'Service status',
      'home.statusBody':
          'The shared mobile foundations are ready, and the customer shell is now moving into real journey implementation.',
      'home.primaryAction': 'Track my orders',
      'home.secondaryAction': 'Browse services',
    },
    'ar': {
      'app.title': 'كلين ميت إكس للعملاء',
      'bootstrap.title': 'أساس تطبيق العملاء',
      'bootstrap.body':
          'اكتمل تجهيز مساحة العمل وتم ربط الأساسات المشتركة لتطبيقات الجوال داخل واجهة التطبيق.',
      'bootstrap.status': 'المرحلة الثانية قيد التنفيذ',
      'home.title': 'كل ما يخص طلباتك أمامك بوضوح',
      'home.subtitle':
          'تابع الطلبات النشطة، واعرف المستجدات المهمة بسرعة، وانتقل إلى خطوتك التالية بسهولة.',
      'home.activeOrdersTitle': 'الطلبات النشطة',
      'home.activeOrdersBody':
          'ستظهر هنا الطلبات الحالية وتغييرات الحالة وأهم نقاط الطمأنة للعميل مع توسع المرحلة الثالثة.',
      'home.statusTitle': 'حالة الخدمة',
      'home.statusBody':
          'أصبحت الأساسات المشتركة لتطبيقات الجوال جاهزة، ويجري الآن تطوير واجهة العميل نحو الرحلات الفعلية.',
      'home.primaryAction': 'تتبع طلباتي',
      'home.secondaryAction': 'استعراض الخدمات',
    },
  };

  String text(String key) {
    return _localizedValues[locale.languageCode]?[key] ??
        _localizedValues['en']![key] ??
        key;
  }

  TextDirection get textDirection {
    return locale.languageCode == 'ar'
        ? TextDirection.rtl
        : TextDirection.ltr;
  }
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) {
    return AppLocale.supportedLanguages.contains(locale.languageCode);
  }

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(AppLocalizations(locale));
  }

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}
