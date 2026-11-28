import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

/// One order line: pieces and name, what tells the line apart (measure, speed,
/// ordinal), the billed quantity and why when it differs from the measure, the
/// unit price of a measured line, and the line amount. Every figure comes from
/// the server.
class CustomerOrderItemRowVw extends StatelessWidget {
  const CustomerOrderItemRowVw({
    super.key,
    required this.item,
    required this.amount,
    this.unitPrice,
  });

  final OrderItemModel item;

  /// The line amount, already formatted with its currency.
  final String amount;

  /// The price of one unit of a measured line, already formatted.
  final String? unitPrice;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final localeTag = Localizations.localeOf(context).toLanguageTag();
    final qualifier = item.qualifier;
    final measure = qualifier?.measure;

    String quantity(double value) {
      final format = NumberFormat.decimalPattern(localeTag)
        ..minimumFractionDigits = 0
        ..maximumFractionDigits = measure!.qtyDecimals;
      final symbol =
          isArabic ? measure.symbol2 ?? measure.symbol : measure.symbol;
      return _isolate('${format.format(value)} $symbol');
    }

    final speed = isArabic
        ? qualifier?.speedName2 ?? qualifier?.speedName ?? qualifier?.speedCode
        : qualifier?.speedName ?? qualifier?.speedCode;
    // The price follows the quantity it multiplies: the billed one when it differs.
    final times = unitPrice == null ? '' : ' × ${_isolate(unitPrice!)}';
    String billedText(OrderLineMeasureModel m) {
      final billed = quantity(m.billedQty!);
      if (m.isRaisedToMinimum) {
        return localizations
            .textWithArgs('orders.line.billedMinimum', {'qty': billed});
      }
      if (m.billingIncrement != null) {
        return localizations.textWithArgs('orders.line.billedStep',
            {'qty': billed, 'step': quantity(m.billingIncrement!)});
      }
      return localizations.textWithArgs('orders.line.billed', {'qty': billed});
    }

    final parts = [
      if (measure != null)
        '${quantity(measure.qty)}${measure.isBilledDifferently ? '' : times}',
      if (qualifier?.speedCode != null) _isolate(speed!),
    ].join(' · ');
    final detail = [
      if (parts.isNotEmpty) parts,
      if (qualifier?.ordinal != null) '(${qualifier!.ordinal})',
    ].join(' ');
    final name = isArabic ? item.name2 ?? item.name : item.name;
    final detailStyle =
        textTheme.bodySmall?.copyWith(color: AppColors.textMuted);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${item.quantity}× $name', style: textTheme.bodyMedium),
              if (detail.isNotEmpty) Text(detail, style: detailStyle),
              if (measure != null && measure.isBilledDifferently)
                Text('${billedText(measure)}$times', style: detailStyle),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(
          amount,
          style: textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
        ),
      ],
    );
  }

  /// Keeps a part in its own text direction inside mixed Arabic / Latin text.
  static String _isolate(String text) => '\u2068$text\u2069';
}
