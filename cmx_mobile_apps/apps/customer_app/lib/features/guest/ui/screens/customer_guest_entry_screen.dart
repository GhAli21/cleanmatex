import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';

class CustomerGuestEntryScreen extends ConsumerWidget {
  const CustomerGuestEntryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final localizations = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.text('guestEntry.title')),
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
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      localizations.text('guestEntry.title'),
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      localizations.text('guestEntry.body'),
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    SizedBox(
                      width: double.infinity,
                      child: AppCustomButtonWidget(
                        label: localizations.text('guestEntry.primaryAction'),
                        onPressed: () async {
                          await ref
                              .read(customerSessionFlowProvider.notifier)
                              .enterGuestMode();
                          if (!context.mounted) {
                            return;
                          }

                          Navigator.of(context).pushNamedAndRemoveUntil(
                            AppRoute.home,
                            (route) => false,
                          );
                        },
                        icon: Icons.explore_outlined,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    SizedBox(
                      width: double.infinity,
                      child: AppCustomButtonWidget(
                        label: localizations.text('common.back'),
                        onPressed: () {
                          Navigator.of(context).pop();
                        },
                        isPrimary: false,
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
