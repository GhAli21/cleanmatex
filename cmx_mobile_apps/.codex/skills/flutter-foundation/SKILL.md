---
name: flutter-foundation
description: Flutter implementation standards for CleanMateX mobile apps: app bootstrap, Riverpod, routing, typed models, error handling, configuration, repositories, and session flow. Use when writing non-UI Flutter code in cmx_mobile_apps.
user-invocable: true
---

# Flutter Foundation

Use this skill for app bootstrap and non-UI Flutter implementation patterns.

## Read First

Read these before writing code:

* `cmx_mobile_apps/docs/MOBILE_FOUNDATION_DECISIONS.md`
* `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`

## Core Rules

1. Flutter collects input and renders state; backend owns business-rule authority.
2. Riverpod is the state-management approach.
3. Use typed models and typed service boundaries only.
4. Repositories isolate remote and local data concerns from widgets.
5. Configuration loads from `dart-define`, not ad hoc runtime sources.
6. Prefer full-word file naming such as `_view.dart`, `_repository.dart`, and `{model}_db_service.dart`.
7. Use structured logging or `AppLogger`; do not add committed `print()` or `debugPrint()` calls.

## Architecture Flow

Use this direction:

`UI -> Provider -> Repository -> Data Source / Service`

Widgets talk to providers.

Providers orchestrate state.

Repositories translate API/storage concerns into app-facing models and exceptions.

## Routing and Bootstrap

Prefer:

* clear bootstrap entry point
* route guards around auth-sensitive areas
* session restore before routing into protected areas
* typed route inputs or explicit parameter extraction

## Data and Error Rules

* no raw Dio errors in widgets
* map service and network failures into typed app exceptions
* do not pass raw `Map<String, dynamic>` through multiple layers as primary app state
* do not use `dynamic` in feature flow types

## Session and Config Rules

* tokens belong in secure storage, not ad hoc app state persistence
* session restore logic must be explicit and restart-safe
* app config must fail clearly when required values are missing

## Anti-Patterns

Reject these:

* `onPressed` directly calling API clients
* widget-local business decisions
* route handling mixed with backend payload parsing
* loosely typed models crossing providers, repositories, and UI
* abbreviated file naming such as `_vw.dart` or `_repo.dart`
* committed `print()` / `debugPrint()` usage

## Required Output

When using this skill, state:

1. bootstrap/routing/session flow being implemented
2. provider/repository/service boundaries
3. model and exception strategy
4. validation path for the change

## Validation Checklist

- [ ] No business logic is placed in widgets
- [ ] Provider/repository/service boundaries are clear
- [ ] Typed models and exceptions are used
- [ ] Session handling is restart-safe
- [ ] Config loading is explicit and validated
