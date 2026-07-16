'use client';

/**
 * Payment Modal V4 — Simple face (Phase 4, single engine two modes).
 *
 * The ~80% cash/card fast lane: optional left capability-tile rail, method
 * chips, one hero amount editor, quick-tender chips, an optional keypad, and a
 * compact receipt card. Purely presentational — every value and handler comes
 * from the engine via `PaymentFullView` (the mounted container that owns mode
 * state), so this face can never fork finance logic or the submit payload.
 * Anything advanced (splits, gift cards, B2B/AR, overpayment routing, drawer
 * conflicts) trips `computeNeedsAdvanced` in the engine and the container
 * escalates to the Full face with all state intact.
 *
 * See `docs/features/Order_Fin/ADR/ADR_payment_modal_single_engine_two_mode.md`.
 */

import { type ReactNode, type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import type { Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import { Banknote, CreditCard, EllipsisVertical } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';
import type { OrgCardBrandConfig } from '@/lib/types/payment';
import type { PaymentFormData } from '@features/orders/model/payment-form-schema';
import type {
  CheckoutSettlementOption,
  PaymentTerminalOption,
} from '@features/orders/hooks/use-payment-catalog';
import type { PaymentEngineActions } from '@features/orders/payment/engine/payment-engine-actions';
import { PaymentLegDetailFields } from '@features/orders/payment/primitives/payment-leg-detail-fields';
import { PaymentDiscountFields } from '@features/orders/payment/primitives/payment-discount-fields';
import { PaymentAmountMoneyField } from '@features/orders/payment/primitives/payment-amount-money-field';
import { CmxButton, CmxSkeleton } from '@ui/primitives';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { SummaryRow } from './payment-modal/summary-row';
import {
  SettlementNowBreakdown,
  type SettlementNowLineItem,
} from './payment-modal/settlement-now-breakdown';
import {
  OrderValueBreakdownPanel,
  type OrderValueBreakdownModel,
  type OrderValueBreakdownLabels,
} from './payment-modal/order-value-breakdown-panel';
import {
  PaymentQuickTenderChips,
  type PaymentQuickTenderChipItem,
} from './payment-modal/quick-tender-chips';
import type { PaymentKeypadKey } from './payment-modal-v4.utils';
import { isLegOnSimpleFace } from './payment-modal-v4.utils';
import { CmxSummaryMessage } from '@ui/feedback';

/**
 * Props for {@link PaymentSimpleView}. Values and handlers are threaded from
 * the container (`payment-full-view.tsx`), which owns the engine call.
 */
export interface PaymentSimpleViewProps {
  currencyCode: string;
  decimalPlaces: number;
  formatAmount: (n: number) => string;
  moneyEpsilon: number;
  totalsLoading: boolean;
  submitBusy: boolean;
  // ---- method chips ----
  methodsLoading: boolean;
  /** Pre-filtered Simple-safe options (`deriveSimpleModeMethodOptions`). */
  methodOptions: CheckoutSettlementOption[];
  paymentLegs: PaymentLeg[];
  activeLeg: PaymentLeg | undefined;
  activeLegIndex: number;
  getOptionDisplayName: (
    option: CheckoutSettlementOption | null | undefined,
    fallback: string
  ) => string;
  onMethodSelect: (option: CheckoutSettlementOption) => void;
  /** Switches to the Full face (splits, gift cards, B2B/AR, promo…). */
  onMoreOptions: () => void;
  // ---- manual discount (shared PaymentDiscountFields; hidden when the
  // tenant has the Discounts & Credits section turned off, or no positive
  // order total exists yet to discount against) ----
  showDiscounts: boolean;
  discountControl: Control<PaymentFormData>;
  discountSetValue: UseFormSetValue<PaymentFormData>;
  discountErrors: Pick<FieldErrors<PaymentFormData>, 'amountDiscount' | 'percentDiscount'>;
  /** Order total the discount is clamped against (pre-discount value). */
  discountTotal: number;
  // ---- amount editor ----
  amountInputRef: RefObject<HTMLInputElement | null>;
  activeAmountDraft: string;
  amountValue: number | null;
  onAmountValueChange: (value: number | null, draft: string) => void;
  /**
   * When true, do not autofocus this amount field (e.g. Split / Store credit
   * dialog is open and owns the amount cursor).
   */
  suppressAmountAutofocus?: boolean;
  /** Amber hard-gate / cash-cap notice from the engine (QA-R4.5). */
  amountCapHint?: string | null;
  /** Pay-extra intent — unlocks zero-amount method detail fields. */
  payExtraIntent?: boolean;
  quickTenderItems: PaymentQuickTenderChipItem[];
  onQuickTenderSelect: (item: PaymentQuickTenderChipItem) => void;
  onKeypadPress: (key: PaymentKeypadKey) => void;
  /** Exact / fill-remaining for the active Simple leg (engine-capped). */
  onExactAmount: () => void;
  exactAmountDisabled?: boolean;
  // ---- per-method detail fields (shared PaymentLegDetailFields) ----
  activeLegOption: CheckoutSettlementOption | undefined;
  updateLeg: PaymentEngineActions['updateLeg'];
  branchPaymentTerminals: PaymentTerminalOption[];
  cardBrands: OrgCardBrandConfig[];
  creditMethodCodes: string[];
  // ---- cash drawer (bound line only; blocked/ambiguous escalate upstream) ----
  cashDrawerRequired: boolean;
  /** Resolved "Drawer • session" display, or null while unbound. */
  cashDrawerDisplay: string | null;
  onManageCashDrawer: () => void;
  // ---- full-story order value (gross → discounts → tax), shared with the
  // Full-view financial inspector via the same computed model ----
  orderValueBreakdown: OrderValueBreakdownModel;
  orderValueBreakdownLabels: OrderValueBreakdownLabels;
  orderValueBreakdownTaxLoading?: boolean;
  // ---- receipt ----
  saleTotal: number;
  amountAppliedToOrder: number;
  displayChangeAmount: number;
  remainingBalance: number;
  settled: boolean;
  balanceStatusLabel: string;
  balanceStatusAnnouncement: string;
  /** Real-payment lines for expandable Settlement Now (Simple receipt). */
  realPaymentSummaryItems: SettlementNowLineItem[];
  /** Credit / stored-value lines (includes gift card when applied). */
  storedValueSummaryItems: SettlementNowLineItem[];
  // ---- remaining-balance policy ----
  policyLabel: string;
  onChangeBalancePolicy: () => void;
  // ---- capability quick actions (left rail on md+; below pay/receipt on mobile) ----
  /** Optional capability quick-action tiles for the fast lane; omit for none. */
  quickActions?: ReactNode;
}

/**
 * Renders the Simple payment face inside the shared modal chrome (header,
 * footer CTA, and confirm dialogs stay in the container so both faces share
 * one submit contract).
 *
 * @param props - {@link PaymentSimpleViewProps}.
 * @returns The Simple-mode dialog body.
 */
export function PaymentSimpleView(props: PaymentSimpleViewProps) {
  const {
    currencyCode,
    decimalPlaces,
    formatAmount,
    moneyEpsilon,
    totalsLoading,
    submitBusy,
    methodsLoading,
    methodOptions,
    paymentLegs,
    activeLeg,
    activeLegIndex,
    getOptionDisplayName,
    onMethodSelect,
    onMoreOptions,
    showDiscounts,
    discountControl,
    discountSetValue,
    discountErrors,
    discountTotal,
    amountInputRef,
    activeAmountDraft,
    amountValue,
    onAmountValueChange,
    suppressAmountAutofocus = false,
    amountCapHint,
    payExtraIntent: _payExtraIntent = false,
    activeLegOption,
    updateLeg,
    cardBrands,
    creditMethodCodes,
    quickTenderItems,
    onQuickTenderSelect,
    onKeypadPress,
    onExactAmount,
    exactAmountDisabled = false,
    branchPaymentTerminals,
    cashDrawerRequired,
    cashDrawerDisplay,
    onManageCashDrawer,
    orderValueBreakdown,
    orderValueBreakdownLabels,
    orderValueBreakdownTaxLoading,
    saleTotal,
    amountAppliedToOrder,
    displayChangeAmount,
    remainingBalance,
    settled,
    balanceStatusLabel,
    balanceStatusAnnouncement,
    realPaymentSummaryItems,
    storedValueSummaryItems,
    policyLabel,
    onChangeBalancePolicy,
    quickActions,
  } = props;

  const t = useTranslations('newOrder.payment');
  const isRTL = useRTL();

  const hasQuickActions = quickActions != null;

  return (
    <div
      data-testid="payment-simple-view"
      data-has-quick-actions={hasQuickActions ? 'true' : undefined}
      className={`mx-auto grid w-full items-stretch gap-3 ${
        hasQuickActions
          ? 'max-w-[1280px] md:grid-cols-[minmax(168px,200px)_minmax(0,1.45fr)_minmax(280px,1fr)]'
          : 'max-w-[1100px] md:grid-cols-[minmax(420px,1.4fr)_minmax(300px,1fr)]'
      }`}
    >
      {/* ---- QUICK ACTIONS rail (left on md+; after pay/receipt on mobile) ---- */}
      {hasQuickActions ? (
        <div
          data-testid="payment-simple-quick-actions-rail"
          className="order-3 min-w-0 md:order-1 md:self-stretch"
        >
          {quickActions}
        </div>
      ) : null}

      {/* ---- PAY column ---- */}
      <CmxCard
        className={`border-slate-200 bg-white shadow-sm ${hasQuickActions ? 'order-1 h-full md:order-2' : ''}`}
      >
        <CmxCardContent className="space-y-5 pt-5">
          {/* Method chips */}
          <div>
            <p className={`mb-2 text-xs font-semibold text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('mode.simpleView.methodLabel')}
            </p>
            {methodsLoading ? (
              <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <CmxSkeleton className="h-12 w-28" />
                <CmxSkeleton className="h-12 w-28" />
              </div>
            ) : (
              <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div
                  role="radiogroup"
                  aria-label={t('mode.simpleView.methodLabel')}
                  className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
                  onKeyDown={(event) => {
                    if (
                      event.key !== 'ArrowRight' &&
                      event.key !== 'ArrowLeft' &&
                      event.key !== 'ArrowDown' &&
                      event.key !== 'ArrowUp' &&
                      event.key !== 'Home' &&
                      event.key !== 'End'
                    ) {
                      return;
                    }
                    const buttons = Array.from(
                      event.currentTarget.querySelectorAll<HTMLButtonElement>(
                        'button[role="radio"]:not(:disabled)',
                      ),
                    );
                    if (buttons.length === 0) return;
                    const currentIndex = buttons.findIndex(
                      (button) => button === document.activeElement,
                    );
                    if (currentIndex < 0) return;

                    let nextIndex = currentIndex;
                    if (event.key === 'Home') {
                      nextIndex = 0;
                    } else if (event.key === 'End') {
                      nextIndex = buttons.length - 1;
                    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      const delta = event.key === 'ArrowDown' ? 1 : -1;
                      nextIndex =
                        (currentIndex + delta + buttons.length) % buttons.length;
                    } else {
                      // ArrowLeft / ArrowRight — flip direction in RTL.
                      const visualNext =
                        (event.key === 'ArrowRight' && !isRTL) ||
                        (event.key === 'ArrowLeft' && isRTL);
                      const delta = visualNext ? 1 : -1;
                      nextIndex =
                        (currentIndex + delta + buttons.length) % buttons.length;
                    }

                    event.preventDefault();
                    const nextButton = buttons[nextIndex];
                    nextButton?.focus();
                    nextButton?.click();
                  }}
                >
                  {methodOptions.map((option) => {
                    const methodKey = `${option.payment_method_code}::${option.gateway_code ?? ''}`;
                    const isActive =
                      activeLeg != null &&
                      `${activeLeg.method}::${activeLeg.gateway_code ?? ''}` === methodKey;
                    const hasLeg = paymentLegs.some(
                      (leg) => `${leg.method}::${leg.gateway_code ?? ''}` === methodKey
                    );
                    return (
                      <CmxButton
                        key={methodKey}
                        type="button"
                        role="radio"
                        variant="outline"
                        size="lg"
                        data-testid={`payment-simple-method-${methodKey
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-|-$/g, '')}`}
                        aria-checked={isActive}
                        tabIndex={
                          isActive || (!activeLeg && methodOptions[0] === option) ? 0 : -1
                        }
                        onClick={() => onMethodSelect(option)}
                        className={`min-h-[48px] rounded-2xl px-4 font-semibold ${
                          isActive
                            ? 'border-teal-300 bg-teal-50 text-teal-900 hover:bg-teal-100'
                            : hasLeg
                              ? 'border-slate-300 bg-slate-50 text-slate-800 hover:border-slate-400'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        } ${isRTL ? 'flex-row-reverse' : ''}`}
                      >
                        {option.payment_method_code === PAYMENT_METHODS.CASH ? (
                          <Banknote className="me-2 h-4 w-4" />
                        ) : (
                          <CreditCard className="me-2 h-4 w-4" />
                        )}
                        {getOptionDisplayName(option, option.payment_method_code)}
                      </CmxButton>
                    );
                  })}
                </div>
                <CmxButton
                  type="button"
                  variant="outline"
                  size="lg"
                  data-testid="payment-simple-more-options"
                  onClick={onMoreOptions}
                  className={`min-h-[48px] rounded-2xl border-dashed border-slate-300 px-4 font-semibold text-slate-600 hover:border-cyan-300 hover:text-cyan-800 ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  <EllipsisVertical className="me-2 h-4 w-4" />
                  {t('mode.simpleView.moreOptions')}
                </CmxButton>
              </div>
            )}
          </div>

          {!activeLeg &&
          paymentLegs.some((leg) => !isLegOnSimpleFace(leg, methodOptions)) ? (
            <div data-testid="payment-simple-advanced-leg-hint">
              <CmxSummaryMessage
                type="info"
                title={t('mode.simpleView.advancedLegActiveTitle')}
                items={[t('mode.simpleView.advancedLegActiveHint')]}
              />
            </div>
          ) : null}

          {/* Manual discount — same OMR/% fields as the Full workbench (shared
              PaymentDiscountFields primitive), so a plain discount no longer
              requires escalating out of Simple. */}
          {showDiscounts ? (
            <PaymentDiscountFields
              control={discountControl}
              setValue={discountSetValue}
              errors={discountErrors}
              total={discountTotal}
              decimalPlaces={decimalPlaces}
              className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
            />
          ) : null}

          {/* Amount hero — shared PaymentAmountMoneyField (keypad / Exact) */}
          <div>
            <p className={`mb-2 text-xs font-semibold text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('mode.simpleView.amountLabel')}
            </p>
            <PaymentAmountMoneyField
              size="hero"
              currencyCode={currencyCode}
              decimalPlaces={decimalPlaces}
              formatAmount={formatAmount}
              value={amountValue}
              draftValue={activeAmountDraft}
              onValueChange={onAmountValueChange}
              onKeypadPress={onKeypadPress}
              inputRef={amountInputRef}
              disabled={!activeLeg}
              focusToken={
                activeLeg && !suppressAmountAutofocus
                  ? `${activeLegIndex}:${activeLeg.method}:${activeLeg.gateway_code ?? ''}`
                  : null
              }
              isRTL={isRTL}
              amountAriaLabel={t('workspace.editingAmount')}
              keypadTitle={t('mode.simpleView.keypadTitle')}
              keypadDock={t('mode.simpleView.keypadDock')}
              keypadClose={t('mode.simpleView.keypadClose')}
              keypadHint={t('mode.simpleView.keypadHint')}
              keypadRestored={t('mode.simpleView.keypadRestored')}
              keypadStorageKey="cmx:payment-keypad-pos"
              showExact
              exactLabel={t('quickTender.exact')}
              exactAriaLabel={t('quickTender.exactAria', {
                amount: `${currencyCode} ${formatAmount(amountValue ?? 0)}`,
              })}
              onExact={onExactAmount}
              exactDisabled={!activeLeg || exactAmountDisabled || submitBusy}
              remainingHint={amountCapHint ?? undefined}
              testId="payment-amount-editor"
            />
            {!activeLeg ? (
              <p className={`mt-2 text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('mode.simpleView.pickMethodHint')}
              </p>
            ) : null}
          </div>

          {/* Cash denomination shortcuts only — Exact is on the amount field above. */}
          <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <PaymentQuickTenderChips
              items={quickTenderItems}
              onSelect={onQuickTenderSelect}
              disabled={!activeLeg || submitBusy}
              isRTL={isRTL}
            />
          </div>

          {/* Per-method detail fields — shared single-source component (also used
              by the Full workbench + the split dialog). For CASH it shows the
              tendered + change breakdown. */}
          {activeLeg ? (
            <PaymentLegDetailFields
              leg={activeLeg}
              legIndex={activeLegIndex}
              option={activeLegOption}
              updateLeg={updateLeg}
              branchPaymentTerminals={branchPaymentTerminals}
              cardBrands={cardBrands}
              creditMethodCodes={creditMethodCodes}
              showCashTenderedChange
              currencyCode={currencyCode}
              formatAmount={formatAmount}
            />
          ) : null}

          {/* Cash drawer bound line */}
          {cashDrawerRequired ? (
            <div
              data-testid="payment-simple-cash-drawer"
              className={`flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <p className="min-w-0 truncate text-xs text-slate-600">
                <span className="font-semibold text-slate-700">{t('cashDrawer.title')}</span>
                {' · '}
                {cashDrawerDisplay ?? t('cashDrawer.pendingBadge')}
              </p>
              <CmxButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={onManageCashDrawer}
                className="min-h-[44px] shrink-0 rounded-lg text-cyan-700"
              >
                {t('mode.simpleView.manage')}
              </CmxButton>
            </div>
          ) : null}

          {/* Remaining-balance policy line */}
          {remainingBalance > moneyEpsilon ? (
            <div
              data-testid="payment-simple-policy"
              className={`flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <p className="min-w-0 text-xs text-amber-900">
                <span className="font-semibold">
                  {t('mode.simpleView.remaining')}: {currencyCode} {formatAmount(remainingBalance)}
                </span>
                {' · '}
                {policyLabel}
              </p>
              <CmxButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={onChangeBalancePolicy}
                className="min-h-[44px] shrink-0 rounded-lg text-amber-800"
              >
                {t('mode.simpleView.changePolicy')}
              </CmxButton>
            </div>
          ) : null}
        </CmxCardContent>
      </CmxCard>

      {/* ---- RECEIPT column ---- */}
      <CmxCard
        className={`border-slate-200 bg-white shadow-sm ${hasQuickActions ? 'order-2 h-full md:order-3' : ''}`}
      >
        <CmxCardContent className="space-y-1.5 pt-5">
          <p className={`mb-2 text-xs font-semibold text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('mode.simpleView.receiptTitle')}
          </p>
          {/* Full-story breakdown (gross → discounts → tax) — only surfaced
              once there's a discount to explain; otherwise the single Order
              Total row below already tells the whole story. */}
          {orderValueBreakdown.discountRows.length > 0 ? (
            <div className="pb-2">
              <OrderValueBreakdownPanel
                model={orderValueBreakdown}
                labels={orderValueBreakdownLabels}
                isRTL={isRTL}
                taxLoading={orderValueBreakdownTaxLoading}
              />
            </div>
          ) : null}
          <SummaryRow
            label={t('rightRail.orderTotal')}
            value={`${currencyCode} ${formatAmount(saleTotal)}`}
            loading={totalsLoading}
            bold={orderValueBreakdown.discountRows.length > 0}
          />
          <SettlementNowBreakdown
            currencyCode={currencyCode}
            formatAmount={formatAmount}
            amountAppliedToOrder={amountAppliedToOrder}
            realPaymentItems={realPaymentSummaryItems}
            creditItems={storedValueSummaryItems}
            totalsLoading={totalsLoading}
            isRTL={isRTL}
            moneyEpsilon={moneyEpsilon}
            labels={{
              totalSettledNow: t('rightRail.totalSettledNow'),
              realPaymentsReceived: t('rightRail.realPaymentsReceived'),
              creditsApplied: t('rightRail.creditsApplied'),
              noneApplied: t('rightRail.noneApplied'),
              tendersSummary: t('mode.simpleView.settledNowTenders', {
                count:
                  realPaymentSummaryItems.length + storedValueSummaryItems.length,
              }),
              expand: t('mode.simpleView.settledNowExpand'),
              collapse: t('mode.simpleView.settledNowCollapse'),
            }}
          />
          {remainingBalance > moneyEpsilon ? (
            <SummaryRow
              label={t('rightRail.remainingBalance')}
              value={`${currencyCode} ${formatAmount(remainingBalance)}`}
              loading={totalsLoading}
              negative
            />
          ) : null}
          <div className={`mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm font-bold text-slate-900">
              {t('mode.simpleView.change')}
            </span>
            <span
              data-testid="payment-simple-change"
              className={`text-2xl font-bold tabular-nums transition-colors duration-300 motion-reduce:transition-none ${
                displayChangeAmount > moneyEpsilon ? 'text-emerald-600' : 'text-slate-900'
              }`}
            >
              {currencyCode} {formatAmount(displayChangeAmount)}
            </span>
          </div>
          <p
            data-testid="payment-simple-status"
            className={`mt-1 text-sm font-medium ${settled ? 'text-emerald-700' : 'text-slate-600'} ${isRTL ? 'text-right' : 'text-left'}`}
          >
            {settled ? '✓ ' : ''}
            {balanceStatusLabel}
          </p>
          {/* Polite live region (finding 1.4 pattern) — announces settle/change
              transitions without double-reading the visible status line. */}
          <p role="status" aria-live="polite" className="sr-only">
            {balanceStatusAnnouncement}
          </p>
        </CmxCardContent>
      </CmxCard>
    </div>
  );
}
