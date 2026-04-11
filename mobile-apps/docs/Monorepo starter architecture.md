## Monorepo starter architecture

Use one Flutter workspace with two apps and shared packages.

```text
mobile-apps/
├─ melos.yaml
├─ pubspec.yaml
├─ analysis_options.yaml
├─ .gitignore
├─ README.md
├─ apps/
│  ├─ customer_app/
│  │  ├─ pubspec.yaml
│  │  ├─ analysis_options.yaml
│  │  ├─ assets/
│  │  │  ├─ images/
│  │  │  ├─ icons/
│  │  │  └─ l10n/
│  │  ├─ lib/
│  │  │  ├─ main.dart
│  │  │  ├─ app/
│  │  │  │  ├─ app.dart
│  │  │  │  ├─ bootstrap/
│  │  │  │  │  ├─ bootstrap.dart
│  │  │  │  │  ├─ app_initializer.dart
│  │  │  │  │  └─ dependency_setup.dart
│  │  │  │  ├─ router/
│  │  │  │  │  ├─ app_router.dart
│  │  │  │  │  ├─ route_names.dart
│  │  │  │  │  └─ route_guards.dart
│  │  │  │  └─ observers/
│  │  │  │     └─ app_route_observer.dart
│  │  │  ├─ core/
│  │  │  │  ├─ config/
│  │  │  │  │  ├─ env.dart
│  │  │  │  │  ├─ app_config.dart
│  │  │  │  │  └─ feature_gate_resolver.dart
│  │  │  │  ├─ session/
│  │  │  │  │  ├─ customer_session_manager.dart
│  │  │  │  │  └─ session_providers.dart
│  │  │  │  ├─ guards/
│  │  │  │  │  └─ auth_guard.dart
│  │  │  │  └─ constants/
│  │  │  │     └─ app_constants.dart
│  │  │  ├─ features/
│  │  │  │  ├─ auth/
│  │  │  │  │  ├─ data/
│  │  │  │  │  │  ├─ datasources/
│  │  │  │  │  │  │  └─ auth_remote_datasource.dart
│  │  │  │  │  │  ├─ models/
│  │  │  │  │  │  │  ├─ otp_request_model.dart
│  │  │  │  │  │  │  └─ otp_verify_model.dart
│  │  │  │  │  │  └─ repositories/
│  │  │  │  │  │     └─ auth_repository_impl.dart
│  │  │  │  │  ├─ domain/
│  │  │  │  │  │  ├─ entities/
│  │  │  │  │  │  ├─ repositories/
│  │  │  │  │  │  └─ usecases/
│  │  │  │  │  └─ presentation/
│  │  │  │  │     ├─ controllers/
│  │  │  │  │     │  └─ auth_controller.dart
│  │  │  │  │     ├─ screens/
│  │  │  │  │     │  ├─ splash_screen.dart
│  │  │  │  │     │  ├─ language_selection_screen.dart
│  │  │  │  │     │  ├─ login_screen.dart
│  │  │  │  │     │  └─ otp_verify_screen.dart
│  │  │  │  │     └─ widgets/
│  │  │  │  ├─ home/
│  │  │  │  ├─ booking/
│  │  │  │  ├─ orders/
│  │  │  │  ├─ receipts/
│  │  │  │  ├─ profile/
│  │  │  │  ├─ support/
│  │  │  │  └─ notifications/
│  │  │  └─ l10n/
│  │  │     ├─ en.arb
│  │  │     └─ ar.arb
│  │  └─ test/
│  │     ├─ widget_test.dart
│  │     └─ features/
│  └─ staff_app/
│     ├─ pubspec.yaml
│     ├─ analysis_options.yaml
│     ├─ assets/
│     │  ├─ images/
│     │  ├─ icons/
│     │  └─ l10n/
│     ├─ lib/
│     │  ├─ main.dart
│     │  ├─ app/
│     │  │  ├─ app.dart
│     │  │  ├─ bootstrap/
│     │  │  │  ├─ bootstrap.dart
│     │  │  │  ├─ app_initializer.dart
│     │  │  │  └─ dependency_setup.dart
│     │  │  ├─ router/
│     │  │  │  ├─ app_router.dart
│     │  │  │  ├─ route_names.dart
│     │  │  │  └─ route_guards.dart
│     │  │  └─ observers/
│     │  │     └─ app_route_observer.dart
│     │  ├─ core/
│     │  │  ├─ config/
│     │  │  │  ├─ env.dart
│     │  │  │  ├─ app_config.dart
│     │  │  │  └─ feature_gate_resolver.dart
│     │  │  ├─ session/
│     │  │  │  ├─ staff_session_manager.dart
│     │  │  │  └─ session_providers.dart
│     │  │  ├─ guards/
│     │  │  │  ├─ auth_guard.dart
│     │  │  │  └─ role_guard.dart
│     │  │  └─ constants/
│     │  │     └─ app_constants.dart
│     │  ├─ features/
│     │  │  ├─ auth/
│     │  │  ├─ tasks/
│     │  │  ├─ reception/
│     │  │  ├─ preparation/
│     │  │  ├─ processing/
│     │  │  ├─ ready_handover/
│     │  │  ├─ issues/
│     │  │  ├─ search_scan/
│     │  │  └─ profile/
│     │  └─ l10n/
│     │     ├─ en.arb
│     │     └─ ar.arb
│     └─ test/
│        ├─ widget_test.dart
│        └─ features/
├─ packages/
│  ├─ shared_core/
│  │  ├─ pubspec.yaml
│  │  ├─ lib/
│  │  │  ├─ shared_core.dart
│  │  │  └─ src/
│  │  │     ├─ config/
│  │  │     │  ├─ env_config.dart
│  │  │     │  └─ app_flavor.dart
│  │  │     ├─ session/
│  │  │     │  ├─ token_store.dart
│  │  │     │  ├─ secure_session_storage.dart
│  │  │     │  └─ auth_tokens.dart
│  │  │     ├─ errors/
│  │  │     │  ├─ app_exception.dart
│  │  │     │  ├─ api_exception.dart
│  │  │     │  └─ failure_mapper.dart
│  │  │     ├─ network/
│  │  │     │  └─ connectivity_service.dart
│  │  │     ├─ logging/
│  │  │     │  └─ app_logger.dart
│  │  │     ├─ feature_flags/
│  │  │     │  └─ feature_flags_snapshot.dart
│  │  │     └─ state/
│  │  │        └─ async_value_x.dart
│  ├─ shared_models/
│  │  ├─ pubspec.yaml
│  │  └─ lib/
│  │     ├─ shared_models.dart
│  │     └─ src/
│  │        ├─ auth/
│  │        │  ├─ authenticated_user.dart
│  │        │  ├─ app_session.dart
│  │        │  ├─ customer_session_context.dart
│  │        │  └─ staff_session_context.dart
│  │        ├─ common/
│  │        │  ├─ paged_result.dart
│  │        │  ├─ app_language.dart
│  │        │  └─ api_meta.dart
│  │        ├─ customer/
│  │        │  ├─ customer_profile.dart
│  │        │  ├─ customer_address.dart
│  │        │  └─ customer_preferences.dart
│  │        ├─ order/
│  │        │  ├─ order_summary.dart
│  │        │  ├─ order_detail.dart
│  │        │  ├─ order_item.dart
│  │        │  ├─ order_timeline_event.dart
│  │        │  ├─ order_status.dart
│  │        │  ├─ order_stage.dart
│  │        │  └─ order_priority.dart
│  │        ├─ booking/
│  │        │  ├─ service_category.dart
│  │        │  ├─ service_option.dart
│  │        │  ├─ booking_request.dart
│  │        │  ├─ booking_schedule_slot.dart
│  │        │  └─ booking_review_summary.dart
│  │        ├─ receipt/
│  │        │  ├─ receipt_summary.dart
│  │        │  ├─ receipt_detail.dart
│  │        │  ├─ invoice_document.dart
│  │        │  └─ payment_summary.dart
│  │        ├─ operations/
│  │        │  ├─ branch_summary.dart
│  │        │  ├─ user_role.dart
│  │        │  ├─ preparation_queue_item.dart
│  │        │  ├─ processing_queue_item.dart
│  │        │  ├─ ready_queue_item.dart
│  │        │  └─ scan_resolve_result.dart
│  │        └─ issues/
│  │           ├─ issue_summary.dart
│  │           ├─ issue_detail.dart
│  │           └─ issue_type.dart
│  ├─ shared_api/
│  │  ├─ pubspec.yaml
│  │  └─ lib/
│  │     ├─ shared_api.dart
│  │     └─ src/
│  │        ├─ client/
│  │        │  ├─ api_client.dart
│  │        │  ├─ dio_factory.dart
│  │        │  └─ interceptors/
│  │        │     ├─ auth_interceptor.dart
│  │        │     ├─ logging_interceptor.dart
│  │        │     └─ retry_interceptor.dart
│  │        ├─ endpoints/
│  │        │  └─ api_endpoints.dart
│  │        ├─ services/
│  │        │  ├─ auth_api_service.dart
│  │        │  ├─ profile_api_service.dart
│  │        │  ├─ customers_api_service.dart
│  │        │  ├─ orders_api_service.dart
│  │        │  ├─ booking_api_service.dart
│  │        │  ├─ receipts_api_service.dart
│  │        │  └─ issues_api_service.dart
│  │        └─ mappers/
│  │           └─ api_error_mapper.dart
│  ├─ shared_design/
│  │  ├─ pubspec.yaml
│  │  └─ lib/
│  │     ├─ shared_design.dart
│  │     └─ src/
│  │        ├─ theme/
│  │        │  ├─ app_colors.dart
│  │        │  ├─ app_spacing.dart
│  │        │  ├─ app_radius.dart
│  │        │  ├─ app_typography.dart
│  │        │  └─ app_theme.dart
│  │        ├─ widgets/
│  │        │  ├─ buttons/
│  │        │  ├─ inputs/
│  │        │  ├─ cards/
│  │        │  ├─ states/
│  │        │  ├─ chips/
│  │        │  └─ scaffolds/
│  │        └─ patterns/
│  │           ├─ status_badge.dart
│  │           ├─ section_header.dart
│  │           └─ list_tile_shell.dart
│  ├─ shared_l10n/
│  │  ├─ pubspec.yaml
│  │  ├─ lib/
│  │  │  ├─ shared_l10n.dart
│  │  │  └─ src/
│  │  │     ├─ localization_keys.dart
│  │  │     └─ common_translations.dart
│  │  └─ l10n/
│  │     ├─ en.arb
│  │     └─ ar.arb
│  └─ shared_utils/
│     ├─ pubspec.yaml
│     └─ lib/
│        ├─ shared_utils.dart
│        └─ src/
│           ├─ formatters/
│           │  ├─ date_formatter.dart
│           │  ├─ currency_formatter.dart
│           │  └─ phone_formatter.dart
│           ├─ validators/
│           │  ├─ phone_validator.dart
│           │  └─ required_validator.dart
│           ├─ helpers/
│           │  ├─ debounce.dart
│           │  └─ string_x.dart
│           └─ barcode/
│              └─ barcode_parser.dart
└─ tools/
   ├─ bootstrap.sh
   └─ bootstrap.ps1
```

