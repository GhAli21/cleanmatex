import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';

class CustomerOfflineScreen extends StatelessWidget {
  const CustomerOfflineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = CustomerAppScope.of(context);
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
                          await controller.refreshConnectivityStatus();
                          if (!context.mounted ||
                              controller.hasConnectivityIssue) {
                            return;
                          }

                          Navigator.of(context).pushNamedAndRemoveUntil(
                            controller.resolveInitialRoute(),
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
                            AppRoute.entry,
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
