import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

import 'mobile_http_client.dart';

class OrderBookingServiceException extends AppException {
  const OrderBookingServiceException({
    required super.code,
    required super.messageKey,
    super.originalError,
  });
}

class BookingConfirmationModel {
  const BookingConfirmationModel({
    required this.orderId,
    required this.orderNumber,
    this.promisedWindow,
    this.totalAmount,
    this.currencyCode,
  });

  final String orderId;
  final String orderNumber;
  final String? promisedWindow;

  /// What the customer owes, as the server priced it (decimal text); shown, never recalculated.
  final String? totalAmount;
  final String? currencyCode;
}

class BookingBootstrapModel {
  const BookingBootstrapModel({
    this.bookingEnabled = true,
    this.disabledReasonKey,
    required this.services,
    required this.addresses,
    required this.slots,
    this.categories = const [],
    this.preferenceKinds = const [],
    this.servicePreferences = const [],
    this.pickupPreferences = const [],
    this.vatRate = 0.0,
    this.currencyCode = 'OMR',
    this.serviceSpeeds = const [],
    this.customerProfile,
  });

  final bool bookingEnabled;
  final String? disabledReasonKey;
  final List<ServiceOptionModel> services;
  final List<AddressOptionModel> addresses;
  final List<PickupSlotModel> slots;
  final List<BookingCatalogCategoryModel> categories;
  final List<BookingPreferenceKindModel> preferenceKinds;
  final List<BookingPreferenceOptionModel> servicePreferences;
  final List<BookingPreferenceOptionModel> pickupPreferences;
  final double vatRate;
  final String currencyCode;
  final List<BookingServiceSpeedModel> serviceSpeeds;
  final CustomerProfileModel? customerProfile;
}

class OrderBookingService {
  OrderBookingService({MobileHttpClient? httpClient, AppConfig? config})
      : _httpClient = httpClient ?? MobileHttpClient(config: config);

  final MobileHttpClient _httpClient;

  bool _useRemoteBooking(CustomerSessionModel? session) {
    return _httpClient.config.hasApiBaseUrl &&
        session != null &&
        !session.isGuest &&
        session.hasVerificationToken &&
        (session.tenantOrgId?.isNotEmpty ?? false);
  }

