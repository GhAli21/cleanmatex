Below is the **Mobile Foundation Package-by-Package Starter Code Pack** for your 3-app Flutter workspace.

This is optimized for:

* `customer_app`
* `staff_app`
* `driver_app`

and aligned with the mobile architecture direction we locked: shared packages, Flutter, EN/AR RTL, reusable UI, backend-first rules, and Riverpod-based state patterns. That matches the documented mobile stack, repo split, bilingual requirements, offline tolerance, and the user classes/customer-staff-driver separation in CleanMateX.  

---

# 1. Starter workspace structure

```text
cmx_mobile_apps/
  MOBILE_FOUNDATION_DECISIONS.md
  melos.yaml
  analysis_options.yaml

  apps/
    customer_app/
    staff_app/
    driver_app/

  packages/
    mobile_core/
    mobile_l10n/
    mobile_ui/
    mobile_domain/
    mobile_services/
    mobile_testkit/
```

---

# 2. Root `melos.yaml`

```yaml
name: cmx_mobile_apps

packages:
  - apps/**
  - packages/**

scripts:
  bootstrap:
    run: melos bootstrap

  analyze:
    run: melos exec -- flutter analyze

  test:
    run: melos exec -- flutter test

  format:
    run: melos exec -- dart format .

  run:customer:
    run: cd apps/customer_app && flutter run

  run:staff:
    run: cd apps/staff_app && flutter run

  run:driver:
    run: cd apps/driver_app && flutter run
```

---

# 3. Root `analysis_options.yaml`

```yaml
include: package:flutter_lints/flutter.yaml

linter:
  rules:
    avoid_print: true
    prefer_const_constructors: true
    prefer_const_literals_to_create_immutables: true
    always_declare_return_types: true
    avoid_dynamic_calls: true
    unnecessary_lambdas: true

analyzer:
  exclude:
    - "**/*.g.dart"
    - "**/*.freezed.dart"
```

---

# 4. `mobile_core` starter pack

## Folder tree

```text
packages/mobile_core/lib/
  mobile_core.dart
  src/
    config/
      app_flavor.dart
    constants/
      app_constants.dart
    enums/
      app_role.dart
      order_status.dart
    errors/
      app_failure.dart
    results/
      result.dart
    formatters/
      date_formatter.dart
    validators/
      app_validators.dart
    utils/
      debouncer.dart
    state/
      form_submission_state.dart
```

## `pubspec.yaml`

```yaml
name: mobile_core
description: Core primitives for CleanMateX mobile apps
version: 0.0.1
publish_to: none

environment:
  sdk: ^3.5.0

dependencies:
  intl: ^0.20.2
```

## `lib/mobile_core.dart`

```dart
library mobile_core;

export 'src/config/app_flavor.dart';
export 'src/constants/app_constants.dart';
export 'src/enums/app_role.dart';
export 'src/enums/order_status.dart';
export 'src/errors/app_failure.dart';
export 'src/results/result.dart';
export 'src/formatters/date_formatter.dart';
export 'src/validators/app_validators.dart';
export 'src/utils/debouncer.dart';
export 'src/state/form_submission_state.dart';
```

## `app_flavor.dart`

```dart
enum AppFlavor {
  customer,
  staff,
  driver,
}
```

## `app_constants.dart`

```dart
class AppConstants {
  AppConstants._();

  static const String appName = 'CleanMateX';
  static const Duration apiTimeout = Duration(seconds: 30);
  static const Duration debounceDuration = Duration(milliseconds: 400);
}
```

## `app_role.dart`

```dart
enum AppRole {
  customer,
  staff,
  driver,
  admin,
}
```

## `order_status.dart`

```dart
enum OrderStatus {
  intake,
  preparing,
  processing,
  assembly,
  qa,
  ready,
  outForDelivery,
  delivered,
  cancelled,
}
```

## `app_failure.dart`

```dart
class AppFailure implements Exception {
  final String code;
  final String message;

  const AppFailure({
    required this.code,
    required this.message,
  });

  @override
  String toString() => 'AppFailure(code: $code, message: $message)';
}
```

## `result.dart`

