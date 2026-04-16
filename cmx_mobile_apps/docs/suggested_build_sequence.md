# suggested build sequence

Below is the suggested build sequence for the **mobile apps foundation first**. This is the correct move. Do **not** start with screens. Build the shared layer first, otherwise you will create widget chaos, duplicated logic, and expensive refactoring later.

This plan is aligned with your CleanMateX direction: mobile-first, bilingual EN/AR, RTL-safe, reusable widgets, Flutter customer/driver apps, and long-term maintainability. The stack direction and repo/module split are already defined in your project docs, including Flutter mobile apps, shared repo structure, AR/EN support, offline tolerance, and observability goals.  

# 1. Strategic objective

Build a **shared mobile foundation layer** before any feature implementation, so both:

* Customer App
* Driver App

can reuse the same:

* core theme
* localization
* widgets
* form patterns
* API base services
* model conventions
* state conventions
* error handling
* offline/network handling
* navigation conventions

That matches your project principle of reusable widgets, consistent theming, localization, and feature-based architecture. 

---

# 2. Recommended implementation phases

## Phase 0 — Foundation decisions lock

Before coding, lock these decisions in one short internal doc:

* Flutter only for mobile apps
* Riverpod only for state
* manual models by default
* feature-based architecture
* shared `core/` package inside app codebase
* backend is source of truth
* EN/AR from day one
* dark mode support from day one
* offline-ready patterns from day one

### Deliverables

* `MOBILE_FOUNDATION_DECISIONS.md`
* folder structure approved
* naming conventions approved

---

## Phase 1 — Project structure and app shell

Create the base app structure first.

### Suggested structure

```text
lib/
  app/
    app.dart
    app_router.dart
    app_providers.dart
    app_config.dart

  core/
    config/
    constants/
    enums/
    errors/
    extensions/
    helpers/
    localization/
    theme/
    utils/
    services/
    widgets/
    models/
    state/
    networking/
    storage/

  features/
    auth/
    profile/
    notifications/
    orders/
    customers/
    delivery/
    tracking/
    settings/
```

If you want stronger reuse between Customer and Driver apps later, you can evolve into:

* `apps/customer_app`
* `apps/driver_app`
* `packages/mobile_core`

But for now, since you are solo, keep it simpler first unless you already split apps physically.

### Deliverables

* app entry
* environment config
* router shell
* provider scope shell
* localization bootstrap
* theme bootstrap

---

## Phase 2 — Core design system

This is one of the most important phases. Do this before screens.

Your docs already emphasize bilingual responsive UI and reusable components for consistent theming. 

### Build these first

## 2.1 Theme system

Create:

* `app_colors.dart`
* `app_text_styles.dart`
* `app_spacing.dart`
* `app_radius.dart`
* `app_shadows.dart`
* `app_theme.dart`

### Must support

* light mode
* dark mode
* semantic colors, not raw colors
* status colors
* disabled colors
* success/warning/error/info

### Rule

Do not use raw `Color(...)` in features later.

---

## 2.2 Typography system

Define reusable text styles:

* display
* headline
* title
* body
* label
* caption

### Also define

* text scale handling
* Arabic readability consideration
* consistent line heights

---

## 2.3 Layout tokens

Create constants for:

* page padding
* section spacing
* card spacing
* field spacing
* dialog spacing
* icon sizes
* button heights

This stops random spacing across screens.

---

## Phase 3 — Shared reusable widgets pack

This is where you build your mobile productivity engine.

You already prefer reusable widgets like `AppTextFieldWidget`, `AppCustomButtonWidget`, dropdowns, date pickers, cards, switches, loading widgets, and themed reusable controls. Build that pack first and make it the mandatory UI base. This preference is already established strongly in your project context.

## 3.1 Base scaffold widgets

Build:

* `app_scaffold.dart`
* `app_page.dart`
* `app_safe_area_wrapper.dart`
* `app_section.dart`
* `app_screen_header.dart`

## 3.2 Feedback/status widgets

Build:

* `app_loading_indicator.dart`
* `app_error_view.dart`
* `app_empty_state.dart`
* `app_retry_view.dart`
* `app_success_banner.dart`
* `app_info_banner.dart`

## 3.3 Input widgets

Build:

* `app_text_field_widget.dart`
* `app_multiline_text_field.dart`
* `app_phone_field.dart`
* `app_number_field.dart`
* `app_search_field.dart`
* `app_dropdown.dart`
* `app_date_picker_button.dart`
* `app_time_picker_button.dart`
* `app_checkbox_tile.dart`
* `app_radio_group.dart`
* `app_switch.dart`

## 3.4 Action widgets

Build:

