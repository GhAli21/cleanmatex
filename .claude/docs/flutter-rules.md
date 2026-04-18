---
version: v1.1.0
last_updated: 2025-11-14
author: CleanMateX Team
---

# 📱 Flutter Development Rules

**CRITICAL**: Follow these rules for all Flutter mobile app development in CleanMateX.

---

## Architecture

### Project Structure

```
lib/
├── main.dart
├── app.dart
├── screens/
│   ├── orders/
│   │   ├── orders_list_screen.dart
│   │   └── order_detail_screen.dart
│   └── customers/
├── widgets/
│   ├── common/
│   │   ├── loading_indicator.dart
│   │   └── error_widget.dart
│   └── orders/
│       └── order_card.dart
├── providers/
│   ├── orders_provider.dart
│   └── auth_provider.dart
├── services/
│   ├── api_service.dart
│   └── storage_service.dart
├── models/
│   ├── order.dart          # Plain Dart classes - NO code generation
│   └── customer.dart       # All code must be explicit and visible
├── utils/
│   ├── logger.dart
│   └── validators.dart
└── constants/
    └── app_constants.dart
```

### Code Generation Policy

**CRITICAL**:

- ❌ **NO Freezed** - Use plain Dart classes
- ❌ **NO json_serializable** - Implement JSON serialization manually
- ❌ **NO build_runner** - No code generation tools
- ✅ **All code must be explicit and visible** - No hidden/generated code

### State Management: Riverpod (Mandatory)

**CRITICAL**: Use Riverpod only - no other state management solutions.

```dart
// ✅ Good: Using Riverpod
import 'package:riverpod/riverpod.dart';

final ordersProvider = FutureProvider<List<Order>>((ref) async {
  final apiService = ref.read(apiServiceProvider);
  return await apiService.getOrders();
});

// ❌ Bad: Using other state management
// Don't use Provider, Bloc, GetX, etc.
```

---

## State Management Patterns

### Simple State Provider

```dart
// For simple state
final selectedOrderProvider = StateProvider<Order?>((ref) => null);

// Usage
final selectedOrder = ref.watch(selectedOrderProvider);
ref.read(selectedOrderProvider.notifier).state = newOrder;
```

### Future Provider

```dart
// For async data fetching
final ordersProvider = FutureProvider<List<Order>>((ref) async {
  final apiService = ref.read(apiServiceProvider);
  final tenantId = ref.read(tenantIdProvider);
  return await apiService.getOrders(tenantId);
});

// Usage
final ordersAsync = ref.watch(ordersProvider);

ordersAsync.when(
  data: (orders) => OrdersList(orders: orders),
  loading: () => LoadingIndicator(),
  error: (error, stack) => ErrorWidget(error: error),
);
```

### State Notifier (Complex State)

```dart
// For complex state logic
class OrdersNotifier extends StateNotifier<AsyncValue<List<Order>>> {
  OrdersNotifier(this._apiService) : super(const AsyncValue.loading());

  final ApiService _apiService;

  Future<void> loadOrders(String tenantId) async {
    state = const AsyncValue.loading();
    try {
      final orders = await _apiService.getOrders(tenantId);
      state = AsyncValue.data(orders);
    } catch (error, stackTrace) {
      state = AsyncValue.error(error, stackTrace);
    }
  }

  Future<void> createOrder(Order order) async {
    try {
      final newOrder = await _apiService.createOrder(order);
      final currentOrders = state.value ?? [];
      state = AsyncValue.data([...currentOrders, newOrder]);
    } catch (error, stackTrace) {
      state = AsyncValue.error(error, stackTrace);
    }
  }
}

final ordersNotifierProvider = StateNotifierProvider<OrdersNotifier, AsyncValue<List<Order>>>((ref) {
  return OrdersNotifier(ref.read(apiServiceProvider));
});
```

### Provider Composition

```dart
// Create providers that depend on other providers
final filteredOrdersProvider = Provider<List<Order>>((ref) {
  final orders = ref.watch(ordersProvider).value ?? [];
  final filter = ref.watch(orderFilterProvider);

  return orders.where((order) => order.status == filter).toList();
});
```

