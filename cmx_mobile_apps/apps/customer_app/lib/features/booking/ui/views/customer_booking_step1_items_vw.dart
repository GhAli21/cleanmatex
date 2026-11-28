import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../providers/customer_order_booking_provider.dart';
import '../widgets/customer_booking_cart_summary_widget.dart';
import '../widgets/customer_booking_item_card.dart';
import '../widgets/customer_booking_search_field_widget.dart';
import '../widgets/customer_booking_step_header_widget.dart';

/// Step 2/6: Select Items + expandable optional per-piece preferences (showing
/// extra price) and per-item notes.
class CustomerBookingStep1ItemsVw extends ConsumerStatefulWidget {
  const CustomerBookingStep1ItemsVw({super.key});

  @override
  ConsumerState<CustomerBookingStep1ItemsVw> createState() =>
      _CustomerBookingStep1ItemsVwState();
}

class _CustomerBookingStep1ItemsVwState
    extends ConsumerState<CustomerBookingStep1ItemsVw> {
  int _selectedCategoryIndex = 0;

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
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final booking = ref.watch(customerOrderBookingProvider);
    final notifier = ref.read(customerOrderBookingProvider.notifier);
    final isSearching = booking.itemSearchQuery.isNotEmpty;

    if (_selectedCategoryIndex >= booking.categories.length &&
        booking.categories.isNotEmpty) {
      _selectedCategoryIndex = 0;
    }

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
          _buildItemList(
            context,
            localizations,
            booking,
            notifier,
            booking.filteredItems,
            emptyTitleKey: 'booking.searchEmptyTitle',
            emptyBodyKey: 'booking.searchEmptyBody',
          )
        else ...[
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (var i = 0; i < booking.categories.length; i++)
                  Padding(
                    padding:
                        const EdgeInsetsDirectional.only(end: AppSpacing.xs),
                    child: ChoiceChip(
                      label: Text(
                        _localizedName(
                          localizations,
                          booking.categories[i].name,
                          booking.categories[i].name2,
                        ),
                      ),
                      selected: i == _selectedCategoryIndex,
                      onSelected: (_) =>
                          setState(() => _selectedCategoryIndex = i),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _buildItemList(
            context,
            localizations,
            booking,
            notifier,
            booking.categories[_selectedCategoryIndex].items,
            emptyTitleKey: 'booking.itemsEmptyTitle',
            emptyBodyKey: 'booking.itemsEmptyBody',
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        const CustomerBookingCartSummaryWidget(),
      ],
    );
  }

  Widget _buildItemList(
    BuildContext context,
    AppLocalizations l10n,
    BookingState booking,
    CustomerOrderBookingNotifier notifier,
    List<BookingCatalogItemModel> items, {
    required String emptyTitleKey,
    required String emptyBodyKey,
  }) {
    if (items.isEmpty) {
      return AppCardWidget(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.text(emptyTitleKey),
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AppSpacing.sm),
            Text(l10n.text(emptyBodyKey),
                style: Theme.of(context).textTheme.bodyLarge),
          ],
        ),
      );
    }

    return Column(
      children: items.map((item) {
        final pieces = booking.piecePreferences[item.id] ?? const [];
        final firstPiecePrefIds = pieces.isNotEmpty
            ? pieces.first.servicePreferenceIds
            : const <String>[];
        return Padding(
          padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
          child: CustomerBookingItemCard(
            item: item,
            quantity: booking.draft.cartItems[item.id] ?? 0,
            onAdd: () => notifier.addItem(item.id),
            onRemove: () => notifier.removeItem(item.id),
            unitLabel: _unitLabel(l10n, item.unit),
            localizedName: _localizedName(l10n, item.name, item.name2),
            localizedDescription: _localizedName(
              l10n,
              item.description ?? '',
              item.description2,
            ),
            currencyCode: booking.currencyCode,
            itemNote: booking.draft.itemNotes[item.id] ?? '',
            onItemNoteChanged: (note) => notifier.setItemNote(item.id, note),
            servicePreferenceOptions: booking.servicePreferenceOptions,
            selectedPiecePrefIds: firstPiecePrefIds,
            onToggleQuickPiecePref: (prefId) {
              final qty = booking.draft.cartItems[item.id] ?? 1;
              notifier.initPiecePreferences(item.id, qty);
              notifier.togglePieceServicePref(item.id, 1, prefId);
            },
          ),
        );
      }).toList(growable: false),
    );
  }
}
