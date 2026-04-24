import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../providers/customer_order_booking_provider.dart';
import '../widgets/customer_booking_cart_summary_widget.dart';
import '../widgets/customer_booking_item_card.dart';
import '../widgets/customer_booking_search_field_widget.dart';
import '../widgets/customer_booking_step_header_widget.dart';

class CustomerBookingStep1ItemsVw extends ConsumerWidget {
  const CustomerBookingStep1ItemsVw({super.key});

  String _localizedName(
    AppLocalizations l10n,
    String primary,
    String? secondary,
  ) {
    if (l10n.locale.languageCode == 'ar' &&
        secondary != null &&
        secondary.trim().isNotEmpty) {
      return secondary;
    }
    return primary;
  }

  String _unitLabel(AppLocalizations l10n, String unit) {
    switch (unit) {
      case 'per_kg':
        return l10n.text('booking.unitPerKg');
      default:
        return l10n.text('booking.unitPerPiece');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final localizations = AppLocalizations.of(context);
    final booking = ref.watch(customerOrderBookingProvider);
    final notifier = ref.read(customerOrderBookingProvider.notifier);
    final isSearching = booking.itemSearchQuery.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CustomerBookingStepHeaderWidget(
          title: localizations.text('booking.step1Title'),
          description: localizations.text('booking.step1Description'),
        ),
        const SizedBox(height: AppSpacing.md),
        const CustomerBookingSearchFieldWidget(),
        const SizedBox(height: AppSpacing.md),
        if (booking.categories.isEmpty)
          AppCardWidget(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  localizations.text('booking.itemsEmptyTitle'),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  localizations.text('booking.itemsEmptyBody'),
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              ],
            ),
          )
        else if (isSearching)
          _buildSearchResults(context, localizations, booking, notifier)
        else
          _buildCategoryTabs(context, localizations, booking, notifier),
        const SizedBox(height: AppSpacing.md),
        const CustomerBookingCartSummaryWidget(),
      ],
    );
  }

  Widget _buildSearchResults(
    BuildContext context,
    AppLocalizations l10n,
    BookingState booking,
    CustomerOrderBookingNotifier notifier,
  ) {
    final items = booking.filteredItems;
    if (items.isEmpty) {
      return AppCardWidget(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.text('booking.searchEmptyTitle'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              l10n.text('booking.searchEmptyBody'),
              style: Theme.of(context).textTheme.bodyLarge,
            ),
          ],
        ),
      );
    }

    return Column(
      children: items
          .map(
            (item) => Padding(
              padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
              child: CustomerBookingItemCard(
                item: item,
                quantity: booking.draft.cartItems[item.id] ?? 0,
                onAdd: () => notifier.addItem(item.id),
                onRemove: () => notifier.removeItem(item.id),
                unitLabel: _unitLabel(l10n, item.unit),
                localizedName: _localizedName(l10n, item.name, item.name2),
                localizedDescription:
                    _localizedName(l10n, item.description ?? '', item.description2),
                currencyCode: booking.currencyCode,
              ),
            ),
          )
          .toList(),
    );
  }

  Widget _buildCategoryTabs(
    BuildContext context,
    AppLocalizations l10n,
    BookingState booking,
    CustomerOrderBookingNotifier notifier,
  ) {
    final categories = booking.categories;

    return DefaultTabController(
      length: categories.length,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: categories
                .map(
                  (cat) => Tab(
                    text: _localizedName(l10n, cat.name, cat.name2),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            // Height-bound TabBarView: use shrinkwrap with a fixed height.
            // Each tab list is short enough that a fixed bound works cleanly.
            // The outer ListView in the screen handles scrolling.
            height: _estimateTabHeight(categories
                .map((c) => c.items.length)
                .fold(0, (a, b) => a > b ? a : b)),
            child: TabBarView(
              children: categories.map((category) {
                return ListView.builder(
                  padding: EdgeInsets.zero,
                  physics: const NeverScrollableScrollPhysics(),
                  shrinkWrap: true,
                  itemCount: category.items.length,
                  itemBuilder: (context, index) {
                    final item = category.items[index];
                    return Padding(
                      padding: const EdgeInsetsDirectional.only(
                        bottom: AppSpacing.sm,
                      ),
                      child: CustomerBookingItemCard(
                        item: item,
                        quantity: booking.draft.cartItems[item.id] ?? 0,
                        onAdd: () => notifier.addItem(item.id),
                        onRemove: () => notifier.removeItem(item.id),
                        unitLabel: _unitLabel(l10n, item.unit),
                        localizedName:
                            _localizedName(l10n, item.name, item.name2),
                        localizedDescription: _localizedName(
                          l10n,
                          item.description ?? '',
                          item.description2,
                        ),
                        currencyCode: booking.currencyCode,
                      ),
                    );
                  },
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  // Estimate height based on item count so TabBarView has enough room.
  double _estimateTabHeight(int maxItems) {
    const itemCardHeight = 100.0;
    const itemSpacing = AppSpacing.sm;
    return (itemCardHeight + itemSpacing) * maxItems.clamp(1, 20);
  }
}
