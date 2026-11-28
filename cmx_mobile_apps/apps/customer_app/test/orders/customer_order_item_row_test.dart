import 'package:customer_app/features/orders/ui/widgets/customer_order_item_row_vw.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_testkit/mobile_testkit.dart';

/// The `qualifier` of a measured line as the customer order API sends it
/// (quantities are decimal strings).
Map<String, Object?> measuredQualifier({
  String billed = '6',
  String? minimum,
  String? step,
}) =>
    {
      'measure': {
        'qty': '5.350000',
        'billedQty': billed,
        'uomCode': 'KG',
        'symbol': 'kg',
        'symbol2': 'كغ',
        'qtyDecimals': 3,
        'minBillableQty': minimum,
        'billingIncrement': step,
        'unitPrice': '1.200000',
      },
      'speedCode': 'EXPRESS',
      'speedName': {'name': 'Express', 'name2': 'مستعجل'},
      'ordinal': 2,
    };

Widget row(Object? qualifier, {String? unitPrice}) => TestAppWrapper(
      child: Scaffold(
        body: CustomerOrderItemRowVw(
          item: OrderItemModel(
            id: 'i1',
            name: 'Rug',
            name2: 'سجادة',
            quantity: 2,
            totalPrice: 7.2,
            qualifier: OrderLineQualifierModel.fromJson(qualifier),
          ),
          amount: '7.200 OMR',
          unitPrice: unitPrice,
        ),
      ),
    );

/// The visible text without the invisible direction isolates.
List<String> texts(WidgetTester tester) => tester
    .widgetList<Text>(find.byType(Text))
    .map((t) => t.data!.replaceAll(RegExp('[\u2068\u2069]'), ''))
    .toList();

void main() {
  test('an empty or missing qualifier adds nothing', () {
    expect(OrderLineQualifierModel.fromJson(<String, Object?>{}), isNull);
    expect(OrderLineQualifierModel.fromJson(null), isNull);
  });

  testWidgets(
      'a measured line shows measure, speed, ordinal and billed quantity',
      (tester) async {
    await tester.pumpWidget(row(measuredQualifier()));
    await tester.pump();

    expect(texts(tester),
        ['2× Rug', '5.35 kg · Express (2)', 'Billed: 6 kg', '7.200 OMR']);
  });

  testWidgets('billed equal to the measure shows no billed note',
      (tester) async {
    await tester.pumpWidget(row(measuredQualifier(billed: '5.35')));
    await tester.pump();

    expect(texts(tester), ['2× Rug', '5.35 kg · Express (2)', '7.200 OMR']);
  });

  testWidgets('the billed note says why and carries the unit price',
      (tester) async {
    await tester.pumpWidget(
        row(measuredQualifier(minimum: '6'), unitPrice: '1.200 OMR'));
    await tester.pump();
    expect(texts(tester)[2], 'Billed: 6 kg (minimum) × 1.200 OMR');

    await tester.pumpWidget(row(measuredQualifier(step: '0.5')));
    await tester.pump();
    expect(texts(tester)[2], 'Billed: 6 kg (per 0.5 kg)');
  });

  testWidgets('billed as measured puts the unit price after the measure',
      (tester) async {
    await tester.pumpWidget(
        row(measuredQualifier(billed: '5.35'), unitPrice: '1.200 OMR'));
    await tester.pump();

    expect(texts(tester)[1], '5.35 kg × 1.200 OMR · Express (2)');
  });

  testWidgets('a plain line shows only pieces, name and amount',
      (tester) async {
    await tester.pumpWidget(row(<String, Object?>{}));
    await tester.pump();

    expect(texts(tester), ['2× Rug', '7.200 OMR']);
  });
}
