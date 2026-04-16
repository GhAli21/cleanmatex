Perfect. Use **`cmx_mobile_apps`** as the workspace root.

Below is the **suggested paste-ready workspace skeleton pack** for:

* `cmx_mobile_apps`
* 3 apps:

  * `customer_app`
  * `staff_app`
  * `driver_app`
* 6 shared packages:

  * `mobile_core`
  * `mobile_l10n`
  * `mobile_ui`
  * `mobile_domain`
  * `mobile_services`
  * `mobile_testkit`

This structure is the right fit for CleanMateX because the platform already defines distinct customer, staff, and driver roles, Flutter mobile apps, EN/AR + RTL support, offline tolerance, and shared architecture standards.  

---

# 1. Final workspace tree

```text
cmx_mobile_apps/
  MOBILE_FOUNDATION_DECISIONS.md
  README.md
  melos.yaml
  analysis_options.yaml
  pubspec.yaml

  apps/
    customer_app/
      pubspec.yaml
      analysis_options.yaml
      lib/
        main.dart
        app/
          customer_app.dart
          customer_router.dart
          customer_providers.dart
        home/
          customer_home_screen.dart
      assets/
        images/
        icons/

    staff_app/
      pubspec.yaml
      analysis_options.yaml
      lib/
        main.dart
        app/
          staff_app.dart
          staff_router.dart
          staff_providers.dart
        home/
          staff_home_screen.dart
        features/
          auth/
            data/
              repositories/
                auth_repository.dart
            providers/
              login_provider.dart
            ui/
              login_screen.dart
      assets/
        images/
        icons/

    driver_app/
      pubspec.yaml
      analysis_options.yaml
      lib/
        main.dart
        app/
          driver_app.dart
          driver_router.dart
          driver_providers.dart
        home/
          driver_home_screen.dart
      assets/
        images/
        icons/

  packages/
    mobile_core/
      pubspec.yaml
      analysis_options.yaml
      lib/
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

    mobile_l10n/
      pubspec.yaml
      analysis_options.yaml
      lib/
        mobile_l10n.dart
        src/
          app_strings.dart
          locale_controller.dart
      assets/
        translations/
          en.json
          ar.json

    mobile_ui/
      pubspec.yaml
      analysis_options.yaml
      lib/
        mobile_ui.dart
        src/
          theme/
            app_colors.dart
            app_spacing.dart
            app_text_styles.dart
            app_theme.dart
          layout/
            app_scaffold.dart
          widgets/
            app_primary_button.dart
            app_text_field_widget.dart
            app_loading_indicator.dart
            app_error_view.dart
            app_empty_state.dart
            app_card_widget.dart

    mobile_domain/
      pubspec.yaml
      analysis_options.yaml
      lib/
        mobile_domain.dart
        src/
          models/
            session_model.dart
            app_user_model.dart
            branch_model.dart
            driver_task_model.dart

    mobile_services/
      pubspec.yaml
      analysis_options.yaml
      lib/
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

    mobile_testkit/
      pubspec.yaml
      analysis_options.yaml
      lib/
        mobile_testkit.dart
        src/
          fakes/
            fake_user_factory.dart
```

---

# 2. Root `pubspec.yaml`

Keep root simple.

```yaml
name: cmx_mobile_apps
publish_to: none
environment:
  sdk: ^3.5.0
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
    unnecessary_lambdas: true

analyzer:
  exclude:
    - "**/*.g.dart"
    - "**/*.freezed.dart"
```

---

# 4. Root `melos.yaml`

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

# 5. Common package `analysis_options.yaml`

Use the same file in each app/package:

```yaml
include: ../../analysis_options.yaml
```

For apps, relative path differs. Use:

## in `apps/.../analysis_options.yaml`

```yaml
include: ../../analysis_options.yaml
```

## in `packages/.../analysis_options.yaml`

```yaml
include: ../../analysis_options.yaml
```

---

# 6. `mobile_core/pubspec.yaml`

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

## `mobile_core/lib/mobile_core.dart`

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

---

# 7. `mobile_l10n/pubspec.yaml`

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

## `mobile_l10n/lib/mobile_l10n.dart`

```dart
library mobile_l10n;

export 'package:easy_localization/easy_localization.dart';
export 'src/app_strings.dart';
export 'src/locale_controller.dart';
```

---

# 8. `mobile_ui/pubspec.yaml`

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

## `mobile_ui/lib/mobile_ui.dart`

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

---

# 9. `mobile_domain/pubspec.yaml`

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

## `mobile_domain/lib/mobile_domain.dart`

```dart
library mobile_domain;

export 'src/models/session_model.dart';
export 'src/models/app_user_model.dart';
export 'src/models/branch_model.dart';
export 'src/models/driver_task_model.dart';
```

---

