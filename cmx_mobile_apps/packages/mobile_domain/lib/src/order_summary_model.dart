class OrderSummaryModel {
  const OrderSummaryModel({
    required this.id,
    required this.orderNumber,
    required this.statusCode,
    required this.statusLabelKey,
    required this.garmentCount,
    required this.promisedWindow,
  });

  final String id;
  final String orderNumber;
  final String statusCode;
  final String statusLabelKey;
  final int garmentCount;
  final String promisedWindow;
}