  Future<BookingBootstrapModel> loadBootstrap(
    CustomerSessionModel? session, {
    String? branchId,
  }) async {
    if (!_useRemoteBooking(session)) {
      return BookingBootstrapModel(
        bookingEnabled: true,
        services: _demoServices,
        addresses: _demoAddresses,
        slots: _demoSlots(),
        categories: _demoCategories,
        preferenceKinds: _demoPreferenceKinds,
        servicePreferences: _demoServicePreferences,
        pickupPreferences: _demoPickupPreferences,
        vatRate: 0.05,
        currencyCode: 'OMR',
        serviceSpeeds: _demoServiceSpeeds,
        customerProfile: _demoCustomerProfile,
      );
    }

    final effectiveBranchId =
        (branchId != null && branchId.isNotEmpty) ? branchId : session!.branchId;

    try {
      final payload = await _httpClient.getJson(
        '/api/v1/public/customer/booking',
        headers: {'Authorization': 'Bearer ${session!.verificationToken}'},
        queryParameters: {
          'tenantId': session.tenantOrgId!,
          if ((effectiveBranchId ?? '').isNotEmpty) 'branchId': effectiveBranchId!,
        },
      );

      final data = payload['data'];
      if (data is! Map<String, Object?>) {
        throw const OrderBookingServiceException(
          code: 'booking_invalid_payload',
          messageKey: 'booking.errorBody',
        );
      }

      final services = (data['services'] as List? ?? const [])
          .whereType<Map<String, Object?>>()
          .map(_mapRemoteService)
          .toList(growable: false);
      final addresses = (data['addresses'] as List? ?? const [])
          .whereType<Map<String, Object?>>()
          .map(_mapRemoteAddress)
          .toList(growable: false);
      final slots = (data['slots'] as List? ?? const [])
          .whereType<Map<String, Object?>>()
          .map(_mapRemoteSlot)
          .toList(growable: false);
      final categories = (data['categories'] as List? ?? const [])
          .whereType<Map<String, Object?>>()
          .map(BookingCatalogCategoryModel.fromJson)
          .toList(growable: false);
      final servicePreferences =
          (data['servicePreferences'] as List? ?? const [])
              .whereType<Map<String, Object?>>()
              .map(BookingPreferenceOptionModel.fromJson)
              .toList(growable: false);
      final pickupPreferences = (data['pickupPreferences'] as List? ?? const [])
          .whereType<Map<String, Object?>>()
          .map(BookingPreferenceOptionModel.fromJson)
          .toList(growable: false);
      final preferenceKinds = (data['preferenceKinds'] as List? ?? const [])
          .whereType<Map<String, Object?>>()
          .map(BookingPreferenceKindModel.fromJson)
          .where((kind) => kind.kindCode.isNotEmpty)
          .toList(growable: false);

      final rawProfile = data['customerProfile'];
      final customerProfile = rawProfile is Map<String, Object?>
          ? CustomerProfileModel.fromJson(rawProfile)
          : null;

      return BookingBootstrapModel(
        bookingEnabled: data['bookingEnabled'] != false,
        disabledReasonKey: data['disabledReasonKey'] as String?,
        services: services,
        addresses: addresses,
        slots: slots,
        categories: categories,
        preferenceKinds: preferenceKinds,
        servicePreferences: servicePreferences,
        pickupPreferences: pickupPreferences,
        vatRate: (data['vatRate'] as num?)?.toDouble() ?? 0.0,
        currencyCode: data['currencyCode'] as String? ?? 'OMR',
        serviceSpeeds: (data['serviceSpeeds'] as List? ?? const [])
            .whereType<Map<String, Object?>>()
            .map(BookingServiceSpeedModel.fromJson)
            .where((speed) => speed.code.isNotEmpty)
            .toList(growable: false),
        customerProfile: customerProfile,
      );
    } on MobileHttpException catch (error) {
      throw OrderBookingServiceException(
        code: error.code,
        messageKey: _bookingLoadMessageKey(error),
        originalError: error,
      );
    }
  }

