import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import 'app_locale.dart';

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
      'common.back': 'Back',
      'common.retry': 'Try again',
      'common.networkError': 'Check your connection and try again.',
      'common.remoteRequestError':
          'We could not complete your request right now. Please try again.',
      'common.switchLanguage': 'Switch language',
      'splash.body':
          'Preparing your customer workspace, restoring baseline settings, and routing you into the right entry path.',
      'splash.status': 'Starting your experience',
      'entry.title': 'Clean clothes, clear next step',
      'entry.subtitle':
          'Choose the path that fits your moment. Continue as a guest for quick browsing, or sign in for your orders and account history.',
      'entry.guestTitle': 'Continue as guest',
      'entry.guestBody':
          'Browse the customer experience without slowing down your first visit.',
      'entry.guestAction': 'Continue as guest',
      'entry.loginTitle': 'Sign in to your account',
      'entry.loginBody':
          'Use your account to follow live orders, manage details, and keep your history in one place.',
      'entry.loginAction': 'Go to sign-in entry',
      'loginEntry.title': 'Account entry',
      'loginEntry.body':
          'Enter your phone number to move into the authenticated customer shell. OTP verification will connect to backend contracts next.',
      'loginEntry.phoneLabel': 'Phone number',
      'loginEntry.phoneHint': 'Example: 96890000000',
      'loginEntry.phoneValidationError':
          'Enter a valid phone number to continue.',
      'loginEntry.genericError':
          'We could not start your sign-in flow. Please try again.',
      'loginEntry.primaryAction': 'Send verification code',
      'otpEntry.title': 'Verify your code',
      'otpEntry.body':
          'Enter the verification code to complete sign-in and move into your customer account shell.',
      'otpEntry.codeLabel': 'Verification code',
      'otpEntry.codeHint': 'Example: 123456',
      'otpEntry.codeValidationError':
          'Enter the 6-digit verification code to continue.',
      'otpEntry.genericError':
          'We could not verify your code. Please try again.',
      'otpEntry.primaryAction': 'Verify and continue',
      'guestEntry.title': 'Guest mode',
      'guestEntry.body':
          'Guest mode keeps the first journey lightweight while preserving a clear path into the main customer shell.',
      'guestEntry.primaryAction': 'Enter guest shell',
      'system.offlineTitle': 'You are offline',
      'system.offlineBody':
          'The app will use a clearer degraded-mode pattern here while connectivity-aware flows are implemented.',
      'system.errorTitle': 'Something went wrong',
      'system.errorBody':
          'The customer shell includes a baseline full-screen error state so failures do not collapse into blank pages.',
      'system.returnAction': 'Return to entry',
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
      'home.signOutAction': 'Return to entry',
      'orders.title': 'My orders',
      'orders.subtitle':
          'Check active orders, open details quickly, and understand what happens next without operational noise.',
      'orders.loading': 'Loading your orders',
      'orders.errorTitle': 'We could not load your orders',
      'orders.errorBody':
          'Try again to refresh the latest order progress and timing.',
      'orders.retryAction': 'Try again',
      'orders.emptyTitle': 'No active orders yet',
      'orders.emptyBody':
          'Your recent and active laundry orders will appear here once they start moving.',
      'orders.openDetailAction': 'Open order details',
      'orders.detailTitle': 'Order details',
      'orders.detailLoading': 'Loading order details',
      'orders.detailErrorTitle': 'We could not load this order',
      'orders.detailErrorBody':
          'Try again to refresh the latest timeline and delivery details.',
      'orders.detailSummaryTitle': 'Order summary',
      'orders.timelineTitle': 'Tracking timeline',
      'orders.deliveryMode.standard': 'Pickup and delivery',
      'orders.garmentCount': '{count} garments',
      'orders.status.processing': 'Processing',
      'orders.status.out_for_delivery': 'Out for delivery',
      'orders.status.ready': 'Ready',
      'orders.status.ready_for_delivery': 'Ready for delivery',
      'orders.status.ready_for_pickup': 'Ready for pickup',
      'orders.status.completed': 'Completed',
      'orders.status.delivered': 'Delivered',
      'orders.timeline.received.title': 'Order received',
      'orders.timeline.received.body':
          'Your order was confirmed and entered the care workflow.',
      'orders.timeline.processing.title': 'Cleaning in progress',
      'orders.timeline.processing.body':
          'Your garments are moving through cleaning and quality checks.',
      'orders.timeline.dispatch.title': 'Dispatch preparing',
      'orders.timeline.dispatch.body':
          'We are preparing the next handoff and confirming final timing.',
      'orders.timeline.arrival.title': 'Arrival next',
      'orders.timeline.arrival.body':
          'The final handoff is the next step and we will keep you updated.',
      'booking.title': 'Create an order',
      'booking.subtitle':
          'Move through a short booking flow with clear choices, backend-owned pricing, and a simple review before confirmation.',
      'booking.loading': 'Preparing booking options',
      'booking.errorTitle': 'We could not prepare booking options',
      'booking.errorBody':
          'Try again to refresh services, addresses, and pickup windows.',
      'booking.stepLabel': 'Step {count} of 4',
      'booking.retryAction': 'Retry',
      'booking.discardTitle': 'Discard this booking?',
      'booking.discardBody':
          'Your current selections will be lost if you leave now.',
      'booking.discardStay': 'Stay here',
      'booking.discardLeave': 'Leave booking',
      'booking.servicesEmptyTitle': 'No booking services are available',
      'booking.servicesEmptyBody':
          'Try again shortly or contact the branch if services were just updated.',
      'booking.addressesEmptyTitle': 'No saved address is available',
      'booking.addressesEmptyBody':
          'Add an address to your account before submitting a pickup or delivery request.',
      'booking.addressLabel': 'Saved address',
      'booking.addressDefaultLabel': 'Default address',
      'booking.fulfillmentTitle': 'Choose how we should handle this order',
      'booking.fulfillmentBody':
          'Pick the handoff mode first so the next steps stay clear and accurate.',
      'booking.fulfillmentLabel': 'Order type',
      'booking.fulfillmentPickup': 'Pickup request',
      'booking.fulfillmentPickupBody':
          'We will collect the garments from the selected address.',
      'booking.fulfillmentDelivery': 'Delivery return',
      'booking.fulfillmentDeliveryBody':
          'We will prepare the order for delivery back to the selected address.',
      'booking.slotLabel': 'Pickup window',
      'booking.slotDescription':
          'Choose the slot that best fits your schedule right now.',
      'booking.reviewTitle': 'Review before submission',
      'booking.reviewServiceValue': 'Service: {count}',
      'booking.reviewFulfillmentValue': 'Handoff: {count}',
      'booking.reviewAddressValue': 'Address: {count}',
      'booking.reviewSlotValue': 'Window: {count}',
      'booking.notesLabel': 'Notes',
      'booking.notesHint':
          'Add garment notes or access instructions if needed.',
      'booking.nextAction': 'Continue',
      'booking.submitAction': 'Confirm order',
      'booking.validationIncomplete':
          'Finish the required selections before confirming your order.',
      'booking.submitErrorBody':
          'We could not confirm your order draft. Please try again.',
      'booking.successTitle': 'Order confirmed',
      'booking.successBody':
          'Your order {count} is now in the queue. We will keep you updated on the next handoff.',
      'booking.viewOrdersAction': 'View my orders',
    },
    'ar': {
      'app.title': 'كلين ميت إكس للعملاء',
      'common.back': 'رجوع',
      'common.retry': 'المحاولة مرة أخرى',
      'common.networkError': 'تحقق من الاتصال بالإنترنت وحاول مرة أخرى.',
      'common.remoteRequestError': 'تعذر إكمال طلبك حالياً. حاول مرة أخرى.',
      'common.switchLanguage': 'تبديل اللغة',
      'splash.body':
          'يجري تجهيز مساحة العميل واستعادة الإعدادات الأساسية وتوجيهك إلى مسار الدخول المناسب.',
      'splash.status': 'يتم بدء التجربة',
      'entry.title': 'طلباتك وخطوتك التالية بوضوح',
      'entry.subtitle':
          'اختر المسار المناسب لك الآن. يمكنك المتابعة كضيف للتصفح السريع، أو تسجيل الدخول للوصول إلى طلباتك وسجل حسابك.',
      'entry.guestTitle': 'المتابعة كضيف',
      'entry.guestBody':
          'استعرض تجربة العميل بسرعة من دون إبطاء زيارتك الأولى.',
      'entry.guestAction': 'المتابعة كضيف',
      'entry.loginTitle': 'تسجيل الدخول إلى الحساب',
      'entry.loginBody':
          'استخدم حسابك لمتابعة الطلبات المباشرة وإدارة التفاصيل والاحتفاظ بسجل واحد واضح.',
      'entry.loginAction': 'الانتقال إلى مدخل تسجيل الدخول',
      'loginEntry.title': 'مدخل الحساب',
      'loginEntry.body':
          'أدخل رقم الهاتف للانتقال إلى واجهة العميل الموثقة. سيتم ربط التحقق عبر رمز OTP بعقود الخلفية في الخطوة التالية.',
      'loginEntry.phoneLabel': 'رقم الهاتف',
      'loginEntry.phoneHint': 'مثال: 96890000000',
      'loginEntry.phoneValidationError': 'أدخل رقم هاتف صالحًا للمتابعة.',
      'loginEntry.genericError': 'تعذر بدء مسار تسجيل الدخول. حاول مرة أخرى.',
      'loginEntry.primaryAction': 'إرسال رمز التحقق',
      'otpEntry.title': 'تأكيد الرمز',
      'otpEntry.body':
          'أدخل رمز التحقق لإكمال تسجيل الدخول والانتقال إلى واجهة حساب العميل.',
      'otpEntry.codeLabel': 'رمز التحقق',
      'otpEntry.codeHint': 'مثال: 123456',
      'otpEntry.codeValidationError':
          'أدخل رمز التحقق المكون من 6 أرقام للمتابعة.',
      'otpEntry.genericError': 'تعذر التحقق من الرمز. حاول مرة أخرى.',
      'otpEntry.primaryAction': 'تأكيد والمتابعة',
      'guestEntry.title': 'وضع الضيف',
      'guestEntry.body':
          'يحافظ وضع الضيف على خفة الرحلة الأولى مع إبقاء مسار واضح إلى الواجهة الأساسية للعميل.',
      'guestEntry.primaryAction': 'الدخول إلى واجهة الضيف',
      'system.offlineTitle': 'أنت غير متصل',
      'system.offlineBody':
          'سيتم عرض نمط أوضح للحالة المحدودة هنا أثناء تنفيذ التدفقات التي تراعي الاتصال بالشبكة.',
      'system.errorTitle': 'حدث خطأ ما',
      'system.errorBody':
          'تتضمن واجهة العميل الآن حالة خطأ كاملة الشاشة حتى لا تتحول الأعطال إلى صفحات فارغة.',
      'system.returnAction': 'العودة إلى البداية',
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
      'home.signOutAction': 'العودة إلى البداية',
      'orders.title': 'طلباتي',
      'orders.subtitle':
          'تابع الطلبات النشطة وافتح التفاصيل بسرعة وافهم ما الذي سيحدث بعد ذلك من دون ضوضاء تشغيلية.',
      'orders.loading': 'يتم تحميل طلباتك',
      'orders.errorTitle': 'تعذر تحميل الطلبات',
      'orders.errorBody': 'حاول مرة أخرى لتحديث آخر تقدم في الطلبات ومواعيدها.',
      'orders.retryAction': 'المحاولة مرة أخرى',
      'orders.emptyTitle': 'لا توجد طلبات نشطة بعد',
      'orders.emptyBody':
          'ستظهر هنا طلبات الغسيل الأخيرة والنشطة بمجرد بدء تنفيذها.',
      'orders.openDetailAction': 'فتح تفاصيل الطلب',
      'orders.detailTitle': 'تفاصيل الطلب',
      'orders.detailLoading': 'يتم تحميل تفاصيل الطلب',
      'orders.detailErrorTitle': 'تعذر تحميل هذا الطلب',
      'orders.detailErrorBody':
          'حاول مرة أخرى لتحديث آخر خط زمني وتفاصيل التسليم.',
      'orders.detailSummaryTitle': 'ملخص الطلب',
      'orders.timelineTitle': 'الخط الزمني للتتبع',
      'orders.deliveryMode.standard': 'استلام وتسليم',
      'orders.garmentCount': '{count} قطعة',
      'orders.status.processing': 'جارية المعالجة',
      'orders.status.out_for_delivery': 'في طريق التسليم',
      'orders.status.ready': 'جاهز',
      'orders.status.ready_for_delivery': 'جاهز للتسليم',
      'orders.status.ready_for_pickup': 'جاهز للاستلام',
      'orders.status.completed': 'مكتمل',
      'orders.status.delivered': 'تم التسليم',
      'orders.timeline.received.title': 'تم استلام الطلب',
      'orders.timeline.received.body': 'تم تأكيد طلبك ودخل مسار العناية.',
      'orders.timeline.processing.title': 'التنظيف جارٍ',
      'orders.timeline.processing.body':
          'تنتقل قطعك حالياً عبر التنظيف وفحوصات الجودة.',
      'orders.timeline.dispatch.title': 'التجهيز للتسليم',
      'orders.timeline.dispatch.body':
          'نقوم بتجهيز الخطوة التالية وتأكيد الموعد النهائي.',
      'orders.timeline.arrival.title': 'الوصول هو الخطوة التالية',
      'orders.timeline.arrival.body':
          'الخطوة القادمة هي التسليم النهائي وسنبقيك على اطلاع.',
      'booking.title': 'إنشاء طلب',
      'booking.subtitle':
          'انتقل عبر رحلة حجز قصيرة بخيارات واضحة وتسعير معتمد من الخلفية ومراجعة بسيطة قبل التأكيد.',
      'booking.loading': 'يتم تجهيز خيارات الحجز',
      'booking.errorTitle': 'تعذر تجهيز خيارات الحجز',
      'booking.errorBody':
          'حاول مرة أخرى لتحديث الخدمات والعناوين ومواعيد الاستلام.',
      'booking.stepLabel': 'الخطوة {count} من 4',
      'booking.retryAction': 'إعادة المحاولة',
      'booking.discardTitle': 'هل تريد إلغاء هذا الحجز؟',
      'booking.discardBody': 'ستفقد اختياراتك الحالية إذا غادرت الآن.',
      'booking.discardStay': 'البقاء هنا',
      'booking.discardLeave': 'مغادرة الحجز',
      'booking.servicesEmptyTitle': 'لا توجد خدمات حجز متاحة الآن',
      'booking.servicesEmptyBody':
          'حاول مرة أخرى بعد قليل أو تواصل مع الفرع إذا تم تحديث الخدمات للتو.',
      'booking.addressesEmptyTitle': 'لا يوجد عنوان محفوظ متاح',
      'booking.addressesEmptyBody':
          'أضف عنواناً إلى حسابك قبل إرسال طلب الاستلام أو التوصيل.',
      'booking.addressLabel': 'عنوان محفوظ',
      'booking.addressDefaultLabel': 'العنوان الافتراضي',
      'booking.fulfillmentTitle': 'اختر طريقة تنفيذ هذا الطلب',
      'booking.fulfillmentBody':
          'حدد طريقة الاستلام أو التسليم أولاً حتى تبقى الخطوات التالية واضحة ودقيقة.',
      'booking.fulfillmentLabel': 'نوع الطلب',
      'booking.fulfillmentPickup': 'طلب استلام',
      'booking.fulfillmentPickupBody': 'سنستلم القطع من العنوان المحدد.',
      'booking.fulfillmentDelivery': 'إرجاع بالتوصيل',
      'booking.fulfillmentDeliveryBody':
          'سنجهز الطلب لإعادته بالتوصيل إلى العنوان المحدد.',
      'booking.slotLabel': 'موعد الاستلام',
      'booking.slotDescription':
          'اختر الموعد الذي يناسب جدولك في الوقت الحالي.',
      'booking.reviewTitle': 'راجع قبل التأكيد',
      'booking.reviewServiceValue': 'الخدمة: {count}',
      'booking.reviewFulfillmentValue': 'طريقة التسليم: {count}',
      'booking.reviewAddressValue': 'العنوان: {count}',
      'booking.reviewSlotValue': 'الموعد: {count}',
      'booking.notesLabel': 'ملاحظات',
      'booking.notesHint':
          'أضف ملاحظات على الملابس أو تعليمات الوصول عند الحاجة.',
      'booking.nextAction': 'المتابعة',
      'booking.submitAction': 'تأكيد الطلب',
      'booking.validationIncomplete':
          'أكمل الاختيارات المطلوبة قبل تأكيد الطلب.',
      'booking.submitErrorBody': 'تعذر تأكيد مسودة الطلب. حاول مرة أخرى.',
      'booking.successTitle': 'تم تأكيد الطلب',
      'booking.successBody':
          'تم إدخال طلبك {count} في قائمة التنفيذ. سنبقيك على اطلاع بالخطوة التالية.',
      'booking.viewOrdersAction': 'عرض طلباتي',
    },
  };

  String text(String key) {
    return _localizedValues[locale.languageCode]?[key] ??
        _localizedValues['en']![key] ??
        key;
  }

  String textWithArg(String key, String value) {
    return text(key).replaceAll('{count}', value);
  }

  TextDirection get textDirection {
    return locale.languageCode == 'ar' ? TextDirection.rtl : TextDirection.ltr;
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
