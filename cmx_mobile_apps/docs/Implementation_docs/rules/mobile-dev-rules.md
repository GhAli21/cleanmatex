# MOBILE_DEV_RULES.md

You are working on the CleanMateX Flutter mobile monorepo (`cmx_mobile_apps/`).

---

## Workspace

- Managed by **Melos ^6.3.2** — run `melos bootstrap` after any `pubspec.yaml` change
- `melos analyze` and `melos test` must pass before merging
- Each app and package owns its own `pubspec.yaml` — never add deps to the root workspace manifest

---

## Mandatory Rules

- Follow feature-based architecture: `core/`, `features/<name>/data/`, `domain/`, `providers/`, `ui/`
- Use Riverpod (`flutter_riverpod ^2.5.1`) — no Bloc, GetX, MobX, or Provider package
- No API or database calls inside UI widgets
- Flow must be: UI → Provider → Repository → DataSource → `cmx-api`
- Reuse existing widgets before creating new ones (`mobile_ui` catalog first)
- Use `AppTheme`, `AppColors`, `AppSpacing` — never hardcode colors, font sizes, or spacing
- Use `AppLocalizations.of(context)` for all user-facing text (no `!` bang operator)
- Support English and Arabic with RTL-safe layouts — both languages in every commit
- Use strong-typed models only — no `Map<String, dynamic>` flowing through the app
- No code generation: no Freezed, no json_serializable, no build_runner, no `.g.dart` files
- Backend is the source of truth for pricing, workflow, permissions, and finance-critical logic
- Flutter validates input shape only — never enforce final business rules client-side
- Always handle loading, error, empty, and success states — no blank screens
- Routing: use `onGenerateRoute` with `AppRoute` constants — never hard-code route strings inline
- HTTP: use `MobileHttpClient` from `mobile_services` only — never `http`, `dio`, or any HTTP package directly in app or feature code
- Token storage: `flutter_secure_storage` only — never SharedPreferences, Hive, or Riverpod state
- Every API request carries `X-Tenant-Id` via `TenantInterceptor` — non-negotiable
- All network/backend failures map to typed `AppException` subclasses — never leak raw exceptions to UI
- Logging: use `AppLogger` — never `print()` or `debugPrint()`

---

## Architecture Rules

```
apps/customer_app/lib/
  core/
    navigation/        # AppRoute, onGenerateRoute, guards
    providers/         # Core DI providers (http client, session, env)
    app_shell_controller.dart
  features/
    <feature>/
      data/
        datasources/   # remote (HTTP) + local (Hive)
        models/        # feature-specific DTOs
        repositories/  # concrete implementations
      domain/          # entities + use-case abstractions (optional for simple features)
      providers/       # Riverpod notifiers + provider declarations
      ui/
        screens/
        cards/
        widgets/       # interactive (_widget.dart)
        dialogs/
```

- UI widgets must not call repositories or data sources directly
- Providers hold async state via `AsyncNotifier` or `Notifier`
- Repositories abstract whether data comes from network, cache, or mock
- Layer crossing is forbidden: no HTTP import in a widget file, no widget import in a repository

---

## Shared Packages

| Need | Package |
|---|---|
| `AppConfig`, `AppLogger`, `AppException` | `package:mobile_core/mobile_core.dart` |
| Domain models | `package:mobile_domain/mobile_domain.dart` |
| `MobileHttpClient`, session, interceptors | `package:mobile_services/mobile_services.dart` |
| `AppTheme`, `AppColors`, shared widgets | `package:mobile_ui/mobile_ui.dart` |
| `AppLocalizations`, `AppLocale` | `package:mobile_l10n/mobile_l10n.dart` |
| Test helpers, `TestAppWrapper` | `package:mobile_testkit/mobile_testkit.dart` |

---

## State Rules

- Use `Notifier` for complex mutable state with actions
- Use `AsyncNotifier` for providers that start with an async load
- Use `FutureProvider` for read-only async data
- Use `StateProvider` for simple primitive UI state only (tab index, toggle)
- Use `setState` only for tiny local visual state — never for data loading or shared state
- Prefer `autoDispose` on screen-scoped providers to avoid memory leaks

---

## UI Rules

- Keep widgets small and composable — extract repeated UI immediately
- Use `const` constructors and `super.key` everywhere
- Use `ConsumerWidget` / `ConsumerStatefulWidget` — never `StatefulWidget + Consumer` wrapper
- Dark mode support is mandatory — test every new screen in both light and dark mode
- Keep Arabic layout quality equal to English layout quality

---

## Form Rules

- Basic field validation in Flutter; authoritative validation on backend
- Preserve typed input on validation failure — never clear the form on error
- Prevent duplicate submit taps while a request is in progress

---

## Networking and Sync Rules

- Paginate large lists from the start
- Debounce search input before triggering API calls
- Handle offline/retry explicitly — offline does not grant authority to finalize backend state

---

## Behavior Rules

Before coding:
1. Summarize the feature
2. List impacted files
3. Explain the approach
4. Then write code

If backend contracts are missing:
- State what is assumed
- Scaffold safely
- Do not fake a complete integration

---

## Output Format

Return results in this order:
1. Summary
2. Architecture impact
3. Files to create/update
4. Code
5. Localization keys (EN + AR)
6. Backend assumptions
7. Tests
