import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

import 'mobile_http_client.dart';

/// Service contract for Customer Fast Quick Drop requests (`org_ord_requests_mst`).
class QuickDropService {
  QuickDropService({MobileHttpClient? httpClient, AppConfig? config})
      : _httpClient = httpClient ?? MobileHttpClient(config: config);

  final MobileHttpClient _httpClient;

  Future<List<QuickDropRequestModel>> listRequests({
    required String tenantId,
    required String bearerToken,
  }) async {
    if (!_httpClient.config.hasApiBaseUrl ||
        tenantId.isEmpty ||
        bearerToken.isEmpty) {
      return const [];
    }

    final payload = await _httpClient.getJson(
      '/api/v1/public/customer/requests',
      queryParameters: {'tenantId': tenantId},
      headers: {'Authorization': 'Bearer $bearerToken'},
    );
    final data = payload['data'];
    if (data is! List) return const [];
    return data
        .whereType<Map<String, Object?>>()
        .map(QuickDropRequestModel.fromJson)
        .toList(growable: false);
  }

  Future<QuickDropRequestModel> submitRequest({
    required String tenantId,
    required String bearerToken,
    required QuickDropDraftModel draft,
    required String idempotencyKey,
  }) async {
    if (!_httpClient.config.hasApiBaseUrl ||
        tenantId.isEmpty ||
        bearerToken.isEmpty) {
      return QuickDropRequestModel(
        id: 'demo-req-${DateTime.now().millisecondsSinceEpoch}',
        requestNo: 'REQ-26-DEMO01',
        requestStatusCode: 'SUBMITTED',
        requestedBranchId: draft.requestedBranchId,
        collectionMethodCode: draft.pickupMode == CustomerPickupMode.collectAddress
            ? 'COLLECT_FROM_ADDRESS'
            : 'DROP_OFF',
        deliveryModeCode: draft.deliveryMode == CustomerDeliveryMode.deliverAddress
            ? 'DELIVER_ADDRESS'
            : 'STORE_PICKUP',
        serviceSpeedCode: draft.serviceSpeedCode,
        estimatedTotalBags: draft.estimatedTotalBags,
        estimatedTotalPieces: draft.estimatedTotalPieces,
        customerNotes: draft.customerNotes,
        submittedAt: DateTime.now().toUtc().toIso8601String(),
        lines: draft.declaredLines,
      );
    }

    final payload = await _httpClient.postJson(
      '/api/v1/public/customer/requests',
      headers: {
        'Authorization': 'Bearer $bearerToken',
        'Idempotency-Key': idempotencyKey,
      },
      body: {
        'tenantId': tenantId,
        if (draft.requestedBranchId != null)
          'requestedBranchId': draft.requestedBranchId,
        'pickupMode': draft.pickupMode.wireValue,
        'deliveryMode': draft.deliveryMode.wireValue,
        if (draft.pickupAddressId != null)
          'pickupAddressId': draft.pickupAddressId,
        if (draft.deliveryAddressId != null)
          'deliveryAddressId': draft.deliveryAddressId,
        if (draft.serviceSpeedCode != null)
          'serviceSpeedCode': draft.serviceSpeedCode,
        'estimatedTotalBags': draft.estimatedTotalBags,
        'estimatedTotalPieces': draft.estimatedTotalPieces,
        if (draft.customerNotes.trim().isNotEmpty)
          'customerNotes': draft.customerNotes.trim(),
        'declaredLines':
            draft.declaredLines.map((l) => l.toSubmitJson()).toList(),
      },
    );

    final data = payload['data'];
    if (data is Map<String, Object?>) {
      return QuickDropRequestModel.fromJson(data);
    }
    throw const MobileHttpException(
      code: 'invalid_quick_drop_payload',
      messageKey: 'common.remoteRequestError',
    );
  }

  Future<QuickDropRequestModel> cancelRequest({
    required String tenantId,
    required String bearerToken,
    required String requestId,
    String? reason,
  }) async {
    final payload = await _httpClient.patchJson(
      '/api/v1/public/customer/requests/$requestId',
      headers: {'Authorization': 'Bearer $bearerToken'},
      body: {
        'tenantId': tenantId,
        'action': 'cancel',
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      },
    );
    final data = payload['data'];
    if (data is Map<String, Object?>) {
      return QuickDropRequestModel.fromJson(data);
    }
    throw const MobileHttpException(
      code: 'invalid_quick_drop_payload',
      messageKey: 'common.remoteRequestError',
    );
  }
}
