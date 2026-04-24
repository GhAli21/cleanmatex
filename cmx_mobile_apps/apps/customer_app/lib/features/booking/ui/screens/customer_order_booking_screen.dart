import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/navigation/app_route.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';
import '../../providers/customer_order_booking_provider.dart';
import '../cards/customer_booking_option_card.dart';

class CustomerOrderBookingScreen extends ConsumerStatefulWidget {
  const CustomerOrderBookingScreen({super.key});

  @override
  ConsumerState<CustomerOrderBookingScreen> createState() =>
      _CustomerOrderBookingScreenState();
}

class _CustomerOrderBookingScreenState
    extends ConsumerState<CustomerOrderBookingScreen> {
  late final TextEditingController _notesController;
  bool _scheduledInitialLoad = false;

  @override
  void initState() {
    super.initState();
    _notesController = TextEditingController();
    AppLogger.info('booking_screen.opened');
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_scheduledInitialLoad) {
      return;
    }
    _scheduledInitialLoad = true;
    AppLogger.info('booking_screen.initial_load_scheduled');
    // Fresh wizard for each visit — global notifier would otherwise keep success state.
    ref.invalidate(customerOrderBookingProvider);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      ref.read(customerOrderBookingProvider.notifier).load();
    });
  }

  @override
  void dispose() {
    AppLogger.info('booking_screen.disposed');
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final booking = ref.watch(customerOrderBookingProvider);
    final notifier = ref.read(customerOrderBookingProvider.notifier);

    return PopScope(
      canPop: !booking.isDirty || booking.hasSubmissionSuccess,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop || !booking.isDirty || booking.hasSubmissionSuccess) {
          return;
        }

        final shouldLeave = await showDialog<bool>(
          context: context,
          builder: (dialogContext) {
            return AlertDialog(
              title: Text(localizations.text('booking.discardTitle')),
              content: Text(localizations.text('booking.discardBody')),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(false),
                  child: Text(localizations.text('booking.discardStay')),
                ),
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(true),
                  child: Text(localizations.text('booking.discardLeave')),
                ),
              ],
            );
          },
        );

        if (shouldLeave == true && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(localizations.text('booking.title')),
          actions: const [
            CustomerLocaleSwitchWidget(),
          ],
        ),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              AppHeaderWidget(
                title: localizations.text('booking.title'),
                subtitle: localizations.text('booking.subtitle'),
              ),
              const SizedBox(height: AppSpacing.lg),
              if (booking.isLoading)
                AppLoadingIndicator(
                  label: localizations.text('booking.loading'),
                )
              else if (booking.hasLoadError)
                _buildLoadErrorState(localizations, booking, notifier)
              else ...[
                Text(
                  localizations.textWithArg(
                    'booking.stepLabel',
                    (booking.stepIndex + 1).toString(),
                  ),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.lg),
                ..._buildStepContent(
                  localizations: localizations,
                  booking: booking,
                  notifier: notifier,
                ),
                const SizedBox(height: AppSpacing.lg),
                if (booking.errorMessageKey != null &&
                    !booking.hasLoadError &&
                    !booking.hasSubmissionSuccess)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.lg),
                    child: AppCardWidget(
                      child: Text(
                        localizations.text(booking.errorMessageKey!),
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                    ),
                  ),
                if (booking.hasSubmissionSuccess)
                  _buildSuccessState(localizations, booking)
                else
                  _buildActionRow(
                    localizations: localizations,
                    booking: booking,
                    notifier: notifier,
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLoadErrorState(
    AppLocalizations localizations,
    BookingState booking,
    CustomerOrderBookingNotifier notifier,
  ) {
    return AppCardWidget(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            localizations.text('booking.errorTitle'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            localizations.text(booking.errorMessageKey!),
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: AppSpacing.lg),
          AppCustomButtonWidget(
            label: localizations.text('booking.retryAction'),
            onPressed: notifier.load,
          ),
        ],
      ),
    );
  }

  Widget _buildSuccessState(
    AppLocalizations localizations,
    BookingState booking,
  ) {
    return AppCardWidget(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            localizations.text('booking.successTitle'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            localizations.textWithArg(
              'booking.successBody',
              booking.submittedOrderNumber ?? '',
            ),
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          if ((booking.submittedPromisedWindow ?? '').isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              booking.submittedPromisedWindow!,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          AppCustomButtonWidget(
            label: localizations.text('booking.viewOrdersAction'),
            onPressed: () {
              Navigator.of(context).pushNamedAndRemoveUntil(
                AppRoute.orders,
                (route) => route.settings.name == AppRoute.home,
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildActionRow({
    required AppLocalizations localizations,
    required BookingState booking,
    required CustomerOrderBookingNotifier notifier,
  }) {
    return Row(
      children: [
        if (booking.stepIndex > 0)
          Expanded(
            child: AppCustomButtonWidget(
              label: localizations.text('common.back'),
              onPressed: notifier.goBack,
              isPrimary: false,
            ),
          ),
        if (booking.stepIndex > 0) const SizedBox(width: AppSpacing.md),
        Expanded(
          child: AppCustomButtonWidget(
            label: booking.stepIndex == 3
                ? localizations.text('booking.submitAction')
                : localizations.text('booking.nextAction'),
            onPressed: booking.stepIndex == 3
                ? (booking.isSubmitting ? null : notifier.submit)
                : (notifier.canProceed() ? notifier.goNext : null),
            isLoading: booking.isSubmitting,
          ),
        ),
      ],
    );
  }

  List<Widget> _buildStepContent({
    required AppLocalizations localizations,
    required BookingState booking,
    required CustomerOrderBookingNotifier notifier,
  }) {
    switch (booking.stepIndex) {
      case 0:
        if (booking.services.isEmpty) {
          return [
            _buildEmptyState(
              title: localizations.text('booking.servicesEmptyTitle'),
              body: localizations.text('booking.servicesEmptyBody'),
            ),
          ];
        }

        return booking.services
            .map(
              (service) => Padding(
                padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.lg),
                child: CustomerBookingOptionCard(
                  title: _localizedValue(
                    primary: service.title,
                    secondary: service.title2,
                    localizations: localizations,
                  ),
                  description: _localizedValue(
                    primary: service.description,
                    secondary: service.description2,
                    localizations: localizations,
                  ),
                  trailingLabel: _localizedValue(
                    primary: service.priceLabel,
                    secondary: service.priceLabel2,
                    localizations: localizations,
                  ),
                  isSelected: booking.draft.service?.id == service.id,
                  onTap: () => notifier.chooseService(service),
                ),
              ),
            )
            .toList();
      case 1:
        return [
          AppCardWidget(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  localizations.text('booking.fulfillmentTitle'),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  localizations.text('booking.fulfillmentBody'),
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          CustomerBookingOptionCard(
            title: localizations.text('booking.fulfillmentPickup'),
            description: localizations.text('booking.fulfillmentPickupBody'),
            trailingLabel: localizations.text('booking.fulfillmentLabel'),
            isSelected: booking.fulfillmentType == 'pickup',
            onTap: () => notifier.updateFulfillmentType('pickup'),
          ),
          const SizedBox(height: AppSpacing.lg),
          CustomerBookingOptionCard(
            title: localizations.text('booking.fulfillmentDelivery'),
            description: localizations.text('booking.fulfillmentDeliveryBody'),
            trailingLabel: localizations.text('booking.fulfillmentLabel'),
            isSelected: booking.fulfillmentType == 'delivery',
            onTap: () => notifier.updateFulfillmentType('delivery'),
          ),
          const SizedBox(height: AppSpacing.lg),
          if (booking.addresses.isEmpty)
            _buildEmptyState(
              title: localizations.text('booking.addressesEmptyTitle'),
              body: localizations.text('booking.addressesEmptyBody'),
            )
          else
            ...booking.addresses.map(
              (address) => Padding(
                padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.lg),
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
        ];
      case 2:
        if (booking.slots.isEmpty) {
          return [
            _buildEmptyState(
              title: localizations.text('booking.slotsEmptyTitle'),
              body: localizations.text('booking.slotsEmptyBody'),
            ),
          ];
        }
        return booking.slots
            .map(
              (slot) => Padding(
                padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.lg),
                child: CustomerBookingOptionCard(
                  title: _localizedValue(
                    primary: slot.label,
                    secondary: slot.label2,
                    localizations: localizations,
                  ),
                  description: localizations.text('booking.slotDescription'),
                  trailingLabel: localizations.text('booking.slotLabel'),
                  isSelected: booking.draft.slot?.id == slot.id,
                  onTap: () => notifier.chooseSlot(slot),
                ),
              ),
            )
            .toList();
      default:
        if (_notesController.text != booking.draft.notes) {
          _notesController.value = TextEditingValue(
            text: booking.draft.notes,
            selection: TextSelection.collapsed(
              offset: booking.draft.notes.length,
            ),
          );
        }
        return [
          AppCardWidget(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  localizations.text('booking.reviewTitle'),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  localizations.textWithArg(
                    'booking.reviewServiceValue',
                    _localizedValue(
                      primary: booking.draft.service?.title ?? '-',
                      secondary: booking.draft.service?.title2,
                      localizations: localizations,
                    ),
                  ),
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  localizations.textWithArg(
                    'booking.reviewFulfillmentValue',
                    localizations.text(
                      booking.fulfillmentType == 'delivery'
                          ? 'booking.fulfillmentDelivery'
                          : 'booking.fulfillmentPickup',
                    ),
                  ),
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  localizations.textWithArg(
                    'booking.reviewAddressValue',
                    booking.draft.address?.label ?? '-',
                  ),
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  localizations.textWithArg(
                    'booking.reviewSlotValue',
                    _localizedValue(
                      primary: booking.draft.slot?.label ?? '-',
                      secondary: booking.draft.slot?.label2,
                      localizations: localizations,
                    ),
                  ),
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: AppSpacing.lg),
                TextField(
                  controller: _notesController,
                  onChanged: notifier.updateNotes,
                  decoration: InputDecoration(
                    labelText: localizations.text('booking.notesLabel'),
                    hintText: localizations.text('booking.notesHint'),
                  ),
                  maxLines: 3,
                ),
              ],
            ),
          ),
        ];
    }
  }

  Widget _buildEmptyState({
    required String title,
    required String body,
  }) {
    return AppCardWidget(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.sm),
          Text(body, style: Theme.of(context).textTheme.bodyLarge),
        ],
      ),
    );
  }

  String _localizedValue({
    required String primary,
    required String? secondary,
    required AppLocalizations localizations,
  }) {
    if (localizations.locale.languageCode == 'ar' &&
        secondary != null &&
        secondary.trim().isNotEmpty) {
      return secondary;
    }

    return primary;
  }
}
