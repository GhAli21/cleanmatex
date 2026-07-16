'use client';

/**
 * Split-tender capability dialog (ADR condition #1 — "cash AND card" and any
 * N-leg split is a focused dialog, never a mode change).
 *
 * Pure view over engine facts: leg rows (method + shared amount field + remove),
 * an add-method picker, and a live balance line. Every number rendered here
 * (legs total, remaining) is **engine-derived and passed in** — this dialog
 * performs no money math; edits flow through typed engine actions only, which
 * own capping, change policy, and reconciliation.
 *
 * Layout: **editable real-payment legs first**, then a separator, then
 * **read-only customer-credit / stored-value legs** (managed via Store credit)
 * in a distinct muted style. Amount editing uses {@link PaymentAmountMoneyField}.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';
import type { OrgCardBrandConfig } from '@/lib/types/payment';
import {
  GATEWAY_METHOD_CODES,
  type CheckoutSettlementOption,
  type PaymentTerminalOption,
} from '@features/orders/hooks/use-payment-catalog';
import { CmxButton } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms';
import type { PaymentKeypadKey } from '@features/orders/ui/payment-modal-v4.utils';
import {
  splitLegHasBlockingDetailError,
  toSettlementOptionKey,
} from '@features/orders/ui/payment-modal-v4.utils';
import { PAYMENT_CAPABILITY } from '../capability-keys';
import type { PaymentEngineActions } from '../../engine/payment-engine-actions';
import { PaymentCapabilityDialog } from '../../primitives/payment-capability-dialog';
import { PaymentAmountMoneyField } from '../../primitives/payment-amount-money-field';
import { PaymentLegDetailFields } from '../../primitives/payment-leg-detail-fields';

/**
 * Typed engine actions the split dialog may call — nothing more.
 */
export type SplitTenderDialogActions = Pick<
  PaymentEngineActions,
  'updateLeg' | 'addLeg' | 'removeLegAt' | 'setActiveLegIndex' | 'fillLegRemaining'
>;

/**
 * Props for {@link SplitTenderDialog}. All money values are engine-derived.
 */
export interface SplitTenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: SplitTenderDialogActions;
  /** Current settlement legs from the engine. */
  paymentLegs: PaymentLeg[];
  /** Active leg index — its amount field receives focus on open / add / method change. */
  activeLegIndex: number;
  /** Engine draft for the active amount editor session. */
  activeAmountDraft: string;
  /** Writes amount for a split leg (container owns capping + draft sync). */
  onSplitAmountChange: (legIndex: number, value: number | null, draft: string) => void;
  /** Keypad presses for the active split-leg amount session. */
  onKeypadPress: (key: PaymentKeypadKey) => void;
  /** Remaining-to-allocate for the active leg (engine-derived). */
  activeLegRemainingCap: number;
  /** Real payment-method options selectable for split legs. */
  methodOptions: CheckoutSettlementOption[];
  /** Resolves an option's bilingual display name. */
  getOptionDisplayName: (
    option: CheckoutSettlementOption | null | undefined,
    fallback: string,
  ) => string;
  /** Engine-derived sale total to settle. */
  amountDue: number;
  /** Engine-derived sum of all legs (`paymentLegsTotal`). */
  legsTotal: number;
  /** Engine-derived remaining balance (floored at 0 — >0 means outstanding). */
  remainingBalance: number;
  /** Engine money-comparison epsilon (display thresholding only). */
  moneyEpsilon: number;
  currencyCode: string;
  formatAmount: (n: number) => string;
  decimalPlaces: number;
  // ---- per-method detail fields (shared PaymentLegDetailFields) ----
  /** Payment terminals for the branch (card terminal selector). */
  branchPaymentTerminals: PaymentTerminalOption[];
  /** Active card-brand config (card brand selector). */
  cardBrands: OrgCardBrandConfig[];
  /** Customer-credit instrument method codes (for the "no details" fallback). */
  creditMethodCodes: string[];
  /** Pay-extra intent — unlocks zero-amount method detail fields. */
  payExtraIntent?: boolean;
}

/**
 * Applies catalog identity to a leg without rewriting amount/tender (no silent
 * money mutation). Sets `method` + `gateway_code` from the option; clears
 * gateway when the target method is not a gateway tender.
 */
