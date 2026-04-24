---
description: Flutter quality, testing, performance, and anti-pattern rules for CleanMateX
globs:
  - "cmx_mobile_apps/apps/customer_app/lib/**/*.dart"
  - "cmx_mobile_apps/apps/staff_app/lib/**/*.dart"
  - "cmx_mobile_apps/apps/driver_app/lib/**/*.dart"
  - "cmx_mobile_apps/packages/**/*.dart"
alwaysApply: true
---

# CleanMateX Flutter Quality Rules

## Performance

- Use `ListView.builder` / `SliverList` — never `ListView(children: [...])` for dynamic data
- Mark leaf widgets `const` wherever possible
- Extract subwidgets to reduce rebuild scope
- Avoid expensive work inside `build()` — no JSON parsing, no business logic
- Dispose controllers, subscriptions, and streams in `dispose()`
- Use `ref.watch` for reactive data; `ref.read` inside callbacks/event handlers only
- Use `ref.select` to avoid rebuilds when only one field of a state object changes:
  ```dart
  final isLoading = ref.watch(ordersNotifierProvider.select((s) => s.isLoading));
  ```
- Frame target: 60fps (16ms budget per frame)
- Images: use `cached_network_image`; max 2× device pixel ratio; WebP preferred; no asset over 500KB without justification

## Testing

Use `mobile_testkit` for all widget test scaffolding — `TestAppWrapper` provides theme, localization, and Riverpod context.

Write tests for business-critical logic first:

Priority targets:
- Authentication flows (OTP, session restore, logout)
- Order creation and editing
- Order status tracking
- Payment-related flows
- Repository / notifier behavior
- Localization-sensitive screens

Types of tests:
- Unit tests for notifiers/repositories using `ProviderContainer` with fakes
- Widget tests for critical screen states using `TestAppWrapper`
- Happy path and failure path coverage

Coverage targets (recommended):
- Providers / notifiers: 80%
- Repositories: 70%
- UI screens: 60%

Widget test pattern:
```dart
import 'package:mobile_testkit/mobile_testkit.dart';

testWidgets('shows order count', (tester) async {
  await tester.pumpWidget(
    TestAppWrapper(child: OrderSummaryCard(order: mockOrder)),
  );
  expect(find.text('ORD-001'), findsOneWidget);
});
```

Unit test pattern:
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

## Logging

Use `AppLogger` from `mobile_core` — never `print()` or `debugPrint()`.

In package-internal code where `AppLogger` is not yet wired, use `dart:developer` log as fallback:
```dart
import 'dart:developer';
log('debug value: $value', name: 'OrderTrackingService');
```

Log level policy:

| Environment | Active levels |
|---|---|
| DEV | All (debug and above) |
| STAGING | info and above |
| PROD | warning and above — no PII |

Must always log: provider state errors (via `ProviderObserver`), `AppException` with stack trace, auth events.

Must never log (in any environment): tokens, passwords, OTPs, payment data, full phone numbers, full request bodies with PII.

## Code Quality

- Comments explain **why**, not the obvious what
- Delete dead code — do not comment it out
- No silent `catch` blocks — always log or rethrow
- No placeholder or fake implementations shipped as production code
- One class per file
- Prefer guard clauses over deep nesting
- Start every function/method name with a verb: `loadOrders()`, `validatePhone()`, `handleSubmit()`
- Boolean variables prefixed with `is`, `has`, `can`, `should`: `isLoading`, `hasError`, `canDelete`
- Use complete words — no abbreviations except standard technical terms (`api`, `url`, `id`, `ui`, `http`, `otp`)

## Strong Anti-Patterns

Reject or refactor:
- Giant screens with inline everything
- Business logic or API calls in widget `build` methods
- Duplicated API / repository logic across features
- Raw JSON spread across UI layers
- Hardcoded strings, colors, spacing, or font sizes
- Silent `catch` blocks
- Fake / stub repository implementations treated as final
- Placeholder code shipped as production code
- Package bloat for trivial problems
- `print()` or `debugPrint()` left in committed code
- Raw `Map<String, dynamic>` passed through providers or widgets
- `MediaQuery.of(context).size.width` comparisons for layout — use `AppBreakpoints`

## Definition of Done

A feature is not done unless it has:
- Correct architecture placement (layer flow respected)
- EN + AR localization (both in the same commit)
- Loading / error / empty / success state handling
- Input validation
- Repository / provider integration
- Role and tenant awareness where relevant
- Tests for critical logic
- No mock or placeholder code in production paths
- `melos analyze` passes with zero warnings
- `dart format` applied

## Refactoring Rules

- Refactor only with clear benefit
- Do not rewrite stable working code for style alone
- Preserve behavior unless explicitly changing requirements
- Keep refactors incremental and verifiable

## Package Discipline

- Add packages only when they solve a real problem that existing packages cannot
- Prefer mature, maintained, widely used packages with high pub.dev scores
- Avoid packages that add magic or hidden behavior
- Never add a package to the root workspace `pubspec.yaml` — each app and package owns its own
- New packages require tech lead approval before merging

Banned packages: `supabase_flutter`, `freezed`, `build_runner`, `json_serializable`, `GetX`, `flutter_bloc`, `provider` (package), `easy_localization`, `flutter_intl`, `intl_utils`, `mobx`, `dio` (use `MobileHttpClient` instead)