```dart
sealed class Result<T> {
  const Result();

  bool get isSuccess => this is Success<T>;
  bool get isFailure => this is Failure<T>;
}

class Success<T> extends Result<T> {
  final T data;

  const Success(this.data);
}

class Failure<T> extends Result<T> {
  final Exception exception;

  const Failure(this.exception);
}
```

## `date_formatter.dart`

```dart
import 'package:intl/intl.dart';

class DateFormatter {
  DateFormatter._();

  static String formatShort(DateTime? date, {String locale = 'en'}) {
    if (date == null) return '';
    return DateFormat.yMMMd(locale).format(date);
  }

  static String formatDateTime(DateTime? date, {String locale = 'en'}) {
    if (date == null) return '';
    return DateFormat.yMMMd(locale).add_jm().format(date);
  }
}
```

## `app_validators.dart`

```dart
class AppValidators {
  AppValidators._();

  static String? requiredField(String? value, String message) {
    if (value == null || value.trim().isEmpty) {
      return message;
    }
    return null;
  }

  static String? email(String? value, String requiredMessage, String invalidMessage) {
    if (value == null || value.trim().isEmpty) return requiredMessage;
    final emailRegex = RegExp(r'^[^@]+@[^@]+\.[^@]+$');
    return emailRegex.hasMatch(value.trim()) ? null : invalidMessage;
  }
}
```

## `debouncer.dart`

```dart
import 'dart:async';

class Debouncer {
  Debouncer({required this.delay});

  final Duration delay;
  Timer? _timer;

  void run(void Function() action) {
    _timer?.cancel();
    _timer = Timer(delay, action);
  }

  void dispose() {
    _timer?.cancel();
  }
}
```

## `form_submission_state.dart`

```dart
enum FormSubmissionStatus {
  idle,
  submitting,
  success,
  failure,
}

class FormSubmissionState {
  final FormSubmissionStatus status;
  final String? errorMessage;

  const FormSubmissionState({
    this.status = FormSubmissionStatus.idle,
    this.errorMessage,
  });

  bool get isSubmitting => status == FormSubmissionStatus.submitting;
  bool get isSuccess => status == FormSubmissionStatus.success;
  bool get isFailure => status == FormSubmissionStatus.failure;

  FormSubmissionState copyWith({
    FormSubmissionStatus? status,
    String? errorMessage,
  }) {
    return FormSubmissionState(
      status: status ?? this.status,
      errorMessage: errorMessage,
    );
  }
}
```

---

# 5. `mobile_l10n` starter pack

## Folder tree

```text
packages/mobile_l10n/lib/
  mobile_l10n.dart
  src/
    app_strings.dart
    locale_controller.dart
  assets/translations/
    en.json
    ar.json
```

## `pubspec.yaml`

```yaml
name: mobile_l10n
description: Localization package for CleanMateX mobile apps
version: 0.0.1
publish_to: none

environment:
  sdk: ^3.5.0

dependencies:
  flutter:
    sdk: flutter
  flutter_localizations:
    sdk: flutter
  easy_localization: ^3.0.7+1

flutter:
  assets:
    - assets/translations/
```

## `lib/mobile_l10n.dart`

```dart
library mobile_l10n;

export 'package:easy_localization/easy_localization.dart';
export 'src/app_strings.dart';
export 'src/locale_controller.dart';
```

## `app_strings.dart`

```dart
class AppStrings {
  AppStrings._();

  static const String appName = 'common.app_name';
  static const String save = 'common.save';
  static const String cancel = 'common.cancel';
  static const String retry = 'common.retry';
  static const String noData = 'common.no_data';
  static const String loading = 'common.loading';
  static const String login = 'auth.login';
  static const String email = 'auth.email';
  static const String password = 'auth.password';
}
```

## `locale_controller.dart`

```dart
import 'dart:ui';

class LocaleController {
  LocaleController._();

  static const supportedLocales = [
    Locale('en'),
    Locale('ar'),
  ];

  static const fallbackLocale = Locale('en');
}
```

## `en.json`

```json
{
  "common": {
    "app_name": "CleanMateX",
    "save": "Save",
    "cancel": "Cancel",
    "retry": "Retry",
    "no_data": "No data found",
    "loading": "Loading"
  },
  "auth": {
    "login": "Login",
    "email": "Email",
    "password": "Password"
  }
}
```

