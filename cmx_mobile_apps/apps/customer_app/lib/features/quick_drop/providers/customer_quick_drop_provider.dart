import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

import '../../../core/app_shell_controller.dart';
import '../../../core/providers/customer_api_client_providers.dart';
import '../../tenant/providers/tenant_provider.dart';

/// Lists the authenticated customer's submitted Fast Quick Drop requests
/// for the active tenant.
final customerQuickDropRequestsProvider =
    FutureProvider<List<QuickDropRequestModel>>((ref) async {
  final session = ref.watch(customerSessionFlowProvider.select((f) => f.session));
  final token = session?.verificationToken;
  if (session == null || session.isGuest || token == null || token.isEmpty) {
    return const [];
  }
  final tenant = ref.watch(tenantProvider).valueOrNull;
  final tenantId = tenant?.tenantOrgId ?? session.tenantOrgId;
  if (tenantId == null || tenantId.isEmpty) {
    return const [];
  }
  return ref.read(quickDropServiceProvider).listRequests(
        tenantId: tenantId,
        bearerToken: token,
      );
});

@immutable
class QuickDropFlowState {
  const QuickDropFlowState({
    this.isLoadingCatalog = false,
    this.isSubmitting = false,
    this.stepIndex = 0,
    this.draft = const QuickDropDraftModel(),
    this.addresses = const [],
    this.categories = const [],
    this.serviceSpeeds = const [],
    this.catalogSearchQuery = '',
    this.selectedCategoryId,
    this.errorMessageKey,
    this.submittedRequest,
    this.idempotencyKey,
  });

  final bool isLoadingCatalog;
  final bool isSubmitting;
  final int stepIndex;
  final QuickDropDraftModel draft;
  final List<AddressOptionModel> addresses;
  final List<BookingCatalogCategoryModel> categories;
  final List<BookingServiceSpeedModel> serviceSpeeds;
  final String catalogSearchQuery;
  final String? selectedCategoryId;
  final String? errorMessageKey;
  final QuickDropRequestModel? submittedRequest;
  final String? idempotencyKey;

  bool get hasSubmitted => submittedRequest != null;

  bool get isDirty =>
      draft.declaredLines.isNotEmpty ||
      draft.customerNotes.trim().isNotEmpty ||
      stepIndex > 0;

  List<({BookingCatalogCategoryModel category, BookingCatalogItemModel item})>
      get filteredCatalogItems {
    final query = catalogSearchQuery.trim().toLowerCase();
    final results =
        <({BookingCatalogCategoryModel category, BookingCatalogItemModel item})>[];
    for (final cat in categories) {
      if (selectedCategoryId != null &&
          selectedCategoryId!.isNotEmpty &&
          cat.id != selectedCategoryId) {
        continue;
      }
      for (final item in cat.items) {
        if (query.isEmpty ||
            item.name.toLowerCase().contains(query) ||
            (item.name2?.toLowerCase().contains(query) ?? false) ||
            cat.name.toLowerCase().contains(query)) {
          results.add((category: cat, item: item));
        }
      }
    }
    return results;
  }

  QuickDropFlowState copyWith({
    bool? isLoadingCatalog,
    bool? isSubmitting,
    int? stepIndex,
    QuickDropDraftModel? draft,
    List<AddressOptionModel>? addresses,
    List<BookingCatalogCategoryModel>? categories,
    List<BookingServiceSpeedModel>? serviceSpeeds,
    String? catalogSearchQuery,
    String? selectedCategoryId,
    bool clearSelectedCategory = false,
    String? errorMessageKey,
    bool clearError = false,
    QuickDropRequestModel? submittedRequest,
    String? idempotencyKey,
  }) {
    return QuickDropFlowState(
      isLoadingCatalog: isLoadingCatalog ?? this.isLoadingCatalog,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      stepIndex: stepIndex ?? this.stepIndex,
      draft: draft ?? this.draft,
      addresses: addresses ?? this.addresses,
      categories: categories ?? this.categories,
      serviceSpeeds: serviceSpeeds ?? this.serviceSpeeds,
      catalogSearchQuery: catalogSearchQuery ?? this.catalogSearchQuery,
      selectedCategoryId: clearSelectedCategory
          ? null
          : (selectedCategoryId ?? this.selectedCategoryId),
      errorMessageKey:
          clearError ? null : (errorMessageKey ?? this.errorMessageKey),
      submittedRequest: submittedRequest ?? this.submittedRequest,
      idempotencyKey: idempotencyKey ?? this.idempotencyKey,
    );
  }
}

final customerQuickDropFlowProvider =
    NotifierProvider<CustomerQuickDropNotifier, QuickDropFlowState>(
  CustomerQuickDropNotifier.new,
);

