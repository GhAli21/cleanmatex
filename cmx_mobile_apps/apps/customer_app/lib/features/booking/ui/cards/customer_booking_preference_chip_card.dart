import 'package:flutter/material.dart';
import 'package:mobile_ui/mobile_ui.dart';

class CustomerBookingPreferenceChipCard extends StatelessWidget {
  const CustomerBookingPreferenceChipCard({
    super.key,
    required this.label,
    required this.priceLabel,
    required this.isSelected,
    required this.onTap,
    this.description,
    this.metadataLabels = const [],
    this.semanticLabel,
  });

  final String label;
  final String? description;
  final String priceLabel;
  final List<String> metadataLabels;
  final bool isSelected;
  final VoidCallback onTap;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final borderColor = isSelected ? colorScheme.primary : AppColors.border;
    final backgroundColor = isSelected
        ? colorScheme.primary.withValues(alpha: 0.08)
        : colorScheme.surface;

    return Semantics(
      button: true,
      selected: isSelected,
      label: semanticLabel ?? label,
      child: Material(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            constraints: const BoxConstraints(minHeight: 132),
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              border:
                  Border.all(color: borderColor, width: isSelected ? 1.6 : 1),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        label,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.titleMedium,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Icon(
                      isSelected
                          ? Icons.check_circle
                          : Icons.radio_button_unchecked,
                      color: isSelected
                          ? colorScheme.primary
                          : AppColors.textMuted,
                      size: 22,
                    ),
                  ],
                ),
                if ((description ?? '').trim().isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
                const Spacer(),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    _PreferenceBadge(
                      label: priceLabel,
                      isPrimary: true,
                    ),
                    ...metadataLabels.map(
                      (metadata) => _PreferenceBadge(label: metadata),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PreferenceBadge extends StatelessWidget {
  const _PreferenceBadge({
    required this.label,
    this.isPrimary = false,
  });

  final String label;
  final bool isPrimary;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: isPrimary
            ? colorScheme.primary.withValues(alpha: 0.10)
            : AppColors.background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: theme.textTheme.bodySmall?.copyWith(
          color: isPrimary ? colorScheme.primary : AppColors.textMuted,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
