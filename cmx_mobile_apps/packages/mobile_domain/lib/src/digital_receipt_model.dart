/// Summary row in the Customer App Digital Receipts list.
class DigitalReceiptSummaryModel {
  const DigitalReceiptSummaryModel({
    required this.orderId,
    required this.orderNo,
    required this.issuedAtUtc,
    this.itemCount = 0,
    this.currencyCode = 'OMR',
    this.totalAmount = 0,
    this.paidAmount = 0,
    this.outstandingAmount = 0,
    this.overpaidAmount = 0,
    this.balanceStatusCode = 'DUE',
    this.branchName,
    this.branchName2,
  });

  final String orderId;
  final String orderNo;
  final String issuedAtUtc;
  final int itemCount;
  final String currencyCode;
  final double totalAmount;
  final double paidAmount;
  final double outstandingAmount;
  final double overpaidAmount;
  final String balanceStatusCode;
  final String? branchName;
  final String? branchName2;

  bool get isSettled => balanceStatusCode == 'SETTLED';

  factory DigitalReceiptSummaryModel.fromJson(Map<String, Object?> json) {
    return DigitalReceiptSummaryModel(
      orderId: json['orderId'] as String? ?? '',
      orderNo: json['orderNo'] as String? ?? '',
      issuedAtUtc: json['issuedAtUtc'] as String? ?? '',
      itemCount: (json['itemCount'] as num?)?.toInt() ?? 0,
      currencyCode: json['currencyCode'] as String? ?? 'OMR',
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
      paidAmount: (json['paidAmount'] as num?)?.toDouble() ?? 0,
      outstandingAmount: (json['outstandingAmount'] as num?)?.toDouble() ?? 0,
      overpaidAmount: (json['overpaidAmount'] as num?)?.toDouble() ?? 0,
      balanceStatusCode: json['balanceStatusCode'] as String? ?? 'DUE',
      branchName: json['branchName'] as String?,
      branchName2: json['branchName2'] as String?,
    );
  }
}

/// One itemized line inside a bilingual VAT digital receipt.
class DigitalReceiptItemModel {
  const DigitalReceiptItemModel({
    required this.id,
    required this.name,
    this.name2,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotal,
  });

  final String id;
  final String name;
  final String? name2;
  final int quantity;
  final double unitPrice;
  final double lineTotal;

  factory DigitalReceiptItemModel.fromJson(Map<String, Object?> json) {
    return DigitalReceiptItemModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      name2: json['name2'] as String?,
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      unitPrice: (json['unitPrice'] as num?)?.toDouble() ?? 0,
      lineTotal: (json['lineTotal'] as num?)?.toDouble() ?? 0,
    );
  }
}

/// Complete always-light bilingual VAT digital receipt payload.
class DigitalReceiptDetailModel {
  const DigitalReceiptDetailModel({
    required this.orderId,
    required this.orderNo,
    required this.issuedAtUtc,
    required this.organizationName,
    this.organizationName2,
    this.vatNumber,
    this.crNumber,
    this.branchName,
    this.branchName2,
    this.currencyCode = 'OMR',
    this.subtotal = 0,
    this.discountTotal = 0,
    this.afterDiscounts = 0,
    this.taxTotal = 0,
    this.totalAmount = 0,
    this.paidAmount = 0,
    this.outstandingAmount = 0,
    this.overpaidAmount = 0,
    this.balanceStatusCode = 'DUE',
    this.qrPayload = '',
    this.items = const [],
  });

  final String orderId;
  final String orderNo;
  final String issuedAtUtc;
  final String organizationName;
  final String? organizationName2;
  final String? vatNumber;
  final String? crNumber;
  final String? branchName;
  final String? branchName2;
  final String currencyCode;
  final double subtotal;
  final double discountTotal;
  final double afterDiscounts;
  final double taxTotal;
  final double totalAmount;
  final double paidAmount;
  final double outstandingAmount;
  final double overpaidAmount;
  final String balanceStatusCode;
  final String qrPayload;
  final List<DigitalReceiptItemModel> items;

  factory DigitalReceiptDetailModel.fromJson(Map<String, Object?> json) {
    final rawItems = json['items'] as List? ?? const [];
    return DigitalReceiptDetailModel(
      orderId: json['orderId'] as String? ?? '',
      orderNo: json['orderNo'] as String? ?? '',
      issuedAtUtc: json['issuedAtUtc'] as String? ?? '',
      organizationName: json['organizationName'] as String? ?? '',
      organizationName2: json['organizationName2'] as String?,
      vatNumber: json['vatNumber'] as String?,
      crNumber: json['crNumber'] as String?,
      branchName: json['branchName'] as String?,
      branchName2: json['branchName2'] as String?,
      currencyCode: json['currencyCode'] as String? ?? 'OMR',
      subtotal: (json['subtotal'] as num?)?.toDouble() ?? 0,
      discountTotal: (json['discountTotal'] as num?)?.toDouble() ?? 0,
      afterDiscounts: (json['afterDiscounts'] as num?)?.toDouble() ?? 0,
      taxTotal: (json['taxTotal'] as num?)?.toDouble() ?? 0,
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
      paidAmount: (json['paidAmount'] as num?)?.toDouble() ?? 0,
      outstandingAmount: (json['outstandingAmount'] as num?)?.toDouble() ?? 0,
      overpaidAmount: (json['overpaidAmount'] as num?)?.toDouble() ?? 0,
      balanceStatusCode: json['balanceStatusCode'] as String? ?? 'DUE',
      qrPayload: json['qrPayload'] as String? ?? '',
      items: rawItems
          .whereType<Map<String, Object?>>()
          .map(DigitalReceiptItemModel.fromJson)
          .toList(growable: false),
    );
  }
}
