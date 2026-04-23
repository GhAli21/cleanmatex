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
  });

  final String id;
  final String orderNumber;
  final String statusCode;
  final String statusLabelKey;
  final int garmentCount;
  final String promisedWindow;
  final String deliveryModeLabelKey;
  final List<OrderTimelineStepModel> timeline;
}
