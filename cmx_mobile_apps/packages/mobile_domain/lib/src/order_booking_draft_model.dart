import 'address_option_model.dart';
import 'booking_piece_preference_model.dart';
import 'new_address_input_model.dart';
import 'pickup_slot_model.dart';
import 'service_option_model.dart';

/// Shared 2x2 pickup mode used across both Fast Quick Drop and Detailed Order.
enum CustomerPickupMode { collectAddress, storeDropoff }

/// Shared 2x2 delivery mode used across both Fast Quick Drop and Detailed Order.
enum CustomerDeliveryMode { deliverAddress, storePickup }

extension CustomerPickupModeWire on CustomerPickupMode {
  String get wireValue => this == CustomerPickupMode.collectAddress
      ? 'collect_address'
      : 'store_dropoff';
}

extension CustomerDeliveryModeWire on CustomerDeliveryMode {
  String get wireValue => this == CustomerDeliveryMode.deliverAddress
      ? 'deliver_address'
      : 'store_pickup';
}

class OrderBookingDraftModel {
  const OrderBookingDraftModel({
    this.branchId,
    this.pickupMode = CustomerPickupMode.collectAddress,
    this.deliveryMode = CustomerDeliveryMode.deliverAddress,
    this.service,
    this.address,
    this.deliveryAddress,
    this.slot,
    this.notes = '',
    this.cartItems = const {},
    this.itemNotes = const {},
    this.selectedServicePreferenceIds = const [],
    this.selectedPickupPreferenceIds = const [],
    this.piecePreferences = const {},
    this.applyProfilePrefsToAll = true,
    this.preferencesNote = '',
    this.isPickupFromAddress = false,
    this.isAsap = true,
    this.scheduledAt,
    this.newAddressInput,
    this.serviceSpeed,
    this.promoCode = '',
    this.giftCardCode = '',
    this.paymentNotes = '',
    this.generalOrderNote = '',
    this.saveGeneralNoteForFuture = false,
  });

  final String? branchId;
  final CustomerPickupMode pickupMode;
  final CustomerDeliveryMode deliveryMode;
  final ServiceOptionModel? service;
  final AddressOptionModel? address;
  final AddressOptionModel? deliveryAddress;
  final PickupSlotModel? slot;
  final String notes;

  /// itemId → quantity
  final Map<String, int> cartItems;

  /// itemId → optional per-item note
  final Map<String, String> itemNotes;

  final List<String> selectedServicePreferenceIds;
  final List<String> selectedPickupPreferenceIds;

  /// Per-piece preferences keyed by itemId; value indexed by pieceSeq - 1.
  final Map<String, List<BookingPiecePreferenceModel>> piecePreferences;

  final bool applyProfilePrefsToAll;
  final String preferencesNote;

  final bool isPickupFromAddress;
  final bool isAsap;
  final DateTime? scheduledAt;
  final NewAddressInputModel? newAddressInput;

  /// A `sys_service_speed_cd` code; null books at the Standard speed.
  final String? serviceSpeed;

  final String promoCode;
  final String giftCardCode;
  final String paymentNotes;
  final String generalOrderNote;
  final bool saveGeneralNoteForFuture;

  OrderBookingDraftModel copyWith({
    String? branchId,
    CustomerPickupMode? pickupMode,
    CustomerDeliveryMode? deliveryMode,
    ServiceOptionModel? service,
    AddressOptionModel? address,
    AddressOptionModel? deliveryAddress,
    PickupSlotModel? slot,
    String? notes,
    Map<String, int>? cartItems,
    Map<String, String>? itemNotes,
    List<String>? selectedServicePreferenceIds,
    List<String>? selectedPickupPreferenceIds,
    Map<String, List<BookingPiecePreferenceModel>>? piecePreferences,
    bool? applyProfilePrefsToAll,
    String? preferencesNote,
    bool? isPickupFromAddress,
    bool? isAsap,
    DateTime? scheduledAt,
    NewAddressInputModel? newAddressInput,
    bool clearNewAddress = false,
    String? serviceSpeed,
    bool clearServiceSpeed = false,
    String? promoCode,
    String? giftCardCode,
    String? paymentNotes,
    String? generalOrderNote,
    bool? saveGeneralNoteForFuture,
  }) {
    return OrderBookingDraftModel(
      branchId: branchId ?? this.branchId,
      pickupMode: pickupMode ?? this.pickupMode,
      deliveryMode: deliveryMode ?? this.deliveryMode,
      service: service ?? this.service,
      address: address ?? this.address,
      deliveryAddress: deliveryAddress ?? this.deliveryAddress,
      slot: slot ?? this.slot,
      notes: notes ?? this.notes,
      cartItems: cartItems ?? this.cartItems,
      itemNotes: itemNotes ?? this.itemNotes,
      selectedServicePreferenceIds:
          selectedServicePreferenceIds ?? this.selectedServicePreferenceIds,
      selectedPickupPreferenceIds:
          selectedPickupPreferenceIds ?? this.selectedPickupPreferenceIds,
      piecePreferences: piecePreferences ?? this.piecePreferences,
      applyProfilePrefsToAll:
          applyProfilePrefsToAll ?? this.applyProfilePrefsToAll,
      preferencesNote: preferencesNote ?? this.preferencesNote,
      isPickupFromAddress: isPickupFromAddress ?? this.isPickupFromAddress,
      isAsap: isAsap ?? this.isAsap,
      scheduledAt: scheduledAt ?? this.scheduledAt,
      newAddressInput:
          clearNewAddress ? null : (newAddressInput ?? this.newAddressInput),
      serviceSpeed:
          clearServiceSpeed ? null : (serviceSpeed ?? this.serviceSpeed),
      promoCode: promoCode ?? this.promoCode,
      giftCardCode: giftCardCode ?? this.giftCardCode,
      paymentNotes: paymentNotes ?? this.paymentNotes,
      generalOrderNote: generalOrderNote ?? this.generalOrderNote,
      saveGeneralNoteForFuture:
          saveGeneralNoteForFuture ?? this.saveGeneralNoteForFuture,
    );
  }
}