class CustomerQuickDropNotifier extends Notifier<QuickDropFlowState> {
  @override
  QuickDropFlowState build() {
    return QuickDropFlowState(
      idempotencyKey: 'qd-${DateTime.now().microsecondsSinceEpoch}',
    );
  }

  Future<void> initialize() async {
    final session = ref.read(customerSessionFlowProvider).session;
    final tenant = ref.read(tenantProvider).valueOrNull;
    final defaultBranch = tenant?.lastBranchId ??
        (tenant != null && tenant.branches.isNotEmpty
            ? tenant.branches.first.id
            : null);

    state = state.copyWith(
      isLoadingCatalog: true,
      clearError: true,
      draft: state.draft.copyWith(requestedBranchId: defaultBranch),
    );

    try {
      final bootstrap = await ref
          .read(customerOrderBookingRepositoryProvider)
          .loadBootstrap(session, branchId: defaultBranch);
      final defaultAddr = bootstrap.addresses.isEmpty
          ? null
          : bootstrap.addresses.firstWhere(
              (a) => a.isDefault,
              orElse: () => bootstrap.addresses.first,
            );
      final defaultNote =
          (bootstrap.customerProfile?.autoApplyOrderDefaultNote == true)
              ? (bootstrap.customerProfile?.defaultOrderNote ?? '')
              : '';

      state = state.copyWith(
        isLoadingCatalog: false,
        addresses: bootstrap.addresses,
        categories: bootstrap.categories,
        serviceSpeeds: bootstrap.serviceSpeeds,
        draft: state.draft.copyWith(
          pickupAddressId: state.draft.pickupAddressId ?? defaultAddr?.id,
          deliveryAddressId: state.draft.deliveryAddressId ?? defaultAddr?.id,
          serviceSpeedCode: state.draft.serviceSpeedCode ??
              (bootstrap.serviceSpeeds.isNotEmpty
                  ? bootstrap.serviceSpeeds.first.code
                  : 'STANDARD'),
          customerNotes: state.draft.customerNotes.isEmpty
              ? defaultNote
              : state.draft.customerNotes,
        ),
      );
    } catch (error, stackTrace) {
      AppLogger.error(
        'quick_drop.initialize_failed',
        error: error,
        stackTrace: stackTrace,
      );
      state = state.copyWith(isLoadingCatalog: false);
    }
  }

  void setBranchId(String? branchId) {
    state = state.copyWith(
      draft: branchId == null
          ? state.draft.copyWith(clearBranch: true)
          : state.draft.copyWith(requestedBranchId: branchId),
    );
  }

  void setPickupMode(CustomerPickupMode mode) {
    state = state.copyWith(draft: state.draft.copyWith(pickupMode: mode));
  }

  void setDeliveryMode(CustomerDeliveryMode mode) {
    state = state.copyWith(draft: state.draft.copyWith(deliveryMode: mode));
  }

  void setPickupAddressId(String addressId) {
    state = state.copyWith(
      draft: state.draft.copyWith(
        pickupAddressId: addressId,
        deliveryAddressId: state.draft.deliveryAddressId ?? addressId,
      ),
    );
  }

  void setDeliveryAddressId(String addressId) {
    state = state.copyWith(
      draft: state.draft.copyWith(deliveryAddressId: addressId),
    );
  }

  void setServiceSpeed(String code) {
    state = state.copyWith(draft: state.draft.copyWith(serviceSpeedCode: code));
  }

  void setEstimatedBags(int bags) {
    state = state.copyWith(
      draft: state.draft.copyWith(estimatedTotalBags: bags.clamp(0, 99)),
    );
  }

  void setEstimatedPieces(int pieces) {
    state = state.copyWith(
      draft: state.draft.copyWith(estimatedTotalPieces: pieces.clamp(0, 200)),
    );
  }

  void setNotes(String notes) {
    state = state.copyWith(draft: state.draft.copyWith(customerNotes: notes));
  }

  void setCatalogSearchQuery(String query) {
    state = state.copyWith(catalogSearchQuery: query);
  }

  void setSelectedCategoryId(String? categoryId) {
    state = state.copyWith(
      selectedCategoryId: categoryId,
      clearSelectedCategory: categoryId == null || categoryId.isEmpty,
    );
  }