## Why this structure works

It gives you:

* clear separation between apps and shared platform code
* no duplication of models, API plumbing, and design tokens
* enough structure for growth without enterprise overkill
* better AI coding assistant context because folders are predictable

---

## Recommended tooling

Use:

* **Flutter + Dart**
* **Riverpod**
* **Dio**
* **go_router**
* **melos**

### Why melos

You are running a multi-package Flutter workspace. Without melos, dependency management becomes messy fast.

---

## Root `melos.yaml`

```yaml
name: mobile-apps

packages:
  - apps/**
  - packages/**

scripts:
  analyze: melos exec -- flutter analyze
  test: melos exec -- flutter test
  pub:get: melos exec -- flutter pub get
  format: melos exec -- dart format .
  bootstrap: melos bootstrap
```

---

## Root `pubspec.yaml`

Keep it minimal.

```yaml
name: mobile-apps_workspace
publish_to: none
environment:
  sdk: ">=3.5.0 <4.0.0"
```

---

# Package responsibilities in plain language

## `shared_core`

Cross-app technical infrastructure.

Put here:

* session/token storage
* app exceptions
* env handling
* connectivity
* logging

Do not put:

* customer booking logic
* staff queue logic
* feature-specific repositories

---

## `shared_models`

All shared entities and enums.

