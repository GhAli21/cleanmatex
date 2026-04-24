import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

import 'mobile_http_client.dart';

class OrderTrackingServiceException extends AppException {
  const OrderTrackingServiceException({
    required super.code,
    required super.messageKey,
    super.originalError,
  });
}

class OrderTrackingService {
  OrderTrackingService({MobileHttpClient? httpClient, AppConfig? config})
      : _httpClient = httpClient ?? MobileHttpClient(config: config);

  final MobileHttpClient _httpClient;

  bool _useRemoteTracking(CustomerSessionModel? session) {
    return _httpClient.config.hasApiBaseUrl &&
        session != null &&
        !session.isGuest &&
        session.hasVerificationToken &&
        (session.tenantOrgId?.isNotEmpty ?? false);
  }

  Future<List<OrderSummaryModel>> fetchOrderSummaries(
    CustomerSessionModel? session,
  ) async {
    if (!_useRemoteTracking(session)) return _demoOrderSummaries;

    try {
      final payload = await _httpClient.getJson(
        '/api/v1/public/customer/orders',
        headers: {'Authorization': 'Bearer ${session!.verificationToken}'},
        queryParameters: {'tenantId': session.tenantOrgId!},
      );

      final data = payload['data'];
      if (data is! Map<String, Object?>) return const [];

      final orders = data['orders'];
      if (orders is! List) return const [];

      return orders
          .whereType<Map<String, Object?>>()
          .map(_mapRemoteOrderSummary)
          .toList(growable: false);
    } on MobileHttpException catch (error) {
      throw OrderTrackingServiceException(
        code: error.code,
        messageKey: 'orders.errorBody',
        originalError: error,
      );
    }
  }

  Future<OrderDetailModel> fetchOrderDetail({
    required CustomerSessionModel? session,
    required String orderNumber,
  }) async {
    if (!_useRemoteTracking(session)) return _demoOrderDetail(orderNumber);

    try {
      final payload = await _httpClient.getJson(
        '/api/v1/public/orders/${session!.tenantOrgId!}/$orderNumber',
        headers: {'Authorization': 'Bearer ${session.verificationToken}'},
      );

      final data = payload['data'];
      if (data is! Map<String, Object?>) {
        throw const OrderTrackingServiceException(
          code: 'orders_invalid_payload',
          messageKey: 'orders.detailErrorBody',
        );
      }

      return _mapRemoteOrderDetail(data);
    } on MobileHttpException catch (error) {
      throw OrderTrackingServiceException(
        code: error.code,
        messageKey: 'orders.detailErrorBody',
        originalError: error,
      );
    }
  }

  OrderSummaryModel _mapRemoteOrderSummary(Map<String, Object?> json) {
    final statusCode = _normalizeStatusCode(json['status'] as String?);
    final totalItems = json['totalItems'];
    final bagCount = json['bagCount'];

    return OrderSummaryModel(
      id: json['id'] as String? ?? json['orderNo'] as String? ?? '',
      orderNumber: json['orderNo'] as String? ?? '',
      statusCode: statusCode,
      statusLabelKey: _statusLabelKey(statusCode),
      garmentCount:
          (totalItems as num?)?.toInt() ?? (bagCount as num?)?.toInt() ?? 0,
      promisedWindow: _formatPromisedWindow(
        json['readyBy'] as String? ?? json['receivedAt'] as String?,
      ),
    );
  }

  OrderDetailModel _mapRemoteOrderDetail(Map<String, Object?> json) {
    final order =
        json['order'] as Map<String, Object?>? ?? const <String, Object?>{};
    final statusCode = _normalizeStatusCode(order['status'] as String?);
    final items = order['items'];
    final itemCount = items is List
        ? items.whereType<Map<String, Object?>>().fold<int>(
              0,
              (sum, item) => sum + ((item['quantity'] as num?)?.toInt() ?? 0),
            )
        : 0;

    return OrderDetailModel(
      id: order['id'] as String? ?? order['orderNo'] as String? ?? '',
      orderNumber: order['orderNo'] as String? ?? '',
      statusCode: statusCode,
      statusLabelKey: _statusLabelKey(statusCode),
      garmentCount: itemCount,
      promisedWindow: _formatPromisedWindow(
        order['readyBy'] as String? ?? order['receivedAt'] as String?,
      ),
      deliveryModeLabelKey: 'orders.deliveryMode.standard',
      timeline: _buildTimeline(statusCode),
    );
  }

