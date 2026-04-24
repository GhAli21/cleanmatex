import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';

class CustomerGuestEntryScreen extends ConsumerStatefulWidget {
  const CustomerGuestEntryScreen({super.key});

  @override
  ConsumerState<CustomerGuestEntryScreen> createState() =>
      _CustomerGuestEntryScreenState();
}

class _CustomerGuestEntryScreenState
    extends ConsumerState<CustomerGuestEntryScreen> {
  @override
  void initState() {
    super.initState();
    AppLogger.info('guest_entry_screen.opened');
  }

  @override
  void dispose() {
    AppLogger.info('guest_entry_screen.disposed');
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);

    return AppResponsiveScrollScaffold(
      appBar: AppBar(
        title: Text(localizations.text('guestEntry.title')),
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
        constraints: const BoxConstraints(maxWidth: 560),
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
                    AppLogger.info('guest_entry_screen.continue_as_guest_tapped');
                    try {
                      await ref
                          .read(customerSessionFlowProvider.notifier)
                          .enterGuestMode();
                    } catch (error, stackTrace) {
                      AppLogger.error(
                        'guest_entry_screen.enter_guest_mode_failed',
                        error: error,
                        stackTrace: stackTrace,
                      );
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              localizations.text('common.remoteRequestError'),
                            ),
                          ),
                        );
                      }
                      return;
                    }
                    if (!context.mounted) {
                      return;
                    }

                    AppLogger.info('guest_entry_screen.enter_guest_mode_succeeded');
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
                    AppLogger.info('guest_entry_screen.back_tapped');
                    Navigator.of(context).pop();
                  },
                  isPrimary: false,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
