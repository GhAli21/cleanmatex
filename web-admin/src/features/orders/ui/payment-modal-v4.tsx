/**
 * Payment Modal V4
 * Touch-optimized payment modal with method rail, keypad workspace, and summary rail.
 */

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import { useForm, Controller, type FieldErrors, type Resolver } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  X, CreditCard, Banknote, Package, FileText, CheckSquare,
  Loader2,
  Eye, EyeOff, Maximize2, Trash2, Wallet, UserRound,
  ArrowRightLeft, ShieldCheck, CircleAlert, EllipsisVertical, Plus, Info, RefreshCw,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { validatePromoCodeAction } from '@/app/actions/payments/validate-promo';
import { validateGiftCardAction } from '@/app/actions/payments/validate-gift-card';
import { getCurrencyConfigAction } from '@/app/actions/tenant/get-currency-config';
import { getTaxProfilesAction } from '@/app/actions/settings/tax-actions';
import type { ValidatePromoCodeResult, ValidateGiftCardResult, OrgCardBrandConfig } from '@/lib/types/payment';
import { getPaymentFormSchema, type PaymentFormData } from '@features/orders/model/payment-form-schema';
import { taxService } from '@/lib/services/tax.service';
import {
  newOrderPaymentPayloadSchema,
  type NewOrderPaymentPayload,
  type OutstandingPolicy,
  type PaymentLeg,
} from '@/lib/validations/new-order-payment-schemas';
import { CmxConfirmDialog, CmxSummaryMessage, cmxMessage } from '@ui/feedback';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { NEW_ORDER_PROMO_GIFT_DISABLED } from '@/lib/constants/order-checkout-flags';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import type { Control } from 'react-hook-form';
import type { PaymentMethodCode } from '@/lib/constants/order-types';
import {
  applyKeypadInput,
  capPaymentLegAmount,
  deriveCashTenderedAmount,
  deriveChangeReturnedAmount,
  deriveLegAppliedAmount,
  deriveOutstandingPolicy,
  formatDecimalDraft,
  getPreferredCashDrawerStorageKey,
  getAmountAppliedToOrder,
  getDisplayChangeAmount,
  getNetCashRetainedAmount,
  getRemainingToAllocate,
  getSuggestedDefaultLegAmount,
  getSuggestedStoredValueAmount,
  getUnresolvedOverpaymentAmount,
  reconcilePaymentLegAmounts,
  resolvePreferredCashDrawerSessionId,
  walletLegExceedsBalance,
  parseDecimalDraft,
  sanitizeDecimalDraft,
  syncDiscountFromPercent,
  syncDiscountPercentFromAmount,
  todayYyyyMmDd,
  validateCheckDueDate,
  legHasRequiredPaymentReference,
  wasPaymentLegAmountCapped,
  getStoredValueCapForLeg,
  canReturnChangeFromAllCashLegs,
  type PaymentKeypadKey,
} from './payment-modal-v4.utils';
import { PaymentModalV4CreditNotePicker } from './payment-modal-v4-credit-note-picker';
import {
  ExtraReceiptHandlingCard,
} from './payment-modal/allocation/extra-receipt-handling-card';
import { buildOverpaymentResolutionPayload } from './payment-modal/allocation/build-overpayment-resolution';
import { AutoAllocationPreviewDrawer } from './payment-modal/allocation/auto-allocation-preview-drawer';
import { ManualAllocationDrawer } from './payment-modal/allocation/manual-allocation-drawer';
import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';
import { useOverpaymentAllocation } from '@features/orders/hooks/use-overpayment-allocation';
import { ensurePaymentLegRefs } from '@/lib/payments/ensure-payment-leg-refs';
import { resolvePaymentOverpaymentPolicy } from '@/lib/payments/overpayment-policy';
import {
  derivePaymentModalRightRailState,
  RIGHT_RAIL_BALANCE_STATUS,
  RIGHT_RAIL_REQUIRED_ACTION,
  RIGHT_RAIL_WARNING,
  type PaymentModalRightRailState,
} from './payment-modal-v4.right-rail';
import {
  derivePaymentInspectorTabs,
  deriveVisiblePaymentSections,
  PAYMENT_MODAL_INSPECTOR_TAB_IDS,
  PAYMENT_MODAL_SECTION_IDS,
  PAYMENT_MODAL_V04_SHOW_LIVE_EFFECT,
} from './payment-modal-v04-sections-definition';

// Cmx component imports
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton, CmxCheckbox } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { CmxMoneyField } from '@ui/primitives';
import { CmxTextarea } from '@ui/primitives';
import { CmxSkeleton } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxKeypad, KEYPAD_PAYMENT_4COL, PAYMENT_KEY_VARIANT, PAYMENT_KEY_CLASS } from '@ui/utilities';
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms';
import { CmxTabsPanel, type CmxTabItem } from '@ui/navigation';
import { showErrorToast } from '@ui/components/cmx-toast';

