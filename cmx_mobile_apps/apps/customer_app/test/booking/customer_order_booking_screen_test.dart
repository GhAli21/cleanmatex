import 'package:customer_app/features/booking/ui/screens/customer_order_booking_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_testkit/mobile_testkit.dart';

void main() {
  testWidgets('starts on Step 1/6 Fulfillment & Branch then advances to Items',
      (tester) async {
    await tester.pumpWidget(
      const TestAppWrapper(
        child: CustomerOrderBookingScreen(),
      ),
    );

    await tester.pumpAndSettle();

    // Step 1/6: Mandatory Fulfillment & Branch
    expect(find.text('Fulfillment & Branch'), findsOneWidget);
    expect(find.text('Collect from my address'), findsOneWidget);
    expect(find.text('Store Drop-off'), findsOneWidget);
    expect(find.text('Deliver to my address'), findsOneWidget);
    expect(find.text('Store Pickup'), findsOneWidget);

    // Advance to Step 2/6: Items
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(find.text('Standard shirt'), findsOneWidget);
    expect(find.text('Dress shirt'), findsOneWidget);

    // Add an item and advance to Step 3/6: Preferences (with profile toggle)
    await tester.tap(find.byIcon(Icons.add_circle_outline).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(find.text('Your Saved Care Preferences'), findsOneWidget);
    expect(
      find.text('Apply my default preferences to all pieces'),
      findsOneWidget,
    );
  });
}
