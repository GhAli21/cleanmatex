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
      'common.loading': 'Loading',
      'common.sessionExpired':
          'Your session expired. Please sign in again to continue.',
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
      'system.logsTitle': 'App logs',
      'system.logsOpenAction': 'Open app logs',
      'system.logsClearAction': 'Clear logs',
      'system.logsEmptyState':
          'No logs are captured yet. Interact with the app and return here to inspect runtime events.',
      'home.title': 'Your laundry, clearly in view',
      'home.subtitle':
          'Track active orders, spot important updates quickly, and move into your next task without friction.',
      'home.activeOrdersTitle': 'Active orders',
      'home.activeOrdersCount': '{count} active order(s) in progress',
      'home.activeOrdersBody':
          'No active orders right now. Book a new order to get started.',
      'home.statusTitle': 'Service status',
      'home.statusBody':
          'The shared mobile foundations are ready, and the customer shell is now moving into real journey implementation.',
      'home.greetingTitle': 'Welcome back, {count}',
      'home.greetingGuest': 'Welcome, Guest',
      'home.bookNewOrderAction': 'Book a new order',
      'home.signOutConfirmTitle': 'Sign out?',
      'home.signOutConfirmBody':
          'You will need to sign in again to access your orders.',
      'home.signOutConfirmAction': 'Sign out',
      'home.signOutCancelAction': 'Stay',
      'home.primaryAction': 'Track my orders',
      'home.secondaryAction': 'Browse services',
      'home.signOutAction': 'Sign out',
      'home.profileAction': 'Profile',
      'profile.title': 'Your profile',
      'profile.phoneLabel': 'Phone number',
      'profile.nameLabel': 'Name',
      'profile.laundryLabel': 'Laundry',
      'profile.noLaundrySelected': 'No laundry selected',
      'profile.changeLaundryAction': 'Change laundry',
      'profile.signOutAction': 'Sign out',
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
      'orders.financialTitle': 'Payment & totals',
      'orders.subtotal': 'Subtotal',
      'orders.total': 'Total',
      'orders.paidAmount': 'Paid',
      'orders.balance': 'Balance due',
      'orders.paymentStatus.paid': 'Paid',
      'orders.paymentStatus.unpaid': 'Unpaid',
      'orders.paymentStatus.partial': 'Partially paid',
      'booking.title': 'Create an order',
      'booking.subtitle':
          'Move through a short booking flow with clear choices, backend-owned pricing, and a simple review before confirmation.',
      'booking.loading': 'Preparing booking options',
      'booking.errorTitle': 'We could not prepare booking options',
      'booking.errorBody':
          'Try again to refresh services, addresses, and pickup windows.',
      'booking.disabledTitle': 'Booking is currently unavailable',
      'booking.disabledBody':
          'Online booking is not enabled for this laundry at the moment. Please contact support or try again later.',
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
      'booking.slotsEmptyTitle': 'No pickup windows are available',
      'booking.slotsEmptyBody':
          'Try again shortly or choose another service path if available.',
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
      // Step titles and descriptions
      'booking.step1Title': 'Choose your items',
      'booking.step1Description':
          'Add laundry items to your order. Use the search to find specific pieces, then set quantities before continuing.',
      'booking.step2Title': 'Service and pickup preferences',
      'booking.step2Description':
          'Tailor the care and handling of your order. All preferences are optional.',
      'booking.step3Title': 'Scheduling and pickup',
      'booking.step3Description':
          'Tell us how you would like to hand off your order and when we should expect it.',
      'booking.step4Title': 'Review your order',
      'booking.step4Description':
          'Check all selections carefully before confirming. Pricing is estimated — the laundry confirms the final total.',
      // Item catalog
      'booking.searchHint': 'Search items',
      'booking.searchClearLabel': 'Clear search',
      'booking.itemsEmptyTitle': 'No items are available',
      'booking.itemsEmptyBody':
          'This laundry has not published a catalog yet. Contact support if this is unexpected.',
      'booking.searchEmptyTitle': 'No items match your search',
      'booking.searchEmptyBody':
          'Try a different keyword or clear the search to see all categories.',
      'booking.cartSummaryLabel': '{count} item(s) · Est. {price}',
      'booking.unitPerPiece': 'per piece',
      'booking.unitPerKg': 'per kg',
      'booking.addItemLabel': 'Add',
      'booking.removeItemLabel': 'Remove',
      // Preferences
      'booking.servicePrefsTitle': 'Service preferences',
      'booking.pickupPrefsTitle': 'Pickup preferences',
      'booking.noServicePrefs':
          'No service preferences are configured for this laundry.',
      'booking.noPickupPrefs':
          'No pickup preferences are configured for this laundry.',
      // Schedule
      'booking.bringInOption': 'I will bring it to the laundry',
      'booking.bringInBody':
          'Drop your items off at the branch. No driver visit needed.',
      'booking.pickupFromAddressOption': 'Pick up from my address',
      'booking.pickupFromAddressBody':
          'A driver will collect your items at your selected address.',
      'booking.asapOption': 'As soon as possible',
      'booking.asapBody':
          'We will coordinate with the nearest available driver.',
      'booking.scheduledOption': 'Choose a date and time',
      'booking.scheduledBody':
          'Pick the exact window that works for your schedule.',
      'booking.scheduledAtLabel': 'Pickup date and time',
      'booking.scheduledAtPlaceholder': 'Tap to choose date and time',
      'booking.savedAddressesTitle': 'Your saved addresses',
      'booking.addNewAddressAction': 'Add a new address',
      'booking.addressLabelField': 'Address label',
      'booking.addressStreetField': 'Street',
      'booking.addressAreaField': 'Area',
      'booking.addressCityField': 'City',
      'booking.saveAddressAction': 'Save address',
      'booking.savingAddressLabel': 'Saving address...',
      'booking.addressSaveErrorBody':
          'We could not save the new address. Please try again.',
      'booking.addressValidationError':
          'Check the address details and try saving again.',
      'booking.addressRequiredError':
          'Select or add an address before requesting pickup.',
      'booking.scheduleRequiredError':
          'Choose a pickup date and time before continuing.',
      'booking.quantityInvalidError':
          'Reduce the selected item quantity and try again.',
      'booking.itemUnavailableError':
          'One or more selected items are no longer available. Refresh and try again.',
      'booking.addressUnavailableError':
          'The selected address is no longer available. Choose another address.',
      'booking.branchUnavailableError':
          'This laundry does not have an active branch available for booking.',
      'booking.preferenceUnavailableError':
          'One or more selected preferences are no longer available. Refresh and try again.',
      // Review step
      'booking.reviewItemsTitle': 'Selected items',
      'booking.reviewPrefsTitle': 'Preferences',
      'booking.reviewScheduleTitle': 'Pickup / handoff',
      'booking.reviewBringIn': 'Bringing in to laundry',
      'booking.reviewAsap': 'As soon as possible',
      'booking.reviewScheduled': 'Scheduled: {datetime}',
      'booking.reviewAddressFor': 'Address: {address}',
      'booking.reviewNoneSelected': 'None selected',
      'booking.reviewEstSubtotal': 'Estimated subtotal',
      'booking.reviewVat': 'VAT ({rate}%)',
      'booking.reviewEstTotal': 'Estimated total',
      'booking.reviewVatNote':
          'VAT and final pricing are confirmed by the laundry after receiving the order.',
      'auth.passwordLoginTitle': 'Sign in with password',
      'auth.passwordLabel': 'Password',
      'auth.passwordHint': 'Enter your password',
      'auth.passwordMinLengthError': 'At least 8 characters',
      'auth.passwordMismatchError': 'Passwords do not match',
      'auth.signInWithPasswordAction': 'Sign in',
      'auth.useOtpInsteadAction': 'Use OTP instead',
      'auth.forgotPasswordAction': 'Forgot password?',
      'auth.setPasswordTitle': 'Set a password',
      'auth.setPasswordBody': 'Log in faster next time without OTP',
      'auth.setPasswordAction': 'Set password',
      'auth.skipSetPasswordAction': 'Skip for now',
      'auth.setPasswordSuccessMessage': 'Password set successfully',
      'auth.confirmPasswordLabel': 'Confirm password',
      'auth.invalidPasswordError': 'Incorrect phone or password',
      'profile.passwordStatusEnabled': 'Password login: enabled',
      'profile.passwordStatusNotSet': 'Password login: not set',
      'profile.changePasswordAction': 'Change password',
      'tenant.discoveryTitle': 'Find your laundry',
      'tenant.listTitle': 'Find your laundries',
      'tenant.listBody':
          'Enter your phone number first, then choose from the laundries linked to your customer profile.',
      'tenant.selectAction': 'Select',
      'tenant.listError':
          'We could not load your laundries right now. Please try again.',
      'tenant.listErrorWithPhone':
          'We could not load laundries for {count} right now. Please try again.',
      'tenant.phoneNoMatches': 'No laundries were found for {count}.',
      'tenant.scanQrAction': 'Scan QR code',
      'tenant.enterCodeAction': 'Enter laundry code',
      'tenant.codeHint': 'e.g. cleanwave',
      'tenant.findAction': 'Find',
      'tenant.notFoundError':
          'Laundry not found. Check the code and try again.',
      'tenant.confirmTitle': 'Welcome to {count}',
      'tenant.confirmAction': 'Yes, continue',
      'tenant.chooseDifferentAction': 'Choose a different laundry',
      'tenant.scanningLabel': 'Point camera at QR code',
    },
    'ar': {
      'app.title': 'كلين ميت إكس للعملاء',
      'common.back': 'رجوع',
      'common.retry': 'المحاولة مرة أخرى',
      'common.networkError': 'تحقق من الاتصال بالإنترنت وحاول مرة أخرى.',
      'common.remoteRequestError': 'تعذر إكمال طلبك حالياً. حاول مرة أخرى.',
      'common.switchLanguage': 'تبديل اللغة',
      'common.loading': 'جاري التحميل',
      'common.sessionExpired':
          'انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى للمتابعة.',
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
      'system.logsTitle': 'سجلات التطبيق',
      'system.logsOpenAction': 'فتح سجلات التطبيق',
      'system.logsClearAction': 'مسح السجلات',
      'system.logsEmptyState':
          'لا توجد سجلات حتى الآن. استخدم التطبيق ثم عد إلى هنا لمراجعة أحداث التشغيل.',
      'home.title': 'كل ما يخص طلباتك أمامك بوضوح',
      'home.subtitle':
          'تابع الطلبات النشطة، واعرف المستجدات المهمة بسرعة، وانتقل إلى خطوتك التالية بسهولة.',
      'home.activeOrdersTitle': 'الطلبات النشطة',
      'home.activeOrdersCount': '{count} طلب نشط قيد التنفيذ',
      'home.activeOrdersBody':
          'لا توجد طلبات نشطة الآن. احجز طلباً جديداً للبدء.',
      'home.statusTitle': 'حالة الخدمة',
      'home.statusBody':
          'أصبحت الأساسات المشتركة لتطبيقات الجوال جاهزة، ويجري الآن تطوير واجهة العميل نحو الرحلات الفعلية.',
      'home.greetingTitle': 'مرحباً، {count}',
      'home.greetingGuest': 'مرحباً، زائر',
      'home.bookNewOrderAction': 'احجز طلباً جديداً',
      'home.signOutConfirmTitle': 'تسجيل الخروج؟',
      'home.signOutConfirmBody':
          'ستحتاج إلى تسجيل الدخول مجدداً للوصول إلى طلباتك.',
      'home.signOutConfirmAction': 'تسجيل الخروج',
      'home.signOutCancelAction': 'البقاء',
      'home.primaryAction': 'تتبع طلباتي',
      'home.secondaryAction': 'استعراض الخدمات',
      'home.signOutAction': 'تسجيل الخروج',
      'home.profileAction': 'الملف الشخصي',
      'profile.title': 'ملفك الشخصي',
      'profile.phoneLabel': 'رقم الهاتف',
      'profile.nameLabel': 'الاسم',
      'profile.laundryLabel': 'المغسلة',
      'profile.noLaundrySelected': 'لم يتم اختيار مغسلة',
      'profile.changeLaundryAction': 'تغيير المغسلة',
      'profile.signOutAction': 'تسجيل الخروج',
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
      'orders.financialTitle': 'الدفع والإجماليات',
      'orders.subtotal': 'المجموع الجزئي',
      'orders.total': 'الإجمالي',
      'orders.paidAmount': 'المدفوع',
      'orders.balance': 'المبلغ المتبقي',
      'orders.paymentStatus.paid': 'مدفوع',
      'orders.paymentStatus.unpaid': 'غير مدفوع',
      'orders.paymentStatus.partial': 'مدفوع جزئياً',
      'booking.title': 'إنشاء طلب',
      'booking.subtitle':
          'انتقل عبر رحلة حجز قصيرة بخيارات واضحة وتسعير معتمد من الخلفية ومراجعة بسيطة قبل التأكيد.',
      'booking.loading': 'يتم تجهيز خيارات الحجز',
      'booking.errorTitle': 'تعذر تجهيز خيارات الحجز',
      'booking.errorBody':
          'حاول مرة أخرى لتحديث الخدمات والعناوين ومواعيد الاستلام.',
      'booking.disabledTitle': 'الحجز غير متاح حالياً',
      'booking.disabledBody':
          'الحجز عبر التطبيق غير مفعّل لهذه المغسلة حالياً. يرجى التواصل مع الدعم أو المحاولة لاحقاً.',
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
      'booking.slotsEmptyTitle': 'لا توجد مواعيد استلام متاحة الآن',
      'booking.slotsEmptyBody':
          'حاول مرة أخرى بعد قليل أو اختر مسار خدمة آخر إذا كان متاحاً.',
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
      // عناوين الخطوات
      'booking.step1Title': 'اختر القطع والمقاطع',
      'booking.step1Description':
          'أضف قطع الغسيل إلى طلبك. استخدم البحث للعثور على قطع محددة، وحدد الكميات قبل المتابعة.',
      'booking.step2Title': 'تفضيلات الخدمة والاستلام',
      'booking.step2Description':
          'خصّص طريقة العناية بطلبك وتسليمه. جميع التفضيلات اختيارية.',
      'booking.step3Title': 'الجدولة والاستلام',
      'booking.step3Description':
          'أخبرنا كيف تريد تسليم طلبك ومتى يمكننا توقعه.',
      'booking.step4Title': 'مراجعة الطلب',
      'booking.step4Description':
          'تحقق من جميع الاختيارات بعناية قبل التأكيد. التسعير تقديري — تؤكد المغسلة الإجمالي النهائي.',
      // كتالوج القطع
      'booking.searchHint': 'بحث عن القطع',
      'booking.searchClearLabel': 'مسح البحث',
      'booking.itemsEmptyTitle': 'لا توجد قطع متاحة',
      'booking.itemsEmptyBody':
          'لم تنشر هذه المغسلة كتالوجاً بعد. تواصل مع الدعم إذا كان هذا غير متوقع.',
      'booking.searchEmptyTitle': 'لا توجد نتائج مطابقة',
      'booking.searchEmptyBody':
          'جرب كلمة مختلفة أو امسح البحث لعرض جميع الفئات.',
      'booking.cartSummaryLabel': '{count} قطعة · تقديري {price}',
      'booking.unitPerPiece': 'لكل قطعة',
      'booking.unitPerKg': 'لكل كيلوغرام',
      'booking.addItemLabel': 'إضافة',
      'booking.removeItemLabel': 'إزالة',
      // التفضيلات
      'booking.servicePrefsTitle': 'تفضيلات الخدمة',
      'booking.pickupPrefsTitle': 'تفضيلات الاستلام',
      'booking.noServicePrefs': 'لا توجد تفضيلات خدمة مضبوطة لهذه المغسلة.',
      'booking.noPickupPrefs': 'لا توجد تفضيلات استلام مضبوطة لهذه المغسلة.',
      // الجدولة
      'booking.bringInOption': 'سأحضرها إلى المغسلة',
      'booking.bringInBody': 'أحضر قطعك إلى الفرع. لا حاجة لزيارة سائق.',
      'booking.pickupFromAddressOption': 'استلام من عنواني',
      'booking.pickupFromAddressBody':
          'سيقوم سائق باستلام قطعك من عنوانك المحدد.',
      'booking.asapOption': 'في أقرب وقت ممكن',
      'booking.asapBody': 'سنسعى لتنسيق مع أقرب سائق متاح.',
      'booking.scheduledOption': 'اختر تاريخاً ووقتاً',
      'booking.scheduledBody': 'اختر الموعد المناسب لجدولك.',
      'booking.scheduledAtLabel': 'تاريخ ووقت الاستلام',
      'booking.scheduledAtPlaceholder': 'اضغط لاختيار التاريخ والوقت',
      'booking.savedAddressesTitle': 'عناوينك المحفوظة',
      'booking.addNewAddressAction': 'إضافة عنوان جديد',
      'booking.addressLabelField': 'اسم العنوان',
      'booking.addressStreetField': 'الشارع',
      'booking.addressAreaField': 'المنطقة',
      'booking.addressCityField': 'المدينة',
      'booking.saveAddressAction': 'حفظ العنوان',
      'booking.savingAddressLabel': 'يتم حفظ العنوان...',
      'booking.addressSaveErrorBody': 'تعذر حفظ العنوان الجديد. حاول مرة أخرى.',
      'booking.addressValidationError':
          'تحقق من تفاصيل العنوان وحاول الحفظ مرة أخرى.',
      'booking.addressRequiredError':
          'اختر عنواناً أو أضف عنواناً قبل طلب الاستلام.',
      'booking.scheduleRequiredError': 'اختر تاريخ ووقت الاستلام قبل المتابعة.',
      'booking.quantityInvalidError': 'قلل كمية القطع المختارة وحاول مرة أخرى.',
      'booking.itemUnavailableError':
          'بعض القطع المختارة لم تعد متاحة. حدّث البيانات وحاول مرة أخرى.',
      'booking.addressUnavailableError':
          'العنوان المختار لم يعد متاحاً. اختر عنواناً آخر.',
      'booking.branchUnavailableError':
          'لا يوجد فرع نشط متاح للحجز لهذه المغسلة.',
      'booking.preferenceUnavailableError':
          'بعض التفضيلات المختارة لم تعد متاحة. حدّث البيانات وحاول مرة أخرى.',
      // خطوة المراجعة
      'booking.reviewItemsTitle': 'القطع المختارة',
      'booking.reviewPrefsTitle': 'التفضيلات',
      'booking.reviewScheduleTitle': 'الاستلام / التسليم',
      'booking.reviewBringIn': 'إحضار إلى المغسلة',
      'booking.reviewAsap': 'في أقرب وقت ممكن',
      'booking.reviewScheduled': 'مجدول: {datetime}',
      'booking.reviewAddressFor': 'العنوان: {address}',
      'booking.reviewNoneSelected': 'لم يُختر شيء',
      'booking.reviewEstSubtotal': 'المجموع التقديري الجزئي',
      'booking.reviewVat': 'ضريبة القيمة المضافة ({rate}%)',
      'booking.reviewEstTotal': 'الإجمالي التقديري',
      'booking.reviewVatNote':
          'تؤكد المغسلة ضريبة القيمة المضافة والتسعير النهائي بعد استلام الطلب.',
      'auth.passwordLoginTitle': 'الدخول بكلمة المرور',
      'auth.passwordLabel': 'كلمة المرور',
      'auth.passwordHint': 'أدخل كلمة المرور',
      'auth.passwordMinLengthError': '٨ أحرف على الأقل',
      'auth.passwordMismatchError': 'كلمتا المرور غير متطابقتين',
      'auth.signInWithPasswordAction': 'تسجيل الدخول',
      'auth.useOtpInsteadAction': 'استخدام رمز التحقق',
      'auth.forgotPasswordAction': 'نسيت كلمة المرور؟',
      'auth.setPasswordTitle': 'تعيين كلمة مرور',
      'auth.setPasswordBody': 'سجل الدخول بسرعة دون رمز التحقق',
      'auth.setPasswordAction': 'تعيين كلمة المرور',
      'auth.skipSetPasswordAction': 'تخطي الآن',
      'auth.setPasswordSuccessMessage': 'تم تعيين كلمة المرور',
      'auth.confirmPasswordLabel': 'تأكيد كلمة المرور',
      'auth.invalidPasswordError': 'الهاتف أو كلمة المرور غير صحيحة',
      'profile.passwordStatusEnabled': 'الدخول بكلمة المرور: مفعّل',
      'profile.passwordStatusNotSet': 'الدخول بكلمة المرور: غير محدد',
      'profile.changePasswordAction': 'تغيير كلمة المرور',
      'tenant.discoveryTitle': 'ابحث عن مغسلتك',
      'tenant.listTitle': 'ابحث عن مغاسلك',
      'tenant.listBody':
          'أدخل رقم الهاتف أولاً، ثم اختر من المغاسل المرتبطة بملف العميل الخاص بك.',
      'tenant.selectAction': 'اختيار',
      'tenant.listError':
          'تعذر تحميل المغاسل الخاصة بك حالياً. يرجى المحاولة مرة أخرى.',
      'tenant.listErrorWithPhone':
          'تعذر تحميل المغاسل للرقم {count} حالياً. يرجى المحاولة مرة أخرى.',
      'tenant.phoneNoMatches': 'لم يتم العثور على مغاسل للرقم {count}.',
      'tenant.scanQrAction': 'مسح رمز QR',
      'tenant.enterCodeAction': 'أدخل رمز المغسلة',
      'tenant.codeHint': 'مثال: cleanwave',
      'tenant.findAction': 'بحث',
      'tenant.notFoundError':
          'لم يتم العثور على المغسلة. تحقق من الرمز وأعد المحاولة.',
      'tenant.confirmTitle': 'مرحباً في {count}',
      'tenant.confirmAction': 'نعم، تابع',
      'tenant.chooseDifferentAction': 'اختر مغسلة أخرى',
      'tenant.scanningLabel': 'وجّه الكاميرا نحو رمز QR',
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

  /// Replaces all named placeholders in [key]'s value using [args].
  /// Example: textWithArgs('booking.reviewVat', {'rate': '5'})
  String textWithArgs(String key, Map<String, String> args) {
    var result = text(key);
    for (final entry in args.entries) {
      result = result.replaceAll('{${entry.key}}', entry.value);
    }
    return result;
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
