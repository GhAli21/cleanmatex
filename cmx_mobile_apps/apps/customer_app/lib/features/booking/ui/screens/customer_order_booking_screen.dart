import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/navigation/app_route.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';
import '../../domain/booking_total_format.dart';
import '../../providers/customer_order_booking_provider.dart';
import '../views/customer_booking_step0_fulfillment_vw.dart';
import '../views/customer_booking_step1_items_vw.dart';
import '../views/customer_booking_step2_preferences_vw.dart';
import '../views/customer_booking_step3_schedule_vw.dart';
import '../views/customer_booking_step4_offers_notes_vw.dart';
import '../views/customer_booking_step5_pos_review_vw.dart';

/// 6-step POS-parity Detailed Order Booking Wizard:
/// 1. Mandatory Fulfillment & Branch
/// 2. Select Items + optional per-piece prefs (extra price) + per-item notes
/// 3. Predefined Profile Preferences + master toggle + preferences notes
/// 4. Schedule & Speed + Estimated Ready-By + sorting disclaimer
/// 5. Promo Code, Gift Card, Payment Notes & General Order Note (save default)
/// 6. Full POS-Parity Server-Priced Review
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
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

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
          child: booking.isLoading
              ? ListView(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  children: const [
                    AppSkeletonWidget(height: 24, width: 220),
                    SizedBox(height: AppSpacing.md),
                    AppSkeletonWidget(height: 120),
                    SizedBox(height: AppSpacing.md),
                    AppSkeletonWidget(height: 120),
                  ],
                )
              : booking.hasLoadError
                  ? ListView(
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      children: [
                        _buildLoadErrorState(localizations, booking, notifier),
                      ],
                    )
                  : !booking.isBookingEnabled
                      ? ListView(
                          padding: const EdgeInsets.all(AppSpacing.lg),
                          children: [
                            _buildDisabledState(localizations, booking),
                          ],
                        )
                      : booking.hasSubmissionSuccess
                          ? ListView(
                              padding: const EdgeInsets.all(AppSpacing.lg),
                              children: [
                                _buildSuccessState(localizations, booking),
                              ],
                            )
                          : Column(
                              children: [
                                // 6-Step Progress Bar
                                Padding(
                                  padding: const EdgeInsetsDirectional.fromSTEB(
                                    AppSpacing.lg,
                                    AppSpacing.md,
                                    AppSpacing.lg,
                                    AppSpacing.sm,
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              localizations.textWithArgs(
                                                'booking.stepOfTotal',
                                                {
                                                  'current':
                                                      '${booking.stepIndex + 1}',
                                                  'total':
                                                      '${BookingState.totalSteps}',
                                                },
                                              ),
                                              style: theme.textTheme.labelLarge
                                                  ?.copyWith(
                                                color: ext.brandText,
                                              ),
                                            ),
                                          ),
                                          if (booking.hasCartItems)
                                            AppMoneyTextWidget(
                                              amount: booking.estimatedTotal,
                                              currencyCode:
                                                  booking.currencyCode,
                                              style: theme.textTheme.labelLarge
                                                  ?.copyWith(
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                        ],
                                      ),
                                      const SizedBox(height: AppSpacing.xs),
                                      Row(
                                        children: [
                                          for (var i = 0;
                                              i < BookingState.totalSteps;
                                              i++) ...[
                                            Expanded(
                                              child: Container(
                                                height: 4,
                                                decoration: BoxDecoration(
                                                  color: i <= booking.stepIndex
                                                      ? theme
                                                          .colorScheme.primary
                                                      : ext.border,
                                                  borderRadius:
                                                      BorderRadius.circular(
                                                    AppRadii.pill,
                                                  ),
                                                ),
                                              ),
                                            ),
                                            if (i < BookingState.totalSteps - 1)
                                              const SizedBox(width: 4),
                                          ],
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                Expanded(
                                  child: ListView(
                                    padding:
                                        const EdgeInsetsDirectional.fromSTEB(
                                      AppSpacing.lg,
                                      AppSpacing.sm,
                                      AppSpacing.lg,
                                      AppSpacing.xxl,
                                    ),
                                    children: [
                                      ..._buildStepContent(booking),
                                      if (booking.errorMessageKey != null &&
                                          !booking.hasLoadError &&
                                          !booking.hasSubmissionSuccess) ...[
                                        const SizedBox(height: AppSpacing.lg),
                                        _buildInlineErrorState(
                                          localizations,
                                          booking,
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                // Sticky Action Dock
                                Container(
                                  padding: const EdgeInsetsDirectional.fromSTEB(
                                    AppSpacing.lg,
                                    AppSpacing.md,
                                    AppSpacing.lg,
                                    AppSpacing.md,
                                  ),
                                  decoration: BoxDecoration(
                                    color: theme.colorScheme.surface,
                                    border: Border(
                                      top: BorderSide(color: ext.border),
                                    ),
                                  ),
                                  child: _buildActionRow(
                                    localizations: localizations,
                                    booking: booking,
                                    notifier: notifier,
                                  ),
                                ),
                              ],
                            ),
        ),
      ),
    );
  }

  List<Widget> _buildStepContent(BookingState booking) {
    switch (booking.stepIndex) {
      case 0:
        return const [CustomerBookingStep0FulfillmentVw()];
      case 1:
        return const [CustomerBookingStep1ItemsVw()];
      case 2:
        return const [CustomerBookingStep2PreferencesVw()];
      case 3:
        return const [CustomerBookingStep3ScheduleVw()];
      case 4:
        return const [CustomerBookingStep4OffersNotesVw()];
      default:
        return const [CustomerBookingStep5PosReviewVw()];
    }
  }

  Widget _buildLoadErrorState(
    AppLocalizations localizations,
    BookingState booking,
    CustomerOrderBookingNotifier notifier,
  ) {
    return AppErrorWidget(
      title: localizations.text('booking.errorTitle'),
      message: localizations.text(booking.errorMessageKey!),
      retryLabel: localizations.text('booking.retryAction'),
      onRetry: notifier.load,
    );
  }

  Widget _buildSuccessState(
    AppLocalizations localizations,
    BookingState booking,
  ) {
    final total = formatBookingTotal(
      amount: booking.submittedTotalAmount,
      currencyCode: booking.submittedCurrencyCode,
      localeTag: Localizations.localeOf(context).toLanguageTag(),
    );
    return AppCardWidget(
      accentColor: AppColors.success,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.check_circle_rounded,
              size: 44, color: AppColors.success),
          const SizedBox(height: AppSpacing.md),
          Text(
            localizations.text('booking.successTitle'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.sm),
          AppCodeChipWidget(
            code: ltrCode(booking.submittedOrderNumber ?? ''),
            copiedFeedbackMessage:
                localizations.text('common.copiedToClipboard'),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            localizations.textWithArg(
              'booking.successBody',
              ltrCode(booking.submittedOrderNumber ?? ''),
            ),
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          if (total != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              localizations
                  .textWithArgs('booking.successTotal', {'amount': total}),
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ],
          if ((booking.submittedPromisedWindow ?? '').isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              localizations.textWithArgs('booking.successReadyBy', {
                'value':
                    _formatReadyBy(context, booking.submittedPromisedWindow!),
              }),
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: double.infinity,
            child: AppCustomButtonWidget(
              label: localizations.text('booking.viewOrdersAction'),
              onPressed: () {
                Navigator.of(context).pushNamedAndRemoveUntil(
                  AppRoute.home,
                  (route) => false,
                );
              },
            ),
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

  Widget _buildInlineErrorState(
    AppLocalizations localizations,
    BookingState booking,
  ) {
    final theme = Theme.of(context);
    return AppCardWidget(
      accentColor: AppColors.error,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            localizations.text(booking.errorMessageKey!),
            style: theme.textTheme.bodyLarge,
          ),
          if (booking.validationIssueKeys.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              localizations.text('booking.missingDetailsTitle'),
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.xs),
            ...booking.validationIssueKeys.map(
              (issueKey) => Padding(
                padding: const EdgeInsetsDirectional.only(top: AppSpacing.xs),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('- '),
                    Expanded(
                      child: Text(
                        localizations.text(issueKey),
                        style: theme.textTheme.bodyMedium,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildActionRow({
    required AppLocalizations localizations,
    required BookingState booking,
    required CustomerOrderBookingNotifier notifier,
  }) {
    final isFinalStep = booking.stepIndex == BookingState.reviewStepIndex;
    return Row(
      children: [
        if (booking.stepIndex > 0) ...[
          Expanded(
            child: AppCustomButtonWidget(
              label: localizations.text('common.back'),
              onPressed: booking.isSubmitting ? null : notifier.goBack,
              isPrimary: false,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
        ],
        Expanded(
          flex: 2,
          child: AppCustomButtonWidget(
            label: isFinalStep
                ? localizations.text('booking.submitAction')
                : localizations.text('booking.nextAction'),
            onPressed: isFinalStep
                ? (booking.isSubmitting ? null : notifier.submit)
                : (notifier.canProceed() ? notifier.goNext : null),
            isLoading: booking.isSubmitting,
          ),
        ),
      ],
    );
  }
}

String _formatReadyBy(BuildContext context, String promised) {
  final instant = DateTime.tryParse(promised);
  if (instant == null) return promised;
  final localeTag = Localizations.localeOf(context).toLanguageTag();
  return DateFormat.yMMMEd(localeTag).add_jm().format(instant.toLocal());
}
