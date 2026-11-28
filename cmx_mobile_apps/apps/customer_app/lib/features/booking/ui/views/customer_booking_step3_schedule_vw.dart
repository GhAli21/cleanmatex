import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../providers/customer_order_booking_provider.dart';
import '../cards/customer_booking_option_card.dart';
import '../widgets/customer_booking_step_header_widget.dart';

/// Step 4/6 of Detailed Order: Service Speed, Pickup Schedule (if collection),
/// and Estimated Ready-By date & time with sorting variance disclaimer.
class CustomerBookingStep3ScheduleVw extends ConsumerWidget {
  const CustomerBookingStep3ScheduleVw({super.key});

  String _formatReadyBy(BuildContext context, DateTime dt) {
    final localeTag = Localizations.localeOf(context).toLanguageTag();
    return DateFormat.yMMMEd(localeTag).add_jm().format(dt.toLocal());
  }

  DateTime _resolveEstimatedReadyBy(BookingState booking) {
    final fromServer = booking.serverQuote?.estimatedReadyByUtc;
    if (fromServer != null && fromServer.isNotEmpty) {
      final parsed = DateTime.tryParse(fromServer);
      if (parsed != null) return parsed;
    }
    final base = booking.draft.scheduledAt ?? DateTime.now();
    final speed = (booking.draft.serviceSpeed ?? 'STANDARD').toUpperCase();
    final hours = speed == 'SAME_DAY'
        ? 6
        : speed == 'EXPRESS'
            ? 18
            : 36;
    return base.add(Duration(hours: hours));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final booking = ref.watch(customerOrderBookingProvider);
    final notifier = ref.read(customerOrderBookingProvider.notifier);
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final needsPickupSchedule =
        booking.draft.pickupMode == CustomerPickupMode.collectAddress;
    final estimatedReadyBy = _resolveEstimatedReadyBy(booking);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CustomerBookingStepHeaderWidget(
          title: l10n.text('booking.step3Title'),
          description: l10n.text('booking.step3Description'),
        ),
        const SizedBox(height: AppSpacing.lg),

        // 1. Service Speed
        if (booking.serviceSpeeds.isNotEmpty) ...[
          Text(
            l10n.text('booking.speedLabel'),
            style: theme.textTheme.titleMedium,
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final speed in booking.serviceSpeeds) ...[
            CustomerBookingOptionCard(
              title: isArabic ? (speed.name2 ?? speed.name) : speed.name,
              description:
                  (isArabic ? speed.description2 : speed.description) ?? '',
              trailingLabel: '',
              isSelected:
                  (booking.draft.serviceSpeed ?? 'STANDARD') == speed.code,
              onTap: () => notifier.chooseServiceSpeed(speed.code),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          const SizedBox(height: AppSpacing.md),
        ],

        // 2. Pickup timing (when collecting from customer address)
        if (needsPickupSchedule) ...[
          Text(
            l10n.text('booking.scheduledAtLabel'),
            style: theme.textTheme.titleMedium,
          ),
          const SizedBox(height: AppSpacing.sm),
          CustomerBookingOptionCard(
            title: l10n.text('booking.asapOption'),
            description: l10n.text('booking.asapBody'),
            trailingLabel: '',
            isSelected: booking.draft.isAsap,
            onTap: () => notifier.setIsAsap(true),
          ),
          const SizedBox(height: AppSpacing.sm),
          CustomerBookingOptionCard(
            title: l10n.text('booking.scheduledOption'),
            description: l10n.text('booking.scheduledBody'),
            trailingLabel: '',
            isSelected: !booking.draft.isAsap,
            onTap: () => notifier.setIsAsap(false),
          ),
          if (!booking.draft.isAsap) ...[
            const SizedBox(height: AppSpacing.sm),
            AppDateTimePickerWidget(
              initialValue: booking.draft.scheduledAt,
              minDate: DateTime.now(),
              onChanged: notifier.setScheduledAt,
              label: l10n.text('booking.scheduledAtLabel'),
              placeholder: l10n.text('booking.scheduledAtPlaceholder'),
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
        ],

        // 3. Estimated Ready-By Date & Time + Sorting Variance Hint
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: ext.brand.background,
            borderRadius: BorderRadius.circular(AppRadii.lg),
            border: Border.all(color: ext.brand.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.event_available_rounded,
                      color: theme.colorScheme.primary),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      l10n.text('booking.estimatedReadyByLabel'),
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: ext.brandText,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                _formatReadyBy(context, estimatedReadyBy),
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (booking.serverQuote?.branchTimeZone != null) ...[
                const SizedBox(height: 2),
                Text(
                  booking.serverQuote!.branchTimeZone!,
                  style: theme.textTheme.labelSmall
                      ?.copyWith(color: ext.textMuted),
                ),
              ],
              const SizedBox(height: AppSpacing.sm),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline_rounded,
                      size: 16, color: ext.textMuted),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      l10n.text('booking.readyBySortingDisclaimer'),
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: ext.textMuted),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}
