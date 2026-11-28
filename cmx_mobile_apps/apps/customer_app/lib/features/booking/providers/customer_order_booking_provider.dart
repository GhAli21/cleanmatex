import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_services/mobile_services.dart';

import '../../../core/app_shell_controller.dart';
import '../../../core/providers/customer_api_client_providers.dart';
import '../../tenant/providers/tenant_provider.dart';
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
    this.isLoadingQuote = false,
    this.isBookingEnabled = true,
    this.disabledReasonKey,
    this.stepIndex = 0,
    this.errorMessageKey,
    this.quoteErrorMessageKey,
    this.validationIssueKeys = const [],
    this.submittedOrderNumber,
    this.submittedPromisedWindow,
    this.submittedTotalAmount,
    this.submittedCurrencyCode,
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
    this.serviceSpeeds = const [],
    this.currencyCode = 'OMR',
    this.customerProfile,
    this.serverQuote,
  });

  final bool isLoading;
  final bool isSubmitting;
  final bool isSavingAddress;
  final bool isLoadingQuote;
  final bool isBookingEnabled;
  final String? disabledReasonKey;

  /// 6-step Detailed Order index (0..5):
  /// 0 = Fulfillment & Branch (mandatory)
  /// 1 = Select Items + per-piece prefs + per-item notes
  /// 2 = Predefined Profile Preferences + master toggle + preferences note
  /// 3 = Schedule & Speed + Estimated Ready-By
  /// 4 = Promo, Gift Card, Payment Notes & General Order Note
  /// 5 = POS-Parity Server-Priced Review
  final int stepIndex;
  final String? errorMessageKey;
  final String? quoteErrorMessageKey;
  final List<String> validationIssueKeys;
  final String? submittedOrderNumber;
  final String? submittedPromisedWindow;
  final String? submittedTotalAmount;
  final String? submittedCurrencyCode;
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
  final List<BookingServiceSpeedModel> serviceSpeeds;
  final String currencyCode;
  final CustomerProfileModel? customerProfile;
  final PosQuoteBreakdownModel? serverQuote;

  static const int totalSteps = 6;
  static const int reviewStepIndex = 5;

  Map<String, List<BookingPiecePreferenceModel>> get piecePreferences =>
      draft.piecePreferences;

  bool get hasLoadError =>
      errorMessageKey != null && categories.isEmpty && services.isEmpty;

  bool get hasSubmissionSuccess => (submittedOrderNumber ?? '').isNotEmpty;

  bool get isDirty =>
      draft.cartItems.isNotEmpty ||
      draft.service != null ||
      draft.notes.trim().isNotEmpty ||
      draft.generalOrderNote.trim().isNotEmpty ||
      draft.promoCode.trim().isNotEmpty ||
      draft.giftCardCode.trim().isNotEmpty ||
      stepIndex > 0;

  int get totalItemCount =>
      draft.cartItems.values.fold(0, (sum, qty) => sum + qty);

  bool get hasCartItems => draft.cartItems.isNotEmpty;

  double get estimatedSubtotal {
    if (serverQuote != null && serverQuote!.subtotal > 0) {
      return serverQuote!.subtotal;
    }
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

  double get estimatedVat => serverQuote != null && serverQuote!.orderTotal > 0
      ? serverQuote!.taxTotal
      : estimatedSubtotal * vatRate;

  double get estimatedTotal =>
      serverQuote != null && serverQuote!.orderTotal > 0
          ? serverQuote!.orderTotal
          : estimatedSubtotal + estimatedVat;

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
    if ((draft.branchId ?? '').isEmpty) {
      issues.add('booking.missingBranchDetail');
    }
    if (draft.cartItems.isEmpty) {
      issues.add('booking.missingItemsDetail');
    }
    final needsPickupAddress =
        draft.pickupMode == CustomerPickupMode.collectAddress;
    final needsDeliveryAddress =
        draft.deliveryMode == CustomerDeliveryMode.deliverAddress;
    if (needsPickupAddress && draft.address == null) {
      issues.add('booking.missingAddressDetail');
    }
    if (needsDeliveryAddress &&
        (draft.deliveryAddress ?? draft.address) == null &&
        !issues.contains('booking.missingAddressDetail')) {
      issues.add('booking.missingAddressDetail');
    }
    if (needsPickupAddress && !draft.isAsap && draft.scheduledAt == null) {
      issues.add('booking.missingScheduleDetail');
    }
    return issues;
  }

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

  String get fulfillmentType {
    final collect = draft.pickupMode == CustomerPickupMode.collectAddress;
    final deliver = draft.deliveryMode == CustomerDeliveryMode.deliverAddress;
    if (collect && deliver) return 'collection_and_delivery';
    if (collect && !deliver) return 'home_collection';
    if (!collect && deliver) return 'delivery';
    return 'bring_in';
  }

  BookingState copyWith({
    bool? isLoading,
    bool? isSubmitting,
    bool? isSavingAddress,
    bool? isLoadingQuote,
    bool? isBookingEnabled,
    String? disabledReasonKey,
    int? stepIndex,
    String? errorMessageKey,
    bool clearErrorMessage = false,
    String? quoteErrorMessageKey,
    bool clearQuoteError = false,
    List<String>? validationIssueKeys,
    bool clearValidationIssues = false,
    String? submittedOrderNumber,
    String? submittedPromisedWindow,
    String? submittedTotalAmount,
    String? submittedCurrencyCode,
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
    List<BookingServiceSpeedModel>? serviceSpeeds,
    String? currencyCode,
    CustomerProfileModel? customerProfile,
    PosQuoteBreakdownModel? serverQuote,
    bool clearServerQuote = false,
  }) {
    return BookingState(
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      isSavingAddress: isSavingAddress ?? this.isSavingAddress,
      isLoadingQuote: isLoadingQuote ?? this.isLoadingQuote,
      isBookingEnabled: isBookingEnabled ?? this.isBookingEnabled,
      disabledReasonKey: disabledReasonKey ?? this.disabledReasonKey,
      stepIndex: stepIndex ?? this.stepIndex,
      errorMessageKey:
          clearErrorMessage ? null : (errorMessageKey ?? this.errorMessageKey),
      quoteErrorMessageKey: clearQuoteError
          ? null
          : (quoteErrorMessageKey ?? this.quoteErrorMessageKey),
      validationIssueKeys: clearValidationIssues
          ? const []
          : (validationIssueKeys ?? this.validationIssueKeys),
      submittedOrderNumber: submittedOrderNumber ?? this.submittedOrderNumber,
      submittedPromisedWindow:
          submittedPromisedWindow ?? this.submittedPromisedWindow,
      submittedTotalAmount: submittedTotalAmount ?? this.submittedTotalAmount,
      submittedCurrencyCode:
          submittedCurrencyCode ?? this.submittedCurrencyCode,
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
      serviceSpeeds: serviceSpeeds ?? this.serviceSpeeds,
      currencyCode: currencyCode ?? this.currencyCode,
      customerProfile: customerProfile ?? this.customerProfile,
      serverQuote:
          clearServerQuote ? null : (serverQuote ?? this.serverQuote),
    );
  }
}