# 10. `mobile_services/pubspec.yaml`

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
  dio: ^5.7.0
  connectivity_plus: ^6.0.5
  flutter_secure_storage: ^9.2.2
  mobile_core:
    path: ../mobile_core
  mobile_domain:
    path: ../mobile_domain
```

## `mobile_services/lib/mobile_services.dart`

```dart
library mobile_services;

export 'src/networking/api_client.dart';
export 'src/storage/secure_storage_service.dart';
export 'src/session/session_service.dart';
export 'src/connectivity/connectivity_service.dart';
```

---

# 11. `mobile_testkit/pubspec.yaml`

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
  mobile_core:
    path: ../mobile_core
  mobile_domain:
    path: ../mobile_domain
```

## `mobile_testkit/lib/mobile_testkit.dart`

```dart
library mobile_testkit;

export 'src/fakes/fake_user_factory.dart';
```

---

# 12. `staff_app/pubspec.yaml`

Staff first is the correct execution order because operational workflow and staff-side control are core to the system’s business value and workflow design.  

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

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true
```

---

# 13. `driver_app/pubspec.yaml`

```yaml
name: driver_app
description: CleanMateX Driver App
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

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true
```

---

# 14. `customer_app/pubspec.yaml`

```yaml
name: customer_app
description: CleanMateX Customer App
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

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true
```

---

# 15. Shared `main.dart` pattern for all apps

Use same pattern, change app widget only.

## `apps/staff_app/lib/main.dart`

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
      path: '../../packages/mobile_l10n/assets/translations',
      child: const ProviderScope(
        child: StaffApp(),
      ),
    ),
  );
}
```

## `apps/driver_app/lib/main.dart`

```dart
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'app/driver_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();

  runApp(
    EasyLocalization(
      supportedLocales: LocaleController.supportedLocales,
      fallbackLocale: LocaleController.fallbackLocale,
      path: '../../packages/mobile_l10n/assets/translations',
      child: const ProviderScope(
        child: DriverApp(),
      ),
    ),
  );
}
```

## `apps/customer_app/lib/main.dart`

```dart
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'app/customer_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();

  runApp(
    EasyLocalization(
      supportedLocales: LocaleController.supportedLocales,
      fallbackLocale: LocaleController.fallbackLocale,
      path: '../../packages/mobile_l10n/assets/translations',
      child: const ProviderScope(
        child: CustomerApp(),
      ),
    ),
  );
}
```

---

# 16. Thin app shells

## `apps/staff_app/lib/app/staff_app.dart`

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

## `apps/driver_app/lib/app/driver_app.dart`

```dart
import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';
import '../home/driver_home_screen.dart';

class DriverApp extends StatelessWidget {
  const DriverApp({super.key});

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
      home: const DriverHomeScreen(),
    );
  }
}
```

## `apps/customer_app/lib/app/customer_app.dart`

```dart
import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';
import '../home/customer_home_screen.dart';

class CustomerApp extends StatelessWidget {
  const CustomerApp({super.key});

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
      home: const CustomerHomeScreen(),
    );
  }
}
```

---

# 17. Starter home screens

## `staff_home_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:mobile_ui/mobile_ui.dart';

class StaffHomeScreen extends StatelessWidget {
  const StaffHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const AppScaffold(
      title: Text('Staff App'),
      body: AppCardWidget(
        child: Text('Staff home starter'),
      ),
    );
  }
}
```

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
        child: Text('Driver home starter'),
      ),
    );
  }
}
```

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

# 18. Placeholder router/provider files

Create these as placeholders so structure stays stable.

## Example `staff_router.dart`

```dart
class StaffRouter {
  StaffRouter._();
}
```

## Example `staff_providers.dart`

```dart
class StaffProviders {
  StaffProviders._();
}
```

Do same for customer and driver.

---

# 19. First commands to run

From `cmx_mobile_apps`:

```bash
flutter pub global activate melos
melos bootstrap
melos analyze
melos run:staff
```

Then later:

```bash
melos run:driver
melos run:customer
```

---

# 20. Build order from this exact pack

Now the correct execution sequence is:

1. create `cmx_mobile_apps`
2. paste root files
3. create all apps and packages folders
4. paste all `pubspec.yaml` files
5. paste export files
6. paste starter app shells
7. run `melos bootstrap`
8. fix path/import issues if any
9. make `staff_app` run first
10. then wire `mobile_core`, `mobile_l10n`, and `mobile_ui` deeper

---

# 21. Hard recommendation

Do **not** start feature coding yet beyond shell and login prototype.

First make these 3 things solid:

* `mobile_core`
* `mobile_l10n`
* `mobile_ui`

Once those are stable, everything else becomes much faster and cleaner.

The best next step after this is to generate the **full contents for the starter files inside `mobile_core`, `mobile_l10n`, and `mobile_ui` in one implementation pass**.
