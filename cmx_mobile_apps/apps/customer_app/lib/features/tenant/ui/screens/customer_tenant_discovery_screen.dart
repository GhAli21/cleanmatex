import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

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
  bool _isSelectingTenant = false;

  @override
  void dispose() {
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

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: Text(
          l10n.text('tenant.discoveryTitle'),
          style: Theme.of(context).textTheme.titleMedium,
        ),
        actions: const [
          CustomerLocaleSwitchWidget(),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.text('tenant.listTitle'),
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              l10n.text('tenant.listBody'),
              style: Theme.of(context).textTheme.bodyMedium,
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
              errorText:
                  _errorMessageKey == null ? null : l10n.text(_errorMessageKey!),
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
                error: (_, __) => _buildListCard(
                  context,
                  l10n.text('tenant.listError'),
                ),
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
    if (!RegExp(r'^\+?[0-9]{4,15}$').hasMatch(normalized)) {
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
      return _buildListCard(
        context,
        l10n.text('tenant.phoneNoMatches'),
      );
    }

    return Column(
      children: tenants
          .map(
            (tenant) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: AppCardWidget(
                child: Row(
                  children: [
                    if (tenant.logoUrl != null) ...[
                      Image.network(
                        tenant.logoUrl!,
                        width: 48,
                        height: 48,
                        errorBuilder: (_, __, ___) =>
                            const SizedBox(width: 48, height: 48),
                      ),
                      const SizedBox(width: AppSpacing.md),
                    ],
                    Expanded(
                      child: Text(
                        (l10n.locale.languageCode == 'ar'
                                ? tenant.name2
                                : null) ??
                            tenant.name,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    AppCustomButtonWidget(
                      label: l10n.text('tenant.selectAction'),
                      onPressed: _isSelectingTenant
                          ? null
                          : () => _selectTenant(context, tenant, phoneNumber),
                    ),
                  ],
                ),
              ),
            ),
          )
          .toList(growable: false),
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

  Future<void> _selectTenant(
    BuildContext context,
    TenantModel tenant,
    String phoneNumber,
  ) async {
    setState(() => _isSelectingTenant = true);
    await ref.read(tenantProvider.notifier).selectTenant(tenant);
    if (!mounted || !context.mounted) {
      return;
    }
    Navigator.of(context).pushReplacementNamed(
      AppRoute.loginEntry,
      arguments: phoneNumber,
    );
  }
}
