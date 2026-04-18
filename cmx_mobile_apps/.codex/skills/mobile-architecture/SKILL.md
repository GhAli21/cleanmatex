---
name: mobile-architecture
description: Mobile workspace structure, app/package boundaries, dependency direction, and reuse rules for CleanMateX Flutter apps. Use when deciding where mobile code belongs, creating shared packages, or reviewing architectural drift in cmx_mobile_apps.
user-invocable: true
---

# Mobile Architecture

Use this skill for mobile workspace structure and app/package responsibility decisions.

## Read First

Read these before changing structure:

* `cmx_mobile_apps/docs/MOBILE_FOUNDATION_DECISIONS.md`
* `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`

Read `cmx_mobile_apps/README.md` when you need current-state facts about what already exists.

## Core Rules

1. Existing repository state is authoritative for current facts.
2. `customer_app` ships first, but shared foundations must still be built as packages.
3. Do not let `customer_app` become a monolith.
4. Package dependencies must flow one way only. No package depends on app code.
5. UI code must not own networking, storage, or business-rule authority.

## Target Package Responsibilities

* `mobile_core`: config, exceptions, logging, core constants, shared utilities
* `mobile_l10n`: localization setup, EN/AR resources, locale helpers, RTL helpers
* `mobile_ui`: theme, design tokens, reusable widgets, state UIs
* `mobile_domain`: shared entities and value objects, no HTTP/storage imports
* `mobile_services`: Dio client, interceptors, secure storage, session manager, connectivity
* `mobile_testkit`: shared mobile test helpers, fakes, harnesses

## Placement Rules

Put code in a shared package when it is:

* reused by multiple apps
* clearly generic
* foundational to app bootstrap, UI, localization, services, or testing

Keep code in `customer_app` when it is:

* customer-specific screen composition
* customer-only route wiring
* product-flow logic that is not yet shared by other apps

## Hard Rules

* No package may import from `customer_app`, `staff_app`, or `driver_app`.
* No widget may call Dio, secure storage, or repositories directly.
* No feature should create app-local duplicates of theme tokens, localization helpers, or session helpers.
* Do not invent a temporary folder layout that will immediately need a migration.
* Use the approved naming layer consistently: `_screen.dart`, `_provider.dart`, `_widget.dart`, `_card.dart`, `_view.dart`, `_model.dart`, `_repository.dart`, and `{model}_db_service.dart`.

## Anti-Patterns

Reject these:

* putting shared widgets inside app folders
* placing typed DTO mapping inside widget code
* adding one-off utilities in app code that belong in `mobile_core`
* putting UI imports in `mobile_services` or `mobile_domain`
* drifting into alternate naming families such as `_repo.dart`, `_vw.dart`, or `...WidgetWidget`

## Required Output

When using this skill, state:

1. the area being changed
2. whether it belongs in app or package
3. the dependency direction
4. any reuse implications for future `staff_app` or `driver_app`

## Validation Checklist

- [ ] Current-state repo structure was checked before applying target-state examples
- [ ] App-vs-package placement is justified
- [ ] Dependency direction remains one-way
- [ ] No shared concern is trapped in `customer_app`
- [ ] No package imports app code
