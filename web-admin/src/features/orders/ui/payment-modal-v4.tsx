/**
 * Payment Modal V4
 * Touch-optimized payment modal with method rail, keypad workspace, and summary rail.
 */

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  X, CreditCard, Banknote, Package, FileText, CheckSquare,
  Tag, Loader2, ChevronDown, ChevronUp,
  Eye, EyeOff, Trash2,
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
import { CmxConfirmDialog, cmxMessage } from '@ui/feedback';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { NEW_ORDER_PROMO_GIFT_DISABLED } from '@/lib/constants/order-checkout-flags';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import type { Control } from 'react-hook-form';
import type { PaymentMethodCode } from '@/lib/constants/order-types';
import {
  applyKeypadInput,
  deriveOutstandingPolicy,
  formatDecimalDraft,
  parseDecimalDraft,
  sanitizeDecimalDraft,
  syncDiscountFromPercent,
  syncDiscountPercentFromAmount,
  type PaymentKeypadKey,
} from './payment-modal-v4.utils';

// Cmx component imports
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton, CmxCheckbox } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { CmxTextarea } from '@ui/primitives';
import { CmxSwitch } from '@ui/primitives';
import { CmxSkeleton } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
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
type CheckoutMethodOption = {
  id: string;
  payment_method_code: string;
  payment_nature: string;
  gateway_code: string | null;
  display_name: string;
  display_name2: string | null;
  requires_cash_drawer: boolean;
  requires_terminal: boolean;
  requires_reference: boolean;
  allowed_in_pos: boolean;
  allowed_for_pay_now?: boolean | null;
  allowed_for_pay_on_collection?: boolean | null;
  allowed_for_invoice_payment?: boolean | null;
  display_order?: number | null;
};

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
      paymentMethod: isRetailOnlyOrder ? PAYMENT_METHODS.CASH : PAYMENT_METHODS.PAY_ON_COLLECTION,
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
      outstandingPolicy: isRetailOnlyOrder ? 'NONE' : 'PAY_ON_COLLECTION',
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
  const [couponOpen, setCouponOpen]     = useState(true);
  const [taxPanelOpen, setTaxPanelOpen] = useState(true);

  // Tax state
  const [taxRate, setTaxRate] = useState<number>(0.06);

  type TaxProfileEntry = { id: string; name: string; name2: string | null; tax_type: string; rate: number; enabled: boolean };
  const [taxProfileEntries, setTaxProfileEntries] = useState<TaxProfileEntry[]>([]);

  const isImmediatePayment =
    paymentMethod === PAYMENT_METHODS.CASH ||
    paymentMethod === PAYMENT_METHODS.CARD ||
    paymentMethod === PAYMENT_METHODS.CHECK ||
    paymentMethod === PAYMENT_METHODS.BANK_TRANSFER ||
    paymentMethod === PAYMENT_METHODS.MOBILE_PAYMENT;

  const [creditLimitOverride, setCreditLimitOverride] = useState(false);
  const [activeLegIndex, setActiveLegIndex] = useState(0);
  const [isDirtySinceOpen, setIsDirtySinceOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const [paymentLegs, setPaymentLegs] = useState<PaymentLeg[]>([
    { method: PAYMENT_METHODS.CASH as PaymentMethodCode, amount: 0 },
  ]);

  const [serverTotals, setServerTotals] = useState<{
    subtotal: number;
    manualDiscount: number;
    autoRuleDiscount: number;
    promoDiscount: number;
    afterDiscounts: number;
    vatValue: number;
    giftCardApplied: number;
    finalTotal: number;
    vatTaxPercent: number;
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
  const pinInputRef  = useRef<HTMLInputElement | null>(null);
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
    enabled: open && isImmediatePayment,
    staleTime: 5 * 60 * 1000,
  });

  const { data: checkoutMethods = [], isLoading: checkoutMethodsLoading } = useQuery<CheckoutMethodOption[]>({
    queryKey: ['checkout-options', tenantOrgId, branchId ?? '', total],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set('branchId', branchId);
      params.set('amount', String(total));
      const res = await fetch(`/api/v1/orders/checkout-options?${params.toString()}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as CheckoutMethodOption[];
    },
    enabled: open,
    staleTime: 60_000,
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
          vatValue: d.vatValue,
          giftCardApplied: d.giftCardApplied,
          finalTotal: d.finalTotal,
          vatTaxPercent: d.vatTaxPercent ?? 0,
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
  }, [open, items, tenantOrgId, branchId, customerId, isExpress, percentDiscount, amountDiscount, appliedPromoCode?.code, appliedGiftCard?.number, appliedGiftCard?.amount, appliedGiftCard?.id, csrfToken, t]);

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
        paymentMethod: isRetailOnlyOrder ? PAYMENT_METHODS.CASH : PAYMENT_METHODS.PAY_ON_COLLECTION,
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
        outstandingPolicy: isRetailOnlyOrder ? 'NONE' : 'PAY_ON_COLLECTION',
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
      setCouponOpen(true);
      setTaxPanelOpen(true);
      setCreditLimitOverride(false);
      setActiveLegIndex(0);
      setAmountDiscountFocused(false);
      setAmountDiscountDraft('');
      setIsDirtySinceOpen(false);
      setConfirmCloseOpen(false);
      const initialMethod = (isRetailOnlyOrder ? PAYMENT_METHODS.CASH : PAYMENT_METHODS.PAY_ON_COLLECTION) as PaymentMethodCode;
      setPaymentLegs([{ method: initialMethod, amount: 0 }]);
      setTaxProfileEntries([]);
    }
  }, [open, reset, isRetailOnlyOrder, initialPaymentNotes]);

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

  const profilesTaxAmount = useMemo(
    () => parseFloat(
      taxProfileEntries
        .filter(e => e.enabled)
        .reduce((sum, e) => sum + afterDiscountsForTax * (e.rate / 100), 0)
        .toFixed(decimalPlaces)
    ),
    [taxProfileEntries, afterDiscountsForTax, decimalPlaces]
  );

  const totals = useMemo(() => {
    if (serverTotals) {
      const additionalTaxAmount = profilesTaxAmount;
      const clientGiftCard  = NEW_ORDER_PROMO_GIFT_DISABLED ? 0 : (appliedGiftCard?.amount || 0);
      const serverGiftCard  = serverTotals.giftCardApplied || 0;
      const pendingGiftCard = Math.max(0, clientGiftCard - serverGiftCard);
      const finalTotalWithExtra = Math.max(0, serverTotals.finalTotal + additionalTaxAmount - pendingGiftCard);
      return {
        ...serverTotals,
        taxRate: 0,
        taxAmount: additionalTaxAmount,
        giftCardApplied: serverGiftCard + pendingGiftCard,
        finalTotal: finalTotalWithExtra,
        totalSavings: serverTotals.subtotal + serverTotals.vatValue - finalTotalWithExtra,
      };
    }
    const subtotal = total;
    const manualDiscount =
      percentDiscount > 0
        ? Math.min((subtotal * percentDiscount) / 100, subtotal)
        : Math.min(amountDiscount, subtotal);
    const promoDiscount  = NEW_ORDER_PROMO_GIFT_DISABLED ? 0 : (appliedPromoCode?.discount || 0);
    const afterDiscounts = Math.max(0, subtotal - manualDiscount - promoDiscount);
    const taxAmount      = profilesTaxAmount;
    const afterTax       = afterDiscounts + taxAmount;
    const vatValue       = parseFloat((afterTax * taxRate).toFixed(decimalPlaces));
    const giftCardApplied = NEW_ORDER_PROMO_GIFT_DISABLED ? 0 : (appliedGiftCard?.amount || 0);
    const finalTotal     = Math.max(0, afterTax + vatValue - giftCardApplied);
    return {
      subtotal,
      manualDiscount,
      autoRuleDiscount: 0,
      promoDiscount,
      afterDiscounts,
      taxRate: 0,
      taxAmount,
      vatTaxPercent: taxRate * 100,
      vatValue,
      giftCardApplied,
      finalTotal,
      totalSavings: subtotal + taxAmount + vatValue - finalTotal,
    };
  }, [serverTotals, total, percentDiscount, amountDiscount, appliedPromoCode, appliedGiftCard, taxRate, profilesTaxAmount, decimalPlaces]);

  const legSum = useMemo(
    () => paymentLegs.reduce((s, l) => s + (l.amount || 0), 0),
    [paymentLegs]
  );

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

  const fallbackMethodCodes = useMemo(
    () => [
      PAYMENT_METHODS.PAY_ON_COLLECTION,
      PAYMENT_METHODS.CASH,
      PAYMENT_METHODS.CARD,
      PAYMENT_METHODS.CHECK,
      PAYMENT_METHODS.BANK_TRANSFER,
      PAYMENT_METHODS.MOBILE_PAYMENT,
      PAYMENT_METHODS.INVOICE,
    ],
    []
  );

  const visibleMethodCodes = useMemo(() => {
    const codes = checkoutMethods.length === 0
      ? fallbackMethodCodes
      : checkoutMethods.map((method) => method.payment_method_code as PaymentMethodCode);

    return codes.filter((code) => {
      if (!isRetailOnlyOrder) return true;
      return code !== PAYMENT_METHODS.PAY_ON_COLLECTION && code !== PAYMENT_METHODS.INVOICE;
    });
  }, [checkoutMethods, fallbackMethodCodes, isRetailOnlyOrder]);

  // Method button handler — deferred methods clear legs; immediate methods ADD a new leg
  // pre-filled with the remaining outstanding amount (or update the first zero-amount placeholder).
  const handleMethodSelect = useCallback(
    (code: PaymentMethodCode) => {
      setIsDirtySinceOpen(true);
      setValue('paymentMethod', code);
      const isImmediate = (IMMEDIATE_METHOD_CODES as readonly string[]).includes(code);
      if (!isImmediate) {
        setValue(
          'outstandingPolicy',
          code === PAYMENT_METHODS.INVOICE ? 'CREDIT_INVOICE' : 'PAY_ON_COLLECTION',
          { shouldDirty: true }
        );
        setPaymentLegs([{ method: code, amount: 0 }]);
        setActiveLegIndex(0);
        return;
      }
      setPaymentLegs((prev) => {
        if (prev.length === 1 && (prev[0].amount ?? 0) === 0) {
          // First leg placeholder — fill it with the full outstanding amount
          return [{ ...prev[0], method: code, amount: totals.finalTotal }];
        }
        const currentSum = prev.reduce((s, l) => s + (l.amount || 0), 0);
        const remaining = parseFloat(
          Math.max(0, totals.finalTotal - currentSum).toFixed(decimalPlaces)
        );
        return [...prev, { method: code, amount: remaining }];
      });
      setActiveLegIndex((prev) => Math.max(prev, paymentLegs.length === 0 ? 0 : paymentLegs.length));
      // Scroll to the payment legs section
      setTimeout(() => legsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    },
    [setValue, totals.finalTotal, decimalPlaces, IMMEDIATE_METHOD_CODES, paymentLegs.length]
  );

  const updateLeg = useCallback(<K extends keyof PaymentLeg>(idx: number, key: K, value: PaymentLeg[K]) => {
    setIsDirtySinceOpen(true);
    setPaymentLegs((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [key]: value };
      return updated;
    });
  }, []);

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

  // Derived totals — declared once here so `submitButtonLabel` (just below)
  // and the JSX render block (further down) reference the same values without
  // duplicate-and-drift, and without `const`/`let` use-before-declaration.
  const immediateLegs = paymentLegs.filter((leg) =>
    (IMMEDIATE_METHOD_CODES as readonly string[]).includes(leg.method)
  );
  const payNowAmount = immediateLegs.reduce((sum, leg) => sum + (leg.amount || 0), 0);
  const remainingBalance = Math.max(0, totals.finalTotal - payNowAmount);

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
        const defaultAmount = Math.min(result.availableBalance, totals.finalTotal);
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
    const maxAmount   = Math.min(giftCardDetails.balance, totals.finalTotal);
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

    for (const leg of immediateLegs) {
      if (!leg.amount || leg.amount <= 0) {
        cmxMessage.error(t('splitPayment.validation.amountMustBePositive'));
        return;
      }
      if (leg.method === PAYMENT_METHODS.CHECK && !leg.checkNumber?.trim()) {
        cmxMessage.error(t('splitPayment.validation.checkNumberRequired'));
        return;
      }
    }

    if (remainingBalance > 0.001 && effectiveOutstandingPolicy === 'NONE') {
      cmxMessage.error(t('remainder.validation.required'));
      return;
    }

    const payload = {
      amountToCharge: payNowAmount,
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
        finalTotal: totals.finalTotal,
      },
      ...(currencyConfig && {
        currencyCode: currencyConfig.currencyCode,
        currencyExRate: currencyConfig.currencyExRate,
      }),
      outstandingPolicy: effectiveOutstandingPolicy,
      creditLimitOverride: creditLimitOverride || undefined,
      ...(immediateLegs.length > 0 && { paymentLegs: immediateLegs }),
    };
    const parsed = newOrderPaymentPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      cmxMessage.error(first ? `${first.path.join('.')}: ${first.message}` : t('errors.invalidAmount'));
      return;
    }
    if (isImmediatePayment && payNowAmount <= 0 && !showDeferredExplanation) {
      cmxMessage.error(t('partialPayment.validation.amountMustBePositive'));
      return;
    }
    onSubmit(submissionData, { ...parsed.data, creditLimitOverride: creditLimitOverride || undefined });
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
      default:                                return id;
    }
  };

  const showCouponContent = NEW_ORDER_PROMO_GIFT_DISABLED
    ? false
    : couponOpen || !!appliedPromoCode || !!appliedGiftCard;

  const appliedBadgeCount = (appliedPromoCode ? 1 : 0) + (appliedGiftCard ? 1 : 0);
  const activeLeg = paymentLegs[activeLegIndex] ?? null;
  // immediateLegs / payNowAmount / remainingBalance are declared above (near
  // submitButtonLabel) to fix use-before-declaration. Do not redeclare here.
  const effectiveOutstandingPolicy = deriveOutstandingPolicy(
    payNowAmount,
    totals.finalTotal,
    (outstandingPolicy as OutstandingPolicy | undefined) ?? 'PAY_ON_COLLECTION'
  );
  const isDeferredOnlySelection =
    paymentMethod === PAYMENT_METHODS.PAY_ON_COLLECTION || paymentMethod === PAYMENT_METHODS.INVOICE;
  const showDeferredExplanation = isDeferredOnlySelection && payNowAmount <= 0;

  const submitButtonLabel = useMemo(() => {
    const epsilon = Math.pow(10, -(decimalPlaces + 1));
    if (remainingBalance > epsilon) {
      return t('actions.submitWithUnpaid', {
        submit: t('actions.submit'),
        currency: currencyCode,
        payNow: formatAmount(payNowAmount),
        unpaid: t('summary.notPaidBalance'),
        remaining: formatAmount(remainingBalance),
      });
    }
    return t('actions.submitChargeOnly', {
      submit: t('actions.submit'),
      currency: currencyCode,
      amount: formatAmount(payNowAmount > 0 ? payNowAmount : totals.finalTotal),
    });
  }, [t, currencyCode, decimalPlaces, remainingBalance, payNowAmount, totals.finalTotal]);

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

  const handleKeypadPress = useCallback((key: PaymentKeypadKey) => {
    if (!activeLeg || !isImmediatePayment) return;
    const nextDraft = applyKeypadInput(
      formatDecimalDraft(activeLeg.amount ?? 0, decimalPlaces),
      key,
      decimalPlaces
    );
    const nextAmount = parseDecimalDraft(nextDraft);
    updateLeg(activeLegIndex, 'amount', Math.max(0, Math.min(totals.finalTotal, nextAmount)));
  }, [activeLeg, activeLegIndex, decimalPlaces, isImmediatePayment, totals.finalTotal, updateLeg]);

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
          className="mx-4 h-[92vh] w-[calc(100vw-2rem)] max-w-[1380px] overflow-hidden rounded-2xl p-0"
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

            <form onSubmit={handleSubmit(onSubmitForm)} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-auto bg-[rgb(var(--cmx-background-rgb,248_250_252))] p-4">
              <div className="grid min-h-full gap-4 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
                <div className="space-y-4">
                  <CmxCard className="h-full">
                    <CmxCardHeader className="pb-3">
                      <CmxCardTitle className="text-sm">{t('methods.title')}</CmxCardTitle>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-3">
                      {checkoutMethodsLoading ? (
                        <div className="space-y-2">
                          <CmxSkeleton className="h-14 w-full" />
                          <CmxSkeleton className="h-14 w-full" />
                          <CmxSkeleton className="h-14 w-full" />
                        </div>
                      ) : (
                        visibleMethodCodes.map((code) => {
                          const option = checkoutMethods.find((item) => item.payment_method_code === code);
                          const selected = paymentMethod === code;
                          const isDeferred = code === PAYMENT_METHODS.PAY_ON_COLLECTION || code === PAYMENT_METHODS.INVOICE;
                          return (
                            <CmxButton
                              key={code}
                              type="button"
                              variant={selected ? 'primary' : 'outline'}
                              size="lg"
                              onClick={() => handleMethodSelect(code)}
                              className={`h-auto w-full justify-start rounded-2xl px-4 py-4 ${selected ? '' : 'bg-white'} ${isRTL ? 'flex-row-reverse' : ''}`}
                            >
                              <span className={`flex w-full items-start gap-3 ${isRTL ? 'flex-row-reverse text-right' : 'text-left'}`}>
                                <span className="mt-0.5">{getPaymentIcon(code)}</span>
                                <span className="flex min-w-0 flex-1 flex-col">
                                  <span className="text-sm font-semibold">{getPaymentLabel(code)}</span>
                                  <span className={`text-xs ${selected ? 'text-white/90' : 'text-slate-500'}`}>
                                    {isDeferred
                                      ? (t('remainder.deferredHint') || 'Deferred settlement')
                                      : option?.requires_cash_drawer
                                        ? (t('methods.touchHintCashDrawer') || 'Cash drawer / immediate collection')
                                        : (t('methods.touchHintImmediate') || 'Immediate settlement')}
                                  </span>
                                </span>
                              </span>
                            </CmxButton>
                          );
                        })
                      )}
                    </CmxCardContent>
                  </CmxCard>

                  <CmxCard ref={legsCardRef}>
                    <CmxCardHeader className="pb-2">
                      <CmxCardTitle className="text-sm">{t('splitPayment.title')}</CmxCardTitle>
                    </CmxCardHeader>
                    <CmxCardContent className="space-y-2">
                      {immediateLegs.length === 0 ? (
                        <p className="text-xs text-slate-500">{t('workspace.addSplitHint') || 'Select an immediate method to start collecting payment.'}</p>
                      ) : (
                        immediateLegs.map((leg, idx) => (
                          <CmxButton
                            key={`payment-leg-summary-${idx}`}
                            type="button"
                            variant="ghost"
                            onClick={() => setActiveLegIndex(idx)}
                            className={`h-auto w-full justify-between rounded-2xl border px-3 py-3 text-sm transition ${
                              activeLegIndex === idx
                                ? 'border-cyan-500 bg-cyan-50 text-cyan-900'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {getPaymentIcon(leg.method)}
                              <span className="font-medium">{getPaymentLabel(leg.method)}</span>
                            </span>
                            <span className="tabular-nums font-semibold">{currencyCode} {formatAmount(leg.amount || 0)}</span>
                          </CmxButton>
                        ))
                      )}
                      {immediateLegs.length > 1 && activeLegIndex < immediateLegs.length && (
                        <CmxButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsDirtySinceOpen(true);
                            setPaymentLegs((prev) => prev.filter((_, idx) => idx !== activeLegIndex));
                            setActiveLegIndex((prev) => Math.max(0, prev - 1));
                          }}
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
                  <CmxCard className="border-cyan-100 bg-gradient-to-br from-slate-50 via-white to-cyan-50">
                    <CmxCardContent className="pt-5">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('workspace.remaining') || 'Remaining'}</p>
                          <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{currencyCode} {formatAmount(remainingBalance)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('workspace.change') || 'Change'}</p>
                          <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{currencyCode} 0.000</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('workspace.totalDue') || 'Total Due'}</p>
                          <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{currencyCode} {formatAmount(totals.finalTotal)}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <Badge variant="secondary" className={remainingBalance > 0.001 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}>
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
                      <CmxCard>
                        <CmxCardHeader className="pb-2">
                          <CmxCardTitle className="text-sm">
                            {t('workspace.editingAmount') || 'Editing amount'}
                            {activeLeg ? ` • ${getPaymentLabel(activeLeg.method)}` : ''}
                          </CmxCardTitle>
                        </CmxCardHeader>
                        <CmxCardContent className="space-y-3">
                          <CmxInput
                            label={t('splitPayment.amount')}
                            value={activeLeg ? formatDecimalDraft(activeLeg.amount ?? 0, decimalPlaces) : ''}
                            dir="ltr"
                            onChange={(event) => {
                              if (!activeLeg) return;
                              const nextDraft = sanitizeDecimalDraft(event.target.value, decimalPlaces);
                              updateLeg(activeLegIndex, 'amount', parseDecimalDraft(nextDraft));
                            }}
                            placeholder={formatAmount(0)}
                          />
                          <p className="text-xs text-slate-500">{t('workspace.keypadHint') || 'Use the keypad for fast touch entry, or type directly into the amount field.'}</p>
                        </CmxCardContent>
                      </CmxCard>

                      <CmxCard>
                        <CmxCardContent className="pt-4">
                          <div className="grid grid-cols-4 gap-2">
                            {(['1', '2', '3', '+10', '4', '5', '6', '+20', '7', '8', '9', '+50', '.', '0', 'backspace'] as PaymentKeypadKey[]).map((key) => (
                              <CmxButton
                                key={key}
                                type="button"
                                variant={key.startsWith('+') ? 'secondary' : key === 'backspace' ? 'outline' : 'outline'}
                                size="lg"
                                onClick={() => handleKeypadPress(key)}
                                className={`h-20 rounded-2xl text-2xl font-semibold ${key === 'backspace' ? 'col-span-2' : ''}`}
                              >
                                {key === 'backspace' ? '⌫' : key}
                              </CmxButton>
                            ))}
                          </div>
                        </CmxCardContent>
                      </CmxCard>

                      {activeLeg && (
                        <CmxCard>
                          <CmxCardHeader className="pb-2">
                            <CmxCardTitle className="text-sm">{t('splitPayment.currentLeg') || 'Current leg details'}</CmxCardTitle>
                          </CmxCardHeader>
                          <CmxCardContent className="space-y-3">
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
                                  label={`${t('splitPayment.checkNumber')} *`}
                                  value={activeLeg.checkNumber ?? ''}
                                  dir="ltr"
                                  placeholder={t('checkNumber.placeholder')}
                                  onChange={(event) => updateLeg(activeLegIndex, 'checkNumber', event.target.value || undefined)}
                                />
                                <CmxInput
                                  label={t('splitPayment.checkBankName')}
                                  value={activeLeg.checkBank ?? ''}
                                  dir="ltr"
                                  placeholder="—"
                                  onChange={(event) => updateLeg(activeLegIndex, 'checkBank', event.target.value || undefined)}
                                />
                                <CmxInput
                                  type="date"
                                  label={t('splitPayment.checkDueDate')}
                                  value={activeLeg.checkDate ?? ''}
                                  onChange={(event) => updateLeg(activeLegIndex, 'checkDate', event.target.value || undefined)}
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
                          </CmxCardContent>
                        </CmxCard>
                      )}
                    </>
                  )}
                </div>

                <div className="space-y-4">
                  <CmxCard>
                    <CmxCardHeader className="pb-2">
                      <CmxCardTitle className="text-sm">{t('remainder.title') || 'Remaining balance policy'}</CmxCardTitle>
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
                            type="button"
                            variant={effectiveOutstandingPolicy === policy ? 'primary' : 'outline'}
                            onClick={() => handleOutstandingPolicyChange(policy)}
                            disabled={policy === 'NONE' && remainingBalance > 0.001}
                            className="h-auto min-h-[64px] flex-col gap-1 rounded-2xl px-3 py-3 text-center"
                          >
                            <span className="text-sm font-semibold">{label}</span>
                            {policy !== 'NONE' && <span className="text-[11px] opacity-80">{t('remainder.deferredHint') || 'Deferred settlement'}</span>}
                          </CmxButton>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">{t('remainder.help') || 'When the pay-now amount is less than the total, choose how the remaining balance should be handled.'}</p>
                    </CmxCardContent>
                  </CmxCard>

                  <CmxCard>
                    <CmxCardHeader className="pb-2">
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
                    <CmxCard>
                      <CmxButton
                        type="button"
                        variant="ghost"
                        onClick={() => setCouponOpen(!couponOpen)}
                        aria-expanded={showCouponContent}
                        className={`h-auto w-full justify-between rounded-none px-4 py-3 text-sm font-medium text-slate-900 ${isRTL ? 'flex-row-reverse' : ''}`}
                      >
                        <span className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          {t('haveCoupon')}
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
                                    onChange={(event) => {
                                      setGiftCardPin(event.target.value);
                                      setPinFieldError(null);
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

                  <CmxCard>
                    <CmxButton
                      type="button"
                      variant="ghost"
                      onClick={() => setTaxPanelOpen(!taxPanelOpen)}
                      aria-expanded={taxPanelOpen}
                      className={`h-auto w-full justify-between rounded-none px-4 py-3 text-sm font-medium text-slate-700 ${isRTL ? 'flex-row-reverse' : ''}`}
                    >
                      <span className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        {t('tax.panelTitle')}
                        {profilesTaxAmount > 0 && <Badge variant="secondary" className="text-xs">{currencyCode} {formatAmount(profilesTaxAmount)}</Badge>}
                      </span>
                      {taxPanelOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </CmxButton>
                    {taxPanelOpen && (
                      <CmxCardContent className="space-y-2 border-t">
                        {taxProfileEntries.length === 0 ? (
                          <p className="text-xs text-slate-500">{t('tax.noProfiles')}</p>
                        ) : (
                          taxProfileEntries.map((entry, index) => (
                            <div key={entry.id} className="flex items-center gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-slate-700">{isRTL ? (entry.name2 || entry.name) : entry.name}</p>
                                <p className="text-xs text-slate-400">{entry.tax_type}</p>
                              </div>
                              <CmxInput
                                type="number"
                                value={entry.rate}
                                dir="ltr"
                                className="w-20"
                                onChange={(event) => {
                                  const nextRate = Number.parseFloat(event.target.value) || 0;
                                  setTaxProfileEntries((prev) => {
                                    const next = [...prev];
                                    next[index] = { ...next[index], rate: nextRate };
                                    return next;
                                  });
                                }}
                              />
                            </div>
                          ))
                        )}
                      </CmxCardContent>
                    )}
                  </CmxCard>

                  {customerType === 'b2b' && customerId && (
                    <CmxCard>
                      <CmxCardHeader className="pb-2">
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
                          <div className={`rounded-xl border p-3 ${serverTotals.creditLimit.wouldExceed ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
                            <p className="text-sm font-medium text-slate-900">{t('b2b.creditLimit') || 'Credit Limit'}</p>
                            <p className="mt-1 text-xs text-slate-600">
                              {t('b2b.creditUsed') || 'Used'}: {currencyCode} {formatAmount(serverTotals.creditLimit.currentBalance)} • {t('b2b.creditAvailable') || 'Available'}: {currencyCode} {formatAmount(serverTotals.creditLimit.available)}
                            </p>
                            {serverTotals.creditLimit.wouldExceed && serverTotals.creditLimit.mode === 'warn' && (
                              <div className="mt-2">
                                <CmxCheckbox
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
                    <label htmlFor="v4-payment-notes" className="block text-sm font-medium text-slate-900">
                      {t('paymentNotes') || 'Payment notes'}
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
                          dir={isRTL ? 'rtl' : 'ltr'}
                          rows={3}
                          placeholder={t('paymentNotesPlaceholder') || 'Optional payment-related notes...'}
                        />
                      )}
                    />
                  </div>

                  <CmxCard>
                    <CmxCardHeader className="pb-2">
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
                      <SummaryRow label={t('summary.totalAmount')} value={`${currencyCode} ${formatAmount(totals.finalTotal)}`} loading={totalsLoading} bold />
                      <SummaryRow label={t('summary.paidAmount') || 'Pay now'} value={`${currencyCode} ${formatAmount(payNowAmount)}`} />
                      <SummaryRow label={t('summary.remainingBalance') || 'Remaining balance'} value={`${currencyCode} ${formatAmount(remainingBalance)}`} negative={remainingBalance > 0} />
                    </CmxCardContent>
                  </CmxCard>
                </div>
              </div>
            </div>

              <CmxDialogFooter className="flex-col items-stretch gap-2 border-t bg-white">
                <div className={`flex w-full gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <CmxButton type="button" variant="outline" onClick={closeWithGuard} className="flex-1">
                    {tCommon('cancel')}
                  </CmxButton>
                  <CmxButton
                    type="submit"
                    loading={loading}
                    disabled={
                      loading ||
                      totalsLoading ||
                      promoCodeValidating ||
                      giftCardValidating ||
                      (remainingBalance > 0.001 && effectiveOutstandingPolicy === 'NONE') ||
                      (showDeferredExplanation ? effectiveOutstandingPolicy === 'NONE' : isImmediatePayment && payNowAmount <= 0) ||
                      (serverTotals?.creditLimit?.wouldExceed && (serverTotals.creditLimit.mode !== 'warn' || !creditLimitOverride))
                    }
                    className="flex-1 font-bold"
                    size="lg"
                  >
                    {submitButtonLabel}
                  </CmxButton>
                </div>
                <p className={`w-full text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('messages.paymentMethodNote', { method: getPaymentLabel(paymentMethod || PAYMENT_METHODS.PAY_ON_COLLECTION) })}
                </p>
              </CmxDialogFooter>
            </form>
          </div>
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
