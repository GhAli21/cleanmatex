Below is the **suggested full implementation blueprint** for the **mobile apps foundation** for CleanMateX, assuming a minimum of:

* **Customer App**
* **Staff App**
* **Driver App**

This is the correct architecture direction because CleanMateX already defines multiple mobile roles and app experiences, including customer-facing flows, driver logistics, staff/operations workflows, bilingual support, offline tolerance, push notifications, and a shared Flutter direction for mobile.   

This blueprint is designed for:

* one solo developer
* low rework
* maximum reuse
* clean scaling later

---

# 1. Executive architecture decision

## Recommendation

Build the mobile side as:

* **3 Flutter apps**

  * `customer_app`
  * `staff_app`
  * `driver_app`

on top of:

* **1 shared mobile foundation**

  * design system
  * localization
  * base services
  * networking
  * storage
  * common widgets
  * common models
  * common state patterns
  * common utilities

## Why this is the right move

Because these apps share a huge amount of technical behavior but differ in workflows and UI priorities.

### Shared across all 3 apps

* authentication/session
* localization EN/AR
* theme/light/dark
* error handling
* network layer
* token storage
* push notifications
* device connectivity handling
* branch/user/app config
* reusable widgets
* status chips/cards/forms
* permission-aware rendering
* common formatting/validation

### Different per app

* navigation structure
* home dashboard
* role actions
* workflows and screens
* device capabilities emphasis

This fits CleanMateX requirements where the system serves multiple user classes, including Admin/Staff/Driver/Customer, using Flutter apps plus shared platform direction and bilingual UX. 

---

# 2. Final repo/package structure

For 3 apps, the best structure is **workspace-style Flutter monorepo**.

## Recommended structure

```text
cmx_mobile_apps/
    customer_app/
      lib/
      assets/
      pubspec.yaml

    staff_app/
      lib/
      assets/
      pubspec.yaml

    driver_app/
      lib/
      assets/
      pubspec.yaml

  packages/
    mobile_core/
      lib/
      pubspec.yaml

    mobile_ui/
      lib/
      pubspec.yaml

    mobile_domain/
      lib/
      pubspec.yaml

    mobile_services/
      lib/
      pubspec.yaml

    mobile_l10n/
      lib/
      pubspec.yaml

    mobile_testkit/
      lib/
      pubspec.yaml

  melos.yaml
  pubspec.yaml
  analysis_options.yaml
  README.md
```

---

# 3. Why this package split is correct

## `mobile_core`

Low-level cross-app fundamentals.

Contains:

* constants
* enums
* errors
* helpers
* extensions
* formatters
* validators
* base result/failure classes
* base state abstractions
* environment config
* app flavor support

## `mobile_ui`

All shared reusable UI.

Contains:

* theme
* colors
* typography
* spacing
* app widgets
* dialogs
* cards
* chips
* scaffold shells
* loading/empty/error UI

## `mobile_domain`

Pure shared business-side contracts, not backend logic.

Contains:

* shared entities
* shared models contracts
* app roles
* permission models
* feature-flag models
* session models
* tenant/branch/user models

## `mobile_services`

App infrastructure.

Contains:

* API client
* auth/session storage
* secure storage
* connectivity
* notifications
* deep link handling
* local cache
* offline queue shell
* repository base classes

## `mobile_l10n`

Shared localization system.

Contains:

* localization loader
* EN/AR JSON files
* locale helpers
* translation conventions

## `mobile_testkit`

Testing helpers.

Contains:

* fake factories
* widget wrappers
* mock providers
* shared test data
* golden test support

---

# 4. What should stay out of shared packages

Do **not** put these into shared packages too early:

* customer-only cart logic
* staff-only workflow execution logic
* driver-only route screen UI
* app-specific dashboard widgets
* app-specific navigation trees

Those belong inside each app.

---

# 5. App responsibilities

## 5.1 Customer App

Purpose:

* browsing services
* creating orders
* tracking order status
* managing addresses
* receiving notifications
* payments/receipts
* loyalty/profile/history

This aligns with documented customer self-service, tracking, notifications, receipts, loyalty, and app-first full profile flows.  

## 5.2 Staff App

Purpose:

* reception/intake
* quick order creation
* preparation/detailing
* processing visibility
* assembly/QA/packing handoffs
* status updates
* customer lookup
* issue/reject handling
* branch operational tools

This aligns with the workflow implementation plan and operational role structure. 

## 5.3 Driver App

Purpose:

* assigned tasks
* pickup/delivery flow
* navigation
* OTP/signature/photo POD
* route/task status
* offline-tolerant updates

