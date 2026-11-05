import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_services/mobile_services.dart';

const _config = AppConfig(
  appEnv: 'test',
  apiBaseUrl: 'https://api.test/',
  enableDebugLogs: false,
);
const _session = CustomerSessionModel(
  customerId: 'c1',
  phoneNumber: '+96890000000',
  isGuest: false,
  tenantOrgId: 't1',
  verificationToken: 'token',
);
const _draft = OrderBookingDraftModel(cartItems: {'item-1': 1});

OrderBookingService _serviceAnswering(int status, Map<String, Object?> body) {
  final client = MockClient(
    (_) async => http.Response(
      jsonEncode(body),
      status,
      headers: {'content-type': 'application/json'},
    ),
  );
  return OrderBookingService(
    httpClient: MobileHttpClient(client: client, config: _config),
  );
}

Future<String> _submitErrorKey(String errorCode) async {
  final service = _serviceAnswering(400, {
    'success': false,
    'errorCode': errorCode,
    'error': 'server text',
  });
  try {
    await service.submit(_draft, session: _session, fulfillmentType: 'pickup');
  } on OrderBookingServiceException catch (error) {
    return error.messageKey;
  }
  fail('submit should have failed with $errorCode');
}

void main() {
  group('P6-04: booking codes from the server-priced booking', () {
    test('maps the calculator and piece codes to customer messages', () async {
      expect(
        await _submitErrorKey('booking_piece_invalid'),
        'booking.pieceInvalidError',
      );
      expect(
        await _submitErrorKey('SERVICE_SPEED_INVALID'),
        'booking.speedInvalidError',
      );
      expect(
        await _submitErrorKey('PRODUCT_NOT_FOUND'),
        'booking.itemUnavailableError',
      );
      expect(
        await _submitErrorKey('PREFERENCE_NOT_AVAILABLE'),
        'booking.preferenceUnavailableError',
      );
      expect(
        await _submitErrorKey('PRICE_NOT_RESOLVED'),
        'booking.priceUnavailableError',
      );
    });

    test('shows laundry setup failures as a contact-the-laundry message',
        () async {
      for (final code in [
        'TIMEZONE_NOT_CONFIGURED',
        'MISSING_TENANT_CURRENCY',
        'PROFILE_ASSIGNMENT_REQUIRED',
        'PROFILE_INACTIVE',
      ]) {
        expect(await _submitErrorKey(code), 'booking.setupUnavailableError');
      }
      expect(
        await _submitErrorKey('booking_create_failed'),
        'booking.submitErrorBody',
      );
    });

    test('reads the server total and currency from the confirmation', () async {
      final service = _serviceAnswering(200, {
        'success': true,
        'data': {
          'orderId': 'o1',
          'orderNo': 'ORD-1',
          'totalAmount': '5.25',
          'currencyCode': 'OMR',
        },
      });
      final confirmation = await service.submit(
        _draft,
        session: _session,
        fulfillmentType: 'pickup',
      );
      expect(confirmation.orderNumber, 'ORD-1');
      expect(confirmation.totalAmount, '5.25');
      expect(confirmation.currencyCode, 'OMR');
    });
  });
}
