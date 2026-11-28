import 'package:flutter/material.dart';

import 'app_code_chip_widget.dart';
import 'app_colors.dart';
import 'app_radii.dart';
import 'app_spacing.dart';
import 'cmx_theme_extension.dart';

/// Deterministic, always-light high-contrast QR presentation card used for
/// counter pickup handoff codes and digital VAT receipt previews.
class AppQrCardWidget extends StatelessWidget {
  const AppQrCardWidget({
    super.key,
    required this.payload,
    required this.title,
    this.subtitle,
    this.displayCode,
    this.copiedFeedbackMessage,
    this.size = 132,
  });

  final String payload;
  final String title;
  final String? subtitle;
  final String? displayCode;
  final String? copiedFeedbackMessage;
  final double size;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: ext.brand.background,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: ext.brand.border),
      ),
      child: Column(
        children: [
          Text(
            title,
            textAlign: TextAlign.center,
            style: theme.textTheme.titleMedium?.copyWith(color: ext.brandText),
          ),
          const SizedBox(height: AppSpacing.sm),
          // QR code always renders on pure white background for scanner legibility.
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppRadii.md),
              border: Border.all(color: AppColors.border),
            ),
            child: CustomPaint(
              size: Size.square(size),
              painter: _QrPatternPainter(payload),
            ),
          ),
          if (displayCode != null) ...[
            const SizedBox(height: AppSpacing.sm),
            AppCodeChipWidget(
              code: displayCode!,
              copiedFeedbackMessage: copiedFeedbackMessage,
            ),
          ],
          if (subtitle != null && subtitle!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              subtitle!,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}

class _QrPatternPainter extends CustomPainter {
  _QrPatternPainter(this.payload);

  final String payload;

  @override
  void paint(Canvas canvas, Size size) {
    const grid = 21;
    final cell = size.width / grid;
    final paint = Paint()..color = AppColors.secondary;

    void drawFinder(int ox, int oy) {
      for (var y = 0; y < 7; y++) {
        for (var x = 0; x < 7; x++) {
          final isOuter = x == 0 || y == 0 || x == 6 || y == 6;
          final isInner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          if (isOuter || isInner) {
            canvas.drawRect(
              Rect.fromLTWH((ox + x) * cell, (oy + y) * cell, cell, cell),
              paint,
            );
          }
        }
      }
    }

    drawFinder(0, 0);
    drawFinder(grid - 7, 0);
    drawFinder(0, grid - 7);

    var seed = 0x811c9dc5;
    for (final unit in payload.codeUnits) {
      seed ^= unit;
      seed = (seed * 0x01000193) & 0xffffffff;
    }

    for (var y = 0; y < grid; y++) {
      for (var x = 0; x < grid; x++) {
        final inTopLeft = x < 8 && y < 8;
        final inTopRight = x >= grid - 8 && y < 8;
        final inBottomLeft = x < 8 && y >= grid - 8;
        if (inTopLeft || inTopRight || inBottomLeft) continue;
        seed = ((seed * 1664525) + 1013904223) & 0xffffffff;
        if (((seed >> 16) & 1) == 1) {
          canvas.drawRect(
            Rect.fromLTWH(x * cell, y * cell, cell, cell),
            paint,
          );
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant _QrPatternPainter oldDelegate) =>
      oldDelegate.payload != payload;
}