Mandatory early models:

* `OrderStatus`
* `OrderStage`
* `OrderSummary`
* `OrderDetail`
* `CustomerProfile`
* `CustomerAddress`
* `ReceiptSummary`
* `BranchSummary`
* `UserRole`

---

## `shared_api`

All HTTP plumbing.

Start with:

* `ApiClient`
* `AuthApiService`
* `OrdersApiService`
* `CustomersApiService`
* `ProfileApiService`

Then add:

* `BookingApiService`
* `ReceiptsApiService`
* `IssuesApiService`

---

## `shared_design`

Shared design language.

Start with:

* theme
* buttons
* text inputs
* cards
* loader
* empty state
* error state
* status chips

---

## `shared_l10n`

Common translations and key governance.

Shared keys should include:

* auth
* validation
* order statuses
* common buttons
* common errors

---

## `shared_utils`

Formatting and validation helpers.

---

# Starter implementation order

## Phase 0: workspace skeleton

Create:

* root workspace
* both apps
* all packages
* melos
* shared linting

## Phase 1: shared foundations

Implement first:

* `shared_models`
* `shared_core`
* `shared_api`
* `shared_design`
* `shared_l10n`

## Phase 2: Staff App vertical slice

Build first:

* auth
* branch select
* tasks dashboard
* customer lookup
* stub customer creation
* new order intake
* preparation queue/detail
* processing queue/update
* ready queue/handover
* issues