class CustomerOrderBookingNotifier extends Notifier<BookingState> {
  Timer? _quoteDebounce;

  @override
  BookingState build() {
    ref.onDispose(() {
      _quoteDebounce?.cancel();
    });
    return const BookingState();
  }

  CustomerOrderBookingRepository get _repo =>
      ref.read(customerOrderBookingRepositoryProvider);
  CustomerSessionModel? get _session =>
      ref.read(customerSessionFlowProvider).session;

  // ── Load ────────────────────────────────────────────────────────────────

  Future<void> load({String? branchIdOverride}) async {
    final tenant = ref.read(tenantProvider).valueOrNull;
    final initialBranchId = branchIdOverride ??
        state.draft.branchId ??
        tenant?.lastBranchId ??
        (tenant != null && tenant.branches.isNotEmpty
            ? tenant.branches.first.id
            : _session?.branchId);

    AppLogger.info(
      'booking_provider.load_started hasSession=${_session != null} '
      'tenant=${_session?.tenantOrgId ?? 'none'} branch=$initialBranchId',
    );
    state = state.copyWith(
      isLoading: true,
      clearErrorMessage: true,
      clearValidationIssues: true,
    );
    try {
      final bootstrap = await _repo.loadBootstrap(
        _session,
        branchId: initialBranchId,
      );
      final resolvedBranchId = initialBranchId ??
          bootstrap.customerProfile?.lastBranchId ??
          (tenant != null && tenant.branches.isNotEmpty
              ? tenant.branches.first.id
              : null);
      final defaultAddr = _defaultAddress(bootstrap.addresses);
      final profile = bootstrap.customerProfile;
      final autoNote = (profile?.autoApplyOrderDefaultNote == true)
          ? (profile?.defaultOrderNote ?? '')
          : '';

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
        serviceSpeeds: bootstrap.serviceSpeeds,
        currencyCode: bootstrap.currencyCode,
        customerProfile: profile,
        draft: _draftWithOfferedSpeed(
          state.draft.copyWith(
            branchId: resolvedBranchId,
            address: state.draft.address ?? defaultAddr,
            deliveryAddress: state.draft.deliveryAddress ?? defaultAddr,
            isPickupFromAddress:
                state.draft.pickupMode == CustomerPickupMode.collectAddress,
            generalOrderNote: state.draft.generalOrderNote.isEmpty
                ? autoNote
                : state.draft.generalOrderNote,
            saveGeneralNoteForFuture:
                profile?.autoApplyOrderDefaultNote ?? false,
          ),
          bootstrap.serviceSpeeds,
        ),
      );
      AppLogger.info(
        'booking_provider.load_succeeded '
        'categories=${bootstrap.categories.length} '
        'addresses=${bootstrap.addresses.length} branch=$resolvedBranchId',
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

  // ── Step 0 — Fulfillment & Branch ───────────────────────────────────────

  Future<void> chooseBranch(String? branchId) async {
    if (branchId == null || branchId.isEmpty) return;
    final changed = state.draft.branchId != branchId;
    state = state.copyWith(
      draft: state.draft.copyWith(branchId: branchId),
      clearServerQuote: changed,
    );
    if (changed && state.categories.isNotEmpty) {
      // Mid-draft branch change reloads branch-scoped pricing/catalog & quote.
      await load(branchIdOverride: branchId);
      scheduleQuoteRefresh();
    }
  }

  void setPickupMode(CustomerPickupMode mode) {
    state = state.copyWith(
      draft: state.draft.copyWith(
        pickupMode: mode,
        isPickupFromAddress: mode == CustomerPickupMode.collectAddress,
      ),
    );
    scheduleQuoteRefresh();
  }

  void setDeliveryMode(CustomerDeliveryMode mode) {
    state = state.copyWith(
      draft: state.draft.copyWith(deliveryMode: mode),
    );
    scheduleQuoteRefresh();
  }

  void chooseDeliveryAddress(AddressOptionModel value) {
    state = state.copyWith(
      draft: state.draft.copyWith(deliveryAddress: value),
    );
  }

  // ── Step 1 — Item cart + per-item notes ─────────────────────────────────

  void addItem(String itemId) {
    final current = Map<String, int>.from(state.draft.cartItems);
    current[itemId] = (current[itemId] ?? 0) + 1;
    state = state.copyWith(
      draft: state.draft.copyWith(cartItems: Map.unmodifiable(current)),
    );
    initPiecePreferences(itemId, current[itemId]!);
    scheduleQuoteRefresh();
  }

  void removeItem(String itemId) {
    final current = Map<String, int>.from(state.draft.cartItems);
    final qty = (current[itemId] ?? 0) - 1;
    if (qty <= 0) {
      current.remove(itemId);
    } else {
      current[itemId] = qty;
    }
    state = state.copyWith(
      draft: state.draft.copyWith(cartItems: Map.unmodifiable(current)),
    );
    scheduleQuoteRefresh();
  }

  void setItemQty(String itemId, int qty) {
    final current = Map<String, int>.from(state.draft.cartItems);
    if (qty <= 0) {
      current.remove(itemId);
    } else {
      current[itemId] = qty;
    }
    state = state.copyWith(
      draft: state.draft.copyWith(cartItems: Map.unmodifiable(current)),
    );
    if (qty > 0) initPiecePreferences(itemId, qty);
    scheduleQuoteRefresh();
  }

  void setItemNote(String itemId, String note) {
    final next = Map<String, String>.from(state.draft.itemNotes);
    final trimmed =
        note.length > _notesMaxLength ? note.substring(0, _notesMaxLength) : note;
    if (trimmed.isEmpty) {
      next.remove(itemId);
    } else {
      next[itemId] = trimmed;
    }
    state = state.copyWith(
      draft: state.draft.copyWith(itemNotes: Map.unmodifiable(next)),
    );
  }

  void setItemSearchQuery(String query) {
    state = state.copyWith(itemSearchQuery: query);
  }

  // ── Step 2 — Preferences & Per-piece overrides ──────────────────────────

  void setApplyProfilePrefsToAll(bool value) {
    state = state.copyWith(
      draft: state.draft.copyWith(applyProfilePrefsToAll: value),
    );
  }

  void setPreferencesNote(String value) {
    final next = value.length > _notesMaxLength
        ? value.substring(0, _notesMaxLength)
        : value;
    state = state.copyWith(
      draft: state.draft.copyWith(preferencesNote: next),
    );
  }

  void toggleServicePreference(String id) {
    final current = List<String>.from(state.draft.selectedServicePreferenceIds);
    if (current.contains(id)) {
      current.remove(id);
    } else {
      current.add(id);
    }
    state = state.copyWith(
      draft: state.draft.copyWith(
        selectedServicePreferenceIds: List.unmodifiable(current),
      ),
    );
    scheduleQuoteRefresh();
  }

  void togglePickupPreference(String id) {
    final current = List<String>.from(state.draft.selectedPickupPreferenceIds);
    if (current.contains(id)) {
      current.remove(id);
    } else {
      current.add(id);
    }
    state = state.copyWith(
      draft: state.draft.copyWith(
        selectedPickupPreferenceIds: List.unmodifiable(current),
      ),
    );
    scheduleQuoteRefresh();
  }

  void togglePreferenceForKind(String kindCode, String id) {
    if (kindCode == _packingPreferenceKindCode) {
      togglePickupPreference(id);
      return;
    }
    toggleServicePreference(id);
  }

  void initPiecePreferences(String itemId, int qty) {
    final existing = state.draft.piecePreferences[itemId];
    if (existing != null && existing.length == qty) return;
    final pieces = List<BookingPiecePreferenceModel>.generate(
      qty,
      (i) => (existing != null && i < existing.length)
          ? existing[i]
          : BookingPiecePreferenceModel(pieceSeq: i + 1),
      growable: false,
    );
    final updated = Map<String, List<BookingPiecePreferenceModel>>.from(
      state.draft.piecePreferences,
    );
    updated[itemId] = List.unmodifiable(pieces);
    state = state.copyWith(
      draft: state.draft.copyWith(
        piecePreferences: Map.unmodifiable(updated),
      ),
    );
  }

  void togglePieceServicePref(String itemId, int pieceSeq, String prefId) {
    _updatePiece(itemId, pieceSeq, (piece) {
      final current = List<String>.from(piece.servicePreferenceIds);
      if (current.contains(prefId)) {
        current.remove(prefId);
      } else {
        current.add(prefId);
      }
      return piece.copyWith(
        servicePreferenceIds: List.unmodifiable(current),
      );
    });
    scheduleQuoteRefresh();
  }

  void setPiecePacking(String itemId, int pieceSeq, String? code) {
    _updatePiece(
      itemId,
      pieceSeq,
      (piece) => piece.copyWith(
        packingPrefCode: code,
        clearPackingPref: code == null,
      ),
    );
  }

  void setPieceColor(String itemId, int pieceSeq, String? colorCode) {
    _updatePiece(
      itemId,
      pieceSeq,
      (piece) => piece.copyWith(
        colorCode: colorCode,
        clearColorCode: colorCode == null,
      ),
    );
  }

  void setPieceNotes(String itemId, int pieceSeq, String notes) {
    _updatePiece(
      itemId,
      pieceSeq,
      (piece) => piece.copyWith(notes: notes),
    );
  }

  void _updatePiece(
    String itemId,
    int pieceSeq,
    BookingPiecePreferenceModel Function(BookingPiecePreferenceModel) update,
  ) {
    final pieces = state.draft.piecePreferences[itemId];
    if (pieces == null) return;
    final index = pieceSeq - 1;
    if (index < 0 || index >= pieces.length) return;
    final updated = List<BookingPiecePreferenceModel>.from(pieces);
    updated[index] = update(pieces[index]);
    final updatedMap = Map<String, List<BookingPiecePreferenceModel>>.from(
      state.draft.piecePreferences,
    );
    updatedMap[itemId] = List.unmodifiable(updated);
    state = state.copyWith(
      draft: state.draft.copyWith(
        piecePreferences: Map.unmodifiable(updatedMap),
      ),
    );
  }

  // ── Step 3 — Schedule & Speed ───────────────────────────────────────────

  void setIsPickupFromAddress(bool value) {
    setPickupMode(
      value
          ? CustomerPickupMode.collectAddress
          : CustomerPickupMode.storeDropoff,
    );
  }

  void setIsAsap(bool value) {
    state = state.copyWith(
      draft: state.draft.copyWith(isAsap: value),
    );
  }

  void setScheduledAt(DateTime value) {
    state = state.copyWith(
      draft: state.draft.copyWith(scheduledAt: value),
    );
  }

  void chooseAddress(AddressOptionModel value) {
    state = state.copyWith(
      draft: state.draft.copyWith(
        address: value,
        deliveryAddress: state.draft.deliveryAddress ?? value,
      ),
    );
  }

  Future<void> saveNewAddress(NewAddressInputModel input) async {
    if (state.isSavingAddress) return;

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
          deliveryAddress: state.draft.deliveryAddress ?? newAddress,
          clearNewAddress: true,
        ),
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

  void chooseServiceSpeed(String code) {
    state = state.copyWith(
      draft: state.draft.copyWith(serviceSpeed: code),
    );
    scheduleQuoteRefresh();
  }

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

  // ── Step 4 — Promo, Gift Card, Payment Notes & General Order Note ───────

  void setPromoCode(String value) {
    state = state.copyWith(draft: state.draft.copyWith(promoCode: value));
  }

  void setGiftCardCode(String value) {
    state = state.copyWith(draft: state.draft.copyWith(giftCardCode: value));
  }

  void setPaymentNotes(String value) {
    final next = value.length > 400 ? value.substring(0, 400) : value;
    state = state.copyWith(draft: state.draft.copyWith(paymentNotes: next));
  }

  void setGeneralOrderNote(String value) {
    final next = value.length > _notesMaxLength
        ? value.substring(0, _notesMaxLength)
        : value;
    state = state.copyWith(
      draft: state.draft.copyWith(generalOrderNote: next, notes: next),
    );
  }

  void setSaveGeneralNoteForFuture(bool value) {
    state = state.copyWith(
      draft: state.draft.copyWith(saveGeneralNoteForFuture: value),
    );
  }

  void updateNotes(String value) => setGeneralOrderNote(value);

  // ── Live POS-Parity Server Quote (debounced 350ms) ──────────────────────

  void scheduleQuoteRefresh() {
    _quoteDebounce?.cancel();
    if (state.draft.cartItems.isEmpty || (state.draft.branchId ?? '').isEmpty) {
      return;
    }
    _quoteDebounce = Timer(const Duration(milliseconds: 350), () {
      refreshServerQuote();
    });
  }

  Future<void> refreshServerQuote() async {
    if (state.draft.cartItems.isEmpty || (state.draft.branchId ?? '').isEmpty) {
      return;
    }
    final session = _session;
    final tenant = ref.read(tenantProvider).valueOrNull;
    final tenantId = tenant?.tenantOrgId ?? session?.tenantOrgId ?? '';
    final token = session?.verificationToken ?? '';

    state = state.copyWith(isLoadingQuote: true, clearQuoteError: true);
    try {
      final quote = await ref
          .read(customerBookingQuoteServiceProvider)
          .fetchServerQuote(
            tenantId: tenantId,
            bearerToken: token,
            draft: state.draft,
          );
      state = state.copyWith(isLoadingQuote: false, serverQuote: quote);
    } catch (error, stackTrace) {
      AppLogger.error(
        'booking_provider.quote_failed',
        error: error,
        stackTrace: stackTrace,
      );
      state = state.copyWith(
        isLoadingQuote: false,
        quoteErrorMessageKey: error is AppException
            ? error.messageKey
            : 'common.remoteRequestError',
      );
    }
  }

  // ── Navigation (6 steps: 0..5) ──────────────────────────────────────────

  void goNext() {
    if (state.stepIndex < BookingState.reviewStepIndex && canProceed()) {
      final nextIndex = state.stepIndex + 1;
      AppLogger.info(
        'booking_provider.step_next from=${state.stepIndex} to=$nextIndex',
      );
      state = state.copyWith(
        stepIndex: nextIndex,
        clearErrorMessage: true,
        clearValidationIssues: true,
      );
      if (nextIndex == 3 || nextIndex == BookingState.reviewStepIndex) {
        refreshServerQuote();
      }
    }
  }

  void goBack() {
    if (state.stepIndex > 0) {
      state = state.copyWith(stepIndex: state.stepIndex - 1);
    }
  }

  bool canProceed() {
    switch (state.stepIndex) {
      case 0:
        // Step 1/6: Branch is MANDATORY for Detailed Order!
        if ((state.draft.branchId ?? '').isEmpty) return false;
        if (state.draft.pickupMode == CustomerPickupMode.collectAddress &&
            state.addresses.isNotEmpty &&
            state.draft.address == null) {
          return false;
        }
        return true;
      case 1:
        // Step 2/6: At least one item selected.
        return state.draft.cartItems.isNotEmpty;
      case 2:
        // Step 3/6: Preferences optional.
        return true;
      case 3:
        // Step 4/6: Schedule.
        if (state.draft.pickupMode != CustomerPickupMode.collectAddress) {
          return true;
        }
        if (state.draft.isAsap) return state.draft.address != null;
        return state.draft.address != null && state.draft.scheduledAt != null;
      case 4:
        // Step 5/6: Offers & Notes optional.
        return true;
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
      state = state.copyWith(errorMessageKey: 'booking.disabledBody');
      return;
    }

    final localValidationIssues = state.submitValidationIssueKeys;
    if (localValidationIssues.isNotEmpty) {
      state = state.copyWith(
        errorMessageKey: 'booking.validationIncomplete',
        validationIssueKeys: localValidationIssues,
      );
      return;
    }

    if (state.isSubmitting) return;

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
        submittedTotalAmount: confirmation.totalAmount,
        submittedCurrencyCode: confirmation.currencyCode,
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
      final speedRefused = error is OrderBookingServiceException &&
          error.messageKey == 'booking.speedNotOfferedError';
      state = state.copyWith(
        isSubmitting: false,
        errorMessageKey: error is AppException
            ? error.messageKey
            : 'booking.submitErrorBody',
        validationIssueKeys: _validationIssueKeysForSubmitError(error),
        draft: speedRefused
            ? state.draft.copyWith(clearServiceSpeed: true)
            : null,
        stepIndex: speedRefused ? _scheduleStepIndex : null,
      );
    }
  }

  static const int _scheduleStepIndex = 3;

  void clearError() {
    state = state.copyWith(clearErrorMessage: true);
  }

  OrderBookingDraftModel _draftWithOfferedSpeed(
    OrderBookingDraftModel draft,
    List<BookingServiceSpeedModel> offered,
  ) {
    final chosen = draft.serviceSpeed;
    if (chosen == null || offered.any((speed) => speed.code == chosen)) {
      return draft;
    }
    return draft.copyWith(clearServiceSpeed: true);
  }

  AddressOptionModel? _defaultAddress(List<AddressOptionModel> addresses) {
    for (final address in addresses) {
      if (address.isDefault) return address;
    }
    return addresses.isNotEmpty ? addresses.first : null;
  }
}
