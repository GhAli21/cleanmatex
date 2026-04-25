import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_services/mobile_services.dart';

import '../../../core/app_shell_controller.dart';
import '../../../core/providers/app_dependencies.dart';
import '../data/repositories/customer_order_booking_repository.dart';

const _notesMaxLength = 500;
const _servicePreferenceKindCode = 'service_prefs';
const _packingPreferenceKindCode = 'packing_prefs';

final customerOrderBookingProvider =
    NotifierProvider<CustomerOrderBookingNotifier, BookingState>(
  CustomerOrderBookingNotifier.new,
);

@immutable
class BookingState {
  const BookingState({
    this.isLoading = true,
    this.isSubmitting = false,
    this.isSavingAddress = false,
    this.isBookingEnabled = true,
    this.disabledReasonKey,
    this.stepIndex = 0,
    this.errorMessageKey,
    this.validationIssueKeys = const [],
    this.submittedOrderNumber,
    this.submittedPromisedWindow,
    this.draft = const OrderBookingDraftModel(),
    this.services = const [],
    this.addresses = const [],
    this.slots = const [],
    this.categories = const [],
    this.preferenceKinds = const [],
    this.servicePreferenceOptions = const [],
    this.pickupPreferenceOptions = const [],
    this.itemSearchQuery = '',
    this.vatRate = 0.0,
    this.currencyCode = 'OMR',
  });

  final bool isLoading;
  final bool isSubmitting;
  final bool isSavingAddress;
  final bool isBookingEnabled;
  final String? disabledReasonKey;
  final int stepIndex;
  final String? errorMessageKey;
  final List<String> validationIssueKeys;
  final String? submittedOrderNumber;
  final String? submittedPromisedWindow;
  final OrderBookingDraftModel draft;
  final List<ServiceOptionModel> services;
  final List<AddressOptionModel> addresses;
  final List<PickupSlotModel> slots;
  final List<BookingCatalogCategoryModel> categories;
  final List<BookingPreferenceKindModel> preferenceKinds;
  final List<BookingPreferenceOptionModel> servicePreferenceOptions;
  final List<BookingPreferenceOptionModel> pickupPreferenceOptions;
  final String itemSearchQuery;
  final double vatRate;
  final String currencyCode;

  // ── Computed getters ────────────────────────────────────────────────────

  bool get hasLoadError =>
      errorMessageKey != null && categories.isEmpty && services.isEmpty;

  bool get hasSubmissionSuccess => (submittedOrderNumber ?? '').isNotEmpty;

  bool get isDirty =>
      draft.cartItems.isNotEmpty ||
      draft.service != null ||
      draft.address != null ||
      draft.slot != null ||
      draft.notes.trim().isNotEmpty ||
      draft.selectedServicePreferenceIds.isNotEmpty ||
      draft.selectedPickupPreferenceIds.isNotEmpty ||
      draft.isPickupFromAddress;

  int get totalItemCount =>
      draft.cartItems.values.fold(0, (sum, qty) => sum + qty);

  bool get hasCartItems => draft.cartItems.isNotEmpty;

  double get estimatedSubtotal {
    var total = 0.0;
    for (final category in categories) {
      for (final item in category.items) {
        final qty = draft.cartItems[item.id] ?? 0;
        if (qty > 0) {
          total += item.unitPrice * qty;
        }
      }
    }
    final selectedServicePreferenceCharge = servicePreferenceOptions
        .where((preference) =>
            draft.selectedServicePreferenceIds.contains(preference.id))
        .fold<double>(0, (sum, preference) => sum + preference.extraPrice);
    total += selectedServicePreferenceCharge * totalItemCount;
    return total;
  }

  double get estimatedVat => estimatedSubtotal * vatRate;

  double get estimatedTotal => estimatedSubtotal + estimatedVat;

  int get selectedPreferenceCount =>
      draft.selectedServicePreferenceIds.length +
      draft.selectedPickupPreferenceIds.length;

  List<BookingPreferenceKindModel> get visiblePreferenceKinds {
    final sourceKinds = preferenceKinds.isNotEmpty
        ? _withMissingPreferenceKinds(preferenceKinds)
        : [
            if (servicePreferenceOptions.isNotEmpty)
              const BookingPreferenceKindModel(
                kindCode: _servicePreferenceKindCode,
                name: '',
                mainTypeCode: 'preferences',
                recOrder: 10,
              ),
            if (pickupPreferenceOptions.isNotEmpty)
              const BookingPreferenceKindModel(
                kindCode: _packingPreferenceKindCode,
                name: '',
                mainTypeCode: 'preferences',
                recOrder: 20,
              ),
          ];

    return sourceKinds
        .where((kind) => preferenceOptionsForKind(kind.kindCode).isNotEmpty)
        .toList(growable: false);
  }

