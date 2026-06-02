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
  Tag, Loader2, ChevronDown, ChevronUp,
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
  getSuggestedStoredValueAmount,
  getWalletLegMaxAmount,
  walletLegExceedsBalance,
  parseDecimalDraft,
  sanitizeDecimalDraft,
  syncDiscountFromPercent,
  syncDiscountPercentFromAmount,
  todayYyyyMmDd,
  validateCheckDueDate,
  type PaymentKeypadKey,
} from './payment-modal-v4.utils';

// Cmx component imports
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton, CmxCheckbox } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { CmxMoneyField } from '@ui/primitives';
import { CmxTextarea } from '@ui/primitives';
import { CmxSwitch } from '@ui/primitives';
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
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
  const [couponOpen, setCouponOpen]     = useState(false);
  const [taxPanelOpen, setTaxPanelOpen] = useState(true);
  const [paymentNotesDialogOpen, setPaymentNotesDialogOpen] = useState(false);

  // Tax state
  const [taxRate, setTaxRate] = useState<number>(0.06);

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
  const [selectedCashDrawerSessionId, setSelectedCashDrawerSessionId] = useState('');
  const [cashDrawerDialogOpen, setCashDrawerDialogOpen] = useState(false);
  const [cashDrawerToOpenId, setCashDrawerToOpenId] = useState('');
  const [openingBalanceValue, setOpeningBalanceValue] = useState(0);
  const [openingDrawerSession, setOpeningDrawerSession] = useState(false);
  const [cashDrawerRequestError, setCashDrawerRequestError] = useState<string | null>(null);

  const [paymentLegs, setPaymentLegs] = useState<PaymentLeg[]>([]);
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
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const amountDiscountInputRef = useRef<HTMLInputElement | null>(null);
  const percentDiscountInputRef = useRef<HTMLInputElement | null>(null);
  const checkNumberInputRef = useRef<HTMLInputElement | null>(null);
  const payOnCollectionPolicyButtonRef = useRef<HTMLButtonElement | null>(null);
  const creditLimitCardRef = useRef<HTMLDivElement | null>(null);
  const creditLimitOverrideRef = useRef<HTMLInputElement | null>(null);
  const couponCardRef = useRef<HTMLDivElement | null>(null);
  const cashDrawerCardRef = useRef<HTMLDivElement | null>(null);
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
      setCouponOpen(false);
      setTaxPanelOpen(true);
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
  const walletLegEntry = useMemo(
    () => settlementLegEntries.find(({ leg }) => leg.method === 'WALLET') ?? null,
    [settlementLegEntries]
  );
  const walletLegExceedsLiveBalance = !!walletLegEntry &&
    walletLegExceedsBalance(walletLegEntry.leg.amount || 0, liveWalletBalance);

  const remainingBalance = Math.max(0, saleTotal - settledNowAmount);
  const changeAmount = Math.max(0, settledNowAmount - saleTotal);
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

    if (cashDrawerSessionChoices.length === 1) {
      setSelectedCashDrawerSessionId(cashDrawerSessionChoices[0].session.id);
    }
  }, [cashDrawerRequired, cashDrawerSessionChoices, selectedCashDrawerSessionId]);

  const handleOpenCashDrawerDialog = useCallback(() => {
    const preferredDrawerId =
      selectedCashDrawerChoice?.drawer.id ??
      cashDrawers.find((drawer) => !drawer.currentSession)?.id ??
      cashDrawers[0]?.id ??
      '';

    setCashDrawerToOpenId(preferredDrawerId);
    setOpeningBalanceValue(0);
    setCashDrawerRequestError(null);
    setCashDrawerDialogOpen(true);
  }, [cashDrawers, selectedCashDrawerChoice]);

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
  }, [cashDrawerToOpenId, csrfToken, openingBalanceValue, refetchCashDrawers, t]);

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
    if (pinRequired && !giftCardPin.trim()) return;

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
        const defaultAmount = Math.min(result.availableBalance, saleTotal);
        setValue('giftCardAmount', defaultAmount);
        setValue('giftCardId', result.giftCard.id ?? '');
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
    const maxAmount   = Math.min(giftCardDetails.balance, saleTotal);
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
    if (
      paymentMethod !== PAYMENT_METHODS.PAY_ON_COLLECTION &&
      paymentMethod !== PAYMENT_METHODS.INVOICE &&
      settledNowAmount <= 0
    ) {
      cmxMessage.error(t('partialPayment.validation.amountMustBePositive'));
      return;
    }
    onSubmit(submissionData, {
      ...parsed.data,
      creditLimitOverride: creditLimitOverride || undefined,
      ...(cashDrawerRequired && selectedCashDrawerSessionId && {
        cashDrawerSessionId: selectedCashDrawerSessionId,
      }),
    });
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

  const showCouponContent = NEW_ORDER_PROMO_GIFT_DISABLED
    ? false
    : couponOpen || !!appliedPromoCode || !!appliedGiftCard;

  const appliedBadgeCount = (appliedPromoCode ? 1 : 0) + (appliedGiftCard ? 1 : 0);
  const activeLeg = paymentLegs[activeLegIndex] ?? null;
  const effectiveOutstandingPolicy = deriveOutstandingPolicy(
    settledNowAmount,
    saleTotal,
    (outstandingPolicy as OutstandingPolicy | undefined) ?? defaultOutstandingPolicy
  );
  const showDeferredExplanation =
    settlementLegEntries.length === 0 &&
    (paymentMethod === PAYMENT_METHODS.PAY_ON_COLLECTION || paymentMethod === PAYMENT_METHODS.INVOICE);
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
    if (paymentMethod !== PAYMENT_METHODS.PAY_ON_COLLECTION &&
        paymentMethod !== PAYMENT_METHODS.INVOICE &&
        settledNowAmount <= 0) {
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
    paymentMethod,
    pinRequired,
    promoCodeValidating,
    remainingBalance,
    serverTotals?.creditLimit?.mode,
    serverTotals?.creditLimit?.wouldExceed,
    settledNowAmount,
    t,
    walletLegExceedsLiveBalance,
  ]);

  const submitBusy = loading || totalsLoading || (items.length > 0 && !serverTotals);
  const submitHasBlockingIssues = validationItems.length > 0;

  const focusFirstBlockingIssue = useCallback(() => {
    if (promoCodeValidating || giftCardValidating || pinRequired) {
      setCouponOpen(true);
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

    if (
      paymentMethod !== PAYMENT_METHODS.PAY_ON_COLLECTION &&
      paymentMethod !== PAYMENT_METHODS.INVOICE &&
      settledNowAmount <= 0
    ) {
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
    paymentMethod,
    pinRequired,
    promoCodeValidating,
    remainingBalance,
    scrollAndFocusTarget,
    serverTotals?.creditLimit?.mode,
    serverTotals?.creditLimit?.wouldExceed,
    settledNowAmount,
    setValue,
    t,
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

            <form onSubmit={handleSubmit(onSubmitForm, onInvalidForm)} className="flex min-h-0 flex-1 flex-col">
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
                    <div ref={cashDrawerCardRef}>
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

                  {showDeferredExplanation ? (
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

                      {activeLeg && (
                        <CmxCard className="overflow-hidden border-slate-200 shadow-sm">
                          <CmxCardHeader className="border-b border-slate-100 pb-2">
                            <CmxCardTitle className={`text-sm text-slate-700 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              {getPaymentIcon(activeLeg.method)}
                              {t('splitPayment.currentLeg') || 'Current leg details'}
                            </CmxCardTitle>
                          </CmxCardHeader>
                          <CmxCardContent className="space-y-4 pt-4">
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
                          </CmxCardContent>
                        </CmxCard>
                      )}
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
                            <p className="truncate text-xl font-semibold text-slate-900">{customerHeaderName}</p>
                            {customerType === 'b2b' && (
                              <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700">
                                B2B
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 truncate text-sm text-slate-500">{customerHeaderMeta}</p>
                        </div>
                      </div>
                    </CmxCardContent>
                  </CmxCard>

                  <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                    <CmxCardHeader className="border-b border-slate-100 pb-2">
                      <CmxCardTitle className={`text-sm flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        {t('remainder.title') || 'Remaining balance policy'}
                        <Info className="h-4 w-4 text-slate-400" />
                      </CmxCardTitle>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {([
                          ['NONE', t('remainder.fullPayment') || 'Full Payment'],
                          ['PAY_ON_COLLECTION', t('remainder.payOnCollection') || 'Pay on Collection'],
                          ['CREDIT_INVOICE', t('remainder.invoiceOutstanding') || 'Invoice Outstanding'],
                        ] as Array<[OutstandingPolicy, string]>).map(([policy, label]) => (
                          <CmxButton
                            key={policy}
                            ref={policy === 'PAY_ON_COLLECTION' ? payOnCollectionPolicyButtonRef : undefined}
                            type="button"
                            variant="outline"
                            onClick={() => handleOutstandingPolicyChange(policy)}
                            disabled={policy === 'NONE' && remainingBalance > 0.001}
                            className={`h-auto min-h-[72px] flex-col gap-1 rounded-2xl border px-3 py-3 text-center ${
                              effectiveOutstandingPolicy === policy
                                ? 'border-teal-500 bg-gradient-to-r from-teal-50 to-cyan-50 text-slate-900 shadow-sm'
                                : 'border-slate-200 bg-white text-slate-700'
                            }`}
                          >
                            <span className="text-sm font-semibold">{label}</span>
                            {policy !== 'NONE' && <span className="text-[11px] opacity-80">{t('remainder.deferredHint') || 'Deferred settlement'}</span>}
                          </CmxButton>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">{t('remainder.help') || 'When the pay-now amount is less than the total, choose how the remaining balance should be handled.'}</p>
                    </CmxCardContent>
                  </CmxCard>

                  <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                    <CmxCardHeader className="border-b border-slate-100 pb-2">
                      <CmxCardTitle className={`text-sm flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Tag className="h-4 w-4" />
                        {t('discount')}
                      </CmxCardTitle>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-3">
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
                      {(errors.percentDiscount || errors.amountDiscount) && (
                        <p className="text-xs text-red-600">
                          {errors.percentDiscount?.message || errors.amountDiscount?.message}
                        </p>
                      )}
                    </CmxCardContent>
                  </CmxCard>

                  {!NEW_ORDER_PROMO_GIFT_DISABLED && (
                    <CmxCard ref={couponCardRef} className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                      <CmxButton
                        type="button"
                        variant="ghost"
                        onClick={() => setCouponOpen(!couponOpen)}
                        aria-expanded={showCouponContent}
                        className={`h-auto w-full justify-between rounded-none px-4 py-3 text-sm font-medium text-slate-900 ${isRTL ? 'flex-row-reverse' : ''}`}
                      >
                        <span className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          {t('coupons.title')}
                          {appliedBadgeCount > 0 && <Badge variant="secondary" className="text-xs">{appliedBadgeCount}</Badge>}
                        </span>
                        {showCouponContent ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </CmxButton>
                      {showCouponContent && (
                        <CmxCardContent className="space-y-3 border-t">
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
                                <CmxButton type="button" size="sm" onClick={handleValidatePromoCode} disabled={!promoCode?.trim() || promoCodeValidating}>
                                  {promoCodeValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('promoCode.apply')}
                                </CmxButton>
                              </div>
                              {promoCodeResult && !promoCodeResult.isValid && <p className="text-xs text-red-600">{promoCodeResult.error}</p>}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                              <span className="text-sm font-medium text-green-900">{appliedPromoCode.code} -{currencyCode} {formatAmount(appliedPromoCode.discount)}</span>
                              <CmxButton type="button" variant="ghost" size="sm" onClick={handleClearPromoCode}>{t('promoCode.remove')}</CmxButton>
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
                                    />
                                  )}
                                />
                                <CmxButton type="button" size="sm" variant="secondary" onClick={handleFetchGiftCardDetails} disabled={!giftCardNumber?.trim() || giftCardValidating || (pinRequired && !giftCardPin.trim())}>
                                  {giftCardValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : t('giftCard.fetch')}
                                </CmxButton>
                              </div>
                              {pinRequired && (
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
                              )}
                              {giftCardResult && !giftCardResult.isValid && <p className="text-xs text-red-600">{resolveGiftCardError(giftCardResult)}</p>}
                              {giftCardDetails && (
                                <div className="space-y-2 rounded-xl border border-purple-200 bg-purple-50 p-3">
                                  <p className="text-xs text-slate-600">{t('giftCard.balance')}: {currencyCode} {formatAmount(giftCardDetails.balance)}</p>
                                  <Controller
                                    name="giftCardAmount"
                                    control={control}
                                    render={({ field }) => (
                                      <CmxInput
                                        {...field}
                                        type="number"
                                        label={t('giftCard.applyAmount')}
                                        value={field.value ?? ''}
                                        dir="ltr"
                                        placeholder={t('giftCard.amountPlaceholder')}
                                        onChange={(event) => field.onChange(Number.parseFloat(event.target.value) || 0)}
                                      />
                                    )}
                                  />
                                  <CmxButton type="button" size="sm" variant="secondary" onClick={handleApplyGiftCard} disabled={!giftCardAmount || giftCardAmount <= 0}>
                                    {t('giftCard.applyAmount')}
                                  </CmxButton>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50 px-3 py-2">
                              <span className="text-sm font-medium text-purple-900">{appliedGiftCard.number} -{currencyCode} {formatAmount(appliedGiftCard.amount)}</span>
                              <CmxButton type="button" variant="ghost" size="sm" onClick={handleClearGiftCard}>{t('giftCard.remove')}</CmxButton>
                            </div>
                          )}
                        </CmxCardContent>
                      )}
                    </CmxCard>
                  )}

                  <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                    <CmxButton
                      type="button"
                      variant="ghost"
                      onClick={() => setTaxPanelOpen(!taxPanelOpen)}
                      aria-expanded={taxPanelOpen}
                      className={`h-auto w-full justify-between rounded-none px-4 py-3 text-sm font-medium text-slate-700 ${isRTL ? 'flex-row-reverse' : ''}`}
                    >
                      <span className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        {t('tax.listTitle')}
                        {profilesTaxAmount > 0 && <Badge variant="secondary" className="text-xs">{currencyCode} {formatAmount(profilesTaxAmount)}</Badge>}
                      </span>
                      {taxPanelOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </CmxButton>
                    {taxPanelOpen && (
                      <CmxCardContent className="space-y-2 border-t">
                        {displayTaxBreakdown.length === 0 ? (
                          <p className="text-xs text-slate-500">{t('tax.noProfiles')}</p>
                        ) : (
                          displayTaxBreakdown.map((entry, index) => (
                            <div key={entry.profileId ?? `${entry.taxType}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-slate-700">{isRTL ? (entry.label2 || entry.label) : entry.label}</p>
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
                      </CmxCardContent>
                    )}
                  </CmxCard>

                  {customerType === 'b2b' && customerId && (
                    <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                      <CmxCardHeader className="border-b border-slate-100 pb-2">
                        <CmxCardTitle className="text-sm">{t('b2b.title') || 'B2B Details'}</CmxCardTitle>
                      </CmxCardHeader>
                      <CmxCardContent className="space-y-3">
                        <B2BContractsSelect customerId={customerId} control={control} isRTL={isRTL} />
                        <div className="grid gap-3 md:grid-cols-2">
                          <Controller
                            name="costCenterCode"
                            control={control}
                            render={({ field }) => (
                              <CmxInput {...field} label={t('b2b.costCenter') || 'Cost Center'} dir="ltr" placeholder={t('b2b.costCenterPlaceholder') || 'Optional'} />
                            )}
                          />
                          <Controller
                            name="poNumber"
                            control={control}
                            render={({ field }) => (
                              <CmxInput {...field} label={t('b2b.poNumber') || 'PO Number'} dir="ltr" placeholder={t('b2b.poNumberPlaceholder') || 'Optional'} />
                            )}
                          />
                        </div>
                        {serverTotals?.creditLimit?.creditLimit && serverTotals.creditLimit.creditLimit > 0 && (
                          <div ref={creditLimitCardRef} className={`rounded-xl border p-3 ${serverTotals.creditLimit.wouldExceed ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
                            <p className={`text-sm font-medium text-slate-900 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <CircleAlert className="h-4 w-4 text-amber-600" />
                              {t('b2b.creditLimit') || 'Credit Limit'}
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              {t('b2b.creditUsed') || 'Used'}: {currencyCode} {formatAmount(serverTotals.creditLimit.currentBalance)} • {t('b2b.creditAvailable') || 'Available'}: {currencyCode} {formatAmount(serverTotals.creditLimit.available)}
                            </p>
                            {serverTotals.creditLimit.wouldExceed && serverTotals.creditLimit.mode === 'warn' && (
                              <div className="mt-2">
                                <CmxCheckbox
                                  ref={creditLimitOverrideRef}
                                  checked={creditLimitOverride}
                                  onChange={(event) => setCreditLimitOverride(event.target.checked)}
                                  label={t('b2b.creditOverrideConfirm') || 'I confirm override of credit limit'}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </CmxCardContent>
                    </CmxCard>
                  )}

                  <div className="space-y-1">
                    <div className={`flex items-center justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <label htmlFor="v4-payment-notes" className="block text-sm font-medium text-slate-900">
                        {t('paymentNotes') || 'Payment notes'}
                      </label>
                      <CmxButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPaymentNotesDialogOpen(true)}
                      >
                        <Maximize2 className="h-4 w-4" />
                      </CmxButton>
                    </div>
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
                          rows={1}
                          className="min-h-10 resize-none"
                          placeholder={t('paymentNotesPlaceholder') || 'Optional payment-related notes...'}
                        />
                      )}
                    />
                  </div>

                  <CmxCard className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
                    <CmxCardHeader className="border-b border-slate-100 pb-2">
                      <CmxCardTitle className="text-sm">{t('summary.title')}</CmxCardTitle>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-1">
                      <SummaryRow label={t('summary.subtotal')} value={`${currencyCode} ${formatAmount(totals.subtotal)}`} loading={totalsLoading} />
                      {(totals.autoRuleDiscount ?? 0) > 0 && <SummaryRow label={t('summary.rulesDiscount')} value={`−${currencyCode} ${formatAmount(totals.autoRuleDiscount ?? 0)}`} loading={totalsLoading} negative />}
                      {totals.manualDiscount > 0 && <SummaryRow label={t('summary.manualDiscount')} value={`−${currencyCode} ${formatAmount(totals.manualDiscount)}`} loading={totalsLoading} negative />}
                      {totals.promoDiscount > 0 && <SummaryRow label={t('summary.promoDiscount')} value={`−${currencyCode} ${formatAmount(totals.promoDiscount)}`} loading={totalsLoading} negative />}
                      <SummaryRow label={`VAT (${totals.vatTaxPercent.toFixed(0)}%)`} value={`${currencyCode} ${formatAmount(totals.vatValue)}`} loading={totalsLoading} />
                      {(totals.taxAmount ?? 0) > 0 && <SummaryRow label={t('summary.taxAmount')} value={`${currencyCode} ${formatAmount(totals.taxAmount ?? 0)}`} loading={totalsLoading} />}
                      {totals.giftCardApplied > 0 && <SummaryRow label={t('summary.giftCardApplied')} value={`−${currencyCode} ${formatAmount(totals.giftCardApplied)}`} loading={totalsLoading} negative />}
                      <SummaryRow label={t('summary.totalAmount')} value={`${currencyCode} ${formatAmount(saleTotal)}`} loading={totalsLoading} bold />
                      <div className="mt-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2">
                        <SummaryRow label={t('summary.paidAmount') || 'Pay now'} value={`${currencyCode} ${formatAmount(payNowAmount)}`} />
                      </div>
                      {cashDrawerRequired && (
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
                                {selectedCashDrawerChoice
                                  ? t('cashDrawer.boundHint')
                                  : cashDrawerBlockingMessage}
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
                              {selectedCashDrawerChoice
                                ? t('cashDrawer.boundBadge')
                                : t('cashDrawer.pendingBadge')}
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
                      )}
                      {customerCreditAmount > 0 && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                          <SummaryRow label={t('customerCredits.title')} value={`${currencyCode} ${formatAmount(customerCreditAmount)}`} />
                        </div>
                      )}
                      {settledNowAmount > 0 && <SummaryRow label={t('summary.settledNow')} value={`${currencyCode} ${formatAmount(settledNowAmount)}`} />}
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                        <SummaryRow label={t('summary.remainingBalance') || 'Remaining balance'} value={`${currencyCode} ${formatAmount(remainingBalance)}`} negative={remainingBalance > 0} />
                      </div>
                    </CmxCardContent>
                  </CmxCard>
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
                    type={submitHasBlockingIssues ? 'button' : 'submit'}
                    loading={loading}
                    disabled={submitBusy}
                    onClick={submitHasBlockingIssues ? handleBlockedSubmitAttempt : undefined}
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
