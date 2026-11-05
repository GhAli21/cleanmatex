import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

/// The order's money statement (Reusable Order Fin View P6-12): value lines
/// up to the total, then paid, credits, refunded and the balance with its
/// word. Every figure is the server's; this widget formats, never computes.
class CustomerOrderStatementCard extends StatelessWidget {
  const CustomerOrderStatementCard({super.key, required this.statement});

  final OrderFinancialStatementModel statement;

  String _money(BuildContext context, double? amount, {bool reduction = false}) {
    if (amount == null) return '—';
    final decimals = statement.currencyDecimalPlaces ?? 2;
    final currency = statement.currencyCode;
    final formatted = NumberFormat.currency(
      locale: Localizations.localeOf(context).toLanguageTag(),
      name: currency,
      decimalDigits: decimals,
      symbol: '',
    ).format(amount).trim();
    final signed = reduction ? '−$formatted' : formatted;
    // Keep the sign and digits together in Arabic text (left-to-right isolate).
    final isolated = '${String.fromCharCode(0x2066)}$signed${String.fromCharCode(0x2069)}';
    return currency != null && currency.isNotEmpty ? '$isolated $currency' : isolated;
  }

  Color _balanceColor(ColorScheme scheme) {
    switch (statement.balanceState) {
      case 'settled':
        return AppColors.success;
      case 'overpaid':
        return scheme.primary;
      default:
        return AppColors.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;

    Widget row(String label, String value, {TextStyle? style, Color? valueColor}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
          child: Row(
            children: [
              Expanded(child: Text(label, style: style ?? textTheme.bodyMedium?.copyWith(color: AppColors.textMuted))),
              Text(value, style: (style ?? textTheme.bodyMedium)?.copyWith(fontWeight: FontWeight.w500, color: valueColor)),
            ],
          ),
        );

    String lineLabel(OrderStatementLineModel line) => line.isIncluded
        ? l10n.text('orders.statement.taxesIncluded')
        : l10n.text('orders.statement.${line.sectionKey}');

    String tenderLabel(String? code) {
      final key = 'orders.statement.method.${code ?? ''}';
      final text = l10n.text(key);
      return text == key ? (code ?? '—') : text;
    }

    return AppCardWidget(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.text('orders.statement.title'), style: textTheme.titleLarge),
          const SizedBox(height: AppSpacing.md),
          for (final line in statement.lines)
            row(lineLabel(line), _money(context, line.amount, reduction: line.isReduction)),
          const Divider(height: AppSpacing.lg, color: AppColors.border),
          row(l10n.text('orders.total'), _money(context, statement.total), style: textTheme.titleMedium),
          if ((statement.paid ?? 0) > 0) ...[
            row(l10n.text('orders.paidAmount'), _money(context, statement.paid, reduction: true)),
            for (final tender in statement.tenders)
              Padding(
                padding: const EdgeInsetsDirectional.only(start: AppSpacing.md),
                child: row(tenderLabel(tender.methodCode), _money(context, tender.amount)),
              ),
          ],
          if ((statement.credits ?? 0) > 0)
            row(l10n.text('orders.statement.credits'), _money(context, statement.credits, reduction: true)),
          if ((statement.refunded ?? 0) > 0)
            row(l10n.text('orders.statement.refunded'), _money(context, statement.refunded)),
          const Divider(height: AppSpacing.lg, color: AppColors.border),
          row(
            l10n.text('orders.statement.balanceStates.${statement.balanceState}'),
            _money(context, statement.balance),
            style: textTheme.titleMedium,
            valueColor: _balanceColor(scheme),
          ),
        ],
      ),
    );
  }
}