// ---------------------------------------------------------------------------
// B2B contract selector
// ---------------------------------------------------------------------------
function B2BContractsSelect({
  customerId,
  control,
  isRTL,
}: {
  customerId: string;
  control: Control<PaymentFormData>;
  isRTL: boolean;
}) {
  const t = useTranslations('newOrder.payment');
  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['b2b-contracts', 'customer', customerId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/b2b-contracts?customer_id=${customerId}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as Array<{ id: string; contractNo: string }>;
    },
    enabled: !!customerId,
  });

  const noneLabel = t('b2b.contractOptional') || 'None (optional)';

  return (
    <div>
      <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
        {t('b2b.contract') || 'Contract'}
      </label>
      <Controller
        name="b2bContractId"
        control={control}
        render={({ field }) => {
          const selectedLabel =
            contracts.find((c) => c.id === field.value)?.contractNo ?? noneLabel;
          return (
            <CmxSelectDropdown
              value={field.value || ''}
              onValueChange={(v) => field.onChange(v || undefined)}
              isLoading={isLoading}
              emptyLabel={t('b2b.contractOptional') || 'None (optional)'}
            >
              <CmxSelectDropdownTrigger dir={isRTL ? 'rtl' : 'ltr'}>
                <CmxSelectDropdownValue
                  displayValue={selectedLabel}
                  placeholder={noneLabel}
                />
              </CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                <CmxSelectDropdownItem value="">
                  {noneLabel}
                </CmxSelectDropdownItem>
                {contracts.map((c) => (
                  <CmxSelectDropdownItem key={c.id} value={c.id}>
                    {c.contractNo}
                  </CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          );
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
type CheckoutSettlementOption = {
  id: string;
  payment_method_code: string;
  payment_nature: string;
  gateway_code: string | null;
  display_name: string;
  display_name2: string | null;
  description: string | null;
  description2: string | null;
  requires_cash_drawer: boolean;
  requires_terminal: boolean;
  supports_overpayment: boolean;
  supports_change_return: boolean;
  requires_reference: boolean;
  allowed_in_pos: boolean;
  allowed_for_pay_now?: boolean | null;
  allowed_for_pay_on_collection?: boolean | null;
  allowed_for_invoice_payment?: boolean | null;
  credit_application_type?: string | null;
  available_balance?: number | null;
  requires_credit_reference_selection?: boolean;
  display_order?: number | null;
};

type CheckoutOptionsResponse = {
  paymentMethods: CheckoutSettlementOption[];
  customerCredits: CheckoutSettlementOption[];
};

type CashDrawerSessionOption = {
  id: string;
  session_no: string;
  opened_at: string | null;
  opening_float_amount: number;
};

type CashDrawerOption = {
  id: string;
  branch_id: string | null;
  drawer_name: string;
  drawer_name2: string | null;
  drawer_type: string;
  currency_code: string;
  requires_session: boolean;
  opening_float_required: boolean;
  currentSession: CashDrawerSessionOption | null;
};

type StoredValueSummaryResponse = {
  wallet: {
    walletId: string | null;
    balance: number;
    currencyCode: string | null;
  };
  advance: {
    advanceId: string | null;
    balance: number;
    currencyCode: string | null;
  };
  creditNoteTotal: number;
  creditNotes: Array<{
    id: string;
    remaining_balance: number;
    currency_code: string;
  }>;
};


interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (paymentData: PaymentFormData, payload: NewOrderPaymentPayload) => void;
  total: number;
  /** Order amount for checkout-options eligibility; defaults to preview saleTotal when loaded. */
  checkoutAmount?: number;
  items: { productId: string; quantity: number; priceOverride?: number | null; servicePrefCharge?: number; packingPrefCharge?: number }[];
  isExpress?: boolean;
  tenantOrgId: string;
  customerId?: string;
  customerType?: string;
  customerDisplayName?: string;
  customerPhone?: string;
  serviceCategories?: string[];
  branchId?: string;
  userId?: string;
  isRetailOnlyOrder?: boolean;
  loading?: boolean;
  initialPaymentNotes?: string;
}

// ---------------------------------------------------------------------------
// SummaryRow helper — label + right-aligned value with skeleton fallback
// ---------------------------------------------------------------------------
function SummaryRow({
  label,
  value,
  loading,
  bold,
  negative,
}: {
  label: string;
  value: string;
  loading?: boolean;
  bold?: boolean;
  negative?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center gap-2 ${bold ? 'font-bold border-t border-gray-100 pt-1.5 mt-1' : ''}`}>
      <span className={`text-sm ${bold ? 'text-gray-900' : 'text-gray-600'}`}>{label}</span>
      {loading ? (
        <CmxSkeleton className="h-4 w-20" />
      ) : (
        <span className={`text-sm tabular-nums ${bold ? 'text-gray-900' : negative ? 'text-red-700' : 'text-gray-900'} font-medium`}>
          {value}
        </span>
      )}
    </div>
  );
}

type RightRailSummaryItem = {
  label: string;
  value: string;
  negative?: boolean;
};

type OrderValueBreakdownRow = RightRailSummaryItem & {
  id: string;
};

type OrderValueBreakdownModel = {
  grossRows: OrderValueBreakdownRow[];
  discountRows: OrderValueBreakdownRow[];
  taxRows: OrderValueBreakdownRow[];
  totalRow: OrderValueBreakdownRow;
};

function OrderValueBreakdownPanel({
  model,
  labels,
  isRTL,
  taxLoading,
}: {
  model: OrderValueBreakdownModel;
  labels: {
    grossValue: string;
    grossValueHelp: string;
    discounts: string;
    discountsHelp: string;
    taxes: string;
    taxesHelp: string;
    finalTotal: string;
    finalTotalHelp: string;
  };
  isRTL: boolean;
  taxLoading?: boolean;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <p className="text-sm font-semibold text-slate-900">{labels.grossValue}</p>
            <p className="mt-1 text-xs text-slate-500">{labels.grossValueHelp}</p>
          </div>
          <div className="mt-3 space-y-2">
            {model.grossRows.map((row) => (
              <SummaryRow key={row.id} label={row.label} value={row.value} />
            ))}
          </div>
        </div>

        {model.discountRows.length > 0 ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className="text-sm font-semibold text-rose-900">{labels.discounts}</p>
              <p className="mt-1 text-xs text-rose-700">{labels.discountsHelp}</p>
            </div>
            <div className="mt-3 space-y-2">
              {model.discountRows.map((row) => (
                <SummaryRow key={row.id} label={row.label} value={row.value} negative />
              ))}
            </div>
          </div>
        ) : null}

        {taxLoading ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className="text-sm font-semibold text-amber-950">{labels.taxes}</p>
              <p className="mt-1 text-xs text-amber-700">{labels.taxesHelp}</p>
            </div>
            <div className="mt-3 space-y-2">
              <CmxSkeleton className="h-4 w-full" />
              <CmxSkeleton className="h-4 w-3/4" />
            </div>
          </div>
        ) : model.taxRows.length > 0 ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className="text-sm font-semibold text-amber-950">{labels.taxes}</p>
              <p className="mt-1 text-xs text-amber-700">{labels.taxesHelp}</p>
            </div>
            <div className="mt-3 space-y-2">
              {model.taxRows.map((row) => (
                <SummaryRow key={row.id} label={row.label} value={row.value} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-teal-50 p-4 shadow-sm">
        <p className={`text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700 ${isRTL ? 'text-right' : 'text-left'}`}>
          {labels.finalTotal}
        </p>
        <p className={`mt-3 text-2xl font-bold tabular-nums text-slate-950 ${isRTL ? 'text-right' : 'text-left'}`}>
          {model.totalRow.value}
        </p>
        <p className={`mt-2 text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
          {labels.finalTotalHelp}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
/**
 * Coordinates the V4 cashier payment experience without changing the order
 * payment payload contract used by the submit flow.
 *
 * @param root0 Payment modal props.
 * @param root0.open Controls modal visibility.
 * @param root0.onClose Closes the modal after cancel or successful submit.
 * @param root0.onSubmit Persists the validated payment payload.
 * @param root0.total Trusted order total from the order workspace.
 * @param root0.items Order items used for cashier-facing payment context.
 * @param root0.isExpress Marks whether the order is an express order.
 * @param root0.tenantOrgId Tenant scope required by payment preview lookups.
 * @param root0.customerId Customer identifier for credit, wallet, and gift-card context.
 * @param root0.customerType Customer account type for B2B and AR rules.
 * @param root0.customerDisplayName Cashier-facing customer name.
 * @param root0.customerPhone Cashier-facing customer phone or reference.
 * @param root0.serviceCategories Service categories attached to the order.
 * @param root0.branchId Branch scope used by payment methods and drawer sessions.
 * @param root0.userId Current cashier user identifier for drawer and audit context.
 * @param root0.isRetailOnlyOrder Marks retail-only orders for payment method rules.
 * @param root0.loading Disables submit while the parent order flow is busy.
 * @param root0.initialPaymentNotes Existing payment notes restored when reopening.
 * @returns Payment modal JSX for the active order.
 */
export function PaymentModalV4({
  open,
  onClose,
  onSubmit,
  total,
  checkoutAmount,
  items,
  isExpress = false,
  tenantOrgId,
  customerId,
  customerType,
  customerDisplayName,
  customerPhone,
  serviceCategories,
  branchId,
  userId,
  isRetailOnlyOrder = false,
  loading = false,
  initialPaymentNotes = '',
}: PaymentModalProps) {
  const t = useTranslations('newOrder.payment');
  const tCommon = useTranslations('common');
  const tGiftCardErrors = useTranslations('marketing.giftCards.errors');
  const isRTL = useRTL();
  const isB2BCustomer = customerType === 'b2b';
  const defaultOutstandingPolicy: OutstandingPolicy = isRetailOnlyOrder
    ? 'NONE'
    : isB2BCustomer
      ? 'CREDIT_INVOICE'
      : 'PAY_ON_COLLECTION';
  const defaultPaymentMethod: PaymentMethodCode = isRetailOnlyOrder
    ? PAYMENT_METHODS.CASH
    : isB2BCustomer
      ? PAYMENT_METHODS.INVOICE
      : PAYMENT_METHODS.PAY_ON_COLLECTION;

  const resolveGiftCardError = useCallback(
    (result: ValidateGiftCardResult): string => {
      if (!result.errorCode) {
        return result.error ?? t('giftCard.errors.validationFailed');
      }
      switch (result.errorCode) {
        case 'EXPIRED':              return tGiftCardErrors('EXPIRED');
        case 'INSUFFICIENT_BALANCE': return tGiftCardErrors('INSUFFICIENT_BALANCE');
        case 'INVALID_PIN':          return tGiftCardErrors('INVALID_PIN');
        case 'CARD_SUSPENDED':       return tGiftCardErrors('SUSPENDED');
        case 'VOIDED':               return tGiftCardErrors('VOIDED');
        case 'NOT_FOUND':            return tGiftCardErrors('INVALID_CODE');
        default:                     return result.error ?? t('giftCard.errors.validationFailed');
      }
    },
    [t, tGiftCardErrors]
  );

  const { token: csrfToken } = useCSRFToken();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(
      getPaymentFormSchema(total, t('validation.discountExceedsTotal'))
    ) as Resolver<PaymentFormData>,
    defaultValues: {
      paymentMethod: defaultPaymentMethod,
      checkNumber: '',
      checkBank: '',
      checkDate: '',
      percentDiscount: 0,
      amountDiscount: 0,
      promoCode: '',
      promoCodeId: '',
      promoDiscount: 0,
      giftCardNumber: '',
      giftCardAmount: 0,
      payAllOrders: false,
      paymentNotes: '',
      outstandingPolicy: defaultOutstandingPolicy,
      b2bContractId: '',
      costCenterCode: '',
      poNumber: '',
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
    criteriaMode: 'all',
  });

  const paymentMethod  = watch('paymentMethod');
  const percentDiscount = watch('percentDiscount');
  const amountDiscount  = watch('amountDiscount');
  const promoCode       = watch('promoCode');
  const giftCardNumber  = watch('giftCardNumber');
  const giftCardAmount  = watch('giftCardAmount');
  const outstandingPolicy = watch('outstandingPolicy');

  // Promo code state
  const [promoCodeValidating, setPromoCodeValidating] = useState(false);
  const [promoCodeResult, setPromoCodeResult] = useState<ValidatePromoCodeResult | null>(null);
  const [appliedPromoCode, setAppliedPromoCode] = useState<{
    code: string; id: string; discount: number;
  } | null>(null);

  // Gift card state
  const [giftCardValidating, setGiftCardValidating] = useState(false);
  const [giftCardResult, setGiftCardResult] = useState<ValidateGiftCardResult | null>(null);
  const [giftCardDetails, setGiftCardDetails] = useState<{
    number: string; balance: number; status: string; expiryDate?: string; id?: string; searchStr?: string;
  } | null>(null);
  const [appliedGiftCard, setAppliedGiftCard] = useState<{
    number: string; amount: number; balance: number; id: string;
  } | null>(null);
  const [giftCardPin, setGiftCardPin]     = useState('');
  const [pinRequired, setPinRequired]     = useState(false);
  const [pinVisible, setPinVisible]       = useState(false);
  const [pinFieldError, setPinFieldError] = useState<string | null>(null);

  // Discount draft state
  const [amountDiscountFocused, setAmountDiscountFocused] = useState(false);
  const [amountDiscountDraft, setAmountDiscountDraft] = useState('');

  // Tax state
  const [taxRate, setTaxRate] = useState<number>(0.06);

  /** Server tax profile row kept local to the modal because it only feeds the payment preview. */
  type TaxProfileEntry = {
    id: string;
    name: string;
    name2: string | null;
    tax_type: string;
    rate: number;
    is_compound: boolean;
    enabled: boolean;
  };
  const [taxProfileEntries, setTaxProfileEntries] = useState<TaxProfileEntry[]>([]);

  const [creditLimitOverride, setCreditLimitOverride] = useState(false);
  const [activeLegIndex, setActiveLegIndex] = useState(0);
  const [activeAmountDraft, setActiveAmountDraft] = useState('');
  const [cashOverRemainingNotice, setCashOverRemainingNotice] = useState<string | null>(null);
  const [isDirtySinceOpen, setIsDirtySinceOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<{
    paymentData: PaymentFormData;
    payload: NewOrderPaymentPayload;
  } | null>(null);
  const [selectedCashDrawerSessionId, setSelectedCashDrawerSessionId] = useState('');
  const [cashDrawerDialogOpen, setCashDrawerDialogOpen] = useState(false);
  const [cashDrawerToOpenId, setCashDrawerToOpenId] = useState('');
  const [openingBalanceValue, setOpeningBalanceValue] = useState(0);
  const [openingDrawerSession, setOpeningDrawerSession] = useState(false);
  const [cashDrawerRequestError, setCashDrawerRequestError] = useState<string | null>(null);
  const [creditNotePickerOpen, setCreditNotePickerOpen] = useState(false);
  const [pendingCreditNoteOption, setPendingCreditNoteOption] = useState<CheckoutSettlementOption | null>(null);
  const [paymentLegs, setPaymentLegs] = useState<PaymentLeg[]>([]);
  /** Normalized tax line used to render cashier-facing totals consistently across preview sources. */
  type TaxBreakdownLine = {
    taxType: 'VAT' | 'GST' | 'CUSTOM';
    label: string;
    label2: string | null;
    rate: number;
    isCompound: boolean;
    baseAmount: number;
    taxAmount: number;
    profileId?: string;
  };

  const [serverTotals, setServerTotals] = useState<{
    subtotal: number;
    manualDiscount: number;
    autoRuleDiscount: number;
    promoDiscount: number;
    afterDiscounts: number;
    additionalTaxAmount: number;
    vatValue: number;
    giftCardApplied: number;
    saleTotal: number;
    vatTaxPercent: number;
    taxBreakdown: TaxBreakdownLine[];
    creditLimit?: {
      currentBalance: number;
      creditLimit: number;
      available: number;
      wouldExceed: boolean;
      mode?: 'warn' | 'block';
    };
  } | null>(null);

  const [totalsLoading, setTotalsLoading] = useState(false);
  const checkoutEligibilityAmount = serverTotals?.saleTotal ?? checkoutAmount ?? total;
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeLegDraftSyncKeyRef = useRef<string | null>(null);
  const allocationBaselineRef = useRef<{ saleTotal: number; giftCard: number } | null>(null);
  const pinInputRef  = useRef<HTMLInputElement | null>(null);
  const giftCardDetailsRef = useRef<HTMLDivElement | null>(null);
  const giftCardAmountInputRef = useRef<HTMLInputElement | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const amountDiscountInputRef = useRef<HTMLInputElement | null>(null);
  const percentDiscountInputRef = useRef<HTMLInputElement | null>(null);
  const checkNumberInputRef = useRef<HTMLInputElement | null>(null);
  const checkDateInputRef = useRef<HTMLInputElement | null>(null);
  const payOnCollectionPolicyButtonRef = useRef<HTMLButtonElement | null>(null);
  const creditLimitCardRef = useRef<HTMLDivElement | null>(null);
  const creditLimitOverrideRef = useRef<HTMLInputElement | null>(null);
  const couponCardRef = useRef<HTMLDivElement | null>(null);
  const cashDrawerCardRef = useRef<HTMLDivElement | null>(null);
  const cashDrawerSelectorCardRef = useRef<HTMLDivElement | null>(null);
  const balanceSnapshotSectionRef = useRef<HTMLDivElement | null>(null);
  const extraReceiptCardRef = useRef<HTMLDivElement | null>(null);
  const paymentWorkspaceSectionRef = useRef<HTMLDivElement | null>(null);
  const financialInspectorSectionRef = useRef<HTMLDivElement | null>(null);
  const balancePolicySectionRef = useRef<HTMLDivElement | null>(null);
  const methodsAnchorRef = useRef<HTMLDivElement | null>(null);
  const legsCardRef  = useRef<HTMLDivElement | null>(null);
  const focusTrapRef = useFocusTrap(open, { returnFocus: true });

  const [currencyConfig, setCurrencyConfig] = useState<{
    currencyCode: string; decimalPlaces: number; currencyExRate: number;
  } | null>(null);

  // Active card brands for CARD leg dropdown
  const { data: cardBrands = [] } = useQuery<OrgCardBrandConfig[]>({
    queryKey: ['card-brands-active', tenantOrgId],
    queryFn: async () => {
      const res = await fetch('/api/v1/settings/payments/card-brands');
      if (!res.ok) return [];
      const json = await res.json();
      return ((json.data ?? []) as OrgCardBrandConfig[]).filter((b) => b.is_active);
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  type PaymentTerminalOption = {
    id: string;
    terminal_code: string;
    terminal_name: string;
    terminal_name2: string | null;
    branch_id: string | null;
    is_active: boolean;
  };

  const { data: paymentTerminals = [] } = useQuery<PaymentTerminalOption[]>({
    queryKey: ['payment-terminals-checkout', tenantOrgId, branchId ?? ''],
    queryFn: async () => {
      const res = await fetch('/api/v1/settings/payments/terminals');
      if (!res.ok) return [];
      const json = await res.json();
      return ((json.data ?? []) as PaymentTerminalOption[]).filter((terminal) => terminal.is_active);
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const branchPaymentTerminals = useMemo(
    () =>
      paymentTerminals.filter(
        (terminal) => !branchId || !terminal.branch_id || terminal.branch_id === branchId
      ),
    [branchId, paymentTerminals]
  );

  const { data: checkoutOptions, isLoading: checkoutMethodsLoading } = useQuery<CheckoutOptionsResponse>({
    queryKey: ['checkout-options', tenantOrgId, branchId ?? '', customerId ?? '', checkoutEligibilityAmount],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set('branchId', branchId);
      if (customerId) params.set('customerId', customerId);
      params.set('amount', String(checkoutEligibilityAmount));
      const res = await fetch(`/api/v1/orders/checkout-options?${params.toString()}`);
      if (!res.ok) return { paymentMethods: [], customerCredits: [] };
      const json = await res.json();
      return (json.data ?? { paymentMethods: [], customerCredits: [] }) as CheckoutOptionsResponse;
    },
    enabled: open,
    staleTime: 60_000,
  });

  const {
    data: cashDrawers = [],
    isLoading: cashDrawersLoading,
    isFetching: cashDrawersFetching,
    error: cashDrawersError,
    refetch: refetchCashDrawers,
  } = useQuery<CashDrawerOption[]>({
    queryKey: ['cash-drawers-checkout', tenantOrgId, branchId ?? ''],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set('branchId', branchId);

      const res = await fetch(`/api/v1/cash-drawers?${params.toString()}`);
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(
          typeof json.error === 'string' && json.error.trim().length > 0
            ? json.error
            : 'FAILED_TO_LOAD_CASH_DRAWERS'
        );
      }

      return (json.data ?? []) as CashDrawerOption[];
    },
    enabled: open,
    staleTime: 30_000,
  });

  const checkoutMethods = checkoutOptions?.paymentMethods ?? [];
  const customerCreditOptions = checkoutOptions?.customerCredits ?? [];
  const walletCreditOption = customerCreditOptions.find(
    (option) =>
      option.credit_application_type === 'WALLET' ||
      option.payment_method_code === 'WALLET'
  );

  const {
    data: storedValueSummary,
    isLoading: storedValueLoading,
    isFetching: storedValueFetching,
    refetch: refetchStoredValueSummary,
  } = useQuery<StoredValueSummaryResponse | null>({
    queryKey: ['customer-stored-value-summary', tenantOrgId, customerId ?? ''],
    queryFn: async () => {
      if (!customerId) return null;
      const res = await fetch(`/api/v1/customers/${customerId}/stored-value`);
      if (!res.ok) {
        throw new Error('FAILED_TO_FETCH_STORED_VALUE_SUMMARY');
      }
      const json = await res.json();
      return (json.data ?? null) as StoredValueSummaryResponse | null;
    },
    enabled: open && !!customerId,
    staleTime: 15_000,
  });

  // Load tax rate, currency, and default tax profiles on open
  useEffect(() => {
    if (open && tenantOrgId) {
      taxService.getTaxRate(tenantOrgId, branchId).then(rate => {
        setTaxRate(rate);
      }).catch(() => {
        setTaxRate(0.05);
      });
      getCurrencyConfigAction(tenantOrgId, branchId, userId).then(config => {
        setCurrencyConfig(config);
      }).catch(() => {
        setCurrencyConfig({ currencyCode: ORDER_DEFAULTS.CURRENCY, decimalPlaces: 3, currencyExRate: 1 });
      });
      getTaxProfilesAction().then(res => {
        if (res.success && res.data) {
          const defaultActive = res.data
            .filter(p => p.is_default && p.is_active)
            .sort((a, b) => a.tax_type.localeCompare(b.tax_type));
          setTaxProfileEntries(defaultActive.map(p => ({
            id: p.id,
            name: p.name,
            name2: p.name2,
            tax_type: p.tax_type,
            rate: Number(p.rate),
            is_compound: p.is_compound,
            enabled: true,
          })));
        }
      }).catch(() => {
        setTaxProfileEntries([]);
      });
    }
  }, [open, tenantOrgId, branchId, userId]);

  // Reset gift card details when code changes
  useEffect(() => {
    if (!giftCardNumber || appliedGiftCard) return;
    if (giftCardDetails?.number && giftCardDetails.number !== giftCardNumber && giftCardDetails.searchStr !== giftCardNumber) {
      setGiftCardDetails(null);
      setGiftCardResult(null);
      setValue('giftCardAmount', 0);
      setValue('giftCardId', '');
    }
  }, [giftCardNumber, giftCardDetails, appliedGiftCard, setValue]);

  useEffect(() => {
    if (!open || !pinRequired) return;
    window.setTimeout(() => {
      pinInputRef.current?.focus();
      pinInputRef.current?.select();
    }, 60);
  }, [open, pinRequired]);

  useEffect(() => {
    if (paymentMethod !== PAYMENT_METHODS.CHECK) {
      setValue('checkNumber', '', { shouldValidate: false, shouldDirty: false });
      setValue('checkBank', '', { shouldValidate: false, shouldDirty: false });
      setValue('checkDate', '', { shouldValidate: false, shouldDirty: false });
      return;
    }

    const activeCheckLeg =
      paymentLegs[activeLegIndex]?.method === PAYMENT_METHODS.CHECK
        ? paymentLegs[activeLegIndex]
        : paymentLegs.find((leg) => leg.method === PAYMENT_METHODS.CHECK);

    setValue('checkNumber', activeCheckLeg?.checkNumber ?? '', {
      shouldValidate: false,
      shouldDirty: false,
    });
    setValue('checkBank', activeCheckLeg?.checkBank ?? '', {
      shouldValidate: false,
      shouldDirty: false,
    });
    setValue('checkDate', activeCheckLeg?.checkDate ?? '', {
      shouldValidate: false,
      shouldDirty: false,
    });
  }, [activeLegIndex, paymentLegs, paymentMethod, setValue]);

  // Preview-payment fetch (debounced 300ms)
  const fetchPreview = useCallback(async () => {
    if (!open || items.length === 0 || !tenantOrgId) return;
    setTotalsLoading(true);
    try {
      const res = await fetch('/api/v1/orders/preview-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
        credentials: 'include',
        body: JSON.stringify({
          items,
          branchId: branchId || undefined,
          customerId: customerId || undefined,
          isExpress,
          percentDiscount: percentDiscount ?? 0,
          amountDiscount: amountDiscount ?? 0,
          serviceCategories: serviceCategories && serviceCategories.length > 0 ? serviceCategories : undefined,
          taxProfileIds: taxProfileEntries.filter((entry) => entry.enabled).map((entry) => entry.id),
          ...(!NEW_ORDER_PROMO_GIFT_DISABLED && {
            promoCode: appliedPromoCode?.code || undefined,
            giftCardNumber: appliedGiftCard?.number || undefined,
            giftCardAmount: appliedGiftCard?.amount || undefined,
            giftCardId: appliedGiftCard?.id || undefined,
          }),
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        setServerTotals({
          subtotal: d.subtotal,
          manualDiscount: d.manualDiscount,
          autoRuleDiscount: typeof d.autoRuleDiscount === 'number' ? d.autoRuleDiscount : 0,
          promoDiscount: d.promoDiscount,
          afterDiscounts: d.afterDiscounts,
          additionalTaxAmount: d.additionalTaxAmount ?? 0,
          vatValue: d.vatValue,
          giftCardApplied: d.giftCardApplied,
          saleTotal: d.saleTotal,
          vatTaxPercent: d.vatTaxPercent ?? 0,
          taxBreakdown: Array.isArray(d.taxBreakdown) ? d.taxBreakdown : [],
          ...(d.creditLimit && { creditLimit: d.creditLimit }),
        });
      } else if (!res.ok && json.errorCode === 'PRODUCT_NOT_FOUND') {
        setServerTotals(null);
        cmxMessage.error(json.error ?? t('errors.productNotFound'));
      } else if (!res.ok && json.error) {
        setServerTotals(null);
        const details = json.details as Array<{ path?: (string | number)[]; message?: string }> | undefined;
        const msg =
          details && Array.isArray(details) && details.length > 0
            ? details.map((d) => {
                const path = (d.path ?? []).join('.');
                return path ? `${path}: ${d.message ?? ''}` : (d.message ?? '');
              }).join('. ')
            : (json.error as string);
        cmxMessage.error(msg);
      }
    } catch {
      setServerTotals(null);
    } finally {
      setTotalsLoading(false);
    }
  }, [open, items, tenantOrgId, branchId, customerId, isExpress, percentDiscount, amountDiscount, serviceCategories, taxProfileEntries, appliedPromoCode?.code, appliedGiftCard?.number, appliedGiftCard?.amount, appliedGiftCard?.id, csrfToken, t]);

  useEffect(() => {
    if (!open || items.length === 0) {
      setServerTotals(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPreview();
      debounceRef.current = null;
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, items, fetchPreview]);

  // Reset all state when modal opens
  useEffect(() => {
    if (open) {
      reset({
        paymentMethod: defaultPaymentMethod,
        checkNumber: '',
        checkBank: '',
        checkDate: '',
        percentDiscount: 0,
        amountDiscount: 0,
        promoCode: '',
        promoCodeId: '',
        promoDiscount: 0,
        giftCardNumber: '',
        giftCardAmount: 0,
        giftCardId: '',
        payAllOrders: false,
        paymentNotes: initialPaymentNotes ?? '',
        outstandingPolicy: defaultOutstandingPolicy,
        b2bContractId: '',
        costCenterCode: '',
        poNumber: '',
      });
      setPromoCodeResult(null);
      setAppliedPromoCode(null);
      setGiftCardResult(null);
      setGiftCardDetails(null);
      setAppliedGiftCard(null);
      setGiftCardPin('');
      setPinRequired(false);
      setPinVisible(false);
      setPinFieldError(null);
      setSelectedCashDrawerSessionId('');
      setCashDrawerDialogOpen(false);
      setCashDrawerToOpenId('');
      setOpeningBalanceValue(0);
      setOpeningDrawerSession(false);
      setCashDrawerRequestError(null);
      setCreditLimitOverride(false);
      setActiveLegIndex(0);
      setAmountDiscountFocused(false);
      setAmountDiscountDraft('');
      setIsDirtySinceOpen(false);
      setConfirmCloseOpen(false);
      setSubmitConfirmOpen(false);
      setPendingSubmission(null);
      setPaymentLegs([]);
      setTaxProfileEntries([]);
      allocationBaselineRef.current = null;
    }
  }, [open, reset, defaultPaymentMethod, defaultOutstandingPolicy, initialPaymentNotes]);

  useEffect(() => {
    if (!open || isDirtySinceOpen || paymentLegs.length > 0) {
      return;
    }

    if (paymentMethod !== defaultPaymentMethod) {
      setValue('paymentMethod', defaultPaymentMethod, { shouldDirty: false });
    }

    if (outstandingPolicy !== defaultOutstandingPolicy) {
      setValue('outstandingPolicy', defaultOutstandingPolicy, { shouldDirty: false });
    }
  }, [
    defaultOutstandingPolicy,
    defaultPaymentMethod,
    isDirtySinceOpen,
    open,
    outstandingPolicy,
    paymentLegs.length,
    paymentMethod,
    setValue,
  ]);

  const currencyCode  = currencyConfig?.currencyCode ?? ORDER_DEFAULTS.CURRENCY;
  const decimalPlaces = currencyConfig?.decimalPlaces ?? 3;
  const formatAmount  = (n: number) => n.toFixed(decimalPlaces);

  const afterDiscountsForTax = useMemo(() => {
    if (serverTotals) return serverTotals.afterDiscounts;
    const subtotal = total;
    const manualDiscount =
      percentDiscount > 0
        ? Math.min((subtotal * percentDiscount) / 100, subtotal)
        : Math.min(amountDiscount, subtotal);
    const promoDiscount = NEW_ORDER_PROMO_GIFT_DISABLED ? 0 : (appliedPromoCode?.discount || 0);
    return Math.max(0, subtotal - manualDiscount - promoDiscount);
  }, [serverTotals, total, percentDiscount, amountDiscount, appliedPromoCode]);

  const fallbackTaxBreakdown = useMemo<TaxBreakdownLine[]>(() => {
    const selectedProfiles = taxProfileEntries.filter((entry) => entry.enabled);
    if (selectedProfiles.length > 0) {
      let accumulatedPriorTax = 0;
      return selectedProfiles.map((entry) => {
        const taxableBase = entry.is_compound ? afterDiscountsForTax + accumulatedPriorTax : afterDiscountsForTax;
        const taxAmount = parseFloat((taxableBase * (entry.rate / 100)).toFixed(decimalPlaces));
        accumulatedPriorTax += taxAmount;
        return {
          taxType: entry.tax_type as 'VAT' | 'GST' | 'CUSTOM',
          label: entry.name,
          label2: entry.name2,
          rate: entry.rate,
          isCompound: entry.is_compound,
          baseAmount: taxableBase,
          taxAmount,
          profileId: entry.id,
        };
      });
    }

    if (taxRate > 0) {
      return [{
        taxType: 'VAT',
        label: 'VAT',
        label2: 'ضريبة القيمة المضافة',
        rate: taxRate * 100,
        isCompound: false,
        baseAmount: afterDiscountsForTax,
        taxAmount: parseFloat((afterDiscountsForTax * taxRate).toFixed(decimalPlaces)),
      }];
    }

    return [];
  }, [taxProfileEntries, afterDiscountsForTax, decimalPlaces, taxRate]);

  const displayTaxBreakdown =
    serverTotals?.taxBreakdown?.length
      ? serverTotals.taxBreakdown
      : totalsLoading || (items.length > 0 && !serverTotals)
        ? []
        : fallbackTaxBreakdown;
  const profilesTaxAmount = useMemo(
    () => parseFloat(displayTaxBreakdown.reduce((sum, line) => sum + line.taxAmount, 0).toFixed(decimalPlaces)),
    [displayTaxBreakdown, decimalPlaces]
  );

  const totals = useMemo(() => {
    if (serverTotals) {
      const serverTaxTotal = serverTotals.taxBreakdown.reduce((sum, line) => sum + line.taxAmount, 0);
      return {
        ...serverTotals,
        taxRate: 0,
        taxAmount: serverTotals.additionalTaxAmount ?? 0,
        totalSavings: serverTotals.subtotal + serverTaxTotal - serverTotals.saleTotal,
      };
    }
    const subtotal = total;
    const manualDiscount =
      percentDiscount > 0
        ? Math.min((subtotal * percentDiscount) / 100, subtotal)
        : Math.min(amountDiscount, subtotal);
    const promoDiscount  = NEW_ORDER_PROMO_GIFT_DISABLED ? 0 : (appliedPromoCode?.discount || 0);
    const afterDiscounts = Math.max(0, subtotal - manualDiscount - promoDiscount);
    const vatValue = parseFloat(
      fallbackTaxBreakdown
        .filter((line) => line.taxType === 'VAT' || line.taxType === 'GST')
        .reduce((sum, line) => sum + line.taxAmount, 0)
        .toFixed(decimalPlaces)
    );
    const taxAmount = parseFloat(
      fallbackTaxBreakdown
        .filter((line) => line.taxType === 'CUSTOM')
        .reduce((sum, line) => sum + line.taxAmount, 0)
        .toFixed(decimalPlaces)
    );
    const giftCardApplied = NEW_ORDER_PROMO_GIFT_DISABLED ? 0 : (appliedGiftCard?.amount || 0);
    const saleTotal      = Math.max(0, afterDiscounts + profilesTaxAmount);
    return {
      subtotal,
      manualDiscount,
      autoRuleDiscount: 0,
      promoDiscount,
      afterDiscounts,
      taxRate: 0,
      taxAmount,
      vatTaxPercent: fallbackTaxBreakdown.find((line) => line.taxType === 'VAT' || line.taxType === 'GST')?.rate ?? (taxRate * 100),
      vatValue,
      giftCardApplied,
      saleTotal,
      totalSavings: subtotal + taxAmount + vatValue - saleTotal,
    };
  }, [serverTotals, total, percentDiscount, amountDiscount, appliedPromoCode, appliedGiftCard, taxRate, profilesTaxAmount, decimalPlaces, fallbackTaxBreakdown]);

  const saleTotal = totals.saleTotal;
  const giftCardSettlementAmount = NEW_ORDER_PROMO_GIFT_DISABLED ? 0 : (appliedGiftCard?.amount || 0);

  const IMMEDIATE_METHOD_CODES = [
    PAYMENT_METHODS.CASH,
    PAYMENT_METHODS.CARD,
    PAYMENT_METHODS.CHECK,
    PAYMENT_METHODS.BANK_TRANSFER,
    PAYMENT_METHODS.MOBILE_PAYMENT,
    PAYMENT_METHODS.PAYMENT_GATEWAY,
  ] as const;

  const GATEWAY_METHOD_CODES: string[] = [
    PAYMENT_METHODS.PAYMENT_GATEWAY,
    PAYMENT_METHODS.HYPERPAY,
    PAYMENT_METHODS.PAYTABS,
    PAYMENT_METHODS.STRIPE,
  ];
  const realPaymentOptions = useMemo(
    () =>
      checkoutMethods
        .filter((method) => method.payment_nature === 'REAL_PAYMENT' && method.allowed_in_pos)
        .filter((method) => !isRetailOnlyOrder || method.payment_method_code !== PAYMENT_METHODS.INVOICE)
        .filter((method) => !isRetailOnlyOrder || method.payment_method_code !== PAYMENT_METHODS.PAY_ON_COLLECTION)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [checkoutMethods, isRetailOnlyOrder]
  );

  const creditMethodCodes = useMemo(
    () => customerCreditOptions.map((option) => option.payment_method_code),
    [customerCreditOptions]
  );
  const liveWalletBalance = walletCreditOption
    ? storedValueSummary?.wallet.balance ?? walletCreditOption.available_balance ?? 0
    : 0;
  const liveWalletCurrencyCode =
    storedValueSummary?.wallet.currencyCode ??
    currencyCode;
  const walletBalanceLoaded = !!walletCreditOption && !storedValueLoading;
  const walletHasAvailableBalance = liveWalletBalance > 0.001;
  const liveWalletBalanceDisplay = `${liveWalletCurrencyCode} ${formatAmount(liveWalletBalance)}`;
  const liveAdvanceBalance = storedValueSummary?.advance.balance ?? 0;

  const optionByMethodKey = useMemo(() => {
    const allOptions = [...realPaymentOptions, ...customerCreditOptions];
    return new Map(
      allOptions.map((option) => [`${option.payment_method_code}::${option.gateway_code ?? ''}`, option])
    );
  }, [customerCreditOptions, realPaymentOptions]);

  const getDrawerDisplayName = useCallback(
    (drawer: CashDrawerOption) => isRTL ? (drawer.drawer_name2 || drawer.drawer_name) : drawer.drawer_name,
    [isRTL]
  );

  const formatCashDrawerOpenedAt = useCallback(
    (openedAt: string | null) => {
      if (!openedAt) {
        return '—';
      }
      return new Intl.DateTimeFormat(isRTL ? 'ar' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(openedAt));
    },
    [isRTL]
  );

  const cashDrawerSessionChoices = useMemo(
    () =>
      cashDrawers.flatMap((drawer) =>
        drawer.currentSession
          ? [{ drawer, session: drawer.currentSession }]
          : []
      ),
    [cashDrawers]
  );
  const preferredCashDrawerStorageKey = useMemo(
    () => getPreferredCashDrawerStorageKey({ tenantOrgId, branchId, userId }),
    [branchId, tenantOrgId, userId]
  );

  const readPreferredCashDrawerId = useCallback(() => {
    if (!preferredCashDrawerStorageKey || typeof window === 'undefined') {
      return null;
    }

    try {
      return window.localStorage.getItem(preferredCashDrawerStorageKey);
    } catch {
      return null;
    }
  }, [preferredCashDrawerStorageKey]);

  const persistPreferredCashDrawerId = useCallback(
    (cashDrawerId: string | null | undefined) => {
      if (!preferredCashDrawerStorageKey || typeof window === 'undefined') {
        return;
      }

      try {
        const normalizedCashDrawerId = cashDrawerId?.trim();
        if (normalizedCashDrawerId) {
          window.localStorage.setItem(preferredCashDrawerStorageKey, normalizedCashDrawerId);
          return;
        }
        window.localStorage.removeItem(preferredCashDrawerStorageKey);
      } catch {
        // Browser storage can be disabled; drawer validation still protects submission.
      }
    },
    [preferredCashDrawerStorageKey]
  );

  const canOpenNewCashDrawerSession = useMemo(
    () => cashDrawers.some((drawer) => !drawer.currentSession),
    [cashDrawers]
  );

  const getMethodOption = useCallback(
    (methodCode: string, gatewayCode?: string | null) =>
      optionByMethodKey.get(`${methodCode}::${gatewayCode ?? ''}`) ??
      optionByMethodKey.get(`${methodCode}::`),
    [optionByMethodKey]
  );

  const getLegStoredValueCap = useCallback(
    (leg: PaymentLeg) => {
      const option = getMethodOption(leg.method, leg.gateway_code);
      const creditNoteBalance = leg.creditReferenceId
        ? storedValueSummary?.creditNotes.find((note) => note.id === leg.creditReferenceId)?.remaining_balance
        : undefined;
      return getStoredValueCapForLeg(leg.method, {
        walletBalance: leg.method === 'WALLET' ? liveWalletBalance : undefined,
        advanceBalance: leg.method === 'ADVANCE' ? liveAdvanceBalance : undefined,
        creditNoteBalance: leg.method === 'CREDIT_NOTE' ? creditNoteBalance : undefined,
        loyaltyBalance:
          leg.method === 'LOYALTY_POINTS' ? option?.available_balance ?? undefined : undefined,
      });
    },
    [getMethodOption, liveAdvanceBalance, liveWalletBalance, storedValueSummary?.creditNotes]
  );

  const getOptionDisplayName = (option: CheckoutSettlementOption | undefined, fallbackMethodCode?: string) => {
    if (option) {
      return isRTL ? (option.display_name2 || option.display_name) : option.display_name;
    }
    return fallbackMethodCode ? getPaymentLabel(fallbackMethodCode) : '';
  };

  const getMethodHint = (option: CheckoutSettlementOption) => {
    const description = isRTL ? (option.description2 || option.description) : (option.description || option.description2);
    return description
      ? `${option.payment_method_code} • ${description}`
      : option.payment_method_code;
  };

  const focusAmountEditor = useCallback(() => {
    window.setTimeout(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    }, 50);
  }, []);

  const removeLegAt = useCallback((idx: number) => {
    setIsDirtySinceOpen(true);
    setPaymentLegs((prev) => {
      const next = prev.filter((_, currentIdx) => currentIdx !== idx);
      return next;
    });
    setActiveLegIndex((prev) => Math.max(0, prev > idx ? prev - 1 : prev === idx ? prev - 1 : prev));
  }, []);

  const updateLeg = useCallback(<K extends keyof PaymentLeg>(idx: number, key: K, value: PaymentLeg[K]) => {
    setIsDirtySinceOpen(true);
    setPaymentLegs((prev) => {
      const target = prev[idx];
      if (!target) return prev;
      const updated = [...prev];

      if (key === 'amount' && typeof value === 'number') {
        const option = getMethodOption(target.method, target.gateway_code);
        const policy = resolvePaymentOverpaymentPolicy({
          paymentMethodCode: target.method,
          supportsChangeReturn: option?.supports_change_return,
          supportsOverpayment: option?.supports_overpayment,
          requiresCashDrawer: option?.requires_cash_drawer,
        });
        const appliedAmount = deriveLegAppliedAmount({
          rawAmount: value,
          paymentLegs: prev,
          legIndex: idx,
          saleTotal,
          giftCardAmount: giftCardSettlementAmount,
          decimalPlaces,
          walletBalance: getLegStoredValueCap(target),
          supportsOverpayment: !policy.isCash && policy.supportsOverpayment,
        });
        const cashTendered = policy.isCash
          ? deriveCashTenderedAmount(value, appliedAmount, policy.supportsChangeReturn, decimalPlaces)
          : undefined;

        updated[idx] = {
          ...target,
          amount: appliedAmount,
          ...(policy.isCash ? { cashTendered } : { cashTendered: undefined }),
        };
        return updated;
      }

      updated[idx] = { ...updated[idx], [key]: value };
      return updated;
    });
  }, [decimalPlaces, getLegStoredValueCap, getMethodOption, giftCardSettlementAmount, saleTotal]);

  const upsertSettlementLeg = useCallback(
    (option: CheckoutSettlementOption, defaultAmount: number) => {
      setIsDirtySinceOpen(true);
      setPaymentLegs((prev) => {
        const existingIndex = prev.findIndex(
          (leg) =>
            leg.method === option.payment_method_code &&
            (leg.gateway_code ?? '') === (option.gateway_code ?? '')
        );
        const targetIndex = existingIndex >= 0 ? existingIndex : prev.length;
        const policy = resolvePaymentOverpaymentPolicy({
          paymentMethodCode: option.payment_method_code,
          supportsChangeReturn: option.supports_change_return,
          supportsOverpayment: option.supports_overpayment,
          requiresCashDrawer: option.requires_cash_drawer,
        });
        const nextAmount = deriveLegAppliedAmount({
          rawAmount: defaultAmount,
          paymentLegs: prev,
          legIndex: targetIndex,
          saleTotal,
          giftCardAmount: giftCardSettlementAmount,
          decimalPlaces,
          walletBalance: getLegStoredValueCap({
            method: option.payment_method_code as PaymentLeg['method'],
            amount: defaultAmount,
            ...(existingIndex >= 0 ? prev[existingIndex] : {}),
          }),
          supportsOverpayment: !policy.isCash && policy.supportsOverpayment,
        });
        const nextLeg: PaymentLeg = {
          legRef: existingIndex >= 0 ? prev[existingIndex].legRef ?? crypto.randomUUID() : crypto.randomUUID(),
          method: option.payment_method_code as PaymentLeg['method'],
          amount: nextAmount,
          ...(policy.isCash ? { cashTendered: nextAmount } : {}),
          ...(GATEWAY_METHOD_CODES.includes(option.payment_method_code)
            ? { gateway_code: option.gateway_code ?? undefined }
            : {}),
        };

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...nextLeg,
            amount: nextAmount,
          };
          setActiveLegIndex(existingIndex);
          return updated;
        }

        if (prev.length === 1 && (prev[0].amount ?? 0) === 0) {
          setActiveLegIndex(0);
          return [{ ...prev[0], ...nextLeg }];
        }

        setActiveLegIndex(prev.length);
        return [...prev, nextLeg];
      });
      focusAmountEditor();
    },
    [GATEWAY_METHOD_CODES, decimalPlaces, focusAmountEditor, getLegStoredValueCap, giftCardSettlementAmount, saleTotal]
  );

  const handleCreditNoteSelect = useCallback(
    (noteId: string) => {
      const option = pendingCreditNoteOption;
      if (!option) return;
      const note = storedValueSummary?.creditNotes.find((entry) => entry.id === noteId);
      if (!note) return;

      setCreditNotePickerOpen(false);
      setPendingCreditNoteOption(null);
      setIsDirtySinceOpen(true);
      setPaymentLegs((prev) => {
        const existingIndex = prev.findIndex(
          (leg) => leg.method === 'CREDIT_NOTE' && leg.creditReferenceId === noteId
        );
        const fallbackIndex = prev.findIndex((leg) => leg.method === 'CREDIT_NOTE');
        const targetIndex =
          existingIndex >= 0 ? existingIndex : fallbackIndex >= 0 ? fallbackIndex : prev.length;
        const amount = getSuggestedStoredValueAmount(
          note.remaining_balance,
          prev,
          saleTotal,
          giftCardSettlementAmount,
          decimalPlaces,
          targetIndex < prev.length ? targetIndex : undefined
        );
        const nextLeg: PaymentLeg = {
          legRef:
            existingIndex >= 0
              ? prev[existingIndex].legRef ?? crypto.randomUUID()
              : fallbackIndex >= 0
                ? prev[fallbackIndex].legRef ?? crypto.randomUUID()
                : crypto.randomUUID(),
          method: 'CREDIT_NOTE',
          amount,
          creditReferenceId: noteId,
        };

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], ...nextLeg };
          setActiveLegIndex(existingIndex);
          return updated;
        }
        if (fallbackIndex >= 0) {
          const updated = [...prev];
          updated[fallbackIndex] = { ...updated[fallbackIndex], ...nextLeg };
          setActiveLegIndex(fallbackIndex);
          return updated;
        }
        if (prev.length === 1 && (prev[0].amount ?? 0) === 0) {
          setActiveLegIndex(0);
          return [{ ...prev[0], ...nextLeg }];
        }
        setActiveLegIndex(prev.length);
        return [...prev, nextLeg];
      });
      focusAmountEditor();
    },
    [
      decimalPlaces,
      focusAmountEditor,
      giftCardSettlementAmount,
      pendingCreditNoteOption,
      saleTotal,
      storedValueSummary?.creditNotes,
    ]
  );

  const handleMethodSelect = useCallback(
    (option: CheckoutSettlementOption) => {
      setValue('paymentMethod', option.payment_method_code as PaymentMethodCode, { shouldDirty: true });
      const existingIndex = paymentLegs.findIndex(
        (leg) =>
          leg.method === option.payment_method_code &&
          (leg.gateway_code ?? '') === (option.gateway_code ?? '')
      );
      const suggestedAmount = getSuggestedDefaultLegAmount(
        paymentLegs,
        existingIndex >= 0 ? existingIndex : undefined,
        saleTotal,
        giftCardSettlementAmount,
        decimalPlaces
      );
      upsertSettlementLeg(option, suggestedAmount);
    },
    [decimalPlaces, giftCardSettlementAmount, paymentLegs, setValue, saleTotal, upsertSettlementLeg]
  );

  const handleCustomerCreditSelect = useCallback(
    (option: CheckoutSettlementOption) => {
      if (option.payment_method_code === 'CREDIT_NOTE') {
        if (storedValueLoading) {
          cmxMessage.info(t('customerCredits.loadingBalance'));
          return;
        }
        if (!storedValueSummary?.creditNotes.length) {
          cmxMessage.info(t('customerCredits.creditNotePickerEmpty'));
          return;
        }
        setPendingCreditNoteOption(option);
        setCreditNotePickerOpen(true);
        return;
      }
      if (option.requires_credit_reference_selection) {
        cmxMessage.info(t('customerCredits.referenceSelectionHint'));
        return;
      }
      const availableBalance =
        option.credit_application_type === 'WALLET' ||
        option.payment_method_code === 'WALLET'
          ? liveWalletBalance
          : option.payment_method_code === 'ADVANCE'
            ? liveAdvanceBalance
            : option.available_balance ?? 0;
      const existingIndex = paymentLegs.findIndex(
        (leg) => leg.method === option.payment_method_code
      );
      const suggestedAmount = getSuggestedStoredValueAmount(
        availableBalance,
        paymentLegs,
        saleTotal,
        giftCardSettlementAmount,
        decimalPlaces,
        existingIndex >= 0 ? existingIndex : undefined
      );
      upsertSettlementLeg(option, suggestedAmount);
    },
    [
      decimalPlaces,
      giftCardSettlementAmount,
      liveAdvanceBalance,
      liveWalletBalance,
      paymentLegs,
      saleTotal,
      storedValueLoading,
      storedValueSummary?.creditNotes.length,
      t,
      upsertSettlementLeg,
    ]
  );

  useEffect(() => {
    if (!open) {
      allocationBaselineRef.current = null;
      return;
    }

    const epsilon = Math.pow(10, -(decimalPlaces + 1));
    const previous = allocationBaselineRef.current;

    if (previous !== null && paymentLegs.length > 0) {
      const saleTotalChanged = Math.abs(previous.saleTotal - saleTotal) > epsilon;
      const giftCardChanged = Math.abs(previous.giftCard - giftCardSettlementAmount) > epsilon;

      if (saleTotalChanged || giftCardChanged) {
        setPaymentLegs((prevLegs) =>
          reconcilePaymentLegAmounts(prevLegs, saleTotal, giftCardSettlementAmount, decimalPlaces)
        );
        cmxMessage.info(t('messages.totalsAdjusted'));
      }
    }

    allocationBaselineRef.current = { saleTotal, giftCard: giftCardSettlementAmount };
  }, [decimalPlaces, giftCardSettlementAmount, open, paymentLegs.length, saleTotal, t]);

  const sanitizeAmountDiscountDraft = useCallback(
    (raw: string): string => {
      let s = raw.replace(/[^\d.]/g, '');
      if (s.startsWith('.')) s = `0${s}`;
      const di = s.indexOf('.');
      if (di !== -1) {
        s = s.slice(0, di + 1) + s.slice(di + 1).replace(/\./g, '');
        const frac = s.slice(di + 1);
        if (frac.length > decimalPlaces) {
          s = s.slice(0, di + 1 + decimalPlaces);
        }
      }
      return s;
    },
    [decimalPlaces]
  );

  const settlementLegEntries = useMemo(
    () =>
      paymentLegs
        .map((leg, index) => ({ leg, index }))
        .filter(({ leg }) => (leg.amount ?? 0) > 0),
    [paymentLegs]
  );

  const editableLegEntries = useMemo(() => {
    const entries = paymentLegs.map((leg, index) => ({ leg, index }));
    const nonZero = entries.filter(({ leg }) => (leg.amount ?? 0) > 0);
    return nonZero.length > 0 ? nonZero : entries;
  }, [paymentLegs]);

  const realPaymentEntries = useMemo(
    () =>
      settlementLegEntries.filter(({ leg }) =>
        (IMMEDIATE_METHOD_CODES as readonly string[]).includes(leg.method)
      ),
    [IMMEDIATE_METHOD_CODES, settlementLegEntries]
  );

  const customerCreditEntries = useMemo(
    () => settlementLegEntries.filter(({ leg }) => creditMethodCodes.includes(leg.method)),
    [creditMethodCodes, settlementLegEntries]
  );

  const payNowAmount = useMemo(
    () => realPaymentEntries.reduce((sum, { leg }) => sum + (leg.amount || 0), 0),
    [realPaymentEntries]
  );

  const customerCreditAmount = useMemo(
    () => customerCreditEntries.reduce((sum, { leg }) => sum + (leg.amount || 0), 0),
    [customerCreditEntries]
  );

  const settledNowAmount = useMemo(
    () => payNowAmount + customerCreditAmount,
    [customerCreditAmount, payNowAmount]
  );
  const cashLegAmount = useMemo(
    () =>
      realPaymentEntries
        .filter(({ leg }) => leg.method === PAYMENT_METHODS.CASH)
        .reduce((sum, { leg }) => sum + (leg.amount || 0), 0),
    [realPaymentEntries]
  );
  const cashTenderedAmount = useMemo(
    () =>
      realPaymentEntries
        .filter(({ leg }) => leg.method === PAYMENT_METHODS.CASH)
        .reduce((sum, { leg }) => sum + (leg.cashTendered ?? leg.amount ?? 0), 0),
    [realPaymentEntries]
  );
  const totalSettledNowAmount = settledNowAmount + giftCardSettlementAmount;
  const walletLegEntry = useMemo(
    () => settlementLegEntries.find(({ leg }) => leg.method === 'WALLET') ?? null,
    [settlementLegEntries]
  );
  const storedValueLegExceedance = useMemo(() => {
    for (const { leg, index } of settlementLegEntries) {
      const cap = getLegStoredValueCap(leg);
      if (cap != null && walletLegExceedsBalance(leg.amount || 0, cap)) {
        return { leg, index, cap };
      }
    }
    return null;
  }, [getLegStoredValueCap, settlementLegEntries]);
  const walletLegExceedsLiveBalance =
    storedValueLegExceedance?.leg.method === 'WALLET' &&
    !!storedValueLegExceedance;
  const storedValueLegExceedsBalance = !!storedValueLegExceedance;

  const moneyEpsilon = Math.pow(10, -(decimalPlaces + 1));

  const notifyIfLegAmountCapped = useCallback(
    (leg: PaymentLeg, rawAmount: number, cappedAmount: number) => {
      const option = getMethodOption(leg.method, leg.gateway_code);
      const policy = resolvePaymentOverpaymentPolicy({
        paymentMethodCode: leg.method,
        supportsChangeReturn: option?.supports_change_return,
        supportsOverpayment: option?.supports_overpayment,
        requiresCashDrawer: option?.requires_cash_drawer,
      });

      if (
        policy.isCash &&
        !policy.supportsChangeReturn &&
        wasPaymentLegAmountCapped(rawAmount, cappedAmount, moneyEpsilon)
      ) {
        setCashOverRemainingNotice(
          t('splitPayment.validation.cashOverRemainingNotAllowed', {
            max: `${currencyCode} ${formatAmount(cappedAmount)}`,
          })
        );
        return;
      }

      setCashOverRemainingNotice(null);
    },
    [currencyCode, formatAmount, getMethodOption, moneyEpsilon, t]
  );

  const remainingBalance = Math.max(0, saleTotal - totalSettledNowAmount);
  const changeAmount = Math.max(0, totalSettledNowAmount - saleTotal);
  const canReturnChangeFromCash = useMemo(
    () =>
      canReturnChangeFromAllCashLegs(
        realPaymentEntries
          .filter(({ leg }) => leg.method === PAYMENT_METHODS.CASH)
          .map(({ leg }) => ({
            supportsChangeReturn:
              getMethodOption(leg.method, leg.gateway_code)?.supports_change_return === true,
          }))
      ),
    [getMethodOption, realPaymentEntries]
  );
  const cashChangeAmount = deriveChangeReturnedAmount(
    cashTenderedAmount,
    cashLegAmount,
    canReturnChangeFromCash,
    moneyEpsilon
  );
  const cashChangeCapacity = realPaymentEntries.reduce((sum, { leg }) => {
    if (leg.method !== PAYMENT_METHODS.CASH) return sum;
    const option = getMethodOption(leg.method, leg.gateway_code);
    if (option?.supports_change_return !== true) return sum;
    const applied = deriveLegAppliedAmount({
      rawAmount: leg.amount,
      paymentLegs: settlementLegEntries.map(({ leg: l }) => ({ amount: l.amount })),
      legIndex: settlementLegEntries.findIndex(({ leg: l }) => l === leg),
      saleTotal,
      giftCardAmount: giftCardSettlementAmount,
      decimalPlaces,
      supportsOverpayment: option?.supports_overpayment === true,
    });
    const tendered = deriveCashTenderedAmount(
      leg.cashTendered ?? leg.amount,
      applied,
      true,
      decimalPlaces
    );
    return sum + Math.max(0, tendered - applied);
  }, 0);
  const unresolvedOverpaymentAmount = getUnresolvedOverpaymentAmount(
    changeAmount,
    cashChangeCapacity,
    canReturnChangeFromCash,
    moneyEpsilon
  );
  const overpaymentNeedsResolution = unresolvedOverpaymentAmount > moneyEpsilon;
  const amountAppliedToOrder = getAmountAppliedToOrder(saleTotal, totalSettledNowAmount);
  const displayChangeAmount = getDisplayChangeAmount(cashChangeAmount, canReturnChangeFromCash, moneyEpsilon);

  const allocation = useOverpaymentAllocation({
    customerId,
    branchId,
    currencyCode,
    excessAmount: unresolvedOverpaymentAmount,
    receiptAmount: totalSettledNowAmount,
    currentOrderAllocationAmount: amountAppliedToOrder,
    sourceType: 'ORDER_PAYMENT_MODAL',
    paymentMethodCode: paymentMethod,
    moneyEpsilon,
    confirmedToastMessage: t('extraReceipt.allocation.confirmedToast'),
    remainingUnallocatedErrorMessage: t('extraReceipt.allocation.remainingUnallocatedError'),
  });

  useEffect(() => {
    if (!open) return;
    allocation.resetAllocationState();
    allocation.setExtraReceiptMode('adjust_legs');
    allocation.setAutoDrawerOpen(false);
    allocation.setManualDrawerOpen(false);
  }, [open]);

  const overpaymentResolutionPayload = useMemo(
    () =>
      buildOverpaymentResolutionPayload(allocation.extraReceiptMode, unresolvedOverpaymentAmount, {
        allocationPreviewId: allocation.allocationPreviewId,
      }),
    [allocation.allocationPreviewId, allocation.extraReceiptMode, unresolvedOverpaymentAmount]
  );
  const overpaymentBlocksSubmit =
    overpaymentNeedsResolution && !overpaymentResolutionPayload;
  const netCashRetainedAmount = getNetCashRetainedAmount(
    cashTenderedAmount,
    cashChangeAmount,
    canReturnChangeFromCash,
    moneyEpsilon
  );
  const primaryMethodOption = getMethodOption(paymentMethod);
  const cashDrawerRequired = useMemo(() => {
    const selectedLegRequiresDrawer = settlementLegEntries.some(({ leg }) => {
      const option = getMethodOption(leg.method, leg.gateway_code);
      return !!option?.requires_cash_drawer;
    });

    if (selectedLegRequiresDrawer) {
      return true;
    }

    return paymentLegs.length === 0 && !!primaryMethodOption?.requires_cash_drawer;
  }, [getMethodOption, paymentLegs.length, primaryMethodOption, settlementLegEntries]);

  const selectedCashDrawerChoice = useMemo(
    () =>
      cashDrawerSessionChoices.find(
        ({ session }) => session.id === selectedCashDrawerSessionId
      ) ?? null,
    [cashDrawerSessionChoices, selectedCashDrawerSessionId]
  );

  const cashDrawerBlockingMessage = useMemo(() => {
    if (!cashDrawerRequired) {
      return null;
    }

    if (cashDrawersLoading || cashDrawersFetching) {
      return t('cashDrawer.messages.loading');
    }

    if (cashDrawerRequestError) {
      return cashDrawerRequestError;
    }

    if (cashDrawersError instanceof Error) {
      return cashDrawersError.message || t('cashDrawer.messages.loadFailed');
    }

    if (cashDrawers.length === 0) {
      return t('cashDrawer.messages.noDrawersConfigured');
    }

    if (cashDrawerSessionChoices.length === 0) {
      return t('cashDrawer.messages.noOpenSession');
    }

    if (!selectedCashDrawerSessionId) {
      return t('cashDrawer.messages.sessionRequired');
    }

    return null;
  }, [
    cashDrawerRequired,
    cashDrawersLoading,
    cashDrawersFetching,
    cashDrawerRequestError,
    cashDrawersError,
    cashDrawers.length,
    cashDrawerSessionChoices.length,
    selectedCashDrawerSessionId,
    t,
  ]);

  useEffect(() => {
    if (!cashDrawerRequired) {
      if (selectedCashDrawerSessionId) {
        setSelectedCashDrawerSessionId('');
      }
      return;
    }

    if (selectedCashDrawerSessionId) {
      const selectedStillExists = cashDrawerSessionChoices.some(
        ({ session }) => session.id === selectedCashDrawerSessionId
      );
      if (!selectedStillExists) {
        setSelectedCashDrawerSessionId('');
      }
      return;
    }

    const preferredSessionId = resolvePreferredCashDrawerSessionId(
      cashDrawerSessionChoices,
      readPreferredCashDrawerId()
    );

    if (preferredSessionId) {
      setSelectedCashDrawerSessionId(preferredSessionId);
      return;
    }

    if (cashDrawerSessionChoices.length === 1) {
      setSelectedCashDrawerSessionId(cashDrawerSessionChoices[0].session.id);
    }
  }, [cashDrawerRequired, cashDrawerSessionChoices, readPreferredCashDrawerId, selectedCashDrawerSessionId]);

  const handleOpenCashDrawerDialog = useCallback(() => {
    const savedPreferredDrawerId = readPreferredCashDrawerId();
    const savedPreferredDrawer = cashDrawers.find(
      (drawer) => drawer.id === savedPreferredDrawerId
    );
    const preferredDrawerId =
      selectedCashDrawerChoice?.drawer.id ??
      savedPreferredDrawer?.id ??
      cashDrawers.find((drawer) => !drawer.currentSession)?.id ??
      cashDrawers[0]?.id ??
      '';

    setCashDrawerToOpenId(preferredDrawerId);
    setOpeningBalanceValue(0);
    setCashDrawerRequestError(null);
    setCashDrawerDialogOpen(true);
  }, [cashDrawers, readPreferredCashDrawerId, selectedCashDrawerChoice]);

  const handleCreateCashDrawerSession = useCallback(async () => {
    if (!cashDrawerToOpenId) {
      const message = t('cashDrawer.messages.selectDrawer');
      setCashDrawerRequestError(message);
      cmxMessage.error(message);
      return;
    }

    setOpeningDrawerSession(true);
    setCashDrawerRequestError(null);

    try {
      const res = await fetch(`/api/v1/cash-drawers/${cashDrawerToOpenId}/open-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCSRFHeader(csrfToken),
        },
        credentials: 'include',
        body: JSON.stringify({
          openingBalance: openingBalanceValue,
        }),
      });

      const json = await res.json().catch(() => ({}));
      const message =
        typeof json.error === 'string' && json.error.trim().length > 0
          ? json.error
          : t('cashDrawer.messages.openFailed');

      if (!res.ok || !json.success) {
        setCashDrawerRequestError(message);
        cmxMessage.error(message);
        return;
      }

      const createdSession = json.data as CashDrawerSessionOption;
      setSelectedCashDrawerSessionId(createdSession.id);
      persistPreferredCashDrawerId(cashDrawerToOpenId);
      setCashDrawerDialogOpen(false);
      setCashDrawerToOpenId('');
      setOpeningBalanceValue(0);
      await refetchCashDrawers();
      cmxMessage.success(t('cashDrawer.messages.sessionOpened'));
    } catch {
      const message = t('cashDrawer.messages.openFailed');
      setCashDrawerRequestError(message);
      cmxMessage.error(message);
    } finally {
      setOpeningDrawerSession(false);
    }
  }, [cashDrawerToOpenId, csrfToken, openingBalanceValue, persistPreferredCashDrawerId, refetchCashDrawers, t]);

  // Promo handlers
  const handleValidatePromoCode = async () => {
    if (NEW_ORDER_PROMO_GIFT_DISABLED) return;
    if (!promoCode?.trim()) return;
    setPromoCodeValidating(true);
    setPromoCodeResult(null);
    try {
      const result = await validatePromoCodeAction(tenantOrgId, {
        promo_code: promoCode,
        order_total: total,
        customer_id: customerId,
        service_categories: serviceCategories,
      });
      setPromoCodeResult(result);
      if (result.isValid && result.promoCode && result.discountAmount) {
        const applied = { code: promoCode, id: result.promoCode.id, discount: result.discountAmount };
        setAppliedPromoCode(applied);
        setValue('promoCode', promoCode);
        setValue('promoCodeId', result.promoCode.id);
        setValue('promoDiscount', result.discountAmount);
      }
    } catch {
      setPromoCodeResult({ isValid: false, error: t('promoCode.errors.validationFailed') });
    } finally {
      setPromoCodeValidating(false);
    }
  };

  const handleClearPromoCode = () => {
    if (NEW_ORDER_PROMO_GIFT_DISABLED) return;
    setValue('promoCode', '');
    setValue('promoCodeId', '');
    setValue('promoDiscount', 0);
    setPromoCodeResult(null);
    setAppliedPromoCode(null);
  };

  // Gift card handlers
  const handleFetchGiftCardDetails = async () => {
    if (NEW_ORDER_PROMO_GIFT_DISABLED) return;
    if (!giftCardNumber?.trim()) return;
    if (pinRequired && !giftCardPin.trim()) {
      setPinFieldError(t('giftCard.pinPendingError'));
      window.setTimeout(() => {
        pinInputRef.current?.focus();
        pinInputRef.current?.select();
      }, 60);
      return;
    }

    setGiftCardValidating(true);
    setGiftCardResult(null);
    setGiftCardDetails(null);
    try {
      const result = await validateGiftCardAction({
        gift_card_code: giftCardNumber,
        ...(giftCardPin.trim() ? { card_pin: giftCardPin.trim() } : {}),
      });

      if (!result.isValid && result.errorCode === 'INVALID_PIN' && !giftCardPin.trim()) {
        setPinRequired(true);
        setPinFieldError(t('giftCard.pinPendingError'));
        window.setTimeout(() => {
          pinInputRef.current?.focus();
          pinInputRef.current?.select();
        }, 60);
        return;
      }
      if (!result.isValid && result.errorCode === 'INVALID_PIN' && giftCardPin.trim()) {
        setPinFieldError(resolveGiftCardError(result));
        return;
      }

      setGiftCardResult(result);
      if (result.isValid && result.giftCard && result.availableBalance != null) {
        setPinRequired(false);
        const details = {
          number: result.giftCard.gift_card_code,
          balance: result.availableBalance,
          status: result.giftCard.status,
          expiryDate: result.giftCard.expiry_date,
          id: result.giftCard.id,
          searchStr: giftCardNumber,
        };
        setGiftCardDetails(details);
        const defaultAmount = getSuggestedStoredValueAmount(
          result.availableBalance,
          paymentLegs,
          saleTotal,
          giftCardSettlementAmount,
          decimalPlaces
        );
        setValue('giftCardAmount', defaultAmount);
        setValue('giftCardId', result.giftCard.id ?? '');
        window.setTimeout(() => {
          giftCardDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          giftCardAmountInputRef.current?.focus();
          giftCardAmountInputRef.current?.select();
        }, 80);
      }
    } catch {
      setGiftCardResult({ isValid: false, error: t('giftCard.errors.validationFailed') });
    } finally {
      setGiftCardValidating(false);
    }
  };

  const handleApplyGiftCard = () => {
    if (NEW_ORDER_PROMO_GIFT_DISABLED || !giftCardDetails) return;
    const amountToUse = Number(giftCardAmount) || 0;
    const maxAmount = getSuggestedStoredValueAmount(
      giftCardDetails.balance,
      paymentLegs,
      saleTotal,
      giftCardSettlementAmount,
      decimalPlaces
    );
    if (amountToUse <= 0) { cmxMessage.error(t('giftCard.errors.amountRequired')); return; }
    if (amountToUse > maxAmount) {
      cmxMessage.error(t('giftCard.errors.maxAmountExceeded'));
      setValue('giftCardAmount', maxAmount);
      return;
    }
    setAppliedGiftCard({ number: giftCardDetails.number, amount: amountToUse, balance: giftCardDetails.balance, id: giftCardDetails.id ?? '' });
    setValue('giftCardNumber', giftCardDetails.number);
    setValue('giftCardAmount', amountToUse);
    setValue('giftCardId', giftCardDetails.id ?? '');
  };

  const handleClearGiftCard = () => {
    if (NEW_ORDER_PROMO_GIFT_DISABLED) return;
    setValue('giftCardNumber', '');
    setValue('giftCardAmount', 0);
    setValue('giftCardId', '');
    setGiftCardResult(null);
    setGiftCardDetails(null);
    setAppliedGiftCard(null);
    setGiftCardPin('');
    setPinRequired(false);
    setPinVisible(false);
    setPinFieldError(null);
  };

  // Submit handler
  const onSubmitForm = (data: PaymentFormData) => {
    if (totalsLoading) {
      cmxMessage.info(t('calculating'));
      return;
    }

    if (!serverTotals && items.length > 0) {
      cmxMessage.error(t('errors.invalidAmount'));
      return;
    }

    if (pinRequired) {
      setPinFieldError(t('giftCard.pinPendingError'));
      pinInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      pinInputRef.current?.focus();
      return;
    }

    const submissionData: PaymentFormData = {
      ...data,
      giftCardNumber: appliedGiftCard ? appliedGiftCard.number : undefined,
      giftCardAmount: appliedGiftCard ? appliedGiftCard.amount : undefined,
      giftCardId: appliedGiftCard ? giftCardDetails?.id : undefined,
    } as PaymentFormData;

    for (const { leg } of settlementLegEntries) {
      if (!leg.amount || leg.amount <= 0) {
        cmxMessage.error(t('splitPayment.validation.amountMustBePositive'));
        return;
      }
      if (leg.method === PAYMENT_METHODS.CHECK && !leg.checkNumber?.trim()) {
        cmxMessage.error(t('splitPayment.validation.checkNumberRequired'));
        return;
      }
      if (leg.method === PAYMENT_METHODS.CHECK && (leg.amount ?? 0) > 0) {
        const checkDateIssue = validateCheckDueDate(leg.checkDate);
        if (checkDateIssue) {
          cmxMessage.error(t(`splitPayment.${checkDateIssue}`));
          return;
        }
      }
      if (leg.method === 'CREDIT_NOTE' && !leg.creditReferenceId?.trim()) {
        cmxMessage.error(t('customerCredits.creditNoteRequired'));
        return;
      }
      const legOption = getMethodOption(leg.method, leg.gateway_code);
      if (legOption?.requires_terminal && !leg.terminalId?.trim()) {
        cmxMessage.error(
          t('splitPayment.validation.terminalRequired', {
            method: getOptionDisplayName(legOption, leg.method),
          })
        );
        return;
      }
    }

    if (settlementLegEntries.length > 1) {
      const legSum = settlementLegEntries.reduce((sum, { leg }) => sum + (leg.amount || 0), 0);
      if (Math.abs(legSum - settledNowAmount) > 0.001) {
        cmxMessage.error(t('splitPayment.validation.sumMismatch'));
        return;
      }
    }

    if (overpaymentBlocksSubmit) {
      cmxMessage.error(t('rightRail.requiredAction.overpaymentMessage', {
        amount: `${currencyCode} ${formatAmount(changeAmount)}`,
      }));
      return;
    }

    if (walletLegExceedsLiveBalance) {
      cmxMessage.error(
        t('customerCredits.walletBalanceExceeded', {
          amount: liveWalletBalanceDisplay,
        })
      );
      return;
    }

    if (storedValueLegExceedsBalance && storedValueLegExceedance && !walletLegExceedsLiveBalance) {
      cmxMessage.error(
        t('customerCredits.storedValueBalanceExceeded', {
          method: getOptionDisplayName(
            getMethodOption(storedValueLegExceedance.leg.method, storedValueLegExceedance.leg.gateway_code),
            storedValueLegExceedance.leg.method
          ),
          amount: `${currencyCode} ${formatAmount(storedValueLegExceedance.cap)}`,
        })
      );
      return;
    }

    if (remainingBalance > 0.001 && effectiveOutstandingPolicy === 'NONE') {
      cmxMessage.error(t('remainder.validation.required'));
      return;
    }

    if (cashDrawerRequired && cashDrawerBlockingMessage) {
      scrollAndFocusTarget(cashDrawerCardRef.current);
      cmxMessage.error(cashDrawerBlockingMessage);
      return;
    }

    const legsWithRefs = ensurePaymentLegRefs(
      settlementLegEntries.length > 0
        ? settlementLegEntries.map(({ leg }) => leg)
        : paymentLegs
    );

    const payload = {
      amountToCharge: settledNowAmount,
      totals: {
        subtotal: totals.subtotal,
        manualDiscount: totals.manualDiscount,
        promoDiscount: totals.promoDiscount,
        afterDiscounts: totals.afterDiscounts,
        taxRate: totals.taxRate,
        taxAmount: totals.taxAmount,
        vatTaxPercent: totals.vatTaxPercent,
        vatValue: totals.vatValue,
        giftCardApplied: totals.giftCardApplied,
        saleTotal,
      },
      ...(currencyConfig && {
        currencyCode: currencyConfig.currencyCode,
        currencyExRate: currencyConfig.currencyExRate,
      }),
      outstandingPolicy: effectiveOutstandingPolicy,
      creditLimitOverride: creditLimitOverride || undefined,
      ...(cashDrawerRequired && selectedCashDrawerSessionId && {
        cashDrawerSessionId: selectedCashDrawerSessionId,
      }),
      ...(taxProfileEntries.some((entry) => entry.enabled) && {
        taxProfileIds: taxProfileEntries
          .filter((entry) => entry.enabled)
          .map((entry) => entry.id),
      }),
      ...(settlementLegEntries.length > 0 && {
        paymentLegs: legsWithRefs,
      }),
      ...(overpaymentResolutionPayload && {
        overpaymentResolution: overpaymentResolutionPayload,
      }),
    };
    const parsed = newOrderPaymentPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      cmxMessage.error(first ? `${first.path.join('.')}: ${first.message}` : t('errors.invalidAmount'));
      return;
    }
    if (invalidImmediateAmount) {
      cmxMessage.error(t('partialPayment.validation.amountMustBePositive'));
      return;
    }
    setPendingSubmission({
      paymentData: submissionData,
      payload: {
      ...parsed.data,
      creditLimitOverride: creditLimitOverride || undefined,
      ...(cashDrawerRequired && selectedCashDrawerSessionId && {
        cashDrawerSessionId: selectedCashDrawerSessionId,
      }),
      },
    });
    setSubmitConfirmOpen(true);
  };

  // Payment icon helper
  const getPaymentIcon = (id: string) => {
    const cls = 'w-5 h-5';
    switch (id) {
      case PAYMENT_METHODS.CASH:              return <Banknote className={cls} />;
      case PAYMENT_METHODS.CARD:              return <CreditCard className={cls} />;
      case PAYMENT_METHODS.PAY_ON_COLLECTION: return <Package className={cls} />;
      case PAYMENT_METHODS.CHECK:             return <CheckSquare className={cls} />;
      case PAYMENT_METHODS.INVOICE:           return <FileText className={cls} />;
      case PAYMENT_METHODS.BANK_TRANSFER:     return <FileText className={cls} />;
      case PAYMENT_METHODS.MOBILE_PAYMENT:    return <CreditCard className={cls} />;
      case PAYMENT_METHODS.PAYMENT_GATEWAY:   return <CreditCard className={cls} />;
      case PAYMENT_METHODS.HYPERPAY:          return <CreditCard className={cls} />;
      case PAYMENT_METHODS.PAYTABS:           return <CreditCard className={cls} />;
      case PAYMENT_METHODS.STRIPE:            return <CreditCard className={cls} />;
      case 'WALLET':                          return <Wallet className={cls} />;
      case 'ADVANCE':                         return <Wallet className={cls} />;
      case 'CREDIT_NOTE':                     return <Wallet className={cls} />;
      case 'LOYALTY_POINTS':                  return <Wallet className={cls} />;
      case 'CUSTOMER_ADVANCE':                return <Wallet className={cls} />;
      case 'CUSTOMER_CREDIT':                 return <Wallet className={cls} />;
      case 'LOYALTY_CREDIT':                  return <Wallet className={cls} />;
      default:                                return <Banknote className={cls} />;
    }
  };

  const getPaymentLabel = (id: string) => {
    switch (id) {
      case PAYMENT_METHODS.CASH:              return t('methods.cash');
      case PAYMENT_METHODS.CARD:              return t('methods.card');
      case PAYMENT_METHODS.PAY_ON_COLLECTION: return t('methods.payOnCollection');
      case PAYMENT_METHODS.CHECK:             return t('methods.check');
      case PAYMENT_METHODS.INVOICE:           return t('methods.invoice');
      case PAYMENT_METHODS.BANK_TRANSFER:     return t('methods.bankTransfer');
      case PAYMENT_METHODS.MOBILE_PAYMENT:    return t('methods.mobilePayment');
      case PAYMENT_METHODS.PAYMENT_GATEWAY:   return t('methods.paymentGateway');
      case PAYMENT_METHODS.HYPERPAY:          return t('methods.hyperpay');
      case PAYMENT_METHODS.PAYTABS:           return t('methods.paytabs');
      case PAYMENT_METHODS.STRIPE:            return t('methods.stripe');
      case 'WALLET':                          return t('customerCredits.wallet');
      case 'ADVANCE':                         return t('customerCredits.customerAdvance');
      case 'CREDIT_NOTE':                     return t('customerCredits.customerCredit');
      case 'LOYALTY_POINTS':                  return t('customerCredits.loyaltyCredit');
      case 'CUSTOMER_ADVANCE':                return t('customerCredits.customerAdvance');
      case 'CUSTOMER_CREDIT':                 return t('customerCredits.customerCredit');
      case 'LOYALTY_CREDIT':                  return t('customerCredits.loyaltyCredit');
      default:                                return id;
    }
  };

  const getMethodToneClasses = (id: string) => {
    switch (id) {
      case PAYMENT_METHODS.PAY_ON_COLLECTION:
        return {
          iconWrap: 'bg-teal-100 text-teal-700 border-teal-200',
          selected: 'border-teal-500 bg-gradient-to-r from-teal-50 to-cyan-50 text-slate-900 shadow-sm',
        };
      case PAYMENT_METHODS.CASH:
        return {
          iconWrap: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          selected: 'border-emerald-500 bg-gradient-to-r from-emerald-50 to-white text-slate-900 shadow-sm',
        };
      case PAYMENT_METHODS.CARD:
        return {
          iconWrap: 'bg-blue-100 text-blue-700 border-blue-200',
          selected: 'border-sky-500 bg-gradient-to-r from-sky-50 to-cyan-50 text-slate-900 shadow-sm',
        };
      case PAYMENT_METHODS.CHECK:
        return {
          iconWrap: 'bg-amber-100 text-amber-700 border-amber-200',
          selected: 'border-amber-500 bg-gradient-to-r from-amber-50 to-white text-slate-900 shadow-sm',
        };
      case PAYMENT_METHODS.BANK_TRANSFER:
        return {
          iconWrap: 'bg-indigo-100 text-indigo-700 border-indigo-200',
          selected: 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-white text-slate-900 shadow-sm',
        };
      case PAYMENT_METHODS.MOBILE_PAYMENT:
        return {
          iconWrap: 'bg-violet-100 text-violet-700 border-violet-200',
          selected: 'border-violet-500 bg-gradient-to-r from-violet-50 to-white text-slate-900 shadow-sm',
        };
      case PAYMENT_METHODS.INVOICE:
        return {
          iconWrap: 'bg-cyan-100 text-cyan-700 border-cyan-200',
          selected: 'border-cyan-500 bg-gradient-to-r from-cyan-50 to-white text-slate-900 shadow-sm',
        };
      default:
        return {
          iconWrap: 'bg-slate-100 text-slate-700 border-slate-200',
          selected: 'border-slate-400 bg-gradient-to-r from-slate-50 to-white text-slate-900 shadow-sm',
        };
    }
  };

  const appliedBadgeCount = (appliedPromoCode ? 1 : 0) + (appliedGiftCard ? 1 : 0);
  const activeLeg = paymentLegs[activeLegIndex] ?? null;
  const activeLegRemainingCap = useMemo(() => {
    if (!activeLeg) return 0;
    return getRemainingToAllocate(
      saleTotal,
      paymentLegs,
      giftCardSettlementAmount,
      activeLegIndex,
      decimalPlaces
    );
  }, [activeLeg, activeLegIndex, decimalPlaces, giftCardSettlementAmount, paymentLegs, saleTotal]);
  const effectiveOutstandingPolicy = deriveOutstandingPolicy(
    totalSettledNowAmount,
    saleTotal,
    (outstandingPolicy as OutstandingPolicy | undefined) ?? defaultOutstandingPolicy
  );
  const showDeferredExplanation =
    settlementLegEntries.length === 0 &&
    (paymentMethod === PAYMENT_METHODS.PAY_ON_COLLECTION || paymentMethod === PAYMENT_METHODS.INVOICE);
  const showGiftCardWorkspace =
    !NEW_ORDER_PROMO_GIFT_DISABLED &&
    !appliedGiftCard &&
    (pinRequired || !!giftCardDetails);
  const hasCheckLegWithoutNumber = paymentLegs.some(
    (leg) => leg.method === PAYMENT_METHODS.CHECK && !leg.checkNumber?.trim()
  );
  const hasCheckLegWithInvalidDate = useMemo(
    () =>
      paymentLegs.some((leg) => {
        if (leg.method !== PAYMENT_METHODS.CHECK || !(leg.amount ?? 0)) return false;
        return !!validateCheckDueDate(leg.checkDate);
      }),
    [paymentLegs]
  );
  const creditNoteLegsMissingReference = useMemo(
    () =>
      settlementLegEntries.filter(
        ({ leg }) => leg.method === 'CREDIT_NOTE' && !leg.creditReferenceId?.trim()
      ),
    [settlementLegEntries]
  );
  const terminalRequiredLegs = useMemo(
    () =>
      settlementLegEntries.filter(({ leg }) => {
        const option = getMethodOption(leg.method, leg.gateway_code);
        return option?.requires_terminal && !leg.terminalId?.trim();
      }),
    [getMethodOption, settlementLegEntries]
  );
  const legsMissingRequiredReference = useMemo(
    () =>
      paymentLegs.filter((leg) => {
        const option = getMethodOption(leg.method, leg.gateway_code);
        return (
          (leg.amount ?? 0) > moneyEpsilon &&
          option?.requires_reference === true &&
          !legHasRequiredPaymentReference(leg, true)
        );
      }),
    [getMethodOption, moneyEpsilon, paymentLegs]
  );
  const activeLegOption = activeLeg
    ? getMethodOption(activeLeg.method, activeLeg.gateway_code)
    : undefined;
  const summaryMethodLabel = activeLeg
    ? getOptionDisplayName(activeLegOption, activeLeg.method)
    : getPaymentLabel(paymentMethod || defaultPaymentMethod);
  const paymentLegsTotal = settlementLegEntries.reduce((sum, { leg }) => sum + (leg.amount || 0), 0);
  const splitSidebarSettledTotal = paymentLegsTotal + giftCardSettlementAmount;
  const allocationStatusLabel =
    unresolvedOverpaymentAmount > moneyEpsilon
      ? t('splitPayment.over')
      : remainingBalance > moneyEpsilon
        ? t('splitPayment.outstanding')
        : t('splitPayment.allocated');
  const customerHeaderName = customerDisplayName?.trim() || t('customerCard.walkInCustomer');
  const customerHeaderMeta = customerPhone?.trim() || customerId || t('customerCard.noReference');
  const invalidImmediateAmount =
    paymentMethod !== PAYMENT_METHODS.PAY_ON_COLLECTION &&
    paymentMethod !== PAYMENT_METHODS.INVOICE &&
    totalSettledNowAmount <= 0;
  const cycleActiveLeg = useCallback(() => {
    if (editableLegEntries.length <= 1) return;
    setActiveLegIndex((prev) => {
      const currentPosition = editableLegEntries.findIndex((entry) => entry.index === prev);
      const nextPosition = currentPosition >= 0
        ? (currentPosition + 1) % editableLegEntries.length
        : 0;
      return editableLegEntries[nextPosition]?.index ?? prev;
    });
    focusAmountEditor();
  }, [editableLegEntries, focusAmountEditor]);

  const fillLegRemaining = useCallback(
    (legIndex: number) => {
      const targetLeg = paymentLegs[legIndex];
      if (!targetLeg) return;

      const fillAmount = getSuggestedDefaultLegAmount(
        paymentLegs,
        legIndex,
        saleTotal,
        giftCardSettlementAmount,
        decimalPlaces
      );
      const cappedAmount = capPaymentLegAmount(
        fillAmount,
        paymentLegs,
        legIndex,
        saleTotal,
        giftCardSettlementAmount,
        decimalPlaces,
        getLegStoredValueCap(targetLeg)
      );

      if (cappedAmount <= moneyEpsilon) {
        cmxMessage.info(t('splitPayment.noRemainingToFill'));
        return;
      }

      setIsDirtySinceOpen(true);
      setActiveLegIndex(legIndex);
      updateLeg(legIndex, 'amount', cappedAmount);
      setActiveAmountDraft(formatDecimalDraft(cappedAmount, decimalPlaces));
      focusAmountEditor();
    },
    [
      decimalPlaces,
      focusAmountEditor,
      getLegStoredValueCap,
      giftCardSettlementAmount,
      moneyEpsilon,
      paymentLegs,
      saleTotal,
      t,
      updateLeg,
    ]
  );

  const scrollAndFocusTarget = useCallback(
    (
      target: HTMLElement | null,
      options?: {
        selectText?: boolean;
      }
    ) => {
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        target.focus();
        if (options?.selectText && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
          target.select();
        }
      }, 90);
    },
    []
  );

  const validationItems = useMemo(() => {
    const items: string[] = [];

    if (promoCodeValidating) {
      items.push(t('promoCode.validating'));
    }
    if (giftCardValidating) {
      items.push(t('giftCard.checking'));
    }
    if (overpaymentBlocksSubmit) {
      items.push(t('rightRail.requiredAction.overpaymentMessage', {
        amount: `${currencyCode} ${formatAmount(changeAmount)}`,
      }));
    }
    if (errors.checkNumber?.message) {
      items.push(String(errors.checkNumber.message));
    }
    if (errors.amountDiscount?.message) {
      items.push(String(errors.amountDiscount.message));
    }
    if (errors.percentDiscount?.message) {
      items.push(String(errors.percentDiscount.message));
    }
    if (pinRequired) {
      items.push(t('giftCard.pinPendingError'));
    }
    if (hasCheckLegWithoutNumber) {
      items.push(t('splitPayment.validation.checkNumberRequired'));
    }
    if (hasCheckLegWithInvalidDate) {
      const invalidLeg = paymentLegs.find(
        (leg) =>
          leg.method === PAYMENT_METHODS.CHECK &&
          (leg.amount ?? 0) > 0 &&
          validateCheckDueDate(leg.checkDate)
      );
      if (invalidLeg) {
        items.push(t(`splitPayment.${validateCheckDueDate(invalidLeg.checkDate)!}`));
      }
    }
    legsMissingRequiredReference.forEach((leg) => {
      items.push(
        t('splitPayment.validation.referenceRequired', {
          method: getOptionDisplayName(getMethodOption(leg.method, leg.gateway_code), leg.method),
        })
      );
    });
    if (walletLegExceedsLiveBalance) {
      items.push(
        t('customerCredits.walletBalanceExceeded', {
          amount: liveWalletBalanceDisplay,
        })
      );
    }
    if (storedValueLegExceedsBalance && storedValueLegExceedance && !walletLegExceedsLiveBalance) {
      items.push(
        t('customerCredits.storedValueBalanceExceeded', {
          method: getOptionDisplayName(
            getMethodOption(storedValueLegExceedance.leg.method, storedValueLegExceedance.leg.gateway_code),
            storedValueLegExceedance.leg.method
          ),
          amount: `${currencyCode} ${formatAmount(storedValueLegExceedance.cap)}`,
        })
      );
    }
    creditNoteLegsMissingReference.forEach(() => {
      items.push(t('customerCredits.creditNoteRequired'));
    });
    terminalRequiredLegs.forEach(({ leg }) => {
      items.push(
        t('splitPayment.validation.terminalRequired', {
          method: getOptionDisplayName(getMethodOption(leg.method, leg.gateway_code), leg.method),
        })
      );
    });
    if (cashDrawerBlockingMessage) {
      items.push(cashDrawerBlockingMessage);
    }
    if (invalidImmediateAmount) {
      items.push(t('partialPayment.validation.amountMustBePositive'));
    }
    if (remainingBalance > 0.001 && effectiveOutstandingPolicy === 'NONE') {
      items.push(t('remainder.validation.required'));
    }
    if (serverTotals?.creditLimit?.wouldExceed) {
      if (serverTotals.creditLimit.mode === 'warn' && !creditLimitOverride) {
        items.push(t('b2b.creditExceededWarn'));
      } else if (serverTotals.creditLimit.mode !== 'warn') {
        items.push(t('b2b.creditExceeded'));
      }
    }

    return [...new Set(items)];
  }, [
    creditLimitOverride,
    errors.amountDiscount?.message,
    effectiveOutstandingPolicy,
    errors.checkNumber?.message,
    errors.percentDiscount?.message,
    giftCardValidating,
    hasCheckLegWithoutNumber,
    hasCheckLegWithInvalidDate,
    creditNoteLegsMissingReference,
    terminalRequiredLegs,
    storedValueLegExceedance,
    storedValueLegExceedsBalance,
    legsMissingRequiredReference,
    getMethodOption,
    getOptionDisplayName,
    liveWalletBalanceDisplay,
    cashDrawerBlockingMessage,
    changeAmount,
    currencyCode,
    paymentMethod,
    formatAmount,
    pinRequired,
    promoCodeValidating,
    overpaymentBlocksSubmit,
    remainingBalance,
    serverTotals?.creditLimit?.mode,
    serverTotals?.creditLimit?.wouldExceed,
    totalSettledNowAmount,
    t,
    walletLegExceedsLiveBalance,
  ]);

  const submitBusy = loading || totalsLoading || (items.length > 0 && !serverTotals);
  const submitHasBlockingIssues = validationItems.length > 0;
  const rightRailState: PaymentModalRightRailState = useMemo(
    () =>
      derivePaymentModalRightRailState({
        hasBlockingIssues: submitHasBlockingIssues,
        changeAmount,
        remainingBalance,
        effectiveOutstandingPolicy,
        epsilon: moneyEpsilon,
        cashDrawerBlockingMessage,
        creditLimitWouldExceed: !!serverTotals?.creditLimit?.wouldExceed,
        creditLimitMode: serverTotals?.creditLimit?.mode,
        creditLimitOverride,
        pinRequired,
        hasCheckLegWithoutNumber,
        walletLegExceedsLiveBalance,
        invalidImmediateAmount,
        canReturnChangeFromCash,
        currencyExRate: currencyConfig?.currencyExRate,
        roundingAmount: 0,
      }),
    [
      submitHasBlockingIssues,
      changeAmount,
      remainingBalance,
      effectiveOutstandingPolicy,
      moneyEpsilon,
      cashDrawerBlockingMessage,
      serverTotals?.creditLimit?.wouldExceed,
      serverTotals?.creditLimit?.mode,
      creditLimitOverride,
      pinRequired,
      hasCheckLegWithoutNumber,
      walletLegExceedsLiveBalance,
      invalidImmediateAmount,
      canReturnChangeFromCash,
      currencyConfig?.currencyExRate,
    ]
  );
  const balanceStatusLabel = useMemo(() => {
    switch (rightRailState.balanceStatus) {
      case RIGHT_RAIL_BALANCE_STATUS.BLOCKED:
        return t('rightRail.statuses.blocked');
      case RIGHT_RAIL_BALANCE_STATUS.OVERPAID:
        return t('rightRail.statuses.overpaid');
      case RIGHT_RAIL_BALANCE_STATUS.FULLY_SETTLED:
        return t('rightRail.statuses.fullySettled');
      case RIGHT_RAIL_BALANCE_STATUS.PAY_ON_COLLECTION:
        return t('rightRail.statuses.payOnCollection');
      case RIGHT_RAIL_BALANCE_STATUS.INVOICE_OUTSTANDING:
        return t('rightRail.statuses.invoiceOutstanding');
      default:
        return t('rightRail.statuses.paymentRequired');
    }
  }, [rightRailState.balanceStatus, t]);
  const requiredActionCopy = useMemo(() => {
    switch (rightRailState.requiredAction) {
      case RIGHT_RAIL_REQUIRED_ACTION.OVERPAYMENT:
        return {
          title: t('rightRail.requiredAction.overpaymentTitle'),
          message: t('rightRail.requiredAction.overpaymentMessage', {
            amount: `${currencyCode} ${formatAmount(changeAmount)}`,
          }),
        };
      case RIGHT_RAIL_REQUIRED_ACTION.CASH_DRAWER:
        return {
          title: t('rightRail.requiredAction.cashDrawerTitle'),
          message: cashDrawerBlockingMessage ?? t('rightRail.requiredAction.cashDrawerFallback'),
        };
      case RIGHT_RAIL_REQUIRED_ACTION.CREDIT_LIMIT:
        return {
          title: t('rightRail.requiredAction.creditLimitTitle'),
          message: serverTotals?.creditLimit?.mode === 'warn'
            ? t('rightRail.requiredAction.creditLimitWarn')
            : t('rightRail.requiredAction.creditLimitBlock'),
        };
      case RIGHT_RAIL_REQUIRED_ACTION.GIFT_CARD_PIN:
        return {
          title: t('rightRail.requiredAction.giftCardPinTitle'),
          message: t('giftCard.pinPendingError'),
        };
      case RIGHT_RAIL_REQUIRED_ACTION.CHECK_DETAILS:
        return {
          title: t('rightRail.requiredAction.checkTitle'),
          message: t('splitPayment.validation.checkNumberRequired'),
        };
      case RIGHT_RAIL_REQUIRED_ACTION.STORED_VALUE:
        return {
          title: t('rightRail.requiredAction.storedValueTitle'),
          message: t('customerCredits.walletBalanceExceeded', {
            amount: liveWalletBalanceDisplay,
          }),
        };
      case RIGHT_RAIL_REQUIRED_ACTION.PAYMENT_AMOUNT:
        return {
          title: t('rightRail.requiredAction.paymentAmountTitle'),
          message: t('partialPayment.validation.amountMustBePositive'),
        };
      case RIGHT_RAIL_REQUIRED_ACTION.REMAINING_POLICY:
        return {
          title: t('rightRail.requiredAction.remainingPolicyTitle'),
          message: t('remainder.validation.required'),
        };
      case RIGHT_RAIL_REQUIRED_ACTION.GENERIC:
        return {
          title: t('rightRail.requiredAction.genericTitle'),
          message: validationItems[0] ?? t('messages.validationErrors'),
        };
      default:
        return null;
    }
  }, [
    rightRailState.requiredAction,
    t,
    currencyCode,
    formatAmount,
    changeAmount,
    cashDrawerBlockingMessage,
    serverTotals?.creditLimit?.mode,
    liveWalletBalanceDisplay,
    validationItems,
  ]);
  const realPaymentSummaryItems = useMemo<RightRailSummaryItem[]>(
    () =>
      realPaymentEntries.map(({ leg }) => ({
        label: getOptionDisplayName(getMethodOption(leg.method, leg.gateway_code), leg.method),
        value: `${currencyCode} ${formatAmount(leg.amount || 0)}`,
      })),
    [realPaymentEntries, getOptionDisplayName, getMethodOption, currencyCode, formatAmount]
  );
  const storedValueSummaryItems = useMemo<RightRailSummaryItem[]>(
    () =>
      customerCreditEntries.map(({ leg }) => ({
        label: getOptionDisplayName(getMethodOption(leg.method, leg.gateway_code), leg.method),
        value: `${currencyCode} ${formatAmount(leg.amount || 0)}`,
      })),
    [customerCreditEntries, getOptionDisplayName, getMethodOption, currencyCode, formatAmount]
  );
  const orderValueBreakdownModel = useMemo<OrderValueBreakdownModel>(
    () => {
      const grossRows: OrderValueBreakdownRow[] = [
        {
          id: 'subtotal',
          label: t('summary.subtotal'),
          value: `${currencyCode} ${formatAmount(totals.subtotal)}`,
        },
      ];
      const discountRows: OrderValueBreakdownRow[] = [];
      const taxRows: OrderValueBreakdownRow[] = [];

      if ((totals.autoRuleDiscount ?? 0) > moneyEpsilon) {
        discountRows.push({
          id: 'rules-discount',
          label: t('summary.rulesDiscount'),
          value: `-${currencyCode} ${formatAmount(totals.autoRuleDiscount ?? 0)}`,
          negative: true,
        });
      }

      if (totals.manualDiscount > moneyEpsilon) {
        discountRows.push({
          id: 'manual-discount',
          label: t('summary.manualDiscount'),
          value: `-${currencyCode} ${formatAmount(totals.manualDiscount)}`,
          negative: true,
        });
      }

      if (totals.promoDiscount > moneyEpsilon) {
        discountRows.push({
          id: 'promo-discount',
          label: t('summary.promoDiscount'),
          value: `-${currencyCode} ${formatAmount(totals.promoDiscount)}`,
          negative: true,
        });
      }

      displayTaxBreakdown.forEach((entry, index) => {
        if (entry.taxAmount <= moneyEpsilon) {
          return;
        }
        const entryLabel = isRTL ? (entry.label2 || entry.label) : entry.label;
        taxRows.push({
          id: `tax-${entry.profileId ?? entry.taxType}-${index}`,
          label: `${entryLabel} (${entry.rate.toFixed(2)}%)`,
          value: `${currencyCode} ${formatAmount(entry.taxAmount)}`,
        });
      });

      if (displayTaxBreakdown.length > 1 && profilesTaxAmount > moneyEpsilon) {
        taxRows.push({
          id: 'tax-total',
          label: t('tax.totalTax'),
          value: `${currencyCode} ${formatAmount(profilesTaxAmount)}`,
        });
      }

      const totalRow: OrderValueBreakdownRow = {
        id: 'order-total',
        label: t('rightRail.orderTotal'),
        value: `${currencyCode} ${formatAmount(saleTotal)}`,
      };

      return {
        grossRows,
        discountRows,
        taxRows,
        totalRow,
      };
    },
    [currencyCode, displayTaxBreakdown, formatAmount, isRTL, moneyEpsilon, profilesTaxAmount, saleTotal, t, totals]
  );
  const warningMessages = useMemo(() => {
    const warnings: string[] = [];

    rightRailState.warningCodes.forEach((warningCode) => {
      if (warningCode === RIGHT_RAIL_WARNING.CREDIT_LIMIT_OVERRIDE) {
        warnings.push(t('rightRail.warningMessages.creditLimitOverride'));
      }
    });

    return warnings;
  }, [rightRailState.warningCodes, t]);

  const hasDiscountBreakdown =
    totals.manualDiscount > moneyEpsilon ||
    totals.promoDiscount > moneyEpsilon ||
    (totals.autoRuleDiscount ?? 0) > moneyEpsilon ||
    !!appliedPromoCode ||
    !!appliedGiftCard;
  const visiblePaymentSectionIds = useMemo(
    () =>
      new Set(
        deriveVisiblePaymentSections({
          hasActivePaymentLeg: !!activeLeg,
          showDeferredExplanation,
          discountsEnabled: true,
          hasDiscountsApplied: hasDiscountBreakdown,
          hasPromoActivity: !!promoCode?.trim() || !!appliedPromoCode,
          hasGiftCardActivity:
            !!giftCardNumber?.trim() ||
            !!giftCardDetails ||
            !!appliedGiftCard ||
            pinRequired,
          hasCashLeg: cashDrawerRequired,
          showBalancePolicy: rightRailState.showBalancePolicy,
        }).map((section) => section.id)
      ),
    [
      activeLeg,
      appliedGiftCard,
      appliedPromoCode,
      cashDrawerRequired,
      giftCardDetails,
      giftCardNumber,
      hasDiscountBreakdown,
      pinRequired,
      promoCode,
      rightRailState.showBalancePolicy,
      showDeferredExplanation,
    ]
  );
  const inspectorTabIds = useMemo(
    () =>
      derivePaymentInspectorTabs({
        hasTaxBreakdown: displayTaxBreakdown.length > 0,
        hasDiscountBreakdown,
        hasWarnings: warningMessages.length > 0,
        isB2B: customerType === 'b2b' && !!customerId,
      }),
    [
      customerId,
      customerType,
      displayTaxBreakdown.length,
      hasDiscountBreakdown,
      warningMessages.length,
    ]
  );
  const showAmountEditorSection = visiblePaymentSectionIds.has(
    PAYMENT_MODAL_SECTION_IDS.AMOUNT_EDITOR
  );
  const showDiscountsCreditsSection = visiblePaymentSectionIds.has(
    PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS
  );
  const showCashDrawerWorkbenchSection = visiblePaymentSectionIds.has(
    PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER
  );
  const showBalancePolicySection = visiblePaymentSectionIds.has(
    PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY
  );

  const scrollToWorkbenchSection = useCallback(
    (sectionId: string) => {
      const target =
        sectionId === PAYMENT_MODAL_SECTION_IDS.BALANCE_SNAPSHOT
          ? balanceSnapshotSectionRef.current
          : sectionId === PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE
            ? paymentWorkspaceSectionRef.current
            : sectionId === PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS
              ? couponCardRef.current
              : sectionId === PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER
                ? cashDrawerCardRef.current
                : sectionId === PAYMENT_MODAL_SECTION_IDS.FINANCIAL_INSPECTOR
                  ? financialInspectorSectionRef.current
                  : sectionId === PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY
                    ? balancePolicySectionRef.current
                    : null;

      scrollAndFocusTarget(target);
    },
    [scrollAndFocusTarget]
  );

  const focusFirstBlockingIssue = useCallback(() => {
    if (promoCodeValidating || giftCardValidating || pinRequired) {
      scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS);
      if (pinRequired && !giftCardPin.trim()) {
        setPinFieldError(t('giftCard.pinPendingError'));
      }
      window.setTimeout(() => {
        if (pinRequired && !giftCardPin.trim()) {
          scrollAndFocusTarget(pinInputRef.current, { selectText: true });
          return;
        }
        scrollAndFocusTarget(couponCardRef.current);
      }, 90);
      return;
    }

    if (errors.amountDiscount?.message) {
      scrollAndFocusTarget(amountDiscountInputRef.current, { selectText: true });
      return;
    }

    if (errors.percentDiscount?.message) {
      scrollAndFocusTarget(percentDiscountInputRef.current, { selectText: true });
      return;
    }

    if (invalidImmediateAmount) {
      focusAmountEditor();
      window.setTimeout(() => {
        scrollAndFocusTarget(amountInputRef.current, { selectText: true });
      }, 90);
      return;
    }

    if (overpaymentBlocksSubmit) {
      scrollAndFocusTarget(extraReceiptCardRef.current);
      return;
    }

    if (legsMissingRequiredReference.length > 0) {
      const missingRefLeg = legsMissingRequiredReference[0];
      const refLegIndex = paymentLegs.findIndex(
        (leg) =>
          leg.method === missingRefLeg.method &&
          (leg.gateway_code ?? '') === (missingRefLeg.gateway_code ?? '')
      );
      if (refLegIndex >= 0) {
        setActiveLegIndex(refLegIndex);
      }
      window.setTimeout(() => {
        scrollAndFocusTarget(amountInputRef.current, { selectText: true });
      }, 90);
      return;
    }

    if (hasCheckLegWithoutNumber) {
      const checkLegIndex = paymentLegs.findIndex(
        (leg) => leg.method === PAYMENT_METHODS.CHECK && !leg.checkNumber?.trim()
      );
      if (checkLegIndex >= 0) {
        setActiveLegIndex(checkLegIndex);
        setValue('paymentMethod', PAYMENT_METHODS.CHECK, { shouldDirty: true });
      }
      window.setTimeout(() => {
        scrollAndFocusTarget(checkNumberInputRef.current, { selectText: true });
      }, 90);
      return;
    }

    if (hasCheckLegWithInvalidDate) {
      const checkLegIndex = paymentLegs.findIndex(
        (leg) =>
          leg.method === PAYMENT_METHODS.CHECK &&
          (leg.amount ?? 0) > 0 &&
          validateCheckDueDate(leg.checkDate)
      );
      if (checkLegIndex >= 0) {
        setActiveLegIndex(checkLegIndex);
        setValue('paymentMethod', PAYMENT_METHODS.CHECK, { shouldDirty: true });
      }
      window.setTimeout(() => {
        scrollAndFocusTarget(checkDateInputRef.current, { selectText: true });
      }, 90);
      return;
    }

    if (terminalRequiredLegs.length > 0) {
      setActiveLegIndex(terminalRequiredLegs[0].index);
      window.setTimeout(() => {
        scrollAndFocusTarget(amountInputRef.current);
      }, 90);
      return;
    }

    if (creditNoteLegsMissingReference.length > 0) {
      setActiveLegIndex(creditNoteLegsMissingReference[0].index);
      setPendingCreditNoteOption(
        customerCreditOptions.find((option) => option.payment_method_code === 'CREDIT_NOTE') ?? null
      );
      setCreditNotePickerOpen(true);
      return;
    }

    if (storedValueLegExceedsBalance) {
      const exceedLegIndex =
        storedValueLegExceedance?.index ??
        paymentLegs.findIndex((leg) => leg.method === 'WALLET');
      if (exceedLegIndex >= 0) {
        setActiveLegIndex(exceedLegIndex);
      }
      window.setTimeout(() => {
        scrollAndFocusTarget(amountInputRef.current, { selectText: true });
      }, 90);
      return;
    }

    if (cashDrawerBlockingMessage) {
      scrollAndFocusTarget(cashDrawerCardRef.current);
      return;
    }

    if (remainingBalance > 0.001 && effectiveOutstandingPolicy === 'NONE') {
      scrollAndFocusTarget(payOnCollectionPolicyButtonRef.current);
      return;
    }

    if (serverTotals?.creditLimit?.wouldExceed) {
      if (serverTotals.creditLimit.mode === 'warn' && !creditLimitOverride) {
        scrollAndFocusTarget(creditLimitOverrideRef.current);
        return;
      }
      scrollAndFocusTarget(creditLimitCardRef.current);
    }
  }, [
    creditLimitOverride,
    creditNoteLegsMissingReference,
    customerCreditOptions,
    errors.amountDiscount?.message,
    errors.percentDiscount?.message,
    effectiveOutstandingPolicy,
    focusAmountEditor,
    giftCardPin,
    giftCardValidating,
    hasCheckLegWithoutNumber,
    hasCheckLegWithInvalidDate,
    legsMissingRequiredReference,
    storedValueLegExceedance,
    storedValueLegExceedsBalance,
    cashDrawerBlockingMessage,
    paymentLegs,
    pinRequired,
    promoCodeValidating,
    remainingBalance,
    scrollAndFocusTarget,
    scrollToWorkbenchSection,
    serverTotals?.creditLimit?.mode,
    serverTotals?.creditLimit?.wouldExceed,
    setValue,
    t,
    terminalRequiredLegs,
    invalidImmediateAmount,
    overpaymentBlocksSubmit,
  ]);

  const handleBlockedSubmitAttempt = useCallback(() => {
    focusFirstBlockingIssue();
    cmxMessage.error(validationItems[0] ?? t('messages.validationErrors'));
  }, [focusFirstBlockingIssue, t, validationItems]);

  const onInvalidForm = useCallback((formErrors: FieldErrors<PaymentFormData>) => {
    focusFirstBlockingIssue();

    const firstFieldError = Object.values(formErrors).find((value) => value?.message);
    if (firstFieldError?.message) {
      cmxMessage.error(String(firstFieldError.message));
      return;
    }

    if (paymentMethod === PAYMENT_METHODS.CHECK) {
      cmxMessage.error(t('checkNumber.required'));
      return;
    }

    cmxMessage.error(t('messages.validationErrors'));
  }, [focusFirstBlockingIssue, paymentMethod, t]);

  const submitButtonLabel = useMemo(() => {
    const epsilon = Math.pow(10, -(decimalPlaces + 1));
    if (remainingBalance > epsilon) {
      return t('actions.submitWithUnpaid', {
        submit: t('actions.submit'),
        currency: currencyCode,
        payNow: formatAmount(settledNowAmount),
        unpaid: t('summary.notPaidBalance'),
        remaining: formatAmount(remainingBalance),
      });
    }
    return t('actions.submitChargeOnly', {
      submit: t('actions.submit'),
      currency: currencyCode,
      amount: formatAmount(settledNowAmount > 0 ? settledNowAmount : saleTotal),
    });
  }, [t, currencyCode, decimalPlaces, remainingBalance, saleTotal, settledNowAmount]);

  const handleOutstandingPolicyChange = useCallback((policy: OutstandingPolicy) => {
    setIsDirtySinceOpen(true);
    setValue('outstandingPolicy', policy, { shouldDirty: true });

    if (paymentMethod === PAYMENT_METHODS.PAY_ON_COLLECTION || paymentMethod === PAYMENT_METHODS.INVOICE) {
      setValue(
        'paymentMethod',
        policy === 'CREDIT_INVOICE' ? PAYMENT_METHODS.INVOICE : PAYMENT_METHODS.PAY_ON_COLLECTION,
        { shouldDirty: true }
      );
    }
  }, [paymentMethod, setValue]);

  useEffect(() => {
    if (!activeLeg) {
      activeLegDraftSyncKeyRef.current = null;
      setActiveAmountDraft('');
      return;
    }

    const activeLegDraftSyncKey = `${activeLegIndex}:${activeLeg.method}:${activeLeg.gateway_code ?? ''}`;
    const draftSourceAmount =
      activeLeg.method === PAYMENT_METHODS.CASH
        ? activeLeg.cashTendered ?? activeLeg.amount ?? 0
        : activeLeg.amount ?? 0;
    const normalizedLegDraft = formatDecimalDraft(draftSourceAmount, decimalPlaces);
    const normalizedCurrentDraft = sanitizeDecimalDraft(activeAmountDraft, decimalPlaces);
    const currentDraftAmount = parseDecimalDraft(normalizedCurrentDraft);
    const legAmount = draftSourceAmount;
    const sameLeg = activeLegDraftSyncKeyRef.current === activeLegDraftSyncKey;
    const draftMatchesSameLegAmount = sameLeg && currentDraftAmount === legAmount;

    activeLegDraftSyncKeyRef.current = activeLegDraftSyncKey;

    if (draftMatchesSameLegAmount) {
      return;
    }

    setActiveAmountDraft(normalizedLegDraft);
  }, [activeAmountDraft, activeLeg, activeLegIndex, decimalPlaces]);

  const handleKeypadPress = useCallback((key: PaymentKeypadKey) => {
    if (!activeLeg) return;
    const nextDraft = applyKeypadInput(
      activeAmountDraft,
      key,
      decimalPlaces
    );
    const nextAmount = parseDecimalDraft(nextDraft);
    const option = getMethodOption(activeLeg.method, activeLeg.gateway_code);
    const policy = resolvePaymentOverpaymentPolicy({
      paymentMethodCode: activeLeg.method,
      supportsChangeReturn: option?.supports_change_return,
      supportsOverpayment: option?.supports_overpayment,
      requiresCashDrawer: option?.requires_cash_drawer,
    });
    const cappedAmount = deriveLegAppliedAmount({
      rawAmount: nextAmount,
      paymentLegs,
      legIndex: activeLegIndex,
      saleTotal,
      giftCardAmount: giftCardSettlementAmount,
      decimalPlaces,
      walletBalance: activeLeg ? getLegStoredValueCap(activeLeg) : undefined,
      supportsOverpayment: !policy.isCash && policy.supportsOverpayment,
    });
    setActiveAmountDraft(
      nextAmount > cappedAmount && !(policy.isCash && policy.supportsChangeReturn)
        ? formatDecimalDraft(cappedAmount, decimalPlaces)
        : nextDraft
    );
    if (activeLeg) {
      notifyIfLegAmountCapped(activeLeg, nextAmount, cappedAmount);
    }
    updateLeg(activeLegIndex, 'amount', nextAmount);
  }, [
    activeAmountDraft,
    activeLeg,
    activeLegIndex,
    decimalPlaces,
    getLegStoredValueCap,
    getMethodOption,
    giftCardSettlementAmount,
    notifyIfLegAmountCapped,
    paymentLegs,
    saleTotal,
    updateLeg,
  ]);

  const closeWithGuard = useCallback(() => {
    if (!isDirtySinceOpen) {
      onClose();
      return;
    }
    setConfirmCloseOpen(true);
  }, [isDirtySinceOpen, onClose]);

  const handleConfirmPaymentSubmit = useCallback(() => {
    if (!pendingSubmission) return;
    const { paymentData, payload } = pendingSubmission;
    setSubmitConfirmOpen(false);
    setPendingSubmission(null);
    onSubmit(paymentData, payload);
  }, [onSubmit, pendingSubmission]);

  if (!open) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      <CmxDialog open={open} onOpenChange={(nextOpen) => !nextOpen && closeWithGuard()}>
        <CmxDialogContent
          className="mx-4 h-[94vh] w-[calc(100vw-2rem)] max-w-[1900px] overflow-hidden rounded-[28px] border border-slate-200/80 p-0 shadow-2xl"
          bodyPadding="none"
        >
          <div
            ref={focusTrapRef}
            className="relative flex h-full flex-col bg-[rgb(var(--cmx-background-rgb,255_255_255))]"
          >
            <CmxDialogHeader className="flex items-center justify-between border-b bg-gradient-to-r from-slate-50 via-white to-cyan-50">
              <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <CmxDialogTitle>{t('title')}</CmxDialogTitle>
                {isExpress && <Badge variant="secondary" className="text-xs">{t('expressLabel')}</Badge>}
                <Badge variant="secondary" className="text-xs">{currencyCode}</Badge>
              </div>
              <CmxButton type="button" variant="ghost" size="sm" onClick={closeWithGuard} aria-label={tCommon('close')}>
                <X className="h-5 w-5" />
              </CmxButton>
            </CmxDialogHeader>

            <form
              onSubmit={(event) => event.preventDefault()}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex-1 overflow-auto bg-[rgb(var(--cmx-background-rgb,248_250_252))] p-4">
              <div className="mx-auto grid min-h-full max-w-[1880px] items-start gap-4 xl:grid-cols-[320px_minmax(720px,1fr)_360px]">
                <aside className="min-w-0">
                  <CmxCard className="overflow-hidden border-cyan-100 bg-white/95 shadow-sm">
                    <CmxCardHeader className="border-b border-cyan-100 pb-3">
                      <CmxCardTitle className={`flex items-center gap-2 text-base font-semibold text-cyan-900 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                        <CreditCard className="h-4 w-4 text-cyan-700" />
                        {t('sections.paymentTools')}
                      </CmxCardTitle>
                      <p className={`mt-1 text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('sections.paymentToolsHelp')}
                      </p>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-3 pt-3">
                <div className="space-y-3">
                  <div ref={methodsAnchorRef}>
                  <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                    <CmxCardHeader className="border-b border-slate-100 pb-3">
                      <CmxCardTitle className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        {t('methods.title')}
                        <Info className="h-3.5 w-3.5 text-slate-400" />
                      </CmxCardTitle>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-3">
                      {checkoutMethodsLoading ? (
                        <div className="space-y-2">
                          <CmxSkeleton className="h-14 w-full" />
                          <CmxSkeleton className="h-14 w-full" />
                          <CmxSkeleton className="h-14 w-full" />
                        </div>
                      ) : realPaymentOptions.length === 0 ? (
                        <p className="text-xs text-slate-500">{t('methods.noMethods')}</p>
                      ) : (
                        realPaymentOptions.map((option) => {
                          const optionLabel = getOptionDisplayName(option, option.payment_method_code);
                          const methodKey = `${option.payment_method_code}::${option.gateway_code ?? ''}`;
                          const selected = !!paymentLegs.find(
                            (leg) =>
                              `${leg.method}::${leg.gateway_code ?? ''}` === methodKey
                          );
                          const tone = getMethodToneClasses(option.payment_method_code);
                          const description = isRTL
                            ? (option.description2 || option.description)
                            : (option.description || option.description2);
                          return (
                            <CmxButton
                              key={methodKey}
                              type="button"
                              variant="outline"
                              size="lg"
                              onClick={() => handleMethodSelect(option)}
                              className={`h-auto w-full justify-start rounded-2xl border px-4 py-4 ${selected ? tone.selected : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'} ${isRTL ? 'flex-row-reverse' : ''}`}
                            >
                              <span className={`flex w-full items-start gap-3 ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}>
                                <span className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tone.iconWrap}`}>
                                  {getPaymentIcon(option.payment_method_code)}
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col">
                                  <span className="flex items-start justify-between gap-2">
                                    <span className="text-[15px] font-semibold leading-5 text-slate-900">{optionLabel}</span>
                                    {option.payment_method_code === defaultPaymentMethod && (
                                      <Badge variant="secondary" className="rounded-full bg-teal-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                                        {t('methods.defaultBadge')}
                                      </Badge>
                                    )}
                                  </span>
                                  <span className="mt-1 text-sm text-slate-600">
                                    {description || (option.requires_cash_drawer
                                      ? (t('methods.touchHintCashDrawer') || 'Cash drawer / immediate collection')
                                      : (t('methods.touchHintImmediate') || 'Immediate settlement'))}
                                  </span>
                                  <span className="mt-1 text-xs font-medium text-slate-400">
                                    {getMethodHint(option)}
                                  </span>
                                </span>
                              </span>
                            </CmxButton>
                          );
                        })
                      )}
                    </CmxCardContent>
                  </CmxCard>
                  </div>

                  <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                    <CmxCardHeader className="border-b border-slate-100 pb-2">
                      <CmxCardTitle className={`text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Wallet className="h-4 w-4" />
                        {t('customerCredits.title')}
                      </CmxCardTitle>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-2">
                      {customerCreditOptions.length === 0 ? (
                        <p className="text-xs text-slate-500">{t('customerCredits.empty')}</p>
                      ) : (
                        customerCreditOptions.map((option) => {
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
                                ? t('customerCredits.available', {
                                    amount: liveWalletBalanceDisplay,
                                  })
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
                              {isWalletOption && (
                                <div className={`flex items-center justify-between gap-2 px-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                  <Badge variant="secondary" className="rounded-full bg-cyan-50 text-cyan-700">
                                    {t('customerCredits.liveBadge')}
                                  </Badge>
                                  <CmxButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void refetchStoredValueSummary()}
                                    disabled={storedValueFetching}
                                    aria-label={t('customerCredits.refreshBalance')}
                                    className="h-8 rounded-xl px-2 text-slate-500"
                                  >
                                    {storedValueFetching ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                  </CmxButton>
                                </div>
                              )}
                              <CmxButton
                                type="button"
                                variant="outline"
                                size="lg"
                                disabled={disabled}
                                onClick={() => handleCustomerCreditSelect(option)}
                                className={`h-auto w-full justify-start rounded-2xl border px-4 py-4 ${selected ? 'border-cyan-500 bg-gradient-to-r from-cyan-50 to-white text-slate-900 shadow-sm' : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'} ${disabled ? 'opacity-75' : ''} ${isRTL ? 'flex-row-reverse' : ''}`}
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
                                    {isWalletOption && selected && !walletLegExceedsLiveBalance && (
                                      <span className="mt-1 text-xs font-medium text-cyan-700">
                                        {t('customerCredits.applied')}
                                      </span>
                                    )}
                                    {isWalletOption && walletLegExceedsLiveBalance && (
                                      <span className="mt-1 text-xs font-medium text-red-600">
                                        {t('customerCredits.walletBalanceExceeded', {
                                          amount: liveWalletBalanceDisplay,
                                        })}
                                      </span>
                                    )}
                                  </span>
                                </span>
                              </CmxButton>
                            </div>
                          );
                        })
                      )}
                    </CmxCardContent>
                  </CmxCard>

                  <CmxCard ref={legsCardRef} className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                    <CmxCardHeader className="border-b border-slate-100 pb-2">
                      <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <CmxCardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {t('splitPayment.title')}
                          {editableLegEntries.length > 0 && (
                            <Badge variant="secondary" className="ms-2 rounded-full bg-slate-100 text-slate-600">
                              {editableLegEntries.length}
                            </Badge>
                          )}
                        </CmxCardTitle>
                        {editableLegEntries.length > 0 && (
                          <span className="text-xs font-semibold text-cyan-700">
                            {t('splitPayment.settledTotal')}: {currencyCode} {formatAmount(splitSidebarSettledTotal)}
                          </span>
                        )}
                      </div>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-2">
                      {editableLegEntries.length === 0 ? (
                        <p className="text-xs text-slate-500">{t('workspace.addSplitHint') || 'Select an immediate method to start collecting payment.'}</p>
                      ) : (
                        editableLegEntries.map(({ leg, index }) => {
                          const option = getMethodOption(leg.method, leg.gateway_code);
                          const label = getOptionDisplayName(option, leg.method);
                          const legRemainingCap = getRemainingToAllocate(
                            saleTotal,
                            paymentLegs,
                            giftCardSettlementAmount,
                            index,
                            decimalPlaces
                          );
                          const canFillLeg = legRemainingCap > moneyEpsilon;
                          return (
                          <div
                            key={`payment-leg-summary-${index}`}
                            className={`flex items-stretch gap-2 rounded-2xl border transition ${
                              activeLegIndex === index
                                ? 'border-cyan-500 bg-gradient-to-r from-cyan-50 to-white shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <CmxButton
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setActiveLegIndex(index);
                                focusAmountEditor();
                              }}
                              className={`h-auto min-h-0 flex-1 justify-between rounded-2xl border-0 px-3 py-3 text-sm shadow-none ${
                                activeLegIndex === index
                                  ? 'text-cyan-900 hover:bg-transparent'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
                                  {index + 1}
                                </span>
                                <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${getMethodToneClasses(leg.method).iconWrap}`}>
                                  {getPaymentIcon(leg.method)}
                                </span>
                                <span className="font-medium">{label}</span>
                              </span>
                              <span className="flex items-center gap-2">
                                <span className="tabular-nums font-semibold">{currencyCode} {formatAmount(leg.amount || 0)}</span>
                                <EllipsisVertical className="h-4 w-4 text-slate-300" />
                              </span>
                            </CmxButton>
                            <CmxButton
                              type="button"
                              variant="outline"
                              size="xs"
                              disabled={!canFillLeg}
                              aria-label={t('splitPayment.fillRemaining')}
                              onClick={() => fillLegRemaining(index)}
                              className="my-2 me-2 shrink-0 rounded-xl border-cyan-200 px-2.5 text-cyan-700"
                            >
                              {t('splitPayment.fillRemaining')}
                            </CmxButton>
                          </div>
                        );
                        })
                      )}
                      <CmxButton
                        type="button"
                        variant="outline"
                        onClick={() => {
                          methodsAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="w-full justify-center rounded-2xl border-dashed border-slate-300 bg-white text-slate-600 hover:border-cyan-400 hover:text-cyan-700"
                      >
                        <Plus className="me-2 h-4 w-4" />
                        {t('splitPayment.addMethod')}
                      </CmxButton>
                      {activeLeg && (
                        <CmxButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLegAt(activeLegIndex)}
                          className="w-full justify-center text-red-600"
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          {t('splitPayment.remove')}
                        </CmxButton>
                      )}
                    </CmxCardContent>
                  </CmxCard>
                </div>
                    </CmxCardContent>
                  </CmxCard>
                </aside>

                <section className="min-w-0">
                  <CmxCard className="overflow-hidden border-cyan-100 bg-white/95 shadow-sm">
                    <CmxCardHeader className="border-b border-cyan-100 pb-3">
                      <div className={`flex items-start justify-between gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                        <div>
                          <CmxCardTitle className={`flex items-center gap-2 text-base font-semibold text-cyan-900 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <Maximize2 className="h-4 w-4 text-cyan-700" />
                            {t('sections.paymentWorkbench')}
                          </CmxCardTitle>
                          <p className="mt-1 text-xs text-slate-500">{t('sections.paymentWorkbenchHelp')}</p>
                        </div>
                        <Badge variant="secondary" className="rounded-full bg-cyan-50 px-3 py-1 text-cyan-700">
                          {visiblePaymentSectionIds.size}
                        </Badge>
                      </div>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-3 pt-3">
                <div className="space-y-3">
                  <div ref={balanceSnapshotSectionRef} tabIndex={-1} className="outline-none">
                  <CmxCard className="overflow-hidden border-cyan-100 bg-gradient-to-br from-white via-slate-50 to-cyan-50/60 shadow-sm">
                    <CmxCardHeader className="border-b border-cyan-100 pb-3">
                      <div className={`flex items-start justify-between gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                        <div>
                          <CmxCardTitle className="text-sm text-cyan-900">
                            {t('sections.sectionA')} · {t('sections.balanceSnapshot')}
                          </CmxCardTitle>
                          <p className="mt-1 text-xs text-slate-500">{t('sections.balanceSnapshotHelp')}</p>
                        </div>
                        <Badge variant="secondary" className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          unresolvedOverpaymentAmount > moneyEpsilon
                            ? 'bg-rose-50 text-rose-700'
                            : remainingBalance > moneyEpsilon
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {allocationStatusLabel}
                        </Badge>
                      </div>
                    </CmxCardHeader>
                    <CmxCardContent className="pt-4">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold text-slate-500">{t('workspace.remaining') || 'Remaining'}</p>
                          <p className="mt-2 text-xl font-bold tabular-nums text-amber-600">{currencyCode} {formatAmount(remainingBalance)}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold text-slate-500">{t('workspace.change') || 'Change'}</p>
                          <p className={`mt-2 text-xl font-bold tabular-nums ${displayChangeAmount > moneyEpsilon ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {currencyCode} {formatAmount(displayChangeAmount)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold text-slate-500">{t('workspace.totalDue') || 'Total Due'}</p>
                          <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">{currencyCode} {formatAmount(saleTotal)}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold text-slate-500">{t('rightRail.overpaidAmount')}</p>
                          <p className={`mt-2 text-xl font-bold tabular-nums ${unresolvedOverpaymentAmount > moneyEpsilon ? 'text-rose-600' : 'text-slate-900'}`}>
                            {currencyCode} {formatAmount(unresolvedOverpaymentAmount)}
                          </p>
                        </div>
                      </div>
                    </CmxCardContent>
                  </CmxCard>
                  </div>

                  {unresolvedOverpaymentAmount > moneyEpsilon ? (
                    <div ref={extraReceiptCardRef} tabIndex={-1} className="outline-none">
                      <ExtraReceiptHandlingCard
                        excessAmount={unresolvedOverpaymentAmount}
                        currencyCode={currencyCode}
                        formatAmount={formatAmount}
                        hasLinkedCustomer={Boolean(customerId?.trim())}
                        selectedMode={allocation.extraReceiptMode}
                        onModeChange={(mode) => {
                          allocation.setExtraReceiptMode(mode);
                          if (
                            mode !== OVERPAYMENT_RESOLUTIONS.AUTO_ALLOCATE_TO_CUSTOMER_BALANCES &&
                            mode !== OVERPAYMENT_RESOLUTIONS.ALLOCATE_TO_CUSTOMER_BALANCES
                          ) {
                            allocation.resetAllocationState();
                          }
                        }}
                        onOpenAutoAllocate={() => void allocation.handleOpenAutoAllocate()}
                        onOpenManualAllocate={() => void allocation.handleOpenManualAllocate()}
                        allocationConfirmed={Boolean(allocation.allocationPreviewId)}
                        isRTL={isRTL}
                      />
                    </div>
                  ) : null}

                  {showDeferredExplanation ? (
                    <CmxCard>
                      <CmxCardContent className="pt-5">
                        <p className="text-lg font-semibold text-slate-900">{t('workspace.noImmediateTitle') || 'No pay-now amount selected'}</p>
                        <p className="mt-2 text-sm text-slate-600">{t('workspace.noImmediateDescription') || 'This order will be submitted entirely as deferred settlement using the selected remaining-balance policy.'}</p>
                      </CmxCardContent>
                    </CmxCard>
                  ) : (
                    <>
                      {showAmountEditorSection ? (
                      <CmxCard className="overflow-hidden border-slate-200 bg-white shadow-sm">
                        <CmxCardHeader className="border-b border-slate-100 pb-2">
                          <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <CmxCardTitle className={`text-sm text-slate-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                              {t('sections.sectionB')} · {t('sections.amountEditor')} · {activeLeg ? getOptionDisplayName(activeLegOption, activeLeg.method) : t('workspace.editingAmount')}
                            </CmxCardTitle>
                            {settlementLegEntries.length > 1 && (
                              <CmxButton
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={cycleActiveLeg}
                                className="rounded-xl border-slate-200 text-slate-700"
                              >
                                <ArrowRightLeft className="me-1 h-4 w-4" />
                                {t('splitPayment.switchLeg')}
                              </CmxButton>
                            )}
                          </div>
                        </CmxCardHeader>
                        <CmxCardContent className="grid gap-4 pt-4 xl:grid-cols-[minmax(260px,0.9fr)_minmax(360px,1.1fr)]">
                          <div className="space-y-3">
                            <div className="flex items-stretch rounded-2xl border border-slate-200 bg-white shadow-inner">
                              <div className="flex min-w-[88px] items-center justify-center rounded-s-2xl border-e border-slate-200 bg-slate-100 px-4 text-lg font-semibold text-cyan-700">
                                {currencyCode}
                              </div>
                              <div className="min-w-0 flex-1 px-3">
                                <CmxMoneyField
                                  ref={amountInputRef}
                                  draftValue={activeAmountDraft}
                                  value={
                                    activeLeg?.method === PAYMENT_METHODS.CASH
                                      ? activeLeg.cashTendered ?? activeLeg.amount ?? null
                                      : activeLeg?.amount ?? null
                                  }
                                  decimalPlaces={decimalPlaces}
                                  showZero
                                  aria-label={t('workspace.editingAmount') || 'Editing amount'}
                                  onValueChange={(value, draft) => {
                                    if (!activeLeg) return;
                                    setActiveAmountDraft(draft);
                                    const option = getMethodOption(activeLeg.method, activeLeg.gateway_code);
                                    const policy = resolvePaymentOverpaymentPolicy({
                                      paymentMethodCode: activeLeg.method,
                                      supportsChangeReturn: option?.supports_change_return,
                                      supportsOverpayment: option?.supports_overpayment,
                                      requiresCashDrawer: option?.requires_cash_drawer,
                                    });
                                    const cappedAmount = deriveLegAppliedAmount({
                                      rawAmount: value,
                                      paymentLegs,
                                      legIndex: activeLegIndex,
                                      saleTotal,
                                      giftCardAmount: giftCardSettlementAmount,
                                      decimalPlaces,
                                      walletBalance: activeLeg ? getLegStoredValueCap(activeLeg) : undefined,
                                      supportsOverpayment: !policy.isCash && policy.supportsOverpayment,
                                    });
                                    notifyIfLegAmountCapped(activeLeg, value, cappedAmount);
                                    updateLeg(activeLegIndex, 'amount', value);
                                  }}
                                  placeholder={formatAmount(0)}
                                  disabled={!activeLeg}
                                  className="h-16 border-0 bg-transparent px-0 text-[2.2rem] font-bold tracking-tight text-slate-900 shadow-none focus-visible:ring-0"
                                />
                              </div>
                            </div>
                            {activeLeg?.method === 'WALLET' && (
                              <div className={`rounded-xl border px-3 py-2 text-xs ${
                                walletLegExceedsLiveBalance
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : 'border-cyan-200 bg-cyan-50 text-cyan-800'
                              }`}>
                                {walletLegExceedsLiveBalance
                                  ? t('customerCredits.walletBalanceExceeded', {
                                      amount: liveWalletBalanceDisplay,
                                    })
                                  : t('customerCredits.available', {
                                      amount: liveWalletBalanceDisplay,
                                    })}
                              </div>
                            )}
                            {activeLeg?.method === PAYMENT_METHODS.CASH ? (
                              <div className="grid gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 sm:grid-cols-3">
                                <span>
                                  {t('rightRail.appliedAmount')}: {currencyCode} {formatAmount(activeLeg.amount ?? 0)}
                                </span>
                                <span>
                                  {t('rightRail.cashTendered')}: {currencyCode} {formatAmount(activeLeg.cashTendered ?? activeLeg.amount ?? 0)}
                                </span>
                                <span>
                                  {t('rightRail.changeReturned')}: {currencyCode} {formatAmount(deriveChangeReturnedAmount(
                                    activeLeg.cashTendered ?? activeLeg.amount ?? 0,
                                    activeLeg.amount ?? 0,
                                    activeLegOption?.supports_change_return === true,
                                    moneyEpsilon
                                  ))}
                                </span>
                              </div>
                            ) : null}
                            {cashOverRemainingNotice ? (
                              <CmxSummaryMessage
                                type="info"
                                title={t('splitPayment.validation.cashOverRemainingTitle')}
                                items={[cashOverRemainingNotice]}
                              />
                            ) : null}
                            <p className="rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
                              {t('workspace.keypadHint') || 'Use the keypad for fast touch entry, or type directly into the amount field.'}
                            </p>
                            {activeLeg ? (
                              <div className={`flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <p className="text-xs text-slate-600">
                                  {t('workspace.remainingForLeg', {
                                    amount: `${currencyCode} ${formatAmount(activeLegRemainingCap)}`,
                                  })}
                                </p>
                                <CmxButton
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  disabled={activeLegRemainingCap <= moneyEpsilon}
                                  onClick={() => fillLegRemaining(activeLegIndex)}
                                  className="shrink-0 rounded-lg border-cyan-200 text-cyan-700"
                                >
                                  {t('splitPayment.fillRemaining')}
                                </CmxButton>
                              </div>
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <CmxKeypad
                              keys={KEYPAD_PAYMENT_4COL}
                              disabled={!activeLeg}
                              onKeyPress={handleKeypadPress}
                              onKeyLongPress={(key) => {
                                if (key === 'backspace') handleKeypadPress('clear');
                              }}
                              getKeyVariant={PAYMENT_KEY_VARIANT}
                              getKeyClassName={PAYMENT_KEY_CLASS}
                              getKeyAriaLabel={(key) => {
                                if (key === 'backspace') return t('workspace.backspace') || 'Backspace';
                                if (key === 'clear') return tCommon('clear');
                                return undefined;
                              }}
                              renderKeyLabel={(key) => {
                                if (key === 'backspace') return '⌫';
                                if (key === 'clear') return tCommon('clear');
                                return key;
                              }}
                            />
                          </div>
                        </CmxCardContent>
                      </CmxCard>
                      ) : null}

                      <div ref={paymentWorkspaceSectionRef} tabIndex={-1} className="outline-none">
                      <CmxCard className="min-h-[360px] overflow-hidden border-cyan-100 bg-gradient-to-br from-white via-slate-50 to-cyan-50/50 shadow-sm">
                        <CmxCardHeader className="border-b border-cyan-100 pb-3">
                          <div className={`flex items-start justify-between gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                            <div>
                              <CmxCardTitle className={`flex items-center gap-2 text-base text-slate-900 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <Maximize2 className="h-4 w-4 text-cyan-700" />
                                {t('sections.sectionC')} · {t('workspace.activeTitle')}
                              </CmxCardTitle>
                              <p className="mt-1 text-sm text-slate-600">{t('workspace.activeDescription')}</p>
                            </div>
                            {activeLeg ? (
                              <Badge variant="secondary" className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-700">
                                {getOptionDisplayName(activeLegOption, activeLeg.method)}
                              </Badge>
                            ) : null}
                          </div>
                        </CmxCardHeader>
                        <CmxCardContent className="space-y-4 pt-4">
                          {requiredActionCopy ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                              <div className={`flex items-start justify-between gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                                <div className="min-w-0">
                                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                    <CircleAlert className="h-4 w-4 shrink-0" />
                                    {requiredActionCopy.title}
                                  </p>
                                  <p className="mt-1 text-sm text-amber-800">{requiredActionCopy.message}</p>
                                </div>
                                <CmxButton
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={handleBlockedSubmitAttempt}
                                  className="shrink-0 rounded-xl border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                                >
                                  {t('workspace.fixAction')}
                                </CmxButton>
                              </div>
                            </div>
                          ) : null}

                          {activeLeg ? (
                            <>
                              <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('workspace.selectedLeg')}</p>
                                  <div className={`mt-2 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${getMethodToneClasses(activeLeg.method).iconWrap}`}>
                                      {getPaymentIcon(activeLeg.method)}
                                    </span>
                                    <p className="text-sm font-semibold text-slate-900">{getOptionDisplayName(activeLegOption, activeLeg.method)}</p>
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('workspace.amountBeingEdited')}</p>
                                  <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                                    {currencyCode} {formatAmount(activeLeg.amount || 0)}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('workspace.afterThisPayment')}</p>
                                  <p className={`mt-2 text-2xl font-bold tabular-nums ${remainingBalance > moneyEpsilon ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {currencyCode} {formatAmount(remainingBalance)}
                                  </p>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className={`mb-3 text-sm font-semibold text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                                  {t('workspace.detailsTitle')}
                                </p>

                                <div className="space-y-4">
                                  {creditMethodCodes.includes(activeLeg.method) && (
                                    <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-3 py-3 text-sm text-cyan-900">
                                      {activeLeg.method === 'CREDIT_NOTE' ? (
                                        <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                          <span>
                                            {activeLeg.creditReferenceId
                                              ? t('customerCredits.creditNoteSelected', {
                                                  id: activeLeg.creditReferenceId.slice(0, 8),
                                                })
                                              : t('customerCredits.creditNoteRequired')}
                                          </span>
                                          <CmxButton
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setPendingCreditNoteOption(
                                                customerCreditOptions.find(
                                                  (option) => option.payment_method_code === 'CREDIT_NOTE'
                                                ) ?? null
                                              );
                                              setCreditNotePickerOpen(true);
                                            }}
                                          >
                                            {t('customerCredits.creditNoteChange')}
                                          </CmxButton>
                                        </div>
                                      ) : (
                                        t('customerCredits.applied')
                                      )}
                                    </div>
                                  )}
                                  {activeLegOption?.requires_terminal && (
                                    <div>
                                      <label className="mb-1 block text-xs font-medium text-slate-600">
                                        {`${t('splitPayment.paymentTerminal')} *`}
                                      </label>
                                      <CmxSelectDropdown
                                        value={activeLeg.terminalId ?? ''}
                                        onValueChange={(value) =>
                                          updateLeg(activeLegIndex, 'terminalId', value || undefined)
                                        }
                                      >
                                        <CmxSelectDropdownTrigger>
                                          <CmxSelectDropdownValue
                                            displayValue={
                                              activeLeg.terminalId
                                                ? branchPaymentTerminals.find(
                                                    (terminal) => terminal.id === activeLeg.terminalId
                                                  )?.terminal_name ?? activeLeg.terminalId
                                                : ''
                                            }
                                            placeholder={t('splitPayment.paymentTerminalPlaceholder')}
                                          />
                                        </CmxSelectDropdownTrigger>
                                        <CmxSelectDropdownContent>
                                          <CmxSelectDropdownItem value="">
                                            {t('splitPayment.paymentTerminalPlaceholder')}
                                          </CmxSelectDropdownItem>
                                          {branchPaymentTerminals.map((terminal) => (
                                            <CmxSelectDropdownItem key={terminal.id} value={terminal.id}>
                                              {isRTL
                                                ? terminal.terminal_name2 || terminal.terminal_name
                                                : terminal.terminal_name}
                                            </CmxSelectDropdownItem>
                                          ))}
                                        </CmxSelectDropdownContent>
                                      </CmxSelectDropdown>
                                      {!activeLeg.terminalId?.trim() ? (
                                        <p className="mt-1 text-xs text-red-600">
                                          {t('splitPayment.validation.terminalRequiredField')}
                                        </p>
                                      ) : null}
                                    </div>
                                  )}
                                  {activeLeg.method === PAYMENT_METHODS.CARD && (
                                    <div className="grid gap-3 md:grid-cols-3">
                                      <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-600">{t('splitPayment.cardBrand')}</label>
                                        <CmxSelectDropdown
                                          value={activeLeg.card_brand_code ?? ''}
                                          onValueChange={(value) => updateLeg(activeLegIndex, 'card_brand_code', value || undefined)}
                                        >
                                          <CmxSelectDropdownTrigger>
                                            <CmxSelectDropdownValue
                                              displayValue={
                                                activeLeg.card_brand_code
                                                  ? cardBrands.find((brand) => brand.card_brand_code === activeLeg.card_brand_code)?.name ?? activeLeg.card_brand_code
                                                  : ''
                                              }
                                              placeholder={t('splitPayment.cardBrandPlaceholder')}
                                            />
                                          </CmxSelectDropdownTrigger>
                                          <CmxSelectDropdownContent>
                                            <CmxSelectDropdownItem value="">{t('splitPayment.cardBrandPlaceholder')}</CmxSelectDropdownItem>
                                            {cardBrands.map((brand) => (
                                              <CmxSelectDropdownItem key={brand.card_brand_code} value={brand.card_brand_code}>
                                                {isRTL ? (brand.name2 || brand.name) : brand.name}
                                              </CmxSelectDropdownItem>
                                            ))}
                                          </CmxSelectDropdownContent>
                                        </CmxSelectDropdown>
                                      </div>
                                      <CmxInput
                                        label={t('splitPayment.cardLast4')}
                                        value={activeLeg.card_last4 ?? ''}
                                        dir="ltr"
                                        maxLength={4}
                                        inputMode="numeric"
                                        placeholder="0000"
                                        onChange={(event) => updateLeg(activeLegIndex, 'card_last4', event.target.value.replace(/\D/g, '').slice(0, 4) || undefined)}
                                      />
                                      <CmxInput
                                        label={
                                          activeLegOption?.requires_reference
                                            ? `${t('splitPayment.authCode')} *`
                                            : t('splitPayment.authCode')
                                        }
                                        value={activeLeg.auth_code ?? ''}
                                        dir="ltr"
                                        placeholder="—"
                                        error={
                                          activeLegOption?.requires_reference &&
                                          !legHasRequiredPaymentReference(activeLeg, true)
                                            ? t('splitPayment.validation.referenceRequiredField')
                                            : undefined
                                        }
                                        onChange={(event) => updateLeg(activeLegIndex, 'auth_code', event.target.value || undefined)}
                                      />
                                    </div>
                                  )}

                                  {activeLeg.method === PAYMENT_METHODS.CHECK && (
                                    <div className="grid gap-3 md:grid-cols-3">
                                      <CmxInput
                                        ref={checkNumberInputRef}
                                        label={`${t('splitPayment.checkNumber')} *`}
                                        value={activeLeg.checkNumber ?? ''}
                                        dir="ltr"
                                        error={errors.checkNumber?.message}
                                        placeholder={t('checkNumber.placeholder')}
                                        onChange={(event) => {
                                          const nextValue = event.target.value || undefined;
                                          updateLeg(activeLegIndex, 'checkNumber', nextValue);
                                          setValue('checkNumber', nextValue ?? '', { shouldValidate: true, shouldDirty: true });
                                        }}
                                      />
                                      <CmxInput
                                        label={t('splitPayment.checkBankName')}
                                        value={activeLeg.checkBank ?? ''}
                                        dir="ltr"
                                        placeholder="—"
                                        onChange={(event) => {
                                          const nextValue = event.target.value || undefined;
                                          updateLeg(activeLegIndex, 'checkBank', nextValue);
                                          setValue('checkBank', nextValue ?? '', { shouldValidate: false, shouldDirty: true });
                                        }}
                                      />
                                      <CmxInput
                                        ref={checkDateInputRef}
                                        type="date"
                                        label={t('splitPayment.checkDueDate')}
                                        value={activeLeg.checkDate ?? ''}
                                        // BVM Phase 6 Sub-item 4: floor the picker
                                        // at today's local date so the operator
                                        // cannot accidentally tender a back-dated
                                        // check. validateCheckDueDate also catches
                                        // pasted/typed values that bypass the picker.
                                        min={todayYyyyMmDd()}
                                        error={
                                          validateCheckDueDate(activeLeg.checkDate)
                                            ? t(`splitPayment.${validateCheckDueDate(activeLeg.checkDate)!}`)
                                            : undefined
                                        }
                                        onChange={(event) => {
                                          const nextValue = event.target.value || undefined;
                                          updateLeg(activeLegIndex, 'checkDate', nextValue);
                                          setValue('checkDate', nextValue ?? '', { shouldValidate: false, shouldDirty: true });
                                        }}
                                      />
                                    </div>
                                  )}

                                  {activeLeg.method === PAYMENT_METHODS.BANK_TRANSFER && (
                                    <CmxInput
                                      label={
                                        activeLegOption?.requires_reference
                                          ? `${t('splitPayment.bankReference')} *`
                                          : t('splitPayment.bankReference')
                                      }
                                      value={activeLeg.bank_reference ?? ''}
                                      dir="ltr"
                                      placeholder="—"
                                      error={
                                        activeLegOption?.requires_reference &&
                                        !legHasRequiredPaymentReference(activeLeg, true)
                                          ? t('splitPayment.validation.referenceRequiredField')
                                          : undefined
                                      }
                                      onChange={(event) => updateLeg(activeLegIndex, 'bank_reference', event.target.value || undefined)}
                                    />
                                  )}

                                  {GATEWAY_METHOD_CODES.includes(activeLeg.method) && (
                                    <div className="grid gap-3 md:grid-cols-3">
                                      <CmxInput
                                        label={t('splitPayment.gatewayCode')}
                                        value={activeLeg.gateway_code ?? ''}
                                        dir="ltr"
                                        placeholder="—"
                                        onChange={(event) => updateLeg(activeLegIndex, 'gateway_code', event.target.value || undefined)}
                                      />
                                      <CmxInput
                                        label={
                                          activeLegOption?.requires_reference
                                            ? `${t('splitPayment.gatewayTransactionId')} *`
                                            : t('splitPayment.gatewayTransactionId')
                                        }
                                        value={activeLeg.gateway_transaction_id ?? ''}
                                        dir="ltr"
                                        placeholder="—"
                                        error={
                                          activeLegOption?.requires_reference &&
                                          !legHasRequiredPaymentReference(activeLeg, true)
                                            ? t('splitPayment.validation.referenceRequiredField')
                                            : undefined
                                        }
                                        onChange={(event) => updateLeg(activeLegIndex, 'gateway_transaction_id', event.target.value || undefined)}
                                      />
                                      <CmxInput
                                        label={
                                          activeLegOption?.requires_reference
                                            ? `${t('splitPayment.gatewayReference')} *`
                                            : t('splitPayment.gatewayReference')
                                        }
                                        value={activeLeg.gateway_reference ?? ''}
                                        dir="ltr"
                                        placeholder="—"
                                        error={
                                          activeLegOption?.requires_reference &&
                                          !legHasRequiredPaymentReference(activeLeg, true)
                                            ? t('splitPayment.validation.referenceRequiredField')
                                            : undefined
                                      }
                                        onChange={(event) => updateLeg(activeLegIndex, 'gateway_reference', event.target.value || undefined)}
                                      />
                                    </div>
                                  )}
                                  {activeLeg.method === PAYMENT_METHODS.CARD && (
                                    <div className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                      <ShieldCheck className="h-4 w-4 text-cyan-700" />
                                      {t('security.cardPayment')}
                                    </div>
                                  )}
                                  {!creditMethodCodes.includes(activeLeg.method) &&
                                  activeLeg.method !== PAYMENT_METHODS.CARD &&
                                  activeLeg.method !== PAYMENT_METHODS.CHECK &&
                                  activeLeg.method !== PAYMENT_METHODS.BANK_TRANSFER &&
                                  !GATEWAY_METHOD_CODES.includes(activeLeg.method) ? (
                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                                      {t('workspace.noDetailsDescription')}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="grid min-h-[240px] place-items-center rounded-3xl border border-dashed border-cyan-200 bg-white/70 p-6 text-center">
                              <div className="max-w-md">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                                  <CreditCard className="h-6 w-6" />
                                </div>
                                <p className="mt-4 text-lg font-semibold text-slate-900">{t('workspace.helperTitle')}</p>
                                <p className="mt-2 text-sm text-slate-600">{t('workspace.helperDescription')}</p>
                                <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                                  <span className="rounded-full bg-slate-100 px-3 py-2">{t('workspace.helperMethod')}</span>
                                  <span className="rounded-full bg-slate-100 px-3 py-2">{t('workspace.helperAmount')}</span>
                                  <span className="rounded-full bg-slate-100 px-3 py-2">{t('workspace.helperCredits')}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </CmxCardContent>
                      </CmxCard>
                      </div>
                    </>
                  )}

                  {showDiscountsCreditsSection ? (
                    <div ref={couponCardRef} tabIndex={-1} className="outline-none">
                      <CmxCard className="overflow-hidden border-purple-100 bg-white/95 shadow-sm">
                        <CmxCardHeader className={`flex-row items-start justify-between gap-3 border-b border-purple-100 pb-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                          <div>
                            <CmxCardTitle className="text-base text-slate-900">
                              {t('sections.sectionE')} · {t('rightRail.adjustments')}
                            </CmxCardTitle>
                            <p className="mt-1 text-sm text-slate-600">
                              {t('sections.discountsCreditsHelp')}
                            </p>
                          </div>
                          {appliedBadgeCount > 0 ? (
                            <Badge variant="secondary" className="rounded-full bg-purple-100 px-3 py-1 text-purple-700">
                              {appliedBadgeCount}
                            </Badge>
                          ) : null}
                        </CmxCardHeader>
                        <CmxCardContent className="space-y-5 pt-5">
                          <div className={`grid gap-4 ${showGiftCardWorkspace ? '' : 'xl:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]'}`}>
                            <div className="space-y-4">
                              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                <div>
                                  <p className={`text-sm font-semibold text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                                    {t('rightRail.discounts')}
                                  </p>
                                  <p className={`mt-1 text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                                    {t('rightRail.discountsHelp')}
                                  </p>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <Controller
                                    name="amountDiscount"
                                    control={control}
                                    render={({ field }) => (
                                      <CmxInput
                                        ref={amountDiscountInputRef}
                                        label={t('manualDiscount.amount')}
                                        value={amountDiscountFocused ? amountDiscountDraft : formatDecimalDraft(field.value ?? 0, decimalPlaces)}
                                        dir="ltr"
                                        placeholder={t('manualDiscount.amountPlaceholder')}
                                        onFocus={() => {
                                          setAmountDiscountFocused(true);
                                          setAmountDiscountDraft(formatDecimalDraft(field.value ?? 0, decimalPlaces));
                                        }}
                                        onBlur={() => {
                                          setAmountDiscountFocused(false);
                                          const raw = sanitizeAmountDiscountDraft(amountDiscountDraft.trim());
                                          const nextAmount = Math.max(0, Math.min(parseDecimalDraft(raw), total));
                                          field.onChange(nextAmount);
                                          setValue('percentDiscount', syncDiscountPercentFromAmount(total, nextAmount));
                                          setAmountDiscountDraft('');
                                        }}
                                        onChange={(event) => {
                                          const nextDraft = sanitizeAmountDiscountDraft(event.target.value);
                                          setAmountDiscountDraft(nextDraft);
                                          const nextAmount = Math.max(0, Math.min(parseDecimalDraft(nextDraft), total));
                                          field.onChange(nextAmount);
                                          setValue('percentDiscount', syncDiscountPercentFromAmount(total, nextAmount));
                                        }}
                                      />
                                    )}
                                  />
                                  <Controller
                                    name="percentDiscount"
                                    control={control}
                                    render={({ field }) => (
                                      <CmxInput
                                        ref={percentDiscountInputRef}
                                        label={t('manualDiscount.percent')}
                                        value={field.value ? String(field.value) : ''}
                                        dir="ltr"
                                        placeholder={t('manualDiscount.percentPlaceholder')}
                                        onChange={(event) => {
                                          const nextPercent = Math.max(0, Math.min(100, Number.parseFloat(event.target.value) || 0));
                                          field.onChange(nextPercent);
                                          setValue('amountDiscount', syncDiscountFromPercent(total, nextPercent, decimalPlaces));
                                        }}
                                      />
                                    )}
                                  />
                                </div>
                                {(errors.percentDiscount || errors.amountDiscount) ? (
                                  <p className={`text-xs text-red-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                                    {errors.percentDiscount?.message || errors.amountDiscount?.message}
                                  </p>
                                ) : null}
                              </div>

                              {!NEW_ORDER_PROMO_GIFT_DISABLED ? (
                                <div className="space-y-4 rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
                                  <div>
                                    <p className={`text-sm font-semibold text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                                      {t('rightRail.creditsAndStoredValue')}
                                    </p>
                                    <p className={`mt-1 text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                                      {t('rightRail.creditsAndStoredValueHelp')}
                                    </p>
                                  </div>

                                  {!appliedPromoCode ? (
                                    <div className="space-y-2">
                                      <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                        <Controller
                                          name="promoCode"
                                          control={control}
                                          render={({ field }) => (
                                            <CmxInput
                                              {...field}
                                              value={field.value || ''}
                                              onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                                              placeholder={t('promoCode.placeholder')}
                                              disabled={promoCodeValidating}
                                            />
                                          )}
                                        />
                                        <CmxButton
                                          type="button"
                                          size="sm"
                                          onClick={handleValidatePromoCode}
                                          disabled={!promoCode?.trim() || promoCodeValidating}
                                        >
                                          {promoCodeValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('promoCode.apply')}
                                        </CmxButton>
                                      </div>
                                      {promoCodeResult && !promoCodeResult.isValid ? (
                                        <p className={`text-xs text-red-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                                          {promoCodeResult.error}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                                      <span className="text-sm font-medium text-green-900">
                                        {appliedPromoCode.code} -{currencyCode} {formatAmount(appliedPromoCode.discount)}
                                      </span>
                                      <CmxButton type="button" variant="ghost" size="sm" onClick={handleClearPromoCode}>
                                        {t('promoCode.remove')}
                                      </CmxButton>
                                    </div>
                                  )}

                                  {!appliedGiftCard ? (
                                    <div ref={giftCardDetailsRef} className="space-y-3 rounded-xl border border-purple-200 bg-white p-3">
                                      <div className={`grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] ${isRTL ? 'sm:[direction:rtl]' : ''}`}>
                                        <Controller
                                          name="giftCardNumber"
                                          control={control}
                                          render={({ field }) => (
                                            <CmxInput
                                              {...field}
                                              value={field.value || ''}
                                              onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                                              placeholder={t('giftCard.placeholder')}
                                              disabled={giftCardValidating}
                                              className="min-w-0"
                                              onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                  event.preventDefault();
                                                  event.stopPropagation();
                                                  void handleFetchGiftCardDetails();
                                                }
                                              }}
                                            />
                                          )}
                                        />
                                        <CmxButton
                                          type="button"
                                          size="sm"
                                          variant="secondary"
                                          onClick={handleFetchGiftCardDetails}
                                          disabled={!giftCardNumber?.trim() || giftCardValidating || (pinRequired && !giftCardPin.trim())}
                                          className="shrink-0"
                                        >
                                          {giftCardValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('giftCard.fetch')}
                                        </CmxButton>
                                      </div>
                                      {giftCardResult && !giftCardResult.isValid ? (
                                        <p className={`text-xs text-red-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                                          {resolveGiftCardError(giftCardResult)}
                                        </p>
                                      ) : null}
                                      {showGiftCardWorkspace ? (
                                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,320px)]">
                                          <div className="rounded-xl border border-purple-100 bg-purple-50 px-3 py-2">
                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-purple-500">
                                              {t('giftCard.cardCode')}
                                            </p>
                                            <p className="mt-1 break-all text-sm font-semibold text-slate-900" dir="ltr">
                                              {giftCardDetails?.number || giftCardNumber}
                                            </p>
                                            {giftCardDetails ? (
                                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                <SummaryRow
                                                  label={t('giftCard.balance')}
                                                  value={`${currencyCode} ${formatAmount(giftCardDetails.balance)}`}
                                                />
                                                <SummaryRow
                                                  label={t('rightRail.remainingBalance')}
                                                  value={`${currencyCode} ${formatAmount(remainingBalance)}`}
                                                  negative={remainingBalance > moneyEpsilon}
                                                />
                                              </div>
                                            ) : (
                                              <p className="mt-2 text-xs text-amber-700">{t('giftCard.pinPendingError')}</p>
                                            )}
                                          </div>
                                          <div className="space-y-3">
                                            {pinRequired ? (
                                              <div className={`grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto] ${isRTL ? 'sm:[direction:rtl]' : ''}`}>
                                                <CmxInput
                                                  ref={pinInputRef}
                                                  label={t('giftCard.pinLabel')}
                                                  value={giftCardPin}
                                                  type={pinVisible ? 'text' : 'password'}
                                                  dir="ltr"
                                                  error={pinFieldError ?? undefined}
                                                  className={`min-w-0 ${pinRequired && !giftCardPin.trim() ? 'ring-1 ring-red-400' : ''}`}
                                                  onChange={(event) => {
                                                    setGiftCardPin(event.target.value);
                                                    setPinFieldError(null);
                                                  }}
                                                  onKeyDown={(event) => {
                                                    if (event.key === 'Enter') {
                                                      event.preventDefault();
                                                      event.stopPropagation();
                                                      void handleFetchGiftCardDetails();
                                                    }
                                                  }}
                                                />
                                                <CmxButton
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  className="h-9 shrink-0"
                                                  onClick={() => setPinVisible((value) => !value)}
                                                  aria-label={pinVisible ? (t('giftCard.hidePin') || 'Hide PIN') : (t('giftCard.showPin') || 'Show PIN')}
                                                >
                                                  {pinVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </CmxButton>
                                              </div>
                                            ) : null}
                                            {giftCardDetails ? (
                                              <>
                                                <Controller
                                                  name="giftCardAmount"
                                                  control={control}
                                                  render={({ field }) => (
                                                    <CmxInput
                                                      {...field}
                                                      ref={(node) => {
                                                        field.ref(node);
                                                        giftCardAmountInputRef.current = node;
                                                      }}
                                                      type="number"
                                                      label={t('giftCard.applyAmount')}
                                                      value={field.value ?? ''}
                                                      dir="ltr"
                                                      min="0"
                                                      step="0.001"
                                                      inputMode="decimal"
                                                      placeholder={t('giftCard.amountPlaceholder')}
                                                      onChange={(event) => field.onChange(Number.parseFloat(event.target.value) || 0)}
                                                      onKeyDown={(event) => {
                                                        if (event.key === 'Enter') {
                                                          event.preventDefault();
                                                          event.stopPropagation();
                                                          handleApplyGiftCard();
                                                        }
                                                      }}
                                                    />
                                                  )}
                                                />
                                                <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                                  <CmxButton
                                                    type="button"
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={handleApplyGiftCard}
                                                    disabled={!giftCardAmount || giftCardAmount <= 0}
                                                    className="flex-1"
                                                  >
                                                    {t('giftCard.applyAmount')}
                                                  </CmxButton>
                                                  <CmxButton
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleClearGiftCard}
                                                    className="flex-1"
                                                  >
                                                    {tCommon('cancel')}
                                                  </CmxButton>
                                                </div>
                                              </>
                                            ) : null}
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2">
                                      <span className="text-sm font-medium text-purple-900">
                                        {appliedGiftCard.number} -{currencyCode} {formatAmount(appliedGiftCard.amount)}
                                      </span>
                                      <CmxButton type="button" variant="ghost" size="sm" onClick={handleClearGiftCard}>
                                        {t('giftCard.remove')}
                                      </CmxButton>
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>

                            {PAYMENT_MODAL_V04_SHOW_LIVE_EFFECT ? (
                              <div className="space-y-3 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
                                <p className={`text-sm font-semibold text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                                  {t('rightRail.liveEffect')}
                                </p>
                                <SummaryRow
                                  label={t('rightRail.orderTotalAfterDiscounts')}
                                  value={`${currencyCode} ${formatAmount(saleTotal)}`}
                                />
                                <SummaryRow
                                  label={t('rightRail.creditsApplied')}
                                  value={`${currencyCode} ${formatAmount(customerCreditAmount + (appliedGiftCard?.amount || 0))}`}
                                />
                                <SummaryRow
                                  label={t('rightRail.remainingBalance')}
                                  value={`${currencyCode} ${formatAmount(remainingBalance)}`}
                                  negative={remainingBalance > moneyEpsilon}
                                />
                              </div>
                            ) : null}
                          </div>
                        </CmxCardContent>
                      </CmxCard>
                    </div>
                  ) : null}

                  {showCashDrawerWorkbenchSection ? (
                    <div
                      ref={(node) => {
                        cashDrawerCardRef.current = node;
                        cashDrawerSelectorCardRef.current = node;
                      }}
                      tabIndex={-1}
                      className="outline-none"
                    >
                      <CmxCard className="overflow-hidden border-cyan-200 bg-white/95 shadow-sm">
                        <CmxCardHeader className={`flex-row items-start justify-between gap-3 border-b border-cyan-100 pb-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                          <div>
                            <CmxCardTitle className={`flex items-center gap-2 text-base text-slate-900 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <Banknote className="h-4 w-4 text-cyan-700" />
                              {t('sections.sectionF')} · {t('sections.cashDrawer')}
                            </CmxCardTitle>
                            <p className="mt-1 text-sm text-slate-600">{t('cashDrawer.subtitle')}</p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`rounded-full px-3 py-1 ${
                              selectedCashDrawerChoice
                                ? 'bg-cyan-100 text-cyan-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {selectedCashDrawerChoice ? t('cashDrawer.boundBadge') : t('cashDrawer.pendingBadge')}
                          </Badge>
                        </CmxCardHeader>
                        <CmxCardContent className="space-y-4 pt-5">
                          {cashDrawersLoading ? (
                            <div className="grid gap-3 md:grid-cols-2">
                              <CmxSkeleton className="h-20 w-full" />
                              <CmxSkeleton className="h-20 w-full" />
                            </div>
                          ) : (
                            <>
                              {cashDrawerRequestError ? (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                  {cashDrawerRequestError}
                                </div>
                              ) : null}

                              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                  {cashDrawerSessionChoices.length > 1 ? (
                                    <div className="space-y-2">
                                      <label className={`block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                                        {t('cashDrawer.selectLabel')}
                                      </label>
                                      <CmxSelectDropdown
                                        value={selectedCashDrawerSessionId}
                                        onValueChange={(value) => {
                                          setSelectedCashDrawerSessionId(value);
                                          const selectedChoice = cashDrawerSessionChoices.find(
                                            ({ session }) => session.id === value
                                          );
                                          persistPreferredCashDrawerId(selectedChoice?.drawer.id);
                                          setCashDrawerRequestError(null);
                                        }}
                                        emptyLabel={t('cashDrawer.selectPlaceholder')}
                                      >
                                        <CmxSelectDropdownTrigger dir={isRTL ? 'rtl' : 'ltr'}>
                                          <CmxSelectDropdownValue
                                            displayValue={
                                              selectedCashDrawerChoice
                                                ? `${getDrawerDisplayName(selectedCashDrawerChoice.drawer)} • ${selectedCashDrawerChoice.session.session_no}`
                                                : t('cashDrawer.selectPlaceholder')
                                            }
                                            placeholder={t('cashDrawer.selectPlaceholder')}
                                          />
                                        </CmxSelectDropdownTrigger>
                                        <CmxSelectDropdownContent>
                                          {cashDrawerSessionChoices.map(({ drawer, session }) => (
                                            <CmxSelectDropdownItem key={session.id} value={session.id}>
                                              {`${getDrawerDisplayName(drawer)} • ${session.session_no}`}
                                            </CmxSelectDropdownItem>
                                          ))}
                                        </CmxSelectDropdownContent>
                                      </CmxSelectDropdown>
                                    </div>
                                  ) : null}

                                  {selectedCashDrawerChoice ? (
                                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-3">
                                      <div className={`flex items-center justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                        <div className={isRTL ? 'text-right' : 'text-left'}>
                                          <p className="text-sm font-semibold text-slate-900">
                                            {getDrawerDisplayName(selectedCashDrawerChoice.drawer)}
                                          </p>
                                          <p className="text-xs text-slate-500">
                                            {selectedCashDrawerChoice.session.session_no}
                                          </p>
                                        </div>
                                        <Banknote className="h-4 w-4 text-cyan-700" />
                                      </div>
                                      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                                        <div>
                                          <p className="font-medium text-slate-500">{t('cashDrawer.openedAt')}</p>
                                          <p>{formatCashDrawerOpenedAt(selectedCashDrawerChoice.session.opened_at)}</p>
                                        </div>
                                        <div>
                                          <p className="font-medium text-slate-500">{t('cashDrawer.openingBalance')}</p>
                                          <p>{`${selectedCashDrawerChoice.drawer.currency_code} ${formatAmount(selectedCashDrawerChoice.session.opening_float_amount)}`}</p>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className={`rounded-2xl border px-3 py-3 text-xs ${
                                      cashDrawerSessionChoices.length === 0
                                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                                        : 'border-slate-200 bg-slate-50 text-slate-600'
                                    }`}>
                                      {cashDrawerSessionChoices.length === 0
                                        ? t('cashDrawer.messages.noOpenSession')
                                        : t('cashDrawer.messages.sessionRequired')}
                                    </div>
                                  )}

                                  <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                    <CmxButton
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => void refetchCashDrawers()}
                                      disabled={cashDrawersFetching}
                                      className="rounded-xl"
                                    >
                                      {cashDrawersFetching ? (
                                        <Loader2 className="me-1 h-4 w-4 animate-spin" />
                                      ) : (
                                        <RefreshCw className="me-1 h-4 w-4" />
                                      )}
                                      {t('cashDrawer.refresh')}
                                    </CmxButton>
                                    <CmxButton
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={handleOpenCashDrawerDialog}
                                      disabled={!canOpenNewCashDrawerSession}
                                      className="rounded-xl"
                                    >
                                      <Plus className="me-1 h-4 w-4" />
                                      {t('cashDrawer.openSession')}
                                    </CmxButton>
                                  </div>
                                </div>

                                <div className="space-y-3 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
                                  <p className={`text-sm font-semibold text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                                    {t('rightRail.cashDrawerImpact')}
                                  </p>
                                  <SummaryRow
                                    label={t('rightRail.cashRetained')}
                                    value={`${currencyCode} ${formatAmount(netCashRetainedAmount)}`}
                                  />
                                  <SummaryRow
                                    label={t('rightRail.changeReturned')}
                                    value={`${currencyCode} ${formatAmount(displayChangeAmount)}`}
                                    negative={displayChangeAmount > moneyEpsilon}
                                  />
                                </div>
                              </div>
                            </>
                          )}
                        </CmxCardContent>
                      </CmxCard>
                    </div>
                  ) : null}

                  <div ref={financialInspectorSectionRef} tabIndex={-1} className="outline-none">
                    <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                      <CmxCardHeader className={`flex-row items-start justify-between gap-3 border-b border-slate-100 pb-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                        <div>
                          <CmxCardTitle className="text-base text-slate-900">
                            {t('sections.sectionG')} · {t('sections.financialInspector')}
                          </CmxCardTitle>
                          <p className="mt-1 text-sm text-slate-600">{t('sections.financialInspectorHelp')}</p>
                        </div>
                        <Badge variant="secondary" className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                          {inspectorTabIds.length}
                        </Badge>
                      </CmxCardHeader>
                      <CmxCardContent className="pt-0">
                        <CmxTabsPanel
                          tabs={[
                            {
                              id: PAYMENT_MODAL_INSPECTOR_TAB_IDS.ORDER_VALUE,
                              label: t('rightRail.orderValue'),
                              content: (
                                <OrderValueBreakdownPanel
                                  model={orderValueBreakdownModel}
                                  isRTL={isRTL}
                                  taxLoading={totalsLoading && items.length > 0 && !serverTotals}
                                  labels={{
                                    grossValue: t('orderValue.grossValue'),
                                    grossValueHelp: t('orderValue.grossValueHelp'),
                                    discounts: t('orderValue.discounts'),
                                    discountsHelp: t('orderValue.discountsHelp'),
                                    taxes: t('orderValue.taxes'),
                                    taxesHelp: t('orderValue.taxesHelp'),
                                    finalTotal: t('orderValue.finalTotal'),
                                    finalTotalHelp: t('orderValue.finalTotalHelp'),
                                  }}
                                />
                              ),
                            },
                            ...(inspectorTabIds.includes(PAYMENT_MODAL_INSPECTOR_TAB_IDS.TAX_BREAKDOWN)
                              ? [
                                  {
                                    id: PAYMENT_MODAL_INSPECTOR_TAB_IDS.TAX_BREAKDOWN,
                                    label: t('rightRail.taxBreakdown'),
                                    content: displayTaxBreakdown.length === 0 ? (
                                      <p className={`text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                                        {t('tax.noProfiles')}
                                      </p>
                                    ) : (
                                      <div className="space-y-2">
                                        {displayTaxBreakdown.map((entry, index) => (
                                          <div
                                            key={entry.profileId ?? `${entry.taxType}-${index}`}
                                            className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                                          >
                                            <div className="min-w-0 flex-1">
                                              <p className="truncate text-xs font-medium text-slate-700">
                                                {isRTL ? (entry.label2 || entry.label) : entry.label}
                                              </p>
                                              <p className="text-xs text-slate-400">
                                                {t('tax.rate')}: {entry.rate.toFixed(2)}%
                                              </p>
                                            </div>
                                            <span className="text-sm font-semibold tabular-nums text-slate-900">
                                              {currencyCode} {formatAmount(entry.taxAmount)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ),
                                  },
                                ]
                              : []),
                            ...(inspectorTabIds.includes(PAYMENT_MODAL_INSPECTOR_TAB_IDS.DISCOUNTS)
                              ? [
                                  {
                                    id: PAYMENT_MODAL_INSPECTOR_TAB_IDS.DISCOUNTS,
                                    label: t('rightRail.discounts'),
                                    content: (
                                      <div className="space-y-2">
                                        {(totals.autoRuleDiscount ?? 0) > moneyEpsilon ? (
                                          <SummaryRow
                                            label={t('summary.rulesDiscount')}
                                            value={`-${currencyCode} ${formatAmount(totals.autoRuleDiscount ?? 0)}`}
                                            negative
                                          />
                                        ) : null}
                                        {totals.manualDiscount > moneyEpsilon ? (
                                          <SummaryRow
                                            label={t('summary.manualDiscount')}
                                            value={`-${currencyCode} ${formatAmount(totals.manualDiscount)}`}
                                            negative
                                          />
                                        ) : null}
                                        {totals.promoDiscount > moneyEpsilon ? (
                                          <SummaryRow
                                            label={t('summary.promoDiscount')}
                                            value={`-${currencyCode} ${formatAmount(totals.promoDiscount)}`}
                                            negative
                                          />
                                        ) : null}
                                        {appliedGiftCard ? (
                                          <SummaryRow
                                            label={t('summary.giftCardApplied')}
                                            value={`-${currencyCode} ${formatAmount(appliedGiftCard.amount)}`}
                                            negative
                                          />
                                        ) : null}
                                      </div>
                                    ),
                                  },
                                ]
                              : []),
                            ...(inspectorTabIds.includes(PAYMENT_MODAL_INSPECTOR_TAB_IDS.WARNINGS)
                              ? [
                                  {
                                    id: PAYMENT_MODAL_INSPECTOR_TAB_IDS.WARNINGS,
                                    label: t('rightRail.warnings'),
                                    content: (
                                      <div className="space-y-2">
                                        {warningMessages.map((warning) => (
                                          <div
                                            key={warning}
                                            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                                          >
                                            {warning}
                                          </div>
                                        ))}
                                      </div>
                                    ),
                                  },
                                ]
                              : []),
                            ...(inspectorTabIds.includes(PAYMENT_MODAL_INSPECTOR_TAB_IDS.B2B_AR)
                              ? [
                                  {
                                    id: PAYMENT_MODAL_INSPECTOR_TAB_IDS.B2B_AR,
                                    label: t('rightRail.b2bArDetails'),
                                    content: customerId ? (
                                      <div className="space-y-3">
                                        <B2BContractsSelect customerId={customerId} control={control} isRTL={isRTL} />
                                        <div className="grid gap-3 md:grid-cols-2">
                                          <Controller
                                            name="costCenterCode"
                                            control={control}
                                            render={({ field }) => (
                                              <CmxInput
                                                {...field}
                                                label={t('b2b.costCenter') || 'Cost Center'}
                                                dir="ltr"
                                                placeholder={t('b2b.costCenterPlaceholder') || 'Optional'}
                                              />
                                            )}
                                          />
                                          <Controller
                                            name="poNumber"
                                            control={control}
                                            render={({ field }) => (
                                              <CmxInput
                                                {...field}
                                                label={t('b2b.poNumber') || 'PO Number'}
                                                dir="ltr"
                                                placeholder={t('b2b.poNumberPlaceholder') || 'Optional'}
                                              />
                                            )}
                                          />
                                        </div>
                                        {serverTotals?.creditLimit?.creditLimit && serverTotals.creditLimit.creditLimit > 0 ? (
                                          <div
                                            ref={creditLimitCardRef}
                                            className={`rounded-xl border p-3 ${serverTotals.creditLimit.wouldExceed ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}
                                          >
                                            <p className={`flex items-center gap-2 text-sm font-medium text-slate-900 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                              <CircleAlert className="h-4 w-4 text-amber-600" />
                                              {t('b2b.creditLimit') || 'Credit Limit'}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-600">
                                              {t('b2b.creditUsed') || 'Used'}: {currencyCode} {formatAmount(serverTotals.creditLimit.currentBalance)} • {t('b2b.creditAvailable') || 'Available'}: {currencyCode} {formatAmount(serverTotals.creditLimit.available)}
                                            </p>
                                            {serverTotals.creditLimit.wouldExceed && serverTotals.creditLimit.mode === 'warn' ? (
                                              <div className="mt-2">
                                                <CmxCheckbox
                                                  ref={creditLimitOverrideRef}
                                                  checked={creditLimitOverride}
                                                  onChange={(event) => setCreditLimitOverride(event.target.checked)}
                                                  label={t('b2b.creditOverrideConfirm') || 'I confirm override of credit limit'}
                                                />
                                              </div>
                                            ) : null}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null,
                                  },
                                ]
                              : []),
                            {
                              id: PAYMENT_MODAL_INSPECTOR_TAB_IDS.PAYMENT_NOTES,
                              label: t('rightRail.paymentNotes'),
                              content: (
                                <Controller
                                  name="paymentNotes"
                                  control={control}
                                  render={({ field }) => (
                                    <CmxTextarea
                                      {...field}
                                      id="v4-payment-notes"
                                      value={field.value ?? ''}
                                      onChange={(event) => field.onChange(event.target.value)}
                                      dir={isRTL ? 'rtl' : 'ltr'}
                                      rows={4}
                                      className="min-h-28 resize-none"
                                      placeholder={t('paymentNotesPlaceholder') || 'Optional payment-related notes...'}
                                    />
                                  )}
                                />
                              ),
                            },
                          ] satisfies CmxTabItem[]}
                        />
                      </CmxCardContent>
                    </CmxCard>
                  </div>

                  {showBalancePolicySection ? (
                    <div ref={balancePolicySectionRef} tabIndex={-1} className="outline-none">
                      <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                        <CmxCardHeader className={`flex-row items-start justify-between gap-3 border-b border-slate-100 pb-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                          <div>
                            <CmxCardTitle className={`flex items-center gap-2 text-base text-slate-900 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              {t('sections.sectionD')} · {t('rightRail.balancePolicy')}
                              <Info className="h-4 w-4 text-slate-400" />
                            </CmxCardTitle>
                            <p className="mt-1 text-sm text-slate-600">{t('rightRail.balancePolicyHelp')}</p>
                          </div>
                        </CmxCardHeader>
                        <CmxCardContent className="space-y-3 pt-5">
                          {([
                            {
                              policy: 'NONE' as OutstandingPolicy,
                              title: t('rightRail.fullPaymentRequired'),
                              description: t('rightRail.fullPaymentRequiredHelp'),
                            },
                            {
                              policy: 'PAY_ON_COLLECTION' as OutstandingPolicy,
                              title: t('remainder.payOnCollection'),
                              description: t('rightRail.payOnCollectionHelp'),
                            },
                            {
                              policy: 'CREDIT_INVOICE' as OutstandingPolicy,
                              title: t('remainder.invoiceOutstanding'),
                              description: t('rightRail.invoiceOutstandingHelp'),
                            },
                          ]).map((option) => (
                            <CmxButton
                              key={option.policy}
                              ref={option.policy === 'PAY_ON_COLLECTION' ? payOnCollectionPolicyButtonRef : undefined}
                              type="button"
                              variant="outline"
                              onClick={() => handleOutstandingPolicyChange(option.policy)}
                              className={`h-auto w-full justify-start rounded-2xl border px-4 py-3 text-left ${
                                effectiveOutstandingPolicy === option.policy
                                  ? 'border-teal-500 bg-gradient-to-r from-teal-50 to-cyan-50 text-slate-900 shadow-sm'
                                  : 'border-slate-200 bg-white text-slate-700'
                              } ${isRTL ? 'text-right' : ''}`}
                            >
                              <div className="space-y-1">
                                <p className="text-sm font-semibold">{option.title}</p>
                                <p className="text-xs text-slate-500">{option.description}</p>
                              </div>
                            </CmxButton>
                          ))}
                        </CmxCardContent>
                      </CmxCard>
                    </div>
                  ) : null}
                </div>
                    </CmxCardContent>
                  </CmxCard>
                </section>

                <aside className="min-w-0">
                  <CmxCard className="overflow-hidden border-cyan-100 bg-white/95 shadow-sm">
                    <CmxCardHeader className="border-b border-cyan-100 pb-3">
                      <CmxCardTitle className={`flex items-center gap-2 text-base font-semibold text-cyan-900 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                        <UserRound className="h-4 w-4 text-cyan-700" />
                        {t('sections.receiptBrain')}
                      </CmxCardTitle>
                      <p className={`mt-1 text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('sections.receiptBrainHelp')}
                      </p>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-3 pt-3">
                <div className="space-y-3">
                  <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                    <CmxCardContent className="pt-5">
                      <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-cyan-700">
                          <UserRound className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <p className="truncate text-lg font-semibold text-slate-900">{customerHeaderName}</p>
                            {customerType === 'b2b' ? (
                              <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700">
                                B2B
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-sm text-slate-500">{customerHeaderMeta}</p>
                        </div>
                      </div>
                    </CmxCardContent>
                  </CmxCard>

                  <div>
                    <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm backdrop-blur">
                      <CmxCardHeader className="border-b border-slate-100 pb-3">
                        <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <CmxCardTitle className="text-sm text-slate-900">{t('rightRail.balanceResult')}</CmxCardTitle>
                          <Badge
                            variant="secondary"
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              rightRailState.balanceStatus === RIGHT_RAIL_BALANCE_STATUS.BLOCKED
                                ? 'bg-rose-100 text-rose-700'
                                : rightRailState.balanceStatus === RIGHT_RAIL_BALANCE_STATUS.OVERPAID
                                  ? 'bg-amber-100 text-amber-700'
                                  : rightRailState.balanceStatus === RIGHT_RAIL_BALANCE_STATUS.FULLY_SETTLED
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-cyan-100 text-cyan-700'
                            }`}
                          >
                            {balanceStatusLabel}
                          </Badge>
                        </div>
                      </CmxCardHeader>
                      <CmxCardContent className="space-y-2 pt-4">
                        <SummaryRow
                          label={t('rightRail.orderTotal')}
                          value={`${currencyCode} ${formatAmount(saleTotal)}`}
                        />
                          <SummaryRow
                            label={t('rightRail.totalSettledNow')}
                            value={`${currencyCode} ${formatAmount(amountAppliedToOrder)}`}
                          />
                        <SummaryRow
                          label={t('rightRail.remainingBalance')}
                          value={`${currencyCode} ${formatAmount(remainingBalance)}`}
                          negative={remainingBalance > moneyEpsilon}
                        />
                        {displayChangeAmount > moneyEpsilon ? (
                          <SummaryRow
                            label={t('rightRail.changeReturned')}
                            value={`${currencyCode} ${formatAmount(displayChangeAmount)}`}
                          />
                        ) : null}
                        {unresolvedOverpaymentAmount > moneyEpsilon ? (
                          <SummaryRow
                            label={t('rightRail.overpaidAmount')}
                            value={`${currencyCode} ${formatAmount(unresolvedOverpaymentAmount)}`}
                            negative
                          />
                        ) : null}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                            {t('rightRail.status')}
                          </p>
                          <p className={`mt-1 text-sm font-medium text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                            {balanceStatusLabel}
                          </p>
                        </div>
                      </CmxCardContent>
                    </CmxCard>
                  </div>

                  {requiredActionCopy ? (
                    <CmxCard className="overflow-hidden border-rose-200 bg-rose-50/80 shadow-sm">
                      <CmxCardHeader className="border-b border-rose-100 pb-3">
                        <CmxCardTitle className={`flex items-center gap-2 text-sm text-rose-900 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <CircleAlert className="h-4 w-4" />
                          {requiredActionCopy.title}
                        </CmxCardTitle>
                      </CmxCardHeader>
                      <CmxCardContent className="space-y-3 pt-4">
                        <p className={`text-sm font-medium text-rose-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {requiredActionCopy.message}
                        </p>
                        <CmxButton
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleBlockedSubmitAttempt}
                          className="w-full rounded-xl border-rose-200 bg-white text-rose-800 hover:bg-rose-100"
                        >
                          {t('workspace.fixAction')}
                        </CmxButton>
                      </CmxCardContent>
                    </CmxCard>
                  ) : null}

                  <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                    <CmxCardHeader className="border-b border-slate-100 pb-3">
                      <CmxCardTitle className="text-sm text-slate-900">{t('rightRail.settlementNow')}</CmxCardTitle>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('rightRail.realPaymentsReceived')}
                        </p>
                        {realPaymentSummaryItems.length > 0 ? (
                          realPaymentSummaryItems.map((item) => (
                            <SummaryRow key={`${item.label}-${item.value}`} label={item.label} value={item.value} />
                          ))
                        ) : (
                          <p className={`text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                            {t('rightRail.noneApplied')}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('rightRail.creditsApplied')}
                        </p>
                        {storedValueSummaryItems.length > 0 || appliedGiftCard ? (
                          <>
                            {storedValueSummaryItems.map((item) => (
                              <SummaryRow key={`${item.label}-${item.value}`} label={item.label} value={item.value} />
                            ))}
                            {appliedGiftCard ? (
                              <SummaryRow
                                label={t('giftCard.title')}
                                value={`${currencyCode} ${formatAmount(appliedGiftCard.amount)}`}
                              />
                            ) : null}
                          </>
                        ) : (
                          <p className={`text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                            {t('rightRail.noneApplied')}
                          </p>
                        )}
                      </div>
                      <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2">
                        <SummaryRow
                          label={t('rightRail.totalSettledNow')}
                          value={`${currencyCode} ${formatAmount(amountAppliedToOrder)}`}
                          bold
                        />
                      </div>
                    </CmxCardContent>
                  </CmxCard>

                  <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                    <CmxCardHeader className="border-b border-slate-100 pb-3">
                      <CmxCardTitle className="text-sm text-slate-900">{t('sections.shortcuts')}</CmxCardTitle>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-2 pt-4">
                      <CmxButton
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS)}
                        className="w-full justify-between rounded-xl"
                      >
                        <span>{t('rightRail.adjustments')}</span>
                        {appliedBadgeCount > 0 ? <Badge variant="secondary">{appliedBadgeCount}</Badge> : null}
                      </CmxButton>
                      {cashDrawerRequired ? (
                        <CmxButton
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER)}
                          className="w-full justify-between rounded-xl"
                        >
                          <span>{t('sections.cashDrawer')}</span>
                          <Badge variant="secondary">{selectedCashDrawerChoice ? t('cashDrawer.boundBadge') : t('cashDrawer.pendingBadge')}</Badge>
                        </CmxButton>
                      ) : null}
                      <CmxButton
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.FINANCIAL_INSPECTOR)}
                        className="w-full justify-between rounded-xl"
                      >
                        <span>{t('sections.financialInspector')}</span>
                        <Badge variant="secondary">{inspectorTabIds.length}</Badge>
                      </CmxButton>
                      {showBalancePolicySection ? (
                        <CmxButton
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => scrollToWorkbenchSection(PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY)}
                          className="w-full justify-between rounded-xl"
                        >
                          <span>{t('rightRail.balancePolicy')}</span>
                          <Badge variant="secondary">{balanceStatusLabel}</Badge>
                        </CmxButton>
                      ) : null}
                    </CmxCardContent>
                  </CmxCard>
                </div>
                    </CmxCardContent>
                  </CmxCard>
                </aside>
              </div>
            </div>

              <CmxDialogFooter className="flex-col items-stretch gap-2 border-t border-slate-200 bg-white">
                {validationItems.length > 0 ? (
                  <CmxSummaryMessage
                    type="warning"
                    title={t('messages.validationErrors')}
                    items={validationItems}
                    className="w-full"
                  />
                ) : null}
                <div className={`flex w-full gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <CmxButton type="button" variant="outline" onClick={closeWithGuard} className="flex-1 rounded-2xl border-slate-300">
                    {tCommon('cancel')}
                  </CmxButton>
                  <CmxButton
                    type="button"
                    loading={loading}
                    disabled={submitBusy}
                    onClick={submitHasBlockingIssues ? handleBlockedSubmitAttempt : handleSubmit(onSubmitForm, onInvalidForm)}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-700 font-bold shadow-sm"
                    size="lg"
                  >
                    {submitButtonLabel}
                  </CmxButton>
                </div>
                <p className={`w-full text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('messages.paymentMethodNote', { method: summaryMethodLabel })}
                </p>
              </CmxDialogFooter>
            </form>
          </div>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={cashDrawerDialogOpen} onOpenChange={setCashDrawerDialogOpen}>
        <CmxDialogContent className="max-w-lg">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('cashDrawer.dialogTitle')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{t('cashDrawer.dialogDescription')}</p>

            {cashDrawerRequestError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {cashDrawerRequestError}
              </div>
            )}

            <div className="space-y-2">
              <label className={`block text-sm font-medium text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('cashDrawer.drawerLabel')}
              </label>
              <CmxSelectDropdown
                value={cashDrawerToOpenId}
                onValueChange={(value) => {
                  setCashDrawerToOpenId(value);
                  setCashDrawerRequestError(null);
                }}
                emptyLabel={t('cashDrawer.drawerPlaceholder')}
              >
                <CmxSelectDropdownTrigger dir={isRTL ? 'rtl' : 'ltr'}>
                  <CmxSelectDropdownValue
                    displayValue={
                      (() => {
                        const selectedDrawer = cashDrawers.find((drawer) => drawer.id === cashDrawerToOpenId);
                        return selectedDrawer
                          ? getDrawerDisplayName(selectedDrawer)
                          : t('cashDrawer.drawerPlaceholder');
                      })()
                    }
                    placeholder={t('cashDrawer.drawerPlaceholder')}
                  />
                </CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  {cashDrawers
                    .filter((drawer) => !drawer.currentSession)
                    .map((drawer) => (
                      <CmxSelectDropdownItem key={drawer.id} value={drawer.id}>
                        {getDrawerDisplayName(drawer)}
                      </CmxSelectDropdownItem>
                    ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
            </div>

            <div className="space-y-2">
              <label className={`block text-sm font-medium text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('cashDrawer.openingBalanceLabel')}
              </label>
              <CmxMoneyField
                value={openingBalanceValue}
                decimalPlaces={decimalPlaces}
                showZero
                aria-label={t('cashDrawer.openingBalanceLabel')}
                placeholder={formatAmount(0)}
                onValueChange={(value) => {
                  setOpeningBalanceValue(value);
                  setCashDrawerRequestError(null);
                }}
              />
            </div>
          </div>
          <CmxDialogFooter className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <CmxButton type="button" variant="outline" onClick={() => setCashDrawerDialogOpen(false)}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton
              type="button"
              onClick={() => void handleCreateCashDrawerSession()}
              disabled={openingDrawerSession || !cashDrawerToOpenId}
              className="bg-gradient-to-r from-teal-600 to-cyan-700"
            >
              {openingDrawerSession ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t('cashDrawer.openingAction')}
                </>
              ) : (
                t('cashDrawer.openSession')
              )}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog
        open={submitConfirmOpen}
        onOpenChange={(nextOpen) => {
          setSubmitConfirmOpen(nextOpen);
          if (!nextOpen) setPendingSubmission(null);
        }}
      >
        <CmxDialogContent className="max-w-lg">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('submitConfirm.title')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            <p className={`text-sm text-slate-600 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('submitConfirm.description')}
            </p>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
              <div className="space-y-2">
                <SummaryRow label={t('rightRail.orderTotal')} value={`${currencyCode} ${formatAmount(saleTotal)}`} />
                <SummaryRow label={t('rightRail.totalSettledNow')} value={`${currencyCode} ${formatAmount(amountAppliedToOrder)}`} />
                {cashTenderedAmount > moneyEpsilon ? (
                  <SummaryRow
                    label={t('rightRail.cashTendered')}
                    value={`${currencyCode} ${formatAmount(cashTenderedAmount)}`}
                  />
                ) : null}
                {appliedGiftCard ? (
                  <SummaryRow label={t('giftCard.title')} value={`${currencyCode} ${formatAmount(appliedGiftCard.amount)}`} />
                ) : null}
                <SummaryRow
                  label={t('rightRail.remainingBalance')}
                  value={`${currencyCode} ${formatAmount(remainingBalance)}`}
                  negative={remainingBalance > moneyEpsilon}
                />
                {displayChangeAmount > moneyEpsilon ? (
                  <SummaryRow
                    label={t('rightRail.changeReturned')}
                    value={`${currencyCode} ${formatAmount(displayChangeAmount)}`}
                  />
                ) : null}
                {unresolvedOverpaymentAmount > moneyEpsilon ? (
                  <SummaryRow
                    label={t('rightRail.overpaidAmount')}
                    value={`${currencyCode} ${formatAmount(unresolvedOverpaymentAmount)}`}
                    negative
                  />
                ) : null}
                <SummaryRow label={t('submitConfirm.paymentMethod')} value={summaryMethodLabel} />
              </div>
            </div>
            {remainingBalance > moneyEpsilon ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {t('submitConfirm.remainingNotice', {
                  amount: `${currencyCode} ${formatAmount(remainingBalance)}`,
                })}
              </div>
            ) : null}
          </div>
          <CmxDialogFooter className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <CmxButton
              type="button"
              variant="outline"
              onClick={() => {
                setSubmitConfirmOpen(false);
                setPendingSubmission(null);
              }}
            >
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton type="button" onClick={handleConfirmPaymentSubmit} disabled={!pendingSubmission}>
              {t('submitConfirm.confirm')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <PaymentModalV4CreditNotePicker
        open={creditNotePickerOpen}
        onClose={() => {
          setCreditNotePickerOpen(false);
          setPendingCreditNoteOption(null);
        }}
        notes={storedValueSummary?.creditNotes ?? []}
        selectedNoteId={
          paymentLegs.find((leg) => leg.method === 'CREDIT_NOTE')?.creditReferenceId ?? null
        }
        onSelect={handleCreditNoteSelect}
        isRTL={isRTL}
      />

      <CmxConfirmDialog
        open={confirmCloseOpen}
        title={tCommon('confirm') || 'Confirm'}
        description={t('messages.discardChanges') || 'You have unsaved payment changes. Close this modal and discard them?'}
        confirmLabel={tCommon('close') || 'Close'}
        cancelLabel={tCommon('cancel')}
        onCancel={() => setConfirmCloseOpen(false)}
        onConfirm={() => {
          setConfirmCloseOpen(false);
          setIsDirtySinceOpen(false);
          onClose();
        }}
      />

      <AutoAllocationPreviewDrawer
        open={allocation.autoDrawerOpen}
        onOpenChange={allocation.setAutoDrawerOpen}
        preview={allocation.allocationPreview}
        loading={allocation.previewLoading}
        confirming={allocation.confirmLoading}
        currencyCode={currencyCode}
        formatAmount={formatAmount}
        onConfirm={() => void allocation.handleConfirmAutoAllocation()}
        isRTL={isRTL}
      />

      <ManualAllocationDrawer
        open={allocation.manualDrawerOpen}
        onOpenChange={allocation.setManualDrawerOpen}
        targets={allocation.openBalanceTargets}
        excessAmount={unresolvedOverpaymentAmount}
        currencyCode={currencyCode}
        formatAmount={formatAmount}
        loading={allocation.openBalancesLoading}
        submitting={allocation.confirmLoading}
        onSubmit={(lines) => void allocation.handleSubmitManualAllocation(lines)}
        isRTL={isRTL}
      />
    </>
  );
}