This aligns with logistics, proof-of-delivery, offline tolerance, route tracking, and driver features.  

---

# 6. Global implementation phases

The right sequence is:

## Phase A — Workspace and shared foundation

Build packages, shared code standards, theme, l10n, core widgets, services.

## Phase B — Cross-app shell

Create app bootstraps for customer/staff/driver with shared startup logic.

## Phase C — Authentication/session layer

Build shared auth/session and role-aware app entry.

## Phase D — Feature-ready infrastructure

Networking, storage, notifications, offline shell, provider patterns.

## Phase E — First app features

Start with smallest high-value vertical slices per app.

---

# 7. Detailed implementation blueprint

# Phase A — Workspace and tooling foundation

## A1. Create monorepo

Create root workspace:

```text
cmx_mobile_apps/
```

## A2. Setup Melos

Use Melos because 3 apps + shared packages without workspace tooling becomes messy fast.

### Why Melos here

You asked before what Melos is. For this setup, it becomes valuable because it manages:

* multiple Flutter apps
* shared packages
* unified scripts
* dependency bootstrapping
* code generation if ever used
* test orchestration

## A3. Root files

Create:

* `melos.yaml`
* root `analysis_options.yaml`
* root `README.md`
* root `pubspec.yaml` if needed for workspace config

## A4. Standard commands

Define scripts for:

* bootstrap
* analyze
* test
* format
* run customer
* run staff
* run driver

### Example Melos scripts

```yaml
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

## Deliverables

* workspace boots successfully
* all packages/apps recognized
* single-command analyze/test works

---

# Phase B — Shared package implementation order

Build packages in this order:

1. `mobile_core`
2. `mobile_l10n`
3. `mobile_ui`
4. `mobile_domain`
5. `mobile_services`
6. `mobile_testkit`

This order minimizes circular dependency risk.

---

# 8. `mobile_core` full blueprint

## Purpose

Technical backbone used by everything else.

## Folder structure

```text
packages/mobile_core/lib/
  mobile_core.dart

  src/config/
    app_env.dart
    app_flavor.dart
    app_config.dart

  src/constants/
    app_constants.dart
    app_durations.dart
    app_numbers.dart

  src/enums/
    app_role.dart
    order_status.dart
    order_type.dart
    payment_status.dart
    delivery_status.dart
    sync_status.dart
    notification_channel.dart

  src/errors/
    app_exception.dart
    app_failure.dart
    network_failure.dart
    validation_failure.dart
    auth_failure.dart
    permission_failure.dart

  src/results/
    result.dart
    paged_result.dart

  src/extensions/
    string_extensions.dart
    context_extensions.dart
    datetime_extensions.dart
    num_extensions.dart
    iterable_extensions.dart

  src/utils/
    debouncer.dart
    throttler.dart
    retry_helper.dart
    id_helper.dart
    permission_helper.dart

  src/formatters/
    currency_formatter.dart
    date_formatter.dart
    time_formatter.dart
    phone_formatter.dart

  src/validators/
    app_validators.dart
    phone_validator.dart
    email_validator.dart
    required_validator.dart
    numeric_validator.dart

  src/state/
    app_async_state.dart
    form_submission_state.dart
```

## Must-build files first

* `app_role.dart`
* `order_status.dart`
* `result.dart`
* `app_failure.dart`
* `currency_formatter.dart`
* `date_formatter.dart`
* `app_validators.dart`
* `debouncer.dart`

## Important rule

This package must stay Flutter-light where possible. Prefer Dart-only logic here.

---

# 9. `mobile_l10n` full blueprint

## Purpose

One localization engine for all apps.

## Folder structure

```text
packages/mobile_l10n/lib/
  mobile_l10n.dart

  src/
    localization_service.dart
    locale_controller.dart
    supported_locales.dart
    translation_keys.dart

  assets/
    translations/
      en.json
      ar.json
```

## What goes into shared translations

Only shared/common terms:

* buttons
* statuses
* generic errors
* dialogs
* navigation labels
* common form labels
* common workflow labels
* customer/driver/staff generic labels

## What stays app-specific

Feature-heavy strings can live in app-level translation files later if needed.

## Translation domains to create from day one

* common
* auth
* validation
* order_status
* actions
* messages
* date_time
* currency
* dialogs

## Example key structure

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "retry": "Retry"
  },
  "auth": {
    "login": "Login",
    "logout": "Logout"
  },
  "order_status": {
    "intake": "Intake",
    "processing": "Processing",
    "ready": "Ready",
    "delivered": "Delivered"
  }
}
```

## Must support

