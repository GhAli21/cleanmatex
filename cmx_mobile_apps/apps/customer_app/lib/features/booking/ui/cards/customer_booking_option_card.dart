import 'package:flutter/material.dart';
import 'package:mobile_ui/mobile_ui.dart';

class CustomerBookingOptionCard extends StatelessWidget {
  const CustomerBookingOptionCard({
    super.key,
    required this.title,
    required this.description,
    required this.trailingLabel,
    required this.isSelected,
    required this.onTap,
    this.semanticLabel,
  });

  final String title;
  final String description;
  final String trailingLabel;
  final bool isSelected;
  final VoidCallback onTap;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Semantics(
      button: true,
      selected: isSelected,
      label: semanticLabel ?? '$title. $description. $trailingLabel',
      child: AppCardWidget(
        child: InkWell(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(title, style: textTheme.titleLarge),
                  ),
                  if (isSelected)
                    const Icon(Icons.check_circle, color: AppColors.success),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(description, style: textTheme.bodyLarge),
              const SizedBox(height: AppSpacing.md),
              Text(trailingLabel, style: textTheme.bodyMedium),
            ],
          ),
        ),
      ),
    );
  }
}
