'use client';

/**
 * Customer-credit capability dialog.
 *
 * Renders the customer's stored-value instruments — wallet (live balance),
 * advance, and credit notes — as selectable cards. Selecting one calls the
 * engine's typed `selectCustomerCredit` action (CREDIT_NOTE → picker;
 * wallet/advance → upserts/activates a settlement leg). Once a leg exists for
 * an instrument, the shared {@link PaymentAmountMoneyField} appears so the
 * cashier can edit the applied amount with Exact / Fill remaining / keypad —
 * same control as Split payment and the Simple amount editor.
 *
 * No money math here — balances arrive engine-derived and the engine caps the
 * leg; the server re-validates on submit. Live-commit model (engine owns state).
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw, Wallet } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';
import type { CheckoutSettlementOption } from '@features/orders/hooks/use-payment-catalog';
import type { StoredValueSummaryResponse } from '@features/orders/hooks/use-payment-engine';
import type { PaymentKeypadKey } from '@features/orders/ui/payment-modal-v4.utils';
import { CmxButton, CmxSkeleton } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { PAYMENT_CAPABILITY } from '../capability-keys';
import type { PaymentEngineActions } from '../../engine/payment-engine-actions';
import { PaymentCapabilityDialog } from '../../primitives/payment-capability-dialog';
import { PaymentAmountMoneyField } from '../../primitives/payment-amount-money-field';

/**
 * Typed engine actions the customer-credit dialog may call — nothing more.
 */
export type CustomerCreditDialogActions = Pick<
  PaymentEngineActions,
  'selectCustomerCredit' | 'updateLeg' | 'setActiveLegIndex' | 'fillLegRemaining'
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
  /** Active leg index — amount draft/keypad bind to this session. */
  activeLegIndex: number;
  /** Engine draft for the active amount editor session. */
  activeAmountDraft: string;
  /** Writes amount for a credit leg (container owns capping + draft sync). */
  onCreditAmountChange: (legIndex: number, value: number | null, draft: string) => void;
  /** Keypad presses for the active credit-leg amount session. */
  onKeypadPress: (key: PaymentKeypadKey) => void;
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
  /** Remaining-to-allocate for the active credit leg (engine-derived). */
  activeLegRemainingCap: number;
  moneyEpsilon: number;
  currencyCode: string;
  formatAmount: (n: number) => string;
  decimalPlaces: number;
  /**
   * When the nested credit-note picker is open, suppress amount autofocus so
   * keyboard focus can land in the picker (CmxDialog does not steal focus itself).
   */
  creditNotePickerOpen?: boolean;
}

/**
 * Finds the settlement leg index for a credit option, or -1.
 */
