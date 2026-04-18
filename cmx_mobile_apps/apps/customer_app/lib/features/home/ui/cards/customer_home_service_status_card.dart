import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

class CustomerHomeServiceStatusCard extends StatelessWidget {
  const CustomerHomeServiceStatusCard({super.key});

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;

    return AppCardWidget(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            localizations.text('home.statusTitle'),
            style: textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            localizations.text('home.statusBody'),
            style: textTheme.bodyLarge,
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: double.infinity,
            child: AppCustomButtonWidget(
              label: localizations.text('home.secondaryAction'),
              onPressed: () {},
              isPrimary: false,
            ),
          ),
        ],
      ),
    );
  }
}