---

## Widget Guidelines

### Prefer Const Constructors

```dart
// ✅ Good: Const constructor
class OrderCard extends StatelessWidget {
  const OrderCard({Key? key, required this.order}) : super(key: key);

  final Order order;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Text(order.orderNumber),
    );
  }
}

// ❌ Bad: Non-const constructor
class OrderCard extends StatelessWidget {
  OrderCard({Key? key, required this.order}) : super(key: key);
  // ...
}
```

### Stateless vs Stateful Widgets

```dart
// ✅ Good: Use StatelessWidget when possible
class OrderList extends StatelessWidget {
  const OrderList({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Consumer(
      builder: (context, ref, child) {
        final orders = ref.watch(ordersProvider);
        return ListView.builder(
          itemCount: orders.length,
          itemBuilder: (context, index) => OrderCard(order: orders[index]),
        );
      },
    );
  }
}

// Use StatefulWidget only when needed for local state
class OrderForm extends StatefulWidget {
  const OrderForm({Key? key}) : super(key: key);

  @override
  State<OrderForm> createState() => _OrderFormState();
}

class _OrderFormState extends State<OrderForm> {
  final _formKey = GlobalKey<FormState>();

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          // Form fields
        ],
      ),
    );
  }
}
```

### Extract Reusable Widgets

```dart
// ✅ Good: Extract reusable widgets
class LoadingIndicator extends StatelessWidget {
  const LoadingIndicator({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: CircularProgressIndicator(),
    );
  }
}

// ❌ Bad: Inline widget creation
Center(child: CircularProgressIndicator())
```

---

## Responsive Design

### Using LayoutBuilder

```dart
class ResponsiveLayout extends StatelessWidget {
  const ResponsiveLayout({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth > 768) {
          return DesktopLayout();
        } else {
          return MobileLayout();
        }
      },
    );
  }
}
```

### Using MediaQuery

```dart
class ResponsiveWidget extends StatelessWidget {
  const ResponsiveWidget({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isTablet = screenWidth > 600 && screenWidth < 1200;
    final isDesktop = screenWidth >= 1200;

    return isDesktop
        ? DesktopView()
        : isTablet
            ? TabletView()
            : MobileView();
  }
}
```

### Breakpoints

```dart
class AppBreakpoints {
  static const double mobile = 600;
  static const double tablet = 900;
  static const double desktop = 1200;

  static bool isMobile(BuildContext context) {
    return MediaQuery.of(context).size.width < mobile;
  }

  static bool isTablet(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    return width >= mobile && width < desktop;
  }

  static bool isDesktop(BuildContext context) {
    return MediaQuery.of(context).size.width >= desktop;
  }
}
```

---

## Data Models

### Plain Dart Classes (No Code Generation)

**CRITICAL**: Use plain Dart classes only - no Freezed, no json_serializable, no code generation.

