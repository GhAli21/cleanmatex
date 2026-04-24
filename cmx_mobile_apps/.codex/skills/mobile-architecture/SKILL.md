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

Read `cmx_mobile_apps/README.md` and the actual file tree when you need current-state facts — the docs describe the target, the repo state is the truth.

## Core Rules

1. Existing repository state is authoritative for current facts.
2. `customer_app` ships first, but shared foundations must still be built as packages.
3. Do not let `customer_app` become a monolith — feature-specific code belongs in features, shared code belongs in packages.
4. Package dependencies must flow one way only. No package may depend on app code.
5. UI code must not own networking, storage, or business-rule authority.

## Workspace Layout

```
cmx_mobile_apps/
├── melos.yaml              # Melos workspace config (^6.3.2)
├── pubspec.yaml            # Workspace manifest — dev deps only (melos itself)
├── apps/
│   ├── customer_app/       # Customer-facing Flutter app (active)
│   ├── staff_app/          # Staff app (future)
│   └── driver_app/         # Driver app (future)
└── packages/
    ├── mobile_core/        # AppConfig, AppLogger, AppException hierarchy
    ├── mobile_domain/      # Plain-Dart domain models — no HTTP/storage imports
    ├── mobile_services/    # MobileHttpClient, interceptors, SessionManager, ConnectivityService
    ├── mobile_ui/          # AppTheme, AppColors, AppSpacing, shared widgets
    ├── mobile_l10n/        # AppLocalizations inline map, AppLocale, RTL helpers
    └── mobile_testkit/     # TestAppWrapper, ProviderContainer helpers, fakes
```

## Package Responsibilities

| Package | Owns | Must NOT import |
|---|---|---|
| `mobile_core` | `AppConfig`, `AppLogger`, `AppException` hierarchy, core constants | Any app, any other package |
| `mobile_domain` | Plain-Dart domain models, value objects, no code generation | HTTP packages, storage packages, any app |
| `mobile_services` | `MobileHttpClient` (wraps `http ^1.2.2`), `AuthInterceptor`, `TenantInterceptor`, `LoggingInterceptor`, `RetryInterceptor`, `flutter_secure_storage`, `SessionManager`, `ConnectivityService` | `mobile_ui`, any app |
| `mobile_ui` | `AppTheme`, `AppColors`, `AppSpacing`, `AppTextStyles`, shared widgets (`AppCardWidget`, `AppCustomButtonWidget`, etc.) | `mobile_services`, `mobile_domain`, any app |
| `mobile_l10n` | `AppLocalizations` (inline `_localizedValues` map — no JSON, no code gen), `AppLocale`, `customerLocaleProvider` | `mobile_services`, `mobile_ui`, any app |
| `mobile_testkit` | `TestAppWrapper`, `ProviderContainer` helpers, shared fakes | Any app directly |

## Dependency Direction

```
apps/customer_app ──→ mobile_services ──→ mobile_domain ──→ mobile_core
                  ──→ mobile_ui       ──→ mobile_core
                  ──→ mobile_l10n     ──→ mobile_core
                  ──→ mobile_domain   ──→ mobile_core
                  ──→ mobile_testkit  (test only)
```

Forbidden dependencies:
- Any package importing from `customer_app`, `staff_app`, or `driver_app`
- `mobile_ui` depending on `mobile_services` or `mobile_domain`
- `mobile_domain` importing any network or storage package
- Circular dependency between any two packages

## App Folder Structure

```
apps/customer_app/lib/
  core/
    navigation/          # AppRoute constants, onGenerateRoute, guards
    providers/           # Core DI — MobileHttpClient, session, env providers
    app_shell_controller.dart
  features/
    <feature>/
      data/
        datasources/     # _remote_datasource.dart / _local_datasource.dart
        models/          # Feature-specific DTOs (_model.dart)
        repositories/    # Concrete implementations (_repository.dart)
      domain/            # Entities + use-case abstractions (skip for simple features)
      providers/         # Riverpod notifiers + provider declarations (_provider.dart)
      ui/
        screens/         # _screen.dart
        cards/           # _card.dart
        widgets/         # _widget.dart (interactive) / _vw.dart (display-only)
        dialogs/
```

## Placement Decision Rule

**Put in a shared package when:**
- Reused by 2+ apps
- Foundational (bootstrap, UI tokens, localization, services, testing)
- Clearly generic — no feature-specific logic

**Keep in `customer_app` when:**
- Customer-specific screen composition
- Customer-only route wiring
- Product-flow logic not yet shared by other apps

**Never:**
- Put shared widgets inside `apps/customer_app/lib/` — they belong in `mobile_ui`
- Trap typed DTO mapping inside widget code
- Add utilities in app code that belong in `mobile_core`
- Put UI imports in `mobile_services` or `mobile_domain`

## Melos Workspace Commands

```bash
melos bootstrap   # Link all packages; run after any pubspec.yaml change
melos analyze     # flutter analyze across all packages (zero warnings — CI gate)
melos test        # flutter test in all packages with test/ directories (CI gate)
melos format      # dart format across workspace
melos pub_get     # flutter pub get across workspace
```

Adding a new package:
1. Create `packages/{name}/pubspec.yaml` with correct `name:` field
2. Run `melos bootstrap` to link it
3. Add `package:{name}/{name}.dart` barrel export
4. Wire provider in `core/providers/` in the consuming app

`pubspec_overrides.yaml` files (Melos-generated) are committed in this repo — do not gitignore them.

## File Naming

| Type | Suffix |
|---|---|
| Screen | `_screen.dart` |
| Card widget | `_card.dart` |
| Interactive widget | `_widget.dart` |
| View-only (display) widget | `_vw.dart` |
| Shared app-level widget | `app_*_widget.dart` |
| Repository | `_repository.dart` |
| Provider file | `_provider.dart` |
| Model | `_model.dart` |
| Service | `_service.dart` |
| Remote data source | `_remote_datasource.dart` |
| Local data source | `_local_datasource.dart` |

Do NOT use `_view.dart`, `_repo.dart`, `_controller.dart`, or `_vw.dart` for anything other than display-only widgets.

## Anti-Patterns

Reject these:

* Shared widgets placed inside app folders
* Typed DTO mapping inside widget code
* One-off utilities in app code that belong in `mobile_core`
* UI imports in `mobile_services` or `mobile_domain`
* `_repo.dart`, `_view.dart`, `_controller.dart` naming
* `...WidgetWidget` duplicate suffix
* `go_router` or `auto_route` — routing uses `onGenerateRoute`
* Dio anywhere — HTTP uses `MobileHttpClient` from `mobile_services`
* `supabase_flutter` anywhere in mobile code

## Required Output

When using this skill, state:

1. The area being changed
2. Whether it belongs in app or package — and which package
3. The dependency direction (does it remain one-way?)
4. Any reuse implications for future `staff_app` or `driver_app`

## Validation Checklist

- [ ] Current-state repo structure was checked before applying target-state changes
- [ ] App-vs-package placement is justified
- [ ] Dependency direction remains one-way
- [ ] No shared concern is trapped in `customer_app`
- [ ] No package imports app code
- [ ] File naming follows the approved suffix table
- [ ] `melos bootstrap` runs cleanly after any pubspec change