## `ar.json`

```json
{
  "common": {
    "app_name": "كلين ميت إكس",
    "save": "حفظ",
    "cancel": "إلغاء",
    "retry": "إعادة المحاولة",
    "no_data": "لا توجد بيانات",
    "loading": "جار التحميل"
  },
  "auth": {
    "login": "تسجيل الدخول",
    "email": "البريد الإلكتروني",
    "password": "كلمة المرور"
  }
}
```

---

# 6. `mobile_ui` starter pack

## Folder tree

```text
packages/mobile_ui/lib/
  mobile_ui.dart
  src/theme/
    app_colors.dart
    app_spacing.dart
    app_text_styles.dart
    app_theme.dart
  src/widgets/
    app_primary_button.dart
    app_text_field_widget.dart
    app_loading_indicator.dart
    app_error_view.dart
    app_empty_state.dart
    app_card_widget.dart
  src/layout/
    app_scaffold.dart
```

## `pubspec.yaml`

```yaml
name: mobile_ui
description: Shared UI kit for CleanMateX mobile apps
version: 0.0.1
publish_to: none

environment:
  sdk: ^3.5.0

dependencies:
  flutter:
    sdk: flutter
  mobile_l10n:
    path: ../mobile_l10n
```

## `lib/mobile_ui.dart`

```dart
library mobile_ui;

export 'src/theme/app_colors.dart';
export 'src/theme/app_spacing.dart';
export 'src/theme/app_text_styles.dart';
export 'src/theme/app_theme.dart';
export 'src/layout/app_scaffold.dart';
export 'src/widgets/app_primary_button.dart';
export 'src/widgets/app_text_field_widget.dart';
export 'src/widgets/app_loading_indicator.dart';
export 'src/widgets/app_error_view.dart';
export 'src/widgets/app_empty_state.dart';
export 'src/widgets/app_card_widget.dart';
```

## `app_colors.dart`

```dart
import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  static const Color primary = Color(0xFF1565C0);
  static const Color secondary = Color(0xFF00897B);
  static const Color error = Color(0xFFC62828);
  static const Color success = Color(0xFF2E7D32);
  static const Color warning = Color(0xFFED6C02);

  static const Color lightBackground = Color(0xFFF8FAFC);
  static const Color darkBackground = Color(0xFF0F172A);

  static const Color lightCard = Colors.white;
  static const Color darkCard = Color(0xFF1E293B);

  static const Color textPrimaryLight = Color(0xFF0F172A);
  static const Color textPrimaryDark = Colors.white;
}
```

## `app_spacing.dart`

```dart
class AppSpacing {
  AppSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;
}
```

## `app_text_styles.dart`

```dart
import 'package:flutter/material.dart';

class AppTextStyles {
  AppTextStyles._();

  static const TextStyle titleLarge = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w700,
  );

  static const TextStyle titleMedium = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w600,
  );

  static const TextStyle bodyMedium = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
  );

  static const TextStyle labelLarge = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
  );
}
```

## `app_theme.dart`

```dart
import 'package:flutter/material.dart';
import 'app_colors.dart';
import 'app_text_styles.dart';

class AppTheme {
  AppTheme._();

  static ThemeData light() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: AppColors.primary),
      scaffoldBackgroundColor: AppColors.lightBackground,
      cardColor: AppColors.lightCard,
      textTheme: const TextTheme(
        titleLarge: AppTextStyles.titleLarge,
        titleMedium: AppTextStyles.titleMedium,
        bodyMedium: AppTextStyles.bodyMedium,
        labelLarge: AppTextStyles.labelLarge,
      ),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
      ),
    );
  }

  static ThemeData dark() {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        brightness: Brightness.dark,
      ),
      scaffoldBackgroundColor: AppColors.darkBackground,
      cardColor: AppColors.darkCard,
    );
  }
}
```

## `app_scaffold.dart`

```dart
import 'package:flutter/material.dart';
import '../theme/app_spacing.dart';

class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    required this.title,
    required this.body,
  });

  final Widget title;
  final Widget body;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: title),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: body,
      ),
    );
  }
}
```

## `app_primary_button.dart`

