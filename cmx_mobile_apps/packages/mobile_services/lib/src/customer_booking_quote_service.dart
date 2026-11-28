import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

import 'mobile_http_client.dart';

/// Live POS-parity server quote service (`POST /api/v1/public/customer/booking/quote`).
class CustomerBookingQuoteService {
  CustomerBookingQuoteService({MobileHttpClient? httpClient, AppConfig? config})
      : _httpClient = httpClient ?? MobileHttpClient(config: config);

  final MobileHttpClient _httpClient;

  Future<PosQuoteBreakdownModel> fetchServerQuote({
    required String tenantId,
    required String bearerToken,
    required OrderBookingDraftModel draft,
  }) async {
    if (!_httpClient.config.hasApiBaseUrl ||
        draft.branchId == null ||
        tenantId.isEmpty ||
        bearerToken.isEmpty) {
      return const PosQuoteBreakdownModel(
        currencyCode: 'OMR',
        readyByMayVaryHint: true,
      );
    }

    final itemsPayload = draft.cartItems.entries
        .where((e) => e.value > 0)
        .map((entry) {
          final pieces = draft.piecePreferences[entry.key];
          return {
            'itemId': entry.key,
            'qty': entry.value,
            if (pieces != null && pieces.isNotEmpty)
              'pieces': [
                for (var i = 0; i < pieces.length; i++)
                  {
                    'pieceSeq': i + 1,
                    'servicePreferenceIds': pieces[i].servicePreferenceIds,
                    if (pieces[i].packingPrefCode != null)
                      'packingPrefCode': pieces[i].packingPrefCode,
                  },
              ],
          };
        })
        .toList(growable: false);

    if (itemsPayload.isEmpty) {
      return const PosQuoteBreakdownModel(
        currencyCode: 'OMR',
        readyByMayVaryHint: true,
      );
    }

    final payload = await _httpClient.postJson(
      '/api/v1/public/customer/booking/quote',
      headers: {'Authorization': 'Bearer $bearerToken'},
      body: {
        'tenantId': tenantId,
        'branchId': draft.branchId,
        if (draft.serviceSpeed != null) 'serviceSpeed': draft.serviceSpeed,
        'items': itemsPayload,
        'servicePreferenceIds': draft.selectedServicePreferenceIds,
        'pickupPreferenceIds': draft.selectedPickupPreferenceIds,
        if (draft.promoCode.trim().isNotEmpty)
          'promoCode': draft.promoCode.trim(),
        if (draft.giftCardCode.trim().isNotEmpty)
          'giftCardNumber': draft.giftCardCode.trim(),
      },
    );

    final data = payload['data'];
    if (data is Map<String, Object?>) {
      return PosQuoteBreakdownModel.fromJson(data);
    }
    throw const MobileHttpException(
      code: 'invalid_quote_payload',
      messageKey: 'common.remoteRequestError',
    );
  }
}
