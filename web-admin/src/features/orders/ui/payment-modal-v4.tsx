/**
 * Payment Modal V4
 * Touch-optimized payment modal with method rail, keypad workspace, and summary rail.
 */

'use client';

import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import { useForm, Controller, type FieldErrors, type Resolver } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  X, CreditCard, Banknote, Package, FileText, CheckSquare,
  Loader2, ChevronDown, ChevronUp,
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
  deriveOutstandingPolicy,
  formatDecimalDraft,
  getPreferredCashDrawerStorageKey,
  getSuggestedStoredValueAmount,
  getWalletLegMaxAmount,
  resolvePreferredCashDrawerSessionId,
  walletLegExceedsBalance,
  parseDecimalDraft,
  sanitizeDecimalDraft,
  syncDiscountFromPercent,
  syncDiscountPercentFromAmount,
  todayYyyyMmDd,
  validateCheckDueDate,
  type PaymentKeypadKey,
} from './payment-modal-v4.utils';
import {
  derivePaymentModalRightRailState,
  RIGHT_RAIL_BALANCE_STATUS,
  RIGHT_RAIL_REQUIRED_ACTION,
  RIGHT_RAIL_WARNING,
  type PaymentModalRightRailState,
} from './payment-modal-v4.right-rail';

// Cmx component imports
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton, CmxCheckbox } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { CmxMoneyField } from '@ui/primitives';
import { CmxTextarea } from '@ui/primitives';
import { CmxSkeleton } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxKeypad } from '@ui/utilities';
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms';

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

const PAYMENT_KEYPAD_KEYS: readonly PaymentKeypadKey[] = [
  '1',
  '2',
  '3',
  '+10',
  '4',
  '5',
  '6',
  '+20',
  '7',
  '8',
  '9',
  '+50',
  '.',
  '0',
  'backspace',
  'clear',
] as const;

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (paymentData: PaymentFormData, payload: NewOrderPaymentPayload) => void;
  total: number;
  items: { productId: string; quantity: number; servicePrefCharge?: number; packingPrefCharge?: number }[];
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

