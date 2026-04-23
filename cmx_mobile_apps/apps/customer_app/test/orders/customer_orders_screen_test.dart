import 'package:customer_app/core/app_shell_controller.dart';
import 'package:customer_app/features/orders/ui/screens/customer_orders_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_testkit/mobile_testkit.dart';

void main() {
  testWidgets('shows orders list after loading', (tester) async {
    final controller = CustomerAppController();

    await tester.pumpWidget(
      CustomerAppScope(
        controller: controller,
        child: const TestAppWrapper(
          child: CustomerOrdersScreen(),
        ),
      ),
    );

    await tester.pump();
    await tester.pump();

    expect(find.byType(CustomerOrdersScreen), findsOneWidget);
    expect(find.text('CMX-10042'), findsOneWidget);
    expect(find.text('CMX-10018'), findsOneWidget);
  });
}