```dart
import 'package:flutter/material.dart';

class AppPrimaryButton extends StatelessWidget {
  const AppPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: isLoading ? null : onPressed,
      child: isLoading
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Text(label),
    );
  }
}
```

## `app_text_field_widget.dart`

```dart
import 'package:flutter/material.dart';

class AppTextFieldWidget extends StatelessWidget {
  const AppTextFieldWidget({
    super.key,
    required this.controller,
    required this.labelText,
    this.validator,
    this.obscureText = false,
  });

  final TextEditingController controller;
  final String labelText;
  final String? Function(String?)? validator;
  final bool obscureText;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      validator: validator,
      obscureText: obscureText,
      decoration: InputDecoration(
        labelText: labelText,
      ),
    );
  }
}
```

## `app_loading_indicator.dart`

```dart
import 'package:flutter/material.dart';

class AppLoadingIndicator extends StatelessWidget {
  const AppLoadingIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: CircularProgressIndicator(),
    );
  }
}
```

## `app_error_view.dart`

```dart
import 'package:flutter/material.dart';

class AppErrorView extends StatelessWidget {
  const AppErrorView({
    super.key,
    required this.message,
    this.onRetry,
  });

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, textAlign: TextAlign.center),
          if (onRetry != null) ...[
            const SizedBox(height: 12),
            FilledButton(
              onPressed: onRetry,
              child: const Text('Retry'),
            ),
          ],
        ],
      ),
    );
  }
}
```

## `app_empty_state.dart`

```dart
import 'package:flutter/material.dart';

class AppEmptyState extends StatelessWidget {
  const AppEmptyState({
    super.key,
    required this.message,
  });

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(message),
    );
  }
}
```

## `app_card_widget.dart`

```dart
import 'package:flutter/material.dart';
import '../theme/app_spacing.dart';

class AppCardWidget extends StatelessWidget {
  const AppCardWidget({
    super.key,
    required this.child,
  });

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: child,
      ),
    );
  }
}
```

---

# 7. `mobile_domain` starter pack

## `pubspec.yaml`

```yaml
name: mobile_domain
description: Shared domain contracts for CleanMateX mobile apps
version: 0.0.1
publish_to: none

environment:
  sdk: ^3.5.0

dependencies:
  mobile_core:
    path: ../mobile_core
```

## Folder tree

```text
packages/mobile_domain/lib/
  mobile_domain.dart
  src/
    models/
      session_model.dart
      app_user_model.dart
      branch_model.dart
      driver_task_model.dart
```

## `mobile_domain.dart`

```dart
library mobile_domain;

export 'src/models/session_model.dart';
export 'src/models/app_user_model.dart';
export 'src/models/branch_model.dart';
export 'src/models/driver_task_model.dart';
```

## `session_model.dart`

```dart
import 'package:mobile_core/mobile_core.dart';

class SessionModel {
  final String accessToken;
  final String refreshToken;
  final String userId;
  final AppRole role;

  SessionModel({
    required this.accessToken,
    required this.refreshToken,
    required this.userId,
    required this.role,
  });

  factory SessionModel.fromJson(Map<String, dynamic> json) {
    return SessionModel(
      accessToken: json['access_token'] as String? ?? '',
      refreshToken: json['refresh_token'] as String? ?? '',
      userId: json['user_id'] as String? ?? '',
      role: AppRole.values.firstWhere(
        (role) => role.name == (json['role'] as String? ?? ''),
        orElse: () => AppRole.customer,
      ),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'access_token': accessToken,
      'refresh_token': refreshToken,
      'user_id': userId,
      'role': role.name,
    };
  }
}
```

## `app_user_model.dart`

```dart
import 'package:mobile_core/mobile_core.dart';

class AppUserModel {
  final String id;
  final String displayName;
  final String? email;
  final AppRole role;

  AppUserModel({
    required this.id,
    required this.displayName,
    this.email,
    required this.role,
  });

  factory AppUserModel.fromJson(Map<String, dynamic> json) {
    return AppUserModel(
      id: json['id'] as String? ?? '',
      displayName: json['display_name'] as String? ?? '',
      email: json['email'] as String?,
      role: AppRole.values.firstWhere(
        (role) => role.name == (json['role'] as String? ?? ''),
        orElse: () => AppRole.customer,
      ),
    );
  }
}
```

