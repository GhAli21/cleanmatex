class OrderSummaryModel {
  const OrderSummaryModel({
    required this.id,
    required this.orderNumber,
    required this.statusCode,
    required this.statusLabelKey,
    required this.garmentCount,
    required this.promisedWindow,
    this.total,
    this.paymentStatus,
    this.currencyCode,
    this.physicalIntakeStatus,
    this.requiresRemoteIntakeConfirm,
  });

  final String id;
  final String orderNumber;
  final String statusCode;
  final String statusLabelKey;
  final int garmentCount;
  final String promisedWindow;

  /// Order grand total (may be null if not yet calculated).
  final double? total;

  /// Payment status code, e.g. 'paid', 'unpaid', 'partial'.
  final String? paymentStatus;

  /// ISO currency code, e.g. 'SAR', 'AED'.
  final String? currencyCode;

  /// Server physical intake flag, e.g. `pending_dropoff`.
  final String? physicalIntakeStatus;

  /// When true, customer should bring items to the branch (remote booking).
  final bool? requiresRemoteIntakeConfirm;
}
