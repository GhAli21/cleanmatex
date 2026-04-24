---
version: v3.0.0
last_updated: 2026-04-24
author: CleanMateX Team
---

# Flutter Development Rules

**CRITICAL**: Follow these rules for all Flutter mobile app development in CleanMateX.

---

## Architecture Overview

CleanMateX mobile is a **Dart monorepo** under `cmx_mobile_apps/`. Apps consume shared packages; packages never import from apps.

```
cmx_mobile_apps/
├── apps/
│   └── customer_app/          # Customer-facing Flutter app
│       └── lib/
│           ├── main.dart
│           ├── app.dart        # MaterialApp root (ConsumerStatefulWidget)
│           ├── core/
│           │   ├── app_shell_controller.dart   # Session flow + locale notifiers
│           │   ├── navigation/
│           │   │   ├── app_route.dart          # Route name constants
│           │   │   └── app_router.dart         # onGenerateRoute + guards
│           │   └── providers/
│           │       ├── app_dependencies.dart
│           │       ├── core_env_providers.dart
│           │       ├── customer_api_client_providers.dart
│           │       ├── network_providers.dart
│           │       └── session_manager_provider.dart
│           └── features/
│               └── {feature}/
│                   ├── data/
│                   │   ├── datasources/       # remote (HTTP) + local (Hive)
│                   │   ├── models/            # feature-specific DTOs
│                   │   └── repositories/      # concrete implementations
│                   ├── domain/                # entities + use-case abstractions
│                   ├── providers/
│                   └── ui/
│                       ├── screens/
│                       ├── cards/
│                       ├── widgets/
│                       └── dialogs/
└── packages/
    ├── mobile_core/       # AppConfig, AppLogger, AppException
    ├── mobile_domain/     # Plain-Dart models (no code generation)
    ├── mobile_services/   # HTTP client, API services, session storage
    ├── mobile_ui/         # AppTheme, AppColors, shared widgets
    ├── mobile_l10n/       # AppLocalizations, AppLocale
    └── mobile_testkit/    # Test helpers, TestAppWrapper
```

### Layer Flow

```
UI → Providers → Repository → Data Source (Remote via cmx-api | Local via Hive)
```

- UI widgets call providers only — never repositories or data sources directly
- Providers hold async state via `AsyncNotifier` or `Notifier`
- Repositories abstract whether data comes from network, cache, or mock
- `RemoteDataSource` uses the HTTP client to call `cmx-api`; `LocalDataSource` uses Hive
- Layer crossing is forbidden: no HTTP import in a widget file, no widget import in a repository

### Dependency Direction

```
apps/customer_app  ──→ mobile_services ──→ mobile_domain ──→ mobile_core
                   ──→ mobile_ui       ──→ mobile_core
                   ──→ mobile_l10n     ──→ mobile_core
                   ──→ mobile_domain   ──→ mobile_core
                   ──→ mobile_testkit  (test only)
```

**Forbidden dependencies:**
- Any package depending on app code
- `mobile_ui` depending on `mobile_services` or `mobile_domain`
- `mobile_domain` importing any network or storage package
- Circular dependency between any two packages

---

## UI/UX Goals

Every screen and widget must satisfy all of these:

- **Modern, clean UI** — clear visual hierarchy, minimal noise, purposeful use of space; optimize for speed, clarity, low tap count, and low cognitive load
- **Multi-language** — every user-visible string goes through `AppLocalizations`; EN + AR required at all times — never EN-first, AR later
- **RTL-aware** — layouts, icons, and alignment must work correctly in both LTR and RTL; Arabic layout quality must equal English layout quality
- **Responsive** — phone-first at 360dp minimum width; never break on 7-inch+ screens; use `AppBreakpoints` / `ResponsiveLayoutBuilder` — never raw `MediaQuery.of(context).size.width` comparisons
- **Theming consistency** — fonts, colors, spacing, corner radii, and elevation come exclusively from `AppTheme`, `AppColors`, `AppSpacing`, and `AppTextStyles`; never hardcoded
- **Dark mode** — support `AppTheme.light()` and `AppTheme.dark()`; always use `Theme.of(context).colorScheme` / `textTheme`; test every new screen in both modes
- **Offline awareness** — screens that depend on network data must handle the offline/error state explicitly; never show blank screens or raw exception text
- **Reusability** — extract repeated UI into shared widgets in `mobile_ui`; use the standard widget library before building new components

---

## Code Generation Policy

**CRITICAL — NO EXCEPTIONS:**

- ❌ **NO Freezed** — use plain Dart classes with manual `copyWith`
- ❌ **NO json_serializable** — implement `fromJson`/`toJson` manually
- ❌ **NO build_runner** — no generated files, ever
- ❌ **NO `.g.dart` files** — `part 'model.g.dart'`, `@JsonSerializable`, `@freezed` are all banned
- ❌ **NO `built_value`, `mobx_codegen`, `injectable` generators**
- ✅ All code must be explicit, visible, and human-readable