```dart
// ✅ Good: Plain Dart class with explicit code
class Order {
  final String id;
  final String orderNumber;
  final String tenantId;
  final OrderStatus status;
  final double totalAmount;
  final DateTime? createdAt;

  Order({
    required this.id,
    required this.orderNumber,
    required this.tenantId,
    required this.status,
    required this.totalAmount,
    this.createdAt,
  });

  // Manual JSON serialization
  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      id: json['id'] as String,
      orderNumber: json['order_number'] as String,
      tenantId: json['tenant_id'] as String,
      status: OrderStatus.values.firstWhere(
        (e) => e.toString().split('.').last == json['status'] as String,
        orElse: () => OrderStatus.pending,
      ),
      totalAmount: (json['total_amount'] as num).toDouble(),
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'order_number': orderNumber,
      'tenant_id': tenantId,
      'status': status.toString().split('.').last,
      'total_amount': totalAmount,
      'created_at': createdAt?.toIso8601String(),
    };
  }

  // Copy with method (manual implementation)
  Order copyWith({
    String? id,
    String? orderNumber,
    String? tenantId,
    OrderStatus? status,
    double? totalAmount,
    DateTime? createdAt,
  }) {
    return Order(
      id: id ?? this.id,
      orderNumber: orderNumber ?? this.orderNumber,
      tenantId: tenantId ?? this.tenantId,
      status: status ?? this.status,
      totalAmount: totalAmount ?? this.totalAmount,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is Order &&
        other.id == id &&
        other.orderNumber == orderNumber &&
        other.tenantId == tenantId &&
        other.status == status &&
        other.totalAmount == totalAmount &&
        other.createdAt == createdAt;
  }

  @override
  int get hashCode {
    return Object.hash(
      id,
      orderNumber,
      tenantId,
      status,
      totalAmount,
      createdAt,
    );
  }

  @override
  String toString() {
    return 'Order(id: $id, orderNumber: $orderNumber, status: $status, totalAmount: $totalAmount)';
  }
}

enum OrderStatus {
  pending,
  processing,
  ready,
  delivered;

  // Helper method for JSON conversion
  static OrderStatus fromString(String value) {
    return OrderStatus.values.firstWhere(
      (e) => e.toString().split('.').last == value,
      orElse: () => OrderStatus.pending,
    );
  }

  String toJson() => toString().split('.').last;
}
```

### JSON Serialization (Manual Implementation)

```dart
// ✅ Good: Manual JSON serialization - all code visible
class Customer {
  final String id;
  final String name;
  final String phone;
  final String? email;

  Customer({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
  });

  // Manual fromJson
  factory Customer.fromJson(Map<String, dynamic> json) {
    return Customer(
      id: json['id'] as String,
      name: json['name'] as String,
      phone: json['phone'] as String,
      email: json['email'] as String?,
    );
  }

  // Manual toJson
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      if (email != null) 'email': email,
    };
  }

  // Copy with method
  Customer copyWith({
    String? id,
    String? name,
    String? phone,
    String? email,
  }) {
    return Customer(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      email: email ?? this.email,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is Customer &&
        other.id == id &&
        other.name == name &&
        other.phone == phone &&
        other.email == email;
  }

  @override
  int get hashCode => Object.hash(id, name, phone, email);

  @override
  String toString() => 'Customer(id: $id, name: $name, phone: $phone)';
}
```

### Helper for List Serialization

```dart
// Helper extension for list serialization
extension OrderListExtension on List<Order> {
  List<Map<String, dynamic>> toJsonList() {
    return map((order) => order.toJson()).toList();
  }

  static List<Order> fromJsonList(List<dynamic> jsonList) {
    return jsonList
        .map((json) => Order.fromJson(json as Map<String, dynamic>))
        .toList();
  }
}

// Usage
final ordersJson = orders.toJsonList();
final orders = OrderListExtension.fromJsonList(jsonData);
```

---

## Forms & Validation

### Form Handling

```dart
import 'package:flutter_form_builder/flutter_form_builder.dart';

class OrderForm extends StatelessWidget {
  final _formKey = GlobalKey<FormBuilderState>();

  @override
  Widget build(BuildContext context) {
    return FormBuilder(
      key: _formKey,
      child: Column(
        children: [
          FormBuilderTextField(
            name: 'customerName',
            decoration: InputDecoration(labelText: 'Customer Name'),
            validator: FormBuilderValidators.required(),
          ),
          FormBuilderTextField(
            name: 'phone',
            decoration: InputDecoration(labelText: 'Phone'),
            validator: FormBuilderValidators.compose([
              FormBuilderValidators.required(),
              FormBuilderValidators.numeric(),
            ]),
          ),
          ElevatedButton(
            onPressed: () {
              if (_formKey.currentState?.saveAndValidate() ?? false) {
                final data = _formKey.currentState!.value;
                // Process form data
              }
            },
            child: Text('Submit'),
          ),
        ],
      ),
    );
  }
}
```

### Custom Validators

```dart
class AppValidators {
  static String? phoneNumber(String? value) {
    if (value == null || value.isEmpty) {
      return 'Phone number is required';
    }
    if (!RegExp(r'^\+?[0-9]{8,15}$').hasMatch(value)) {
      return 'Invalid phone number format';
    }
    return null;
  }

  static String? email(String? value) {
    if (value == null || value.isEmpty) {
      return 'Email is required';
    }
    if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
      return 'Invalid email format';
    }
    return null;
  }
}
```

