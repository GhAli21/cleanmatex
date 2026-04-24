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

## Stack Facts (Actual)

| Concern | Implementation |
|---|---|
| State management | `flutter_riverpod ^2.5.1` — no Bloc, GetX, MobX, Provider |
| Navigation | `onGenerateRoute` + `AppRoute` constants — NOT `go_router` or `auto_route` |
| HTTP | `MobileHttpClient` from `mobile_services` (wraps `http ^1.2.2`) — NOT Dio |
| Secure storage | `flutter_secure_storage ^9.2.2` — tokens only here |
| Connectivity | `connectivity_plus ^6.1.5` via `ConnectivityService` in `mobile_services` |
| Monorepo | Melos `^6.3.2` |
| Code generation | **None** — all code is manual (no Freezed, no json_serializable, no build_runner) |
| Supabase | **Banned from mobile** — Supabase is internal to `cmx-api` only |

## Core Rules

1. Flutter collects input and renders state; backend owns business-rule authority.
2. Riverpod is the only state management approach.
3. Use typed models and typed service boundaries only — no `Map<String, dynamic>` flowing through providers or widgets.
4. Repositories isolate remote and local data concerns from widgets. Raw HTTP exceptions must not escape repositories.
5. Configuration loads from `--dart-define` at build time via `AppConfig` in `mobile_core`. `AppConfig` throws if required values are missing in production.
6. Use `AppLogger` from `mobile_core`; never commit `print()` or `debugPrint()`.

## Architecture Flow

```
UI → Provider → Repository → DataSource → MobileHttpClient → cmx-api
```

- Widgets call providers only — never repositories or data sources directly
- Providers hold async state via `AsyncNotifier` or `Notifier`
- Repositories translate datasource errors into typed `AppException` subclasses
- `MobileHttpClient` applies `AuthInterceptor`, `TenantInterceptor`, `LoggingInterceptor`, and `RetryInterceptor`

## Routing and Bootstrap

- All route names are `static const String` in `AppRoute` — never hard-code route strings inline
- `onGenerateRoute` in `core/navigation/app_router.dart` applies guards via `customerSessionFlowProvider` and `tenantProvider`
- Bootstrap sequence: splash → session restore → tenant resolution → home or auth entry
- Use `CustomTransitionPage` for RTL-aware transitions (slide left in AR, right in EN)
- Never use `GoRouter`, `go_router`, or `auto_route`

## Provider Patterns

```dart
// Preferred for complex mutable state with actions
class OrdersNotifier extends Notifier<OrdersState> {
  @override
  OrdersState build() => const OrdersState();

  Future<void> load() async {
    state = state.copyWith(isLoading: true);
    try {
      final result = await ref.read(customerOrdersRepositoryProvider).getOrders();
      state = state.copyWith(orders: result, isLoading: false);
    } catch (_) {
      state = state.copyWith(isLoading: false);
      rethrow;
    }
  }
}
final ordersNotifierProvider = NotifierProvider<OrdersNotifier, OrdersState>(OrdersNotifier.new);

// For providers starting with an async load
class OrderDetailNotifier extends AsyncNotifier<OrderDetailModel> {
  @override
  Future<OrderDetailModel> build() async =>
      throw UnimplementedError('call load(orderId)');

  Future<void> load(String orderId) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => ref.read(customerOrdersRepositoryProvider).getOrderDetail(orderId),
    );
  }
}

// Prefer autoDispose for screen-scoped providers
final orderDetailProvider =
    AsyncNotifierProvider.autoDispose<OrderDetailNotifier, OrderDetailModel>(
  OrderDetailNotifier.new,
);
```

Provider naming: `{noun}{Verb}Provider` — e.g., `customerSessionFlowProvider`, `orderDetailProvider`.
Banned names: `dataProvider`, `mainProvider`, `tempProvider`, `infoProvider`.

Implement a `ProviderObserver` in `main.dart` to log all `AsyncValue.error` states via `AppLogger`.

Use `ref.watch` for reactive data; `ref.read` inside callbacks/event handlers only.
Use `ref.select` to avoid rebuilds when only one field of a state object changes.

## Error Handling

Map all failures into the typed `AppException` hierarchy from `mobile_core`:

