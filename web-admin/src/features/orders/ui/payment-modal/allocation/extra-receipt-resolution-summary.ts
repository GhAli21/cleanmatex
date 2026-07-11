import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';
import type { ExtraReceiptHandlingMode } from './extra-receipt-handling-card';

type ExtraReceiptSummaryTranslator = (
  key: string,
  values?: Record<string, string>
) => string;

/**
 * Cashier-facing one-line summary for submit confirm when excess routing is chosen.
 * @param mode
 * @param amount
 * @param currencyCode
 * @param formatAmount
 * @param t
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

/**
 * Short destination noun for the resolved pay-extra strip mirror
 * ("Extra: {amount} → {destination}"). Reuses the existing extra-receipt
 * option labels — no new i18n. Returns null when no routing destination
 * applies (e.g. adjust-legs), so the strip falls back to the amount-only line.
 *
 * @param mode - Resolved overpayment routing mode.
 * @param t - Translator scoped to `newOrder.payment`.
 * @returns Short destination label, or null when not a routed destination.
 */
export function getExtraReceiptDestinationLabel(
  mode: ExtraReceiptHandlingMode,
  t: ExtraReceiptSummaryTranslator
): string | null {
  switch (mode) {
    case OVERPAYMENT_RESOLUTIONS.RETURN_CASH_CHANGE:
      return t('extraReceipt.returnCashChange');
    case OVERPAYMENT_RESOLUTIONS.SAVE_TO_CUSTOMER_WALLET:
      return t('extraReceipt.saveToWallet');
    case OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE:
      return t('extraReceipt.saveAsAdvance');
    case OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT:
      return t('extraReceipt.saveAsCredit');
    case OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES:
      return t('extraReceipt.autoAllocate');
    case OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES:
      return t('extraReceipt.manualAllocate');
    default:
      return null;
  }
}
