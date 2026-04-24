---
version: v2.1.0
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
│                   │   └── repositories/
│                   ├── providers/
│                   └── ui/
│                       ├── screens/
│                       ├── cards/
│                       └── widgets/
└── packages/
    ├── mobile_core/       # AppConfig, AppLogger, AppException
    ├── mobile_domain/     # Plain-Dart models (no code generation)
    ├── mobile_services/   # HTTP client, API services, session storage
    ├── mobile_ui/         # AppTheme, AppColors, shared widgets
    ├── mobile_l10n/       # AppLocalizations, AppLocale
    └── mobile_testkit/    # Test helpers, TestAppWrapper
```

---

## UI/UX Goals

Every screen and widget must satisfy all of these:

- **Modern, clean UI** — clear visual hierarchy, minimal noise, purposeful use of space
- **Multi-language** — every user-visible string goes through `AppLocalizations`; EN + AR required at all times
- **RTL-aware** — layouts, icons, and alignment must work correctly in both LTR and RTL
- **Responsive** — adapts gracefully to different screen sizes and orientations using `LayoutBuilder` or `MediaQuery`
- **Theming consistency** — fonts, colors, spacing, corner radii, and elevation come exclusively from `AppTheme`, `AppColors`, `AppSpacing`, and `AppTextStyles`; never hardcoded
- **Dark mode** — support `AppTheme.light()` and `AppTheme.dark()`; always use `Theme.of(context).colorScheme` / `textTheme`
- **Offline awareness** — screens that depend on network data must handle the offline/error state explicitly using `AsyncValue` error branches or the offline route
- **Reusability** — extract repeated UI into shared widgets in `mobile_ui`; use the standard widget library below before building new components

---

## Code Generation Policy

**CRITICAL — NO EXCEPTIONS:**

- ❌ **NO Freezed** — use plain Dart classes with manual `copyWith`
- ❌ **NO json_serializable** — implement `fromJson`/`toJson` manually
- ❌ **NO build_runner** — no generated files, ever
- ✅ All code must be explicit, visible, and human-readable

---

## State Management: Riverpod 2.x (Mandatory)

Use `flutter_riverpod` only. No Provider, Bloc, GetX, or setState for shared state.

### Notifier (preferred for complex state)

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

// State class — immutable, plain Dart
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

// Notifier
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
    // build() is called once; return the initial value
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

// In widget
ref.watch(ordersProvider).when(
  data: (orders) => OrdersList(orders: orders),
  loading: () => const AppLoadingIndicatorWidget(),
  error: (e, _) => AppErrorWidget(messageKey: 'orders.errorTitle'),
);
```

### StateProvider (simple primitive state only)

```dart
// Only for simple toggles / selections — not business state
final selectedTabProvider = StateProvider<int>((ref) => 0);
```

---

## Provider Naming

| Pattern | Suffix | Example |
|---|---|---|
| `NotifierProvider` | `NotifierProvider` | `customerSessionFlowProvider` |
| `AsyncNotifierProvider` | `Provider` | `orderDetailProvider` |
| `FutureProvider` | `Provider` | `ordersProvider` |
| `StreamProvider` | `StreamProvider` | `orderUpdatesStreamProvider` |
| `StateProvider` | `Provider` | `selectedTabProvider` |
| Service/repo provider | `Provider` | `customerOrdersRepositoryProvider` |

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

class _CustomerLoginEntryScreenState
    extends ConsumerState<CustomerLoginEntryScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.text('loginEntry.title'))),
      body: TextField(controller: _controller),
    );
  }
}

// ❌ Wrong: StatefulWidget + Consumer wrapper — use ConsumerStatefulWidget instead
```

### Const Constructors

Always use `const` constructors and `super.key`:

```dart
// ✅
class OrderCard extends StatelessWidget {
  const OrderCard({super.key, required this.order});
  final OrderSummaryModel order;
  // ...
}

// ❌ — old Key? key style
class OrderCard extends StatelessWidget {
  OrderCard({Key? key, required this.order}) : super(key: key);
}
```

### Extract Reusable Widgets

```dart
// ✅ Extract to a named widget — never inline complex widget trees
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

// ❌ Inline extraction with local functions — extract to a class instead
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
// packages/mobile_domain/lib/src/order_summary_model.dart
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
      garmentCount: (json['garment_count'] as num).toInt(),
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