---

## Internationalization (i18n)

### Localization Package

**CRITICAL**: Use `flutter_localizations` (built-in SDK) + manual JSON-based translations. No code generation packages.

**Packages to Use:**

- ✅ `flutter_localizations` (SDK built-in) - For Material/Cupertino widget localization
- ✅ Manual JSON loader - Load translations from JSON files explicitly
- ❌ **NO `easy_localization`** - Uses code generation
- ❌ **NO `flutter_intl`** - Uses code generation
- ❌ **NO `intl_utils`** - Uses code generation

### Setup

```dart
// pubspec.yaml
dependencies:
  flutter_localizations:
    sdk: flutter
  # No intl package needed - we'll use manual JSON loading

flutter:
  assets:
    - assets/translations/en.json
    - assets/translations/ar.json

// assets/translations/en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "loading": "Loading..."
  },
  "orders": {
    "title": "Orders",
    "create": "Create Order",
    "status": {
      "pending": "Pending",
      "processing": "Processing",
      "ready": "Ready",
      "delivered": "Delivered"
    }
  }
}

// assets/translations/ar.json
{
  "common": {
    "save": "حفظ",
    "cancel": "إلغاء",
    "delete": "حذف",
    "loading": "جاري التحميل..."
  },
  "orders": {
    "title": "الطلبات",
    "create": "إنشاء طلب",
    "status": {
      "pending": "قيد الانتظار",
      "processing": "قيد المعالجة",
      "ready": "جاهز",
      "delivered": "تم التسليم"
    }
  }
}
```

### Manual Translation Loader (No Code Generation)

```dart
// lib/utils/app_localizations.dart
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter/material.dart';

class AppLocalizations {
  final Locale locale;
  late Map<String, dynamic> _localizedStrings;

  AppLocalizations(this.locale);

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate = _AppLocalizationsDelegate();

  Future<bool> load() async {
    final String jsonString = await rootBundle.loadString(
      'assets/translations/${locale.languageCode}.json',
    );
    _localizedStrings = json.decode(jsonString) as Map<String, dynamic>;
    return true;
  }

  String translate(String key) {
    final keys = key.split('.');
    dynamic value = _localizedStrings;

    for (final k in keys) {
      if (value is Map<String, dynamic>) {
        value = value[k];
      } else {
        return key; // Return key if not found
      }
    }

    return value?.toString() ?? key;
  }

  // Convenience method
  String t(String key) => translate(key);
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) {
    return ['en', 'ar'].contains(locale.languageCode);
  }

  @override
  Future<AppLocalizations> load(Locale locale) async {
    final AppLocalizations localizations = AppLocalizations(locale);
    await localizations.load();
    return localizations;
  }

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}
```

### Main App Setup

```dart
// main.dart
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'utils/app_localizations.dart';

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CleanMateX',
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('en', ''),
        Locale('ar', ''),
      ],
      locale: const Locale('ar'), // Load from user profile/settings
      home: HomeScreen(),
    );
  }
}
```

### Using Translations in Widgets

```dart
// ✅ Good: Use AppLocalizations
class OrdersScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('orders.title')),
      ),
      body: Column(
        children: [
          ElevatedButton(
            onPressed: () {},
            child: Text(l10n.t('orders.create')),
          ),
          Text(l10n.t('orders.status.pending')),
        ],
      ),
    );
  }
}

// Helper extension for easier access
extension LocalizationExtension on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this)!;
}

// Usage with extension
class OrdersScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.t('orders.title')),
      ),
      body: Text(context.l10n.t('common.loading')),
    );
  }
}
```

### RTL Support

