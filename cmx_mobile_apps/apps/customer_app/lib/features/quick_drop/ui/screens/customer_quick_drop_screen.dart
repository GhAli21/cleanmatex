import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/navigation/app_route.dart';
import '../../../booking/ui/widgets/customer_fulfillment_branch_widget.dart';
import '../../../tenant/providers/tenant_provider.dart';
import '../../providers/customer_quick_drop_provider.dart';

/// 3-step Fast Quick Drop unpriced request flow:
/// 1. Fulfillment & optional Branch (2×2 pickup/delivery)
/// 2. Speed, Bag/Piece steppers & optional real catalog/free-text item helper
/// 3. Unpriced Review & Submit → `REQ-*` confirmation
class CustomerQuickDropScreen extends ConsumerStatefulWidget {
  const CustomerQuickDropScreen({super.key});

  @override
  ConsumerState<CustomerQuickDropScreen> createState() =>
      _CustomerQuickDropScreenState();
}

class _CustomerQuickDropScreenState
    extends ConsumerState<CustomerQuickDropScreen> {
  bool _initialized = false;
  final TextEditingController _notesController = TextEditingController();
  final TextEditingController _freeItemController = TextEditingController();
  final TextEditingController _catalogSearchController = TextEditingController();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) return;
    _initialized = true;
    ref.invalidate(customerQuickDropFlowProvider);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(customerQuickDropFlowProvider.notifier).initialize();
    });
  }

  @override
  void dispose() {
    _notesController.dispose();
    _freeItemController.dispose();
    _catalogSearchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(customerQuickDropFlowProvider);
    final notifier = ref.read(customerQuickDropFlowProvider.notifier);
    final tenant = ref.watch(tenantProvider).valueOrNull;
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

    if (_notesController.text != state.draft.customerNotes) {
      _notesController.value = TextEditingValue(
        text: state.draft.customerNotes,
        selection:
            TextSelection.collapsed(offset: state.draft.customerNotes.length),
      );
    }

    return PopScope(
      canPop: !state.isDirty || state.hasSubmitted,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop || !state.isDirty || state.hasSubmitted) return;
        final leave = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text(l10n.text('booking.discardTitle')),
            content: Text(l10n.text('booking.discardBody')),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: Text(l10n.text('booking.discardStay')),
              ),
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(true),
                child: Text(l10n.text('booking.discardLeave')),
              ),
            ],
          ),
        );
        if (leave == true && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(l10n.text('quickDrop.title')),
        ),
        body: SafeArea(
          child: state.hasSubmitted
              ? _QuickDropSuccessView(request: state.submittedRequest!)
              : Column(
                  children: [
                    // Step indicator bar
                    Padding(
                      padding: const EdgeInsetsDirectional.fromSTEB(
                        AppSpacing.lg,
                        AppSpacing.md,
                        AppSpacing.lg,
                        AppSpacing.sm,
                      ),
                      child: _QuickDropStepBar(stepIndex: state.stepIndex),
                    ),
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsetsDirectional.fromSTEB(
                          AppSpacing.lg,
                          AppSpacing.sm,
                          AppSpacing.lg,
                          AppSpacing.xxl,
                        ),
                        children: [
                          if (state.stepIndex == 0)
                            CustomerFulfillmentBranchWidget(
                              branches: tenant?.branches ?? const [],
                              selectedBranchId: state.draft.requestedBranchId,
                              lastBranchId: tenant?.lastBranchId,
                              isBranchMandatory: false,
                              onBranchChanged: notifier.setBranchId,
                              pickupMode: state.draft.pickupMode,
                              onPickupModeChanged: notifier.setPickupMode,
                              deliveryMode: state.draft.deliveryMode,
                              onDeliveryModeChanged: notifier.setDeliveryMode,
                              addresses: state.addresses,
                              selectedPickupAddressId:
                                  state.draft.pickupAddressId,
                              onPickupAddressChanged: (a) =>
                                  notifier.setPickupAddressId(a.id),
                              selectedDeliveryAddressId:
                                  state.draft.deliveryAddressId,
                              onDeliveryAddressChanged: (a) =>
                                  notifier.setDeliveryAddressId(a.id),
                            )
                          else if (state.stepIndex == 1)
                            _buildStep2BagAndOptionalItems(
                              context,
                              l10n,
                              state,
                              notifier,
                              theme,
                              ext,
                            )
                          else
                            _buildStep3UnpricedReview(
                              context,
                              l10n,
                              state,
                              tenant,
                              theme,
                              ext,
                            ),
                          if (state.errorMessageKey != null) ...[
                            const SizedBox(height: AppSpacing.md),
                            AppCardWidget(
                              accentColor: ext.error.foreground,
                              child: Text(
                                l10n.text(state.errorMessageKey!),
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: ext.error.foreground,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    // Sticky Bottom Action Bar
                    Container(
                      padding: const EdgeInsetsDirectional.fromSTEB(
                        AppSpacing.lg,
                        AppSpacing.md,
                        AppSpacing.lg,
                        AppSpacing.md,
                      ),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.surface,
                        border: Border(top: BorderSide(color: ext.border)),
                      ),
                      child: Row(
                        children: [
                          if (state.stepIndex > 0) ...[
                            Expanded(
                              child: AppCustomButtonWidget(
                                label: l10n.text('common.back'),
                                isPrimary: false,
                                onPressed: state.isSubmitting
                                    ? null
                                    : notifier.goBack,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.md),
                          ],
                          Expanded(
                            flex: 2,
                            child: AppCustomButtonWidget(
                              label: state.stepIndex == 2
                                  ? l10n.text('quickDrop.submitAction')
                                  : l10n.text('booking.nextAction'),
                              isLoading: state.isSubmitting,
                              onPressed: state.stepIndex == 2
                                  ? (state.isSubmitting
                                      ? null
                                      : notifier.submit)
                                  : (notifier.canProceed()
                                      ? notifier.goNext
                                      : null),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }

  Widget _buildStep2BagAndOptionalItems(
    BuildContext context,
    AppLocalizations l10n,
    QuickDropFlowState state,
    CustomerQuickDropNotifier notifier,
    ThemeData theme,
    CmxStatusThemeExtension ext,
  ) {
    final isAr = l10n.locale.languageCode == 'ar';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Speed selection
        if (state.serviceSpeeds.isNotEmpty) ...[
          Text(l10n.text('booking.speedLabel'),
              style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final speed in state.serviceSpeeds)
                ChoiceChip(
                  label: Text(isAr ? (speed.name2 ?? speed.name) : speed.name),
                  selected: (state.draft.serviceSpeedCode ?? 'STANDARD') ==
                      speed.code,
                  onSelected: (_) {
                    HapticFeedback.selectionClick();
                    notifier.setServiceSpeed(speed.code);
                  },
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
        ],

        // Bags & Estimated Pieces steppers
        AppCardWidget(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.text('quickDrop.estimatesTitle'),
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l10n.text('quickDrop.estimatedBagsLabel'),
                            style: theme.textTheme.titleSmall),
                        Text(
                          l10n.text('quickDrop.estimatedBagsHint'),
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: ext.textMuted),
                        ),
                      ],
                    ),
                  ),
                  AppQuantityStepperWidget(
                    value: state.draft.estimatedTotalBags,
                    min: 0,
                    max: 99,
                    onChanged: notifier.setEstimatedBags,
                  ),
                ],
              ),
              const Divider(height: AppSpacing.lg),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l10n.text('quickDrop.estimatedPiecesLabel'),
                            style: theme.textTheme.titleSmall),
                        Text(
                          l10n.text('quickDrop.estimatedPiecesHint'),
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: ext.textMuted),
                        ),
                      ],
                    ),
                  ),
                  AppQuantityStepperWidget(
                    value: state.draft.estimatedTotalPieces,
                    min: 0,
                    max: 200,
                    onChanged: notifier.setEstimatedPieces,
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),

        // Optional real catalog item + service category helper OR free-text
        AppCardWidget(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      l10n.text('quickDrop.optionalItemsTitle'),
                      style: theme.textTheme.titleMedium,
                    ),
                  ),
                  AppStatusBadgeWidget(
                    label: l10n.text('quickDrop.optionalBadge'),
                    tone: CmxSemanticTone.neutral,
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                l10n.text('quickDrop.optionalItemsHint'),
                style:
                    theme.textTheme.bodySmall?.copyWith(color: ext.textMuted),
              ),
              const SizedBox(height: AppSpacing.md),

              // Declared lines so far
              if (state.draft.declaredLines.isNotEmpty) ...[
                for (var i = 0; i < state.draft.declaredLines.length; i++) ...[
                  _DeclaredLineTile(
                    line: state.draft.declaredLines[i],
                    onQuantityChanged: (q) => notifier.updateLineQuantity(i, q),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                ],
                const SizedBox(height: AppSpacing.md),
              ],

              // Search & pick from real tenant catalog + service category
              if (state.isLoadingCatalog)
                const AppSkeletonWidget(height: 56)
              else if (state.categories.isNotEmpty) ...[
                TextField(
                  controller: _catalogSearchController,
                  onChanged: notifier.setCatalogSearchQuery,
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.search_rounded),
                    hintText: l10n.text('quickDrop.searchCatalogHint'),
                    suffixIcon: state.catalogSearchQuery.isNotEmpty
                        ? IconButton(
                            onPressed: () {
                              _catalogSearchController.clear();
                              notifier.setCatalogSearchQuery('');
                            },
                            icon: const Icon(Icons.clear_rounded),
                          )
                        : null,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      Padding(
                        padding:
                            const EdgeInsetsDirectional.only(end: AppSpacing.xs),
                        child: ChoiceChip(
                          label: Text(l10n.text('quickDrop.allCategories')),
                          selected: state.selectedCategoryId == null,
                          onSelected: (_) =>
                              notifier.setSelectedCategoryId(null),
                        ),
                      ),
                      for (final cat in state.categories)
                        Padding(
                          padding: const EdgeInsetsDirectional.only(
                            end: AppSpacing.xs,
                          ),
                          child: ChoiceChip(
                            label: Text(
                              isAr && (cat.name2?.isNotEmpty ?? false)
                                  ? cat.name2!
                                  : cat.name,
                            ),
                            selected: state.selectedCategoryId == cat.id,
                            onSelected: (_) =>
                                notifier.setSelectedCategoryId(cat.id),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    for (final pair
                        in state.filteredCatalogItems.take(12))
                      ActionChip(
                        avatar: const Icon(Icons.add_rounded, size: 16),
                        label: Text(
                          isAr && (pair.item.name2?.isNotEmpty ?? false)
                              ? pair.item.name2!
                              : pair.item.name,
                        ),
                        onPressed: () {
                          HapticFeedback.lightImpact();
                          notifier.addCatalogItemLine(
                            category: pair.category,
                            item: pair.item,
                          );
                        },
                      ),
                  ],
                ),
                const Divider(height: AppSpacing.lg),
              ],

              // Free-text fallback entry
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _freeItemController,
                      decoration: InputDecoration(
                        hintText: l10n.text('quickDrop.freeTextItemHint'),
                      ),
                      onSubmitted: (val) {
                        notifier.addFreeTextLine(itemName: val);
                        _freeItemController.clear();
                      },
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  FilledButton.tonal(
                    onPressed: () {
                      notifier.addFreeTextLine(
                        itemName: _freeItemController.text,
                      );
                      _freeItemController.clear();
                    },
                    child: Text(l10n.text('quickDrop.addLineAction')),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),

        // Customer notes
        AppCardWidget(
          child: TextField(
            controller: _notesController,
            onChanged: notifier.setNotes,
            maxLines: 3,
            maxLength: 500,
            decoration: InputDecoration(
              labelText: l10n.text('quickDrop.notesLabel'),
              hintText: l10n.text('quickDrop.notesHint'),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStep3UnpricedReview(
    BuildContext context,
    AppLocalizations l10n,
    QuickDropFlowState state,
    TenantModel? tenant,
    ThemeData theme,
    CmxStatusThemeExtension ext,
  ) {
    final isAr = l10n.locale.languageCode == 'ar';
    final selectedBranch = (tenant?.branches ?? const [])
        .where((b) => b.id == state.draft.requestedBranchId)
        .firstOrNull;
    final branchLabel = selectedBranch == null
        ? l10n.text('fulfillment.branchAnyOption')
        : (isAr && (selectedBranch.name2?.isNotEmpty ?? false)
            ? selectedBranch.name2!
            : selectedBranch.name);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Unpriced Disclaimer Banner
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: ext.info.background,
            borderRadius: BorderRadius.circular(AppRadii.lg),
            border: Border.all(color: ext.info.border),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.info_outline_rounded, color: ext.info.foreground),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.text('quickDrop.unpricedDisclaimerTitle'),
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: ext.info.foreground,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      l10n.text('quickDrop.unpricedDisclaimerBody'),
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),

        AppCardWidget(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l10n.text('quickDrop.reviewSummaryTitle'),
                  style: theme.textTheme.titleMedium),
              const SizedBox(height: AppSpacing.md),
              _SummaryPair(
                label: l10n.text('fulfillment.branchOptionalTitle'),
                value: branchLabel,
              ),
              _SummaryPair(
                label: l10n.text('fulfillment.pickupSectionTitle'),
                value: state.draft.pickupMode ==
                        CustomerPickupMode.collectAddress
                    ? l10n.text('fulfillment.pickupCollectTitle')
                    : l10n.text('fulfillment.pickupDropoffTitle'),
              ),
              _SummaryPair(
                label: l10n.text('fulfillment.deliverySectionTitle'),
                value: state.draft.deliveryMode ==
                        CustomerDeliveryMode.deliverAddress
                    ? l10n.text('fulfillment.deliveryAddressTitle')
                    : l10n.text('fulfillment.deliveryStorePickupTitle'),
              ),
              _SummaryPair(
                label: l10n.text('quickDrop.estimatedBagsLabel'),
                value: '${state.draft.estimatedTotalBags}',
              ),
              _SummaryPair(
                label: l10n.text('quickDrop.estimatedPiecesLabel'),
                value: '${state.draft.estimatedTotalPieces}',
              ),
              if (state.draft.customerNotes.trim().isNotEmpty)
                _SummaryPair(
                  label: l10n.text('quickDrop.notesLabel'),
                  value: state.draft.customerNotes.trim(),
                ),
            ],
          ),
        ),

        if (state.draft.declaredLines.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          AppCardWidget(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.text('quickDrop.optionalItemsTitle'),
                    style: theme.textTheme.titleMedium),
                const SizedBox(height: AppSpacing.sm),
                for (final line in state.draft.declaredLines)
                  Padding(
                    padding:
                        const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(line.itemName,
                              style: theme.textTheme.bodyMedium),
                        ),
                        Text('×${line.quantity}',
                            style: theme.textTheme.labelLarge),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _QuickDropStepBar extends StatelessWidget {
  const _QuickDropStepBar({required this.stepIndex});

  final int stepIndex;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    final labels = [
      l10n.text('quickDrop.step1Short'),
      l10n.text('quickDrop.step2Short'),
      l10n.text('quickDrop.step3Short'),
    ];
    return Row(
      children: [
        for (var i = 0; i < labels.length; i++) ...[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: i <= stepIndex
                        ? theme.colorScheme.primary
                        : ext.border,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  labels[i],
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: i == stepIndex
                        ? theme.colorScheme.primary
                        : ext.textMuted,
                    fontWeight:
                        i == stepIndex ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          if (i < labels.length - 1) const SizedBox(width: AppSpacing.sm),
        ],
      ],
    );
  }
}

class _DeclaredLineTile extends StatelessWidget {
  const _DeclaredLineTile({
    required this.line,
    required this.onQuantityChanged,
  });

  final QuickDropDeclaredLineModel line;
  final ValueChanged<int> onQuantityChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(AppRadii.sm),
        border: Border.all(color: ext.border),
      ),
      child: Row(
        children: [
          Icon(
            line.productId != null
                ? Icons.checkroom_outlined
                : Icons.edit_note_outlined,
            size: 18,
            color: theme.colorScheme.primary,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(line.itemName, style: theme.textTheme.bodyMedium),
          ),
          AppQuantityStepperWidget(
            value: line.quantity,
            min: 0,
            max: 99,
            onChanged: onQuantityChanged,
          ),
        ],
      ),
    );
  }
}