* EN/AR
* RTL switching
* direction-aware widgets
* runtime locale switching

---

# 10. `mobile_ui` full blueprint

This is your highest ROI package.

## Folder structure

```text
packages/mobile_ui/lib/
  mobile_ui.dart

  src/theme/
    app_colors.dart
    app_text_styles.dart
    app_spacing.dart
    app_radius.dart
    app_shadows.dart
    app_theme.dart

  src/layout/
    app_page.dart
    app_scaffold.dart
    app_section.dart
    app_safe_area_wrapper.dart
    app_screen_header.dart

  src/widgets/buttons/
    app_primary_button.dart
    app_secondary_button.dart
    app_outline_button.dart
    app_icon_button.dart
    app_danger_button.dart

  src/widgets/inputs/
    app_text_field_widget.dart
    app_multiline_text_field.dart
    app_search_field.dart
    app_phone_field.dart
    app_number_field.dart
    app_dropdown.dart
    app_date_picker_button.dart
    app_time_picker_button.dart
    app_switch.dart
    app_checkbox_tile.dart
    app_radio_group.dart

  src/widgets/feedback/
    app_loading_indicator.dart
    app_error_view.dart
    app_empty_state.dart
    app_retry_view.dart
    app_success_banner.dart
    app_info_banner.dart

  src/widgets/display/
    app_card_widget.dart
    app_list_tile_card.dart
    app_status_chip.dart
    app_badge.dart
    app_avatar.dart
    app_price_view.dart
    app_date_view.dart
    app_phone_view.dart
    app_divider_title.dart

  src/widgets/overlays/
    app_confirm_dialog.dart
    app_bottom_sheet.dart
    app_selection_sheet.dart
    app_snackbar.dart

  src/widgets/domain/
    app_order_status_chip.dart
    app_workflow_stepper.dart
    app_customer_summary_card.dart
    app_driver_task_card.dart
    app_branch_selector.dart
    app_language_switcher.dart
```

## Theme build order

1. `app_colors.dart`
2. `app_spacing.dart`
3. `app_radius.dart`
4. `app_text_styles.dart`
5. `app_theme.dart`

## Widget build order

1. loading/error/empty
2. buttons
3. text fields
4. cards/chips
5. dialogs/sheets
6. domain widgets

## Mandatory principles

* no hardcoded colors
* no hardcoded strings
* dark mode safe
* RTL safe
* modular widgets only

## Extra must-have

Build a **widget showcase page** in this package or in a dev app.

That page should render:

* all buttons
* all fields
* all states
* status chips
* cards
* dialogs

This saves massive time later.

---

# 11. `mobile_domain` full blueprint

## Purpose

Shared typed contracts used by apps.

## Folder structure

```text
packages/mobile_domain/lib/
  mobile_domain.dart

  src/entities/
    app_user_entity.dart
    tenant_entity.dart
    branch_entity.dart
    app_permission_entity.dart
    feature_flag_entity.dart
    order_summary_entity.dart
    order_item_entity.dart
    customer_entity.dart
    driver_task_entity.dart
    notification_entity.dart

  src/models/
    session_model.dart
    app_config_model.dart
    tenant_settings_model.dart
    branch_model.dart
    role_permissions_model.dart
```

## Build first

* `session_model.dart`
* `app_user_entity.dart`
* `branch_entity.dart`
* `app_permission_entity.dart`
* `feature_flag_entity.dart`

## Rule

Manual models are fine and better for your preference unless there is strong reason otherwise.

---

# 12. `mobile_services` full blueprint

This package will carry a lot of leverage.

## Folder structure

```text
packages/mobile_services/lib/
  mobile_services.dart

  src/networking/
    api_client.dart
    api_endpoints.dart
    api_headers.dart
    api_exception_mapper.dart
    network_result.dart

  src/storage/
    secure_storage_service.dart
    local_cache_service.dart
    preferences_service.dart

  src/session/
    session_service.dart
    token_service.dart

  src/connectivity/
    connectivity_service.dart

  src/notifications/
    push_notification_service.dart
    local_notification_service.dart
    notification_router.dart

  src/deeplinks/
    deep_link_service.dart

  src/offline/
    pending_action_model.dart
    offline_queue_service.dart
    sync_manager.dart

  src/repositories/base/
    base_repository.dart
    paged_repository.dart

  src/logging/
    app_logger.dart

  src/analytics/
    analytics_service.dart

  src/crash/
    crash_reporting_service.dart
```

## Build order

1. storage
2. session
3. networking
4. connectivity
5. logging
6. notifications
7. offline queue shell
8. analytics/crash

## Networking behavior requirements

