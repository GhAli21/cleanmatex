import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

class CustomerHomeServiceStatusCard extends StatelessWidget {
  const CustomerHomeServiceStatusCard({
    super.key,
    required this.onOpenServices,
  });

  final VoidCallback onOpenServices;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Card(
      child: InkWell(
        onTap: onOpenServices,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.md,
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: const Icon(
                  Icons.local_laundry_service_outlined,
                  color: AppColors.success,
                  size: 20,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      localizations.text('home.statusTitle'),
                      style: textTheme.titleMedium,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      localizations.text('home.statusBody'),
                      style: textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.textMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