**Rules for models:**
- Always `const` constructor
- Always implement `==`, `hashCode`, `toString`, `copyWith`, `fromJson`, `toJson`
- Use `Map<String, Object?>` (not `dynamic`) for JSON maps
- Null-safe field access: cast with `as String?` / `as String` — no bang operator on JSON fields

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
  'myFeature.paramExample': 'Hello {count}',   // {count} is the placeholder
},
'ar': {
  'myFeature.title': 'ميزتي',
  'myFeature.subtitle': 'وصف مختصر هنا.',
  'myFeature.action': 'تنفيذ',
  'myFeature.errorTitle': 'حدث خطأ ما',
  'myFeature.paramExample': 'مرحباً {count}',
},
```

### Using translations in widgets

```dart
// Plain key
final l10n = AppLocalizations.of(context);
Text(l10n.text('myFeature.title'))

// With parameter substitution
Text(l10n.textWithArg('myFeature.paramExample', userName))
```

### RTL

`AppLocalizations` exposes `textDirection`. The `MaterialApp` in `app.dart` passes `locale` from `customerLocaleProvider`; RTL is applied automatically by Flutter's `Directionality` widget. Do **not** hard-code `TextDirection.rtl` in individual widgets unless overriding a specific layout.

```dart
// ✅ Access direction when you need it explicitly
final dir = AppLocalizations.of(context).textDirection;
```

### Locale switching

```dart
ref.read(customerLocaleProvider.notifier).toggleLocale();
```

---

## HTTP / API Layer

### MobileHttpClient

All HTTP goes through `MobileHttpClient` from `mobile_services`. Never use `http` or `dio` directly in app code.

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

### Repository pattern (in app)

Repositories live in `features/{feature}/data/repositories/` and depend on services from `mobile_services`.

```dart
class CustomerOrdersRepository {
  CustomerOrdersRepository({required OrderTrackingService trackingService})
      : _trackingService = trackingService;

  final OrderTrackingService _trackingService;

