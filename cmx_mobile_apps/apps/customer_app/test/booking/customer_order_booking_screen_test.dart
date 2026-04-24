import 'package:customer_app/features/booking/ui/screens/customer_order_booking_screen.dart';
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

    expect(find.text('Wash and fold'), findsOneWidget);
    expect(find.text('Express care'), findsOneWidget);
  });
}
