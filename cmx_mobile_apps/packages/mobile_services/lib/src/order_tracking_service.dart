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
      final defaultCurrencyCode = data['currencyCode'] as String?;

      final orders = data['orders'];
      if (orders is! List) return const [];

      return orders
          .whereType<Map<String, Object?>>()
          .map((json) => _mapRemoteOrderSummary(
                json,
                defaultCurrencyCode: defaultCurrencyCode,
              ))
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

  OrderSummaryModel _mapRemoteOrderSummary(
    Map<String, Object?> json, {
    String? defaultCurrencyCode,
  }) {
    final statusCode = _normalizeStatusCode(json['status'] as String?);
    final totalItems = json['totalItems'];
    final bagCount = json['bagCount'];

    final src = json['orderSource'];
    final bool? remoteConfirm = src is Map<String, Object?>
        ? src['requiresRemoteIntakeConfirm'] as bool?
        : null;

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
      total: (json['total'] as num?)?.toDouble(),
      paymentStatus: json['paymentStatus'] as String?,
      currencyCode: (json['currencyCode'] as String?) ?? defaultCurrencyCode,
      physicalIntakeStatus: json['physicalIntakeStatus'] as String?,
      requiresRemoteIntakeConfirm: remoteConfirm,
    );
  }

  OrderDetailModel _mapRemoteOrderDetail(Map<String, Object?> json) {
    final order =
        json['order'] as Map<String, Object?>? ?? const <String, Object?>{};
    final statusCode = _normalizeStatusCode(order['status'] as String?);

    // Parse items
    final rawItems = order['items'];
    final items = rawItems is List
        ? rawItems
            .whereType<Map<String, Object?>>()
            .map(_mapOrderItem)
            .toList(growable: false)
        : const <OrderItemModel>[];

    final itemCount = items.fold<int>(0, (sum, i) => sum + i.quantity);

    // Parse totals block
    final totals =
        order['totals'] as Map<String, Object?>? ?? const <String, Object?>{};

    // Parse moneyConfig block
    final moneyConfig =
        json['moneyConfig'] as Map<String, Object?>? ?? const <String, Object?>{};

    return OrderDetailModel(
      id: order['id'] as String? ?? order['orderNo'] as String? ?? '',
      orderNumber: order['orderNo'] as String? ?? '',
      statusCode: statusCode,
      statusLabelKey: _statusLabelKey(statusCode),
      garmentCount: itemCount > 0
          ? itemCount
          : (order['bagCount'] as num?)?.toInt() ?? 0,
      promisedWindow: _formatPromisedWindow(
        order['readyBy'] as String? ?? order['receivedAt'] as String?,
      ),
      deliveryModeLabelKey: 'orders.deliveryMode.standard',
      timeline: _buildTimeline(statusCode),
      items: items,
      subtotal: (totals['subtotal'] as num?)?.toDouble(),
      total: (totals['total'] as num?)?.toDouble(),
      paidAmount: (totals['paidAmount'] as num?)?.toDouble(),
      paymentStatus: totals['paymentStatus'] as String?,
      currencyCode: moneyConfig['currencyCode'] as String?,
      currencyDecimalPlaces:
          (moneyConfig['decimalPlaces'] as num?)?.toInt() ?? 2,
    );
  }

  OrderItemModel _mapOrderItem(Map<String, Object?> json) {
    return OrderItemModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      name2: json['name2'] as String?,
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      totalPrice: (json['totalPrice'] as num?)?.toDouble() ?? 0.0,
    );
  }

  String _normalizeStatusCode(String? rawStatus) {
    final normalized = (rawStatus ?? '').trim().toLowerCase();
    switch (normalized) {
      case 'draft':
        return 'draft';
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
      total: 48.50,
      paymentStatus: 'unpaid',
      currencyCode: 'SAR',
    ),
    OrderSummaryModel(
      id: 'order-10018',
      orderNumber: 'CMX-10018',
      statusCode: 'out_for_delivery',
      statusLabelKey: 'orders.status.out_for_delivery',
      garmentCount: 5,
      promisedWindow: 'Tomorrow, 10:00 AM - 12:00 PM',
      total: 32.00,
      paymentStatus: 'paid',
      currencyCode: 'SAR',
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
        items: const [
          OrderItemModel(id: 'i1', name: 'Shirt', quantity: 3, totalPrice: 18.0),
          OrderItemModel(id: 'i2', name: 'Trousers', quantity: 2, totalPrice: 14.0),
        ],
        subtotal: 32.0,
        total: 32.0,
        paidAmount: 32.0,
        paymentStatus: 'paid',
        currencyCode: 'SAR',
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
      items: const [
        OrderItemModel(id: 'i3', name: 'Shirt', quantity: 4, totalPrice: 24.0),
        OrderItemModel(id: 'i4', name: 'Jacket', quantity: 2, totalPrice: 16.0),
        OrderItemModel(id: 'i5', name: 'Trousers', quantity: 2, totalPrice: 8.5),
      ],
      subtotal: 48.5,
      total: 48.5,
      paidAmount: 0.0,
      paymentStatus: 'unpaid',
      currencyCode: 'SAR',
    );
  }
}
