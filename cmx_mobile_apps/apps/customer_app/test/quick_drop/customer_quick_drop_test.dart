import 'package:customer_app/features/quick_drop/providers/customer_quick_drop_provider.dart';
import 'package:customer_app/features/quick_drop/ui/screens/customer_quick_drop_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_testkit/mobile_testkit.dart';

void main() {
  test('Fast Quick Drop supports optional catalog picker, free-text & submit',
      () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final notifier = container.read(customerQuickDropFlowProvider.notifier);
    await notifier.initialize();

    // Step 0: Branch is optional
    notifier.setBranchId(null);
    notifier.setPickupMode(CustomerPickupMode.storeDropoff);
    notifier.setDeliveryMode(CustomerDeliveryMode.storePickup);
    expect(notifier.canProceed(), isTrue);
    notifier.goNext();

    // Step 1: Add optional real catalog item AND free-text item
    var state = container.read(customerQuickDropFlowProvider);
    expect(state.stepIndex, 1);
    expect(state.categories, isNotEmpty);
    final cat = state.categories.first;
    final item = cat.items.first;
    notifier.addCatalogItemLine(category: cat, item: item);
    notifier.addFreeTextLine(itemName: '2 white thobes', quantity: 2);

    state = container.read(customerQuickDropFlowProvider);
    expect(state.draft.declaredLines.length, 2);
    expect(state.draft.declaredLines.first.productId, item.id);
    expect(state.draft.declaredLines.first.serviceCategoryCode, cat.id);
    expect(state.draft.declaredLines.last.productId, isNull);

    notifier.goNext();
    expect(container.read(customerQuickDropFlowProvider).stepIndex, 2);

    await notifier.submit();
    state = container.read(customerQuickDropFlowProvider);
    expect(state.hasSubmitted, isTrue);
    expect(state.submittedRequest?.requestNo, startsWith('REQ-'));
  });

  testWidgets('renders 3-step Fast Quick Drop UI in EN and Arabic RTL',
      (tester) async {
    await tester.pumpWidget(
      const TestAppWrapper(
        child: CustomerQuickDropScreen(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Collect from my address'), findsOneWidget);
    expect(find.text('Store Drop-off'), findsOneWidget);

    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(find.text('Estimated Bags & Pieces'), findsOneWidget);
    expect(find.text('Optional Item List'), findsOneWidget);

    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(find.text('Unpriced Quick Drop Request'), findsOneWidget);

    // Arabic RTL sanity check
    await tester.pumpWidget(
      const TestAppWrapper(
        locale: Locale('ar'),
        child: CustomerQuickDropScreen(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('استلام من عنواني'), findsOneWidget);
  });
}