```dart
// RTL is automatically handled by MaterialApp when locale is Arabic
// But you can also manually set direction if needed

class RTLWrapper extends StatelessWidget {
  final Widget child;

  const RTLWrapper({Key? key, required this.child}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final isRTL = locale.languageCode == 'ar';

    return Directionality(
      textDirection: isRTL ? TextDirection.rtl : TextDirection.ltr,
      child: child,
    );
  }
}

// Or use MediaQuery for RTL-aware layouts
class ResponsiveLayout extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final isRTL = Localizations.localeOf(context).languageCode == 'ar';

    return Row(
      textDirection: isRTL ? TextDirection.rtl : TextDirection.ltr,
      children: [
        Icon(Icons.arrow_back),
        Text('Back'),
      ],
    );
  }
}
```

### Date & Number Formatting

```dart
// Manual date formatting (no intl package needed)
import 'package:intl/intl.dart'; // Only for date formatting, no code generation

class DateFormatter {
  static String formatDate(DateTime date, BuildContext context) {
    final locale = Localizations.localeOf(context);
    final isArabic = locale.languageCode == 'ar';

    if (isArabic) {
      // Arabic date format
      return DateFormat('yyyy-MM-dd', 'ar').format(date);
    } else {
      // English date format
      return DateFormat('MMM dd, yyyy', 'en').format(date);
    }
  }

  static String formatCurrency(double amount, BuildContext context) {
    final locale = Localizations.localeOf(context);
    final isArabic = locale.languageCode == 'ar';

    if (isArabic) {
      return '${amount.toStringAsFixed(2)} ر.ع';
    } else {
      return 'OMR ${amount.toStringAsFixed(2)}';
    }
  }
}

// Usage
Text(DateFormatter.formatDate(DateTime.now(), context))
Text(DateFormatter.formatCurrency(25.50, context))
```

---

## Performance Optimization

### ListView.builder for Long Lists

```dart
// ✅ Good: Use ListView.builder
ListView.builder(
  itemCount: orders.length,
  itemBuilder: (context, index) => OrderCard(order: orders[index]),
)

// ❌ Bad: Using ListView with all items
ListView(
  children: orders.map((order) => OrderCard(order: order)).toList(),
)
```

### Image Caching

```dart
import 'package:cached_network_image/cached_network_image.dart';

CachedNetworkImage(
  imageUrl: order.imageUrl,
  placeholder: (context, url) => CircularProgressIndicator(),
  errorWidget: (context, url, error) => Icon(Icons.error),
)
```

### Const Constructors

```dart
// Always use const when possible
const SizedBox(height: 16)
const Padding(padding: EdgeInsets.all(8))
const Text('Hello')
```

---

## Error Handling

### AsyncValue Error Handling

```dart
final ordersProvider = FutureProvider<List<Order>>((ref) async {
  try {
    return await apiService.getOrders();
  } catch (error, stackTrace) {
    // Log error
    logger.error('Failed to load orders', error, stackTrace);
    rethrow;
  }
});

// In widget
ordersAsync.when(
  data: (orders) => OrdersList(orders: orders),
  loading: () => LoadingIndicator(),
  error: (error, stack) => ErrorWidget(
    error: error,
    onRetry: () => ref.refresh(ordersProvider),
  ),
);
```

### Try-Catch in Async Operations

```dart
Future<void> createOrder(Order order) async {
  try {
    await apiService.createOrder(order);
    // Show success message
  } catch (error) {
    logger.error('Failed to create order', error);
    // Show error message to user
  }
}
```

---

## Testing

### Unit Tests

```dart
// test/providers/orders_provider_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod/riverpod.dart';

void main() {
  test('ordersProvider loads orders', () async {
    final container = ProviderContainer();
    final ordersAsync = container.read(ordersProvider);

    expect(ordersAsync.isLoading, true);

    await container.read(ordersProvider.future);

    final orders = container.read(ordersProvider).value;
    expect(orders, isNotEmpty);
  });
}
```

### Widget Tests

```dart
// test/widgets/order_card_test.dart
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('OrderCard displays order number', (tester) async {
    final order = Order(
      id: '1',
      orderNumber: 'ORD-001',
      tenantId: 'tenant-1',
      status: OrderStatus.pending,
      totalAmount: 100.0,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: OrderCard(order: order),
      ),
    );

    expect(find.text('ORD-001'), findsOneWidget);
  });
}
```

