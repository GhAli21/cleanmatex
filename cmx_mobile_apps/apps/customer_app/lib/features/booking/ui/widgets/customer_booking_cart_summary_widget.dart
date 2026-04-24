import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../providers/customer_order_booking_provider.dart';

class CustomerBookingCartSummaryWidget extends ConsumerWidget {
  const CustomerBookingCartSummaryWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final localizations = AppLocalizations.of(context);
    final totalCount = ref.watch(
      customerOrderBookingProvider.select((s) => s.totalItemCount),
    );
    final estimatedTotal = ref.watch(
      customerOrderBookingProvider.select((s) => s.estimatedTotal),
    );
    final currencyCode = ref.watch(
      customerOrderBookingProvider.select((s) => s.currencyCode),
    );

    if (totalCount == 0) return const SizedBox.shrink();

    final formatter = NumberFormat.currency(
      locale: Localizations.localeOf(context).toLanguageTag(),
      name: currencyCode,
      symbol: '',
      decimalDigits: 3,
    );
    final priceLabel =
        '${formatter.format(estimatedTotal).trim()} $currencyCode';

    return AppCardWidget(
      accentColor: AppColors.primary,
      child: Row(
        children: [
          const Icon(Icons.shopping_basket_outlined, color: AppColors.primary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              localizations.textWithArgs('booking.cartSummaryLabel', {
                'count': '$totalCount',
                'price': priceLabel,
              }),
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: AppColors.primary,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