* `app_primary_button.dart`
* `app_secondary_button.dart`
* `app_icon_button.dart`
* `app_outline_button.dart`
* `app_danger_button.dart`

## 3.5 Display widgets

Build:

* `app_card_widget.dart`
* `app_list_tile_card.dart`
* `app_status_chip.dart`
* `app_badge.dart`
* `app_avatar.dart`
* `app_price_view.dart`
* `app_date_view.dart`
* `app_phone_view.dart`

## 3.6 Modal/overlay widgets

Build:

* `app_confirm_dialog.dart`
* `app_bottom_sheet.dart`
* `app_selection_sheet.dart`
* `app_snackbar.dart`

## 3.7 Specialized reusable widgets for your domain

Build early:

* `app_order_status_chip.dart`
* `app_workflow_stepper.dart`
* `app_customer_summary_card.dart`
* `app_driver_task_card.dart`
* `app_branch_selector.dart`
* `app_language_switcher.dart`

### Deliverables

A **widget catalog screen** inside dev mode to preview all widgets. This is high leverage.

---

## Phase 4 — Localization and RTL foundation

Your mobile apps must support EN/AR and RTL from day one. This is not optional in CleanMateX. It is part of the product and stack definition. 

### Build

* localization JSON structure
* `AppLocalizations` integration
* language switching logic
* direction-aware helpers
* formatting utilities for text direction

### Include shared keys for:

* common buttons
* statuses
* labels
* validation messages
* dialogs
* date/time labels
* money labels

### Deliverables

* `en.json`
* `ar.json`
* localization helper methods
* dev checklist for every new widget: “did you localize it?”

---

## Phase 5 — Core utilities and helpers

Now build the non-UI shared engine.

## 5.1 Extensions

Create:

* `string_extensions.dart`
* `context_extensions.dart`
* `datetime_extensions.dart`
* `num_extensions.dart`
* `iterable_extensions.dart`

## 5.2 Formatters

Create:

* `currency_formatter.dart`
* `date_formatter.dart`
* `phone_formatter.dart`
* `name_formatter.dart`

This matters because CleanMateX includes multi-currency and bilingual receipts/workflows. Multi-currency support is part of the documented requirements and backlog.  

## 5.3 Validators

Create:

* `app_validators.dart`
* `phone_validator.dart`
* `email_validator.dart`
* `required_validator.dart`
* `numeric_validator.dart`

## 5.4 Helpers

Create:

* `debouncer.dart`
* `throttler.dart`
* `id_generator.dart`
* `retry_helper.dart`
* `permission_helper.dart`

---

## Phase 6 — Core models and shared contracts

Before real features, define the common mobile-side base models.

### Build

* `api_result.dart`
* `paged_result.dart`
* `app_user_model.dart`
* `branch_model.dart`
* `tenant_config_model.dart`
* `app_permission_model.dart`
* `app_feature_flag_model.dart`
* `app_failure.dart`

### Also define enums

* app roles
* order statuses
* delivery statuses
* payment statuses
* notification channels
* sync status

This aligns with the fact that the system is multi-tenant, role-based, feature-flagged, and workflow-driven.  

---

## Phase 7 — Networking foundation

Do this before any real feature repository.

### Build

* `api_client.dart`
* `api_endpoints.dart`
* `api_headers.dart`
* `api_exception_mapper.dart`
* `network_result.dart`
* `connectivity_service.dart`

### Required behavior

* auth token injection
* timeout handling
* retry policy
* typed error mapping
* pagination-ready patterns

Because your platform direction includes REST/OpenAPI and resilient mobile behavior with offline tolerance and idempotency awareness. 

---

## Phase 8 — Local storage and session foundation

Build the shared persistence layer.

### Build

* `secure_storage_service.dart`
* `local_cache_service.dart`
* `session_service.dart`
* `app_preferences_service.dart`

### Store things like

* auth token
* refresh token
* selected language
* selected branch
* theme mode
* lightweight cached profile/config

---

## Phase 9 — Shared state foundation

Before features, set the standard state patterns.

### Build

* `app_state.dart`
* `async_state_builder.dart`
* `app_notifier_base.dart`
* `paginated_notifier_base.dart`
* `form_submission_state.dart`

### Also create root providers

* auth state provider
* app config provider
* theme mode provider
* locale provider
* connectivity provider
* current user provider

This phase prevents each feature from inventing its own broken state style.

---

## Phase 10 — App-wide services

Build the services that all features will use.

### Build

* `navigation_service.dart`
* `dialog_service.dart`
* `snackbar_service.dart`
* `analytics_service.dart`
* `crash_reporting_service.dart`
* `notification_service.dart`
* `deep_link_service.dart`

