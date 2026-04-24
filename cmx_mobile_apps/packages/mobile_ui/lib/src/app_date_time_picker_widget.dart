import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_spacing.dart';

class AppDateTimePickerWidget extends StatelessWidget {
  const AppDateTimePickerWidget({
    super.key,
    this.initialValue,
    this.minDate,
    required this.onChanged,
    required this.label,
    required this.placeholder,
  });

  final DateTime? initialValue;
  final DateTime? minDate;
  final ValueChanged<DateTime> onChanged;
  final String label;
  final String placeholder;

  Future<void> _pick(BuildContext context) async {
    final now = DateTime.now();
    final firstDate = minDate ?? now;
    final initialDate = initialValue != null &&
            !initialValue!.isBefore(firstDate)
        ? initialValue!
        : firstDate;

    final pickedDate = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: firstDate,
      lastDate: firstDate.add(const Duration(days: 90)),
    );

    if (pickedDate == null || !context.mounted) return;

    final pickedTime = await showTimePicker(
      context: context,
      initialTime: initialValue != null
          ? TimeOfDay.fromDateTime(initialValue!)
          : const TimeOfDay(hour: 9, minute: 0),
    );

    if (pickedTime == null) return;

    onChanged(
      DateTime(
        pickedDate.year,
        pickedDate.month,
        pickedDate.day,
        pickedTime.hour,
        pickedTime.minute,
      ),
    );
  }

  String _formatDateTime(BuildContext context, DateTime dt) {
    final date =
        '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
    final hour = dt.hour.toString().padLeft(2, '0');
    final minute = dt.minute.toString().padLeft(2, '0');
    return '$date  $hour:$minute';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasValue = initialValue != null;

    return Semantics(
      button: true,
      label: '$label: ${hasValue ? _formatDateTime(context, initialValue!) : placeholder}',
      child: InkWell(
        onTap: () => _pick(context),
        borderRadius: BorderRadius.circular(14),
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.md,
          ),
          child: Row(
            children: [
              const Icon(Icons.calendar_today_outlined, size: 20),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: AppColors.textMuted,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      hasValue
                          ? _formatDateTime(context, initialValue!)
                          : placeholder,
                      style: theme.textTheme.bodyLarge?.copyWith(
                        color: hasValue ? null : AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right,
                color: AppColors.textMuted,
                textDirection: Directionality.of(context) == TextDirection.rtl
                    ? TextDirection.rtl
                    : TextDirection.ltr,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
