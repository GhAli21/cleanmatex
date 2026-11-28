import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_radii.dart';
import 'app_text_styles.dart';
import 'cmx_theme_extension.dart';

/// Tactile quantity stepper (`- qty +`) with 44dp touch targets and haptics.
class AppQuantityStepperWidget extends StatelessWidget {
  const AppQuantityStepperWidget({
    super.key,
    required this.value,
    required this.onChanged,
    this.min = 0,
    this.max = 99,
    this.decrementTooltip = 'Decrease',
    this.incrementTooltip = 'Increase',
  });

  final int value;
  final ValueChanged<int> onChanged;
  final int min;
  final int max;
  final String decrementTooltip;
  final String incrementTooltip;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    final canDec = value > min;
    final canInc = value < max;

    return Directionality(
      textDirection: TextDirection.ltr,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _StepperBtn(
            icon: Icons.remove_rounded,
            tooltip: decrementTooltip,
            enabled: canDec,
            background: ext.surfaceMuted,
            foreground: theme.colorScheme.onSurface,
            onTap: () {
              HapticFeedback.lightImpact();
              onChanged(value - 1);
            },
          ),
          SizedBox(
            width: 34,
            child: Text(
              '$value',
              textAlign: TextAlign.center,
              style: AppTextStyles.tabular(theme.textTheme.titleMedium),
            ),
          ),
          _StepperBtn(
            icon: Icons.add_rounded,
            tooltip: incrementTooltip,
            enabled: canInc,
            background: theme.colorScheme.primary,
            foreground: theme.colorScheme.onPrimary,
            onTap: () {
              HapticFeedback.lightImpact();
              onChanged(value + 1);
            },
          ),
        ],
      ),
    );
  }
}

class _StepperBtn extends StatelessWidget {
  const _StepperBtn({
    required this.icon,
    required this.tooltip,
    required this.enabled,
    required this.background,
    required this.foreground,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final bool enabled;
  final Color background;
  final Color foreground;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: enabled,
      label: tooltip,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(AppRadii.sm),
        child: Opacity(
          opacity: enabled ? 1.0 : 0.4,
          child: Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            child: Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: background,
                borderRadius: BorderRadius.circular(AppRadii.sm),
              ),
              child: Icon(icon, size: 18, color: foreground),
            ),
          ),
        ),
      ),
    );
  }
}
