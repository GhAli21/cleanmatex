import 'order_item_model.dart';
import 'order_timeline_step_model.dart';

class OrderDetailModel {
  const OrderDetailModel({
    required this.id,
    required this.orderNumber,
    required this.statusCode,
    required this.statusLabelKey,
    required this.garmentCount,
    required this.promisedWindow,
    required this.deliveryModeLabelKey,
    required this.timeline,
    this.items = const [],
    this.subtotal,
    this.total,
    this.paidAmount,
    this.paymentStatus,
    this.currencyCode,
    this.currencyDecimalPlaces = 2,
  });

  final String id;
  final String orderNumber;
  final String statusCode;
  final String statusLabelKey;
  final int garmentCount;
  final String promisedWindow;
  final String deliveryModeLabelKey;
  final List<OrderTimelineStepModel> timeline;

  /// Line items with individual prices.
  final List<OrderItemModel> items;

  final double? subtotal;
  final double? total;
  final double? paidAmount;

  /// Payment status code, e.g. 'paid', 'unpaid', 'partial'.
  final String? paymentStatus;

  /// ISO currency code, e.g. 'SAR', 'AED'.
  final String? currencyCode;
  final int currencyDecimalPlaces;
}
