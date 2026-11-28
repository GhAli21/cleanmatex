import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_radii.dart';
import 'cmx_theme_extension.dart';

/// Option model for [AppSegmentedControlWidget].
class AppSegmentOption<T> {
  const AppSegmentOption({required this.value, required this.label});

  final T value;
  final String label;
}

/// Clean pill segmented switcher with haptic feedback and RTL support.
class AppSegmentedControlWidget<T> extends StatelessWidget {
  const AppSegmentedControlWidget({
    super.key,
    required this.options,
    required this.selectedValue,
    required this.onChanged,
  });

  final List<AppSegmentOption<T>> options;
  final T selectedValue;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: ext.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      child: Row(
        children: [
          for (final opt in options)
            Expanded(
              child: Semantics(
                button: true,
                selected: opt.value == selectedValue,
                label: opt.label,
                child: InkWell(
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                  onTap: () {
                    if (opt.value == selectedValue) return;
                    HapticFeedback.selectionClick();
                    onChanged(opt.value);
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 160),
                    constraints: const BoxConstraints(minHeight: 40),
                    alignment: Alignment.center,
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                    decoration: BoxDecoration(
                      color: opt.value == selectedValue
                          ? theme.colorScheme.surface
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(AppRadii.sm),
                      boxShadow: opt.value == selectedValue
                          ? [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.06),
                                blurRadius: 4,
                                offset: const Offset(0, 1),
                              ),
                            ]
                          : null,
                    ),
                    child: Text(
                      opt.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: opt.value == selectedValue
                            ? ext.brandText
                            : theme.textTheme.bodySmall?.color,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
