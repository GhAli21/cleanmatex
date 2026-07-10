'use client';

/**
 * Split-tender capability dialog (ADR condition #1 — "cash AND card" and any
 * N-leg split is a focused dialog, never a mode change).
 *
 * Pure view over engine facts: leg rows (method + amount + remove), an
 * add-method picker, and a live balance line. Every number rendered here
 * (legs total, remaining) is **engine-derived and passed in** — this dialog
 * performs no money math; edits flow through typed engine actions only
 * (`updateLeg` / `addLeg` / `removeLegAt`), which own capping, change policy,
 * and reconciliation.
 */

import { useEffect, useRef } from 'react';
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
import { CmxButton, CmxMoneyField } from '@ui/primitives';
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms';
import { toSettlementOptionKey } from '@features/orders/ui/payment-modal-v4.utils';
import { PAYMENT_CAPABILITY } from '../capability-keys';
import type { PaymentEngineActions } from '../../engine/payment-engine-actions';
import { PaymentCapabilityDialog } from '../../primitives/payment-capability-dialog';
import { PaymentLegDetailFields } from '../../primitives/payment-leg-detail-fields';

/**
 * Typed engine actions the split dialog may call — nothing more.
 */
export type SplitTenderDialogActions = Pick<
  PaymentEngineActions,
  'updateLeg' | 'addLeg' | 'removeLegAt' | 'setActiveLegIndex'
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
  payExtraIntent = false,
}: SplitTenderDialogProps) {
  const t = useTranslations('newOrder.payment');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();

  // Composite key — method alone collides when multiple gateway rows share a
  // payment_method_code (e.g. PAYMENT_GATEWAY + STRIPE vs HYPERPAY).
  const optionByKey = new Map(
    methodOptions.map((option) => [
      toSettlementOptionKey(option.payment_method_code, option.gateway_code),
      option,
    ]),
  );

  // Focus the active leg's amount field when the dialog opens or a leg is added /
  // its method changes, so the cursor lands in the dialog (QA 1.1) rather than the
  // background editor. The engine sets `activeLegIndex` on add / method select.
  const legAmountRefs = useRef<Array<HTMLInputElement | null>>([]);
  useEffect(() => {
    if (!open) return;
    const input = legAmountRefs.current[activeLegIndex];
    if (input) {
      input.focus();
      input.select();
    }
  }, [open, activeLegIndex, paymentLegs.length]);

  // The engine floors `remainingBalance` at 0 (`max(0, due − settled)`), so
  // over-allocation can never be read from it — detect it by comparing the two
  // figures this balance line already renders (legs total vs amount due).
  // Display thresholding only; capping/change policy stay engine-owned. QA
  // round 4: a card leg overpaying the order previously showed "Fully
  // Allocated" here because the 'over' branch was unreachable.
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
      onOpenChange={onOpenChange}
      title={t('capabilities.SPLIT_TENDER.title')}
      description={t('capabilities.SPLIT_TENDER.description')}
      confirmLabel={tCommon('done')}
      onConfirm={() => onOpenChange(false)}
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

        <ul className="flex flex-col gap-2" data-testid="split-tender-leg-list">
          {paymentLegs.map((leg, index) => {
            const legKey = toSettlementOptionKey(leg.method, leg.gateway_code);
            const option = optionByKey.get(legKey);
            return (
              <li
                key={leg.legRef ?? `${leg.method}-${index}`}
                className="flex flex-col gap-2 rounded-xl border border-slate-100 p-2"
              >
                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <CmxSelectDropdown
                  value={legKey}
                  onValueChange={(key) => {
                    const nextOption = optionByKey.get(key);
                    if (nextOption) {
                      applyLegSettlementOption(actions, index, nextOption);
                    }
                  }}
                >
                  <CmxSelectDropdownTrigger
                    className="h-10 w-36 shrink-0"
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

                <CmxMoneyField
                  ref={(el) => {
                    legAmountRefs.current[index] = el;
                  }}
                  // For CASH the field is the TENDERED amount (engine caps the
                  // applied amount and derives change) — consistent with the main
                  // amount editor. Other methods edit the applied amount directly.
                  value={
                    leg.method === PAYMENT_METHODS.CASH
                      ? leg.cashTendered ?? leg.amount
                      : leg.amount
                  }
                  decimalPlaces={decimalPlaces}
                  showZero
                  onValueChange={(value) => {
                    actions.setActiveLegIndex(index);
                    actions.updateLeg(index, 'amount', value ?? 0);
                  }}
                  onFocus={() => actions.setActiveLegIndex(index)}
                  aria-label={t('splitPayment.amount')}
                  data-testid={`split-tender-amount-${index}`}
                  className="h-10 flex-1"
                />

                <CmxButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => actions.removeLegAt(index)}
                  aria-label={t('splitPayment.remove')}
                  data-testid={`split-tender-remove-${index}`}
                  disabled={paymentLegs.length <= 1}
                >
                  <Trash2 className="h-4 w-4 text-slate-500" />
                </CmxButton>
                </div>
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

        <CmxSelectDropdown
          value=""
          onValueChange={(key) => {
            const option = optionByKey.get(key);
            if (option) {
              actions.addLeg(option, remainingBalance > 0 ? remainingBalance : 0);
            }
          }}
        >
          <CmxSelectDropdownTrigger
            className="h-10 w-full border-dashed"
            aria-label={t('splitPayment.addMethod')}
            data-testid="split-tender-add-leg"
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
