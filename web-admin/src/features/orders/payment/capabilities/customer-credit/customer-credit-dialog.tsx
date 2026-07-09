'use client';

/**
 * Customer-credit capability dialog.
 *
 * Renders the customer's stored-value instruments — wallet (live balance),
 * advance, and credit notes — as selectable cards, ported from the legacy
 * `payment-full-view` "Store credit" panel. Selecting one calls the engine's
 * typed `selectCustomerCredit` action, which owns the branching (CREDIT_NOTE →
 * opens the engine's credit-note picker; reference-required → info toast;
 * wallet/advance → upserts a settlement leg at a suggested amount). No money
 * math here — balances arrive engine-derived and the engine caps the leg; the
 * server re-validates on submit.
 *
 * Live-commit model (engine owns state — ADR state-survival); the footer is a
 * single "Done" that closes. The credit-note picker stays a separate
 * engine-managed dialog (not embedded here).
 */

import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw, Wallet } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';
import type { CheckoutSettlementOption } from '@features/orders/hooks/use-payment-catalog';
import type { StoredValueSummaryResponse } from '@features/orders/hooks/use-payment-engine';
import { CmxButton, CmxSkeleton } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { PAYMENT_CAPABILITY } from '../capability-keys';
import type { PaymentEngineActions } from '../../engine/payment-engine-actions';
import { PaymentCapabilityDialog } from '../../primitives/payment-capability-dialog';

/**
 * Typed engine actions the customer-credit dialog may call — nothing more.
 */
export type CustomerCreditDialogActions = Pick<
  PaymentEngineActions,
  'selectCustomerCredit'
>;

/**
 * Props for {@link CustomerCreditDialog}. All balances are engine-derived.
 */
export interface CustomerCreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: CustomerCreditDialogActions;
  /** Stored-value instruments offered for this customer (engine-derived). */
  creditOptions: CheckoutSettlementOption[];
  /** Current settlement legs (drives each option's `selected` state). */
  paymentLegs: PaymentLeg[];
  /** Resolves an option's bilingual display name. */
  getOptionDisplayName: (
    option: CheckoutSettlementOption | null | undefined,
    fallback: string,
  ) => string;
  /** Live stored-value summary (wallet/advance/credit-notes) or null. */
  storedValueSummary: StoredValueSummaryResponse | null;
  storedValueLoading: boolean;
  storedValueFetching: boolean;
  /** Refetches the live wallet/stored-value balance. */
  refetchStoredValueSummary: () => void;
  walletBalanceLoaded: boolean;
  walletHasAvailableBalance: boolean;
  /** Preformatted "CUR 0.000" live wallet balance (engine-derived). */
  liveWalletBalanceDisplay: string;
  walletLegExceedsLiveBalance: boolean;
  currencyCode: string;
  formatAmount: (n: number) => string;
}

/**
 * Renders the store-credit instrument list inside the shared capability shell.
 *
 * @param props - {@link CustomerCreditDialogProps}.
 * @returns The dialog element.
 */
