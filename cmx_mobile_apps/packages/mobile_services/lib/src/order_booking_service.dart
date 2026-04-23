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
  });

  final String orderId;
  final String orderNumber;
  final String? promisedWindow;
}

class BookingBootstrapModel {
  const BookingBootstrapModel({
    required this.services,
    required this.addresses,
    required this.slots,
  });

  final List<ServiceOptionModel> services;
  final List<AddressOptionModel> addresses;
  final List<PickupSlotModel> slots;
}

class OrderBookingService {
  OrderBookingService({
    MobileHttpClient? httpClient,
    AppConfig? config,
  }) : _httpClient = httpClient ?? MobileHttpClient(config: config);

  final MobileHttpClient _httpClient;

  bool _useRemoteBooking(CustomerSessionModel? session) {
    return _httpClient.config.hasApiBaseUrl &&
        _httpClient.config.hasTenantOrgId &&
        session != null &&
        !session.isGuest &&
        session.hasVerificationToken;
  }

  Future<BookingBootstrapModel> loadBootstrap(
      CustomerSessionModel? session) async {
    if (!_useRemoteBooking(session)) {
      return BookingBootstrapModel(
        services: _demoServices,
        addresses: _demoAddresses,
        slots: _demoSlots(),
      );
    }

    try {
      final payload = await _httpClient.getJson(
        '/api/v1/public/customer/booking',
        headers: {
          'Authorization': 'Bearer ${session!.verificationToken}',
        },
        queryParameters: {
          'tenantId': session.tenantOrgId ?? _httpClient.config.tenantOrgId,
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

      return BookingBootstrapModel(
        services: services,
        addresses: addresses,
        slots: slots,
      );
    } on MobileHttpException catch (error) {
      throw OrderBookingServiceException(
        code: error.code,
        messageKey: 'booking.errorBody',
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

    if (draft.service == null || draft.address == null || draft.slot == null) {
      throw const OrderBookingServiceException(
        code: 'booking_missing_fields',
        messageKey: 'booking.validationIncomplete',
      );
    }

    try {
      final payload = await _httpClient.postJson(
        '/api/v1/public/customer/booking',
        headers: {
          'Authorization': 'Bearer ${session!.verificationToken}',
        },
        body: {
          'tenantId': session.tenantOrgId ?? _httpClient.config.tenantOrgId,
          'serviceId': draft.service!.id,
          'addressId': draft.address!.id,
          'slotId': draft.slot!.id,
          'fulfillmentType': fulfillmentType,
          'notes': draft.notes.trim(),
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
      );
    } on MobileHttpException catch (error) {
      throw OrderBookingServiceException(
        code: error.code,
        messageKey: 'booking.submitErrorBody',
        originalError: error,
      );
    }
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
    ),
    AddressOptionModel(
      id: 'office',
      label: 'Office',
      description: 'Al Ghubra, Muscat',
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