class _SummaryPair extends StatelessWidget {
  const _SummaryPair({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: theme.textTheme.bodyMedium?.copyWith(color: ext.textMuted),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: theme.textTheme.bodyMedium
                  ?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickDropSuccessView extends StatelessWidget {
  const _QuickDropSuccessView({required this.request});

  final QuickDropRequestModel request;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        AppCardWidget(
          accentColor: ext.success.foreground,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.check_circle_rounded,
                  size: 44, color: ext.success.foreground),
              const SizedBox(height: AppSpacing.md),
              Text(
                l10n.text('quickDrop.successTitle'),
                style: theme.textTheme.headlineSmall,
              ),
              const SizedBox(height: AppSpacing.sm),
              AppCodeChipWidget(
                code: ltrCode(request.requestNo),
                copiedFeedbackMessage: l10n.text('common.copiedToClipboard'),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                l10n.text('quickDrop.successBody'),
                style:
                    theme.textTheme.bodyMedium?.copyWith(color: ext.textMuted),
              ),
              const SizedBox(height: AppSpacing.xl),
              SizedBox(
                width: double.infinity,
                child: AppCustomButtonWidget(
                  label: l10n.text('booking.viewOrdersAction'),
                  onPressed: () {
                    Navigator.of(context).pushNamedAndRemoveUntil(
                      AppRoute.home,
                      (route) => false,
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
