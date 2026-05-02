import 'address_option_model.dart';
import 'booking_piece_preference_model.dart';
import 'new_address_input_model.dart';
import 'pickup_slot_model.dart';
import 'service_option_model.dart';

class OrderBookingDraftModel {
  const OrderBookingDraftModel({
    this.service,
    this.address,
    this.slot,
    this.notes = '',
    this.cartItems = const {},
    this.selectedServicePreferenceIds = const [],
    this.selectedPickupPreferenceIds = const [],
    this.piecePreferences = const {},
    this.isPickupFromAddress = false,
    this.isAsap = true,
    this.scheduledAt,
    this.newAddressInput,
  });

  final ServiceOptionModel? service;
  final AddressOptionModel? address;
  final PickupSlotModel? slot;
  final String notes;

  /// itemId → quantity
  final Map<String, int> cartItems;

  final List<String> selectedServicePreferenceIds;
  final List<String> selectedPickupPreferenceIds;

  /// Per-piece preferences keyed by itemId; value indexed by pieceSeq - 1.
  final Map<String, List<BookingPiecePreferenceModel>> piecePreferences;

  final bool isPickupFromAddress;
  final bool isAsap;
  final DateTime? scheduledAt;
  final NewAddressInputModel? newAddressInput;

  OrderBookingDraftModel copyWith({
    ServiceOptionModel? service,
    AddressOptionModel? address,
    PickupSlotModel? slot,
    String? notes,
    Map<String, int>? cartItems,
    List<String>? selectedServicePreferenceIds,
    List<String>? selectedPickupPreferenceIds,
    Map<String, List<BookingPiecePreferenceModel>>? piecePreferences,
    bool? isPickupFromAddress,
    bool? isAsap,
    DateTime? scheduledAt,
    NewAddressInputModel? newAddressInput,
    bool clearNewAddress = false,
  }) {
    return OrderBookingDraftModel(
      service: service ?? this.service,
      address: address ?? this.address,
      slot: slot ?? this.slot,
      notes: notes ?? this.notes,
      cartItems: cartItems ?? this.cartItems,
      selectedServicePreferenceIds:
          selectedServicePreferenceIds ?? this.selectedServicePreferenceIds,
      selectedPickupPreferenceIds:
          selectedPickupPreferenceIds ?? this.selectedPickupPreferenceIds,
      piecePreferences: piecePreferences ?? this.piecePreferences,
      isPickupFromAddress: isPickupFromAddress ?? this.isPickupFromAddress,
      isAsap: isAsap ?? this.isAsap,
      scheduledAt: scheduledAt ?? this.scheduledAt,
      newAddressInput:
          clearNewAddress ? null : (newAddressInput ?? this.newAddressInput),
    );
  }
}
