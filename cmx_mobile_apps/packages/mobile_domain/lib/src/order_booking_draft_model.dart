import 'address_option_model.dart';
import 'pickup_slot_model.dart';
import 'service_option_model.dart';

class OrderBookingDraftModel {
  const OrderBookingDraftModel({
    this.service,
    this.address,
    this.slot,
    this.notes = '',
  });

  final ServiceOptionModel? service;
  final AddressOptionModel? address;
  final PickupSlotModel? slot;
  final String notes;

  OrderBookingDraftModel copyWith({
    ServiceOptionModel? service,
    AddressOptionModel? address,
    PickupSlotModel? slot,
    String? notes,
  }) {
    return OrderBookingDraftModel(
      service: service ?? this.service,
      address: address ?? this.address,
      slot: slot ?? this.slot,
      notes: notes ?? this.notes,
    );
  }
}