export function CustomerCreditDialog({
  open,
  onOpenChange,
  actions,
  creditOptions,
  paymentLegs,
  getOptionDisplayName,
  storedValueSummary,
  storedValueLoading,
  storedValueFetching,
  refetchStoredValueSummary,
  walletBalanceLoaded,
  walletHasAvailableBalance,
  liveWalletBalanceDisplay,
  walletLegExceedsLiveBalance,
  currencyCode,
  formatAmount,
}: CustomerCreditDialogProps) {
  const t = useTranslations('newOrder.payment');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();

  return (
    <PaymentCapabilityDialog
      capabilityKey={PAYMENT_CAPABILITY.CUSTOMER_CREDIT}
      open={open}
      onOpenChange={onOpenChange}
      title={t('capabilities.CUSTOMER_CREDIT.title')}
      description={t('capabilities.CUSTOMER_CREDIT.description')}
      confirmLabel={tCommon('done')}
      onConfirm={() => onOpenChange(false)}
      errorFallbackMessage={t('capabilities.dialog.errorFallback')}
      errorCloseLabel={tCommon('close')}
      isRTL={isRTL}
      maxWidthClassName="max-w-lg"
    >
      {creditOptions.length === 0 ? (
        <p className="text-xs text-slate-500" data-testid="customer-credit-empty">
          {t('customerCredits.empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-2" data-testid="customer-credit-list">
          {creditOptions.map((option) => {
            const optionLabel = getOptionDisplayName(option, option.payment_method_code);
            const selected = !!paymentLegs.find((leg) => leg.method === option.payment_method_code);
            const isWalletOption =
              option.credit_application_type === 'WALLET' ||
              option.payment_method_code === 'WALLET';
            const isCreditNoteOption = option.payment_method_code === 'CREDIT_NOTE';
            const creditNotesAvailable = (storedValueSummary?.creditNotes.length ?? 0) > 0;
            const disabled =
              (isCreditNoteOption
                ? storedValueLoading || !creditNotesAvailable
                : option.requires_credit_reference_selection) ||
              (isWalletOption && (storedValueLoading || (walletBalanceLoaded && !walletHasAvailableBalance)));
            const balanceLabel = isWalletOption
              ? storedValueLoading
                ? t('customerCredits.loadingBalance')
                : walletHasAvailableBalance
                  ? t('customerCredits.available', { amount: liveWalletBalanceDisplay })
                  : t('customerCredits.noWalletBalance')
              : isCreditNoteOption
                ? storedValueLoading
                  ? t('customerCredits.loadingBalance')
                  : creditNotesAvailable
                    ? t('customerCredits.creditNoteSelectHint')
                    : t('customerCredits.creditNotePickerEmpty')
                : disabled
                  ? t('customerCredits.referenceSelectionHint')
                  : t('customerCredits.available', {
                      amount: `${currencyCode} ${formatAmount(option.available_balance ?? 0)}`,
                    });
            return (
              <div key={option.id} className="space-y-2">
                {isWalletOption ? (
                  <div className={`flex items-center justify-between gap-2 px-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Badge variant="secondary" className="rounded-full bg-cyan-50 text-cyan-700">
                      {t('customerCredits.liveBadge')}
                    </Badge>
                    <CmxButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => refetchStoredValueSummary()}
                      disabled={storedValueFetching}
                      aria-label={t('customerCredits.refreshBalance')}
                      className="h-8 rounded-xl px-2 text-slate-500"
                      data-testid="customer-credit-refresh"
                    >
                      {storedValueFetching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </CmxButton>
                  </div>
                ) : null}
                <CmxButton
                  type="button"
                  data-testid={`payment-credit-method-${option.payment_method_code.toLowerCase()}`}
                  variant="outline"
                  size="lg"
                  disabled={disabled}
                  onClick={() => actions.selectCustomerCredit(option)}
                  className={`h-auto w-full justify-start rounded-2xl border px-4 py-4 ${
                    selected
                      ? 'border-cyan-500 bg-cyan-50/70 text-slate-900 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'
                  } ${disabled ? 'opacity-75' : ''} ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  <span className={`flex w-full items-start gap-3 ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}>
                    <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-700">
                      <Wallet className="h-5 w-5" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-semibold">{optionLabel}</span>
                      {isWalletOption && storedValueLoading ? (
                        <CmxSkeleton className="mt-2 h-4 w-40" />
                      ) : (
                        <span
                          className={`mt-1 text-xs font-medium ${
                            isWalletOption && !walletHasAvailableBalance && walletBalanceLoaded
                              ? 'text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {balanceLabel}
                        </span>
                      )}
                      {isWalletOption && selected && !walletLegExceedsLiveBalance ? (
                        <span className="mt-1 text-xs font-medium text-cyan-700">
                          {t('customerCredits.applied')}
                        </span>
                      ) : null}
                      {isWalletOption && walletLegExceedsLiveBalance ? (
                        <span className="mt-1 text-xs font-medium text-rose-600">
                          {t('customerCredits.walletBalanceExceeded', {
                            amount: liveWalletBalanceDisplay,
                          })}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </CmxButton>
              </div>
            );
          })}
        </div>
      )}
    </PaymentCapabilityDialog>
  );
}