  String _normalizeStatusCode(String? rawStatus) {
    final normalized = (rawStatus ?? '').trim().toLowerCase();
    switch (normalized) {
      case 'ready_for_delivery':
      case 'ready_for_pickup':
      case 'ready':
      case 'completed':
      case 'delivered':
      case 'out_for_delivery':
      case 'processing':
        return normalized;
      default:
        return 'processing';
    }
  }

  String _statusLabelKey(String statusCode) => 'orders.status.$statusCode';

  String _formatPromisedWindow(String? isoDateTime) {
    if (isoDateTime == null || isoDateTime.isEmpty) return '';
    final parsed = DateTime.tryParse(isoDateTime);
    if (parsed == null) return isoDateTime;
    final localDate = parsed.toLocal();
    final month = localDate.month.toString().padLeft(2, '0');
    final day = localDate.day.toString().padLeft(2, '0');
    final hour = localDate.hour.toString().padLeft(2, '0');
    final minute = localDate.minute.toString().padLeft(2, '0');
    return '$day/$month/${localDate.year} $hour:$minute';
  }

  List<OrderTimelineStepModel> _buildTimeline(String statusCode) {
    const stepCodes = ['received', 'processing', 'dispatch', 'arrival'];

    final completedCount = switch (statusCode) {
      'processing' => 2,
      'ready' || 'ready_for_delivery' || 'ready_for_pickup' => 3,
      'out_for_delivery' => 3,
      'completed' || 'delivered' => 4,
      _ => 1,
    };

    return List<OrderTimelineStepModel>.generate(stepCodes.length, (index) {
      return OrderTimelineStepModel(
        code: stepCodes[index],
        titleKey: 'orders.timeline.${stepCodes[index]}.title',
        descriptionKey: 'orders.timeline.${stepCodes[index]}.body',
        isCompleted: index < completedCount,
      );
    });
  }

  static const _demoOrderSummaries = <OrderSummaryModel>[
    OrderSummaryModel(
      id: 'order-10042',
      orderNumber: 'CMX-10042',
      statusCode: 'processing',
      statusLabelKey: 'orders.status.processing',
      garmentCount: 8,
      promisedWindow: 'Today, 6:00 PM - 8:00 PM',
    ),
    OrderSummaryModel(
      id: 'order-10018',
      orderNumber: 'CMX-10018',
      statusCode: 'out_for_delivery',
      statusLabelKey: 'orders.status.out_for_delivery',
      garmentCount: 5,
      promisedWindow: 'Tomorrow, 10:00 AM - 12:00 PM',
    ),
  ];

  OrderDetailModel _demoOrderDetail(String orderNumber) {
    if (orderNumber == 'CMX-10018') {
      return OrderDetailModel(
        id: 'order-10018',
        orderNumber: 'CMX-10018',
        statusCode: 'out_for_delivery',
        statusLabelKey: 'orders.status.out_for_delivery',
        garmentCount: 5,
        promisedWindow: 'Tomorrow, 10:00 AM - 12:00 PM',
        deliveryModeLabelKey: 'orders.deliveryMode.standard',
        timeline: _buildTimeline('out_for_delivery'),
      );
    }

    return OrderDetailModel(
      id: 'order-10042',
      orderNumber: 'CMX-10042',
      statusCode: 'processing',
      statusLabelKey: 'orders.status.processing',
      garmentCount: 8,
      promisedWindow: 'Today, 6:00 PM - 8:00 PM',
      deliveryModeLabelKey: 'orders.deliveryMode.standard',
      timeline: _buildTimeline('processing'),
    );
  }
}