* auth token injection
* standard timeout
* standard headers
* consistent exception mapping
* retry support where safe
* pagination-ready
* environment-based base URL

## Offline layer: keep first version small

Do not build a full sync engine yet.

Only build:

* pending action model
* local queue storage
* retry pending actions
* sync state flagging

That is enough for first iteration.

---

# 13. `mobile_testkit` full blueprint

## Folder structure

```text
packages/mobile_testkit/lib/
  mobile_testkit.dart

  src/fakes/
    fake_user_factory.dart
    fake_order_factory.dart
    fake_customer_factory.dart
    fake_driver_task_factory.dart

  src/helpers/
    test_app_wrapper.dart
    mock_provider_scope.dart
    fake_localizations.dart
```

## Use

* widget tests
* provider tests
* rapid feature testing

---

# 14. App bootstrap structure for each app

Each app should be thin, with most heavy lifting in packages.

---

## `customer_app`

```text
apps/customer_app/lib/
  main.dart
  app/
    customer_app.dart
    customer_router.dart
    customer_app_shell.dart
    customer_providers.dart

  features/
    auth/
    home/
    services/
    cart/
    orders/
    tracking/
    profile/
    addresses/
    notifications/
    wallet/
    loyalty/
    settings/
```

---

## `staff_app`

```text
apps/staff_app/lib/
  main.dart
  app/
    staff_app.dart
    staff_router.dart
    staff_app_shell.dart
    staff_providers.dart

  features/
    auth/
    dashboard/
    customers/
    new_order/
    preparation/
    processing/
    assembly/
    qa/
    packing/
    ready_orders/
    issues/
    settings/
```

This matches the operational workflow plan more than a generic POS app. 

---

## `driver_app`

```text
apps/driver_app/lib/
  main.dart
  app/
    driver_app.dart
    driver_router.dart
    driver_app_shell.dart
    driver_providers.dart

  features/
    auth/
    dashboard/
    assigned_tasks/
    pickups/
    deliveries/
    navigation/
    pod/
    task_history/
    notifications/
    settings/
```

---

# 15. Shared app startup flow

All 3 apps should use the same startup pattern.

## Startup flow

1. initialize bindings
2. initialize environment/flavor
3. initialize localization
4. initialize storage
5. initialize logger/crash
6. initialize notifications
7. restore session
8. determine app entry route

## Common app shell should handle

* locale
* theme mode
* session restoration
* online/offline banner
* app-wide snackbars/dialogs

---

# 16. Authentication/session foundation blueprint

Build this before business features.

## Shared auth/session files

In `mobile_services` and `mobile_domain`:

* `session_model.dart`
* `token_service.dart`
* `session_service.dart`

In each app:

* login screen
* splash/startup screen
* role-aware home redirect

## Minimum behaviors

* login/logout
* session restore
* token persistence
* unauthorized handling
* force logout on session invalidation

## Why early

Without this, all feature work becomes fake wiring.

---

# 17. Provider/state pattern blueprint

Use one consistent pattern across all apps.

## Suggested approach

* Riverpod
* `AsyncNotifier` or `StateNotifier`
* `AsyncValue` or explicit typed state wrappers

## Base state abstractions to build first

In `mobile_core`:

* `AppAsyncState<T>`
* `FormSubmissionState`

## Shared UI builders

In `mobile_ui`:

* `AsyncStateBuilder<T>`
* `PagedListViewBuilder<T>`

This gives you one standard for:

* loading
* error
* empty
* data

---

# 18. Shared feature implementation order after foundation

After the shared foundation is ready, implement features in this order:

## Cross-app

1. auth/session
2. notifications/settings
3. profile/current user

## Customer App

4. order history
5. order tracking
6. create order
7. addresses
8. wallet/loyalty

## Staff App

9. customer search
10. new order
11. preparation
12. processing board
13. assembly/QA/packing
14. issues/reject flow

## Driver App

15. assigned tasks
16. pickup flow
17. delivery flow
18. POD capture
19. task history

This order is ROI-correct and workflow-aligned.

---

# 19. Exact sprint-by-sprint blueprint

# Sprint 1 — Workspace and package skeleton

### Goal

Bootstrapped monorepo.

### Tasks

* create apps folders
* create packages folders
* configure Melos
* root lint/analysis/test scripts
* create empty package exports
* verify apps compile

### Exit criteria

* all apps run simple placeholder screens
* all packages resolve dependencies

---

# Sprint 2 — Core + localization

### Goal

Shared technical base exists.

### Tasks

* app env/flavor
* constants/enums/errors
* result/failure classes
* formatters/validators
* localization package
* EN/AR setup
* locale switching

