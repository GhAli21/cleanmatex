import 'package:customer_app/core/app_shell_controller.dart';
import 'package:customer_app/features/booking/providers/customer_order_booking_provider.dart';
import 'package:customer_app/features/booking/ui/screens/customer_order_booking_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_testkit/mobile_testkit.dart';

void main() {
  testWidgets('shows booking options after loading', (tester) async {
    final controller = CustomerAppController();
    final provider = CustomerOrderBookingProvider();

    await tester.pumpWidget(
      CustomerAppScope(
        controller: controller,
        child: TestAppWrapper(
          child: CustomerOrderBookingScreen(provider: provider),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.byType(CustomerOrderBookingScreen), findsOneWidget);
    expect(find.text('Wash and fold'), findsOneWidget);
    expect(find.text('Express care'), findsOneWidget);
  });
}
