/// The measured part of an order line, as the server worked it out.
class OrderLineMeasureModel {
  const OrderLineMeasureModel({
    required this.qty,
    required this.symbol,
    required this.qtyDecimals,
    this.billedQty,
    this.symbol2,
    this.minBillableQty,
    this.billingIncrement,
    this.unitPrice,
  });

  /// What was measured (the whole line).
  final double qty;

  /// What is charged for; differs from [qty] after a minimum or billing step.
  final double? billedQty;

  /// Unit symbol, and its Arabic form when the unit has one.
  final String symbol;
  final String? symbol2;
  final int qtyDecimals;

  /// The product's minimum and billing step when the line was priced.
  final double? minBillableQty;
  final double? billingIncrement;

  /// Price of one unit.
  final double? unitPrice;

  bool get isBilledDifferently => billedQty != null && billedQty != qty;

  /// The minimum is why the line is billed for more than was measured.
  bool get isRaisedToMinimum =>
      isBilledDifferently && minBillableQty != null && qty < minBillableQty!;
}

/// The short tail that tells apart order lines of one product (measure, own
/// service speed, ordinal). Built by the server; the app only displays it.
class OrderLineQualifierModel {
  const OrderLineQualifierModel({
    this.measure,
    this.speedCode,
    this.speedName,
    this.speedName2,
    this.ordinal,
  });

  final OrderLineMeasureModel? measure;

  /// Set only when the line's speed differs from the order's.
  final String? speedCode;
  final String? speedName;
  final String? speedName2;
  final int? ordinal;

  /// Reads the `qualifier` of an order item. Null when the line has nothing to
  /// add (the server sends `{}`) or the field is missing.
  static OrderLineQualifierModel? fromJson(Object? json) {
    if (json is! Map<String, Object?> || json.isEmpty) return null;
    final speedNames = json['speedName'];
    final names = speedNames is Map<String, Object?> ? speedNames : null;
    return OrderLineQualifierModel(
      measure: _measureFromJson(json['measure']),
      speedCode: json['speedCode'] as String?,
      speedName: names?['name'] as String?,
      speedName2: names?['name2'] as String?,
      ordinal: (json['ordinal'] as num?)?.toInt(),
    );
  }

  /// Quantities arrive as decimal strings.
  static OrderLineMeasureModel? _measureFromJson(Object? json) {
    if (json is! Map<String, Object?>) return null;
    final qty = double.tryParse('${json['qty']}');
    final symbol = json['symbol'] as String?;
    if (qty == null || symbol == null) return null;
    return OrderLineMeasureModel(
      qty: qty,
      billedQty: double.tryParse('${json['billedQty']}'),
      symbol: symbol,
      symbol2: json['symbol2'] as String?,
      qtyDecimals: (json['qtyDecimals'] as num?)?.toInt() ?? 3,
      minBillableQty: double.tryParse('${json['minBillableQty']}'),
      billingIncrement: double.tryParse('${json['billingIncrement']}'),
      unitPrice: double.tryParse('${json['unitPrice']}'),
    );
  }
}
