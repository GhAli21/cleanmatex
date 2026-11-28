import 'package:flutter/material.dart';

import 'app_radii.dart';
import 'cmx_theme_extension.dart';

/// Semantic status pill pairing icon + text + tone (never color-only).
class AppStatusBadgeWidget extends StatelessWidget {
  const AppStatusBadgeWidget({
    super.key,
    required this.label,
    this.tone = CmxSemanticTone.neutral,
    this.icon,
    this.solid = false,
  });

  final String label;
  final CmxSemanticTone tone;
  final IconData? icon;
  final bool solid;

  @override
  Widget build(BuildContext context) {
    final ext = CmxStatusThemeExtension.of(context);
    final colors = ext.tone(tone);
    final bg = solid ? colors.solid : colors.background;
    final fg = solid ? colors.onSolid : colors.foreground;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: solid ? null : Border.all(color: colors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: fg),
            const SizedBox(width: 5),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: fg,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
