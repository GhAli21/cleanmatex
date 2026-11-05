import 'package:customer_app/features/booking/ui/screens/customer_order_booking_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_testkit/mobile_testkit.dart';

void main() {
  testWidgets('shows booking options after loading', (tester) async {
    await tester.pumpWidget(
      const TestAppWrapper(
        child: CustomerOrderBookingScreen(),
      ),
    );

    expect(find.byType(CustomerOrderBookingScreen), findsOneWidget);

    await tester.pumpAndSettle();

    expect(find.text('Standard shirt'), findsOneWidget);
    expect(find.text('Dress shirt'), findsOneWidget);
  });

  testWidgets('shows grouped preferences on booking step two', (tester) async {
    await tester.pumpWidget(
      const TestAppWrapper(
        child: CustomerOrderBookingScreen(),
      ),
    );

    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.add_circle_outline).first);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Continue'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(find.text('Service preferences'), findsWidgets);
    expect(find.text('Packing'), findsOneWidget); // UI uses l10n booking.step2.packingSection ('Packing'), not kind.name
    expect(find.text('Gentle wash'), findsOneWidget);

    await tester.tap(find.text('Gentle wash'));
    await tester.pumpAndSettle();

    // Per-piece rewrite (e8201264): selection is FilterChip.selected, not
    // the old order-level "Selected preferences" / "1 selected" summary.
    final gentleChip = find.widgetWithText(FilterChip, 'Gentle wash');
    expect(gentleChip, findsOneWidget);
    expect(tester.widget<FilterChip>(gentleChip).selected, isTrue);
  });
}
