import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

import '../../../core/app_shell_controller.dart';
import '../../../core/providers/app_dependencies.dart';
import '../data/repositories/customer_order_booking_repository.dart';

const _notesMaxLength = 500;

final customerOrderBookingProvider =
    NotifierProvider<CustomerOrderBookingNotifier, BookingState>(
  CustomerOrderBookingNotifier.new,
);

@immutable
class BookingState {
  const BookingState({
    this.isLoading = true,
    this.isSubmitting = false,
    this.isBookingEnabled = true,
    this.disabledReasonKey,
    this.stepIndex = 0,
    this.fulfillmentType = 'pickup',
    this.errorMessageKey,
    this.submittedOrderNumber,
    this.submittedPromisedWindow,
    this.draft = const OrderBookingDraftModel(),
    this.services = const [],
    this.addresses = const [],
    this.slots = const [],
  });

  final bool isLoading;
  final bool isSubmitting;
  final bool isBookingEnabled;
  final String? disabledReasonKey;
  final int stepIndex;
  final String fulfillmentType;
  final String? errorMessageKey;
  final String? submittedOrderNumber;
  final String? submittedPromisedWindow;
  final OrderBookingDraftModel draft;
  final List<ServiceOptionModel> services;
  final List<AddressOptionModel> addresses;
  final List<PickupSlotModel> slots;

  bool get hasLoadError => errorMessageKey != null && services.isEmpty;

  bool get hasSubmissionSuccess => (submittedOrderNumber ?? '').isNotEmpty;

  bool get isDirty =>
      draft.service != null ||
      draft.address != null ||
      draft.slot != null ||
      draft.notes.trim().isNotEmpty;

  BookingState copyWith({
    bool? isLoading,
    bool? isSubmitting,
    bool? isBookingEnabled,
    String? disabledReasonKey,
    int? stepIndex,
    String? fulfillmentType,
    String? errorMessageKey,
    bool clearErrorMessage = false,
    String? submittedOrderNumber,
    String? submittedPromisedWindow,
    OrderBookingDraftModel? draft,
    List<ServiceOptionModel>? services,
    List<AddressOptionModel>? addresses,
    List<PickupSlotModel>? slots,
  }) {
    return BookingState(
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      isBookingEnabled: isBookingEnabled ?? this.isBookingEnabled,
      disabledReasonKey: disabledReasonKey ?? this.disabledReasonKey,
      stepIndex: stepIndex ?? this.stepIndex,
      fulfillmentType: fulfillmentType ?? this.fulfillmentType,
      errorMessageKey:
          clearErrorMessage ? null : (errorMessageKey ?? this.errorMessageKey),
      submittedOrderNumber:
          submittedOrderNumber ?? this.submittedOrderNumber,
      submittedPromisedWindow:
          submittedPromisedWindow ?? this.submittedPromisedWindow,
      draft: draft ?? this.draft,
      services: services ?? this.services,
      addresses: addresses ?? this.addresses,
      slots: slots ?? this.slots,
    );
  }
}

class CustomerOrderBookingNotifier extends Notifier<BookingState> {
  @override
  BookingState build() {
    return const BookingState();
  }

  CustomerOrderBookingRepository get _repo =>
      ref.read(customerOrderBookingRepositoryProvider);
  CustomerSessionModel? get _session =>
      ref.read(customerSessionFlowProvider).session;