---

## Naming Conventions

### File Naming

- **Screens**: `{feature}_screen.dart` (e.g., `orders_list_screen.dart`, `order_detail_screen.dart`)
- **Widgets**: `{widget_name}.dart` (e.g., `order_card.dart`, `loading_indicator.dart`)
- **Models**: `{table/model_name}.dart` (e.g., `order.dart`, `customer.dart`)
- **Providers**: `{feature}_provider.dart` (e.g., `orders_provider.dart`, `auth_provider.dart`)
- **Services**: `{feature_}{service_name}_service.dart` (e.g., `api_service.dart`, `storage_service.dart`)
- **Utils**: `{utility_name}.dart` (e.g., `validators.dart`, `formatters.dart`)
- **Constants**: `{scope}_constants.dart` (e.g., `app_constants.dart`, `order_constants.dart`)
- **Mixins**: `{name}_mixin.dart` (e.g., `loading_mixin.dart`, `validation_mixin.dart`)
- **Extensions**: `{type}_extensions.dart` (e.g., `string_extensions.dart`, `date_time_extensions.dart`)

### Class Naming

- **Widgets**: `PascalCase` (e.g., `OrderCard`, `LoadingIndicator`, `OrdersListScreen`)
- **Models**: `PascalCase` (e.g., `Order`, `Customer`, `OrderStatus`)
- **Providers**: `PascalCase` with descriptive name (e.g., `OrdersProvider`, `AuthProvider`)
- **Services**: `PascalCase` with `Service` suffix (e.g., `ApiService`, `StorageService`)
- **Utilities**: `PascalCase` (e.g., `Validators`, `DateFormatter`)
- **Mixins**: `PascalCase` with `Mixin` suffix (e.g., `LoadingMixin`, `ValidationMixin`)

### Variable & Function Naming

- **Variables**: `camelCase` (e.g., `orderList`, `selectedOrder`, `isLoading`)
- **Functions/Methods**: `camelCase` (e.g., `getOrders()`, `createOrder()`, `validateInput()`)
- **Private members**: `_camelCase` (e.g., `_orderList`, `_apiService`)
- **Constants**: `lowerCamelCase` for local, `UPPER_SNAKE_CASE` for global (e.g., `maxOrderItems`, `MAX_ORDER_ITEMS`)
- **Boolean variables**: Prefix with `is`, `has`, `should`, `can` (e.g., `isLoading`, `hasError`, `shouldRefresh`)

### Provider Naming

- **StateProvider**: `{feature}{name}Provider` (e.g., `selectedOrderProvider`, `isLoadingProvider`)
- **FutureProvider**: `{feature}{name}Provider` (e.g., `ordersProvider`, `customerProvider`)
- **StateNotifierProvider**: `{feature}{name}NotifierProvider` (e.g., `ordersNotifierProvider`)
- **StreamProvider**: `{feature}{name}StreamProvider` (e.g., `orderUpdatesStreamProvider`)

### Examples

```dart
// ✅ Good: Clear, descriptive names
class OrdersListScreen extends StatelessWidget {}
class OrderCard extends StatelessWidget {}
final ordersProvider = FutureProvider<List<Order>>(...);
final selectedOrderProvider = StateProvider<Order?>(...);
bool isLoading = false;
String orderNumber = 'ORD-001';

// ❌ Bad: Unclear or inconsistent names
class Orders extends StatelessWidget {} // Should be OrdersListScreen
class OC extends StatelessWidget {} // Should be OrderCard
final orders = FutureProvider<List<Order>>(...); // Should be ordersProvider
final selected = StateProvider<Order?>(...); // Should be selectedOrderProvider
bool loading = false; // Should be isLoading
```

---

## Code Reuse Patterns

### 1. Extract Reusable Widgets

```dart
// ✅ Good: Extract reusable widget
// widgets/common/loading_indicator.dart
class LoadingIndicator extends StatelessWidget {
  const LoadingIndicator({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: CircularProgressIndicator(),
    );
  }
}

// Usage across multiple screens
LoadingIndicator()

// ❌ Bad: Inline widget creation
Center(child: CircularProgressIndicator())
```