  List<BookingPreferenceKindModel> _withMissingPreferenceKinds(
    List<BookingPreferenceKindModel> sourceKinds,
  ) {
    final knownKindCodes = sourceKinds.map((kind) => kind.kindCode).toSet();
    final missingServiceKinds = servicePreferenceOptions
        .map((preference) => preference.preferenceSysKind)
        .where((kindCode) => kindCode.isNotEmpty)
        .where((kindCode) => !knownKindCodes.contains(kindCode))
        .toSet();

    return [
      ...sourceKinds,
      ...missingServiceKinds.map(
        (kindCode) => BookingPreferenceKindModel(
          kindCode: kindCode,
          name: '',
          mainTypeCode: 'preferences',
          recOrder: 900,
        ),
      ),
      if (pickupPreferenceOptions.isNotEmpty &&
          !knownKindCodes.contains(_packingPreferenceKindCode))
        const BookingPreferenceKindModel(
          kindCode: _packingPreferenceKindCode,
          name: '',
          mainTypeCode: 'preferences',
          recOrder: 901,
        ),
    ];
  }

  List<BookingPreferenceOptionModel> preferenceOptionsForKind(String kindCode) {
    if (kindCode == _packingPreferenceKindCode) {
      return pickupPreferenceOptions;
    }

    return servicePreferenceOptions
        .where((preference) =>
            preference.preferenceSysKind == kindCode ||
            (kindCode == _servicePreferenceKindCode &&
                preference.preferenceSysKind.isEmpty))
        .toList(growable: false);
  }

  bool isPreferenceSelected(String kindCode, String id) {
    if (kindCode == _packingPreferenceKindCode) {
      return draft.selectedPickupPreferenceIds.contains(id);
    }

    return draft.selectedServicePreferenceIds.contains(id);
  }

  List<BookingPreferenceOptionModel> get selectedPreferenceOptions {
    final selectedServiceOptions = servicePreferenceOptions.where(
      (preference) =>
          draft.selectedServicePreferenceIds.contains(preference.id),
    );
    final selectedPickupOptions = pickupPreferenceOptions.where(
      (preference) => draft.selectedPickupPreferenceIds.contains(preference.id),
    );

    return [...selectedServiceOptions, ...selectedPickupOptions];
  }

  List<String> get submitValidationIssueKeys {
    final issues = <String>[];
    if (draft.cartItems.isEmpty) {
      issues.add('booking.missingItemsDetail');
    }
    if (draft.isPickupFromAddress) {
      if (draft.address == null) {
        issues.add('booking.missingAddressDetail');
      }
      if (!draft.isAsap && draft.scheduledAt == null) {
        issues.add('booking.missingScheduleDetail');
      }
    }
    return issues;
  }

  /// Returns the flat list of all items matching the current [itemSearchQuery].
  List<BookingCatalogItemModel> get filteredItems {
    if (itemSearchQuery.isEmpty) return const [];
    final query = itemSearchQuery.toLowerCase();
    final result = <BookingCatalogItemModel>[];
    for (final category in categories) {
      for (final item in category.items) {
        final matchesName = item.name.toLowerCase().contains(query) ||
            (item.name2?.toLowerCase().contains(query) ?? false);
        final matchesDesc =
            (item.description?.toLowerCase().contains(query) ?? false) ||
                (item.description2?.toLowerCase().contains(query) ?? false);
        if (matchesName || matchesDesc) {
          result.add(item);
        }
      }
    }
    return result;
  }

  /// Backward-compat fulfillment string for the submit body.
  String get fulfillmentType =>
      draft.isPickupFromAddress ? 'pickup' : 'bring_in';

