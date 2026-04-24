import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/navigation/app_route.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';
import '../../providers/customer_order_booking_provider.dart';
import '../views/customer_booking_step1_items_vw.dart';
import '../views/customer_booking_step2_preferences_vw.dart';
import '../views/customer_booking_step3_schedule_vw.dart';
import '../views/customer_booking_step4_review_vw.dart';

class CustomerOrderBookingScreen extends ConsumerStatefulWidget {
  const CustomerOrderBookingScreen({super.key});

  @override
  ConsumerState<CustomerOrderBookingScreen> createState() =>
      _CustomerOrderBookingScreenState();
}

class _CustomerOrderBookingScreenState
    extends ConsumerState<CustomerOrderBookingScreen> {
  bool _scheduledInitialLoad = false;

  @override
  void initState() {
    super.initState();
    AppLogger.info('booking_screen.opened');
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_scheduledInitialLoad) return;
    _scheduledInitialLoad = true;
    AppLogger.info('booking_screen.initial_load_scheduled');
    // Fresh wizard for each visit — global notifier keeps success state otherwise.
    ref.invalidate(customerOrderBookingProvider);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(customerOrderBookingProvider.notifier).load();
    });
  }

  @override
  void dispose() {
    AppLogger.info('booking_screen.disposed');
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
        if (didPop || !booking.isDirty || booking.hasSubmissionSuccess) return;

        final shouldLeave = await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
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
          ),
        );

        if (shouldLeave == true && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(localizations.text('booking.title')),
          actions: const [CustomerLocaleSwitchWidget()],
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
              else if (!booking.isBookingEnabled)
                _buildDisabledState(localizations, booking)
              else ...[
                Text(
                  localizations.textWithArg(
                    'booking.stepLabel',
                    (booking.stepIndex + 1).toString(),
                  ),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.lg),
                ..._buildStepContent(booking),
                const SizedBox(height: AppSpacing.lg),
                if (booking.errorMessageKey != null &&
                    !booking.hasLoadError &&
                    !booking.hasSubmissionSuccess)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(
                        bottom: AppSpacing.lg),
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

  List<Widget> _buildStepContent(BookingState booking) {
    switch (booking.stepIndex) {
      case 0:
        return [const CustomerBookingStep1ItemsVw()];
      case 1:
        return [const CustomerBookingStep2PreferencesVw()];
      case 2:
        return [const CustomerBookingStep3ScheduleVw()];
      default:
        return [const CustomerBookingStep4ReviewVw()];
    }
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
      accentColor: AppColors.success,
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

  Widget _buildDisabledState(
    AppLocalizations localizations,
    BookingState booking,
  ) {
    final disabledBodyKey = booking.disabledReasonKey ?? 'booking.disabledBody';
    return AppCardWidget(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            localizations.text('booking.disabledTitle'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            localizations.text(disabledBodyKey),
            style: Theme.of(context).textTheme.bodyLarge,
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
        if (booking.stepIndex > 0) ...[
          Expanded(
            child: AppCustomButtonWidget(
              label: localizations.text('common.back'),
              onPressed: notifier.goBack,
              isPrimary: false,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
        ],
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
}
