import 'package:flutter/material.dart';
import 'package:mobile_domain/mobile_domain.dart';

import '../data/repositories/customer_order_booking_repository.dart';

class CustomerOrderBookingProvider extends ChangeNotifier {
  CustomerOrderBookingProvider({
    CustomerOrderBookingRepository? repository,
    CustomerSessionModel? session,
  })  : _repository = repository ?? CustomerOrderBookingRepository(),
        _session = session;

  final CustomerOrderBookingRepository _repository;
  final CustomerSessionModel? _session;

  bool _isLoading = true;
  bool _isSubmitting = false;
  int _stepIndex = 0;
  String _fulfillmentType = 'pickup';
  String? _errorMessageKey;
  String? _submittedOrderNumber;
  String? _submittedPromisedWindow;
  OrderBookingDraftModel _draft = const OrderBookingDraftModel();
  List<ServiceOptionModel> _services = const [];
  List<AddressOptionModel> _addresses = const [];
  List<PickupSlotModel> _slots = const [];

  bool get isLoading => _isLoading;
  bool get isSubmitting => _isSubmitting;
  int get stepIndex => _stepIndex;
  String get fulfillmentType => _fulfillmentType;
  String? get errorMessageKey => _errorMessageKey;
  String? get submittedOrderNumber => _submittedOrderNumber;
  String? get submittedPromisedWindow => _submittedPromisedWindow;
  OrderBookingDraftModel get draft => _draft;
  List<ServiceOptionModel> get services => _services;
  List<AddressOptionModel> get addresses => _addresses;
  List<PickupSlotModel> get slots => _slots;
  bool get hasSubmissionSuccess => _submittedOrderNumber != null;
  bool get isDirty =>
      _draft.service != null ||
      _draft.address != null ||
      _draft.slot != null ||
      _draft.notes.trim().isNotEmpty;
  bool get hasLoadError => _errorMessageKey != null && _services.isEmpty;

  Future<void> load() async {
    _isLoading = true;
    _errorMessageKey = null;
    notifyListeners();

    try {
      final bootstrap = await _repository.loadBootstrap(_session);
      _services = bootstrap.services;
      _addresses = bootstrap.addresses;
      _slots = bootstrap.slots;
      _draft = _draft.copyWith(
        address: _draft.address ?? _defaultAddress(),
      );
    } catch (_) {
      _errorMessageKey = 'booking.errorBody';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void chooseService(ServiceOptionModel value) {
    _draft = _draft.copyWith(service: value);
    notifyListeners();
  }

  void chooseAddress(AddressOptionModel value) {
    _draft = _draft.copyWith(address: value);
    notifyListeners();
  }

  void updateFulfillmentType(String value) {
    _fulfillmentType = value;
    notifyListeners();
  }

  void chooseSlot(PickupSlotModel value) {
    _draft = _draft.copyWith(slot: value);
    notifyListeners();
  }

  void updateNotes(String value) {
    _draft = _draft.copyWith(notes: value);
    notifyListeners();
  }

  void goNext() {
    if (_stepIndex < 3) {
      _stepIndex += 1;
      _errorMessageKey = null;
      notifyListeners();
    }
  }

  void goBack() {
    if (_stepIndex > 0) {
      _stepIndex -= 1;
      notifyListeners();
    }
  }

  bool canProceed() {
    switch (_stepIndex) {
      case 0:
        return _draft.service != null;
      case 1:
        return _draft.address != null && _fulfillmentType.isNotEmpty;
      case 2:
        return _draft.slot != null;
      default:
        return true;
    }
  }

  Future<void> submit() async {
    if (_isSubmitting || !canProceed()) {
      return;
    }

    _isSubmitting = true;
    _errorMessageKey = null;
    notifyListeners();

    try {
      final confirmation = await _repository.submit(
        _draft,
        session: _session,
        fulfillmentType: _fulfillmentType,
      );
      _submittedOrderNumber = confirmation.orderNumber;
      _submittedPromisedWindow = confirmation.promisedWindow;
    } catch (_) {
      _errorMessageKey = 'booking.submitErrorBody';
    } finally {
      _isSubmitting = false;
      notifyListeners();
    }
  }

  void clearError() {
    _errorMessageKey = null;
    notifyListeners();
  }

  AddressOptionModel? _defaultAddress() {
    for (final address in _addresses) {
      if (address.isDefault) {
        return address;
      }
    }

    return _addresses.isNotEmpty ? _addresses.first : null;
  }
}
