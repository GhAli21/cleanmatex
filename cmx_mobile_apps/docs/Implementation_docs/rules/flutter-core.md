---
description: Core Flutter mobile development rules for CleanMateX
globs:
  - "cmx_mobile_apps/apps/customer_app/lib/**/*.dart"
  - "cmx_mobile_apps/apps/staff_app/lib/**/*.dart"
  - "cmx_mobile_apps/apps/driver_app/lib/**/*.dart"
  - "cmx_mobile_apps/packages/**/*.dart"
alwaysApply: true
---

# CleanMateX Flutter Core Rules

## Mission

Build production-grade Flutter mobile apps for CleanMateX using explicit, maintainable, scalable code. Optimize for solo-developer speed, long-term maintainability, bilingual UX, operational reliability, and zero hidden code.

## Stack

- Flutter stable, Dart null safety, SDK `>=3.5.0 <4.0.0`
- **State management**: `flutter_riverpod ^2.5.1` — no alternatives
- **Navigation**: `onGenerateRoute` with `AppRoute` constants in `core/navigation/app_router.dart` — no `go_router`, no `auto_route`
- **HTTP**: `MobileHttpClient` from `mobile_services` (uses `http ^1.2.2` internally) — never use `http`, `dio`, or any HTTP package directly in app or feature code
- **Secure storage**: `flutter_secure_storage ^9.2.2` for tokens and session data
- **Connectivity**: `connectivity_plus ^6.1.5` via `ConnectivityService` in `mobile_services`
- **Monorepo tooling**: Melos `^6.3.2`
- **No code generation** — see `flutter-no-codegen.md`

## Architecture

Feature-first structure inside each app:

```
lib/
  core/
    navigation/          # AppRoute constants, onGenerateRoute, guards
    providers/           # Core DI providers (http client, session, env config)
    app_shell_controller.dart  # Session flow + locale notifiers
  features/
    <feature_name>/
      data/
        datasources/     # remote (HTTP) + local (Hive)
        models/          # feature-specific DTOs
        repositories/    # concrete implementations
      domain/            # entities + use-case abstractions (skip for simple features)
      providers/         # Riverpod Notifier/AsyncNotifier declarations
      ui/
        screens/
        cards/
        widgets/         # interactive components (_widget.dart)
        dialogs/
```

Shared code lives in packages — never in app code:

| Package | Purpose |
|---|---|
| `mobile_core` | `AppConfig`, `AppLogger`, `AppException` hierarchy |
| `mobile_domain` | Plain-Dart domain models (no code generation) |
| `mobile_services` | `MobileHttpClient`, interceptors, `SessionManager`, `ConnectivityService` |
| `mobile_ui` | `AppTheme`, `AppColors`, `AppSpacing`, shared widgets |
| `mobile_l10n` | `AppLocalizations`, `AppLocale` (inline map, no code generation) |
| `mobile_testkit` | `TestAppWrapper`, test helpers |

Dependency direction: `apps → packages`; packages never import from apps; no circular deps.

## Routing

All route names are `static const String` in `AppRoute` — never hard-code route strings inline.

`onGenerateRoute` checks `customerSessionFlowProvider` and `tenantProvider` for guards — unauthenticated users redirect to login.

Use `CustomTransitionPage` for RTL-aware transitions: slide from left in AR, from right in EN.

## Hard Rules

- Never put API calls directly in widgets
- Never put business logic inside `build()`
- Never hardcode user-facing strings — use `AppLocalizations.of(context)`
- Never mix unrelated responsibilities in one file — one class per file
- Never use giant god widgets/screens
- Prefer explicit code over clever abstractions
- Reuse existing shared widgets and theme utilities before creating new ones
- Do not use hidden code generation tools of any kind
- All important code paths must be visible in source files

## State Management

- `Notifier` — preferred for complex mutable state with actions
- `AsyncNotifier` — for providers that start with an async load
- `FutureProvider` — for read-only async data
- `StateProvider` — for simple primitive UI state only (tab index, toggle)
- `setState` — allowed only for tiny local visual state (expand/collapse, tab selection); never for data loading, entity lists, submission flows, or shared state
- Prefer `autoDispose` on screen-scoped providers

Provider naming: `{noun}{Verb}Provider` — e.g., `customerSessionFlowProvider`, `orderDetailProvider`.

Banned provider names: `dataProvider`, `mainProvider`, `tempProvider`, `infoProvider`.

Implement a `ProviderObserver` in `main.dart` to log all `AsyncValue.error` states via `AppLogger`.

## Widgets

Always use `ConsumerWidget` or `ConsumerStatefulWidget` — never `StatefulWidget` with a `Consumer` wrapper.

Always use `const` constructors and `super.key`.

Extract repeated subtrees to named widget classes — never inline function widgets (`Widget _buildX()`).

File naming:
- `_screen.dart` — screens
- `_card.dart` — card widgets
- `_widget.dart` — interactive components
- `_vw.dart` — view-only display widgets (no interaction, no internal state)
- `app_*_widget.dart` — reusable app-level shared widgets in `mobile_ui`

## Data Boundaries

- Parse API JSON at the repository/data layer — never in providers or widgets
- Never pass raw `Map<String, dynamic>` through the app — use typed models
- Use `Map<String, Object?>` (not `dynamic`) for JSON maps in models
- Repositories translate datasource errors into typed `AppException` — raw HTTP exceptions must not escape repositories
- UI must not know backend JSON field names

## Environment and Config

- `AppConfig` in `mobile_core` reads all values from `--dart-define` at build time
- Never hardcode base URLs, API keys, or secrets in source
- Three environments: `DEV`, `STAGING`, `PROD` — controlled by `APP_ENV` dart-define
- `AppConfig` must throw if a required config value is missing in production

## Security

- Never hardcode secrets, tokens, private keys, or credentials
- Never log tokens, passwords, OTPs, or sensitive PII — in any environment
- Token storage: `flutter_secure_storage` only — never SharedPreferences, Hive, or Riverpod state
- Production builds must use `--obfuscate --split-debug-info`
- Respect backend authorization — UI hiding is not security
- Handle unauthorized (401) and expired sessions cleanly — force re-auth, never silently fail

## Multi-Tenant Isolation

- Every API request carries `X-Tenant-Id` — enforced by `TenantInterceptor` in `mobile_services`
- All data providers must `ref.watch(tenantSessionProvider)` before fetching
- Hive box naming is namespaced per tenant: `{tenantOrgId}_{purpose}` — prevents cross-tenant data leakage on shared devices
- Never construct API paths with hardcoded tenant identifiers — always read from `TenantSession`
- Feature visibility may depend on plan flags or role — disabled features must fail gracefully

## Melos Workspace

- Run `melos bootstrap` after any `pubspec.yaml` change
- `melos analyze` must pass with zero warnings — CI gate
- `melos test` must pass — CI gate
- `melos format` — `dart format` across all packages
- Never add dependencies to the root workspace `pubspec.yaml`

## AI Behavior

Before generating code, infer:
- Feature purpose and user role
- Source of truth for state
- API/repository dependencies
- Localization impact (EN + AR in same commit)
- Navigation impact (AppRoute update needed?)
- Loading / error / empty / success states
- Offline behavior needs
- Tenant / feature-flag implications

When editing existing code:
- Keep naming consistent with surrounding code
- Preserve imports structure
- Update localization keys if UI text changes
- Update routes/providers/repositories if feature wiring changes
- Do not silently introduce fake placeholder code
- Do not introduce code generation
- Do not introduce unnecessary abstraction layers