Push notifications and operational alerts are part of the platform requirements for mobile apps.  

---

## Phase 11 — Offline/sync preparation layer

Do not fully overengineer sync now, but prepare the foundation.

Your technical direction explicitly mentions offline queue/resilience for mobile. 

### Build

* `pending_action_model.dart`
* `offline_queue_service.dart`
* `sync_manager.dart`
* `sync_status_badge.dart`

### Start with only:

* queue interface
* local pending action storage
* manual retry API

Do not build a giant sync engine yet.

---

## Phase 12 — Developer productivity pack

This phase saves huge time later.

### Build

* widget showcase screen
* theme preview screen
* localization preview screen
* error-state preview screen
* fake data factories
* dev logger

This lets you test reusable UI before feature implementation.

---

# 3. Recommended order of actual implementation

This is the exact order I recommend:

## Sprint A — App shell

1. folder structure
2. app bootstrap
3. router shell
4. provider shell
5. localization bootstrap
6. theme bootstrap

## Sprint B — Design system

7. colors
8. text styles
9. spacing/radius/shadows
10. base scaffold/page wrappers

## Sprint C — Shared widgets

11. buttons
12. text fields
13. dropdowns
14. cards
15. loading/error/empty widgets
16. dialogs/sheets
17. status chips

## Sprint D — Core utilities

18. validators
19. formatters
20. extensions
21. helper classes

## Sprint E — Shared services

22. networking base
23. storage base
24. session/auth base
25. connectivity base
26. notification base

## Sprint F — Shared state

27. async state abstractions
28. root providers
29. base notifier patterns

## Sprint G — Domain contracts

30. shared models
31. enums
32. failures/results
33. pagination contracts

## Sprint H — Offline preparation

34. pending action model
35. offline queue service
36. sync manager shell

## Sprint I — Dev tools

37. widget catalog
38. preview screens
39. fake data generators

Only after that start the first real feature.

---

# 4. First real features after core is ready

After the shared foundation, build features in this order:

1. `auth`
2. `profile/session`
3. `notifications`
4. `orders`
5. `delivery/tracking`
6. `settings`

Why this order:

* auth/session unlocks everything
* orders are core platform value
* driver tracking comes after auth and order contracts
* settings validates your localization/theme/preferences core

This also fits the CleanMateX product scope where customer and driver apps revolve around authentication, orders, logistics, notifications, and tracking.  

---

# 5. Suggested folders/files to create first

## Core

```text
core/
  theme/
    app_colors.dart
    app_text_styles.dart
    app_spacing.dart
    app_radius.dart
    app_shadows.dart
    app_theme.dart

  localization/
    app_localizations.dart
    locale_provider.dart

  widgets/
    app_scaffold.dart
    app_page.dart
    app_loading_indicator.dart
    app_error_view.dart
    app_empty_state.dart
    app_primary_button.dart
    app_text_field_widget.dart
    app_dropdown.dart
    app_card_widget.dart
    app_status_chip.dart

  networking/
    api_client.dart
    api_exception.dart
    api_result.dart

  storage/
    secure_storage_service.dart
    local_cache_service.dart

  services/
    connectivity_service.dart
    dialog_service.dart
    snackbar_service.dart
    notification_service.dart

  state/
    async_state_builder.dart
    app_notifier_base.dart

  utils/
    app_validators.dart
    currency_formatter.dart
    date_formatter.dart
    debouncer.dart
```

---

# 6. Practical milestone plan

## Milestone 1 — “Foundation bootable”

Target:

* app runs
* theme works
* localization works
* router works

## Milestone 2 — “UI kit usable”

Target:

* all shared widgets ready
* widget catalog screen works

## Milestone 3 — “Core services usable”

Target:

* API base client
* storage
* connectivity
* session

## Milestone 4 — “State patterns locked”

Target:

* all future features follow one consistent provider/notifier pattern

## Milestone 5 — “First feature-ready platform”

Target:

* start auth feature with no structural uncertainty

---

# 7. Hard rules during this phase

While building core/shared/reusable layer:

* do not build feature-specific widgets inside `core`
* do not put business logic into reusable widgets
* do not overengineer offline sync at the start
* do not create 10 versions of buttons and text fields
* do not postpone localization
* do not postpone dark mode compatibility
* do not start orders screens before base widgets and services exist

---

# 8. My blunt recommendation

Your best execution strategy is:

**Customer App + Driver App share one mobile foundation, then diverge at feature level.**

That means:

* one shared `core`
* one shared design system
* one shared service layer
* one shared localization system
* separate feature modules where needed

That is the sweet spot for a solo builder. Anything else is either messy or overengineered.

---

