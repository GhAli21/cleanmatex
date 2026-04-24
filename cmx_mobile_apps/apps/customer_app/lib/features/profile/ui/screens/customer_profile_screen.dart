import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../../tenant/providers/tenant_provider.dart';

class CustomerProfileScreen extends ConsumerWidget {
  const CustomerProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final localizations = AppLocalizations.of(context);
    final session =
        ref.watch(customerSessionFlowProvider.select((f) => f.session));
    final tenant = ref.watch(tenantProvider).value;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.text('profile.title')),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            if (session?.displayName != null) ...[
              AppCardWidget(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      localizations.text('profile.nameLabel'),
                      style: textTheme.labelMedium,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      session!.displayName!,
                      style: textTheme.bodyLarge,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            AppCardWidget(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    localizations.text('profile.phoneLabel'),
                    style: textTheme.labelMedium,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    session?.phoneNumber ?? '',
                    style: textTheme.bodyLarge,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            AppCardWidget(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    localizations.text('profile.laundryLabel'),
                    style: textTheme.labelMedium,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    tenant == null
                        ? localizations.text('profile.noLaundrySelected')
                        : ((localizations.locale.languageCode == 'ar'
                                    ? tenant.name2
                                    : null) ??
                                tenant.name),
                    style: textTheme.bodyLarge,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            AppCardWidget(
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      session?.hasPassword == true
                          ? localizations.text('profile.passwordStatusEnabled')
                          : localizations.text('profile.passwordStatusNotSet'),
                      style: textTheme.bodyLarge,
                    ),
                  ),
                  if (session?.verificationToken?.isNotEmpty == true)
                    TextButton(
                      onPressed: () => Navigator.of(context).pushNamed(
                        AppRoute.setPassword,
                        arguments: session!.verificationToken,
                      ),
                      child: Text(
                        localizations.text('profile.changePasswordAction'),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            SizedBox(
              width: double.infinity,
              child: AppCustomButtonWidget(
                label: localizations.text('profile.changeLaundryAction'),
                onPressed: () => _changeLaundry(context, ref),
                isPrimary: false,
                icon: Icons.storefront_outlined,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              width: double.infinity,
              child: AppCustomButtonWidget(
                label: localizations.text('profile.signOutAction'),
                onPressed: () => _confirmSignOut(context, ref, localizations),
                isPrimary: false,
                icon: Icons.logout,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _changeLaundry(BuildContext context, WidgetRef ref) async {
    await ref.read(tenantProvider.notifier).clearTenant();
    await ref.read(customerSessionFlowProvider.notifier).clearSession();

    if (!context.mounted) {
      return;
    }

    Navigator.of(context).pushNamedAndRemoveUntil(
      AppRoute.tenantDiscovery,
      (route) => false,
    );
  }

  Future<void> _confirmSignOut(
    BuildContext context,
    WidgetRef ref,
    AppLocalizations localizations,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(localizations.text('home.signOutConfirmTitle')),
        content: Text(localizations.text('home.signOutConfirmBody')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(localizations.text('home.signOutCancelAction')),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(localizations.text('home.signOutConfirmAction')),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) {
      return;
    }

    await ref.read(customerSessionFlowProvider.notifier).clearSession();

    if (!context.mounted) {
      return;
    }

    Navigator.of(context).pushNamedAndRemoveUntil(
      AppRoute.entry,
      (route) => false,
    );
  }
}