`equatable` is acceptable for equality — it does not require code generation.

**Rationale:** Manual models are easier to debug, have no hidden behavior, produce better AI-assisted code, have fewer version conflicts, and give full control over parsing logic. The extra boilerplate is the accepted trade-off.

---

## State Management: Riverpod 2.x (Mandatory)

Use `flutter_riverpod` only. No Bloc, GetX, MobX, Provider package, or any other state management.

`setState` is allowed **only** for tiny local UI state: tab selection, local expand/collapse, temporary visual toggles. Never for data loading, entity lists, submission flows, or shared state.

### Notifier (preferred for complex state)

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

@immutable
class OrdersState {
  const OrdersState({this.orders = const [], this.isLoading = false});
  final List<OrderSummaryModel> orders;
  final bool isLoading;

  OrdersState copyWith({List<OrderSummaryModel>? orders, bool? isLoading}) {
    return OrdersState(
      orders: orders ?? this.orders,
      isLoading: isLoading ?? this.isLoading,
    );
  }
}

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

final ordersNotifierProvider = NotifierProvider<OrdersNotifier, OrdersState>(
  OrdersNotifier.new,
);
```

### AsyncNotifier (for providers that start with an async load)

```dart
class OrderDetailNotifier extends AsyncNotifier<OrderDetailModel> {
  @override
  Future<OrderDetailModel> build() async {
    throw UnimplementedError('Call load(orderId) after creation');
  }

  Future<void> load(String orderId) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => ref.read(customerOrdersRepositoryProvider).getOrderDetail(orderId),
    );
  }
}

final orderDetailProvider =
    AsyncNotifierProvider<OrderDetailNotifier, OrderDetailModel>(
  OrderDetailNotifier.new,
);
```

### FutureProvider (read-only async data)

```dart
final ordersProvider = FutureProvider<List<OrderSummaryModel>>((ref) async {
  return ref.read(customerOrdersRepositoryProvider).getOrders();
});
```

### StateProvider (simple primitive state only)

```dart
// Only for simple toggles / selections — not business state
final selectedTabProvider = StateProvider<int>((ref) => 0);
```

### AutoDispose

Prefer `autoDispose` on providers scoped to a single screen to avoid memory leaks:

```dart
final orderDetailProvider =
    AsyncNotifierProvider.autoDispose<OrderDetailNotifier, OrderDetailModel>(
  OrderDetailNotifier.new,
);
```

### ProviderObserver

Implement a `ProviderObserver` in `main.dart` to log all `AsyncValue.error` states via `AppLogger`. This is the standard way to catch unhandled provider errors.

---

## Provider Naming

Format: `{noun}{Verb}Provider` — describes the subject and what it does.

| Pattern | Example |
|---|---|
| `NotifierProvider` | `customerSessionFlowProvider` |
| `AsyncNotifierProvider` | `orderDetailProvider` |
| `FutureProvider` | `ordersProvider` |
| `StreamProvider` | `orderUpdatesStreamProvider` |
| `StateProvider` | `selectedTabProvider` |
| Service/repo | `customerOrdersRepositoryProvider` |

**Forbidden names:** `dataProvider`, `mainProvider`, `tempProvider`, `infoProvider`

---

## Widgets

### Use ConsumerWidget / ConsumerStatefulWidget

```dart
// ✅ Correct: ConsumerWidget (reads providers)
class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(ordersProvider);
    return ordersAsync.when(
      data: (orders) => _OrderList(orders: orders),
      loading: () => const AppLoadingIndicatorWidget(),
      error: (e, _) => const AppErrorWidget(messageKey: 'orders.errorTitle'),
    );
  }
}

// ✅ Correct: ConsumerStatefulWidget for local UI state + providers
class CustomerLoginEntryScreen extends ConsumerStatefulWidget {
  const CustomerLoginEntryScreen({super.key});

  @override
  ConsumerState<CustomerLoginEntryScreen> createState() =>
      _CustomerLoginEntryScreenState();
}

// ❌ Wrong: StatefulWidget + Consumer wrapper
```

### Const Constructors

Always use `const` constructors and `super.key`:

```dart
// ✅
class OrderCard extends StatelessWidget {
  const OrderCard({super.key, required this.order});
  final OrderSummaryModel order;
}

// ❌ — old Key? key style
class OrderCard extends StatelessWidget {
  OrderCard({Key? key, required this.order}) : super(key: key);
}
```

### Extract Reusable Widgets

Never inline complex subtrees. Extract to named widget classes:

```dart
// ✅
class _OrderList extends StatelessWidget {
  const _OrderList({required this.orders});
  final List<OrderSummaryModel> orders;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: orders.length,
      itemBuilder: (context, i) => OrderSummaryCard(order: orders[i]),
    );
  }
}

