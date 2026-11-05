import 'package:customer_app/features/booking/domain/booking_total_format.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('P6-04: booking confirmation total', () {
    test('uses the currency decimal places', () {
      expect(
        formatBookingTotal(
            amount: '5.25', currencyCode: 'OMR', localeTag: 'en'),
        '5.250 OMR',
      );
      expect(
        formatBookingTotal(
            amount: '11.5', currencyCode: 'SAR', localeTag: 'en'),
        '11.50 SAR',
      );
    });

    test('omits the line when the server sent no readable total', () {
      expect(
        formatBookingTotal(amount: null, currencyCode: 'OMR', localeTag: 'en'),
        isNull,
      );
      expect(
        formatBookingTotal(amount: 'abc', currencyCode: 'OMR', localeTag: 'en'),
        isNull,
      );
    });
  });
}