## `branch_model.dart`

```dart
class BranchModel {
  final String id;
  final String name;
  final String? nameAr;

  BranchModel({
    required this.id,
    required this.name,
    this.nameAr,
  });

  factory BranchModel.fromJson(Map<String, dynamic> json) {
    return BranchModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      nameAr: json['name_ar'] as String?,
    );
  }
}
```

## `driver_task_model.dart`

```dart
class DriverTaskModel {
  final String id;
  final String orderNo;
  final String customerName;
  final String status;

  DriverTaskModel({
    required this.id,
    required this.orderNo,
    required this.customerName,
    required this.status,
  });

  factory DriverTaskModel.fromJson(Map<String, dynamic> json) {
    return DriverTaskModel(
      id: json['id'] as String? ?? '',
      orderNo: json['order_no'] as String? ?? '',
      customerName: json['customer_name'] as String? ?? '',
      status: json['status'] as String? ?? '',
    );
  }
}
```

---

# 8. `mobile_services` starter pack

## `pubspec.yaml`

```yaml
name: mobile_services
description: Shared infrastructure services for CleanMateX mobile apps
version: 0.0.1
publish_to: none

environment:
  sdk: ^3.5.0

dependencies:
  flutter:
    sdk: flutter
  flutter_secure_storage: ^9.2.2
  dio: ^5.7.0
  connectivity_plus: ^6.0.5
  mobile_core:
    path: ../mobile_core
  mobile_domain:
    path: ../mobile_domain
```

## Folder tree

```text
packages/mobile_services/lib/
  mobile_services.dart
  src/
    networking/
      api_client.dart
    storage/
      secure_storage_service.dart
    session/
      session_service.dart
    connectivity/
      connectivity_service.dart
```

## `mobile_services.dart`

```dart
library mobile_services;

export 'src/networking/api_client.dart';
export 'src/storage/secure_storage_service.dart';
export 'src/session/session_service.dart';
export 'src/connectivity/connectivity_service.dart';
```

## `secure_storage_service.dart`

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  SecureStorageService(this._storage);

  final FlutterSecureStorage _storage;

  static const String accessTokenKey = 'access_token';
  static const String refreshTokenKey = 'refresh_token';

  Future<void> write(String key, String value) => _storage.write(key: key, value: value);

  Future<String?> read(String key) => _storage.read(key: key);

  Future<void> delete(String key) => _storage.delete(key: key);

  Future<void> clear() => _storage.deleteAll();
}
```

## `session_service.dart`

```dart
import 'dart:convert';

import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';
import '../storage/secure_storage_service.dart';

class SessionService {
  SessionService(this._storage);

  final SecureStorageService _storage;
  static const String _sessionKey = 'session_json';

  Future<void> saveSession(SessionModel session) async {
    await _storage.write(_sessionKey, jsonEncode(session.toJson()));
  }

  Future<Result<SessionModel>> getSession() async {
    try {
      final raw = await _storage.read(_sessionKey);
      if (raw == null || raw.isEmpty) {
        return const Failure(AppFailure(code: 'session_not_found', message: 'Session not found'));
      }

      final json = jsonDecode(raw) as Map<String, dynamic>;
      return Success(SessionModel.fromJson(json));
    } catch (e) {
      return Failure(Exception(e.toString()));
    }
  }

  Future<void> clearSession() async {
    await _storage.delete(_sessionKey);
  }
}
```

## `api_client.dart`

```dart
import 'package:dio/dio.dart';
import 'package:mobile_core/mobile_core.dart';

class ApiClient {
  ApiClient({
    required String baseUrl,
    String? accessToken,
  }) : _dio = Dio(
          BaseOptions(
            baseUrl: baseUrl,
            connectTimeout: AppConstants.apiTimeout,
            receiveTimeout: AppConstants.apiTimeout,
            headers: {
              if (accessToken != null && accessToken.isNotEmpty)
                'Authorization': 'Bearer $accessToken',
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
          ),
        );

  final Dio _dio;

  Future<Response<dynamic>> get(String path, {Map<String, dynamic>? queryParameters}) {
    return _dio.get(path, queryParameters: queryParameters);
  }

  Future<Response<dynamic>> post(String path, {Object? data}) {
    return _dio.post(path, data: data);
  }
}
```

## `connectivity_service.dart`

```dart
import 'package:connectivity_plus/connectivity_plus.dart';

class ConnectivityService {
  ConnectivityService(this._connectivity);