  Future<List<OrderSummaryModel>> getOrders() {
    // session/tenant resolved by provider graph, not here
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

---

## Navigation

### Route constants

All route names are `static const String` fields in `app_route.dart`. Never hard-code route strings inline.

```dart
// core/navigation/app_route.dart
abstract final class AppRoute {
  static const String splash = '/';
  static const String home = '/home';
  static const String orders = '/orders';
  // ...
}
```

### Route generation

All routing goes through `onGenerateCustomerRoute` in `app_router.dart`. Never call `Navigator.pushNamed` with ad-hoc strings.

```dart
Navigator.pushNamed(context, AppRoute.orders);
Navigator.pushNamed(context, AppRoute.orderDetail, arguments: orderId);
```

### Route guards

`canAccessRoute` in `app_router.dart` enforces session and tenant guards. Add new guarded routes there.

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
| `AppTextFieldWidget` | planned | Standard text input with label, hint, and validation |
| `AppDropdownWidget` | planned | Dropdown selector with label and consistent styling |
| `AppCustomDateFieldWidget` | planned | Date input field (typed entry) |
| `AppDatePickerButtonWidget` | planned | Tap-to-open calendar date picker |
| `AppCheckboxListTileWidget` | planned | Checkbox row with label and optional subtitle |
| `AppSwitchListTileWidget` | planned | Toggle/switch row with label |

**Rule**: When a planned widget is needed, implement it in `mobile_ui` first, then consume it — do not build a one-off inline version.

### Design Tokens

All from `package:mobile_ui/mobile_ui.dart`:

- `AppTheme.light()` / `AppTheme.dark()` — MaterialApp theme
- `AppColors.*` — color palette
- `AppSpacing.*` — spacing scale
- `AppTextStyles.*` — typography

Theme uses **Material 3** (`useMaterial3: true`). Always use `Theme.of(context).colorScheme` and `Theme.of(context).textTheme` — never hardcode colors, font sizes, or spacing values.

---

## Error Handling

### AppException hierarchy

```dart
// packages/mobile_core — base class
class AppException implements Exception {
  const AppException({required this.code, required this.messageKey, this.originalError});
  final String code;
  final String messageKey;  // i18n key shown to the user
  final Object? originalError;
}

// packages/mobile_services — HTTP errors
class MobileHttpException extends AppException {
  const MobileHttpException({required super.code, required super.messageKey, super.originalError, this.statusCode});
  final int? statusCode;
}

// Domain-specific
class AuthServiceException extends AppException { ... }
```

### In providers

```dart
// AsyncValue.guard catches and wraps in AsyncError
state = await AsyncValue.guard(() => repository.getOrders());

// Or manual
try {
  final result = await repository.getOrders();
  state = state.copyWith(orders: result);
} on AppException catch (e) {
  // use e.messageKey for the user-facing error
  AppLogger.error('load failed', error: e);
  rethrow;
}
```

### In widgets

```dart
ordersAsync.when(
  data: (orders) => ...,
  loading: () => const AppLoadingIndicatorWidget(),
  error: (e, _) {
    final key = e is AppException ? e.messageKey : 'common.remoteRequestError';
    return AppErrorWidget(messageKey: key, onRetry: () => ref.invalidate(ordersProvider));
  },
);
```

---

## Logging

Use `AppLogger` from `mobile_core` in all app and package code. Never use `print` or `debugPrint`.

```dart
AppLogger.info('CustomerApp: env=${config.appEnv}');
AppLogger.error('load failed', error: e, stackTrace: st);
```

In package-internal code where `AppLogger` is not yet wired, use Dart's `developer.log` as the fallback — never `print`:

```dart
import 'dart:developer';

log('debug value: $value', name: 'OrderTrackingService');
```

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

**`_vw.dart` vs `_widget.dart`**: Use `_vw.dart` for purely display widgets that take data and render it without any user interaction or internal state. Use `_widget.dart` for interactive or stateful UI components (text fields, buttons, pickers).

### Classes & variables

- **Widgets / classes**: `PascalCase`
- **Providers**: `camelCaseProvider` (matches the type suffix table above)
- **Private members**: `_camelCase`
- **Boolean variables**: prefix with `is`, `has`, `can`, `should` — e.g. `isLoading`, `hasError`, `canDelete`
- **Constants**: `lowerCamelCase` in-class, `kUpperCamelCase` for top-level

### Functions & methods

- Start every function/method name with a **verb**: `loadOrders()`, `buildHeader()`, `validatePhone()`, `handleSubmit()`
- Use **complete words** — no abbreviations except:
  - Standard technical terms: `api`, `url`, `id`, `ui`, `http`
  - Loop counters: `i`, `j`
  - Error variables: `err`, `e`
  - Context variables: `ctx`, `context`
  - Request/response in middleware: `req`, `res`

---

## Testing

Use `mobile_testkit` for widget test scaffolding.

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

### Unit test providers

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

---

## Performance

- Use `ListView.builder` / `SliverList` — never `ListView(children: [...])` for dynamic data
- Mark leaf widgets `const` wherever possible
- Use `ref.watch` for reactive data; `ref.read` inside callbacks/event handlers only
- Avoid `ref.watch` inside `build` for providers that change very frequently — use `select`

```dart
// ✅ select to avoid rebuilds when only one field changes
final isLoading = ref.watch(ordersNotifierProvider.select((s) => s.isLoading));
```

---

## Best Practices

### DO

- Use `ConsumerWidget` / `ConsumerStatefulWidget` — never plain `StatefulWidget` + `Consumer`
- Use `super.key` and `const` constructors
- Use `Notifier` / `AsyncNotifier` for state that has actions
- Use `AppLocalizations` for all user-visible strings — no hardcoded text
- Use `AppTheme` colors and spacing — no hardcoded colors or magic numbers
- Use `AppLogger` (or `developer.log` in packages) — no `print` / `debugPrint`
- Put models in `mobile_domain`, services in `mobile_services`, UI tokens in `mobile_ui`
- Handle all three `AsyncValue` states (data / loading / error) in every screen
- Use `_vw.dart` for display-only widgets and `_widget.dart` for interactive/stateful ones
- Start function names with a verb; use complete words; use `is/has/can/should` for booleans
- Check the standard widget library in `mobile_ui` before creating a new component
- Support dark mode — test every new screen with both `AppTheme.light()` and `.dark()`

### DON'T

- Don't use Freezed, json_serializable, or build_runner
- Don't hardcode route strings — use `AppRoute` constants
- Don't put business logic or API calls in widget `build` methods
- Don't use `setState` for shared/cross-screen state
- Don't use `print` or `debugPrint` — use `AppLogger` or `developer.log`
- Don't hardcode colors, sizes, fonts, or text — use `AppTheme`, `AppSpacing`, `AppLocalizations`
- Don't add new packages without updating all relevant `pubspec.yaml` files in the monorepo
- Don't build a one-off widget when a standard one can be added to `mobile_ui` instead
- Don't abbreviate variable or function names beyond the allowed list (`api`, `url`, `id`, `i`, `j`, `err`, `ctx`)

---

## Related Documentation

- [PRD Implementation Rules](./prd-implementation_rules.md)
- [UI/UX Rules](./uiux-rules.md)
- [i18n Rules](./i18n.md)

---

## Return to [Main Documentation](../CLAUDE.md)
