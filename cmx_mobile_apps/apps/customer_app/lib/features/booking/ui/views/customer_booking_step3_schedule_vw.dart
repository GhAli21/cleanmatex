import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../providers/customer_order_booking_provider.dart';
import '../cards/customer_booking_option_card.dart';
import '../widgets/customer_booking_address_form_widget.dart';
import '../widgets/customer_booking_step_header_widget.dart';

class CustomerBookingStep3ScheduleVw extends ConsumerStatefulWidget {
  const CustomerBookingStep3ScheduleVw({super.key});

  @override
  ConsumerState<CustomerBookingStep3ScheduleVw> createState() =>
      _CustomerBookingStep3ScheduleVwState();
}

class _CustomerBookingStep3ScheduleVwState
    extends ConsumerState<CustomerBookingStep3ScheduleVw> {
  bool _showAddressForm = false;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final booking = ref.watch(customerOrderBookingProvider);
    final notifier = ref.read(customerOrderBookingProvider.notifier);
    final theme = Theme.of(context);

    // Collapse form automatically when a new address has been saved
    // (detected by isSavingAddress flipping back to false with new address selected)
    ref.listen(
      customerOrderBookingProvider.select(
        (s) => (s.isSavingAddress, s.draft.address?.id),
      ),
      (previous, next) {
        if (previous?.$1 == true && next.$1 == false && next.$2 != null) {
          setState(() => _showAddressForm = false);
        }
      },
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CustomerBookingStepHeaderWidget(
          title: localizations.text('booking.step3Title'),
          description: localizations.text('booking.step3Description'),
        ),
        const SizedBox(height: AppSpacing.lg),
        // Handoff mode selection
        _HandoffOptionCard(
          title: localizations.text('booking.bringInOption'),
          description: localizations.text('booking.bringInBody'),
          isSelected: !booking.draft.isPickupFromAddress,
          onTap: () {
            notifier.setIsPickupFromAddress(false);
            setState(() => _showAddressForm = false);
          },
        ),
        const SizedBox(height: AppSpacing.sm),
        _HandoffOptionCard(
          title: localizations.text('booking.pickupFromAddressOption'),
          description: localizations.text('booking.pickupFromAddressBody'),
          isSelected: booking.draft.isPickupFromAddress,
          onTap: () => notifier.setIsPickupFromAddress(true),
        ),
        // Pickup sub-panel
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          child: booking.draft.isPickupFromAddress
              ? _buildPickupSubPanel(
                  context,
                  localizations,
                  booking,
                  notifier,
                  theme,
                )
              : const SizedBox.shrink(),
        ),
      ],
    );
  }

  Widget _buildPickupSubPanel(
    BuildContext context,
    AppLocalizations localizations,
    BookingState booking,
    CustomerOrderBookingNotifier notifier,
    ThemeData theme,
  ) {
    return Column(
      key: const ValueKey('pickup-subpanel'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: AppSpacing.lg),
        Text(
          localizations.text('booking.scheduledAtLabel'),
          style: theme.textTheme.titleMedium,
        ),
        const SizedBox(height: AppSpacing.sm),
        // ASAP option
        CustomerBookingOptionCard(
          title: localizations.text('booking.asapOption'),
          description: localizations.text('booking.asapBody'),
          trailingLabel: '',
          isSelected: booking.draft.isAsap,
          onTap: () => notifier.setIsAsap(true),
        ),
        const SizedBox(height: AppSpacing.sm),
        // Scheduled option
        CustomerBookingOptionCard(
          title: localizations.text('booking.scheduledOption'),
          description: localizations.text('booking.scheduledBody'),
          trailingLabel: '',
          isSelected: !booking.draft.isAsap,
          onTap: () => notifier.setIsAsap(false),
        ),
        // Date/time picker — only when scheduled
        if (!booking.draft.isAsap) ...[
          const SizedBox(height: AppSpacing.sm),
          AppDateTimePickerWidget(
            initialValue: booking.draft.scheduledAt,
            minDate: DateTime.now(),
            onChanged: notifier.setScheduledAt,
            label: localizations.text('booking.scheduledAtLabel'),
            placeholder: localizations.text('booking.scheduledAtPlaceholder'),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        Text(
          localizations.text('booking.savedAddressesTitle'),
          style: theme.textTheme.titleMedium,
        ),
        const SizedBox(height: AppSpacing.sm),
        // Address list
        if (booking.addresses.isEmpty)
          AppCardWidget(
            child: Text(
              localizations.text('booking.addressesEmptyBody'),
              style: theme.textTheme.bodyLarge,
            ),
          )
        else
          ...booking.addresses.map(
            (address) => Padding(
              padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
              child: CustomerBookingOptionCard(
                title: address.label,
                description: address.description,
                trailingLabel: address.isDefault
                    ? localizations.text('booking.addressDefaultLabel')
                    : localizations.text('booking.addressLabel'),
                isSelected: booking.draft.address?.id == address.id,
                onTap: () => notifier.chooseAddress(address),
              ),
            ),
          ),
        // Add new address expansion
        const SizedBox(height: AppSpacing.sm),
        _AddNewAddressTile(
          isExpanded: _showAddressForm,
          onToggle: () => setState(() => _showAddressForm = !_showAddressForm),
          localizations: localizations,
        ),
        if (_showAddressForm) ...[
          const SizedBox(height: AppSpacing.sm),
          AppCardWidget(
            child: const CustomerBookingAddressFormWidget(),
          ),
        ],
      ],
    );
  }
}

class _HandoffOptionCard extends StatelessWidget {
  const _HandoffOptionCard({
    required this.title,
    required this.description,
    required this.isSelected,
    required this.onTap,
  });

  final String title;
  final String description;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Semantics(
      button: true,
      selected: isSelected,
      label: '$title. $description',
      child: AppCardWidget(
        accentColor: isSelected ? AppColors.primary : null,
        child: InkWell(
          onTap: onTap,
          child: Row(
            children: [
              Icon(
                isSelected
                    ? Icons.radio_button_checked
                    : Icons.radio_button_unchecked,
                color:
                    isSelected ? AppColors.primary : AppColors.textMuted,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: theme.textTheme.titleMedium),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      description,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AddNewAddressTile extends StatelessWidget {
  const _AddNewAddressTile({
    required this.isExpanded,
    required this.onToggle,
    required this.localizations,
  });

  final bool isExpanded;
  final VoidCallback onToggle;
  final AppLocalizations localizations;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: localizations.text('booking.addNewAddressAction'),
      child: AppCardWidget(
        child: InkWell(
          onTap: onToggle,
          child: Row(
            children: [
              Icon(
                isExpanded ? Icons.remove_circle_outline : Icons.add_circle_outline,
                color: AppColors.primary,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  localizations.text('booking.addNewAddressAction'),
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: AppColors.primary,
                      ),
                ),
              ),
              Icon(
                isExpanded ? Icons.expand_less : Icons.expand_more,
                color: AppColors.textMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
