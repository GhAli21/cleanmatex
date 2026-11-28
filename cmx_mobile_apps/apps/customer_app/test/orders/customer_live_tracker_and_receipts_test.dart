import 'package:customer_app/features/orders/ui/screens/customer_order_detail_screen.dart';
import 'package:customer_app/features/orders/ui/screens/customer_orders_screen.dart';
import 'package:customer_app/features/receipts/ui/widgets/customer_always_light_receipt_sheet_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_testkit/mobile_testkit.dart';
import 'package:mobile_ui/mobile_ui.dart';

void main() {
  testWidgets(
      'Order detail shows top flexible Horizontal/Vertical stepper and receipt button',
      (tester) async {
    await tester.pumpWidget(
      const TestAppWrapper(
        child: CustomerOrderDetailScreen(orderId: 'CMX-10042'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(AppProgressStepperWidget), findsOneWidget);
    expect(find.text('Tracking timeline'), findsOneWidget);
    expect(find.text('Horizontal'), findsOneWidget);
    expect(find.text('Vertical'), findsOneWidget);

    // Switch stepper orientation to Vertical and back to Horizontal
    await tester.tap(find.text('Vertical'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Horizontal'));
    await tester.pumpAndSettle();
  });

  testWidgets('Orders Hub switches between Active, Requests, and History tabs',
      (tester) async {
    await tester.pumpWidget(
      const TestAppWrapper(
        child: CustomerOrdersScreen(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Active'), findsOneWidget);
    expect(find.text('Requests'), findsOneWidget);
    expect(find.text('History'), findsOneWidget);

    await tester.tap(find.text('Requests'));
    await tester.pumpAndSettle();
    expect(find.text('No quick drop requests'), findsOneWidget);
  });

  testWidgets(
      'Always-Light digital receipt sheet forces Light paper brightness even in Dark Mode',
      (tester) async {
    await tester.pumpWidget(
      TestAppWrapper(
        theme: AppTheme.dark(),
        child: Builder(
          builder: (ctx) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () => showCustomerAlwaysLightReceiptSheet(
                  ctx,
                  orderNo: 'ORD-26-04182',
                ),
                child: const Text('Open Receipt'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Open Receipt'));
    await tester.pumpAndSettle();

    final paperTitleFinder = find.text('Digital VAT Receipt');
    expect(paperTitleFinder, findsOneWidget);
    final paperContext = tester.element(paperTitleFinder);
    expect(Theme.of(paperContext).brightness, Brightness.light);
    expect(find.byType(AppQrCardWidget), findsOneWidget);
  });
}