  Future<BookingConfirmationModel> submit(
    OrderBookingDraftModel draft, {
    required CustomerSessionModel? session,
    required String fulfillmentType,
  }) async {
    if (!_useRemoteBooking(session)) {
      return const BookingConfirmationModel(
        orderId: 'CMX-20001',
        orderNumber: 'CMX-20001',
        promisedWindow: 'Today, 6:00 PM - 8:00 PM',
      );
    }

    if (draft.cartItems.isEmpty) {
      throw const OrderBookingServiceException(
        code: 'booking_missing_fields',
        messageKey: 'booking.validationIncomplete',
      );
    }

    try {
      final effectiveBranchId =
          (draft.branchId != null && draft.branchId!.isNotEmpty)
              ? draft.branchId
              : session!.branchId;
      final payload = await _httpClient.postJson(
        '/api/v1/public/customer/booking',
        headers: {'Authorization': 'Bearer ${session!.verificationToken}'},
        body: {
          'tenantId': session.tenantOrgId!,
          if ((effectiveBranchId ?? '').isNotEmpty)
            'branchId': effectiveBranchId,
          // kept for backend transition compatibility
          'serviceId': draft.service?.id,
          'fulfillmentType': fulfillmentType,
          'pickupMode': draft.pickupMode.wireValue,
          'deliveryMode': draft.deliveryMode.wireValue,
          // new item-based fields
          'items': draft.cartItems.entries.map((e) {
            final qty = e.value;
            final itemNote = (draft.itemNotes[e.key] ?? '').trim();
            final rawPieces = draft.piecePreferences[e.key] ??
                List.generate(
                  qty,
                  (i) => BookingPiecePreferenceModel(pieceSeq: i + 1),
                  growable: false,
                );
            return {
              'itemId': e.key,
              'qty': qty,
              if (itemNote.isNotEmpty) 'notes': itemNote,
              'pieces': rawPieces
                  .map((p) => {
                        'pieceSeq': p.pieceSeq,
                        'servicePreferenceIds': p.servicePreferenceIds,
                        if (p.packingPrefCode != null)
                          'packingPrefCode': p.packingPrefCode,
                        if (p.colorCode != null) 'colorCode': p.colorCode,
                        if (p.notes.isNotEmpty) 'notes': p.notes,
                      })
                  .toList(growable: false),
            };
          }).toList(),
          'servicePreferenceIds': draft.selectedServicePreferenceIds,
          'pickupPreferenceIds': draft.selectedPickupPreferenceIds,
          'applyProfilePrefsToAll': draft.applyProfilePrefsToAll,
          if (draft.preferencesNote.trim().isNotEmpty)
            'preferencesNote': draft.preferencesNote.trim(),
          'isPickupFromAddress':
              draft.pickupMode == CustomerPickupMode.collectAddress ||
                  draft.isPickupFromAddress,
          'isAsap': draft.isAsap,
          'scheduledAt': draft.scheduledAt?.toIso8601String(),
          'addressId': draft.address?.id,
          if (draft.address?.id != null) 'pickupAddressId': draft.address?.id,
          if ((draft.deliveryAddress ?? draft.address)?.id != null)
            'deliveryAddressId': (draft.deliveryAddress ?? draft.address)?.id,
          'slotId': draft.slot?.id,
          'notes': draft.notes.trim(),
          if (draft.promoCode.trim().isNotEmpty)
            'promoCode': draft.promoCode.trim(),
          if (draft.giftCardCode.trim().isNotEmpty)
            'giftCardNumber': draft.giftCardCode.trim(),
          if (draft.paymentNotes.trim().isNotEmpty)
            'paymentNotes': draft.paymentNotes.trim(),
          if (draft.generalOrderNote.trim().isNotEmpty)
            'generalOrderNote': draft.generalOrderNote.trim(),
          'saveGeneralNoteForFuture': draft.saveGeneralNoteForFuture,
          if (draft.serviceSpeed != null) 'serviceSpeed': draft.serviceSpeed,
        },
      );

      final data = payload['data'];
      if (data is! Map<String, Object?>) {
        throw const OrderBookingServiceException(
          code: 'booking_invalid_submit_payload',
          messageKey: 'booking.submitErrorBody',
        );
      }

      return BookingConfirmationModel(
        orderId: data['orderId'] as String? ?? '',
        orderNumber: data['orderNo'] as String? ?? '',
        promisedWindow: data['promisedWindow'] as String?,
        totalAmount: data['totalAmount'] as String?,
        currencyCode: data['currencyCode'] as String?,
      );
    } on MobileHttpException catch (error) {
      throw OrderBookingServiceException(
        code: error.code,
        messageKey: _bookingSubmitMessageKey(error),
        originalError: error,
      );
    }
  }

  Future<AddressOptionModel> createAddress(
    NewAddressInputModel input, {
    required CustomerSessionModel? session,
  }) async {
    if (!_useRemoteBooking(session)) {
      final demoId = 'addr-${DateTime.now().millisecondsSinceEpoch}';
      return AddressOptionModel(
        id: demoId,
        label: input.label,
        description: '${input.area}, ${input.city}',
        isDefault: false,
        street: input.street,
        area: input.area,
        city: input.city,
      );
    }

    try {
      final payload = await _httpClient.postJson(
        '/api/v1/public/customer/addresses',
        headers: {'Authorization': 'Bearer ${session!.verificationToken}'},
        body: {
          'tenantId': session.tenantOrgId!,
          ...input.toJson(),
        },
      );

      final data = payload['data'];
      if (data is! Map<String, Object?>) {
        throw const OrderBookingServiceException(
          code: 'address_invalid_payload',
          messageKey: 'booking.addressSaveErrorBody',
        );
      }

      return _mapRemoteAddress(data);
    } on MobileHttpException catch (error) {
      throw OrderBookingServiceException(
        code: error.code,
        messageKey: _bookingAddressMessageKey(error),
        originalError: error,
      );
    }
  }

  String _bookingLoadMessageKey(MobileHttpException error) {
    return switch (error.code) {
      'session_expired' => 'common.sessionExpired',
      'booking_disabled' => 'booking.disabledBody',
      _ => 'booking.errorBody',
    };
  }