  final Connectivity _connectivity;

  Stream<List<ConnectivityResult>> watchConnectivity() {
    return _connectivity.onConnectivityChanged;
  }

  Future<bool> isOnline() async {
    final result = await _connectivity.checkConnectivity();
    return !result.contains(ConnectivityResult.none);
  }
}
```

---

# 9. `mobile_testkit` starter pack

## `pubspec.yaml`

```yaml
name: mobile_testkit
description: Shared test helpers for CleanMateX mobile apps
version: 0.0.1
publish_to: none

environment:
  sdk: ^3.5.0

dependencies:
  flutter:
    sdk: flutter
  flutter_test:
    sdk: flutter
  mobile_domain:
    path: ../mobile_domain
  mobile_core:
    path: ../mobile_core
```

## `fake_user_factory.dart`

```dart
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

class FakeUserFactory {
  FakeUserFactory._();

  static AppUserModel customer() {
    return AppUserModel(
      id: 'user-1',
      displayName: 'Test Customer',
      email: 'customer@test.com',
      role: AppRole.customer,
    );
  }

  static AppUserModel staff() {
    return AppUserModel(
      id: 'user-2',
      displayName: 'Test Staff',
      email: 'staff@test.com',
      role: AppRole.staff,
    );
  }

  static AppUserModel driver() {
    return AppUserModel(
      id: 'user-3',
      displayName: 'Test Driver',
      email: 'driver@test.com',
      role: AppRole.driver,
    );
  }
}
```

---

# 10. App starter for `staff_app`

This is the first app to build.

## `pubspec.yaml`

```yaml
name: staff_app
description: CleanMateX Staff App
publish_to: none
version: 0.0.1+1

environment:
  sdk: ^3.5.0

dependencies:
  flutter:
    sdk: flutter
  flutter_localizations:
    sdk: flutter
  flutter_riverpod: ^2.5.1
  easy_localization: ^3.0.7+1

  mobile_core:
    path: ../../packages/mobile_core
  mobile_l10n:
    path: ../../packages/mobile_l10n
  mobile_ui:
    path: ../../packages/mobile_ui
  mobile_domain:
    path: ../../packages/mobile_domain
  mobile_services:
    path: ../../packages/mobile_services
```

## Folder tree

```text
apps/staff_app/lib/
  main.dart
  app/
    staff_app.dart
    staff_router.dart
    staff_providers.dart
  features/
    auth/
      ui/
        login_screen.dart
  home/
    staff_home_screen.dart
```

## `main.dart`

```dart
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'app/staff_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();

  runApp(
    EasyLocalization(
      supportedLocales: LocaleController.supportedLocales,
      fallbackLocale: LocaleController.fallbackLocale,
      path: 'packages/mobile_l10n/assets/translations',
      child: const ProviderScope(
        child: StaffApp(),
      ),
    ),
  );
}
```

## `staff_app.dart`

```dart
import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';
import '../home/staff_home_screen.dart';

class StaffApp extends StatelessWidget {
  const StaffApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppStrings.appName.tr(),
      debugShowCheckedModeBanner: false,
      locale: context.locale,
      supportedLocales: context.supportedLocales,
      localizationsDelegates: context.localizationDelegates,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      home: const StaffHomeScreen(),
    );
  }
}
```

## `staff_home_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

class StaffHomeScreen extends StatelessWidget {
  const StaffHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: Text(AppStrings.appName.tr()),
      body: AppCardWidget(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Staff App Home',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            Text(AppStrings.loading.tr()),
          ],
        ),
      ),
    );
  }
}
```

---

# 11. App starter for `driver_app`

Use the same shell pattern. Only app entry and home screen differ.

## `driver_home_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:mobile_ui/mobile_ui.dart';

class DriverHomeScreen extends StatelessWidget {
  const DriverHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const AppScaffold(
      title: Text('Driver App'),
      body: AppCardWidget(
        child: Text('Driver dashboard starter'),
      ),
    );
  }
}
```

---

# 12. App starter for `customer_app`

## `customer_home_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:mobile_ui/mobile_ui.dart';