  BookingState copyWith({
    bool? isLoading,
    bool? isSubmitting,
    bool? isSavingAddress,
    bool? isBookingEnabled,
    String? disabledReasonKey,
    int? stepIndex,
    String? errorMessageKey,
    bool clearErrorMessage = false,
    List<String>? validationIssueKeys,
    bool clearValidationIssues = false,
    String? submittedOrderNumber,
    String? submittedPromisedWindow,
    OrderBookingDraftModel? draft,
    List<ServiceOptionModel>? services,
    List<AddressOptionModel>? addresses,
    List<PickupSlotModel>? slots,
    List<BookingCatalogCategoryModel>? categories,
    List<BookingPreferenceKindModel>? preferenceKinds,
    List<BookingPreferenceOptionModel>? servicePreferenceOptions,
    List<BookingPreferenceOptionModel>? pickupPreferenceOptions,
    String? itemSearchQuery,
    double? vatRate,
    String? currencyCode,
  }) {
    return BookingState(
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      isSavingAddress: isSavingAddress ?? this.isSavingAddress,
      isBookingEnabled: isBookingEnabled ?? this.isBookingEnabled,
      disabledReasonKey: disabledReasonKey ?? this.disabledReasonKey,
      stepIndex: stepIndex ?? this.stepIndex,
      errorMessageKey:
          clearErrorMessage ? null : (errorMessageKey ?? this.errorMessageKey),
      validationIssueKeys: clearValidationIssues
          ? const []
          : (validationIssueKeys ?? this.validationIssueKeys),
      submittedOrderNumber: submittedOrderNumber ?? this.submittedOrderNumber,
      submittedPromisedWindow:
          submittedPromisedWindow ?? this.submittedPromisedWindow,
      draft: draft ?? this.draft,
      services: services ?? this.services,
      addresses: addresses ?? this.addresses,
      slots: slots ?? this.slots,
      categories: categories ?? this.categories,
      preferenceKinds: preferenceKinds ?? this.preferenceKinds,
      servicePreferenceOptions:
          servicePreferenceOptions ?? this.servicePreferenceOptions,
      pickupPreferenceOptions:
          pickupPreferenceOptions ?? this.pickupPreferenceOptions,
      itemSearchQuery: itemSearchQuery ?? this.itemSearchQuery,
      vatRate: vatRate ?? this.vatRate,
      currencyCode: currencyCode ?? this.currencyCode,
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

  // ── Load ────────────────────────────────────────────────────────────────

  Future<void> load() async {
    AppLogger.info(
      'booking_provider.load_started hasSession=${_session != null} tenant=${_session?.tenantOrgId ?? 'none'}',
    );
    state = state.copyWith(
      isLoading: true,
      clearErrorMessage: true,
      clearValidationIssues: true,
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
        categories: bootstrap.categories,
        preferenceKinds: bootstrap.preferenceKinds,
        servicePreferenceOptions: bootstrap.servicePreferences,
        pickupPreferenceOptions: bootstrap.pickupPreferences,
        vatRate: bootstrap.vatRate,
        currencyCode: bootstrap.currencyCode,
        draft: state.draft.copyWith(
          address: state.draft.address ?? _defaultAddress(bootstrap.addresses),
        ),
      );
      AppLogger.info(
        'booking_provider.load_succeeded '
        'categories=${bootstrap.categories.length} '
        'preferenceKinds=${bootstrap.preferenceKinds.length} '
        'addresses=${bootstrap.addresses.length} '
        'servicePrefs=${bootstrap.servicePreferences.length} '
        'pickupPrefs=${bootstrap.pickupPreferences.length}',
      );
    } catch (error, stackTrace) {
      AppLogger.error(
        'booking_provider.load_failed',
        error: error,
        stackTrace: stackTrace,
      );
      state = state.copyWith(
        isLoading: false,
        errorMessageKey:
            error is AppException ? error.messageKey : 'booking.errorBody',
      );
    }
  }

  // ── Step 1 — Item cart ──────────────────────────────────────────────────

  void addItem(String itemId) {
    final current = Map<String, int>.from(state.draft.cartItems);
    current[itemId] = (current[itemId] ?? 0) + 1;
    AppLogger.info(
      'booking_provider.item_added itemId=$itemId quantity=${current[itemId]}',
    );
    state = state.copyWith(
      draft: state.draft.copyWith(cartItems: Map.unmodifiable(current)),
    );
  }

  void removeItem(String itemId) {
    final current = Map<String, int>.from(state.draft.cartItems);
    final qty = (current[itemId] ?? 0) - 1;
    if (qty <= 0) {
      current.remove(itemId);
    } else {
      current[itemId] = qty;
    }
    AppLogger.info(
      'booking_provider.item_removed itemId=$itemId quantity=${current[itemId] ?? 0}',
    );
    state = state.copyWith(
      draft: state.draft.copyWith(cartItems: Map.unmodifiable(current)),
    );
  }

  void setItemQty(String itemId, int qty) {
    final current = Map<String, int>.from(state.draft.cartItems);
    if (qty <= 0) {
      current.remove(itemId);
    } else {
      current[itemId] = qty;
    }
    AppLogger.info(
        'booking_provider.item_quantity_set itemId=$itemId qty=$qty');
    state = state.copyWith(
      draft: state.draft.copyWith(cartItems: Map.unmodifiable(current)),
    );
  }

  void setItemSearchQuery(String query) {
    AppLogger.info(
      'booking_provider.search_changed length=${query.trim().length}',
    );
    state = state.copyWith(itemSearchQuery: query);
  }

  // ── Step 2 — Preferences ────────────────────────────────────────────────

  void toggleServicePreference(String id) {
    final current = List<String>.from(state.draft.selectedServicePreferenceIds);
    if (current.contains(id)) {
      current.remove(id);
    } else {
      current.add(id);
    }
    AppLogger.info(
      'booking_provider.service_preference_toggled id=$id selected=${current.contains(id)}',
    );
    state = state.copyWith(
      draft: state.draft.copyWith(
        selectedServicePreferenceIds: List.unmodifiable(current),
      ),
    );
  }

  void togglePickupPreference(String id) {
    final current = List<String>.from(state.draft.selectedPickupPreferenceIds);
    if (current.contains(id)) {
      current.remove(id);
    } else {
      current.add(id);
    }
    AppLogger.info(
      'booking_provider.pickup_preference_toggled id=$id selected=${current.contains(id)}',
    );
    state = state.copyWith(
      draft: state.draft.copyWith(
        selectedPickupPreferenceIds: List.unmodifiable(current),
      ),
    );
  }

  void togglePreferenceForKind(String kindCode, String id) {
    if (kindCode == _packingPreferenceKindCode) {
      togglePickupPreference(id);
      return;
    }

    toggleServicePreference(id);
  }

  // ── Step 3 — Schedule ───────────────────────────────────────────────────

  void setIsPickupFromAddress(bool value) {
    AppLogger.info('booking_provider.handoff_mode_changed pickup=$value');
    state = state.copyWith(
      draft: state.draft.copyWith(isPickupFromAddress: value),
    );
  }

  void setIsAsap(bool value) {
    AppLogger.info('booking_provider.asap_changed isAsap=$value');
    state = state.copyWith(
      draft: state.draft.copyWith(isAsap: value),
    );
  }

  void setScheduledAt(DateTime value) {
    AppLogger.info(
      'booking_provider.scheduled_at_changed value=${value.toIso8601String()}',
    );
    state = state.copyWith(
      draft: state.draft.copyWith(scheduledAt: value),
    );
  }

  void chooseAddress(AddressOptionModel value) {
    AppLogger.info('booking_provider.address_selected id=${value.id}');
    state = state.copyWith(
      draft: state.draft.copyWith(address: value),
    );
  }

  Future<void> saveNewAddress(NewAddressInputModel input) async {
    if (state.isSavingAddress) return;

    AppLogger.info(
        'booking_provider.save_address_started label=${input.label}');
    state = state.copyWith(
      isSavingAddress: true,
      clearErrorMessage: true,
    );
    try {
      final newAddress = await _repo.createAddress(input, session: _session);
      final updatedAddresses = [...state.addresses, newAddress];
      state = state.copyWith(
        isSavingAddress: false,
        addresses: updatedAddresses,
        draft: state.draft.copyWith(
          address: newAddress,
          clearNewAddress: true,
        ),
      );
      AppLogger.info(
        'booking_provider.save_address_succeeded id=${newAddress.id}',
      );
    } catch (error, stackTrace) {
      AppLogger.error(
        'booking_provider.save_address_failed',
        error: error,
        stackTrace: stackTrace,
      );
      state = state.copyWith(
        isSavingAddress: false,
        errorMessageKey: error is AppException
            ? error.messageKey
            : 'booking.addressSaveErrorBody',
      );
    }
  }

  // ── Legacy / compat ─────────────────────────────────────────────────────

  void chooseService(ServiceOptionModel value) {
    state = state.copyWith(
      draft: state.draft.copyWith(service: value),
    );
  }

  void chooseSlot(PickupSlotModel value) {
    state = state.copyWith(
      draft: state.draft.copyWith(slot: value),
    );
  }

  // ── Step 4 — Notes ──────────────────────────────────────────────────────

  void updateNotes(String value) {
    var next = value;
    if (next.length > _notesMaxLength) {
      next = next.substring(0, _notesMaxLength);
    }
    AppLogger.info(
        'booking_provider.notes_changed length=${next.trim().length}');
    state = state.copyWith(
      draft: state.draft.copyWith(notes: next),
    );
  }

  // ── Navigation ──────────────────────────────────────────────────────────

  void goNext() {
    if (state.stepIndex < 3) {
      AppLogger.info(
        'booking_provider.step_next from=${state.stepIndex} to=${state.stepIndex + 1}',
      );
      state = state.copyWith(
        stepIndex: state.stepIndex + 1,
        clearErrorMessage: true,
        clearValidationIssues: true,
      );
    }
  }

  void goBack() {
    if (state.stepIndex > 0) {
      AppLogger.info(
        'booking_provider.step_back from=${state.stepIndex} to=${state.stepIndex - 1}',
      );
      state = state.copyWith(
        stepIndex: state.stepIndex - 1,
      );
    }
  }

  bool canProceed() {
    switch (state.stepIndex) {
      case 0:
        return state.draft.cartItems.isNotEmpty;
      case 1:
        // Preferences are optional — always allow proceeding
        return true;
      case 2:
        if (!state.draft.isPickupFromAddress) return true;
        if (state.draft.isAsap) return state.draft.address != null;
        return state.draft.address != null && state.draft.scheduledAt != null;
      default:
        return true;
    }
  }

  List<String> _validationIssueKeysForSubmitError(Object error) {
    if (error is! OrderBookingServiceException) {
      return const [];
    }

    return switch (error.code) {
      'booking_address_required' => const ['booking.missingAddressDetail'],
      'booking_schedule_required' => const ['booking.missingScheduleDetail'],
      'booking_item_unavailable' => const ['booking.invalidItemsDetail'],
      'booking_address_unavailable' => const ['booking.invalidAddressDetail'],
      'booking_validation_failed' => _remoteValidationIssueKeys(error),
      _ => const [],
    };
  }

  List<String> _remoteValidationIssueKeys(OrderBookingServiceException error) {
    final original = error.originalError;
    if (original is! MobileHttpException) {
      return const ['booking.validationReviewDetails'];
    }
    final payload = original.originalError;
    if (payload is! Map<String, Object?>) {
      return const ['booking.validationReviewDetails'];
    }
    final details = payload['details'];
    if (details is! Map<String, Object?>) {
      return const ['booking.validationReviewDetails'];
    }
    final fieldErrors = details['fieldErrors'];
    if (fieldErrors is! Map<String, Object?>) {
      return const ['booking.validationReviewDetails'];
    }

    final issueKeys = <String>{};
    for (final fieldName in fieldErrors.keys) {
      switch (fieldName) {
        case 'tenantId':
          issueKeys.add('booking.invalidTenantDetail');
          break;
        case 'items':
          issueKeys.add('booking.invalidItemsDetail');
          break;
        case 'addressId':
          issueKeys.add('booking.invalidAddressDetail');
          break;
        case 'branchId':
          issueKeys.add('booking.branchUnavailableError');
          break;
        case 'scheduledAt':
          issueKeys.add('booking.missingScheduleDetail');
          break;
        default:
          issueKeys.add('booking.validationReviewDetails');
          break;
      }
    }
    return issueKeys.isEmpty
        ? const ['booking.validationReviewDetails']
        : issueKeys.toList(growable: false);
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  Future<void> submit() async {
    if (!state.isBookingEnabled) {
      AppLogger.warning('booking_provider.submit_blocked booking_disabled');
      state = state.copyWith(errorMessageKey: 'booking.disabledBody');
      return;
    }

    final localValidationIssues = state.submitValidationIssueKeys;
    if (localValidationIssues.isNotEmpty) {
      AppLogger.warning(
        'booking_provider.submit_blocked missingDetails=${localValidationIssues.join(',')}',
      );
      state = state.copyWith(
        errorMessageKey: 'booking.validationIncomplete',
        validationIssueKeys: localValidationIssues,
      );
      return;
    }

    if (state.isSubmitting || !canProceed()) {
      AppLogger.warning(
        'booking_provider.submit_blocked isSubmitting=${state.isSubmitting} canProceed=${canProceed()}',
      );
      return;
    }

    AppLogger.info(
      'booking_provider.submit_started step=${state.stepIndex} '
      'cartItems=${state.draft.cartItems.length} '
      'isPickupFromAddress=${state.draft.isPickupFromAddress}',
    );
    state = state.copyWith(
      isSubmitting: true,
      clearErrorMessage: true,
      clearValidationIssues: true,
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
        errorMessageKey: error is AppException
            ? error.messageKey
            : 'booking.submitErrorBody',
        validationIssueKeys: _validationIssueKeysForSubmitError(error),
      );
    }
  }

  void clearError() {
    state = state.copyWith(clearErrorMessage: true);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  AddressOptionModel? _defaultAddress(List<AddressOptionModel> addresses) {
    for (final address in addresses) {
      if (address.isDefault) return address;
    }
    return addresses.isNotEmpty ? addresses.first : null;
  }
}