```
AppException (abstract)
├── NetworkException
│   ├── TimeoutException
│   ├── NoConnectionException
│   └── ServerException          — 5xx
├── AuthException
│   ├── UnauthorizedException    — 401
│   └── ForbiddenException       — 403
├── ValidationException          — 422
├── NotFoundException            — 404
├── BusinessRuleException        — backend rejected with business reason
├── StorageException             — Hive read/write failures
└── UnexpectedException          — catch-all
```

Each exception carries: `messageKey` (i18n key for UI), `code` (machine-readable), `originalError` (logging only).

In providers:
```dart
// Preferred — AsyncValue.guard wraps thrown exceptions in AsyncError
state = await AsyncValue.guard(() => repository.getOrders());

// Manual
try {
  final result = await repository.getOrders();
  state = state.copyWith(orders: result);
} on AppException catch (e) {
  AppLogger.error('load failed', error: e);
  rethrow;
}
```

- Repositories: catch raw HTTP exceptions, rethrow as `AppException`
- Providers: catch `AppException`, surface `AsyncValue.error`
- Widgets: no `try/catch` — all error handling in providers or repositories
- Silent `catch` blocks are forbidden — always log or rethrow

## Token Storage and Session

- `flutter_secure_storage` only — Android Keystore / iOS Keychain backed
- Key naming: `cmx_access_token`, `cmx_refresh_token`
- Never store tokens in Riverpod state, SharedPreferences, or Hive
- `AuthInterceptor` triggers refresh on 401 and replays the original request
- Session hard expiry: force re-auth after 7 days regardless of refresh token state

## File Naming

| Type | Suffix | Example |
|---|---|---|
| Screen | `_screen.dart` | `customer_orders_screen.dart` |
| Card widget | `_card.dart` | `customer_order_summary_card.dart` |
| Interactive widget | `_widget.dart` | `customer_phone_text_field_widget.dart` |
| View-only (display) widget | `_vw.dart` | `order_status_badge_vw.dart` |
| Shared app-level widget | `app_*_widget.dart` | `app_custom_button_widget.dart` |
| Repository | `_repository.dart` | `customer_orders_repository.dart` |
| Provider file | `_provider.dart` | `tenant_provider.dart` |
| Model | `_model.dart` | `order_summary_model.dart` |
| Service | `_service.dart` | `order_tracking_service.dart` |
| Remote data source | `_remote_datasource.dart` | `orders_remote_datasource.dart` |
| Local data source | `_local_datasource.dart` | `orders_local_datasource.dart` |

`_vw.dart` — purely display widgets that take data and render it with no user interaction or internal state.
`_widget.dart` — interactive or stateful UI components.
Do NOT use `_view.dart`, `_repo.dart`, `_controller.dart`.

## Melos

- `melos bootstrap` — run after any `pubspec.yaml` change
- `melos analyze` — zero warnings required (CI gate)
- `melos test` — all packages (CI gate)
- `melos format` — `dart format` across workspace
- Never add dependencies to the root workspace `pubspec.yaml`

## Anti-Patterns

Reject these:

* `onPressed` directly calling `MobileHttpClient` or any API client
* Widget-local business decisions
* Route handling mixed with backend payload parsing
* Loosely typed models or `Map<String, dynamic>` flowing past the repository layer
* `go_router`, `auto_route`, or hardcoded route strings
* `supabase_flutter` anywhere in mobile code
* Dio anywhere in mobile code — use `MobileHttpClient`
* `_view.dart` or `_repo.dart` naming — use `_vw.dart` and `_repository.dart`
* `print()` / `debugPrint()` in committed code

## Required Output

When using this skill, state:

1. Bootstrap/routing/session flow being implemented
2. Provider/repository/service boundaries
3. Model and exception strategy
4. Validation path for the change

## Validation Checklist

- [ ] No business logic placed in widgets
- [ ] Provider/repository/service boundaries are clear
- [ ] Typed models and `AppException` subclasses used throughout
- [ ] Session handling is restart-safe
- [ ] Config uses `AppConfig` loaded from `--dart-define`
- [ ] `AppLogger` used — no `print()` / `debugPrint()`
- [ ] File naming follows the approved suffix table
- [ ] `melos analyze` passes with zero warnings
