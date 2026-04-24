import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../providers/customer_order_booking_provider.dart';

class CustomerBookingSearchFieldWidget extends ConsumerWidget {
  const CustomerBookingSearchFieldWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final localizations = AppLocalizations.of(context);
    final query = ref.watch(
      customerOrderBookingProvider.select((s) => s.itemSearchQuery),
    );
    final notifier = ref.read(customerOrderBookingProvider.notifier);

    return TextField(
      onChanged: notifier.setItemSearchQuery,
      decoration: InputDecoration(
        hintText: localizations.text('booking.searchHint'),
        prefixIcon: const Icon(Icons.search),
        suffixIcon: query.isNotEmpty
            ? IconButton(
                icon: const Icon(Icons.clear),
                tooltip: localizations.text('booking.searchClearLabel'),
                onPressed: () => notifier.setItemSearchQuery(''),
              )
            : null,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        contentPadding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
      ),
    );
  }
}
