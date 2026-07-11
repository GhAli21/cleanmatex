'use client';

/**
 * Payment Modal V4 — Simple face (Phase 4, single engine two modes).
 *
 * The ~80% cash/card fast lane: method chips, one hero amount editor,
 * quick-tender chips, an optional keypad, and a compact receipt card. Purely
 * presentational — every value and handler comes from the engine via
 * `PaymentFullView` (the mounted container that owns mode state), so this face
 * can never fork finance logic or the submit payload. Anything advanced
 * (splits, gift cards, B2B/AR, overpayment routing, drawer conflicts) trips
 * `computeNeedsAdvanced` in the engine and the container escalates to the Full
 * face with all state intact.
 *
 * See `docs/features/Order_Fin/ADR/ADR_payment_modal_single_engine_two_mode.md`.
 */

import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import type { Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import { Banknote, CreditCard, EllipsisVertical, Keyboard } from 'lucide-react';
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
import { CmxButton, CmxMoneyField, CmxSkeleton } from '@ui/primitives';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { KEYPAD_PAYMENT_4COL, PAYMENT_KEY_VARIANT, PAYMENT_KEY_CLASS } from '@ui/utilities';
import { CmxKeypadPopover } from '@ui/overlays';
import { SummaryRow } from './payment-modal/summary-row';
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
  /** Amber hard-gate / cash-cap notice from the engine (QA-R4.5). */
  amountCapHint?: string | null;
  /** Pay-extra intent — unlocks zero-amount method detail fields. */
  payExtraIntent?: boolean;
  quickTenderItems: PaymentQuickTenderChipItem[];
  onQuickTenderSelect: (item: PaymentQuickTenderChipItem) => void;
  onKeypadPress: (key: PaymentKeypadKey) => void;
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
  // ---- remaining-balance policy ----
  policyLabel: string;
  onChangeBalancePolicy: () => void;
  // ---- capability quick actions (rendered below the receipt) ----
  /** Optional capability quick-action buttons for the fast lane; omit for none. */
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
    amountCapHint,
    payExtraIntent: _payExtraIntent = false,
    activeLegOption,
    updateLeg,
    cardBrands,
    creditMethodCodes,
    quickTenderItems,
    onQuickTenderSelect,
    onKeypadPress,
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
    policyLabel,
    onChangeBalancePolicy,
    quickActions,
  } = props;

  const t = useTranslations('newOrder.payment');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const [showKeypad, setShowKeypad] = useState(false);
  const keypadTriggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div
      data-testid="payment-simple-view"
      className="mx-auto grid w-full max-w-[1100px] items-start gap-4 md:grid-cols-[minmax(420px,1.4fr)_minmax(300px,1fr)]"
    >
      {/* ---- PAY column ---- */}
      <CmxCard className="border-slate-200 bg-white shadow-sm">
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
                      variant="outline"
                      size="lg"
                      data-testid={`payment-simple-method-${methodKey
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '')}`}
                      aria-pressed={isActive}
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

          {/* Amount hero */}
          <div>
            <p className={`mb-2 text-xs font-semibold text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('mode.simpleView.amountLabel')}
            </p>
            <div className="flex items-stretch rounded-2xl border border-slate-200 bg-white shadow-inner">
              <div className="flex min-w-[88px] items-center justify-center rounded-s-2xl border-e border-slate-200 bg-slate-100 px-4 text-lg font-semibold text-cyan-700">
                {currencyCode}
              </div>
              <div className="min-w-0 flex-1 px-3">
                <CmxMoneyField
                  ref={amountInputRef}
                  data-testid="payment-amount-editor"
                  draftValue={activeAmountDraft}
                  value={amountValue}
                  decimalPlaces={decimalPlaces}
                  showZero
                  aria-label={t('workspace.editingAmount')}
                  onValueChange={onAmountValueChange}
                  placeholder={formatAmount(0)}
                  disabled={!activeLeg}
                  className="h-16 border-0 bg-transparent px-0 text-[2.2rem] font-bold tracking-tight text-slate-900 shadow-none focus-visible:ring-0"
                />
              </div>
              {/* Movable keypad trigger — opens the draggable CmxKeypadPopover
                  anchored here; replaces the old inline show/hide keypad. */}
              <button
                ref={keypadTriggerRef}
                type="button"
                data-testid="payment-simple-keypad-toggle"
                aria-pressed={showKeypad}
                aria-label={t('mode.simpleView.keypadTitle')}
                disabled={!activeLeg}
                onClick={() => setShowKeypad((prev) => !prev)}
                className={`flex min-w-14 items-center justify-center rounded-e-2xl border-s border-slate-200 px-4 transition-colors disabled:opacity-40 ${
                  showKeypad
                    ? 'bg-cyan-50 text-cyan-700'
                    : 'bg-slate-50 text-slate-500 hover:text-cyan-700'
                }`}
              >
                <Keyboard className="h-5 w-5" />
              </button>
            </div>
            {amountCapHint ? (
              <p
                className={`mt-2 text-xs text-amber-700 ${isRTL ? 'text-right' : 'text-left'}`}
                role="status"
              >
                {amountCapHint}
              </p>
            ) : null}
            {!activeLeg ? (
              <p className={`mt-2 text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('mode.simpleView.pickMethodHint')}
              </p>
            ) : null}
          </div>

          {/* Quick tender */}
          <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <PaymentQuickTenderChips
              items={quickTenderItems}
              onSelect={onQuickTenderSelect}
              disabled={!activeLeg || submitBusy}
              isRTL={isRTL}
            />
          </div>

          {/* Movable, non-modal numeric keypad — launched from the amount-field
              trigger above; remembers its position per device. */}
          <CmxKeypadPopover
            open={showKeypad}
            onClose={() => setShowKeypad(false)}
            anchorRef={keypadTriggerRef}
            storageKey="cmx:payment-keypad-pos"
            isRTL={isRTL}
            disabled={!activeLeg}
            title={t('mode.simpleView.keypadTitle')}
            echo={`${currencyCode} ${formatAmount(amountValue ?? 0)}`}
            dockLabel={t('mode.simpleView.keypadDock')}
            closeLabel={t('mode.simpleView.keypadClose')}
            hint={t('mode.simpleView.keypadHint')}
            restoredAnnouncement={t('mode.simpleView.keypadRestored')}
            keys={KEYPAD_PAYMENT_4COL}
            onKeyPress={onKeypadPress}
            onKeyLongPress={(key) => {
              if (key === 'backspace') onKeypadPress('clear');
            }}
            getKeyVariant={PAYMENT_KEY_VARIANT}
            getKeyClassName={PAYMENT_KEY_CLASS}
            getKeyAriaLabel={(key) => {
              if (key === 'backspace') return t('workspace.backspace');
              if (key === 'clear') return tCommon('clear');
              return undefined;
            }}
            renderKeyLabel={(key) => {
              if (key === 'backspace') return '⌫';
              if (key === 'clear') return tCommon('clear');
              return key;
            }}
          />

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
      <CmxCard className="border-slate-200 bg-white shadow-sm">
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
          <SummaryRow
            label={t('rightRail.totalSettledNow')}
            value={`${currencyCode} ${formatAmount(amountAppliedToOrder)}`}
            loading={totalsLoading}
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

      {/* Capability quick actions — common advanced tenders on the fast lane
          (only the available ones render; driven by the capability plan). */}
      {quickActions}
    </div>
  );
}
