import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_services/mobile_services.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../../auth/ui/widgets/customer_phone_text_field_widget.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';
import '../../providers/tenant_provider.dart';

class CustomerTenantDiscoveryScreen extends ConsumerStatefulWidget {
  const CustomerTenantDiscoveryScreen({super.key});

  @override
  ConsumerState<CustomerTenantDiscoveryScreen> createState() =>
      _CustomerTenantDiscoveryScreenState();
}

class _CustomerTenantDiscoveryScreenState
    extends ConsumerState<CustomerTenantDiscoveryScreen> {
  final _phoneController = TextEditingController();
  String? _submittedPhone;
  String? _errorMessageKey;
  String? _expandedTenantOrgId;
  bool _isSelectingTenant = false;

  @override
  void initState() {
    super.initState();
    AppLogger.info('CustomerTenantDiscoveryScreen opened');
  }

  @override
  void dispose() {
    AppLogger.info('CustomerTenantDiscoveryScreen disposed');
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final normalizedPhone = _submittedPhone;
    final tenantsAsync = normalizedPhone == null
        ? const AsyncValue<List<TenantModel>>.data(<TenantModel>[])
        : ref.watch(matchingTenantsProvider(normalizedPhone));

    return AppResponsiveScrollScaffold(
      appBar: AppBar(
        title: Text(l10n.text('tenant.discoveryTitle')),
        actions: const [
          CustomerLocaleSwitchWidget(),
        ],
      ),
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppHeaderWidget(
              title: l10n.text('tenant.listTitle'),
              subtitle: l10n.text('tenant.listBody'),
            ),
            const SizedBox(height: AppSpacing.lg),
            CustomerPhoneTextFieldWidget(
              controller: _phoneController,
              onChanged: (_) {
                if (_errorMessageKey != null || _submittedPhone != null) {
                  setState(() {
                    _errorMessageKey = null;
                    _submittedPhone = null;
                  });
                }
              },
              errorText: _errorMessageKey == null
                  ? null
                  : l10n.text(_errorMessageKey!),
            ),
            const SizedBox(height: AppSpacing.md),
            AppCustomButtonWidget(
              label: l10n.text('tenant.findAction'),
              onPressed: _isSelectingTenant ? null : _searchByPhone,
              isLoading: _isSelectingTenant,
            ),
            if (normalizedPhone != null) ...[
              const SizedBox(height: AppSpacing.xl),
              tenantsAsync.when(
                data: (tenants) => _buildTenantList(
                  context,
                  l10n,
                  tenants,
                  normalizedPhone,
                ),
                error: (error, _) => _buildTenantLookupError(
                    context, l10n, error, normalizedPhone),
                loading: () => const AppLoadingIndicator(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _searchByPhone() async {
    final normalized = _phoneController.text.replaceAll(RegExp(r'\s+'), '');
    AppLogger.info('Tenant discovery submit pressed for phone=$normalized');
    if (!RegExp(r'^\+?[0-9]{4,15}$').hasMatch(normalized)) {
      AppLogger.warning('Tenant discovery rejected invalid phone=$normalized');
      setState(() => _errorMessageKey = 'loginEntry.phoneValidationError');
      return;
    }

    setState(() {
      _submittedPhone = normalized;
      _errorMessageKey = null;
    });
  }

  Widget _buildTenantList(
    BuildContext context,
    AppLocalizations l10n,
    List<TenantModel> tenants,
    String phoneNumber,
  ) {
    if (tenants.isEmpty) {
      AppLogger.warning(
          'Tenant discovery found no tenants for phone=$phoneNumber');
      return _buildListCard(
        context,
        l10n.textWithArg('tenant.phoneNoMatches', phoneNumber),
      );
    }

    AppLogger.info(
      'Tenant discovery rendered ${tenants.length} tenants for phone=$phoneNumber',
    );

    return Column(
      children: tenants
          .map(
            (tenant) => Padding(
              padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.md),
              child: _buildTenantCard(context, l10n, tenant, phoneNumber),
            ),
          )
          .toList(growable: false),
    );
  }

  Widget _buildTenantCard(
    BuildContext context,
    AppLocalizations l10n,
    TenantModel tenant,
    String phoneNumber,
  ) {
    final theme = Theme.of(context);
    final branches = tenant.branches;
    final hasOneBranch = branches.length == 1;
    final hasManyBranches = branches.length > 1;
    final isExpanded = _expandedTenantOrgId == tenant.tenantOrgId;

    return AppCardWidget(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ListTile(
            contentPadding: EdgeInsetsDirectional.zero,
            leading: tenant.logoUrl == null
                ? null
                : Image.network(
                    tenant.logoUrl!,
                    width: 48,
                    height: 48,
                    errorBuilder: (_, __, ___) =>
                        const SizedBox(width: 48, height: 48),
                  ),
            title: Text(
              _localizedTenantName(l10n, tenant),
              style: theme.textTheme.titleMedium,
            ),
            subtitle: Padding(
              padding: const EdgeInsetsDirectional.only(top: AppSpacing.xs),
              child: Text(
                _branchSummaryText(l10n, branches),
                style: theme.textTheme.bodyMedium?.copyWith(
                  color:
                      branches.isEmpty ? AppColors.error : AppColors.textMuted,
                ),
              ),
            ),
            trailing: TextButton(
              onPressed: _isSelectingTenant || branches.isEmpty
                  ? null
                  : () {
                      if (hasOneBranch) {
                        _selectTenant(
                          context,
                          l10n,
                          tenant,
                          phoneNumber,
                          branches.first,
                        );
                        return;
                      }
                      setState(() {
                        _expandedTenantOrgId =
                            isExpanded ? null : tenant.tenantOrgId;
                      });
                    },
              child: Text(
                hasManyBranches
                    ? l10n.text('tenant.chooseBranchAction')
                    : l10n.text('tenant.selectAction'),
              ),
            ),
          ),
          if (branches.isEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              l10n.text('tenant.noActiveBranches'),
              style:
                  theme.textTheme.bodyMedium?.copyWith(color: AppColors.error),
            ),
          ],
          if (hasOneBranch) ...[
            const SizedBox(height: AppSpacing.sm),
            _BranchSummaryCard(
              branch: branches.first,
              localizations: l10n,
              isSelected: true,
              onTap: _isSelectingTenant
                  ? null
                  : () => _selectTenant(
                        context,
                        l10n,
                        tenant,
                        phoneNumber,
                        branches.first,
                      ),
            ),
          ],
          if (hasManyBranches && isExpanded) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              l10n.text('tenant.chooseBranchBody'),
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: AppSpacing.sm),
            ...branches.map(
              (branch) => Padding(
                padding:
                    const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
                child: _BranchSummaryCard(
                  branch: branch,
                  localizations: l10n,
                  onTap: _isSelectingTenant
                      ? null
                      : () => _selectTenant(
                            context,
                            l10n,
                            tenant,
                            phoneNumber,
                            branch,
                          ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _localizedTenantName(AppLocalizations l10n, TenantModel tenant) {
    return (l10n.locale.languageCode == 'ar' &&
                (tenant.name2 ?? '').trim().isNotEmpty
            ? tenant.name2
            : null) ??
        tenant.name;
  }

  String _branchSummaryText(
    AppLocalizations l10n,
    List<BranchOptionModel> branches,
  ) {
    if (branches.isEmpty) return l10n.text('tenant.noActiveBranchesShort');
    if (branches.length == 1) {
      return l10n.textWithArg('tenant.oneBranchAvailable', branches.first.name);
    }
    return l10n.textWithArg(
      'tenant.multipleBranchesAvailable',
      branches.length.toString(),
    );
  }

  Widget _buildListCard(BuildContext context, String message) {
    return AppCardWidget(
      child: Text(
        message,
        style: Theme.of(context).textTheme.bodyLarge,
      ),
    );
  }

  Widget _buildTenantLookupError(
    BuildContext context,
    AppLocalizations l10n,
    Object error,
    String fallbackPhoneNumber,
  ) {
    if (error is TenantServiceException &&
        error.phoneNumber != null &&
        error.phoneNumber!.isNotEmpty) {
      AppLogger.error(
        'Tenant discovery lookup error for phone=${error.phoneNumber} traceId=${error.traceId ?? 'none'}',
        error: error,
      );
      return _buildListCard(
        context,
        l10n.textWithArg(error.messageKey, error.phoneNumber!),
      );
    }

    AppLogger.error(
      'Tenant discovery lookup error for phone=$fallbackPhoneNumber',
      error: error,
    );
    return _buildListCard(
      context,
      l10n.textWithArg('tenant.listErrorWithPhone', fallbackPhoneNumber),
    );
  }

  Future<void> _selectTenant(
    BuildContext context,
    AppLocalizations l10n,
    TenantModel tenant,
    String phoneNumber,
    BranchOptionModel branch,
  ) async {
    AppLogger.info(
      'Tenant discovery selecting tenant=${tenant.tenantOrgId} branch=${branch.id} for phone=$phoneNumber',
    );
    setState(() => _isSelectingTenant = true);
    try {
      await ref.read(tenantProvider.notifier).selectTenant(
            tenant.copyWith(branches: [branch]),
          );
      await ref
          .read(customerSessionFlowProvider.notifier)
          .signInDirectWithFixedOtp(phoneNumber: phoneNumber);
      if (!mounted || !context.mounted) {
        return;
      }
      Navigator.of(context).pushReplacementNamed(AppRoute.home);
    } catch (error, stackTrace) {
      AppLogger.error(
        'Direct tenant selection login failed for tenant=${tenant.tenantOrgId} phone=$phoneNumber',
        error: error,
        stackTrace: stackTrace,
      );
      if (!mounted || !context.mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(l10n.text('loginEntry.genericError')),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSelectingTenant = false);
      }
    }
  }
}

class _BranchSummaryCard extends StatelessWidget {
  const _BranchSummaryCard({
    required this.branch,
    required this.localizations,
    required this.onTap,
    this.isSelected = false,
  });

  final BranchOptionModel branch;
  final AppLocalizations localizations;
  final VoidCallback? onTap;
  final bool isSelected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final branchName = (localizations.locale.languageCode == 'ar' &&
                (branch.name2 ?? '').trim().isNotEmpty
            ? branch.name2
            : null) ??
        branch.name;
    final addressParts = [
      branch.area,
      branch.city,
    ].where((value) => (value ?? '').trim().isNotEmpty).join(', ');

    return Semantics(
      button: true,
      selected: isSelected,
      label: branchName,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            border: Border.all(
              color: isSelected ? AppColors.primary : AppColors.border,
            ),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Icon(
                isSelected ? Icons.check_circle : Icons.storefront_outlined,
                color: isSelected ? AppColors.primary : AppColors.textMuted,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            branchName,
                            style: theme.textTheme.titleMedium,
                          ),
                        ),
                        if (branch.isMain)
                          Text(
                            localizations.text('tenant.mainBranchLabel'),
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                      ],
                    ),
                    if (addressParts.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        addressParts,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
