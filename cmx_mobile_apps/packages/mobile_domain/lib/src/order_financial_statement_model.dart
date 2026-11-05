/// The customer-safe money statement of one order (Reusable Order Fin View
/// P6-12): the server's public projection, shown as it is. Flutter never
/// computes a total or a balance; every figure here is a server figure.
class OrderFinancialStatementModel {
  const OrderFinancialStatementModel({
    required this.currencyCode,
    required this.currencyDecimalPlaces,
    required this.total,
    required this.paid,
    required this.credits,
    required this.balance,
    required this.refunded,
    required this.balanceState,
    required this.lines,
    required this.tenders,
  });

  /// Parses `data` of `GET /api/v1/public/customer/orders/{orderNo}/financial-view`.
  /// Returns null when the server has no figures to show ("Financial data
  /// unavailable": snapshot not written or not healthy), never zeros.
  static OrderFinancialStatementModel? fromJson(Map<String, Object?> json) {
    final header = json['header'];
    final currency = json['currency'];
    final sections = json['sections'];
    if (header is! Map<String, Object?> || currency is! Map<String, Object?>) return null;
    final metrics = header['metrics'];
    final state = header['balanceState'] as String?;
    if (metrics is! Map<String, Object?> || state == null) return null;

    double? toAmount(Object? v) => v is num ? v.toDouble() : null;
    final sectionMap = sections is Map<String, Object?> ? sections : const <String, Object?>{};

    final lines = <OrderStatementLineModel>[];
    for (final key in _valueSectionOrder) {
      final section = sectionMap[key];
      if (section is! Map<String, Object?>) continue;
      final totals = section['totals'];
      if (totals is! List || totals.isEmpty || totals.first is! Map<String, Object?>) continue;
      final line = totals.first as Map<String, Object?>;
      final amount = toAmount(line['amount']);
      if (amount == null || amount == 0) continue;
      lines.add(OrderStatementLineModel(
        sectionKey: key,
        amount: amount,
        isReduction: line['sign'] == 'minus',
        isIncluded: line['role'] == 'included',
      ));
    }

    final tenders = <OrderStatementTenderModel>[];
    final payments = sectionMap['payments'];
    if (payments is Map<String, Object?> && payments['lines'] is List) {
      for (final raw in payments['lines'] as List) {
        if (raw is! Map<String, Object?>) continue;
        final meta = raw['meta'];
        final amount = toAmount(raw['amount']);
        if (amount == null) continue;
        tenders.add(OrderStatementTenderModel(
          methodCode: meta is Map<String, Object?> ? meta['methodCode'] as String? : null,
          amount: amount,
        ));
      }
    }

    return OrderFinancialStatementModel(
      currencyCode: currency['code'] as String?,
      currencyDecimalPlaces: (currency['decimalPlaces'] as num?)?.toInt(),
      total: toAmount(metrics['total']),
      paid: toAmount(metrics['paid']),
      credits: toAmount(metrics['credits']),
      balance: toAmount(metrics['balance']),
      refunded: toAmount(metrics['refunded']),
      balanceState: state,
      lines: List.unmodifiable(lines),
      tenders: List.unmodifiable(tenders),
    );
  }

  /// Value sections in statement order (items build up to the total).
  static const _valueSectionOrder = ['items', 'charges', 'discounts', 'taxes', 'rounding'];

  /// ISO code of the order's currency; null when unknown (shown as a bare number).
  final String? currencyCode;

  /// Minor-unit decimals of that currency; null when unknown.
  final int? currencyDecimalPlaces;
  final double? total;
  final double? paid;
  final double? credits;
  final double? balance;
  final double? refunded;

  /// Server word for the balance: due, dueAtCollection, dueOnInvoice, settled, overpaid.
  final String balanceState;

  /// The value lines that lead to the total (zero lines are omitted).
  final List<OrderStatementLineModel> lines;

  /// Payments grouped by tender (cash, card…), as the server totals them.
  final List<OrderStatementTenderModel> tenders;
}

/// One value line of the statement (items, charges, discounts, tax, rounding).
class OrderStatementLineModel {
  const OrderStatementLineModel({
    required this.sectionKey,
    required this.amount,
    required this.isReduction,
    required this.isIncluded,
  });

  final String sectionKey;

  /// Always the size of the line; [isReduction] carries the direction.
  final double amount;

  /// Discounts and rounding down reduce the total.
  final bool isReduction;

  /// Tax inside the prices (tax-inclusive): shown, never added again.
  final bool isIncluded;
}

/// One tender's total (for example, cash 5.000).
class OrderStatementTenderModel {
  const OrderStatementTenderModel({required this.methodCode, required this.amount});

  final String? methodCode;
  final double amount;
}
