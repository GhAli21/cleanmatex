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
                error: (error, _) =>
                    _buildTenantLookupError(context, l10n, error, normalizedPhone),
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
      AppLogger.warning('Tenant discovery found no tenants for phone=$phoneNumber');
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
              child: AppCardWidget(
                child: ListTile(
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
                    (l10n.locale.languageCode == 'ar' ? tenant.name2 : null) ??
                        tenant.name,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  trailing: TextButton(
                    onPressed: _isSelectingTenant
                        ? null
                        : () => _selectTenant(context, l10n, tenant, phoneNumber),
                    child: Text(l10n.text('tenant.selectAction')),
                  ),
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
  ) async {
    AppLogger.info(
      'Tenant discovery selecting tenant=${tenant.tenantOrgId} for phone=$phoneNumber',
    );
    setState(() => _isSelectingTenant = true);
    try {
      await ref.read(tenantProvider.notifier).selectTenant(tenant);
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
