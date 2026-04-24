import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../providers/tenant_provider.dart';

class CustomerTenantConfirmScreen extends ConsumerStatefulWidget {
  const CustomerTenantConfirmScreen({super.key});

  @override
  ConsumerState<CustomerTenantConfirmScreen> createState() =>
      _CustomerTenantConfirmScreenState();
}

class _CustomerTenantConfirmScreenState
    extends ConsumerState<CustomerTenantConfirmScreen> {
  @override
  void initState() {
    super.initState();
    AppLogger.info('tenant_confirm_screen.opened');
  }

  @override
  void dispose() {
    AppLogger.info('tenant_confirm_screen.disposed');
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    final tenant = ref.watch(tenantProvider).value;
    final isAr = l10n.locale.languageCode == 'ar';
    final tenantName = (isAr ? tenant?.name2 : null) ?? tenant?.name ?? '';

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (tenant?.logoUrl != null) ...[
                Center(
                  child: Image.network(
                    tenant!.logoUrl!,
                    height: 80,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
              ],
              Text(
                l10n.textWithArg('tenant.confirmTitle', tenantName),
                style: textTheme.headlineMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xl),
              AppCustomButtonWidget(
                label: l10n.text('tenant.confirmAction'),
                onPressed: () {
                  final flow = ref.read(customerSessionFlowProvider);
                  final next = resolveRouteAfterTenantConfirmation(flow);
                  AppLogger.info(
                    'tenant_confirm_screen.confirm_tapped nextRoute=$next',
                  );
                  Navigator.of(context).pushReplacementNamed(next);
                },
              ),
              const SizedBox(height: AppSpacing.md),
              AppCustomButtonWidget(
                label: l10n.text('tenant.chooseDifferentAction'),
                isPrimary: false,
                onPressed: () async {
                  AppLogger.info('tenant_confirm_screen.choose_different_tapped');
                  try {
                    await ref.read(tenantProvider.notifier).clearTenant();
                    await ref
                        .read(customerSessionFlowProvider.notifier)
                        .clearSession();
                  } catch (error, stackTrace) {
                    AppLogger.error(
                      'tenant_confirm_screen.choose_different_failed',
                      error: error,
                      stackTrace: stackTrace,
                    );
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(l10n.text('common.remoteRequestError')),
                        ),
                      );
                    }
                    return;
                  }
                  if (!context.mounted) {
                    return;
                  }
                  AppLogger.info('tenant_confirm_screen.choose_different_succeeded');
                  Navigator.of(context)
                      .pushReplacementNamed(AppRoute.tenantDiscovery);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