## Phase 3: Customer App visibility slice

Build:

* auth
* language
* home
* active orders
* order details/tracking
* receipts
* profile
* addresses/preferences

## Phase 4: Customer booking

Build:

* service categories
* service details
* booking flow
* schedule
* review
* confirmation

---

# Suggested dependencies

## In apps

```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_localizations:
    sdk: flutter
  flutter_riverpod: ^2.5.1
  go_router: ^14.2.0
  dio: ^5.7.0
  intl: ^0.19.0

  shared_core:
    path: ../../packages/shared_core
  shared_models:
    path: ../../packages/shared_models
  shared_api:
    path: ../../packages/shared_api
  shared_design:
    path: ../../packages/shared_design
  shared_l10n:
    path: ../../packages/shared_l10n
  shared_utils:
    path: ../../packages/shared_utils

dev_dependencies:
  flutter_test:
    sdk: flutter
```

---

# Recommended first concrete files to create

Create these first before any screen work:

## Shared

* `shared_models/src/order/order_status.dart`

* `shared_models/src/order/order_stage.dart`

* `shared_models/src/order/order_summary.dart`

* `shared_models/src/customer/customer_profile.dart`

* `shared_models/src/operations/branch_summary.dart`

* `shared_models/src/operations/user_role.dart`

* `shared_core/src/errors/app_exception.dart`

* `shared_core/src/session/auth_tokens.dart`

* `shared_core/src/session/token_store.dart`

* `shared_api/src/client/dio_factory.dart`

* `shared_api/src/client/api_client.dart`

* `shared_api/src/endpoints/api_endpoints.dart`

* `shared_api/src/services/auth_api_service.dart`

* `shared_design/src/theme/app_colors.dart`

* `shared_design/src/theme/app_typography.dart`

* `shared_design/src/theme/app_theme.dart`

* `shared_design/src/widgets/buttons/app_primary_button.dart`

* `shared_design/src/widgets/inputs/app_text_field.dart`

## Staff app

* `staff_app/lib/app/app.dart`
* `staff_app/lib/app/router/app_router.dart`
* `staff_app/lib/features/auth/presentation/screens/login_screen.dart`
* `staff_app/lib/features/auth/presentation/screens/branch_selection_screen.dart`
* `staff_app/lib/features/tasks/presentation/screens/tasks_dashboard_screen.dart`

## Customer app

* `customer_app/lib/app/app.dart`
* `customer_app/lib/app/router/app_router.dart`
* `customer_app/lib/features/auth/presentation/screens/splash_screen.dart`
* `customer_app/lib/features/auth/presentation/screens/language_selection_screen.dart`
* `customer_app/lib/features/auth/presentation/screens/login_screen.dart`

---

# Hard recommendation on first coding milestone

Do not try to generate the entire codebase at once.

Your first milestone should be:

## Milestone 1

* workspace boots
* both apps run
* shared theme works
* shared localization works
* shared Dio client works
* auth screens render in both apps
* routing works
* one shared model is used by both apps

That proves the architecture is sound.

## Milestone 2

* Staff App: auth + branch select + dashboard
* Customer App: splash + language + auth

## Milestone 3

* Staff App intake flow
* Customer App active order flow

That is the practical path.