### 2. Extract Common UI Patterns

```dart
// ✅ Good: Reusable card widget
// widgets/common/app_card.dart
class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets? padding;
  final Color? backgroundColor;

  const AppCard({
    Key? key,
    required this.child,
    this.padding,
    this.backgroundColor,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      color: backgroundColor,
      child: Padding(
        padding: padding ?? const EdgeInsets.all(16),
        child: child,
      ),
    );
  }
}

// Usage
AppCard(
  child: Text('Order Details'),
  padding: EdgeInsets.all(20),
)
```

### 3. Extract Business Logic to Services

```dart
// ✅ Good: Reusable service
// services/order_service.dart
class OrderService {
  final ApiService _apiService;

  OrderService(this._apiService);

  Future<List<Order>> getOrders(String tenantId) async {
    return await _apiService.get('/orders', params: {'tenant_id': tenantId});
  }

  Future<Order> createOrder(Order order) async {
    return await _apiService.post('/orders', data: order.toJson());
  }
}

// Usage in providers
final ordersProvider = FutureProvider<List<Order>>((ref) async {
  final orderService = ref.read(orderServiceProvider);
  final tenantId = ref.read(tenantIdProvider);
  return await orderService.getOrders(tenantId);
});

// ❌ Bad: Business logic in widget
class OrdersScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    // Don't put API calls directly in widgets
    final orders = await http.get('/orders'); // ❌
  }
}
```

### 4. Extract Validation Logic

```dart
// ✅ Good: Reusable validators
// utils/validators.dart
class Validators {
  static String? phoneNumber(String? value) {
    if (value == null || value.isEmpty) {
      return 'Phone number is required';
    }
    if (!RegExp(r'^\+?[0-9]{8,15}$').hasMatch(value)) {
      return 'Invalid phone number format';
    }
    return null;
  }

  static String? email(String? value) {
    if (value == null || value.isEmpty) {
      return 'Email is required';
    }
    if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
      return 'Invalid email format';
    }
    return null;
  }
}

// Usage in multiple forms
TextFormField(
  validator: Validators.phoneNumber,
)
```

### 5. Extract Common Extensions

```dart
// ✅ Good: Reusable extensions
// utils/extensions.dart
extension StringExtension on String {
  String capitalize() {
    if (isEmpty) return this;
    return '${this[0].toUpperCase()}${substring(1)}';
  }

  bool isValidEmail() {
    return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(this);
  }
}

extension DateTimeExtension on DateTime {
  String toFormattedString() {
    return DateFormat('yyyy-MM-dd').format(this);
  }

  String toRelativeString() {
    final now = DateTime.now();
    final difference = now.difference(this);
    if (difference.inDays == 0) return 'Today';
    if (difference.inDays == 1) return 'Yesterday';
    if (difference.inDays < 7) return '${difference.inDays} days ago';
    return toFormattedString();
  }
}

// Usage
'hello'.capitalize() // 'Hello'
'user@example.com'.isValidEmail() // true
DateTime.now().toRelativeString() // 'Today'
```

### 6. Extract Common Providers

```dart
// ✅ Good: Reusable provider pattern
// providers/common/tenant_provider.dart
final tenantIdProvider = StateProvider<String?>((ref) => null);

final tenantProvider = FutureProvider<Tenant?>((ref) async {
  final tenantId = ref.watch(tenantIdProvider);
  if (tenantId == null) return null;

  final apiService = ref.read(apiServiceProvider);
  return await apiService.getTenant(tenantId);
});

// Usage in multiple screens
final tenant = ref.watch(tenantProvider);
```

### 7. Extract Common Mixins

```dart
// ✅ Good: Reusable mixin for common functionality
// mixins/loading_mixin.dart
mixin LoadingMixin<T extends StatefulWidget> on State<T> {
  bool _isLoading = false;

  bool get isLoading => _isLoading;

  void setLoading(bool value) {
    setState(() {
      _isLoading = value;
    });
  }
}

// Usage
class OrdersScreen extends StatefulWidget {
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> with LoadingMixin {
  @override
  Widget build(BuildContext context) {
    if (isLoading) return LoadingIndicator();
    // ...
  }
}
```

