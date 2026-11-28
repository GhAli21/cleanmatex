import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../providers/customer_receipts_provider.dart';

/// Opens the Always-Light digital VAT receipt modal sheet.
/// Wraps the receipt paper in [AppTheme.paperLight] so fiscal paper remains
/// crisp white with dark ink even when the app is in Dark Mode.
Future<void> showCustomerAlwaysLightReceiptSheet(
  BuildContext context, {
  required String orderNo,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _AlwaysLightReceiptSheet(orderNo: orderNo),
  );
}

class _AlwaysLightReceiptSheet extends ConsumerWidget {
  const _AlwaysLightReceiptSheet({required this.orderNo});

  final String orderNo;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context);
    final receiptAsync = ref.watch(customerReceiptDetailProvider(orderNo));

    // Mandatory Always-Light paper surface regardless of active app ThemeMode.
    return Theme(
      data: AppTheme.paperLight(locale: locale),
      child: Builder(
        builder: (paperContext) {
          final theme = Theme.of(paperContext);
          return AppBottomSheetShellWidget(
            title: l10n.text('receipts.paperTitle'),
            child: receiptAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    AppSkeletonWidget(height: 24, width: 180),
                    SizedBox(height: AppSpacing.md),
                    AppSkeletonWidget(height: 120),
                    SizedBox(height: AppSpacing.md),
                    AppSkeletonWidget(height: 140),
                  ],
                ),
              ),
              error: (error, _) => AppErrorWidget(
                title: l10n.text('receipts.loadErrorTitle'),
                message: error is AppException
                    ? l10n.text(error.messageKey)
                    : l10n.text('common.remoteRequestError'),
                retryLabel: l10n.text('common.retry'),
                onRetry: () =>
                    ref.invalidate(customerReceiptDetailProvider(orderNo)),
              ),
              data: (receipt) => _ReceiptPaperBody(
                receipt: receipt,
                theme: theme,
                l10n: l10n,
              ),
            ),
          );
        },
      ),
    );
  }
}

class _ReceiptPaperBody extends StatelessWidget {
  const _ReceiptPaperBody({
    required this.receipt,
    required this.theme,
    required this.l10n,
  });

  final DigitalReceiptDetailModel receipt;
  final ThemeData theme;
  final AppLocalizations l10n;

  String _formatDate(BuildContext context, String rawIso) {
    final parsed = DateTime.tryParse(rawIso);
    if (parsed == null) return rawIso;
    final tag = Localizations.localeOf(context).toLanguageTag();
    return DateFormat.yMMMd(tag).add_jm().format(parsed.toLocal());
  }

  String _buildShareSummary() {
    final buffer = StringBuffer()
      ..writeln('${receipt.organizationName} — ${receipt.orderNo}')
      ..writeln('Total: ${receipt.totalAmount.toStringAsFixed(3)} ${receipt.currencyCode}')
      ..writeln('Paid: ${receipt.paidAmount.toStringAsFixed(3)} ${receipt.currencyCode}')
      ..writeln('Balance: ${receipt.outstandingAmount.toStringAsFixed(3)} ${receipt.currencyCode}')
      ..writeln('Status: ${receipt.balanceStatusCode}');
    return buffer.toString();
  }

