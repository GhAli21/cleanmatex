import 'package:flutter/material.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';
import '../../providers/customer_order_booking_provider.dart';
import '../cards/customer_booking_option_card.dart';

class CustomerOrderBookingScreen extends StatefulWidget {
  const CustomerOrderBookingScreen({
    super.key,
    this.provider,
  });

  final CustomerOrderBookingProvider? provider;

  @override
  State<CustomerOrderBookingScreen> createState() =>
      _CustomerOrderBookingScreenState();
}

class _CustomerOrderBookingScreenState
    extends State<CustomerOrderBookingScreen> {
  CustomerOrderBookingProvider? _provider;
  late final TextEditingController _notesController;
  bool _didStartLoad = false;

  @override
  void initState() {
    super.initState();
    _notesController = TextEditingController();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_provider != null) {
      return;
    }

    if (widget.provider != null) {
      _provider = widget.provider;
    } else {
      final controller = CustomerAppScope.of(context);
      _provider = CustomerOrderBookingProvider(session: controller.session);
    }

    if (!_didStartLoad) {
      _didStartLoad = true;
      _provider!.load();
    }
  }

  @override
  void dispose() {
    if (widget.provider == null) {
      _provider?.dispose();
    }
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final provider = _provider;

    if (provider == null) {
      return const SizedBox.shrink();
    }

    return AnimatedBuilder(
      animation: provider,
      builder: (context, _) {
        return PopScope(
          canPop: !provider.isDirty || provider.hasSubmissionSuccess,
          onPopInvokedWithResult: (didPop, _) async {
            if (didPop || !provider.isDirty || provider.hasSubmissionSuccess) {
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
                  if (provider.isLoading)
                    AppLoadingIndicator(
                      label: localizations.text('booking.loading'),
                    )
                  else if (provider.hasLoadError)
                    _buildLoadErrorState(localizations)
                  else ...[
                    Text(
                      localizations.textWithArg(
                        'booking.stepLabel',
                        (provider.stepIndex + 1).toString(),
                      ),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    ..._buildStepContent(localizations),
                    const SizedBox(height: AppSpacing.lg),
                    if (provider.errorMessageKey != null &&
                        !provider.hasLoadError &&
                        !provider.hasSubmissionSuccess)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                        child: AppCardWidget(
                          child: Text(
                            localizations.text(provider.errorMessageKey!),
                            style: Theme.of(context).textTheme.bodyLarge,
                          ),
                        ),
                      ),
                    if (provider.hasSubmissionSuccess)
                      _buildSuccessState(localizations)
                    else
                      _buildActionRow(localizations),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildLoadErrorState(AppLocalizations localizations) {
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
            localizations.text(_provider!.errorMessageKey!),
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: AppSpacing.lg),
          AppCustomButtonWidget(
            label: localizations.text('booking.retryAction'),
            onPressed: _provider!.load,
          ),
        ],
      ),
    );
  }

  Widget _buildSuccessState(AppLocalizations localizations) {
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
              _provider!.submittedOrderNumber ?? '',
            ),
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          if ((_provider!.submittedPromisedWindow ?? '').isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              _provider!.submittedPromisedWindow!,
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

  Widget _buildActionRow(AppLocalizations localizations) {
    return Row(
      children: [
        if (_provider!.stepIndex > 0)
          Expanded(
            child: AppCustomButtonWidget(
              label: localizations.text('common.back'),
              onPressed: _provider!.goBack,
              isPrimary: false,
            ),
          ),
        if (_provider!.stepIndex > 0) const SizedBox(width: AppSpacing.md),
        Expanded(
          child: AppCustomButtonWidget(
            label: _provider!.stepIndex == 3
                ? localizations.text('booking.submitAction')
                : localizations.text('booking.nextAction'),
            onPressed: _provider!.stepIndex == 3
                ? (_provider!.isSubmitting ? null : _provider!.submit)
                : (_provider!.canProceed() ? _provider!.goNext : null),
            isLoading: _provider!.isSubmitting,
          ),
        ),
      ],
    );
  }

  List<Widget> _buildStepContent(AppLocalizations localizations) {
    switch (_provider!.stepIndex) {
      case 0:
        if (_provider!.services.isEmpty) {
          return [
            _buildEmptyState(
              title: localizations.text('booking.servicesEmptyTitle'),
              body: localizations.text('booking.servicesEmptyBody'),
            ),
          ];
        }

        return _provider!.services
            .map(
              (service) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.lg),
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
                  isSelected: _provider!.draft.service?.id == service.id,
                  onTap: () => _provider!.chooseService(service),
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
            isSelected: _provider!.fulfillmentType == 'pickup',
            onTap: () => _provider!.updateFulfillmentType('pickup'),
          ),
          const SizedBox(height: AppSpacing.lg),
          CustomerBookingOptionCard(
            title: localizations.text('booking.fulfillmentDelivery'),
            description: localizations.text('booking.fulfillmentDeliveryBody'),
            trailingLabel: localizations.text('booking.fulfillmentLabel'),
            isSelected: _provider!.fulfillmentType == 'delivery',
            onTap: () => _provider!.updateFulfillmentType('delivery'),
          ),
          const SizedBox(height: AppSpacing.lg),
          if (_provider!.addresses.isEmpty)
            _buildEmptyState(
              title: localizations.text('booking.addressesEmptyTitle'),
              body: localizations.text('booking.addressesEmptyBody'),
            )
          else
            ..._provider!.addresses.map(
              (address) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                child: CustomerBookingOptionCard(
                  title: address.label,
                  description: address.description,
                  trailingLabel: address.isDefault
                      ? localizations.text('booking.addressDefaultLabel')
                      : localizations.text('booking.addressLabel'),
                  isSelected: _provider!.draft.address?.id == address.id,
                  onTap: () => _provider!.chooseAddress(address),
                ),
              ),
            ),
        ];
      case 2:
        return _provider!.slots
            .map(
              (slot) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                child: CustomerBookingOptionCard(
                  title: _localizedValue(
                    primary: slot.label,
                    secondary: slot.label2,
                    localizations: localizations,
                  ),
                  description: localizations.text('booking.slotDescription'),
                  trailingLabel: localizations.text('booking.slotLabel'),
                  isSelected: _provider!.draft.slot?.id == slot.id,
                  onTap: () => _provider!.chooseSlot(slot),
                ),
              ),
            )
            .toList();
      default:
        _notesController.value = TextEditingValue(text: _provider!.draft.notes);
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
                      primary: _provider!.draft.service?.title ?? '-',
                      secondary: _provider!.draft.service?.title2,
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
                      _provider!.fulfillmentType == 'delivery'
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
                    _provider!.draft.address?.label ?? '-',
                  ),
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  localizations.textWithArg(
                    'booking.reviewSlotValue',
                    _localizedValue(
                      primary: _provider!.draft.slot?.label ?? '-',
                      secondary: _provider!.draft.slot?.label2,
                      localizations: localizations,
                    ),
                  ),
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: AppSpacing.lg),
                TextField(
                  controller: _notesController,
                  onChanged: _provider!.updateNotes,
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