// ❌ Local function widget — extract to a class instead
Widget _buildOrderList(List<OrderSummaryModel> orders) => ...
```

---

## Screen States

Every non-trivial screen must handle all applicable states — no blank screens, no raw exception text:

| State | Required |
|---|---|
| Initial / loading | Always |
| Success (data) | Always |
| Empty | When the data set can be empty |
| Recoverable error | Always — with retry |
| Offline | When screen requires network data |

```dart
ordersAsync.when(
  data: (orders) => orders.isEmpty
      ? const _EmptyState()
      : _OrderList(orders: orders),
  loading: () => const AppLoadingIndicatorWidget(),
  error: (e, _) {
    final key = e is AppException ? e.messageKey : 'common.remoteRequestError';
    return AppErrorWidget(
      messageKey: key,
      onRetry: () => ref.invalidate(ordersProvider),
    );
  },
);
```

---

## Shared Packages Usage

Always import from the shared packages — never redefine what already exists there.

| Need | Import from |
|---|---|
| `AppConfig`, `AppLogger`, `AppException` | `package:mobile_core/mobile_core.dart` |
| Domain models (`OrderSummaryModel`, `TenantModel`, …) | `package:mobile_domain/mobile_domain.dart` |
| `MobileHttpClient`, `AuthApiService`, `SessionManager` | `package:mobile_services/mobile_services.dart` |
| `AppTheme`, `AppColors`, `AppCardWidget`, `AppHeaderWidget` | `package:mobile_ui/mobile_ui.dart` |
| `AppLocalizations`, `AppLocale` | `package:mobile_l10n/mobile_l10n.dart` |
| Test helpers, `TestAppWrapper` | `package:mobile_testkit/mobile_testkit.dart` |

---

## Data Models

All models live in `packages/mobile_domain/`. Plain Dart classes — no code generation.

```dart
class OrderSummaryModel {
  const OrderSummaryModel({
    required this.id,
    required this.status,
    required this.garmentCount,
    this.createdAt,
  });

  final String id;
  final String status;
  final int garmentCount;
  final DateTime? createdAt;

  factory OrderSummaryModel.fromJson(Map<String, Object?> json) {
    return OrderSummaryModel(
      id: json['id'] as String,
      status: json['status'] as String,
      garmentCount: (json['garment_count'] as num).toInt(),  // num → int safely
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
    );
  }

  Map<String, Object?> toJson() => {
        'id': id,
        'status': status,
        'garment_count': garmentCount,
        if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      };