  Future<void> load() async {
    AppLogger.info(
      'booking_provider.load_started hasSession=${_session != null} tenant=${_session?.tenantOrgId ?? 'none'}',
    );
    state = state.copyWith(
      isLoading: true,
      clearErrorMessage: true,
    );
    try {
      final bootstrap = await _repo.loadBootstrap(_session);
      state = state.copyWith(
        isLoading: false,
        isBookingEnabled: bootstrap.bookingEnabled,
        disabledReasonKey: bootstrap.disabledReasonKey,
        services: bootstrap.services,
        addresses: bootstrap.addresses,
        slots: bootstrap.slots,
        draft: state.draft.copyWith(
          address: state.draft.address ?? _defaultAddress(bootstrap.addresses),
        ),
      );
      AppLogger.info(
        'booking_provider.load_succeeded services=${bootstrap.services.length} addresses=${bootstrap.addresses.length} slots=${bootstrap.slots.length}',
      );
    } catch (error, stackTrace) {
      AppLogger.error(
        'booking_provider.load_failed',
        error: error,
        stackTrace: stackTrace,
      );
      state = state.copyWith(
        isLoading: false,
        errorMessageKey: 'booking.errorBody',
      );
    }
  }

  void chooseService(ServiceOptionModel value) {
    state = state.copyWith(
      draft: state.draft.copyWith(service: value),
    );
  }

  void chooseAddress(AddressOptionModel value) {
    state = state.copyWith(
      draft: state.draft.copyWith(address: value),
    );
  }

  void updateFulfillmentType(String value) {
    state = state.copyWith(fulfillmentType: value);
  }

  void chooseSlot(PickupSlotModel value) {
    state = state.copyWith(
      draft: state.draft.copyWith(slot: value),
    );
  }

  void updateNotes(String value) {
    var next = value;
    if (next.length > _notesMaxLength) {
      next = next.substring(0, _notesMaxLength);
    }
    state = state.copyWith(
      draft: state.draft.copyWith(notes: next),
    );
  }

  void goNext() {
    if (state.stepIndex < 3) {
      state = state.copyWith(
        stepIndex: state.stepIndex + 1,
        clearErrorMessage: true,
      );
    }
  }

  void goBack() {
    if (state.stepIndex > 0) {
      state = state.copyWith(
        stepIndex: state.stepIndex - 1,
      );
    }
  }

  bool canProceed() {
    switch (state.stepIndex) {
      case 0:
        return state.draft.service != null;
      case 1:
        return state.draft.address != null && state.fulfillmentType.isNotEmpty;
      case 2:
        return state.draft.slot != null;
      default:
        return true;
    }
  }

  Future<void> submit() async {
    if (!state.isBookingEnabled) {
      AppLogger.warning('booking_provider.submit_blocked booking_disabled');
      state = state.copyWith(errorMessageKey: 'booking.disabledBody');
      return;
    }

    if (state.isSubmitting || !canProceed()) {
      AppLogger.warning(
        'booking_provider.submit_blocked isSubmitting=${state.isSubmitting} canProceed=${canProceed()}',
      );
      return;
    }

    AppLogger.info(
      'booking_provider.submit_started step=${state.stepIndex} fulfillmentType=${state.fulfillmentType}',
    );
    state = state.copyWith(
      isSubmitting: true,
      clearErrorMessage: true,
    );
    try {
      final confirmation = await _repo.submit(
        state.draft,
        session: _session,
        fulfillmentType: state.fulfillmentType,
      );
      state = state.copyWith(
        isSubmitting: false,
        submittedOrderNumber: confirmation.orderNumber,
        submittedPromisedWindow: confirmation.promisedWindow,
      );
      AppLogger.info(
        'booking_provider.submit_succeeded orderNumber=${confirmation.orderNumber}',
      );
    } catch (error, stackTrace) {
      AppLogger.error(
        'booking_provider.submit_failed',
        error: error,
        stackTrace: stackTrace,
      );
      state = state.copyWith(
        isSubmitting: false,
        errorMessageKey: 'booking.submitErrorBody',
      );
    }
  }

  void clearError() {
    state = state.copyWith(
      errorMessageKey: null,
      clearErrorMessage: true,
    );
  }

  AddressOptionModel? _defaultAddress(List<AddressOptionModel> addresses) {
    for (final address in addresses) {
      if (address.isDefault) {
        return address;
      }
    }
    return addresses.isNotEmpty ? addresses.first : null;
  }
}
