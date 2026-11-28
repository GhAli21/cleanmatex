import 'package:customer_app/features/auth/ui/screens/customer_login_entry_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_testkit/mobile_testkit.dart';

void main() {
  testWidgets('shows phone entry fields and primary action', (tester) async {
    await tester.pumpWidget(
      const TestAppWrapper(
        child: CustomerLoginEntryScreen(),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.byType(CustomerLoginEntryScreen), findsOneWidget);
    expect(find.text('Find your laundries'), findsOneWidget);
    expect(find.text('Find'), findsOneWidget);
    expect(find.text('Phone number'), findsOneWidget);
    expect(find.text('SMS'), findsOneWidget);
    expect(find.text('Email'), findsOneWidget);
  });
}
