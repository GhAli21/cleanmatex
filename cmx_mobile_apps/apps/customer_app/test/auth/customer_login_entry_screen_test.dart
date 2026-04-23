import 'package:customer_app/core/app_shell_controller.dart';
import 'package:customer_app/features/auth/ui/screens/customer_login_entry_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_testkit/mobile_testkit.dart';

void main() {
  testWidgets('shows phone entry fields and primary action', (tester) async {
    final controller = CustomerAppController();

    await tester.pumpWidget(
      CustomerAppScope(
        controller: controller,
        child: const TestAppWrapper(
          child: CustomerLoginEntryScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.byType(CustomerLoginEntryScreen), findsOneWidget);
    expect(find.text('Send verification code'), findsOneWidget);
    expect(find.text('Phone number'), findsOneWidget);
  });
}