  String _bookingSubmitMessageKey(MobileHttpException error) {
    return switch (error.code) {
      'session_expired' => 'common.sessionExpired',
      'booking_validation_failed' => 'booking.validationIncomplete',
      'booking_address_required' => 'booking.addressRequiredError',
      'booking_schedule_required' => 'booking.scheduleRequiredError',
      'booking_quantity_invalid' => 'booking.quantityInvalidError',
      'booking_item_unavailable' => 'booking.itemUnavailableError',
      'booking_address_unavailable' => 'booking.addressUnavailableError',
      'booking_branch_unavailable' => 'booking.branchUnavailableError',
      'booking_preference_unavailable' => 'booking.preferenceUnavailableError',
      'booking_piece_invalid' => 'booking.pieceInvalidError',
      'booking_disabled' => 'booking.disabledBody',
      // The server prices the booking (commercial calculator, P6-04).
      'PRODUCT_NOT_FOUND' => 'booking.itemUnavailableError',
      'PREFERENCE_NOT_AVAILABLE' => 'booking.preferenceUnavailableError',
      'SERVICE_SPEED_INVALID' => 'booking.speedInvalidError',
      'SPEED_NOT_OFFERED' => 'booking.speedNotOfferedError',
      'PRICE_NOT_RESOLVED' => 'booking.priceUnavailableError',
      // Laundry setup the customer cannot fix (time zone, currency, workflow profile).
      'TIMEZONE_NOT_CONFIGURED' ||
      'MISSING_TENANT_CURRENCY' ||
      'MISSING_CURRENCY_CODE' =>
        'booking.setupUnavailableError',
      final code when code.startsWith('PROFILE_') =>
        'booking.setupUnavailableError',
      _ => 'booking.submitErrorBody',
    };
  }

  String _bookingAddressMessageKey(MobileHttpException error) {
    return switch (error.code) {
      'session_expired' => 'common.sessionExpired',
      'address_validation_failed' => 'booking.addressValidationError',
      'address_unauthorized' => 'common.sessionExpired',
      _ => 'booking.addressSaveErrorBody',
    };
  }

