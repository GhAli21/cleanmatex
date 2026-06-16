import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';
import type { ExtraReceiptHandlingMode } from './extra-receipt-handling-card';

type ExtraReceiptSummaryTranslator = (
  key: string,
  values?: Record<string, string>
) => string;

/**
 * Cashier-facing one-line summary for submit confirm when excess routing is chosen.
 */
export function getExtraReceiptResolutionSummary(
  mode: ExtraReceiptHandlingMode,
  amount: number,
  currencyCode: string,
  formatAmount: (value: number) => string,
  t: ExtraReceiptSummaryTranslator
): string {
  const amountLabel = `${currencyCode} ${formatAmount(amount)}`;

  switch (mode) {
    case OVERPAYMENT_RESOLUTIONS.RETURN_CASH_CHANGE:
      return t('extraReceipt.returnCashChangeHelp', { amount: amountLabel });
    case OVERPAYMENT_RESOLUTIONS.SAVE_TO_CUSTOMER_WALLET:
      return t('extraReceipt.saveToWalletHelp', { amount: amountLabel });
    case OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE:
      return t('extraReceipt.saveAsAdvanceHelp');
    case OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT:
      return t('extraReceipt.saveAsCreditHelp');
    case OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES:
      return t('extraReceipt.autoAllocateConfirmed');
    case OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES:
      return t('extraReceipt.manualAllocateConfirmed');
    default:
      return amountLabel;
  }
}
