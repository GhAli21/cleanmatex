import 'package:intl/intl.dart';

/// Formats the server's booking total for display only; it is never
/// recalculated on the device. Decimal places follow the currency's ISO
/// rule (OMR 3, SAR 2). Returns null when the amount is missing or unreadable,
/// so the confirmation simply omits the line.
String? formatBookingTotal({
  required String? amount,
  required String? currencyCode,
  required String localeTag,
}) {
  final value = double.tryParse(amount ?? '');
  if (value == null) return null;
  final currency = (currencyCode ?? '').trim();
  final formatter = NumberFormat.currency(
    locale: localeTag,
    name: currency.isEmpty ? null : currency,
    symbol: '',
  );
  final formatted = formatter.format(value).trim();
  return currency.isEmpty ? formatted : '$formatted $currency';
}