### Exit criteria

* all apps show localized starter screen
* language can switch EN/AR
* RTL works

---

# Sprint 3 — UI kit

### Goal

Shared design system ready.

### Tasks

* colors/theme/typography
* spacing/radius/shadows
* scaffold/page wrappers
* buttons
* fields
* cards/chips
* loading/error/empty
* dialogs/sheets
* widget showcase

### Exit criteria

* widget showcase works
* no feature screen uses raw improvised controls

---

# Sprint 4 — Services base

### Goal

Infrastructure is feature-ready.

### Tasks

* secure storage
* local preferences
* session service
* token service
* api client
* connectivity service
* logger
* notifications base

### Exit criteria

* test login token persistence flow works
* standard network request shell works

---

# Sprint 5 — State framework

### Goal

Consistent provider patterns.

### Tasks

* async state wrappers
* base notifiers
* async state builder
* provider conventions
* app root providers

### Exit criteria

* one demo feature uses full provider pattern end-to-end

---

# Sprint 6 — App shells

### Goal

Each app has real entry shell.

### Tasks

* customer shell
* staff shell
* driver shell
* route shells
* startup flows
* home placeholders
* role-aware route guards

### Exit criteria

* each app reaches correct home shell after fake session restore

---

# Sprint 7 — Auth/session implementation

### Goal

Real app access flow works.

### Tasks

* login screen
* logout
* splash/startup
* session restore
* auth provider
* unauthorized handling

### Exit criteria

* all 3 apps authenticate and restore session

---

# Sprint 8 — First vertical slices

### Goal

Each app proves foundation works.

### Customer App slice

* order history list

### Staff App slice

* customer search + simple new order shell

### Driver App slice

* assigned tasks list

### Exit criteria

* real API wiring pattern proven in all 3 apps

---

# 20. Technical rules for package dependency direction

Keep dependencies one-way as much as possible:

```text
mobile_core
mobile_l10n -> mobile_core
mobile_domain -> mobile_core
mobile_ui -> mobile_core + mobile_l10n
mobile_services -> mobile_core + mobile_domain
mobile_testkit -> all as needed for testing
apps -> all shared packages
```

## Important

Do not make:

* `mobile_core` depend on `mobile_ui`
* `mobile_domain` depend on app-specific packages
* packages depend on apps

That creates architectural rot.

---

# 21. Naming conventions

## Packages

* `mobile_core`
* `mobile_ui`
* `mobile_domain`
* `mobile_services`
* `mobile_l10n`
* `mobile_testkit`

## Widgets

Prefix shared widgets with `App`

* `AppPrimaryButton`
* `AppTextFieldWidget`
* `AppErrorView`

## Services

Suffix with `Service`

* `SessionService`
* `ConnectivityService`

## Providers

Be explicit

* `currentUserProvider`
* `customerOrderHistoryProvider`
* `driverAssignedTasksProvider`

## Models

Use domain names

* `OrderSummaryModel`
* `BranchModel`
* `DriverTaskModel`

---

# 22. Do not do these mistakes

Do not:

* start with Customer App screens before packages exist
* duplicate login/session logic in each app
* create separate theme systems per app
* create separate networking code per app
* postpone localization
* postpone offline/connectivity awareness
* invent separate widget styles per app
* let Staff App become a raw admin dump of forms
* mix business logic into widgets

---

# 23. Blunt recommendation on app priority

For MVP speed with your 3-app plan:

## Build order

1. **Staff App first**
2. **Driver App second**
3. **Customer App third**

## Why

Because laundries can operate sooner with:

* staff order creation
* staff workflow progress
* driver delivery operations

The customer app is valuable, but operational control comes first for business viability. This is also consistent with your project’s phased thinking around core workflow, operations, and delivery before broader engagement depth. 

---

# 24. Final target state

When this foundation is done, you should have:

* one workspace
* three runnable apps
* six shared packages
* one design system
* one localization engine
* one networking/storage/session foundation
* one provider/state convention
* one widget catalog
* one onboarding/auth/session flow standard

At that point, feature development becomes fast and controlled instead of chaotic.

---

# 25. What I recommend you generate next

The best next artifact is:

**“Mobile Foundation Package-by-Package Starter Code Pack”**

That should include:

* exact `pubspec.yaml` files
* exact folder trees
* starter exports
* starter code for `mobile_core`
* starter code for `mobile_l10n`
* starter code for `mobile_ui`
* starter code for `mobile_services`
* starter app bootstraps for all 3 apps

That is the point where you stop planning and start building properly.