function findCreditLegIndex(
  paymentLegs: PaymentLeg[],
  option: CheckoutSettlementOption,
): number {
  return paymentLegs.findIndex(
    (leg) =>
      leg.method === option.payment_method_code &&
      (leg.gateway_code ?? '') === (option.gateway_code ?? ''),
  );
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
  activeLegIndex,
  activeAmountDraft,
  onCreditAmountChange,
  onKeypadPress,
  getOptionDisplayName,
  storedValueSummary,
  storedValueLoading,
  storedValueFetching,
  refetchStoredValueSummary,
  walletBalanceLoaded,
  walletHasAvailableBalance,
  liveWalletBalanceDisplay,
  walletLegExceedsLiveBalance,
  activeLegRemainingCap,
  moneyEpsilon,
  currencyCode,
  formatAmount,
  decimalPlaces,
  creditNotePickerOpen = false,
}: CustomerCreditDialogProps) {
  const t = useTranslations('newOrder.payment');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  // Bumped on every instrument tap so focus lands in that option's amount
  // field even when re-selecting the already-active credit leg (background
  // focusAmountEditor is suppressed while this dialog is open).
  const [amountFocusNonce, setAmountFocusNonce] = useState(0);

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
            const legIndex = findCreditLegIndex(paymentLegs, option);
            const selected = legIndex >= 0;
            const selectedLeg = selected ? paymentLegs[legIndex] : undefined;
            const isActiveEditor = selected && legIndex === activeLegIndex;
            const isWalletOption =
              option.credit_application_type === 'WALLET' ||
              option.payment_method_code === 'WALLET';
            const isCreditNoteOption = option.payment_method_code === 'CREDIT_NOTE';
            const creditNotesAvailable = (storedValueSummary?.creditNotes.length ?? 0) > 0;
            const creditNoteReady =
              isCreditNoteOption &&
              selected &&
              !!selectedLeg?.creditReferenceId?.trim();
            const showAmountEditor =
              selected && (!isCreditNoteOption || creditNoteReady);
            const disabled =
              (isCreditNoteOption
                ? storedValueLoading || !creditNotesAvailable
                : option.requires_credit_reference_selection) ||
              (isWalletOption &&
                (storedValueLoading || (walletBalanceLoaded && !walletHasAvailableBalance)));
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
                  <div
                    className={`flex items-center justify-between gap-2 px-1 ${
                      isRTL ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <Badge variant="secondary" className="rounded-full bg-cyan-50 text-cyan-700">
                      {t('customerCredits.liveBadge')}
                    </Badge>
                    <CmxButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      // Skip in Tab cycle — Tab stays on instruments → amount → Done.
                      tabIndex={-1}
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
                  aria-pressed={selected}
                  onClick={() => {
                    actions.selectCustomerCredit(option);
                    // Credit note opens a nested picker — do not yank focus to
                    // an amount field behind it (Advance/Wallet editor).
                    if (!isCreditNoteOption) {
                      setAmountFocusNonce((prev) => prev + 1);
                    }
                  }}
                  className={`h-auto w-full justify-start rounded-2xl border px-4 py-4 ${
                    selected
                      ? 'border-cyan-500 bg-cyan-50/70 text-slate-900 shadow-sm ring-1 ring-cyan-200'
                      : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'
                  } ${disabled ? 'opacity-75' : ''} ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  <span
                    className={`flex w-full items-start gap-3 ${
                      isRTL ? 'flex-row-reverse text-right' : 'text-left'
                    }`}
                  >
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
                      {isCreditNoteOption && creditNoteReady ? (
                        <span className="mt-1 text-xs font-medium text-cyan-700">
                          {t('customerCredits.creditNoteSelected', {
                            id: selectedLeg?.creditReferenceId ?? '',
                          })}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </CmxButton>

                {showAmountEditor && selectedLeg ? (
                  <div
                    className="rounded-2xl border border-cyan-100 bg-slate-50/80 p-3"
                    data-testid={`customer-credit-amount-${option.payment_method_code.toLowerCase()}`}
                  >
                    <PaymentAmountMoneyField
                      size="compact"
                      currencyCode={currencyCode}
                      decimalPlaces={decimalPlaces}
                      formatAmount={formatAmount}
                      value={selectedLeg.amount ?? null}
                      draftValue={isActiveEditor ? activeAmountDraft : undefined}
                      onValueChange={(value, draft) =>
                        onCreditAmountChange(legIndex, value, draft)
                      }
                      onKeypadPress={onKeypadPress}
                      onFocus={() => actions.setActiveLegIndex(legIndex)}
                      focusToken={
                        isActiveEditor && !creditNotePickerOpen
                          ? `${legIndex}:${option.payment_method_code}:${selectedLeg.creditReferenceId ?? ''}:${amountFocusNonce}`
                          : null
                      }
                      // Enter (keyboard) commits amount and closes — same as Done.
                      onEnterConfirm={() => onOpenChange(false)}
                      moneyEpsilon={moneyEpsilon}
                      isRTL={isRTL}
                      amountAriaLabel={t('customerCredits.amountLabel', {
                        method: optionLabel,
                      })}
                      keypadTitle={t('mode.simpleView.keypadTitle')}
                      keypadDock={t('mode.simpleView.keypadDock')}
                      keypadClose={t('mode.simpleView.keypadClose')}
                      keypadHint={t('mode.simpleView.keypadHint')}
                      keypadRestored={t('mode.simpleView.keypadRestored')}
                      keypadStorageKey="cmx:payment-keypad-pos-store-credit"
                      showExact
                      exactLabel={t('quickTender.exact')}
                      exactAriaLabel={t('quickTender.exactAria', {
                        amount: `${currencyCode} ${formatAmount(
                          isActiveEditor ? activeLegRemainingCap : selectedLeg.amount ?? 0,
                        )}`,
                      })}
                      onExact={() => actions.fillLegRemaining(legIndex)}
                      exactDisabled={
                        (isActiveEditor ? activeLegRemainingCap : 0) <= moneyEpsilon &&
                        (selectedLeg.amount ?? 0) <= moneyEpsilon
                      }
                      showFillRemaining
                      fillRemainingLabel={t('splitPayment.fillRemaining')}
                      onFillRemaining={() => actions.fillLegRemaining(legIndex)}
                      fillRemainingDisabled={
                        (isActiveEditor ? activeLegRemainingCap : 0) <= moneyEpsilon
                      }
                      remainingHint={
                        isActiveEditor
                          ? t('workspace.remainingForLeg', {
                              amount: `${currencyCode} ${formatAmount(activeLegRemainingCap)}`,
                            })
                          : t('customerCredits.amountEditHint')
                      }
                      testId={`customer-credit-amount-field-${option.payment_method_code.toLowerCase()}`}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </PaymentCapabilityDialog>
  );
}