  OrderSummaryModel copyWith({
    String? id,
    String? status,
    int? garmentCount,
    DateTime? createdAt,
  }) {
    return OrderSummaryModel(
      id: id ?? this.id,
      status: status ?? this.status,
      garmentCount: garmentCount ?? this.garmentCount,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OrderSummaryModel &&
          other.id == id &&
          other.status == status &&
          other.garmentCount == garmentCount &&
          other.createdAt == createdAt;

  @override
  int get hashCode => Object.hash(id, status, garmentCount, createdAt);

  @override
  String toString() =>
      'OrderSummaryModel(id: $id, status: $status, garmentCount: $garmentCount)';
}
```

**Model rules:**
- Always `const` constructor
- Always implement `==`, `hashCode`, `toString`, `copyWith`, `fromJson`, `toJson`
- Use `Map<String, Object?>` (not `dynamic`) for JSON maps
- Cast explicitly: `as String`, `as String?` — no bang operator on JSON fields
- Convert `num` to `int`/`double` safely: `(json['x'] as num).toDouble()`
- Keep JSON key names explicit — do not rely on magic field naming
- `equatable` is an acceptable equality alternative to manual `==`/`hashCode`
- UI must not know backend JSON structure — parse at the repository/data layer only
- Do not pass raw `Map<String, dynamic>` through the app — use typed models

### DTO vs Entity

Separate DTOs from domain entities when complexity justifies it:
- **DTOs** (`data/models/`) — map directly to API response shapes
- **Entities** (`domain/`) — represent business objects after any transformation
- For simple features, a single model class is fine; do not over-engineer

---

## Data Boundaries

- Parse API JSON at the repository/data layer — never in providers or widgets
- Repositories translate datasource errors into typed `AppException` — never let raw HTTP exceptions escape
- UI must not know backend JSON field names
- Avoid duplicating identical request logic across features

---

## Internationalization (i18n)

### AppLocalizations (inline map — no JSON files, no code generation)

All strings live in `packages/mobile_l10n/lib/src/app_localizations.dart` in the `_localizedValues` map.

```dart
// ✅ Adding a new string: edit _localizedValues in app_localizations.dart
'en': {
  'myFeature.title': 'My Feature',
  'myFeature.subtitle': 'Short description here.',
  'myFeature.action': 'Do it',
  'myFeature.errorTitle': 'Something went wrong',
  'myFeature.paramExample': 'Hello {count}',
},
'ar': {
  'myFeature.title': 'ميزتي',
  'myFeature.subtitle': 'وصف مختصر هنا.',
  'myFeature.action': 'تنفيذ',
  'myFeature.errorTitle': 'حدث خطأ ما',
  'myFeature.paramExample': 'مرحباً {count}',
},
```

**Key naming:** `{feature}.{component}.{purpose}` — e.g., `orders.list.emptyState`, `auth.login.submitButton`

**Rules:**
- Every new key must include both EN and AR in the same commit — no EN-only PRs
- Arabic keys must not be English-length assumptions — Arabic text is often longer
- Avoid string concatenation for translated content — use `{count}` placeholders
- Dates, numbers, and currencies must be localized properly
- Error messages shown to users must map to localization keys — never show raw exception text

### Using translations in widgets

```dart
final l10n = AppLocalizations.of(context);
Text(l10n.text('myFeature.title'))
Text(l10n.textWithArg('myFeature.paramExample', userName))
```

### RTL

`AppLocalizations` exposes `textDirection`. The `MaterialApp` in `app.dart` passes `locale` from `customerLocaleProvider`; RTL is applied automatically by Flutter's `Directionality` widget.

Do **not** hard-code `TextDirection.rtl` in individual widgets unless overriding a specific layout.

All AR content must be explicitly marked `TextDirection.rtl` — never auto-detected from content alone.

```dart
final dir = AppLocalizations.of(context).textDirection;
```

### Locale switching

```dart
ref.read(customerLocaleProvider.notifier).toggleLocale();
```

---

## HTTP / API Layer

### HTTP Client

All HTTP goes through `MobileHttpClient` from `mobile_services`. Never use `http`, `dio`, or any HTTP package directly in app or feature code.

`supabase_flutter` is **banned** from all mobile apps and packages — Supabase is internal to `cmx-api`.

```dart
// In a service (packages/mobile_services)
class OrderTrackingService {
  OrderTrackingService({required MobileHttpClient httpClient})
      : _client = httpClient;

  final MobileHttpClient _client;

  Future<List<OrderSummaryModel>> getOrders({
    required String tenantOrgId,
    required String accessToken,
  }) async {
    final json = await _client.getJson(
      '/v1/customer/orders',
      headers: {'Authorization': 'Bearer $accessToken'},
      queryParameters: {'tenant_org_id': tenantOrgId},
    );
    final list = json['data'] as List<Object?>;
    return list
        .map((e) => OrderSummaryModel.fromJson(e as Map<String, Object?>))
        .toList();
  }
}
```

### Required Interceptors

Every HTTP client must apply these interceptors in order:

| Order | Interceptor | Responsibility |
|---|---|---|
| 1 | `AuthInterceptor` | Attaches `Authorization: Bearer {token}`; triggers refresh on 401; forces logout if refresh fails |
| 2 | `TenantInterceptor` | Injects `X-Tenant-Id` header from active `TenantSession` on every request |
| 3 | `LoggingInterceptor` | Logs request/response in **debug builds only**; omits sensitive fields in staging/prod |
| 4 | `RetryInterceptor` | Retries idempotent GET requests up to 3× on network errors with exponential backoff |

### Error Mapping

Map all network/backend failures into the typed `AppException` hierarchy — never leak raw exceptions to UI:

| Condition | Exception Type |
|---|---|
| No internet | `NoConnectionException` |
| Request timeout | `TimeoutException` |
| 401 Unauthorized | `UnauthorizedException` |
| 403 Forbidden | `ForbiddenException` |
| 422 Validation | `ValidationException` |
| 404 Not found | `NotFoundException` |
| 5xx Server error | `ServerException` |
| Business rule rejection | `BusinessRuleException` |
| Anything else | `UnexpectedException` |

### Repository pattern (in app)

Repositories live in `features/{feature}/data/repositories/` and depend on services from `mobile_services`.

```dart
class CustomerOrdersRepository {
  CustomerOrdersRepository({required OrderTrackingService trackingService})
      : _trackingService = trackingService;

  final OrderTrackingService _trackingService;

  Future<List<OrderSummaryModel>> getOrders() {
    return _trackingService.getOrders(...);
  }
}

// Provider wiring in core/providers/customer_api_client_providers.dart
final customerOrdersRepositoryProvider = Provider<CustomerOrdersRepository>(
  (ref) => CustomerOrdersRepository(
    trackingService: OrderTrackingService(
      httpClient: ref.read(customerApiHttpClientProvider),
    ),
  ),
);
```

### API Contract Discipline

- Respect backend contracts exactly — do not invent fields that the backend does not return
- Do not silently ignore required fields in responses
- If a field is nullable, handle it explicitly — never assume it will always be present
- If an API contract changes, update models, repositories, and affected UI together

### Pagination and Search

- Paginate large lists — design list screens with pagination from the start
- Debounce search input before triggering API calls
- Avoid eager loading of large datasets
- Keep filter/sort state inside providers, not inline widget state

### File and Media Uploads

- Validate file size and type before upload
- Compress images where appropriate
- Show upload progress if the user must wait
- Handle cancellation cleanly
- Do not block the entire UI during an upload

---

## Token Storage and Session

- Store tokens in `flutter_secure_storage` **only** — Android Keystore / iOS Keychain backed
- Never store tokens in Riverpod state, SharedPreferences, or Hive
- Key naming: `cmx_access_token`, `cmx_refresh_token`
- Token refresh: `AuthInterceptor` triggers refresh on 401 and replays the original request
- Session hard expiry: force re-auth after 7 days regardless of refresh token state
- Never log tokens, passwords, OTPs, or sensitive PII — not in debug, not in prod

---

## Multi-Tenant Isolation

Every API request must carry `X-Tenant-Id` — enforced by `TenantInterceptor`. This is non-negotiable.

- All data providers must `ref.watch(tenantSessionProvider)` before fetching
- Hive box naming is namespaced per tenant: `{tenantOrgId}_{purpose}` — prevents cross-tenant data leakage on shared devices
- Feature visibility may depend on plan flags or role — disabled features must fail gracefully
- `cmx-api` enforces actual tenant isolation via Supabase RLS server-side; `TenantInterceptor` is defense-in-depth only
- Never construct API paths with hardcoded tenant identifiers — always read from `TenantSession`

---

## Navigation

### Router

Use `onGenerateRoute` with `AppRoute` constants in `core/navigation/app_router.dart`. Never use `go_router`, `auto_route`, or hardcoded route strings inline.

### Route constants

All route names are `static const String` fields in `AppRoute`. Never hard-code route strings inline.

```dart
abstract final class AppRoute {
  static const String splash = '/';
  static const String home = '/home';
  static const String orders = '/orders';
}
```

### Route guards

`onGenerateRoute` checks `customerSessionFlowProvider` and `tenantProvider` — unauthenticated or unresolved-tenant users are redirected to the appropriate entry screen.

### RTL-aware transitions

Use `CustomTransitionPage`: slide from left in AR (`TextDirection.rtl`), from right in EN.

The router's error builder shows a branded error screen — never Flutter's default red screen.

### Deep links

Validate all deep link paths against known `AppRoute` constants — reject unknown schemes.

---

## UI Components

Always check `mobile_ui` before building a new widget. All reusable widgets follow the `app_*_widget.dart` naming convention. All imports are from `package:mobile_ui/mobile_ui.dart`.

### Standard Widget Library

| Widget | Status | Purpose |
|---|---|---|
| `AppCardWidget` | ✅ exists | Elevated card shell with consistent padding/radius |
| `AppHeaderWidget` | ✅ exists | Screen / section header with title + optional subtitle |
| `AppCustomButtonWidget` | ✅ exists | Primary/secondary action button |
| `AppLoadingIndicatorWidget` | ✅ exists | Full-screen or inline loading state |
| `AppErrorWidget` | ✅ exists | Error state with message key + optional retry |
| `AppTextFieldWidget` | planned | Standard text input with label, hint, and validation |
| `AppDropdownWidget` | planned | Dropdown selector with label and consistent styling |
| `AppCustomDateFieldWidget` | planned | Date input field (typed entry) |
| `AppDatePickerButtonWidget` | planned | Tap-to-open calendar date picker |
| `AppCheckboxListTileWidget` | planned | Checkbox row with label and optional subtitle |
| `AppSwitchListTileWidget` | planned | Toggle/switch row with label |

**Rule**: When a planned widget is needed, implement it in `mobile_ui` first, then consume it — do not build a one-off inline version.

New shared widgets must be generic enough for 2+ use cases — no feature-specific logic in `mobile_ui`.

### Design Tokens

All from `package:mobile_ui/mobile_ui.dart`:

- `AppTheme.light()` / `AppTheme.dark()` — MaterialApp theme
- `AppColors.*` — color palette including dark variants
- `AppSpacing.*` — spacing scale: `xs=4`, `sm=8`, `md=16`, `lg=24`, `xl=32`, `xxl=48`
- `AppTextStyles.*` — typography

Theme uses **Material 3** (`useMaterial3: true`). Always use `Theme.of(context).colorScheme` and `Theme.of(context).textTheme` — never hardcode colors, font sizes, or spacing values.

Use Flutter `ThemeExtension` for CleanMateX-specific tokens (e.g., order status colors) — not ad-hoc inline colors.

### Responsive Layout

Use `AppBreakpoints` and `ResponsiveLayoutBuilder` from `mobile_ui` for all layout branching. Never use raw `MediaQuery.of(context).size.width` comparisons directly.

| Breakpoint | Width | Devices |
|---|---|---|
| `mobile` | < 600dp | Phones |
| `tablet` | 600dp – 1024dp | Tablets, large phones landscape |
| `desktop` | > 1024dp | Large tablets, foldables |

```dart
// Multi-layout
ResponsiveLayoutBuilder(
  mobile: (_) => const _MobileLayout(),
  tablet: (_) => const _TabletLayout(),
)

// Single-value resolution
LayoutBuilder(
  builder: (context, constraints) {
    final columns = AppBreakpoints.resolve<int>(
      constraints.maxWidth,
      mobile: 1,
      tablet: 2,
      desktop: 3,
    );
    return GridView.count(crossAxisCount: columns);
  },
)
```

Mobile layout is mandatory. Tablet and desktop are optional enhancements. Breakpoint thresholds (600dp, 1024dp) are locked — do not redefine them per-screen.

---

## Forms

- Validate client-side for obvious input errors; backend is the authority for business rules
- Preserve typed input on validation failure — never clear the form on error
- Prevent duplicate submits while a request is in progress
- Show field-level validation feedback when useful
- Split long forms into sections or steps
- Rate-limit and error-recover: show clear retry paths when submission fails

---

## Environment and Config

- `AppConfig` in `mobile_core` reads all values from `--dart-define` at build time
- Never hardcode base URLs, API keys, or secrets in source
- Never load config from runtime `.env` files
- Three environments: `DEV`, `STAGING`, `PROD` — controlled by `APP_ENV` dart-define
- `AppConfig` must throw if a required config value is missing in production

---

## Security

- Never hardcode secrets, tokens, private keys, or credentials in source
- Never log tokens, passwords, OTPs, payment data, or full phone numbers — in any environment
- Token storage: `flutter_secure_storage` only
- PROD builds must use `--obfuscate --split-debug-info`
- Use `FLAG_SECURE` (Android) on screens displaying payment or PII data
- UI hiding is not security — respect backend authorization as the authority
- Handle unauthorized (401) and expired sessions cleanly — force re-auth, never silently fail

---

## Error Handling

### AppException Hierarchy

```
AppException (abstract)                    — in mobile_core
├── NetworkException
│   ├── TimeoutException
│   ├── NoConnectionException
│   └── ServerException                    — 5xx
├── AuthException
│   ├── UnauthorizedException              — 401
│   └── ForbiddenException                 — 403
├── ValidationException                    — 422
├── NotFoundException                      — 404
├── BusinessRuleException                  — backend rejected with business reason
├── StorageException                       — Hive read/write failures
└── UnexpectedException                    — catch-all
```

Each exception carries: `messageKey` (i18n key shown to user), `code` (machine-readable), `originalError` (nullable, for logging only).

### Contracts

- Repositories: never let raw HTTP exceptions escape — always catch and rethrow as `AppException`
- Providers: catch `AppException`, surface `AsyncValue.error(exception, stack)` — UI renders from exception type
- Widgets: **no `try/catch` in widget code** — all error handling in providers or repositories
- Silent `catch` blocks are forbidden — always log or rethrow
- `AppErrorWidget` renders different UI per exception type (network vs auth vs validation)

### In providers

```dart
// AsyncValue.guard catches and wraps in AsyncError
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

---

## Logging

Use `AppLogger` from `mobile_core` in all app and package code. Never use `print` or `debugPrint`.

```dart
AppLogger.info('CustomerApp: env=${config.appEnv}');
AppLogger.error('load failed', error: e, stackTrace: st);
```

In package-internal code where `AppLogger` is not yet wired, use Dart's `developer.log` as the fallback:

```dart
import 'dart:developer';
log('debug value: $value', name: 'OrderTrackingService');
```

**Log level policy:**

| Environment | Active levels |
|---|---|
| DEV | All (debug and above) |
| STAGING | info and above |
| PROD | warning and above — no PII |

**Must always log:** provider state errors (via `ProviderObserver`), `AppException` with stack trace, auth events, offline queue operations.

**Must never log in any environment:** tokens, passwords, OTPs, payment data, full phone numbers, full request bodies with PII.

---

## Offline and Connectivity

- All three apps must handle network unavailability — no crashes, no blank screens
- `ConnectivityService` in `mobile_services` exposes `isOnline` and a `connectivityChanges()` stream to all providers
- Preserve form input during failures — never discard user work on a temporary network failure
- Always provide a retry path from error states
- For critical actions that must work offline: queue the action and sync on reconnect
- Show sync/pending state clearly when queued actions are waiting to be sent
- Offline does not grant authority to finalize backend state — queued actions are intent, not truth

---

## Naming Conventions

### Files

| Type | Suffix | Example |
|---|---|---|
| Screen | `_screen.dart` | `customer_orders_screen.dart` |
| Card widget | `_card.dart` | `customer_order_summary_card.dart` |
| Interactive widget | `_widget.dart` | `customer_phone_text_field_widget.dart` |
| View-only (display) widget | `_vw.dart` | `order_status_badge_vw.dart` |
| Reusable app-level widget | `app_*_widget.dart` | `app_custom_button_widget.dart` |
| Reusable app-level constants / tokens | `app_*.dart` | `app_theme.dart`, `app_colors.dart` |
| Repository | `_repository.dart` | `customer_orders_repository.dart` |
| Provider file | `_provider.dart` | `tenant_provider.dart` |
| Model (package) | `_model.dart` | `order_summary_model.dart` |
| Service (package) | `_service.dart` | `order_tracking_service.dart` |
| Data source | `_remote_datasource.dart` / `_local_datasource.dart` | `orders_remote_datasource.dart` |

**`_vw.dart` vs `_widget.dart`**: Use `_vw.dart` for purely display widgets that take data and render it with no user interaction or internal state. Use `_widget.dart` for interactive or stateful UI components.

### Classes & Variables

- **Widgets / classes**: `PascalCase`
- **Providers**: `camelCaseProvider` — format `{noun}{Verb}Provider`
- **Private members**: `_camelCase`
- **Boolean variables**: prefix with `is`, `has`, `can`, `should` — e.g. `isLoading`, `hasError`, `canDelete`
- **Constants**: `lowerCamelCase` in-class, `kUpperCamelCase` for top-level

### Functions & Methods

- Start every function/method name with a **verb**: `loadOrders()`, `buildHeader()`, `validatePhone()`, `handleSubmit()`
- Use **complete words** — no abbreviations except:
  - Standard technical terms: `api`, `url`, `id`, `ui`, `http`, `otp`
  - Loop counters: `i`, `j`
  - Error variables: `err`, `e`
  - Context variables: `ctx`, `context`
  - Request/response: `req`, `res`
- Functions should do one thing
- Prefer guard clauses over deep nesting

---

## Testing

Use `mobile_testkit` for widget test scaffolding.

### Test Priorities

Write tests for business-critical logic first:
- Authentication flows
- Order creation and editing
- Order status tracking
- Payment-related flows
- Repository / notifier behavior
- Localization-sensitive screens

### Widget Tests

```dart
import 'package:mobile_testkit/mobile_testkit.dart';

void main() {
  testWidgets('shows order count', (tester) async {
    await tester.pumpWidget(
      TestAppWrapper(
        child: OrderSummaryCard(order: mockOrder),
      ),
    );
    expect(find.text('ORD-001'), findsOneWidget);
  });
}
```

### Unit Tests (providers)

```dart
test('ordersNotifier loads orders', () async {
  final container = ProviderContainer(
    overrides: [
      customerOrdersRepositoryProvider.overrideWithValue(FakeOrdersRepository()),
    ],
  );
  addTearDown(container.dispose);

  await container.read(ordersNotifierProvider.notifier).load();
  expect(container.read(ordersNotifierProvider).orders, isNotEmpty);
});
```

### Coverage Targets (recommended)

- Providers / notifiers: 80%
- Repositories: 70%
- UI screens: 60%

### Definition of Done

A feature is not done unless it includes:
- Correct architecture placement (layer flow respected)
- EN + AR localization
- Loading / error / empty / success state handling
- Input validation
- Repository / provider integration
- Role and tenant awareness where relevant
- Tests for critical logic
- No mock or placeholder code left in production paths
- `flutter analyze` passes with zero warnings

---

## Performance

- Use `ListView.builder` / `SliverList` — never `ListView(children: [...])` for dynamic data
- Mark leaf widgets `const` wherever possible
- Extract subwidgets to reduce rebuild scope
- Avoid expensive work inside `build()` — no JSON parsing, no business logic
- Dispose controllers, subscriptions, and streams in `dispose()`
- Use `ref.watch` for reactive data; `ref.read` inside callbacks/event handlers only
- Use `ref.select` to avoid rebuilds when only one field changes:

```dart
final isLoading = ref.watch(ordersNotifierProvider.select((s) => s.isLoading));
```

- Frame target: 60fps (16ms budget per frame)
- Images: use `cached_network_image`; max 2× device pixel ratio; WebP preferred; no asset over 500KB without justification

---

## Accessibility

- All interactive widgets must have `Semantics` labels using localized strings
- Minimum touch target: 44×44 logical pixels — use `SizedBox` wrapper if smaller
- Color contrast: WCAG AA minimum — 4.5:1 for normal text, 3:1 for large text
- Never rely on color alone to convey status — always pair with text or icon
- Use `ExcludeSemantics` on purely decorative icons
- Support `FocusTraversalGroup` for complex forms — especially important for RTL
- Respect `MediaQuery.disableAnimations` — disable heavy animations when enabled
- UI must not break at 1.5× and 2.0× text scale factor

---

## Code Quality

- Comments should explain **why**, not the obvious what
- Delete dead code — do not comment it out
- No noisy `print` spam — no console junk left in committed code
- No silent `catch` blocks — always log or rethrow
- No placeholder or fake implementations shipped as production code
- Keep files cohesive — one class per file, enforced
- Prefer guard clauses over deep nesting

---

## Melos Workspace

The monorepo is managed with **Melos ^6.3.2**. `melos.yaml` is at the root of `cmx_mobile_apps/`.

### Setup (first time or after cloning)

```bash
dart pub global activate melos
melos bootstrap        # installs deps for all packages + apps; run after any pubspec change
```

### Daily commands

| Command | What it does |
|---|---|
| `melos bootstrap` | Re-link all packages (`pub get` across workspace) |
| `melos analyze` | `flutter analyze` in every package/app (zero warnings required) |
| `melos test` | `flutter test` in every package that has a `test/` directory |
| `melos format` | `dart format .` across workspace |
| `melos pub_get` | `flutter pub get` in every package/app |

### Rules

- **Never add a dependency to the root `pubspec.yaml`** — each app and package owns its own `pubspec.yaml`
- `melos.yaml` is the workspace manifest; `pubspec.yaml` at root is for workspace-level dev deps only (e.g., `melos` itself)
- `melos bootstrap` must pass before any PR merges — CI gate
- `melos analyze` must pass with **zero warnings** — CI gate
- `melos format --check` rejects unformatted code in CI
- `pubspec_overrides.yaml` files (auto-generated by Melos for local path resolution) **are committed** in this repo — do not gitignore them

### Adding a new package

1. Create `packages/{name}/pubspec.yaml` with the correct `name:` field
2. Run `melos bootstrap` to link it into the workspace
3. Add `package:{name}/{name}.dart` barrel export
4. Wire provider in `core/providers/` in the consuming app

---

## Package Discipline

- Add packages only when they solve a real problem that existing packages cannot
- Prefer mature, maintained, widely used packages with high pub.dev scores
- Avoid packages that add magic or hidden behavior
- Never add a package to root `pubspec.yaml` — each app and package owns its own
- New packages require tech lead approval before merging

**Banned packages:** `supabase_flutter`, `freezed`, `build_runner`, `json_serializable`, `GetX`, `flutter_bloc`, `provider` (package), `easy_localization`, `flutter_intl`, `intl_utils`, `mobx`

---

## Code Review Checklist

Before any PR merges, all items must be checked:

- [ ] Follows feature-based folder structure
- [ ] No API or data calls in UI widgets
- [ ] No hardcoded strings, colors, or spacing values
- [ ] AR localization keys provided alongside EN keys
- [ ] RTL layout tested or explicitly noted as not applicable
- [ ] Provider names follow `{noun}{Verb}Provider` convention
- [ ] `AppException` used for all error propagation
- [ ] New shared widgets checked against `mobile_ui` catalog — no duplication
- [ ] `X-Tenant-Id` header present via `TenantInterceptor` in any new API call
- [ ] `AppLogger` used — no `print()` or `debugPrint()` in committed code
- [ ] New dependency approved by tech lead
- [ ] Tests written per coverage targets
- [ ] Dark mode tested for all new UI
- [ ] `flutter analyze` passes with zero warnings
- [ ] `dart format` applied — no unformatted code

### Branch Naming

`{app|pkg}/{type}/{short-description}` — e.g., `customer/feat/order-booking-screen`, `mobile_ui/fix/button-dark-mode`

### Merge Strategy

Squash and merge into `main`. Commit message must follow Conventional Commits format.

---

## Best Practices

### DO

- Use `ConsumerWidget` / `ConsumerStatefulWidget`
- Use `super.key` and `const` constructors
- Use `Notifier` / `AsyncNotifier` for state with actions
- Use `AppLocalizations` for all user-visible strings
- Use `AppTheme` colors, spacing, and text styles — no hardcoded values
- Use `AppLogger` (or `developer.log` in packages)
- Use `AppBreakpoints` / `ResponsiveLayoutBuilder` for layout decisions
- Handle all `AsyncValue` states (data / loading / error / empty) in every screen
- Put models in `mobile_domain`, services in `mobile_services`, UI tokens in `mobile_ui`
- Use `_vw.dart` for display-only widgets and `_widget.dart` for interactive ones
- Start function names with a verb; use complete words; prefix booleans with `is/has/can/should`
- Prefer `AutoDispose` providers for screen-scoped state
- Test every new screen in both light and dark mode

### DON'T

- Don't use Freezed, json_serializable, or build_runner
- Don't use Bloc, GetX, MobX, or Provider package
- Don't hardcode route strings — use `AppRoute` constants
- Don't put business logic or API calls in widget `build` methods
- Don't use `setState` for shared or async state
- Don't use `print` or `debugPrint` — use `AppLogger` or `developer.log`
- Don't hardcode colors, sizes, fonts, or text
- Don't add packages without tech lead approval and `pubspec.yaml` update
- Don't build a one-off widget when a standard one can be added to `mobile_ui`
- Don't use raw `MediaQuery.of(context).size.width` for layout branching
- Don't use `supabase_flutter` anywhere in mobile code
- Don't log tokens, passwords, OTPs, or PII
- Don't ship placeholder or fake code in production paths
- Don't let raw HTTP exceptions escape repositories

---

## Related Documentation

- [MOBILE_FOUNDATION_DECISIONS.md](../../MOBILE_FOUNDATION_DECISIONS.md) — authoritative architecture decisions, locked standards, deferred decisions
- [customer_app_production_milestone_plan.md](../customer_app_production_milestone_plan.md) — delivery plan and milestone status
- [mobile_skill_set_plan.md](../mobile_skill_set_plan.md) — mobile skill set plan

---

## Return to [Main Documentation](../CLAUDE.md)
