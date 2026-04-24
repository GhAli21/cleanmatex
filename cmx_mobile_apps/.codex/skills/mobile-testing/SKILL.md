---
name: mobile-testing
description: Testing and validation standards for CleanMateX mobile apps. Use when planning or writing unit, widget, integration, and release-readiness validation for Flutter code in cmx_mobile_apps.
user-invocable: true
---

# Mobile Testing

Use this skill for mobile test strategy and validation gates.

## Read First

Read these before defining or reviewing validation:

* `cmx_mobile_apps/docs/Implementation_docs/customer_app_production_milestone_plan.md`
* `cmx_mobile_apps/docs/MOBILE_FOUNDATION_DECISIONS.md`

Use the global `testing` skill as a general companion; this skill defines the mobile-specific bar.

## Core Rules

1. Manual QA is not enough for core customer flows.
2. Validation scope must match milestone risk.
3. Auth, tracking, and booking flows need automated coverage before production.
4. A visually polished screen is not complete if state transitions are untested.
5. `melos analyze` with zero warnings is a hard gate — not optional.
6. No `print()` or `debugPrint()` in committed mobile code.

## Validation Commands

```bash
melos bootstrap          # ensure workspace is linked before running tests
melos analyze            # zero warnings required — CI gate
melos format --check     # reject unformatted code — CI gate
melos test               # runs flutter test in all packages with test/ directories
```

For a single package:
```bash
cd packages/mobile_services && flutter test
cd apps/customer_app && flutter test
```

## Test Scaffolding

All widget tests use `TestAppWrapper` from `package:mobile_testkit/mobile_testkit.dart`:

```dart
import 'package:mobile_testkit/mobile_testkit.dart';

testWidgets('shows order count', (tester) async {
  await tester.pumpWidget(
    TestAppWrapper(child: OrderSummaryCard(order: mockOrder)),
  );
  expect(find.text('ORD-001'), findsOneWidget);
});
```

`TestAppWrapper` provides: `MaterialApp` with `AppTheme`, `AppLocalizations` (EN + AR), and `ProviderScope`.

Unit tests for providers use `ProviderContainer` with fake overrides:

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

## Coverage Priorities

Focus first on:

* Providers and notifiers — `AsyncValue` state transitions
* Repositories — error mapping to `AppException` subclasses
* Auth / session restore behavior
* Orders list and detail flows
* Booking flow
* Shared widget behavior (`AppErrorWidget`, `AppLoadingIndicatorWidget`, `AppCardWidget`)

## Coverage Targets (Recommended)

| Layer | Target |
|---|---|
| Providers / notifiers | 80% |
| Repositories | 70% |
| UI screens | 60% |

## Test Types

| Type | Use for |
|---|---|
| Unit (`ProviderContainer`) | Services, repositories, exception mapping, notifier state transitions, pure helpers |
| Widget (`TestAppWrapper`) | Auth entry screen, screen state variants (loading/error/empty/success), shared widgets |
| Integration | App startup, login/session restore, primary customer journey end-to-end |

Add golden/visual checks for shared UI only when the widget library is stable enough to justify them.

## Error Handling in Tests

Test the full `AppException` mapping chain — not just happy paths:

```dart
test('repository maps 401 to UnauthorizedException', () async {
  final repo = CustomerAuthRepository(
    service: FakeAuthService(throws: const UnauthorizedException()),
  );
  await expectLater(repo.login('phone'), throwsA(isA<UnauthorizedException>()));
});
```

## Validation by Milestone

| Milestone | Minimum validation |
|---|---|
| Early scaffold | `melos bootstrap` + `melos analyze` pass; basic smoke test |
| Foundation | Unit tests for services/helpers; one widget test for a shared UI component |
| Customer flow | Widget + integration coverage for the shipped journey |
| Release | Clean analysis, full test pass, successful release build |

## Anti-Patterns

Reject these:

* Relying only on manual device testing for auth and tracking flows
* Treating `melos analyze` success or build success as proof of UX correctness
* Shipping session restore behavior without automated restart checks
* Large feature work with no validation plan
* `print()` or `debugPrint()` in committed test or production code
* Widget tests without `TestAppWrapper` — raw `WidgetTester.pumpWidget` misses theme and localization
* Tests that pass with mocked repositories when real behavior diverges

## Required Output

When using this skill, state:

1. The affected milestone or feature
2. The minimum test layers required
3. The exact commands to run
4. Any remaining risk if full validation cannot be completed

## Validation Checklist

- [ ] `melos analyze` passes with zero warnings
- [ ] `melos format --check` passes
- [ ] `melos test` passes for all affected packages
- [ ] Widget tests use `TestAppWrapper`
- [ ] Provider unit tests use `ProviderContainer` with fake overrides
- [ ] Core customer journey has automated coverage where expected
- [ ] Session restore behavior is validated when affected
- [ ] No `print()` / `debugPrint()` in committed code
- [ ] Remaining gaps or residual risks are called out clearly