function applyLegSettlementOption(
  actions: SplitTenderDialogActions,
  legIndex: number,
  option: CheckoutSettlementOption,
): void {
  actions.setActiveLegIndex(legIndex);
  actions.updateLeg(
    legIndex,
    'method',
    option.payment_method_code as PaymentLeg['method'],
  );
  const nextGateway = GATEWAY_METHOD_CODES.includes(option.payment_method_code)
    ? (option.gateway_code ?? undefined)
    : undefined;
  actions.updateLeg(legIndex, 'gateway_code', nextGateway);
}

/**
 * A payment leg paired with its original index in `paymentLegs`.
 */
type SplitLegEntry = { leg: PaymentLeg; index: number };

/**
 * Renders the split-tender dialog. Commit model: edits apply to engine state
 * live (the engine owns state — ADR state-survival invariant), so the footer
 * is a single "Done" that closes the dialog.
 *
 * @param props - {@link SplitTenderDialogProps}.
 * @returns The dialog element.
 */
export function SplitTenderDialog({
  open,
  onOpenChange,
  actions,
  paymentLegs,
  activeLegIndex,
  activeAmountDraft,
  onSplitAmountChange,
  onKeypadPress,
  activeLegRemainingCap,
  methodOptions,
  getOptionDisplayName,
  amountDue,
  legsTotal,
  remainingBalance,
  moneyEpsilon,
  currencyCode,
  formatAmount,
  decimalPlaces,
  branchPaymentTerminals,
  cardBrands,
  creditMethodCodes,
}: SplitTenderDialogProps) {
  const t = useTranslations('newOrder.payment');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  // Bumped when method changes / leg is added / dialog opens (with legs) so
  // focus lands in that row's amount field.
  const [amountFocusNonce, setAmountFocusNonce] = useState(0);

  // Composite key — method alone collides when multiple gateway rows share a
  // payment_method_code (e.g. PAYMENT_GATEWAY + STRIPE vs HYPERPAY).
  const optionByKey = new Map(
    methodOptions.map((option) => [
      toSettlementOptionKey(option.payment_method_code, option.gateway_code),
      option,
    ]),
  );

  const creditMethodSet = useMemo(
    () => new Set(creditMethodCodes),
    [creditMethodCodes],
  );

  // Editable = real payment methods for this dialog. Credits / stored value
  // stay visible below as read-only (edit them from Store credit).
  const { editableLegs, readOnlyLegs } = useMemo(() => {
    const editable: SplitLegEntry[] = [];
    const readOnly: SplitLegEntry[] = [];
    paymentLegs.forEach((leg, index) => {
      const entry = { leg, index };
      if (creditMethodSet.has(leg.method)) {
        readOnly.push(entry);
      } else {
        editable.push(entry);
      }
    });
    return { editableLegs: editable, readOnlyLegs: readOnly };
  }, [creditMethodSet, paymentLegs]);

  // When legs already exist, land in the active amount on open. Empty split
  // uses data-capability-initial-focus on "+ Add payment method" instead.
  useEffect(() => {
    if (!open) return;
    if (editableLegs.length === 0) return;
    setAmountFocusNonce((prev) => prev + 1);
    // Only when the dialog opens — not on every legs identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open transition only
  }, [open]);

  // Focus is owned by PaymentAmountMoneyField.focusToken (bumped via
  // amountFocusNonce on add / method change / Enter→next). Do NOT re-focus on
  // every paymentLegs identity change — amount blur commits update the legs
  // array and would yank focus back into the amount field (Tab appears stuck).

  /**
   * Legs with detail-field errors (missing bank reference, terminal, etc.).
   * Dialog may not dismiss until each is fixed or deleted.
   */
  const blockingEditableLegs = useMemo(
    () =>
      editableLegs.filter(({ leg }) => {
        const option = methodOptions.find(
          (candidate) =>
            toSettlementOptionKey(
              candidate.payment_method_code,
              candidate.gateway_code,
            ) === toSettlementOptionKey(leg.method, leg.gateway_code),
        );
        return splitLegHasBlockingDetailError(leg, option);
      }),
    [editableLegs, methodOptions],
  );
  const canDismiss = blockingEditableLegs.length === 0;

  /** Focus the first invalid detail control so the cashier sees why Done is blocked. */
  const focusFirstBlockingField = () => {
    const first = blockingEditableLegs[0];
    if (!first) return;
    const row = document.querySelector<HTMLElement>(
      `[data-testid="split-tender-editable-leg-${first.index}"]`,
    );
    const invalid = row?.querySelector<HTMLElement>(
      'input[aria-invalid="true"], [aria-invalid="true"]',
    );
    if (invalid) {
      invalid.focus();
      return;
    }
    const fallback = row?.querySelector<HTMLElement>(
      'input:not([disabled]):not([tabindex="-1"]), [role="combobox"]:not([disabled])',
    );
    fallback?.focus();
  };

  /** Close only when every editable leg passes detail validation. */
  const handleOpenChange = (next: boolean) => {
    if (!next && !canDismiss) {
      focusFirstBlockingField();
      return;
    }
    onOpenChange(next);
  };

  const handleConfirmDone = () => {
    if (!canDismiss) {
      focusFirstBlockingField();
      return;
    }
    onOpenChange(false);
  };

  /** Enter on an amount field: next editable leg, or Done when on the last. */
  const handleAmountEnterConfirm = (legIndex: number) => {
    const position = editableLegs.findIndex((entry) => entry.index === legIndex);
    const next = position >= 0 ? editableLegs[position + 1] : undefined;
    if (next) {
      actions.setActiveLegIndex(next.index);
      setAmountFocusNonce((prev) => prev + 1);
      return;
    }
    handleConfirmDone();
  };

  // The engine floors `remainingBalance` at 0 (`max(0, due − settled)`), so
  // over-allocation can never be read from it — detect it by comparing the two
  // figures this balance line already renders (legs total vs amount due).
  const overAllocatedAmount = legsTotal - amountDue;
  const balanceState =
    overAllocatedAmount > moneyEpsilon
      ? 'over'
      : remainingBalance > moneyEpsilon
        ? 'outstanding'
        : 'allocated';
  const balanceDelta =
    balanceState === 'over' ? overAllocatedAmount : remainingBalance;
  const balanceLabel =
    balanceState === 'allocated'
      ? t('splitPayment.allocated')
      : balanceState === 'outstanding'
        ? t('splitPayment.outstanding')
        : t('splitPayment.over');

  return (
    <PaymentCapabilityDialog
      capabilityKey={PAYMENT_CAPABILITY.SPLIT_TENDER}
      open={open}
      onOpenChange={handleOpenChange}
      title={t('capabilities.SPLIT_TENDER.title')}
      description={t('capabilities.SPLIT_TENDER.description')}
      confirmLabel={tCommon('done')}
      onConfirm={handleConfirmDone}
      confirmDisabled={!canDismiss}
      errorFallbackMessage={t('capabilities.dialog.errorFallback')}
      errorCloseLabel={tCommon('close')}
      isRTL={isRTL}
      maxWidthClassName="max-w-lg"
    >
      <div className="flex flex-col gap-3">
        <div className={`flex items-baseline justify-between text-xs text-slate-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span>{t('splitPayment.settledTotal')}</span>
          <span className="font-mono font-semibold tabular-nums text-slate-800">
            {currencyCode} {formatAmount(amountDue)}
          </span>
        </div>

        <div data-testid="split-tender-leg-list" className="flex flex-col gap-3">
          {/* ---- Editable real-payment legs ---- */}
          <div className="flex flex-col gap-2">
            {editableLegs.length > 0 ? (
              <p
                className={`text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${
                  isRTL ? 'text-right' : 'text-left'
                }`}
                data-testid="split-tender-editable-heading"
              >
                {t('splitPayment.editableSection')}
              </p>
            ) : null}

            <ul className="flex flex-col gap-2" data-testid="split-tender-editable-list">
              {editableLegs.map(({ leg, index }) => {
                const legKey = toSettlementOptionKey(leg.method, leg.gateway_code);
                const option = optionByKey.get(legKey);
                const isActiveEditor = index === activeLegIndex;
                const displayAmount =
                  leg.method === PAYMENT_METHODS.CASH
                    ? leg.cashTendered ?? leg.amount
                    : leg.amount;
                return (
                  <li
                    key={leg.legRef ?? `${leg.method}-${index}`}
                    data-testid={`split-tender-editable-leg-${index}`}
                    className={`flex flex-col gap-2 rounded-xl border p-2 ${
                      isActiveEditor
                        ? 'border-cyan-300 bg-cyan-50/40'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <CmxSelectDropdown
                        value={legKey}
                        onValueChange={(key) => {
                          const nextOption = optionByKey.get(key);
                          if (nextOption) {
                            applyLegSettlementOption(actions, index, nextOption);
                            setAmountFocusNonce((prev) => prev + 1);
                          }
                        }}
                      >
                        <CmxSelectDropdownTrigger
                          className="h-10 min-w-0 flex-1"
                          aria-label={t('splitPayment.method')}
                          data-testid={`split-tender-method-${index}`}
                        >
                          <CmxSelectDropdownValue
                            placeholder={getOptionDisplayName(option, leg.method)}
                          />
                        </CmxSelectDropdownTrigger>
                        <CmxSelectDropdownContent>
                          {methodOptions.map((methodOption) => (
                            <CmxSelectDropdownItem
                              key={methodOption.id}
                              value={toSettlementOptionKey(
                                methodOption.payment_method_code,
                                methodOption.gateway_code,
                              )}
                            >
                              {getOptionDisplayName(
                                methodOption,
                                methodOption.payment_method_code,
                              )}
                            </CmxSelectDropdownItem>
                          ))}
                        </CmxSelectDropdownContent>
                      </CmxSelectDropdown>

                      <CmxButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        // Skip in Tab cycle — cashiers Tab method → amount → next row.
                        // Still mouse/keyboard-activatable when focused via click.
                        tabIndex={-1}
                        onClick={() => actions.removeLegAt(index)}
                        aria-label={t('splitPayment.remove')}
                        data-testid={`split-tender-remove-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-slate-500" />
                      </CmxButton>
                    </div>

                    <PaymentAmountMoneyField
                      size="compact"
                      currencyCode={currencyCode}
                      decimalPlaces={decimalPlaces}
                      formatAmount={formatAmount}
                      value={displayAmount ?? null}
                      draftValue={isActiveEditor ? activeAmountDraft : undefined}
                      onValueChange={(value, draft) =>
                        onSplitAmountChange(index, value, draft)
                      }
                      onKeypadPress={onKeypadPress}
                      onFocus={() => actions.setActiveLegIndex(index)}
                      focusToken={
                        isActiveEditor
                          ? `${index}:${leg.method}:${leg.gateway_code ?? ''}:${amountFocusNonce}`
                          : null
                      }
                      onEnterConfirm={() => handleAmountEnterConfirm(index)}
                      moneyEpsilon={moneyEpsilon}
                      isRTL={isRTL}
                      amountAriaLabel={t('splitPayment.amount')}
                      keypadTitle={t('mode.simpleView.keypadTitle')}
                      keypadDock={t('mode.simpleView.keypadDock')}
                      keypadClose={t('mode.simpleView.keypadClose')}
                      keypadHint={t('mode.simpleView.keypadHint')}
                      keypadRestored={t('mode.simpleView.keypadRestored')}
                      keypadStorageKey="cmx:payment-keypad-pos-split"
                      showExact
                      exactLabel={t('quickTender.exact')}
                      exactAriaLabel={t('quickTender.exactAria', {
                        amount: `${currencyCode} ${formatAmount(
                          isActiveEditor ? activeLegRemainingCap : displayAmount ?? 0,
                        )}`,
                      })}
                      onExact={() => actions.fillLegRemaining(index)}
                      exactDisabled={
                        (isActiveEditor ? activeLegRemainingCap : 0) <= moneyEpsilon &&
                        (displayAmount ?? 0) <= moneyEpsilon
                      }
                      showFillRemaining
                      fillRemainingLabel={t('splitPayment.fillRemaining')}
                      onFillRemaining={() => actions.fillLegRemaining(index)}
                      fillRemainingDisabled={
                        (isActiveEditor ? activeLegRemainingCap : 0) <= moneyEpsilon
                      }
                      testId={`split-tender-amount-${index}`}
                    />

                    <PaymentLegDetailFields
                      leg={leg}
                      legIndex={index}
                      option={option}
                      updateLeg={actions.updateLeg}
                      branchPaymentTerminals={branchPaymentTerminals}
                      cardBrands={cardBrands}
                      creditMethodCodes={creditMethodCodes}
                      showCashTenderedChange
                      currencyCode={currencyCode}
                      formatAmount={formatAmount}
                    />
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ---- Read-only credits / stored value ---- */}
          {readOnlyLegs.length > 0 ? (
            <div
              className="flex flex-col gap-2"
              data-testid="split-tender-readonly-section"
            >
              <div
                className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
                role="separator"
                aria-label={t('splitPayment.appliedCreditsSection')}
              >
                <div className="h-px flex-1 bg-violet-200" />
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                  {t('splitPayment.appliedCreditsSection')}
                </span>
                <div className="h-px flex-1 bg-violet-200" />
              </div>
              <p
                className={`text-xs text-violet-700/80 ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('splitPayment.appliedCreditsHint')}
              </p>

              <ul className="flex flex-col gap-2" data-testid="split-tender-readonly-list">
                {readOnlyLegs.map(({ leg, index }) => {
                  const label = getOptionDisplayName(undefined, leg.method);
                  return (
                    <li
                      key={leg.legRef ?? `${leg.method}-${index}`}
                      data-testid={`split-tender-readonly-leg-${index}`}
                      className={`flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2.5 ${
                        isRTL ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <div
                        className={`min-w-0 flex flex-1 flex-col gap-0.5 ${
                          isRTL ? 'items-end text-right' : 'items-start text-left'
                        }`}
                      >
                        <div
                          className={`flex flex-wrap items-center gap-2 ${
                            isRTL ? 'flex-row-reverse' : ''
                          }`}
                        >
                          <span className="text-sm font-semibold text-violet-950">
                            {label}
                          </span>
                          <Badge
                            variant="secondary"
                            className="rounded-full bg-violet-100 text-[10px] font-semibold uppercase tracking-wide text-violet-800"
                          >
                            {t('splitPayment.readOnlyBadge')}
                          </Badge>
                        </div>
                        <span className="font-mono text-sm font-semibold tabular-nums text-violet-900">
                          {currencyCode} {formatAmount(leg.amount ?? 0)}
                        </span>
                      </div>
                      <CmxButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        tabIndex={-1}
                        onClick={() => actions.removeLegAt(index)}
                        aria-label={t('splitPayment.remove')}
                        data-testid={`split-tender-remove-${index}`}
                        className="shrink-0 text-violet-700 hover:bg-violet-100 hover:text-violet-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </CmxButton>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>

        <CmxSelectDropdown
          value=""
          onValueChange={(key) => {
            const option = optionByKey.get(key);
            if (option) {
              actions.addLeg(option, remainingBalance > 0 ? remainingBalance : 0);
              setAmountFocusNonce((prev) => prev + 1);
            }
          }}
        >
          <CmxSelectDropdownTrigger
            className="h-10 w-full border-dashed"
            aria-label={t('splitPayment.addMethod')}
            data-testid="split-tender-add-leg"
            data-capability-initial-focus={
              editableLegs.length === 0 ? 'true' : undefined
            }
          >
            <CmxSelectDropdownValue placeholder={t('splitPayment.addMethod')} />
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            {methodOptions.map((methodOption) => (
              <CmxSelectDropdownItem
                key={methodOption.id}
                value={toSettlementOptionKey(
                  methodOption.payment_method_code,
                  methodOption.gateway_code,
                )}
              >
                {getOptionDisplayName(methodOption, methodOption.payment_method_code)}
              </CmxSelectDropdownItem>
            ))}
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>

        <div
          className={`flex items-baseline justify-between border-t border-dashed border-slate-200 pt-2 text-xs ${
            isRTL ? 'flex-row-reverse' : ''
          }`}
          data-testid="split-tender-balance"
          data-balance-state={balanceState}
        >
          <span className="text-slate-500">
            {t('splitPayment.legSum')}{' '}
            <span className="font-mono font-semibold tabular-nums text-slate-800">
              {formatAmount(legsTotal)}
            </span>
          </span>
          <span
            className={`font-semibold ${
              balanceState === 'allocated'
                ? 'text-emerald-700'
                : balanceState === 'outstanding'
                  ? 'text-amber-700'
                  : 'text-rose-700'
            }`}
          >
            {balanceLabel}
            {balanceState !== 'allocated' ? (
              <span className="font-mono tabular-nums">
                {' '}
                {formatAmount(balanceDelta)}
              </span>
            ) : null}
          </span>
        </div>
      </div>
    </PaymentCapabilityDialog>
  );
}