class CustomerHomeScreen extends StatelessWidget {
  const CustomerHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const AppScaffold(
      title: Text('Customer App'),
      body: AppCardWidget(
        child: Text('Customer home starter'),
      ),
    );
  }
}
```

---

# 13. First feature starter pattern: login

This is the first proper feature to implement after shells.

## Staff auth folder

```text
features/auth/
  providers/
    login_provider.dart
  data/
    repositories/
      auth_repository.dart
  ui/
    login_screen.dart
```

## `auth_repository.dart`

```dart
import 'package:mobile_core/mobile_core.dart';

class AuthRepository {
  Future<Result<void>> login({
    required String email,
    required String password,
  }) async {
    try {
      await Future<void>.delayed(const Duration(milliseconds: 700));
      return const Success(null);
    } catch (e) {
      return Failure(Exception(e.toString()));
    }
  }
}
```

## `login_provider.dart`

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import '../data/repositories/auth_repository.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository();
});

class LoginNotifier extends StateNotifier<FormSubmissionState> {
  LoginNotifier(this._repository) : super(const FormSubmissionState());

  final AuthRepository _repository;

  Future<void> login({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(status: FormSubmissionStatus.submitting, errorMessage: null);

    final result = await _repository.login(email: email, password: password);

    if (result is Success<void>) {
      state = state.copyWith(status: FormSubmissionStatus.success);
    } else if (result is Failure<void>) {
      state = state.copyWith(
        status: FormSubmissionStatus.failure,
        errorMessage: result.exception.toString(),
      );
    }
  }
}

final loginProvider =
    StateNotifierProvider<LoginNotifier, FormSubmissionState>((ref) {
  return LoginNotifier(ref.read(authRepositoryProvider));
});
```

## `login_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';
import '../providers/login_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(loginProvider);

    ref.listen<FormSubmissionState>(loginProvider, (previous, next) {
      if (next.isFailure && next.errorMessage != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(next.errorMessage!)),
        );
      }
    });

    return AppScaffold(
      title: Text(AppStrings.login.tr()),
      body: Form(
        key: _formKey,
        child: Column(
          children: [
            AppTextFieldWidget(
              controller: _emailController,
              labelText: AppStrings.email.tr(),
              validator: (value) => AppValidators.requiredField(
                value,
                '${AppStrings.email.tr()} ${AppStrings.save.tr()}',
              ),
            ),
            const SizedBox(height: 12),
            AppTextFieldWidget(
              controller: _passwordController,
              labelText: AppStrings.password.tr(),
              obscureText: true,
              validator: (value) => AppValidators.requiredField(
                value,
                '${AppStrings.password.tr()} ${AppStrings.save.tr()}',
              ),
            ),
            const SizedBox(height: 16),
            AppPrimaryButton(
              label: AppStrings.login.tr(),
              isLoading: state.isSubmitting,
              onPressed: () {
                if (_formKey.currentState?.validate() != true) return;

                ref.read(loginProvider.notifier).login(
                      email: _emailController.text.trim(),
                      password: _passwordController.text,
                    );
              },
            ),
          ],
        ),
      ),
    );
  }
}
```

---

# 14. Build order from here

The exact next build sequence should be:

1. create workspace and packages
2. make all packages compile
3. wire `staff_app` and make it run
4. wire `driver_app` and make it run
5. wire `customer_app` and make it run
6. finish shared localization/theme/widgets
7. implement shared auth/session
8. implement first vertical slice in `staff_app`
9. implement first vertical slice in `driver_app`
10. implement first vertical slice in `customer_app`

---

# 15. What not to do now

Do not do these yet:

* full offline sync engine
* full feature flags client engine
* giant generic repository abstraction
* map SDK abstractions
* white-label build automation
* generated-model conversion everywhere
* multi-tenant switching UX

These are later-phase concerns.

---

# 16. Strong recommendation

Your next move should be:

**build the workspace skeleton and make `staff_app` compile first**

Then immediately build:

* `mobile_core`
* `mobile_l10n`
* `mobile_ui`

Because once those three are solid, the rest of the mobile side accelerates sharply.

