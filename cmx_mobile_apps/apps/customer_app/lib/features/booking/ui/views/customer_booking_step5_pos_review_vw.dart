import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../tenant/providers/tenant_provider.dart';
import '../../providers/customer_order_booking_provider.dart';
import '../widgets/customer_booking_step_header_widget.dart';

/// Step 6/6: Full POS-parity Server-Priced Review mirroring web-admin's
/// `OrderValueBreakdownPanel` (Gross → Discounts → Tax → Total & Balance).
class CustomerBookingStep5PosReviewVw extends ConsumerWidget {
  const CustomerBookingStep5PosReviewVw({super.key});

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

  String _formatDateTime(BuildContext context, DateTime dt) {
    final localeTag = Localizations.localeOf(context).toLanguageTag();
    return DateFormat.yMMMEd(localeTag).add_jm().format(dt.toLocal());
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final booking = ref.watch(customerOrderBookingProvider);
    final notifier = ref.read(customerOrderBookingProvider.notifier);
    final tenant = ref.watch(tenantProvider).valueOrNull;
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    final quote = booking.serverQuote;
    final currency = quote?.currencyCode ?? booking.currencyCode;

    final branch = (tenant?.branches ?? const [])
        .where((b) => b.id == booking.draft.branchId)
        .firstOrNull;
    final branchName = branch != null
        ? _localizedName(l10n, branch.name, branch.name2)
        : '-';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CustomerBookingStepHeaderWidget(
          title: l10n.text('booking.step5ReviewTitle'),
          description: l10n.text('booking.step5ReviewDescription'),
        ),
        if (booking.submitValidationIssueKeys.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          AppCardWidget(
            accentColor: ext.warning.foreground,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.text('booking.missingDetailsTitle'),
                  style: theme.textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.xs),
                for (final issueKey in booking.submitValidationIssueKeys)
                  Padding(
                    padding:
                        const EdgeInsetsDirectional.only(top: AppSpacing.xs),
                    child: Text('• ${l10n.text(issueKey)}'),
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),

        // Card 1 — Branch, 2×2 Fulfillment & Ready-By Promise
        AppCardWidget(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.text('booking.reviewFulfillmentTitle'),
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: AppSpacing.sm),
              _DetailRow(
                label: l10n.text('fulfillment.branchMandatoryTitle'),
                value: branchName,
              ),
              _DetailRow(
                label: l10n.text('fulfillment.pickupSectionTitle'),
                value: booking.draft.pickupMode ==
                        CustomerPickupMode.collectAddress
                    ? '${l10n.text('fulfillment.pickupCollectTitle')} (${booking.draft.address?.label ?? '-'})'
                    : l10n.text('fulfillment.pickupDropoffTitle'),
              ),
              _DetailRow(
                label: l10n.text('fulfillment.deliverySectionTitle'),
                value: booking.draft.deliveryMode ==
                        CustomerDeliveryMode.deliverAddress
                    ? '${l10n.text('fulfillment.deliveryAddressTitle')} (${(booking.draft.deliveryAddress ?? booking.draft.address)?.label ?? '-'})'
                    : l10n.text('fulfillment.deliveryStorePickupTitle'),
              ),
              if (quote?.estimatedReadyByUtc != null) ...[
                const Divider(height: AppSpacing.md),
                Row(
                  children: [
                    Icon(Icons.schedule_rounded,
                        size: 18, color: theme.colorScheme.primary),
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: Text(
                        '${l10n.text('booking.estimatedReadyByLabel')}: '
                        '${_tryFormatIso(context, quote!.estimatedReadyByUtc!)}',
                        style: theme.textTheme.titleSmall,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  l10n.text('booking.readyBySortingDisclaimer'),
                  style:
                      theme.textTheme.bodySmall?.copyWith(color: ext.textMuted),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        // Card 2 — Items, Preferences & Notes
        _buildItemsAndNotesCard(context, l10n, booking, currency, theme, ext),
        const SizedBox(height: AppSpacing.md),

        // Card 3 — Authoritative POS-Parity Server Breakdown
        AppCardWidget(
          accentColor: theme.colorScheme.primary,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      l10n.text('booking.posBreakdownTitle'),
                      style: theme.textTheme.titleMedium,
                    ),
                  ),
                  if (booking.isLoadingQuote)
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  else
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      onPressed: notifier.refreshServerQuote,
                      icon: const Icon(Icons.refresh_rounded, size: 18),
                      tooltip: l10n.text('common.retry'),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              if (booking.isLoadingQuote && quote == null)
                const Column(
                  children: [
                    AppSkeletonWidget(height: 18),
                    SizedBox(height: AppSpacing.xs),
                    AppSkeletonWidget(height: 18),
                    SizedBox(height: AppSpacing.xs),
                    AppSkeletonWidget(height: 24),
                  ],
                )
              else ...[
                // Group A: Gross & Subtotal
                if (quote != null && quote.grossRows.isNotEmpty)
                  for (final row in quote.grossRows)
                    _MoneyLine(
                      label: row.label ?? l10n.text(row.labelKey),
                      amount: row.amount,
                      currencyCode: currency,
                    )
                else
                  _MoneyLine(
                    label: l10n.text('booking.reviewEstSubtotal'),
                    amount: booking.estimatedSubtotal,
                    currencyCode: currency,
                  ),

                // Group B: Discounts / Promo
                if (quote != null && quote.discountRows.isNotEmpty) ...[
                  const Divider(height: AppSpacing.md),
                  for (final row in quote.discountRows)
                    _MoneyLine(
                      label: row.label ?? l10n.text(row.labelKey),
                      amount: -row.amount.abs(),
                      currencyCode: currency,
                      valueColor: ext.success.foreground,
                    ),
                ],

                // Group C: Taxes / VAT
                const Divider(height: AppSpacing.md),
                if (quote != null && quote.taxRows.isNotEmpty)
                  for (final row in quote.taxRows)
                    _MoneyLine(
                      label: row.label ?? l10n.text(row.labelKey),
                      amount: row.amount,
                      currencyCode: currency,
                    )
                else if (booking.estimatedVat > 0)
                  _MoneyLine(
                    label: l10n.textWithArgs(
                      'booking.reviewVat',
                      {'rate': '${(booking.vatRate * 100).round()}'},
                    ),
                    amount: booking.estimatedVat,
                    currencyCode: currency,
                  ),

                if (quote != null && quote.roundingAdjustment.abs() > 0.0001)
                  _MoneyLine(
                    label: l10n.text('booking.roundingLabel'),
                    amount: quote.roundingAdjustment,
                    currencyCode: currency,
                  ),

                const Divider(height: AppSpacing.md),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        l10n.text('booking.serverOrderTotalLabel'),
                        style: theme.textTheme.titleMedium,
                      ),
                    ),
                    AppMoneyTextWidget(
                      amount: quote != null && quote.orderTotal > 0
                          ? quote.orderTotal
                          : booking.estimatedTotal,
                      currencyCode: currency,
                      style: theme.textTheme.titleLarge?.copyWith(
                        color: ext.brandText,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                if (quote != null && quote.giftCardApplied > 0) ...[
                  const SizedBox(height: AppSpacing.xs),
                  _MoneyLine(
                    label: l10n.text('booking.giftCardAppliedLabel'),
                    amount: -quote.giftCardApplied.abs(),
                    currencyCode: currency,
                    valueColor: ext.success.foreground,
                  ),
                ],
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        l10n.text('booking.balanceDueLabel'),
                        style: theme.textTheme.bodyMedium
                            ?.copyWith(color: ext.textMuted),
                      ),
                    ),
                    AppStatusBadgeWidget(
                      label: l10n.text('booking.dueAtCollectionBadge'),
                      tone: CmxSemanticTone.info,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  l10n.text('booking.reviewVatNote'),
                  style:
                      theme.textTheme.bodySmall?.copyWith(color: ext.textMuted),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildItemsAndNotesCard(
    BuildContext context,
    AppLocalizations l10n,
    BookingState booking,
    String currency,
    ThemeData theme,
    CmxStatusThemeExtension ext,
  ) {
    final lineItems = <({String id, String name, int qty, double price})>[];
    for (final cat in booking.categories) {
      for (final item in cat.items) {
        final qty = booking.draft.cartItems[item.id] ?? 0;
        if (qty > 0) {
          lineItems.add((
            id: item.id,
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
          Text(l10n.text('booking.reviewItemsTitle'),
              style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          for (final item in lineItems) ...[
            Row(
              children: [
                Expanded(
                  child: Text('${item.name} × ${item.qty}',
                      style: theme.textTheme.bodyMedium),
                ),
                AppMoneyTextWidget(
                  amount: item.price,
                  currencyCode: currency,
                ),
              ],
            ),
            if ((booking.draft.itemNotes[item.id] ?? '').trim().isNotEmpty)
              Padding(
                padding: const EdgeInsetsDirectional.only(
                  top: 2,
                  bottom: AppSpacing.xs,
                ),
                child: Text(
                  '↳ ${booking.draft.itemNotes[item.id]!.trim()}',
                  style:
                      theme.textTheme.bodySmall?.copyWith(color: ext.textMuted),
                ),
              ),
            const SizedBox(height: AppSpacing.xs),
          ],
          if (booking.draft.applyProfilePrefsToAll) ...[
            const Divider(height: AppSpacing.md),
            _DetailRow(
              label: l10n.text('booking.reviewPrefsTitle'),
              value: l10n.text('booking.profilePrefsAppliedSummary'),
            ),
          ],
          if (booking.draft.preferencesNote.trim().isNotEmpty)
            _DetailRow(
              label: l10n.text('booking.preferencesNoteLabel'),
              value: booking.draft.preferencesNote.trim(),
            ),
          if (booking.draft.generalOrderNote.trim().isNotEmpty)
            _DetailRow(
              label: l10n.text('booking.generalOrderNoteTitle'),
              value: booking.draft.generalOrderNote.trim(),
            ),
          if (booking.draft.paymentNotes.trim().isNotEmpty)
            _DetailRow(
              label: l10n.text('booking.paymentNotesLabel'),
              value: booking.draft.paymentNotes.trim(),
            ),
        ],
      ),
    );
  }

  String _tryFormatIso(BuildContext context, String raw) {
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw;
    return _formatDateTime(context, parsed);
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(color: ext.textMuted),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: theme.textTheme.bodyMedium
                  ?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _MoneyLine extends StatelessWidget {
  const _MoneyLine({
    required this.label,
    required this.amount,
    required this.currencyCode,
    this.valueColor,
  });

  final String label;
  final double amount;
  final String currencyCode;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: theme.textTheme.bodyMedium?.copyWith(color: ext.textMuted),
            ),
          ),
          AppMoneyTextWidget(
            amount: amount,
            currencyCode: currencyCode,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: valueColor,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
