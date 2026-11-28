import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../providers/customer_receipts_provider.dart';
import '../widgets/customer_always_light_receipt_sheet_widget.dart';

/// Digital Receipts & VAT Invoices hub screen.
class CustomerReceiptsScreen extends ConsumerWidget {
  const CustomerReceiptsScreen({super.key});

  String _formatDate(BuildContext context, String rawIso) {
    final parsed = DateTime.tryParse(rawIso);
    if (parsed == null) return rawIso;
    final tag = Localizations.localeOf(context).toLanguageTag();
    return DateFormat.yMMMd(tag).format(parsed.toLocal());
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final receiptsAsync = ref.watch(customerReceiptsProvider);
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.text('receipts.title')),
      ),
      body: SafeArea(
        child: receiptsAsync.when(
          loading: () => ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: const [
              AppSkeletonWidget(height: 92),
              SizedBox(height: AppSpacing.md),
              AppSkeletonWidget(height: 92),
              SizedBox(height: AppSpacing.md),
              AppSkeletonWidget(height: 92),
            ],
          ),
          error: (error, _) => ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              AppErrorWidget(
                title: l10n.text('receipts.loadErrorTitle'),
                message: error is AppException
                    ? l10n.text(error.messageKey)
                    : l10n.text('common.remoteRequestError'),
                retryLabel: l10n.text('common.retry'),
                onRetry: () => ref.invalidate(customerReceiptsProvider),
              ),
            ],
          ),
          data: (receipts) => RefreshIndicator(
            onRefresh: () => ref.refresh(customerReceiptsProvider.future),
            child: receipts.isEmpty
                ? ListView(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    children: [
                      AppEmptyStateWidget(
                        icon: Icons.receipt_long_outlined,
                        title: l10n.text('receipts.emptyTitle'),
                        description: l10n.text('receipts.emptyBody'),
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    itemCount: receipts.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: AppSpacing.md),
                    itemBuilder: (context, index) {
                      final r = receipts[index];
                      return _ReceiptSummaryTile(
                        receipt: r,
                        dateLabel: _formatDate(context, r.issuedAtUtc),
                        theme: theme,
                        ext: ext,
                        l10n: l10n,
                        onOpen: () => showCustomerAlwaysLightReceiptSheet(
                          context,
                          orderNo: r.orderNo,
                        ),
                      );
                    },
                  ),
          ),
        ),
      ),
    );
  }
}

class _ReceiptSummaryTile extends StatelessWidget {
  const _ReceiptSummaryTile({
    required this.receipt,
    required this.dateLabel,
    required this.theme,
    required this.ext,
    required this.l10n,
    required this.onOpen,
  });

  final DigitalReceiptSummaryModel receipt;
  final String dateLabel;
  final ThemeData theme;
  final CmxStatusThemeExtension ext;
  final AppLocalizations l10n;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final isAr = l10n.locale.languageCode == 'ar';
    final branchName = isAr && (receipt.branchName2?.isNotEmpty ?? false)
        ? receipt.branchName2
        : receipt.branchName;

    return AppCardWidget(
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.md),
        onTap: onOpen,
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: ext.brand.background,
                borderRadius: BorderRadius.circular(AppRadii.md),
              ),
              child: Icon(
                Icons.receipt_long_rounded,
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          ltrCode(receipt.orderNo),
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      AppStatusBadgeWidget(
                        label: receipt.isSettled
                            ? l10n.text('receipts.statusSettled')
                            : l10n.text('receipts.statusDue'),
                        tone: receipt.isSettled
                            ? CmxSemanticTone.success
                            : CmxSemanticTone.warning,
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [
                      dateLabel,
                      if (branchName != null && branchName.isNotEmpty)
                        branchName,
                    ].join(' · '),
                    style:
                        theme.textTheme.bodySmall?.copyWith(color: ext.textMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                AppMoneyTextWidget(
                  amount: receipt.totalAmount,
                  currencyCode: receipt.currencyCode,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  l10n.text('receipts.viewAction'),
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: ext.brandText,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
