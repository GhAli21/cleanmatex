import 'package:customer_app/features/orders/ui/cards/customer_order_statement_card.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_testkit/mobile_testkit.dart';

/// The `data` of the public financial view for a pay-on-collection order
/// paid 5.000 cash with a 1.000 wallet credit (Reusable Order Fin View P4-07).
Map<String, Object?> publicView({String state = 'dueAtCollection', String taxRole = 'additive'}) => {
      'currency': {'code': 'OMR', 'decimalPlaces': 3},
      'header': {
        'metrics': {'total': 10.975, 'paid': 5, 'credits': 1, 'balance': 4.975, 'refunded': 0},
        'balanceState': state,
      },
      'sections': {
        'items': {'key': 'items', 'status': 'ok', 'totals': [{'amount': 10, 'sign': 'plus', 'role': 'additive'}]},
        'charges': {'key': 'charges', 'status': 'ok', 'totals': [{'amount': 1, 'sign': 'plus', 'role': 'additive'}]},
        'discounts': {'key': 'discounts', 'status': 'ok', 'totals': [{'amount': 0.5, 'sign': 'minus', 'role': 'additive'}]},
        'taxes': {'key': 'taxes', 'status': 'ok', 'totals': [{'amount': 0.475, 'sign': 'plus', 'role': taxRole}]},
        'rounding': {'key': 'rounding', 'status': 'empty', 'totals': <Object?>[]},
        'payments': {
          'key': 'payments',
          'status': 'ok',
          'totals': [{'amount': 5, 'sign': 'minus', 'role': 'additive'}],
          'lines': [
            {'amount': 5, 'meta': {'methodCode': 'CASH'}},
          ],
        },
      },
    };

void main() {
  group('OrderFinancialStatementModel.fromJson', () {
    test('reads the server figures as they are, in statement order', () {
      final s = OrderFinancialStatementModel.fromJson(publicView())!;
      expect(s.total, 10.975);
      expect(s.balance, 4.975);
      expect(s.balanceState, 'dueAtCollection');
      expect(s.lines.map((l) => l.sectionKey), ['items', 'charges', 'discounts', 'taxes']);
      expect(s.lines[2].isReduction, isTrue);
      expect(s.tenders.single.methodCode, 'CASH');
    });

    test('tax-inclusive tax is marked included', () {
      final s = OrderFinancialStatementModel.fromJson(publicView(taxRole: 'included'))!;
      expect(s.lines.last.isIncluded, isTrue);
    });

    test('no figures from the server gives no statement, never zeros', () {
      expect(
        OrderFinancialStatementModel.fromJson({'currency': {'code': 'OMR', 'decimalPlaces': 3}, 'header': {'metrics': <String, Object?>{}, 'balanceState': null}, 'sections': <String, Object?>{}}),
        isNull,
      );
    });
  });

  testWidgets('the card shows the lines, the total and the balance word', (tester) async {
    final statement = OrderFinancialStatementModel.fromJson(publicView())!;
    await tester.pumpWidget(TestAppWrapper(child: CustomerOrderStatementCard(statement: statement)));
    await tester.pump();

    expect(find.text('Payment summary'), findsOneWidget);
    expect(find.text('Items & extras'), findsOneWidget);
    expect(find.text('Discounts'), findsOneWidget);
    expect(find.text('Cash'), findsOneWidget);
    expect(find.text('Credits'), findsOneWidget);
    expect(find.text('Due at collection'), findsOneWidget);
    expect(find.textContaining('4.975'), findsOneWidget);
  });
}
