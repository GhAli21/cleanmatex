import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';

import '../../../../core/app_shell_controller.dart';

class CustomerLocaleSwitchWidget extends StatelessWidget {
  const CustomerLocaleSwitchWidget({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = CustomerAppScope.of(context);
    final localizations = AppLocalizations.of(context);

    return IconButton(
      constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
      onPressed: controller.toggleLocale,
      icon: const Icon(Icons.language),
      tooltip: localizations.text('common.switchLanguage'),
    );
  }
}