function CollapsibleRailCard({
  title,
  badge,
  open,
  onToggle,
  children,
  isRTL,
}: {
  title: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  isRTL: boolean;
}) {
  return (
    <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
      <CmxButton
        type="button"
        variant="ghost"
        onClick={onToggle}
        aria-expanded={open}
        className={`h-auto w-full justify-between rounded-none px-4 py-3 text-sm font-medium text-slate-900 ${isRTL ? 'flex-row-reverse' : ''}`}
      >
        <span className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {title}
          {badge ? <Badge variant="secondary" className="text-xs">{badge}</Badge> : null}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </CmxButton>
      {open ? <CmxCardContent className="space-y-3 border-t">{children}</CmxCardContent> : null}
    </CmxCard>
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

  // Collapsible panel state
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(false);
  const [orderValueOpen, setOrderValueOpen] = useState(false);
  const [taxPanelOpen, setTaxPanelOpen] = useState(false);
  const [currencyPanelOpen, setCurrencyPanelOpen] = useState(true);
  const [warningsOpen, setWarningsOpen] = useState(true);
  const [paymentNotesDialogOpen, setPaymentNotesDialogOpen] = useState(false);

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
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeLegDraftSyncKeyRef = useRef<string | null>(null);
  const pinInputRef  = useRef<HTMLInputElement | null>(null);
  const giftCardDetailsRef = useRef<HTMLDivElement | null>(null);
  const giftCardAmountInputRef = useRef<HTMLInputElement | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const amountDiscountInputRef = useRef<HTMLInputElement | null>(null);
  const percentDiscountInputRef = useRef<HTMLInputElement | null>(null);
  const checkNumberInputRef = useRef<HTMLInputElement | null>(null);
  const payOnCollectionPolicyButtonRef = useRef<HTMLButtonElement | null>(null);
  const creditLimitCardRef = useRef<HTMLDivElement | null>(null);
  const creditLimitOverrideRef = useRef<HTMLInputElement | null>(null);
  const couponCardRef = useRef<HTMLDivElement | null>(null);
  const cashDrawerCardRef = useRef<HTMLDivElement | null>(null);
  const cashDrawerSelectorCardRef = useRef<HTMLDivElement | null>(null);
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

  const { data: checkoutOptions, isLoading: checkoutMethodsLoading } = useQuery<CheckoutOptionsResponse>({
    queryKey: ['checkout-options', tenantOrgId, branchId ?? '', customerId ?? '', total],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set('branchId', branchId);
      if (customerId) params.set('customerId', customerId);
      params.set('amount', String(total));
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
      setAdjustmentsOpen(false);
      setOrderValueOpen(false);
      setTaxPanelOpen(false);
      setCurrencyPanelOpen(true);
      setWarningsOpen(true);
      setPaymentNotesDialogOpen(false);
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

  const displayTaxBreakdown = serverTotals?.taxBreakdown?.length ? serverTotals.taxBreakdown : fallbackTaxBreakdown;
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

  const IMMEDIATE_METHOD_CODES = [
    PAYMENT_METHODS.CASH,
    PAYMENT_METHODS.CARD,
    PAYMENT_METHODS.CHECK,
    PAYMENT_METHODS.BANK_TRANSFER,
    PAYMENT_METHODS.MOBILE_PAYMENT,
    PAYMENT_METHODS.HYPERPAY,
    PAYMENT_METHODS.PAYTABS,
    PAYMENT_METHODS.STRIPE,
  ] as const;

  const GATEWAY_METHOD_CODES: string[] = [
    PAYMENT_METHODS.HYPERPAY,
    PAYMENT_METHODS.PAYTABS,
    PAYMENT_METHODS.STRIPE,
  ];
  const realPaymentOptions = useMemo(
    () =>
      checkoutMethods
        .filter((method) => method.payment_nature === 'REAL_PAYMENT' && method.allowed_in_pos)
        .filter((method) => !isRetailOnlyOrder || method.payment_method_code !== PAYMENT_METHODS.INVOICE)
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
    const currentLeg = paymentLegs[idx];
    const normalizedValue =
      key === 'amount' && typeof value === 'number' && currentLeg?.method === 'WALLET'
        ? (Math.min(
            value,
            getWalletLegMaxAmount(liveWalletBalance, paymentLegs, idx, saleTotal, decimalPlaces)
          ) as PaymentLeg[K])
        : value;

    setIsDirtySinceOpen(true);
    setPaymentLegs((prev) => {
      const target = prev[idx];
      if (!target) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [key]: normalizedValue };
      return updated;
    });
  }, [decimalPlaces, liveWalletBalance, paymentLegs, saleTotal]);

  const upsertSettlementLeg = useCallback(
    (option: CheckoutSettlementOption, defaultAmount: number) => {
      const nextAmount = Number.parseFloat(
        Math.max(0, Math.min(saleTotal, defaultAmount)).toFixed(decimalPlaces)
      );
      setIsDirtySinceOpen(true);
      setPaymentLegs((prev) => {
        const existingIndex = prev.findIndex(
          (leg) =>
            leg.method === option.payment_method_code &&
            (leg.gateway_code ?? '') === (option.gateway_code ?? '')
        );
        const nextLeg: PaymentLeg = {
          method: option.payment_method_code as PaymentLeg['method'],
          amount: nextAmount,
          ...(GATEWAY_METHOD_CODES.includes(option.payment_method_code)
            ? { gateway_code: option.gateway_code ?? undefined }
            : {}),
        };

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...nextLeg,
            amount: updated[existingIndex].amount > 0 ? updated[existingIndex].amount : nextAmount,
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
    [GATEWAY_METHOD_CODES, decimalPlaces, focusAmountEditor, saleTotal]
  );

  const handleMethodSelect = useCallback(
    (option: CheckoutSettlementOption) => {
      setValue('paymentMethod', option.payment_method_code as PaymentMethodCode, { shouldDirty: true });
      const alreadyApplied = paymentLegs.some(
        (leg) =>
          leg.method === option.payment_method_code &&
          (leg.gateway_code ?? '') === (option.gateway_code ?? '')
      );
      const currentSettled = paymentLegs.reduce((sum, leg) => sum + (leg.amount || 0), 0);
      const suggestedAmount = alreadyApplied
        ? getMethodOption(option.payment_method_code, option.gateway_code)
          ? paymentLegs.find(
              (leg) =>
                leg.method === option.payment_method_code &&
                (leg.gateway_code ?? '') === (option.gateway_code ?? '')
            )?.amount ?? 0
          : 0
        : Math.max(0, saleTotal - currentSettled);
      upsertSettlementLeg(option, suggestedAmount);
    },
    [getMethodOption, paymentLegs, setValue, saleTotal, upsertSettlementLeg]
  );

  const handleCustomerCreditSelect = useCallback(
    (option: CheckoutSettlementOption) => {
      if (option.requires_credit_reference_selection) {
        cmxMessage.info(t('customerCredits.referenceSelectionHint'));
        return;
      }
      const availableBalance =
        option.credit_application_type === 'WALLET'
          ? liveWalletBalance
          : option.available_balance ?? 0;
      const currentSettled = paymentLegs.reduce((sum, leg) => sum + (leg.amount || 0), 0);
      const suggestedAmount = getSuggestedStoredValueAmount(
        availableBalance,
        currentSettled,
        saleTotal,
        decimalPlaces
      );
      upsertSettlementLeg(option, suggestedAmount);
    },
    [decimalPlaces, liveWalletBalance, paymentLegs, t, saleTotal, upsertSettlementLeg]
  );

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

  const editableLegEntries = useMemo(
    () => paymentLegs.map((leg, index) => ({ leg, index })),
    [paymentLegs]
  );

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
  const giftCardSettlementAmount = NEW_ORDER_PROMO_GIFT_DISABLED ? 0 : (appliedGiftCard?.amount || 0);
  const totalSettledNowAmount = settledNowAmount + giftCardSettlementAmount;
  const walletLegEntry = useMemo(
    () => settlementLegEntries.find(({ leg }) => leg.method === 'WALLET') ?? null,
    [settlementLegEntries]
  );
  const walletLegExceedsLiveBalance = !!walletLegEntry &&
    walletLegExceedsBalance(walletLegEntry.leg.amount || 0, liveWalletBalance);

  const moneyEpsilon = Math.pow(10, -(decimalPlaces + 1));
  const remainingBalance = Math.max(0, saleTotal - totalSettledNowAmount);
  const changeAmount = Math.max(0, totalSettledNowAmount - saleTotal);
  const canReturnChangeFromCash = cashLegAmount > moneyEpsilon;
  const overpaymentNeedsResolution = changeAmount > moneyEpsilon && !canReturnChangeFromCash;
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
          settledNowAmount,
          saleTotal,
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
      settledNowAmount,
      saleTotal,
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
    }

    if (walletLegExceedsLiveBalance) {
      cmxMessage.error(
        t('customerCredits.walletBalanceExceeded', {
          amount: liveWalletBalanceDisplay,
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
        paymentLegs: settlementLegEntries.map(({ leg }) => leg),
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
      case PAYMENT_METHODS.HYPERPAY:          return <CreditCard className={cls} />;
      case PAYMENT_METHODS.PAYTABS:           return <CreditCard className={cls} />;
      case PAYMENT_METHODS.STRIPE:            return <CreditCard className={cls} />;
      case 'WALLET':                          return <Wallet className={cls} />;
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
      case PAYMENT_METHODS.HYPERPAY:          return t('methods.hyperpay');
      case PAYMENT_METHODS.PAYTABS:           return t('methods.paytabs');
      case PAYMENT_METHODS.STRIPE:            return t('methods.stripe');
      case 'WALLET':                          return t('customerCredits.wallet');
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

  const showAdjustmentsContent = NEW_ORDER_PROMO_GIFT_DISABLED
    ? true
    : adjustmentsOpen || !!appliedPromoCode || !!appliedGiftCard;

  const appliedBadgeCount = (appliedPromoCode ? 1 : 0) + (appliedGiftCard ? 1 : 0);
  const activeLeg = paymentLegs[activeLegIndex] ?? null;
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
  const activeLegOption = activeLeg
    ? getMethodOption(activeLeg.method, activeLeg.gateway_code)
    : undefined;
  const summaryMethodLabel = activeLeg
    ? getOptionDisplayName(activeLegOption, activeLeg.method)
    : getPaymentLabel(paymentMethod || defaultPaymentMethod);
  const paymentLegsTotal = settlementLegEntries.reduce((sum, { leg }) => sum + (leg.amount || 0), 0);
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
    if (overpaymentNeedsResolution) {
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
    if (walletLegExceedsLiveBalance) {
      items.push(
        t('customerCredits.walletBalanceExceeded', {
          amount: liveWalletBalanceDisplay,
        })
      );
    }
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
    liveWalletBalanceDisplay,
    cashDrawerBlockingMessage,
    changeAmount,
    currencyCode,
    paymentMethod,
    formatAmount,
    pinRequired,
    promoCodeValidating,
    overpaymentNeedsResolution,
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
  const orderValueSummaryItems = useMemo<RightRailSummaryItem[]>(
    () => {
      const rows: RightRailSummaryItem[] = [
        { label: t('summary.subtotal'), value: `${currencyCode} ${formatAmount(totals.subtotal)}` },
      ];

      if ((totals.autoRuleDiscount ?? 0) > moneyEpsilon) {
        rows.push({
          label: t('summary.rulesDiscount'),
          value: `-${currencyCode} ${formatAmount(totals.autoRuleDiscount ?? 0)}`,
          negative: true,
        });
      }

      if (totals.manualDiscount > moneyEpsilon) {
        rows.push({
          label: t('summary.manualDiscount'),
          value: `-${currencyCode} ${formatAmount(totals.manualDiscount)}`,
          negative: true,
        });
      }

      if (totals.promoDiscount > moneyEpsilon) {
        rows.push({
          label: t('summary.promoDiscount'),
          value: `-${currencyCode} ${formatAmount(totals.promoDiscount)}`,
          negative: true,
        });
      }

      if (totals.vatValue > moneyEpsilon) {
        rows.push({
          label: `VAT (${totals.vatTaxPercent.toFixed(0)}%)`,
          value: `${currencyCode} ${formatAmount(totals.vatValue)}`,
        });
      }

      if ((totals.taxAmount ?? 0) > moneyEpsilon) {
        rows.push({
          label: t('summary.taxAmount'),
          value: `${currencyCode} ${formatAmount(totals.taxAmount ?? 0)}`,
        });
      }

      rows.push({
        label: t('rightRail.orderTotal'),
        value: `${currencyCode} ${formatAmount(saleTotal)}`,
      });

      return rows;
    },
    [currencyCode, formatAmount, moneyEpsilon, saleTotal, t, totals]
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

  const focusFirstBlockingIssue = useCallback(() => {
    if (promoCodeValidating || giftCardValidating || pinRequired) {
      setAdjustmentsOpen(true);
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

    if (overpaymentNeedsResolution) {
      focusAmountEditor();
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

    if (walletLegExceedsLiveBalance) {
      const walletLegIndex = paymentLegs.findIndex((leg) => leg.method === 'WALLET');
      if (walletLegIndex >= 0) {
        setActiveLegIndex(walletLegIndex);
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
    errors.amountDiscount?.message,
    errors.percentDiscount?.message,
    effectiveOutstandingPolicy,
    focusAmountEditor,
    giftCardPin,
    giftCardValidating,
    hasCheckLegWithoutNumber,
    walletLegExceedsLiveBalance,
    cashDrawerBlockingMessage,
    paymentLegs,
    pinRequired,
    promoCodeValidating,
    remainingBalance,
    scrollAndFocusTarget,
    serverTotals?.creditLimit?.mode,
    serverTotals?.creditLimit?.wouldExceed,
    setValue,
    t,
    invalidImmediateAmount,
    overpaymentNeedsResolution,
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
    const normalizedLegDraft = formatDecimalDraft(activeLeg.amount ?? 0, decimalPlaces);
    const normalizedCurrentDraft = sanitizeDecimalDraft(activeAmountDraft, decimalPlaces);
    const currentDraftAmount = parseDecimalDraft(normalizedCurrentDraft);
    const legAmount = activeLeg.amount ?? 0;
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
    const cappedAmount = Math.max(0, Math.min(saleTotal, nextAmount));
    setActiveAmountDraft(nextAmount > saleTotal ? formatDecimalDraft(cappedAmount, decimalPlaces) : nextDraft);
    updateLeg(activeLegIndex, 'amount', cappedAmount);
  }, [activeAmountDraft, activeLeg, activeLegIndex, decimalPlaces, saleTotal, updateLeg]);

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
          className="mx-4 h-[92vh] w-[calc(100vw-2rem)] max-w-[1500px] overflow-hidden rounded-[28px] border border-slate-200/80 p-0 shadow-2xl"
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
              <div className="grid min-h-full gap-4 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
                <div className="space-y-4">
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

                  {cashDrawerRequired && (
                    <div
                      ref={(node) => {
                        cashDrawerCardRef.current = node;
                        cashDrawerSelectorCardRef.current = node;
                      }}
                    >
                      <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                        <CmxCardHeader className="border-b border-slate-100 pb-2">
                          <CmxCardTitle className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <Banknote className="h-4 w-4" />
                            {t('cashDrawer.title')}
                          </CmxCardTitle>
                        </CmxCardHeader>
                        <CmxCardContent className="space-y-3 pt-4">
                          <p className="text-xs leading-5 text-slate-500">{t('cashDrawer.subtitle')}</p>

                          {cashDrawersLoading ? (
                            <div className="space-y-2">
                              <CmxSkeleton className="h-10 w-full" />
                              <CmxSkeleton className="h-20 w-full" />
                            </div>
                          ) : (
                            <>
                              {cashDrawerRequestError && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                  {cashDrawerRequestError}
                                </div>
                              )}

                              {cashDrawerSessionChoices.length > 1 && (
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
                              )}

                              {selectedCashDrawerChoice ? (
                                <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-3">
                                  <div className={`flex items-center justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                    <div className={`${isRTL ? 'text-right' : 'text-left'}`}>
                                      <p className="text-sm font-semibold text-slate-900">
                                        {getDrawerDisplayName(selectedCashDrawerChoice.drawer)}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {selectedCashDrawerChoice.session.session_no}
                                      </p>
                                    </div>
                                    <Badge variant="secondary" className="rounded-full bg-cyan-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                                      {t('cashDrawer.selectedBadge')}
                                    </Badge>
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
                            </>
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
                        </CmxCardContent>
                      </CmxCard>
                    </div>
                  )}

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
                          const disabled = option.requires_credit_reference_selection ||
                            (isWalletOption && (storedValueLoading || (walletBalanceLoaded && !walletHasAvailableBalance)));
                          const balanceLabel = isWalletOption
                            ? storedValueLoading
                              ? t('customerCredits.loadingBalance')
                              : walletHasAvailableBalance
                                ? t('customerCredits.available', {
                                    amount: liveWalletBalanceDisplay,
                                  })
                                : t('customerCredits.noWalletBalance')
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
                            {t('splitPayment.legSum')}: {currencyCode} {formatAmount(paymentLegsTotal)}
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
                          return (
                          <CmxButton
                            key={`payment-leg-summary-${index}`}
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setActiveLegIndex(index);
                              focusAmountEditor();
                            }}
                            className={`h-auto w-full justify-between rounded-2xl border px-3 py-3 text-sm transition ${
                              activeLegIndex === index
                                ? 'border-cyan-500 bg-gradient-to-r from-cyan-50 to-white text-cyan-900 shadow-sm'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
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

                <div className="space-y-4">
                  <CmxCard className="border-cyan-100 bg-gradient-to-br from-slate-50 via-white to-cyan-50 shadow-sm">
                    <CmxCardContent className="pt-5">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="md:border-e md:border-slate-200 md:pe-6">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('workspace.remaining') || 'Remaining'}</p>
                          <p className="mt-2 text-[2rem] font-bold tabular-nums text-amber-600">{currencyCode} {formatAmount(remainingBalance)}</p>
                        </div>
                        <div className="md:border-e md:border-slate-200 md:px-6">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('workspace.change') || 'Change'}</p>
                          <p className="mt-2 text-[2rem] font-bold tabular-nums text-emerald-600">{currencyCode} {formatAmount(changeAmount)}</p>
                        </div>
                        <div className="md:ps-6">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('workspace.totalDue') || 'Total Due'}</p>
                          <p className="mt-2 text-[2rem] font-bold tabular-nums text-slate-900">{currencyCode} {formatAmount(saleTotal)}</p>
                        </div>
                      </div>
                      <div className="mt-5 flex items-center justify-center gap-2">
                        <Badge variant="secondary" className={`rounded-full px-4 py-2 text-sm font-semibold ${remainingBalance > 0.001 ? 'border border-amber-300 bg-amber-50 text-amber-700' : 'border border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
                          {remainingBalance > 0.001
                            ? `${t('splitPayment.outstanding')}: ${currencyCode} ${formatAmount(remainingBalance)}`
                            : `✓ ${t('splitPayment.allocated')}`}
                        </Badge>
                      </div>
                    </CmxCardContent>
                  </CmxCard>

                  {showGiftCardWorkspace ? (
                    <CmxCard ref={giftCardDetailsRef} className="overflow-hidden border-purple-200 bg-gradient-to-br from-white via-purple-50/40 to-cyan-50/50 shadow-sm">
                      <CmxCardHeader className={`flex-row items-center justify-between gap-3 border-b border-purple-100 pb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className={isRTL ? 'text-right' : 'text-left'}>
                          <CmxCardTitle className="text-base font-bold text-slate-900">
                            {t('giftCard.workspaceTitle')}
                          </CmxCardTitle>
                          <p className="mt-1 text-sm text-slate-600">
                            {t('giftCard.workspaceHint')}
                          </p>
                        </div>
                        <Badge variant="secondary" className="rounded-full bg-purple-100 px-3 py-1 text-purple-700">
                          {t('giftCard.title')}
                        </Badge>
                      </CmxCardHeader>
                      <CmxCardContent className="space-y-5 pt-5">
                        <div className={`grid gap-4 ${giftCardDetails ? 'lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(220px,320px)]'}`}>
                          <div className="space-y-3 rounded-2xl border border-purple-100 bg-white/80 p-4">
                            <div className={`flex items-start justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <div className={isRTL ? 'text-right' : 'text-left'}>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-500">
                                  {t('giftCard.cardCode')}
                                </p>
                                <p className="mt-2 break-all text-lg font-bold text-slate-900" dir="ltr">
                                  {giftCardDetails?.number || giftCardNumber}
                                </p>
                              </div>
                              <CmxButton type="button" variant="outline" size="sm" onClick={handleClearGiftCard}>
                                {tCommon('cancel')}
                              </CmxButton>
                            </div>
                            {giftCardDetails ? (
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                  <p className="text-xs text-slate-500">{t('giftCard.balance')}</p>
                                  <p className="mt-1 text-xl font-bold tabular-nums text-purple-700">
                                    {currencyCode} {formatAmount(giftCardDetails.balance)}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                  <p className="text-xs text-slate-500">{t('rightRail.remainingBalance')}</p>
                                  <p className="mt-1 text-xl font-bold tabular-nums text-amber-600">
                                    {currencyCode} {formatAmount(remainingBalance)}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                {t('giftCard.pinPendingError')}
                              </div>
                            )}
                            {giftCardResult && !giftCardResult.isValid ? (
                              <p className={`text-sm text-red-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                                {resolveGiftCardError(giftCardResult)}
                              </p>
                            ) : null}
                          </div>

                          <div className="space-y-3 rounded-2xl border border-purple-100 bg-white p-4 shadow-sm">
                            {pinRequired ? (
                              <div className="space-y-3">
                                <div className={`flex items-end gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                  <CmxInput
                                    ref={pinInputRef}
                                    label={t('giftCard.pinLabel')}
                                    value={giftCardPin}
                                    type={pinVisible ? 'text' : 'password'}
                                    dir="ltr"
                                    error={pinFieldError ?? undefined}
                                    className={pinRequired && !giftCardPin.trim() ? 'ring-1 ring-red-400' : undefined}
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
                                <CmxButton
                                  type="button"
                                  variant="secondary"
                                  onClick={handleFetchGiftCardDetails}
                                  disabled={!giftCardNumber?.trim() || giftCardValidating || !giftCardPin.trim()}
                                  className="w-full"
                                >
                                  {giftCardValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('giftCard.fetch')}
                                </CmxButton>
                              </div>
                            ) : null}

                            {giftCardDetails ? (
                              <div className="space-y-3">
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
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </CmxCardContent>
                    </CmxCard>
                  ) : showDeferredExplanation ? (
                    <CmxCard>
                      <CmxCardContent className="pt-5">
                        <p className="text-lg font-semibold text-slate-900">{t('workspace.noImmediateTitle') || 'No pay-now amount selected'}</p>
                        <p className="mt-2 text-sm text-slate-600">{t('workspace.noImmediateDescription') || 'This order will be submitted entirely as deferred settlement using the selected remaining-balance policy.'}</p>
                      </CmxCardContent>
                    </CmxCard>
                  ) : (
                    <>
                      <CmxCard className="overflow-hidden border-slate-200 shadow-sm">
                        <CmxCardHeader className="border-b border-slate-100 pb-2">
                          <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <CmxCardTitle className={`text-sm text-slate-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                              {t('workspace.editingAmount') || 'Editing amount'}
                              {activeLeg ? ` ${t('workspace.forMethod')} ` : ' '}
                              {activeLeg ? getOptionDisplayName(activeLegOption, activeLeg.method) : ''}
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
                        <CmxCardContent className="space-y-4 pt-4">
                          <div className="flex items-stretch rounded-2xl border border-slate-200 bg-white shadow-inner">
                            <div className="flex min-w-[104px] items-center justify-center rounded-s-2xl border-e border-slate-200 bg-slate-100 px-4 text-xl font-semibold text-cyan-700">
                              {currencyCode}
                            </div>
                            <div className="min-w-0 flex-1 px-3">
                              <CmxMoneyField
                                ref={amountInputRef}
                                draftValue={activeAmountDraft}
                                value={activeLeg?.amount ?? null}
                                decimalPlaces={decimalPlaces}
                                showZero
                                aria-label={t('workspace.editingAmount') || 'Editing amount'}
                                dir="ltr"
                                onValueChange={(value, draft) => {
                                  if (!activeLeg) return;
                                  setActiveAmountDraft(draft);
                                  updateLeg(activeLegIndex, 'amount', value);
                                }}
                                placeholder={formatAmount(0)}
                                disabled={!activeLeg}
                                className="h-16 border-0 bg-transparent px-0 text-[2.65rem] font-bold tracking-tight text-slate-900 shadow-none focus-visible:ring-0"
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
                          <p className="text-xs text-slate-500">{t('workspace.keypadHint') || 'Use the keypad for fast touch entry, or type directly into the amount field.'}</p>
                        </CmxCardContent>
                      </CmxCard>

                      <CmxCard className="border-slate-200 shadow-sm">
                        <CmxCardContent className="pt-4">
                          <CmxKeypad
                            keys={PAYMENT_KEYPAD_KEYS}
                            disabled={!activeLeg}
                            onKeyPress={handleKeypadPress}
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
                            getKeyClassName={(key) => {
                              if (key === 'clear') {
                                return 'text-base font-bold uppercase tracking-[0.18em]';
                              }

                              return key.startsWith('+') ? undefined : 'bg-white';
                            }}
                          />
                        </CmxCardContent>
                      </CmxCard>

                      <CmxCard className="min-h-[360px] overflow-hidden border-cyan-100 bg-gradient-to-br from-white via-slate-50 to-cyan-50/50 shadow-sm">
                        <CmxCardHeader className="border-b border-cyan-100 pb-3">
                          <div className={`flex items-start justify-between gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                            <div>
                              <CmxCardTitle className={`flex items-center gap-2 text-base text-slate-900 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <Maximize2 className="h-4 w-4 text-cyan-700" />
                                {t('workspace.activeTitle')}
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

                              {cashDrawerRequired ? (
                                <div className="rounded-2xl border border-cyan-200 bg-white px-4 py-3">
                                  <div className={`flex items-start justify-between gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                                    <div>
                                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                        <Banknote className="h-4 w-4 text-cyan-700" />
                                        {t('workspace.cashImpactTitle')}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {selectedCashDrawerChoice ? t('cashDrawer.boundHint') : cashDrawerBlockingMessage}
                                      </p>
                                    </div>
                                    <Badge
                                      variant="secondary"
                                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                        selectedCashDrawerChoice ? 'bg-cyan-100 text-cyan-700' : 'bg-amber-100 text-amber-700'
                                      }`}
                                    >
                                      {selectedCashDrawerChoice ? t('cashDrawer.boundBadge') : t('cashDrawer.pendingBadge')}
                                    </Badge>
                                  </div>
                                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                    <SummaryRow
                                      label={t('rightRail.cashRetained')}
                                      value={`${currencyCode} ${formatAmount(cashLegAmount)}`}
                                    />
                                    <SummaryRow
                                      label={t('rightRail.changeReturned')}
                                      value={`${currencyCode} ${formatAmount(changeAmount)}`}
                                      negative={changeAmount > moneyEpsilon}
                                    />
                                    <CmxButton
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => cashDrawerSelectorCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                      className="rounded-xl"
                                    >
                                      {t('workspace.manageDrawer')}
                                    </CmxButton>
                                  </div>
                                </div>
                              ) : null}

                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className={`mb-3 text-sm font-semibold text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                                  {t('workspace.detailsTitle')}
                                </p>

                                <div className="space-y-4">
                                  {creditMethodCodes.includes(activeLeg.method) && (
                                    <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-3 py-3 text-sm text-cyan-900">
                                      {t('customerCredits.applied')}
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
                                        label={t('splitPayment.authCode')}
                                        value={activeLeg.auth_code ?? ''}
                                        dir="ltr"
                                        placeholder="—"
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
                                      label={t('splitPayment.bankReference')}
                                      value={activeLeg.bank_reference ?? ''}
                                      dir="ltr"
                                      placeholder="—"
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
                                        label={t('splitPayment.gatewayTransactionId')}
                                        value={activeLeg.gateway_transaction_id ?? ''}
                                        dir="ltr"
                                        placeholder="—"
                                        onChange={(event) => updateLeg(activeLegIndex, 'gateway_transaction_id', event.target.value || undefined)}
                                      />
                                      <CmxInput
                                        label={t('splitPayment.gatewayReference')}
                                        value={activeLeg.gateway_reference ?? ''}
                                        dir="ltr"
                                        placeholder="—"
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
                    </>
                  )}
                </div>

                <div className="space-y-4">
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

                  <div className="md:sticky md:top-0 md:z-10 md:pb-1">
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
                            value={`${currencyCode} ${formatAmount(totalSettledNowAmount)}`}
                          />
                        <SummaryRow
                          label={t('rightRail.remainingBalance')}
                          value={`${currencyCode} ${formatAmount(remainingBalance)}`}
                          negative={remainingBalance > moneyEpsilon}
                        />
                        <SummaryRow
                          label={t('rightRail.overpaidAmount')}
                          value={`${currencyCode} ${formatAmount(changeAmount)}`}
                          negative={changeAmount > moneyEpsilon}
                        />
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
                      <CmxCardContent className="space-y-2 pt-4">
                        <p className={`text-sm font-medium text-rose-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {requiredActionCopy.message}
                        </p>
                        {validationItems.length > 1 ? (
                          <div className="space-y-1">
                            {validationItems.slice(1, 3).map((item) => (
                              <p
                                key={item}
                                className={`text-xs text-rose-700 ${isRTL ? 'text-right' : 'text-left'}`}
                              >
                                {item}
                              </p>
                            ))}
                          </div>
                        ) : null}
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
                          value={`${currencyCode} ${formatAmount(totalSettledNowAmount)}`}
                          bold
                        />
                      </div>
                    </CmxCardContent>
                  </CmxCard>

                  {rightRailState.showBalancePolicy ? (
                    <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                      <CmxCardHeader className="border-b border-slate-100 pb-3">
                        <CmxCardTitle className={`flex items-center gap-2 text-sm text-slate-900 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          {t('rightRail.balancePolicy')}
                          <Info className="h-4 w-4 text-slate-400" />
                        </CmxCardTitle>
                      </CmxCardHeader>
                      <CmxCardContent className="space-y-3 pt-4">
                        <p className={`text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('rightRail.balancePolicyHelp')}
                        </p>
                        <div className="space-y-2">
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
                              className={`h-auto w-full justify-start rounded-2xl border px-3 py-3 text-left ${
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
                        </div>
                      </CmxCardContent>
                    </CmxCard>
                  ) : null}

                  <div ref={couponCardRef}>
                    <CollapsibleRailCard
                      title={t('rightRail.adjustments')}
                      badge={appliedBadgeCount > 0 ? String(appliedBadgeCount) : undefined}
                      open={showAdjustmentsContent}
                      onToggle={() => setAdjustmentsOpen((value) => !value)}
                      isRTL={isRTL}
                    >
                      <div className="space-y-4">
                        <div className="space-y-3">
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
                          {totals.manualDiscount > moneyEpsilon ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                              <SummaryRow
                                label={t('summary.manualDiscount')}
                                value={`-${currencyCode} ${formatAmount(totals.manualDiscount)}`}
                                negative
                              />
                            </div>
                          ) : null}
                        </div>

                        {!NEW_ORDER_PROMO_GIFT_DISABLED ? (
                          <div className="space-y-4 border-t border-slate-100 pt-4">
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
                              <div className="space-y-2">
                                <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
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
                                  <div className="space-y-2 rounded-xl border border-purple-200 bg-purple-50 p-3">
                                    <p className={`text-xs text-purple-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                                      {pinRequired ? t('giftCard.workspacePinHint') : t('giftCard.workspaceAmountHint')}
                                    </p>
                                    <CmxButton
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="w-full"
                                      onClick={() => {
                                        giftCardDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        window.setTimeout(() => {
                                          if (pinRequired) {
                                            pinInputRef.current?.focus();
                                            pinInputRef.current?.select();
                                            return;
                                          }
                                          giftCardAmountInputRef.current?.focus();
                                          giftCardAmountInputRef.current?.select();
                                        }, 80);
                                      }}
                                    >
                                      {t('giftCard.continueInWorkspace')}
                                    </CmxButton>
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

                        <div className="space-y-2 border-t border-slate-100 pt-4">
                          <div>
                            <p className={`text-sm font-semibold text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                              {t('rightRail.liveEffect')}
                            </p>
                          </div>
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
                      </div>
                    </CollapsibleRailCard>
                  </div>

                  <CollapsibleRailCard
                    title={t('rightRail.orderValue')}
                    open={orderValueOpen}
                    onToggle={() => setOrderValueOpen((value) => !value)}
                    isRTL={isRTL}
                  >
                    <div className="space-y-2">
                      {orderValueSummaryItems.map((item) => (
                        <SummaryRow
                          key={`${item.label}-${item.value}`}
                          label={item.label}
                          value={item.value}
                          negative={item.negative}
                        />
                      ))}
                    </div>
                  </CollapsibleRailCard>

                  {cashDrawerRequired ? (
                    <div>
                      <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                        <CmxCardHeader className="border-b border-slate-100 pb-3">
                          <CmxCardTitle className="text-sm text-slate-900">{t('rightRail.cashDrawerImpact')}</CmxCardTitle>
                        </CmxCardHeader>
                        <CmxCardContent className="space-y-3 pt-4">
                          <SummaryRow
                            label={t('rightRail.cashRetained')}
                            value={`${currencyCode} ${formatAmount(cashLegAmount)}`}
                          />
                          {changeAmount > moneyEpsilon ? (
                            <SummaryRow
                              label={t('rightRail.changeReturned')}
                              value={`${currencyCode} ${formatAmount(changeAmount)}`}
                              negative
                            />
                          ) : null}

                          <div className={`rounded-2xl border px-3 py-3 ${
                            selectedCashDrawerChoice
                              ? 'border-cyan-200 bg-cyan-50/80'
                              : 'border-amber-200 bg-amber-50'
                          }`}>
                            <div className={`flex items-start justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <div className={isRTL ? 'text-right' : 'text-left'}>
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  {t('cashDrawer.boundTitle')}
                                </p>
                                <p className={`mt-1 text-xs ${selectedCashDrawerChoice ? 'text-slate-600' : 'text-amber-800'}`}>
                                  {selectedCashDrawerChoice ? t('cashDrawer.boundHint') : cashDrawerBlockingMessage}
                                </p>
                              </div>
                              <Badge
                                variant="secondary"
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  selectedCashDrawerChoice
                                    ? 'bg-cyan-600 text-white'
                                    : 'bg-amber-600 text-white'
                                }`}
                              >
                                {selectedCashDrawerChoice ? t('cashDrawer.boundBadge') : t('cashDrawer.pendingBadge')}
                              </Badge>
                            </div>

                            {selectedCashDrawerChoice ? (
                              <div className="mt-3 space-y-2">
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
                                <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
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
                            ) : null}
                          </div>
                        </CmxCardContent>
                      </CmxCard>
                    </div>
                  ) : null}

                  <CollapsibleRailCard
                    title={t('rightRail.taxBreakdown')}
                    badge={profilesTaxAmount > moneyEpsilon ? `${currencyCode} ${formatAmount(profilesTaxAmount)}` : undefined}
                    open={taxPanelOpen}
                    onToggle={() => setTaxPanelOpen((value) => !value)}
                    isRTL={isRTL}
                  >
                    {displayTaxBreakdown.length === 0 ? (
                      <p className={`text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('tax.noProfiles')}
                      </p>
                    ) : (
                      displayTaxBreakdown.map((entry, index) => (
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
                      ))
                    )}
                  </CollapsibleRailCard>

                  {customerType === 'b2b' && customerId ? (
                    <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                      <CmxCardHeader className="border-b border-slate-100 pb-3">
                        <CmxCardTitle className="text-sm">{t('rightRail.b2bArDetails')}</CmxCardTitle>
                      </CmxCardHeader>
                      <CmxCardContent className="space-y-3 pt-4">
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
                      </CmxCardContent>
                    </CmxCard>
                  ) : null}

                  {rightRailState.showCurrencyRounding ? (
                    <CollapsibleRailCard
                      title={t('rightRail.currencyRounding')}
                      open={currencyPanelOpen}
                      onToggle={() => setCurrencyPanelOpen((value) => !value)}
                      isRTL={isRTL}
                    >
                      <div className="space-y-2">
                        <SummaryRow
                          label={t('summary.currencyCode')}
                          value={currencyConfig?.currencyCode || currencyCode}
                        />
                        {Math.abs((currencyConfig?.currencyExRate ?? 1) - 1) > moneyEpsilon ? (
                          <SummaryRow
                            label={t('summary.exchangeRate')}
                            value={formatAmount(currencyConfig?.currencyExRate ?? 1)}
                          />
                        ) : null}
                      </div>
                    </CollapsibleRailCard>
                  ) : null}

                  <CmxCard className="overflow-hidden border-slate-200 shadow-sm">
                    <CmxCardHeader className={`flex-row items-center justify-between border-b border-slate-100 px-4 py-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <CmxCardTitle className="text-sm text-slate-900">{t('rightRail.paymentNotes')}</CmxCardTitle>
                      <CmxButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPaymentNotesDialogOpen(true)}
                        aria-label={t('paymentNotesDialogTitle') || 'Edit payment notes'}
                      >
                        <Maximize2 className="h-4 w-4" />
                      </CmxButton>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-2 px-4 py-3">
                      <label htmlFor="v4-payment-notes" className="sr-only">
                        {t('rightRail.paymentNotes')}
                      </label>
                      <Controller
                        name="paymentNotes"
                        control={control}
                        render={({ field }) => (
                          <CmxTextarea
                            {...field}
                            id="v4-payment-notes"
                            value={field.value ?? ''}
                            onChange={(event) => field.onChange(event.target.value)}
                            onDoubleClick={() => setPaymentNotesDialogOpen(true)}
                            dir={isRTL ? 'rtl' : 'ltr'}
                            rows={2}
                            className="min-h-16 resize-none"
                            placeholder={t('paymentNotesPlaceholder') || 'Optional payment-related notes...'}
                          />
                        )}
                      />
                    </CmxCardContent>
                  </CmxCard>

                  {warningMessages.length > 0 ? (
                    <CollapsibleRailCard
                      title={t('rightRail.warnings')}
                      badge={String(warningMessages.length)}
                      open={warningsOpen}
                      onToggle={() => setWarningsOpen((value) => !value)}
                      isRTL={isRTL}
                    >
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
                    </CollapsibleRailCard>
                  ) : null}
                </div>
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

      <CmxDialog open={paymentNotesDialogOpen} onOpenChange={setPaymentNotesDialogOpen}>
        <CmxDialogContent className="max-w-xl">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('paymentNotesDialogTitle')}</CmxDialogTitle>
          </CmxDialogHeader>
          <Controller
            name="paymentNotes"
            control={control}
            render={({ field }) => (
              <CmxTextarea
                {...field}
                value={field.value ?? ''}
                onChange={(event) => field.onChange(event.target.value)}
                dir={isRTL ? 'rtl' : 'ltr'}
                rows={8}
                placeholder={t('paymentNotesPlaceholder') || 'Optional payment-related notes...'}
              />
            )}
          />
          <CmxDialogFooter>
            <CmxButton type="button" onClick={() => setPaymentNotesDialogOpen(false)}>
              {tCommon('close')}
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
                <SummaryRow label={t('rightRail.totalSettledNow')} value={`${currencyCode} ${formatAmount(totalSettledNowAmount)}`} />
                {appliedGiftCard ? (
                  <SummaryRow label={t('giftCard.title')} value={`${currencyCode} ${formatAmount(appliedGiftCard.amount)}`} />
                ) : null}
                <SummaryRow
                  label={t('rightRail.remainingBalance')}
                  value={`${currencyCode} ${formatAmount(remainingBalance)}`}
                  negative={remainingBalance > moneyEpsilon}
                />
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
    </>
  );
}