  @override
  Widget build(BuildContext context) {
    final isAr = l10n.locale.languageCode == 'ar';
    final orgName = isAr && (receipt.organizationName2?.isNotEmpty ?? false)
        ? receipt.organizationName2!
        : receipt.organizationName;
    final branchName = isAr && (receipt.branchName2?.isNotEmpty ?? false)
        ? receipt.branchName2
        : receipt.branchName;

    return SingleChildScrollView(
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        orgName,
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: AppColors.secondary,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (branchName != null && branchName.isNotEmpty)
                        Text(
                          branchName,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.textMuted,
                          ),
                        ),
                      if (receipt.vatNumber != null &&
                          receipt.vatNumber!.isNotEmpty)
                        Text(
                          '${l10n.text('receipts.vatNumberLabel')}: ${ltrCode(receipt.vatNumber!)}',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.textMuted,
                          ),
                        ),
                    ],
                  ),
                ),
                AppStatusBadgeWidget(
                  label: receipt.balanceStatusCode == 'SETTLED'
                      ? l10n.text('receipts.statusSettled')
                      : l10n.text('receipts.statusDue'),
                  tone: receipt.balanceStatusCode == 'SETTLED'
                      ? CmxSemanticTone.success
                      : CmxSemanticTone.warning,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                AppCodeChipWidget(
                  code: ltrCode(receipt.orderNo),
                  copiedFeedbackMessage: l10n.text('common.copiedToClipboard'),
                ),
                const Spacer(),
                Text(
                  _formatDate(context, receipt.issuedAtUtc),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
            const Divider(height: AppSpacing.xl, color: AppColors.border),

            // Itemized Lines
            for (final item in receipt.items) ...[
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${isAr && (item.name2?.isNotEmpty ?? false) ? item.name2! : item.name} × ${item.quantity}',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  AppMoneyTextWidget(
                    amount: item.lineTotal,
                    currencyCode: receipt.currencyCode,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
            ],
            const Divider(height: AppSpacing.xl, color: AppColors.border),

            // Totals
            _PaperMoneyRow(
              label: l10n.text('orders.subtotal'),
              amount: receipt.subtotal,
              currencyCode: receipt.currencyCode,
            ),
            if (receipt.discountTotal > 0)
              _PaperMoneyRow(
                label: l10n.text('receipts.discountLabel'),
                amount: -receipt.discountTotal.abs(),
                currencyCode: receipt.currencyCode,
                color: AppColors.success,
              ),
            if (receipt.taxTotal > 0)
              _PaperMoneyRow(
                label: l10n.text('receipts.taxLabel'),
                amount: receipt.taxTotal,
                currencyCode: receipt.currencyCode,
              ),
            const Divider(height: AppSpacing.md, color: AppColors.border),
            _PaperMoneyRow(
              label: l10n.text('orders.total'),
              amount: receipt.totalAmount,
              currencyCode: receipt.currencyCode,
              isBold: true,
            ),
            _PaperMoneyRow(
              label: l10n.text('orders.paidAmount'),
              amount: receipt.paidAmount,
              currencyCode: receipt.currencyCode,
              color: AppColors.success,
            ),
            _PaperMoneyRow(
              label: l10n.text('receipts.balanceLabel'),
              amount: receipt.outstandingAmount,
              currencyCode: receipt.currencyCode,
              isBold: true,
              color: receipt.outstandingAmount > 0
                  ? AppColors.warning
                  : AppColors.success,
            ),
            const SizedBox(height: AppSpacing.lg),

            // Deterministic QR code
            AppQrCardWidget(
              payload: receipt.qrPayload.isNotEmpty
                  ? receipt.qrPayload
                  : 'CMX|${receipt.orderNo}',
              title: l10n.text('receipts.qrVerificationTitle'),
              displayCode: ltrCode(receipt.orderNo),
              copiedFeedbackMessage: l10n.text('common.copiedToClipboard'),
              size: 112,
            ),
            const SizedBox(height: AppSpacing.md),

            AppCustomButtonWidget(
              label: l10n.text('receipts.copyShareAction'),
              icon: Icons.share_outlined,
              isPrimary: false,
              onPressed: () {
                Clipboard.setData(ClipboardData(text: _buildShareSummary()));
                HapticFeedback.lightImpact();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(l10n.text('common.copiedToClipboard')),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _PaperMoneyRow extends StatelessWidget {
  const _PaperMoneyRow({
    required this.label,
    required this.amount,
    required this.currencyCode,
    this.isBold = false,
    this.color,
  });

  final String label;
  final double amount;
  final String currencyCode;
  final bool isBold;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: (isBold
                      ? theme.textTheme.titleSmall
                      : theme.textTheme.bodyMedium)
                  ?.copyWith(
                color: isBold ? AppColors.secondary : AppColors.textMuted,
                fontWeight: isBold ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
          AppMoneyTextWidget(
            amount: amount,
            currencyCode: currencyCode,
            style: (isBold
                    ? theme.textTheme.titleSmall
                    : theme.textTheme.bodyMedium)
                ?.copyWith(
              color: color ?? AppColors.secondary,
              fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
