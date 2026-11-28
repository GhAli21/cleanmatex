import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

import 'mobile_http_client.dart';

/// Service contract for Customer App Digital Receipts and Always-Light VAT invoices.
class DigitalReceiptService {
  DigitalReceiptService({MobileHttpClient? httpClient, AppConfig? config})
      : _httpClient = httpClient ?? MobileHttpClient(config: config);

  final MobileHttpClient _httpClient;

  Future<List<DigitalReceiptSummaryModel>> listReceipts({
    required String tenantId,
    required String bearerToken,
  }) async {
    if (!_httpClient.config.hasApiBaseUrl ||
        tenantId.isEmpty ||
        bearerToken.isEmpty) {
      return const [
        DigitalReceiptSummaryModel(
          orderId: 'demo-order-1',
          orderNo: 'ORD-26-04182',
          issuedAtUtc: '2026-11-27T10:15:00Z',
          itemCount: 5,
          currencyCode: 'OMR',
          totalAmount: 4.500,
          paidAmount: 0,
          outstandingAmount: 4.500,
          balanceStatusCode: 'DUE',
          branchName: 'Al Khuwair Main',
          branchName2: 'الفرع الرئيسي - الخوير',
        ),
        DigitalReceiptSummaryModel(
          orderId: 'demo-order-2',
          orderNo: 'ORD-26-03911',
          issuedAtUtc: '2026-11-19T14:20:00Z',
          itemCount: 6,
          currencyCode: 'OMR',
          totalAmount: 6.200,
          paidAmount: 6.200,
          outstandingAmount: 0,
          balanceStatusCode: 'SETTLED',
          branchName: 'Al Khuwair Main',
          branchName2: 'الفرع الرئيسي - الخوير',
        ),
      ];
    }

    final payload = await _httpClient.getJson(
      '/api/v1/public/customer/receipts',
      queryParameters: {'tenantId': tenantId},
      headers: {'Authorization': 'Bearer $bearerToken'},
    );
    final data = payload['data'];
    if (data is! List) return const [];
    return data
        .whereType<Map<String, Object?>>()
        .map(DigitalReceiptSummaryModel.fromJson)
        .toList(growable: false);
  }

  Future<DigitalReceiptDetailModel> getReceiptDetail({
    required String tenantId,
    required String bearerToken,
    required String orderNo,
  }) async {
    if (!_httpClient.config.hasApiBaseUrl ||
        tenantId.isEmpty ||
        bearerToken.isEmpty) {
      return DigitalReceiptDetailModel(
        orderId: 'demo-order-1',
        orderNo: orderNo,
        issuedAtUtc: '2026-11-27T10:15:00Z',
        organizationName: 'Al-Noor Laundry',
        organizationName2: 'مغسلة النور',
        vatNumber: 'OM110048291',
        branchName: 'Al Khuwair Main',
        branchName2: 'الفرع الرئيسي - الخوير',
        currencyCode: 'OMR',
        subtotal: 4.600,
        discountTotal: 0.314,
        afterDiscounts: 4.286,
        taxTotal: 0.214,
        totalAmount: 4.500,
        paidAmount: orderNo == 'ORD-26-03911' ? 4.500 : 0,
        outstandingAmount: orderNo == 'ORD-26-03911' ? 0 : 4.500,
        balanceStatusCode: orderNo == 'ORD-26-03911' ? 'SETTLED' : 'DUE',
        qrPayload: 'CMX|$orderNo|4.500|OMR',
        items: const [
          DigitalReceiptItemModel(
            id: '1',
            name: 'Dishdasha / Thobe',
            name2: 'دشداشة / ثوب',
            quantity: 2,
            unitPrice: 1.200,
            lineTotal: 2.400,
          ),
          DigitalReceiptItemModel(
            id: '2',
            name: 'Abaya (Delicate Steam)',
            name2: 'عباية (بخار لطيف)',
            quantity: 1,
            unitPrice: 1.800,
            lineTotal: 1.800,
          ),
        ],
      );
    }

    final payload = await _httpClient.getJson(
      '/api/v1/public/customer/receipts/${Uri.encodeComponent(orderNo)}',
      queryParameters: {'tenantId': tenantId},
      headers: {'Authorization': 'Bearer $bearerToken'},
    );
    final data = payload['data'];
    if (data is Map<String, Object?>) {
      return DigitalReceiptDetailModel.fromJson(data);
    }
    throw const MobileHttpException(
      code: 'invalid_receipt_payload',
      messageKey: 'common.remoteRequestError',
    );
  }
}
