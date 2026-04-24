import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../providers/customer_order_booking_provider.dart';
import '../cards/customer_booking_option_card.dart';
import '../widgets/customer_booking_step_header_widget.dart';

class CustomerBookingStep2PreferencesVw extends ConsumerWidget {
  const CustomerBookingStep2PreferencesVw({super.key});

  String _localizedLabel(AppLocalizations l10n, String label, String? label2) {
    if (l10n.locale.languageCode == 'ar' &&
        label2 != null &&
        label2.trim().isNotEmpty) {
      return label2;
    }
    return label;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final localizations = AppLocalizations.of(context);
    final booking = ref.watch(customerOrderBookingProvider);
    final notifier = ref.read(customerOrderBookingProvider.notifier);
    AppLogger.info(
      'booking_step2.render servicePrefs=${booking.servicePreferenceOptions.length} '
      'pickupPrefs=${booking.pickupPreferenceOptions.length} '
      'selectedService=${booking.draft.selectedServicePreferenceIds.length} '
      'selectedPickup=${booking.draft.selectedPickupPreferenceIds.length}',
    );
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CustomerBookingStepHeaderWidget(
          title: localizations.text('booking.step2Title'),
          description: localizations.text('booking.step2Description'),
        ),
        const SizedBox(height: AppSpacing.lg),
        // Service preferences
        Text(
          localizations.text('booking.servicePrefsTitle'),
          style: theme.textTheme.titleMedium,
        ),
        const SizedBox(height: AppSpacing.sm),
        if (booking.servicePreferenceOptions.isEmpty)
          AppCardWidget(
            child: Text(
              localizations.text('booking.noServicePrefs'),
              style: theme.textTheme.bodyLarge,
            ),
          )
        else
          ...booking.servicePreferenceOptions.map(
            (pref) => Padding(
              padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
              child: CustomerBookingOptionCard(
                title: _localizedLabel(localizations, pref.label, pref.label2),
                description: '',
                trailingLabel: localizations.text('booking.servicePrefsTitle'),
                isSelected: booking.draft.selectedServicePreferenceIds
                    .contains(pref.id),
                onTap: () => notifier.toggleServicePreference(pref.id),
              ),
            ),
          ),
        const SizedBox(height: AppSpacing.lg),
        // Pickup preferences
        Text(
          localizations.text('booking.pickupPrefsTitle'),
          style: theme.textTheme.titleMedium,
        ),
        const SizedBox(height: AppSpacing.sm),
        if (booking.pickupPreferenceOptions.isEmpty)
          AppCardWidget(
            child: Text(
              localizations.text('booking.noPickupPrefs'),
              style: theme.textTheme.bodyLarge,
            ),
          )
        else
          ...booking.pickupPreferenceOptions.map(
            (pref) => Padding(
              padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
              child: CustomerBookingOptionCard(
                title: _localizedLabel(localizations, pref.label, pref.label2),
                description: '',
                trailingLabel: localizations.text('booking.pickupPrefsTitle'),
                isSelected:
                    booking.draft.selectedPickupPreferenceIds.contains(pref.id),
                onTap: () => notifier.togglePickupPreference(pref.id),
              ),
            ),
          ),
      ],
    );
  }
}