  /// Adds an optional real catalog item & service category helper row.
  void addCatalogItemLine({
    required BookingCatalogCategoryModel category,
    required BookingCatalogItemModel item,
  }) {
    final existing = List<QuickDropDeclaredLineModel>.from(
      state.draft.declaredLines,
    );
    final idx = existing.indexWhere((l) => l.productId == item.id);
    if (idx >= 0) {
      final current = existing[idx];
      existing[idx] = QuickDropDeclaredLineModel(
        lineNo: current.lineNo,
        serviceCategoryCode: current.serviceCategoryCode,
        productId: current.productId,
        itemName: current.itemName,
        quantity: current.quantity + 1,
        customerNotes: current.customerNotes,
      );
    } else {
      existing.add(
        QuickDropDeclaredLineModel(
          lineNo: existing.length + 1,
          serviceCategoryCode: category.id,
          productId: item.id,
          itemName: item.name,
          quantity: 1,
        ),
      );
    }
    _applyLines(existing);
  }

  /// Adds a free-text declared item line.
  void addFreeTextLine({
    required String itemName,
    int quantity = 1,
    String? notes,
  }) {
    final trimmed = itemName.trim();
    if (trimmed.isEmpty) return;
    final existing = List<QuickDropDeclaredLineModel>.from(
      state.draft.declaredLines,
    );
    existing.add(
      QuickDropDeclaredLineModel(
        lineNo: existing.length + 1,
        itemName: trimmed,
        quantity: quantity.clamp(1, 99),
        customerNotes: notes?.trim().isNotEmpty == true ? notes!.trim() : null,
      ),
    );
    _applyLines(existing);
  }

  void updateLineQuantity(int index, int nextQty) {
    final existing = List<QuickDropDeclaredLineModel>.from(
      state.draft.declaredLines,
    );
    if (index < 0 || index >= existing.length) return;
    if (nextQty <= 0) {
      existing.removeAt(index);
    } else {
      final row = existing[index];
      existing[index] = QuickDropDeclaredLineModel(
        lineNo: row.lineNo,
        serviceCategoryCode: row.serviceCategoryCode,
        productId: row.productId,
        itemName: row.itemName,
        quantity: nextQty.clamp(1, 99),
        customerNotes: row.customerNotes,
      );
    }
    _applyLines(existing);
  }

  void _applyLines(List<QuickDropDeclaredLineModel> lines) {
    final totalDeclaredQty =
        lines.fold<int>(0, (sum, row) => sum + row.quantity);
    final nextPieces = totalDeclaredQty > state.draft.estimatedTotalPieces
        ? totalDeclaredQty
        : state.draft.estimatedTotalPieces;
    state = state.copyWith(
      draft: state.draft.copyWith(
        declaredLines: List.unmodifiable(lines),
        estimatedTotalPieces: nextPieces,
      ),
    );
  }

  bool canProceed() {
    if (state.stepIndex == 0) {
      if (state.draft.pickupMode == CustomerPickupMode.collectAddress &&
          state.addresses.isNotEmpty &&
          (state.draft.pickupAddressId ?? '').isEmpty) {
        return false;
      }
      if (state.draft.deliveryMode == CustomerDeliveryMode.deliverAddress &&
          state.addresses.isNotEmpty &&
          (state.draft.deliveryAddressId ?? '').isEmpty) {
        return false;
      }
      return true;
    }
    if (state.stepIndex == 1) {
      return state.draft.estimatedTotalBags > 0 ||
          state.draft.estimatedTotalPieces > 0 ||
          state.draft.declaredLines.isNotEmpty;
    }
    return true;
  }

  void goNext() {
    if (state.stepIndex < 2 && canProceed()) {
      state = state.copyWith(stepIndex: state.stepIndex + 1, clearError: true);
    }
  }

  void goBack() {
    if (state.stepIndex > 0) {
      state = state.copyWith(stepIndex: state.stepIndex - 1, clearError: true);
    }
  }

  Future<void> submit() async {
    if (state.isSubmitting) return;
    final session = ref.read(customerSessionFlowProvider).session;
    final tenant = ref.read(tenantProvider).valueOrNull;
    final tenantId = tenant?.tenantOrgId ?? session?.tenantOrgId ?? '';
    final token = session?.verificationToken ?? '';

    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final result = await ref.read(quickDropServiceProvider).submitRequest(
            tenantId: tenantId,
            bearerToken: token,
            draft: state.draft,
            idempotencyKey:
                state.idempotencyKey ?? 'qd-${DateTime.now().microsecondsSinceEpoch}',
          );
      state = state.copyWith(
        isSubmitting: false,
        submittedRequest: result,
      );
      ref.invalidate(customerQuickDropRequestsProvider);
      AppLogger.info(
        'quick_drop.submit_succeeded requestNo=${result.requestNo}',
      );
    } catch (error, stackTrace) {
      AppLogger.error(
        'quick_drop.submit_failed',
        error: error,
        stackTrace: stackTrace,
      );
      state = state.copyWith(
        isSubmitting: false,
        errorMessageKey: error is AppException
            ? error.messageKey
            : 'common.remoteRequestError',
      );
    }
  }
}
