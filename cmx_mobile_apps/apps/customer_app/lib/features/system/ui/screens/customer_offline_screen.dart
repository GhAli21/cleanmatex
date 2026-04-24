import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../tenant/providers/tenant_provider.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';

class CustomerOfflineScreen extends ConsumerWidget {
  const CustomerOfflineScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final localizations = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.text('system.offlineTitle')),
        actions: const [
          CustomerLocaleSwitchWidget(),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: AppCardWidget(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.wifi_off_outlined, size: 48),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      localizations.text('system.offlineTitle'),
                      style: Theme.of(context).textTheme.headlineMedium,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      localizations.text('system.offlineBody'),
                      style: Theme.of(context).textTheme.bodyLarge,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    SizedBox(
                      width: double.infinity,
                      child: AppCustomButtonWidget(
                        label: localizations.text('common.retry'),
                        onPressed: () async {
                          await ref
                              .read(
                                customerSessionFlowProvider.notifier,
                              )
                              .refreshConnectivityStatus();
                          if (!context.mounted) {
                            return;
                          }
                          final hasIssue = ref
                              .read(customerSessionFlowProvider)
                              .hasConnectivityIssue;
                          if (hasIssue) {
                            return;
                          }

                          Navigator.of(context).pushNamedAndRemoveUntil(
                            resolveGatedDefaultRoute(
                              flow: ref.read(customerSessionFlowProvider),
                              tenantState: ref.read(tenantProvider),
                            ),
                            (route) => false,
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    SizedBox(
                      width: double.infinity,
                      child: AppCustomButtonWidget(
                        label: localizations.text('system.returnAction'),
                        isPrimary: false,
                        onPressed: () {
                          Navigator.of(context).pushNamedAndRemoveUntil(
                            resolveGatedDefaultRoute(
                              flow: ref.read(customerSessionFlowProvider),
                              tenantState: ref.read(tenantProvider),
                            ),
                            (route) => false,
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