  ServiceOptionModel _mapRemoteService(Map<String, Object?> json) {
    return ServiceOptionModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      title2: json['title2'] as String?,
      description: json['description'] as String? ?? '',
      description2: json['description2'] as String?,
      priceLabel: json['priceLabel'] as String? ?? '',
      priceLabel2: json['priceLabel2'] as String?,
    );
  }

  AddressOptionModel _mapRemoteAddress(Map<String, Object?> json) {
    return AddressOptionModel(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      description: json['description'] as String? ?? '',
      isDefault: json['isDefault'] == true,
      street: json['street'] as String?,
      area: json['area'] as String?,
      city: json['city'] as String?,
    );
  }

  PickupSlotModel _mapRemoteSlot(Map<String, Object?> json) {
    return PickupSlotModel(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      label2: json['label2'] as String?,
      startAt: DateTime.tryParse(json['startAt'] as String? ?? ''),
      endAt: DateTime.tryParse(json['endAt'] as String? ?? ''),
    );
  }

  // ── Demo data ────────────────────────────────────────────────────────────

  static const _demoServiceSpeeds = <BookingServiceSpeedModel>[
    BookingServiceSpeedModel(
      code: 'STANDARD',
      name: 'Standard',
      name2: 'عادي',
      description: 'Ready in 24-48 hours',
      description2: 'جاهز خلال ٢٤-٤٨ ساعة',
    ),
    BookingServiceSpeedModel(
      code: 'EXPRESS',
      name: 'Express',
      name2: 'سريع',
      description: 'Priority turnaround (same/next day)',
      description2: 'أولوية في التنفيذ (نفس اليوم أو الغد)',
    ),
  ];

  static const _demoCustomerProfile = CustomerProfileModel(
    orgCustomerId: 'demo-org-customer',
    sysCustomerId: 'demo-sys-customer',
    hasSysCustomerId: true,
    customerCode: 'CUST-004821',
    name: 'Ahmed Al-Harthi',
    name2: 'أحمد الحارثي',
    displayName: 'Ahmed Al-Harthi',
    mobile: '+96891234567',
    mobileVerified: true,
    email: 'ahmed.alharthi@example.om',
    emailVerified: true,
    preferences: {
      'finishing': 'hanger',
      'starch': 'light',
      'detergent': 'standard',
      'fragrance': true,
    },
    defaultOrderNote: 'Please call 10 mins before arriving at Villa gate #14.',
    autoApplyOrderDefaultNote: true,
    lastBranchId: 'demo-main-branch',
    lastBranchName: 'Al Khuwair Main',
    lastBranchName2: 'الفرع الرئيسي - الخوير',
  );

  static const _demoServices = <ServiceOptionModel>[
    ServiceOptionModel(
      id: 'wash-fold',
      title: 'Wash and fold',
      title2: 'غسيل وطي',
      description: 'Everyday care for regular clothing and household loads.',
      description2: 'عناية يومية للملابس المعتادة والمفروشات الخفيفة.',
      priceLabel: 'Starting from 2.500 OMR',
      priceLabel2: 'ابتداءً من 2.500 ر.ع',
    ),
    ServiceOptionModel(
      id: 'express',
      title: 'Express care',
      title2: 'عناية سريعة',
      description: 'Priority turnaround when you need garments back faster.',
      description2: 'أولوية في التنفيذ عندما تحتاج القطع بشكل أسرع.',
      priceLabel: 'Starting from 4.000 OMR',
      priceLabel2: 'ابتداءً من 4.000 ر.ع',
    ),
  ];

  static const _demoAddresses = <AddressOptionModel>[
    AddressOptionModel(
      id: 'home',
      label: 'Home',
      description: 'Al Khoudh, Muscat',
      isDefault: true,
      street: 'Al Khoudh St',
      area: 'Al Khoudh',
      city: 'Muscat',
    ),
    AddressOptionModel(
      id: 'office',
      label: 'Office',
      description: 'Al Ghubra, Muscat',
      street: 'Al Ghubra St',
      area: 'Al Ghubra',
      city: 'Muscat',
    ),
  ];

  static const _demoCategories = <BookingCatalogCategoryModel>[
    BookingCatalogCategoryModel(
      id: 'shirts',
      name: 'Shirts',
      name2: 'قمصان',
      items: [
        BookingCatalogItemModel(
          id: 'shirt-standard',
          categoryId: 'shirts',
          name: 'Standard shirt',
          name2: 'قميص عادي',
          description: 'Regular cotton shirt',
          description2: 'قميص قطن عادي',
          unitPrice: 0.500,
          unit: 'per_piece',
        ),
        BookingCatalogItemModel(
          id: 'shirt-dress',
          categoryId: 'shirts',
          name: 'Dress shirt',
          name2: 'قميص رسمي',
          description: 'Formal or business dress shirt',
          description2: 'قميص رسمي أو تجاري',
          unitPrice: 0.750,
          unit: 'per_piece',
        ),
      ],
    ),
    BookingCatalogCategoryModel(
      id: 'trousers',
      name: 'Trousers',
      name2: 'بناطيل',
      items: [
        BookingCatalogItemModel(
          id: 'trouser-standard',
          categoryId: 'trousers',
          name: 'Standard trousers',
          name2: 'بنطلون عادي',
          description: 'Casual or formal trousers',
          description2: 'بنطلون كاجوال أو رسمي',
          unitPrice: 0.750,
          unit: 'per_piece',
        ),
        BookingCatalogItemModel(
          id: 'jeans',
          categoryId: 'trousers',
          name: 'Jeans',
          name2: 'جينز',
          description: 'Denim jeans, any style',
          description2: 'جينز دنيم بأي طراز',
          unitPrice: 0.750,
          unit: 'per_piece',
        ),
      ],
    ),
    BookingCatalogCategoryModel(
      id: 'bedding',
      name: 'Bedding',
      name2: 'مفروشات',
      items: [
        BookingCatalogItemModel(
          id: 'bedsheet-single',
          categoryId: 'bedding',
          name: 'Single bed sheet',
          name2: 'ملاءة سرير فردية',
          description: 'Single or twin size bed sheet',
          description2: 'ملاءة مفرد أو توأم',
          unitPrice: 1.000,
          unit: 'per_piece',
        ),
        BookingCatalogItemModel(
          id: 'duvet-single',
          categoryId: 'bedding',
          name: 'Duvet / quilt',
          name2: 'لحاف',
          description: 'Single duvet or quilt',
          description2: 'لحاف مفرد',
          unitPrice: 2.500,
          unit: 'per_piece',
        ),
      ],
    ),
  ];

  static const _demoPreferenceKinds = <BookingPreferenceKindModel>[
    BookingPreferenceKindModel(
      kindCode: 'service_prefs',
      name: 'Service preferences',
      name2: 'تفضيلات الخدمة',
      kindBgColor: '#1A56DB',
      mainTypeCode: 'preferences',
      recOrder: 10,
    ),
    BookingPreferenceKindModel(
      kindCode: 'packing_prefs',
      name: 'Packing preferences',
      name2: 'تفضيلات التغليف',
      kindBgColor: '#0E9F6E',
      mainTypeCode: 'preferences',
      recOrder: 20,
    ),
    BookingPreferenceKindModel(
      kindCode: 'condition_special',
      name: 'Special care',
      name2: 'عناية خاصة',
      kindBgColor: '#7C3AED',
      mainTypeCode: 'preferences',
      recOrder: 30,
    ),
  ];

  static const _demoServicePreferences = <BookingPreferenceOptionModel>[
    BookingPreferenceOptionModel(
      id: 'gentle-wash',
      label: 'Gentle wash',
      label2: 'غسيل لطيف',
      description: 'Lower agitation for delicate garments.',
      description2: 'حركة أخف للملابس الحساسة.',
      preferenceSysKind: 'service_prefs',
      extraPrice: 0.300,
      extraTurnaroundMinutes: 30,
    ),
    BookingPreferenceOptionModel(
      id: 'starch',
      label: 'Starch',
      label2: 'نشا',
      description: 'Crisper finish for shirts and formalwear.',
      description2: 'لمسة أكثر صلابة للقمصان والملابس الرسمية.',
      preferenceSysKind: 'service_prefs',
      extraPrice: 0.200,
    ),
    BookingPreferenceOptionModel(
      id: 'fold-only',
      label: 'Fold only (no hanger)',
      label2: 'طي فقط (بدون علاقة)',
      description: 'Return garments folded instead of hung.',
      description2: 'إرجاع الملابس مطوية بدلاً من تعليقها.',
      preferenceSysKind: 'condition_special',
    ),
  ];

  static const _demoPickupPreferences = <BookingPreferenceOptionModel>[
    BookingPreferenceOptionModel(
      id: 'fragile-pack',
      label: 'Fragile packaging',
      label2: 'تغليف حساس',
      description: 'Use extra care during packing and handoff.',
      description2: 'استخدام عناية إضافية أثناء التغليف والتسليم.',
      preferenceSysKind: 'packing_prefs',
    ),
    BookingPreferenceOptionModel(
      id: 'separate-bags',
      label: 'Separate bags per person',
      label2: 'أكياس منفصلة لكل شخص',
      description: 'Keep family or room items separated.',
      description2: 'فصل أغراض أفراد العائلة أو الغرف.',
      preferenceSysKind: 'packing_prefs',
    ),
  ];

  static List<PickupSlotModel> _demoSlots() {
    final now = DateTime.now();
    final todayEvening = DateTime(now.year, now.month, now.day, 18);
    final tomorrowMorning = todayEvening.add(const Duration(hours: 16));
    final tomorrowEvening = todayEvening.add(const Duration(days: 1));

    return [
      PickupSlotModel(
        id: 'slot-1',
        label: 'Today, 6:00 PM - 8:00 PM',
        label2: 'اليوم، 6:00 م - 8:00 م',
        startAt: todayEvening,
        endAt: todayEvening.add(const Duration(hours: 2)),
      ),
      PickupSlotModel(
        id: 'slot-2',
        label: 'Tomorrow, 10:00 AM - 12:00 PM',
        label2: 'غداً، 10:00 ص - 12:00 م',
        startAt: tomorrowMorning,
        endAt: tomorrowMorning.add(const Duration(hours: 2)),
      ),
      PickupSlotModel(
        id: 'slot-3',
        label: 'Tomorrow, 5:00 PM - 7:00 PM',
        label2: 'غداً، 5:00 م - 7:00 م',
        startAt: tomorrowEvening,
        endAt: tomorrowEvening.add(const Duration(hours: 2)),
      ),
    ];
  }
}
