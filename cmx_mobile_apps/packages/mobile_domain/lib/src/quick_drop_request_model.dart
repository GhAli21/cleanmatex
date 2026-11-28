import 'order_booking_draft_model.dart';

/// One optional customer-declared item row for a Fast Quick Drop request.
class QuickDropDeclaredLineModel {
  const QuickDropDeclaredLineModel({
    this.id,
    this.lineNo = 1,
    this.serviceCategoryCode,
    this.productId,
    required this.itemName,
    this.quantity = 1,
    this.customerNotes,
  });

  final String? id;
  final int lineNo;
  final String? serviceCategoryCode;
  final String? productId;
  final String itemName;
  final int quantity;
  final String? customerNotes;

  factory QuickDropDeclaredLineModel.fromJson(Map<String, Object?> json) {
    return QuickDropDeclaredLineModel(
      id: json['id'] as String?,
      lineNo: (json['lineNo'] as num?)?.toInt() ?? 1,
      serviceCategoryCode: json['serviceCategoryCode'] as String?,
      productId: json['productId'] as String?,
      itemName: json['itemName'] as String? ?? '',
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      customerNotes: json['customerNotes'] as String?,
    );
  }

  Map<String, Object?> toSubmitJson() => {
        if (serviceCategoryCode != null)
          'serviceCategoryCode': serviceCategoryCode,
        if (productId != null) 'productId': productId,
        'itemName': itemName,
        'quantity': quantity,
        if (customerNotes != null && customerNotes!.trim().isNotEmpty)
          'customerNotes': customerNotes!.trim(),
      };
}

/// Customer-visible Fast Quick Drop unpriced request summary/detail.
class QuickDropRequestModel {
  const QuickDropRequestModel({
    required this.id,
    required this.requestNo,
    required this.requestStatusCode,
    this.branchVerificationStatus = 'NOT_REQUIRED',
    this.requestedBranchId,
    this.requestedBranchName,
    this.requestedBranchName2,
    this.collectionMethodCode = 'DROP_OFF',
    this.deliveryModeCode = 'STORE_PICKUP',
    this.serviceSpeedCode,
    this.estimatedTotalBags = 1,
    this.estimatedTotalPieces = 0,
    this.customerNotes,
    required this.submittedAt,
    this.linkedOrderId,
    this.linkedOrderNo,
    this.lines = const [],
  });

  final String id;
  final String requestNo;
  final String requestStatusCode;
  final String branchVerificationStatus;
  final String? requestedBranchId;
  final String? requestedBranchName;
  final String? requestedBranchName2;
  final String collectionMethodCode;
  final String deliveryModeCode;
  final String? serviceSpeedCode;
  final int estimatedTotalBags;
  final int estimatedTotalPieces;
  final String? customerNotes;
  final String submittedAt;
  final String? linkedOrderId;
  final String? linkedOrderNo;
  final List<QuickDropDeclaredLineModel> lines;

  bool get isConvertible =>
      requestStatusCode == 'SUBMITTED' ||
      requestStatusCode == 'IN_REVIEW' ||
      requestStatusCode == 'AWAITING_CUSTOMER';

  factory QuickDropRequestModel.fromJson(Map<String, Object?> json) {
    final rawLines = json['lines'] as List? ?? const [];
    return QuickDropRequestModel(
      id: json['id'] as String? ?? '',
      requestNo: json['requestNo'] as String? ?? '',
      requestStatusCode: json['requestStatusCode'] as String? ?? 'SUBMITTED',
      branchVerificationStatus:
          json['branchVerificationStatus'] as String? ?? 'NOT_REQUIRED',
      requestedBranchId: json['requestedBranchId'] as String?,
      requestedBranchName: json['requestedBranchName'] as String?,
      requestedBranchName2: json['requestedBranchName2'] as String?,
      collectionMethodCode:
          json['collectionMethodCode'] as String? ?? 'DROP_OFF',
      deliveryModeCode: json['deliveryModeCode'] as String? ?? 'STORE_PICKUP',
      serviceSpeedCode: json['serviceSpeedCode'] as String?,
      estimatedTotalBags: (json['estimatedTotalBags'] as num?)?.toInt() ?? 1,
      estimatedTotalPieces:
          (json['estimatedTotalPieces'] as num?)?.toInt() ?? 0,
      customerNotes: json['customerNotes'] as String?,
      submittedAt: json['submittedAt'] as String? ?? '',
      linkedOrderId: json['linkedOrderId'] as String?,
      linkedOrderNo: json['linkedOrderNo'] as String?,
      lines: rawLines
          .whereType<Map<String, Object?>>()
          .map(QuickDropDeclaredLineModel.fromJson)
          .toList(growable: false),
    );
  }
}

/// Client draft for the 3-step Fast Quick Drop flow.
class QuickDropDraftModel {
  const QuickDropDraftModel({
    this.requestedBranchId,
    this.pickupMode = CustomerPickupMode.collectAddress,
    this.deliveryMode = CustomerDeliveryMode.deliverAddress,
    this.pickupAddressId,
    this.deliveryAddressId,
    this.serviceSpeedCode,
    this.estimatedTotalBags = 1,
    this.estimatedTotalPieces = 8,
    this.customerNotes = '',
    this.declaredLines = const [],
  });

  final String? requestedBranchId;
  final CustomerPickupMode pickupMode;
  final CustomerDeliveryMode deliveryMode;
  final String? pickupAddressId;
  final String? deliveryAddressId;
  final String? serviceSpeedCode;
  final int estimatedTotalBags;
  final int estimatedTotalPieces;
  final String customerNotes;
  final List<QuickDropDeclaredLineModel> declaredLines;

  QuickDropDraftModel copyWith({
    String? requestedBranchId,
    bool clearBranch = false,
    CustomerPickupMode? pickupMode,
    CustomerDeliveryMode? deliveryMode,
    String? pickupAddressId,
    String? deliveryAddressId,
    String? serviceSpeedCode,
    int? estimatedTotalBags,
    int? estimatedTotalPieces,
    String? customerNotes,
    List<QuickDropDeclaredLineModel>? declaredLines,
  }) {
    return QuickDropDraftModel(
      requestedBranchId:
          clearBranch ? null : (requestedBranchId ?? this.requestedBranchId),
      pickupMode: pickupMode ?? this.pickupMode,
      deliveryMode: deliveryMode ?? this.deliveryMode,
      pickupAddressId: pickupAddressId ?? this.pickupAddressId,
      deliveryAddressId: deliveryAddressId ?? this.deliveryAddressId,
      serviceSpeedCode: serviceSpeedCode ?? this.serviceSpeedCode,
      estimatedTotalBags: estimatedTotalBags ?? this.estimatedTotalBags,
      estimatedTotalPieces: estimatedTotalPieces ?? this.estimatedTotalPieces,
      customerNotes: customerNotes ?? this.customerNotes,
      declaredLines: declaredLines ?? this.declaredLines,
    );
  }
}
