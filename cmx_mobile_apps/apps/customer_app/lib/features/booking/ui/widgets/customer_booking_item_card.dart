import 'package:flutter/material.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_ui/mobile_ui.dart';

class CustomerBookingItemCard extends StatelessWidget {
  const CustomerBookingItemCard({
    super.key,
    required this.item,
    required this.quantity,
    required this.onAdd,
    required this.onRemove,
    required this.unitLabel,
    required this.localizedName,
    required this.localizedDescription,
    required this.currencyCode,
  });

  final BookingCatalogItemModel item;
  final int quantity;
  final VoidCallback onAdd;
  final VoidCallback onRemove;
  final String unitLabel;
  final String localizedName;
  final String? localizedDescription;
  final String currencyCode;

  String _formatPrice(double price) {
    return '${price.toStringAsFixed(3)} $currencyCode';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasQty = quantity > 0;

    return Semantics(
      label: '$localizedName, ${_formatPrice(item.unitPrice)} $unitLabel',
      child: AppCardWidget(
        accentColor: hasQty ? AppColors.primary : null,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Item info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(localizedName, style: theme.textTheme.titleMedium),
                  if (localizedDescription != null &&
                      localizedDescription!.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      localizedDescription!,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.textMuted,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    '${_formatPrice(item.unitPrice)} · $unitLabel',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            // Quantity controls
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 36,
                  height: 36,
                  child: Semantics(
                    label: 'Remove ${item.name}',
                    button: true,
                    child: IconButton(
                      padding: EdgeInsets.zero,
                      iconSize: 20,
                      icon: const Icon(Icons.remove_circle_outline),
                      color: hasQty ? AppColors.primary : AppColors.border,
                      onPressed: hasQty ? onRemove : null,
                    ),
                  ),
                ),
                SizedBox(
                  width: 28,
                  child: Text(
                    '$quantity',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleMedium,
                  ),
                ),
                SizedBox(
                  width: 36,
                  height: 36,
                  child: Semantics(
                    label: 'Add ${item.name}',
                    button: true,
                    child: IconButton(
                      padding: EdgeInsets.zero,
                      iconSize: 20,
                      icon: const Icon(Icons.add_circle_outline),
                      color: AppColors.primary,
                      onPressed: onAdd,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
