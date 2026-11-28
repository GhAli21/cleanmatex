/// One pre-grouped money line in the POS-parity quote breakdown.
class PosQuoteRowModel {
  const PosQuoteRowModel({
    required this.id,
    required this.labelKey,
    this.label,
    required this.amount,
    this.rate,
  });

  final String id;
  final String labelKey;
  final String? label;
  final double amount;
  final double? rate;

  factory PosQuoteRowModel.fromJson(Map<String, Object?> json) {
    return PosQuoteRowModel(
      id: json['id'] as String? ?? '',
      labelKey: json['labelKey'] as String? ?? '',
      label: json['label'] as String?,
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      rate: (json['rate'] as num?)?.toDouble(),
    );
  }
}

/// Authoritative server-calculated POS-parity breakdown returned by
/// `POST /api/v1/public/customer/booking/quote`.
class PosQuoteBreakdownModel {
  const PosQuoteBreakdownModel({
    required this.currencyCode,
    this.grossRows = const [],
    this.discountRows = const [],
    this.taxRows = const [],
    this.subtotal = 0,
    this.discountTotal = 0,
    this.afterDiscounts = 0,
    this.taxTotal = 0,
    this.roundingAdjustment = 0,
    this.orderTotal = 0,
    this.giftCardApplied = 0,
    this.balanceDue = 0,
    this.balanceStatusCode = 'DUE_AT_COLLECTION',
    this.promoApplied = false,
    this.estimatedReadyByUtc,
    this.branchTimeZone,
    this.readyByMayVaryHint = true,
  });

  final String currencyCode;
  final List<PosQuoteRowModel> grossRows;
  final List<PosQuoteRowModel> discountRows;
  final List<PosQuoteRowModel> taxRows;
  final double subtotal;
  final double discountTotal;
  final double afterDiscounts;
  final double taxTotal;
  final double roundingAdjustment;
  final double orderTotal;
  final double giftCardApplied;
  final double balanceDue;
  final String balanceStatusCode;
  final bool promoApplied;
  final String? estimatedReadyByUtc;
  final String? branchTimeZone;
  final bool readyByMayVaryHint;

  factory PosQuoteBreakdownModel.fromJson(Map<String, Object?> json) {
    List<PosQuoteRowModel> parseRows(Object? raw) => (raw as List? ?? const [])
        .whereType<Map<String, Object?>>()
        .map(PosQuoteRowModel.fromJson)
        .toList(growable: false);

    return PosQuoteBreakdownModel(
      currencyCode: json['currencyCode'] as String? ?? 'OMR',
      grossRows: parseRows(json['grossRows']),
      discountRows: parseRows(json['discountRows']),
      taxRows: parseRows(json['taxRows']),
      subtotal: (json['subtotal'] as num?)?.toDouble() ?? 0,
      discountTotal: (json['discountTotal'] as num?)?.toDouble() ?? 0,
      afterDiscounts: (json['afterDiscounts'] as num?)?.toDouble() ?? 0,
      taxTotal: (json['taxTotal'] as num?)?.toDouble() ?? 0,
      roundingAdjustment: (json['roundingAdjustment'] as num?)?.toDouble() ?? 0,
      orderTotal: (json['orderTotal'] as num?)?.toDouble() ?? 0,
      giftCardApplied: (json['giftCardApplied'] as num?)?.toDouble() ?? 0,
      balanceDue: (json['balanceDue'] as num?)?.toDouble() ?? 0,
      balanceStatusCode:
          json['balanceStatusCode'] as String? ?? 'DUE_AT_COLLECTION',
      promoApplied: json['promoApplied'] == true,
      estimatedReadyByUtc: json['estimatedReadyByUtc'] as String?,
      branchTimeZone: json['branchTimeZone'] as String?,
      readyByMayVaryHint: json['readyByMayVaryHint'] != false,
    );
  }
}
