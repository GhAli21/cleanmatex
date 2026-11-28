import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_services/mobile_services.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../../../core/providers/customer_api_client_providers.dart';
import '../../providers/tenant_provider.dart';

final customerTenantsListProvider =
    FutureProvider.autoDispose<CustomerTenantsResult>((ref) async {
  final session = ref.watch(customerSessionFlowProvider).session;
  final token = session?.verificationToken ?? '';
  if (token.isEmpty) {
    final current = ref.watch(tenantProvider).valueOrNull;
    return CustomerTenantsResult(
      activeTenants: current != null ? [current] : const [],
      hiddenTenants: const [],
    );
  }
  return ref
      .read(customerProfileServiceProvider)
      .listAuthenticatedTenants(bearerToken: token);
});

/// Bottom sheet letting customers switch active Organization + last-order branch,
/// hide a laundry, unhide previously hidden laundries anytime, or link a new one.
class CustomerTenantSwitcherSheetWidget extends ConsumerStatefulWidget {
  const CustomerTenantSwitcherSheetWidget({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const CustomerTenantSwitcherSheetWidget(),
    );
  }

  @override
  ConsumerState<CustomerTenantSwitcherSheetWidget> createState() =>
      _CustomerTenantSwitcherSheetWidgetState();
}

class _CustomerTenantSwitcherSheetWidgetState
    extends ConsumerState<CustomerTenantSwitcherSheetWidget> {
  bool _showHidden = false;
  bool _isUpdating = false;

  Future<void> _selectOrgAndBranch(
    TenantModel tenant,
    BranchOptionModel? branch,
  ) async {
    if (_isUpdating) return;
    HapticFeedback.selectionClick();
    setState(() => _isUpdating = true);
    try {
      final updatedTenant = branch != null
          ? tenant.copyWith(
              lastBranchId: branch.id,
              lastBranchName: branch.name,
              lastBranchName2: branch.name2,
            )
          : tenant;
      await ref.read(tenantProvider.notifier).selectTenant(updatedTenant);

      final token =
          ref.read(customerSessionFlowProvider).session?.verificationToken ?? '';
      if (token.isNotEmpty && branch != null) {
        await ref.read(customerProfileServiceProvider).updateTenantPreference(
              tenantId: tenant.tenantOrgId,
              bearerToken: token,
              lastBranchId: branch.id,
            );
      }
      if (mounted) Navigator.of(context).pop();
    } finally {
      if (mounted) setState(() => _isUpdating = false);
    }
  }

  Future<void> _toggleHidden(TenantModel tenant, bool hide) async {
    if (_isUpdating) return;
    final token =
        ref.read(customerSessionFlowProvider).session?.verificationToken ?? '';
    if (token.isEmpty) return;
    HapticFeedback.selectionClick();
    setState(() => _isUpdating = true);
    try {
      await ref.read(customerProfileServiceProvider).updateTenantPreference(
            tenantId: tenant.tenantOrgId,
            bearerToken: token,
            isHiddenByCustomer: hide,
          );
      ref.invalidate(customerTenantsListProvider);
    } finally {
      if (mounted) setState(() => _isUpdating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isAr = l10n.locale.languageCode == 'ar';
    final currentTenant = ref.watch(tenantProvider).valueOrNull;
    final asyncTenants = ref.watch(customerTenantsListProvider);
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

    return AppBottomSheetShellWidget(
      title: l10n.text('laundries.title'),
      subtitle: l10n.text('laundries.subtitle'),
      closeTooltip: l10n.text('common.close'),
      child: asyncTenants.when(
        loading: () => const Column(
          children: [
            AppSkeletonCardWidget(lines: 2),
            SizedBox(height: AppSpacing.sm),
            AppSkeletonCardWidget(lines: 2),
          ],
        ),
        error: (_, __) => AppErrorWidget(
          title: l10n.text('laundries.title'),
          message: l10n.text('tenant.listError'),
          retryLabel: l10n.text('common.retry'),
          onRetry: () => ref.invalidate(customerTenantsListProvider),
        ),
        data: (result) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final tenant in result.activeTenants) ...[
                _TenantCard(
                  tenant: tenant,
                  isSelected: tenant.tenantOrgId == currentTenant?.tenantOrgId,
                  isArabic: isAr,
                  l10n: l10n,
                  onSelect: (branch) => _selectOrgAndBranch(tenant, branch),
                  onToggleHide: tenant.tenantOrgId == currentTenant?.tenantOrgId
                      ? null
                      : () => _toggleHidden(tenant, true),
                  isHidden: false,
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
              if (result.hiddenTenants.isNotEmpty) ...[
                InkWell(
                  onTap: () => setState(() => _showHidden = !_showHidden),
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                    child: Row(
                      children: [
                        Icon(
                          Icons.visibility_off_outlined,
                          size: 16,
                          color: theme.textTheme.bodySmall?.color,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Text(
                            '${l10n.text('laundries.hiddenSection')} (${result.hiddenTenants.length})',
                            style: theme.textTheme.labelLarge,
                          ),
                        ),
                        Icon(
                          _showHidden
                              ? Icons.keyboard_arrow_up_rounded
                              : Icons.keyboard_arrow_down_rounded,
                        ),
                      ],
                    ),
                  ),
                ),
                if (_showHidden)
                  for (final hidden in result.hiddenTenants) ...[
                    _TenantCard(
                      tenant: hidden,
                      isSelected: false,
                      isArabic: isAr,
                      l10n: l10n,
                      onSelect: (branch) => _selectOrgAndBranch(hidden, branch),
                      onToggleHide: () => _toggleHidden(hidden, false),
                      isHidden: true,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                  ],
              ],
              const SizedBox(height: AppSpacing.sm),
              OutlinedButton.icon(
                onPressed: () {
                  Navigator.of(context).pop();
                  Navigator.of(context).pushNamed(AppRoute.tenantDiscovery);
                },
                icon: const Icon(Icons.qr_code_scanner_rounded),
                label: Text(l10n.text('laundries.linkNewAction')),
                style: OutlinedButton.styleFrom(
                  foregroundColor: ext.brandText,
                  side: BorderSide(color: ext.brand.border),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _TenantCard extends StatelessWidget {
  const _TenantCard({
    required this.tenant,
    required this.isSelected,
    required this.isArabic,
    required this.l10n,
    required this.onSelect,
    required this.onToggleHide,
    required this.isHidden,
  });

  final TenantModel tenant;
  final bool isSelected;
  final bool isArabic;
  final AppLocalizations l10n;
  final ValueChanged<BranchOptionModel?> onSelect;
  final VoidCallback? onToggleHide;
  final bool isHidden;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    final orgName =
        isArabic && (tenant.name2?.isNotEmpty ?? false) ? tenant.name2! : tenant.name;
    final activeBranch = tenant.resolvedLastBranch;
    final branchLabel = activeBranch == null
        ? null
        : (isArabic && (activeBranch.name2?.isNotEmpty ?? false)
            ? activeBranch.name2!
            : activeBranch.name);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: isSelected ? ext.brand.background : theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(
          color: isSelected ? theme.colorScheme.primary : ext.border,
          width: isSelected ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: () => onSelect(activeBranch),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              orgName,
                              style: theme.textTheme.titleMedium,
                            ),
                          ),
                          if (isSelected) ...[
                            const SizedBox(width: 6),
                            Icon(
                              Icons.check_circle_rounded,
                              size: 16,
                              color: theme.colorScheme.primary,
                            ),
                          ],
                        ],
                      ),
                      if (branchLabel != null) ...[
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Icon(
                              Icons.location_on_outlined,
                              size: 14,
                              color: ext.brandText,
                            ),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                '$branchLabel · ${l10n.text('laundries.lastBranchBadge')}',
                                style: theme.textTheme.bodySmall,
                              ),
                            ),
                          ],
                        ),
                      ],
                      if (isHidden) ...[
                        const SizedBox(height: 4),
                        Text(
                          l10n.text('laundries.hiddenHint'),
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: ext.warning.foreground,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              if (onToggleHide != null)
                TextButton(
                  onPressed: onToggleHide,
                  child: Text(
                    isHidden
                        ? l10n.text('laundries.unhideAction')
                        : l10n.text('laundries.hideAction'),
                  ),
                ),
            ],
          ),
          if (isSelected && tenant.branches.length > 1) ...[
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final branch in tenant.branches)
                  ChoiceChip(
                    label: Text(
                      isArabic && (branch.name2?.isNotEmpty ?? false)
                          ? branch.name2!
                          : branch.name,
                    ),
                    selected: branch.id == activeBranch?.id,
                    onSelected: (_) => onSelect(branch),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
