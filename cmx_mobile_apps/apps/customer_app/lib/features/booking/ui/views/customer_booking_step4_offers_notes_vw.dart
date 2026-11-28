import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../providers/customer_order_booking_provider.dart';
import '../widgets/customer_booking_step_header_widget.dart';

/// Step 5/6 of Detailed Order: Promo Code, Gift Card, Payment Notes, and
/// General Order Note with "Save for all upcoming orders" toggle.
class CustomerBookingStep4OffersNotesVw extends ConsumerStatefulWidget {
  const CustomerBookingStep4OffersNotesVw({super.key});

  @override
  ConsumerState<CustomerBookingStep4OffersNotesVw> createState() =>
      _CustomerBookingStep4OffersNotesVwState();
}

class _CustomerBookingStep4OffersNotesVwState
    extends ConsumerState<CustomerBookingStep4OffersNotesVw> {
  late final TextEditingController _promoController;
  late final TextEditingController _giftCardController;
  late final TextEditingController _paymentNotesController;
  late final TextEditingController _generalNoteController;

  @override
  void initState() {
    super.initState();
    final draft = ref.read(customerOrderBookingProvider).draft;
    _promoController = TextEditingController(text: draft.promoCode);
    _giftCardController = TextEditingController(text: draft.giftCardCode);
    _paymentNotesController = TextEditingController(text: draft.paymentNotes);
    _generalNoteController =
        TextEditingController(text: draft.generalOrderNote);
  }

  @override
  void dispose() {
    _promoController.dispose();
    _giftCardController.dispose();
    _paymentNotesController.dispose();
    _generalNoteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final booking = ref.watch(customerOrderBookingProvider);
    final notifier = ref.read(customerOrderBookingProvider.notifier);
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CustomerBookingStepHeaderWidget(
          title: l10n.text('booking.step4OffersTitle'),
          description: l10n.text('booking.step4OffersDescription'),
        ),
        const SizedBox(height: AppSpacing.lg),

        // 1. Promo Code & Gift Card
        AppCardWidget(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.text('booking.offersSectionTitle'),
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _promoController,
                      textCapitalization: TextCapitalization.characters,
                      onChanged: notifier.setPromoCode,
                      decoration: InputDecoration(
                        labelText: l10n.text('booking.promoCodeLabel'),
                        hintText: l10n.text('booking.promoCodeHint'),
                        prefixIcon: const Icon(Icons.local_offer_outlined),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  FilledButton.tonal(
                    onPressed: booking.isLoadingQuote
                        ? null
                        : () {
                            HapticFeedback.lightImpact();
                            notifier.refreshServerQuote();
                          },
                    child: Text(l10n.text('booking.applyCodeAction')),
                  ),
                ],
              ),
              if (booking.serverQuote?.promoApplied == true) ...[
                const SizedBox(height: AppSpacing.xs),
                AppStatusBadgeWidget(
                  label: l10n.text('booking.promoAppliedBadge'),
                  tone: CmxSemanticTone.success,
                  icon: Icons.check_circle_outline,
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _giftCardController,
                      textCapitalization: TextCapitalization.characters,
                      onChanged: notifier.setGiftCardCode,
                      decoration: InputDecoration(
                        labelText: l10n.text('booking.giftCardLabel'),
                        hintText: l10n.text('booking.giftCardHint'),
                        prefixIcon: const Icon(Icons.card_giftcard_outlined),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  FilledButton.tonal(
                    onPressed: booking.isLoadingQuote
                        ? null
                        : () {
                            HapticFeedback.lightImpact();
                            notifier.refreshServerQuote();
                          },
                    child: Text(l10n.text('booking.applyCodeAction')),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: _paymentNotesController,
                onChanged: notifier.setPaymentNotes,
                maxLines: 2,
                decoration: InputDecoration(
                  labelText: l10n.text('booking.paymentNotesLabel'),
                  hintText: l10n.text('booking.paymentNotesHint'),
                  prefixIcon: const Icon(Icons.payments_outlined),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),

        // 2. General Order Note + Save for Future Orders Toggle
        AppCardWidget(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.text('booking.generalOrderNoteTitle'),
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                l10n.text('booking.generalOrderNoteHint'),
                style:
                    theme.textTheme.bodySmall?.copyWith(color: ext.textMuted),
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: _generalNoteController,
                onChanged: notifier.setGeneralOrderNote,
                maxLines: 3,
                maxLength: 500,
                decoration: InputDecoration(
                  labelText: l10n.text('booking.notesLabel'),
                  hintText: l10n.text('booking.notesHint'),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  l10n.text('booking.saveGeneralNoteToggleTitle'),
                  style: theme.textTheme.titleSmall,
                ),
                subtitle: Text(
                  l10n.text('booking.saveGeneralNoteToggleSubtitle'),
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: ext.textMuted),
                ),
                value: booking.draft.saveGeneralNoteForFuture,
                onChanged: (v) {
                  HapticFeedback.selectionClick();
                  notifier.setSaveGeneralNoteForFuture(v);
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}
