import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../providers/customer_order_booking_provider.dart';
import '../widgets/customer_booking_step_header_widget.dart';

class CustomerBookingStep4ReviewVw extends ConsumerStatefulWidget {
  const CustomerBookingStep4ReviewVw({super.key});

  @override
  ConsumerState<CustomerBookingStep4ReviewVw> createState() =>
      _CustomerBookingStep4ReviewVwState();
}

class _CustomerBookingStep4ReviewVwState
    extends ConsumerState<CustomerBookingStep4ReviewVw> {
  late final TextEditingController _notesController;

  @override
  void initState() {
    super.initState();
    final notes = ref.read(customerOrderBookingProvider).draft.notes;
    _notesController = TextEditingController(text: notes);
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  String _localizedName(
      AppLocalizations l10n, String primary, String? secondary) {
    if (l10n.locale.languageCode == 'ar' &&
        secondary != null &&
        secondary.trim().isNotEmpty) {
      return secondary;
    }
    return primary;
  }

  String _formatPrice(BuildContext context, double price, String currencyCode) {
    final formatter = NumberFormat.currency(
      locale: Localizations.localeOf(context).toLanguageTag(),
      name: currencyCode,
      symbol: '',
      decimalDigits: 3,
    );
    return '${formatter.format(price).trim()} $currencyCode';
  }

  String _formatDateTime(BuildContext context, DateTime dt) {
    final localeTag = Localizations.localeOf(context).toLanguageTag();
    return DateFormat.yMMMd(localeTag).add_jm().format(dt);
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final booking = ref.watch(customerOrderBookingProvider);
    final notifier = ref.read(customerOrderBookingProvider.notifier);
    final theme = Theme.of(context);

    // Sync notes controller when state changes externally
    if (_notesController.text != booking.draft.notes) {
      _notesController.value = TextEditingValue(
        text: booking.draft.notes,
        selection: TextSelection.collapsed(
          offset: booking.draft.notes.length,
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CustomerBookingStepHeaderWidget(
          title: localizations.text('booking.step4Title'),
          description: localizations.text('booking.step4Description'),
        ),
        const SizedBox(height: AppSpacing.lg),
        // 1. Items section
        _buildItemsCard(context, localizations, booking, theme),
        const SizedBox(height: AppSpacing.md),
        // 2. Preferences section
        _buildPreferencesCard(context, localizations, booking, theme),
        const SizedBox(height: AppSpacing.md),
        // 3. Schedule section
        _buildScheduleCard(context, localizations, booking, theme),
        const SizedBox(height: AppSpacing.md),
        // 4. Pricing section
        _buildPricingCard(context, localizations, booking, theme),
        const SizedBox(height: AppSpacing.md),
        // 5. Notes section
        AppCardWidget(
          child: TextField(
            controller: _notesController,
            onChanged: notifier.updateNotes,
            decoration: InputDecoration(
              labelText: localizations.text('booking.notesLabel'),
              hintText: localizations.text('booking.notesHint'),
              border: InputBorder.none,
            ),
            maxLines: 3,
          ),
        ),
      ],
    );
  }

  Widget _buildItemsCard(
    BuildContext context,
    AppLocalizations l10n,
    BookingState booking,
    ThemeData theme,
  ) {
    // Build flat list of items that have qty > 0
    final lineItems = <({String name, int qty, double price})>[];
    for (final category in booking.categories) {
      for (final item in category.items) {
        final qty = booking.draft.cartItems[item.id] ?? 0;
        if (qty > 0) {
          lineItems.add((
            name: _localizedName(l10n, item.name, item.name2),
            qty: qty,
            price: item.unitPrice * qty,
          ));
        }
      }
    }

    return AppCardWidget(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.text('booking.reviewItemsTitle'),
            style: theme.textTheme.titleMedium,
          ),
          const SizedBox(height: AppSpacing.sm),
          if (lineItems.isEmpty)
            Text(
              l10n.text('booking.reviewNoneSelected'),
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: AppColors.textMuted),
            )
          else ...[
            ...lineItems.map(
              (item) => Padding(
                padding:
                    const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${item.name} × ${item.qty}',
                        style: theme.textTheme.bodyLarge,
                      ),
                    ),
                    Text(
                      _formatPrice(context, item.price, booking.currencyCode),
                      style: theme.textTheme.bodyLarge,
                    ),
                  ],
                ),
              ),
            ),
            const Divider(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  child: Text(
                    l10n.text('booking.reviewEstSubtotal'),
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(color: AppColors.textMuted),
                  ),
                ),
                Text(
                  _formatPrice(
                    context,
                    booking.estimatedSubtotal,
                    booking.currencyCode,
                  ),
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(color: AppColors.textMuted),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPreferencesCard(
    BuildContext context,
    AppLocalizations l10n,
    BookingState booking,
    ThemeData theme,
  ) {
    final serviceLabels = booking.servicePreferenceOptions
        .where((p) => booking.draft.selectedServicePreferenceIds.contains(p.id))
        .map((p) => _localizedName(l10n, p.label, p.label2))
        .join(', ');
    final pickupLabels = booking.pickupPreferenceOptions
        .where((p) => booking.draft.selectedPickupPreferenceIds.contains(p.id))
        .map((p) => _localizedName(l10n, p.label, p.label2))
        .join(', ');

    final noneText = l10n.text('booking.reviewNoneSelected');

    return AppCardWidget(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.text('booking.reviewPrefsTitle'),
              style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          _ReviewRow(
            label: l10n.text('booking.servicePrefsTitle'),
            value: serviceLabels.isEmpty ? noneText : serviceLabels,
            theme: theme,
          ),
          const SizedBox(height: AppSpacing.xs),
          _ReviewRow(
            label: l10n.text('booking.pickupPrefsTitle'),
            value: pickupLabels.isEmpty ? noneText : pickupLabels,
            theme: theme,
          ),
        ],
      ),
    );
  }

  Widget _buildScheduleCard(
    BuildContext context,
    AppLocalizations l10n,
    BookingState booking,
    ThemeData theme,
  ) {
    final String scheduleDetail;
    if (!booking.draft.isPickupFromAddress) {
      scheduleDetail = l10n.text('booking.reviewBringIn');
    } else {
      final addressLabel = booking.draft.address?.label ?? '-';
      final timeDetail = booking.draft.isAsap
          ? l10n.text('booking.reviewAsap')
          : (booking.draft.scheduledAt != null
              ? l10n.textWithArgs('booking.reviewScheduled', {
                  'datetime': _formatDateTime(
                    context,
                    booking.draft.scheduledAt!,
                  ),
                })
              : l10n.text('booking.reviewAsap'));
      scheduleDetail = '${l10n.textWithArgs('booking.reviewAddressFor', {
            'address': addressLabel
          })} · $timeDetail';
    }

    return AppCardWidget(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.text('booking.reviewScheduleTitle'),
              style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Text(scheduleDetail, style: theme.textTheme.bodyLarge),
        ],
      ),
    );
  }

  Widget _buildPricingCard(
    BuildContext context,
    AppLocalizations l10n,
    BookingState booking,
    ThemeData theme,
  ) {
    final vatPercent = (booking.vatRate * 100).round();
    return AppCardWidget(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _ReviewRow(
            label: l10n.text('booking.reviewEstSubtotal'),
            value: _formatPrice(
              context,
              booking.estimatedSubtotal,
              booking.currencyCode,
            ),
            theme: theme,
          ),
          if (booking.vatRate > 0) ...[
            const SizedBox(height: AppSpacing.xs),
            _ReviewRow(
              label: l10n
                  .textWithArgs('booking.reviewVat', {'rate': '$vatPercent'}),
              value: _formatPrice(
                context,
                booking.estimatedVat,
                booking.currencyCode,
              ),
              theme: theme,
            ),
          ],
          const Divider(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: Text(
                  l10n.text('booking.reviewEstTotal'),
                  style: theme.textTheme.titleMedium,
                ),
              ),
              Text(
                _formatPrice(
                  context,
                  booking.estimatedTotal,
                  booking.currencyCode,
                ),
                style: theme.textTheme.titleMedium,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.text('booking.reviewVatNote'),
            style:
                theme.textTheme.bodySmall?.copyWith(color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({
    required this.label,
    required this.value,
    required this.theme,
  });

  final String label;
  final String value;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$label: ',
          style:
              theme.textTheme.bodyMedium?.copyWith(color: AppColors.textMuted),
        ),
        Expanded(
          child: Text(value, style: theme.textTheme.bodyLarge),
        ),
      ],
    );
  }
}
