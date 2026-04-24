import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';

class CustomerLocaleSwitchWidget extends ConsumerWidget {
  const CustomerLocaleSwitchWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final localizations = AppLocalizations.of(context);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          onPressed: () {
            Navigator.of(context).pushNamed(AppRoute.logs);
          },
          icon: const Icon(Icons.bug_report_outlined),
          tooltip: localizations.text('system.logsOpenAction'),
        ),
        IconButton(
          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          onPressed: () =>
              ref.read(customerLocaleProvider.notifier).toggleLocale(),
          icon: const Icon(Icons.language),
          tooltip: localizations.text('common.switchLanguage'),
        ),
      ],
    );
  }
}