### 8. Extract Constants

```dart
// ✅ Good: Reusable constants
// constants/app_constants.dart
class AppConstants {
  // API
  static const String apiBaseUrl = 'https://api.cleanmatex.com';
  static const Duration apiTimeout = Duration(seconds: 30);

  // UI
  static const double defaultPadding = 16.0;
  static const double defaultBorderRadius = 8.0;
  static const double defaultSpacing = 8.0;

  // Limits
  static const int maxOrderItems = 100;
  static const int maxFileSizeMB = 10;

  // Timeouts
  static const Duration connectionTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
}

// Usage
Padding(
  padding: EdgeInsets.all(AppConstants.defaultPadding),
)
```

### 9. Extract Common Error Handling

```dart
// ✅ Good: Reusable error widget
// widgets/common/error_widget.dart
class AppErrorWidget extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;

  const AppErrorWidget({
    Key? key,
    required this.message,
    this.onRetry,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 48, color: Colors.red),
          SizedBox(height: 16),
          Text(message),
          if (onRetry != null) ...[
            SizedBox(height: 16),
            ElevatedButton(
              onPressed: onRetry,
              child: Text('Retry'),
            ),
          ],
        ],
      ),
    );
  }
}

// Usage
AppErrorWidget(
  message: 'Failed to load orders',
  onRetry: () => ref.refresh(ordersProvider),
)
```

### 10. Extract Common Formatters

```dart
// ✅ Good: Reusable formatters
// utils/formatters.dart
class Formatters {
  static String formatCurrency(double amount, BuildContext context) {
    final locale = Localizations.localeOf(context);
    final isArabic = locale.languageCode == 'ar';

    if (isArabic) {
      return '${amount.toStringAsFixed(2)} ر.ع';
    } else {
      return 'OMR ${amount.toStringAsFixed(2)}';
    }
  }

  static String formatPhoneNumber(String phone) {
    // Format: +968 9123 4567
    if (phone.startsWith('+968')) {
      return '${phone.substring(0, 4)} ${phone.substring(4, 8)} ${phone.substring(8)}';
    }
    return phone;
  }

  static String formatDate(DateTime date, BuildContext context) {
    final locale = Localizations.localeOf(context);
    return DateFormat('yyyy-MM-dd', locale.languageCode).format(date);
  }
}

// Usage
Text(Formatters.formatCurrency(25.50, context))
Text(Formatters.formatPhoneNumber('+96891234567'))
```

---

## Best Practices

### ✅ DO

- Use Riverpod for all state management
- Prefer const constructors
- Use StatelessWidget when possible
- Extract reusable widgets
- Use ListView.builder for long lists
- Handle errors gracefully with AsyncValue
- Test business logic with unit tests
- Support RTL for Arabic
- Follow naming conventions consistently
- Extract common logic to services, utilities, and mixins
- Use extensions for common operations
- Extract constants to dedicated files

### ❌ DON'T

- Don't use other state management solutions
- Don't create widgets in build methods
- Don't use setState for global state
- Don't forget to dispose providers
- Don't ignore errors
- Don't hardcode strings (use i18n)
- **Don't use Freezed or any code generation tools** - use plain Dart classes only
- **Don't use json_serializable** - implement JSON serialization manually
- **Don't use any hidden/generated code** - all code must be explicit and visible
- **Don't use `easy_localization` or `flutter_intl`** - use manual JSON loading with `flutter_localizations`
- Don't duplicate code - extract to reusable components
- Don't put business logic in widgets - use services
- Don't use magic numbers - use constants

---

## Related Documentation

- [PRD Implementation Rules](./prd-implementation_rules.md) - General coding standards
- [UI/UX Rules](./uiux-rules.md) - Design guidelines
- [i18n Rules](./i18n.md) - Internationalization details

---

## Return to [Main Documentation](../CLAUDE.md)
