/**
 * Payment Modal V3
 * Drop-in replacement for payment-modal-enhanced-02.tsx.
 * Rebuilt on Cmx components with a card-stack layout, sticky footer, and CmxSwitch
 * for partial payment — all business logic and state are preserved verbatim from v2.
 */

'use client';

import { useState, useEffect, useMemo, useCallback, useRef, useId } from 'react';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  X, CreditCard, Banknote, Package, FileText, CheckSquare,
  Tag, Gift, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronUp,
  Eye, EyeOff, KeyRound, PlusCircle, Trash2,
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
import { newOrderPaymentPayloadSchema, type NewOrderPaymentPayload, type PaymentLeg } from '@/lib/validations/new-order-payment-schemas';
import { cmxMessage } from '@ui/feedback';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { NEW_ORDER_PROMO_GIFT_DISABLED } from '@/lib/constants/order-checkout-flags';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import type { Control } from 'react-hook-form';
import type { PaymentMethodCode } from '@/lib/constants/order-types';

// Cmx component imports
import { CmxDialog, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives';
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
interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (paymentData: PaymentFormData, payload: NewOrderPaymentPayload) => void;
  total: number;
  items: { productId: string; quantity: number; priceOverride?: number | null; servicePrefCharge?: number; packingPrefCharge?: number }[];
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
/**
 *
 * @param root0
 * @param root0.open
 * @param root0.onClose
 * @param root0.onSubmit
 * @param root0.total
 * @param root0.items
 * @param root0.isExpress
 * @param root0.tenantOrgId
 * @param root0.customerId
 * @param root0.customerType
 * @param root0.serviceCategories
 * @param root0.branchId
 * @param root0.userId
 * @param root0.isRetailOnlyOrder
 * @param root0.loading
 * @param root0.initialPaymentNotes
 */
export function PaymentModalV3({
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

  /**
   *
   */
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

  const isImmediatePayment =
    paymentMethod === PAYMENT_METHODS.CASH ||
    paymentMethod === PAYMENT_METHODS.CARD ||
    paymentMethod === PAYMENT_METHODS.CHECK ||
    paymentMethod === PAYMENT_METHODS.BANK_TRANSFER ||
    paymentMethod === PAYMENT_METHODS.MOBILE_PAYMENT;

  // Partial payment state
  const [payPartial, setPayPartial]               = useState(false);
  const [partialAmount, setPartialAmount]         = useState<number>(0);
  const [creditLimitOverride, setCreditLimitOverride] = useState(false);

  const legIdPrefix = useId();

  const [paymentLegs, setPaymentLegs] = useState<PaymentLeg[]>([
    { method: PAYMENT_METHODS.CASH as PaymentMethodCode, amount: 0 },
  ]);
  /**
   *
   */
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
      });
      setPromoCodeResult(null);
      setAppliedPromoCode(null);
      setGiftCardResult(null);
      setGiftCardDetails(null);
      setAppliedGiftCard(null);
      setCouponOpen(true);
      setTaxPanelOpen(true);
      setPayPartial(false);
      setPartialAmount(0);
      setCreditLimitOverride(false);
      setAmountDiscountFocused(false);
      setAmountDiscountDraft('');
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

  const effectiveAmountToCharge = useMemo(() => {
    if (!payPartial || !isImmediatePayment) return saleTotal;
    const clamped = Math.max(0, Math.min(saleTotal, partialAmount));
    return parseFloat(clamped.toFixed(decimalPlaces));
  }, [payPartial, isImmediatePayment, saleTotal, partialAmount, decimalPlaces]);

  const remainingAfterThisPayment = useMemo(
    () => parseFloat(Math.max(0, saleTotal - effectiveAmountToCharge).toFixed(decimalPlaces)),
    [saleTotal, effectiveAmountToCharge, decimalPlaces]
  );

  const legSum = useMemo(
    () => paymentLegs.reduce((s, l) => s + (l.amount || 0), 0),
    [paymentLegs]
  );

  const legRemaining = useMemo(
    () => parseFloat(Math.max(0, saleTotal - legSum).toFixed(decimalPlaces)),
    [saleTotal, legSum, decimalPlaces]
  );

  const legsValid = useMemo(
    () => Math.abs(legSum - saleTotal) <= 0.001,
    [legSum, saleTotal]
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

  const isMultiLeg = isImmediatePayment && paymentLegs.length > 1;

  // Method button handler — deferred methods clear legs; immediate methods ADD a new leg
  // pre-filled with the remaining outstanding amount (or update the first zero-amount placeholder).
  const handleMethodSelect = useCallback(
    (code: PaymentMethodCode) => {
      setValue('paymentMethod', code);
      const isImmediate = (IMMEDIATE_METHOD_CODES as readonly string[]).includes(code);
      if (!isImmediate) {
        setPayPartial(false);
        setPartialAmount(0);
        setPaymentLegs([{ method: code, amount: 0 }]);
        return;
      }
      setPaymentLegs((prev) => {
        if (prev.length === 1 && (prev[0].amount ?? 0) === 0) {
          // First leg placeholder — fill it with the full outstanding amount
          return [{ ...prev[0], method: code, amount: saleTotal }];
        }
        const currentSum = prev.reduce((s, l) => s + (l.amount || 0), 0);
        const remaining = parseFloat(
          Math.max(0, saleTotal - currentSum).toFixed(decimalPlaces)
        );
        return [...prev, { method: code, amount: remaining }];
      });
      // Scroll to the payment legs section
      setTimeout(() => legsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    },
    [setValue, saleTotal, decimalPlaces, IMMEDIATE_METHOD_CODES]
  );

  const updateLeg = useCallback(<K extends keyof PaymentLeg>(idx: number, key: K, value: PaymentLeg[K]) => {
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

  const submitButtonLabel = useMemo(() => {
    const epsilon = Math.pow(10, -(decimalPlaces + 1));
    if (isImmediatePayment && payPartial && remainingAfterThisPayment > epsilon) {
      return t('actions.submitWithUnpaid', {
        submit: t('actions.submit'),
        currency: currencyCode,
        payNow: formatAmount(effectiveAmountToCharge),
        unpaid: t('summary.notPaidBalance'),
        remaining: formatAmount(remainingAfterThisPayment),
      });
    }
    return t('actions.submitChargeOnly', {
      submit: t('actions.submit'),
      currency: currencyCode,
      amount: formatAmount(effectiveAmountToCharge),
    });
  }, [t, currencyCode, decimalPlaces, isImmediatePayment, payPartial, remainingAfterThisPayment, effectiveAmountToCharge]);

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

    if (isImmediatePayment && paymentLegs.length > 1) {
      if (!legsValid) { cmxMessage.error(t('splitPayment.validation.sumMismatch')); return; }
      for (const leg of paymentLegs) {
        if (!leg.amount || leg.amount <= 0) { cmxMessage.error(t('splitPayment.validation.amountMustBePositive')); return; }
        if (leg.method === PAYMENT_METHODS.CHECK && !leg.checkNumber?.trim()) {
          cmxMessage.error(t('splitPayment.validation.checkNumberRequired')); return;
        }
      }
    }

    if (totalsLoading) {
      cmxMessage.info(t('calculating'));
      return;
    }

    if (!serverTotals && items.length > 0) {
      cmxMessage.error(t('errors.invalidAmount'));
      return;
    }

    const payload = {
      amountToCharge: isMultiLeg ? legSum : effectiveAmountToCharge,
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
      ...(taxProfileEntries.some((entry) => entry.enabled) && {
        taxProfileIds: taxProfileEntries
          .filter((entry) => entry.enabled)
          .map((entry) => entry.id),
      }),
      creditLimitOverride: creditLimitOverride || undefined,
      ...(isMultiLeg && { paymentLegs }),
    };
    const parsed = newOrderPaymentPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      cmxMessage.error(first ? `${first.path.join('.')}: ${first.message}` : t('errors.invalidAmount'));
      return;
    }
    if (isImmediatePayment && (isMultiLeg ? legSum : effectiveAmountToCharge) <= 0) {
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

  if (!open) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <CmxDialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/* Modal container — flex-col so header + scrollable form + sticky footer stack */}
      <div
        ref={focusTrapRef as React.MutableRefObject<HTMLDivElement>}
        className="relative bg-[rgb(var(--cmx-background-rgb,255_255_255))] rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden ring-1 ring-[rgb(var(--cmx-border-rgb,226_232_240))]"
      >
        {/* ── A: Hero Header ─────────────────────────────────────── */}
        <CmxDialogHeader className="flex-shrink-0 flex items-center justify-between">
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <CmxDialogTitle>{t('title')}</CmxDialogTitle>
            {isExpress && (
              <Badge variant="secondary" className="text-xs">
                {t('expressLabel')}
              </Badge>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon('close')}
            className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] hover:text-[rgb(var(--cmx-foreground-rgb,15_23_42))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--cmx-primary-rgb,14_165_233))] rounded p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </CmxDialogHeader>

        {/* ── Form wraps scrollable content + sticky footer ─────── */}
        <form onSubmit={handleSubmit(onSubmitForm)} className="flex flex-col flex-1 min-h-0">
          {/* Scrollable card stack */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">

            {/* ── B: Hero Amount Card ──────────────────────────────── */}
            <CmxCard className="bg-gradient-to-br from-blue-50 to-green-50 border-blue-100">
              <CmxCardContent className="pt-4 text-center">
                {totalsLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <CmxSkeleton className="h-10 w-48" />
                    <CmxSkeleton className="h-4 w-24" />
                  </div>
                ) : (
                  <>
                    <p className="text-4xl font-bold text-gray-900 tabular-nums">
                      {currencyCode} {formatAmount(saleTotal)}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">{t('grandTotal')}</p>
                    {totals.totalSavings > 0 && (
                      <div className={`mt-2 flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span className="text-xs text-gray-400 line-through">
                          {currencyCode} {formatAmount(total)}
                        </span>
                        <span className="text-xs font-semibold text-green-600">
                          {t('savings')} {currencyCode} {formatAmount(totals.totalSavings)}
                        </span>
                      </div>
                    )}
                    {/* Outstanding / fully allocated indicator — visible from first load for immediate methods */}
                    {isImmediatePayment && legRemaining > 0.001 && (
                      <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-200">
                        <span className="text-sm font-semibold text-amber-700">
                          {t('splitPayment.outstanding')}: {currencyCode} {formatAmount(legRemaining)}
                        </span>
                      </div>
                    )}
                    {isImmediatePayment && legsValid && legSum > 0.001 && (
                      <div className="mt-2">
                        <span className="text-xs font-medium text-green-600">✓ {t('splitPayment.allocated')}</span>
                      </div>
                    )}
                  </>
                )}
              </CmxCardContent>
            </CmxCard>

            {/* ── C: Payment Method Pill Grid ──────────────────────── */}
            <CmxCard>
              <CmxCardHeader className="pb-2">
                <CmxCardTitle className="text-sm">{t('methods.title')}</CmxCardTitle>
              </CmxCardHeader>
              <CmxCardContent>
                <Controller
                  name="paymentMethod"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      {/* Primary row: CASH + CARD — clicking adds a new leg with remaining amount */}
                      <div className="grid grid-cols-2 gap-2">
                        {[PAYMENT_METHODS.CASH, PAYMENT_METHODS.CARD].map((code) => (
                          <button
                            key={code}
                            type="button"
                            aria-pressed={field.value === code}
                            onClick={() => handleMethodSelect(code as PaymentMethodCode)}
                            className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 min-h-[56px] transition-colors
                              ${field.value === code
                                ? 'border-blue-600 bg-blue-50 text-blue-700'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'}`}
                          >
                            {getPaymentIcon(code)}
                            <span className="text-xs font-medium">{getPaymentLabel(code)}</span>
                          </button>
                        ))}
                      </div>
                      {/* Secondary row: PAY_ON_COLLECTION (if not retail) + CHECK + INVOICE */}
                      <div className={`grid gap-2 ${isRetailOnlyOrder ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        {!isRetailOnlyOrder && (
                          <button
                            type="button"
                            aria-pressed={field.value === PAYMENT_METHODS.PAY_ON_COLLECTION}
                            onClick={() => handleMethodSelect(PAYMENT_METHODS.PAY_ON_COLLECTION as PaymentMethodCode)}
                            className={`min-h-[40px] flex items-center justify-center rounded-lg border px-2 py-2 text-xs font-medium transition-colors
                              ${field.value === PAYMENT_METHODS.PAY_ON_COLLECTION
                                ? 'border-blue-600 bg-blue-500 text-white'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                          >
                            {t('methods.payOnCollection')}
                          </button>
                        )}
                        {[PAYMENT_METHODS.CHECK, PAYMENT_METHODS.INVOICE].map((code) => (
                          <button
                            key={code}
                            type="button"
                            aria-pressed={field.value === code}
                            onClick={() => handleMethodSelect(code as PaymentMethodCode)}
                            className={`min-h-[40px] flex items-center justify-center rounded-lg border px-2 py-2 text-xs font-medium transition-colors
                              ${field.value === code
                                ? 'border-blue-600 bg-blue-500 text-white'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                          >
                            {getPaymentLabel(code)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                />
              </CmxCardContent>
            </CmxCard>

            {/* ── D: Check Fields Card ─────────────────────────────── */}
            {paymentMethod === PAYMENT_METHODS.CHECK && (
              <CmxCard className="border-purple-200">
                <CmxCardHeader className="pb-2">
                  <CmxCardTitle className="text-sm">{t('checkDetails') || 'Check Details'}</CmxCardTitle>
                </CmxCardHeader>
                <CmxCardContent className="grid grid-cols-2 gap-3">
                  <Controller
                    name="checkNumber"
                    control={control}
                    render={({ field }) => (
                      <CmxInput
                        {...field}
                        label={`${t('checkNumber.label')} *`}
                        dir="ltr"
                        error={errors.checkNumber?.message}
                        placeholder={t('checkNumber.placeholder')}
                      />
                    )}
                  />
                  <Controller
                    name="checkBank"
                    control={control}
                    render={({ field }) => (
                      <CmxInput
                        {...field}
                        value={field.value ?? ''}
                        label={t('checkBank.label')}
                        dir="ltr"
                        placeholder={t('checkBank.placeholder')}
                      />
                    )}
                  />
                  <div className="col-span-2">
                    <Controller
                      name="checkDate"
                      control={control}
                      render={({ field }) => (
                        <CmxInput
                          {...field}
                          value={field.value ?? ''}
                          type="date"
                          label={t('checkDate.label')}
                        />
                      )}
                    />
                  </div>
                </CmxCardContent>
              </CmxCard>
            )}

            {/* ── E: B2B Details Card ──────────────────────────────── */}
            {customerType === 'b2b' && customerId && (
              <CmxCard className="border-l-4 border-l-blue-500">
                <CmxCardHeader className="pb-2">
                  <CmxCardTitle className="text-sm">{t('b2b.title') || 'B2B Details'}</CmxCardTitle>
                </CmxCardHeader>
                <CmxCardContent className="space-y-3">
                  <B2BContractsSelect customerId={customerId} control={control} isRTL={isRTL} />
                  <div className="grid grid-cols-2 gap-3">
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

                  {/* Credit limit status */}
                  {(paymentMethod === PAYMENT_METHODS.INVOICE || paymentMethod === PAYMENT_METHODS.PAY_ON_COLLECTION) &&
                    serverTotals?.creditLimit &&
                    serverTotals.creditLimit.creditLimit > 0 && (
                      <div className={`p-3 rounded-lg border ${serverTotals.creditLimit.wouldExceed ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                        <p className="text-sm font-medium text-gray-900">{t('b2b.creditLimit') || 'Credit Limit'}</p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {t('b2b.creditUsed') || 'Used'}: {currencyCode} {formatAmount(serverTotals.creditLimit.currentBalance)} •{' '}
                          {t('b2b.creditAvailable') || 'Available'}: {currencyCode} {formatAmount(serverTotals.creditLimit.available)}
                        </p>
                        {serverTotals.creditLimit.wouldExceed && (
                          <>
                            <p className="text-xs font-medium text-amber-800 mt-1">
                              {serverTotals.creditLimit.mode === 'warn'
                                ? (t('b2b.creditExceededWarn') || 'Order exceeds available credit.')
                                : (t('b2b.creditExceeded') || 'Order total exceeds available credit. Payment will be blocked.')}
                            </p>
                            {serverTotals.creditLimit.mode === 'warn' && (
                              <label className={`flex items-center gap-2 mt-2 text-sm text-amber-900 cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={creditLimitOverride}
                                  onChange={(e) => setCreditLimitOverride(e.target.checked)}
                                  className="rounded border-amber-600"
                                />
                                {t('b2b.creditOverrideConfirm') || 'I confirm override of credit limit'}
                              </label>
                            )}
                          </>
                        )}
                      </div>
                    )}
                </CmxCardContent>
              </CmxCard>
            )}

            {/* ── F: Discount Card ─────────────────────────────────── */}
            <CmxCard>
              <CmxCardHeader className="pb-2">
                <CmxCardTitle className={`text-sm flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Tag className="w-4 h-4" />
                  {t('discount')}
                </CmxCardTitle>
              </CmxCardHeader>
              <CmxCardContent>
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {/* Percent discount */}
                  <div className="flex-1 flex items-center border border-gray-300 rounded-lg overflow-hidden">
                    <span className={`px-2 text-gray-500 text-sm bg-gray-50 border-r ${isRTL ? 'order-2 border-r-0 border-l' : ''}`}>%</span>
                    <Controller
                      name="percentDiscount"
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="number"
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                            field.onChange(value);
                            const amount = value > 0
                              ? parseFloat(((total * value) / 100).toFixed(decimalPlaces))
                              : 0;
                            setValue('amountDiscount', amount);
                          }}
                          dir="ltr"
                          className="flex-1 min-w-0 px-2 py-2 text-sm text-center border-0 focus:ring-0 outline-none"
                          placeholder={t('manualDiscount.percentPlaceholder')}
                        />
                      )}
                    />
                  </div>

                  <span className="text-xs text-gray-400 font-medium">OR</span>

                  {/* Amount discount */}
                  <div className="flex-1 flex items-center border border-gray-300 rounded-lg overflow-hidden">
                    <span className={`px-2 text-gray-500 text-sm bg-gray-50 border-r ${isRTL ? 'order-2 border-r-0 border-l' : ''}`}>{currencyCode}</span>
                    <Controller
                      name="amountDiscount"
                      control={control}
                      render={({ field }) => (
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={
                            amountDiscountFocused
                              ? amountDiscountDraft
                              : field.value && field.value > 0 ? String(field.value) : ''
                          }
                          onFocus={() => {
                            setAmountDiscountFocused(true);
                            const v = Number(field.value) || 0;
                            setAmountDiscountDraft(v > 0 ? String(v) : '');
                          }}
                          onBlur={() => {
                            setAmountDiscountFocused(false);
                            const raw = sanitizeAmountDiscountDraft(amountDiscountDraft.trim());
                            const n   = raw === '' || raw === '.' ? 0 : parseFloat(raw);
                            const value = Number.isFinite(n) ? Math.max(0, Math.min(n, total)) : 0;
                            field.onChange(value);
                            if (value > 0) setValue('percentDiscount', 0);
                            setAmountDiscountDraft('');
                          }}
                          onChange={(e) => {
                            const s = sanitizeAmountDiscountDraft(e.target.value);
                            setAmountDiscountDraft(s);
                            if (s === '' || s === '.') { field.onChange(0); return; }
                            const n = parseFloat(s);
                            if (Number.isFinite(n)) {
                              const value = Math.max(0, Math.min(n, total));
                              field.onChange(value);
                              if (value > 0) setValue('percentDiscount', 0);
                            }
                          }}
                          dir="ltr"
                          className="flex-1 min-w-0 px-2 py-2 text-sm text-center border-0 focus:ring-0 outline-none"
                          placeholder={t('manualDiscount.amountPlaceholder')}
                          aria-label={t('manualDiscount.amount')}
                        />
                      )}
                    />
                  </div>
                </div>
                {(errors.percentDiscount || errors.amountDiscount) && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.percentDiscount?.message || errors.amountDiscount?.message}
                  </p>
                )}
              </CmxCardContent>
            </CmxCard>

            {/* ── G: Partial Payment Card ──────────────────────────── */}
            {isImmediatePayment && (
              <CmxCard>
                <CmxCardContent className="pt-4">
                  <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div>
                      <p className="font-medium text-sm text-gray-900">{t('partialPayment.payPartial')}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t('partialPayment.hint')}</p>
                    </div>
                    <CmxSwitch
                      checked={payPartial}
                      onCheckedChange={(checked) => {
                        setPayPartial(checked);
                        if (checked) setPartialAmount(saleTotal);
                      }}
                    />
                  </div>
                  {payPartial && (
                    <div className="mt-3 space-y-2">
                      <label className={`block text-sm font-medium text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('partialPayment.amountToPayNow')}
                      </label>
                      <div className={`flex items-center border border-gray-300 rounded-lg overflow-hidden ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span className={`px-2 text-gray-500 text-sm bg-gray-50 ${isRTL ? 'order-2' : ''}`}>{currencyCode}</span>
                        <input
                          type="number"
                          min={0}
                          max={saleTotal}
                          step={Math.pow(10, -decimalPlaces)}
                          value={partialAmount > 0 ? partialAmount : ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!Number.isNaN(val)) setPartialAmount(Math.max(0, Math.min(saleTotal, val)));
                            else setPartialAmount(0);
                          }}
                          placeholder={formatAmount(saleTotal)}
                          dir="ltr"
                          className="flex-1 min-w-0 px-3 py-2 text-sm border-0 focus:ring-0 outline-none"
                        />
                      </div>
                      {effectiveAmountToCharge < saleTotal && effectiveAmountToCharge > 0 && (
                        <p className={`text-sm font-medium text-amber-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('partialPayment.remainingDue')}: {currencyCode} {formatAmount(saleTotal - effectiveAmountToCharge)}
                        </p>
                      )}
                    </div>
                  )}
                </CmxCardContent>
              </CmxCard>
            )}

            {/* ── H: Split Payment Legs Card ───────────────────────── */}
            {isImmediatePayment && (
              <div ref={legsCardRef}>
              <CmxCard className="border-blue-200">
                <CmxCardHeader className="pb-2">
                  <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <CmxCardTitle className="text-sm">{t('splitPayment.title')}</CmxCardTitle>
                    {/* Outstanding indicator — always visible for immediate payments */}
                    <span className={`text-xs font-medium ${
                      legsValid
                        ? 'text-green-700'
                        : legRemaining > 0
                          ? 'text-amber-700'
                          : 'text-red-600'
                    }`}>
                      {legRemaining > 0
                        ? `${t('splitPayment.outstanding')}: ${currencyCode} ${formatAmount(legRemaining)}`
                        : legsValid
                          ? `✓ ${t('splitPayment.allocated')}`
                          : `${t('splitPayment.over')}: ${currencyCode} ${formatAmount(Math.abs(legRemaining))}`}
                    </span>
                  </div>
                </CmxCardHeader>
                <CmxCardContent className="space-y-2">
                  {paymentLegs.map((leg, idx) => (
                    <div
                      key={`${legIdPrefix}-leg-${idx}`}
                      className="border border-gray-200 rounded-lg p-2.5 space-y-2 bg-gray-50"
                    >
                      {/* Row 1: method selector | amount | trash */}
                      <div className={`flex gap-2 items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <select
                          value={leg.method}
                          onChange={(e) => updateLeg(idx, 'method', e.target.value as PaymentMethodCode)}
                          className="flex-shrink-0 w-36 px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
                          aria-label={t('splitPayment.method')}
                        >
                          {IMMEDIATE_METHOD_CODES.map((code) => (
                            <option key={code} value={code}>{getPaymentLabel(code)}</option>
                          ))}
                        </select>

                        <div className="flex-1 flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                          <span className={`px-2 text-gray-500 text-sm bg-gray-50 border-r ${isRTL ? 'order-2 border-r-0 border-l' : ''}`}>{currencyCode}</span>
                          <input
                            type="number"
                            min={0}
                            step={Math.pow(10, -decimalPlaces)}
                            value={leg.amount > 0 ? leg.amount : ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateLeg(idx, 'amount', Number.isFinite(val) ? Math.max(0, val) : 0);
                            }}
                            placeholder={formatAmount(0)}
                            dir="ltr"
                            className="flex-1 min-w-0 px-3 py-1.5 text-sm border-0 focus:ring-0 outline-none"
                            aria-label={t('splitPayment.amount')}
                          />
                        </div>

                        {paymentLegs.length > 1 && (
                          <CmxButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPaymentLegs((prev) => prev.filter((_, i) => i !== idx))}
                            aria-label={t('splitPayment.remove')}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </CmxButton>
                        )}
                      </div>

                      {/* Row 2: method-specific detail fields */}
                      {leg.method === PAYMENT_METHODS.CARD && (
                        <div className={`grid grid-cols-3 gap-2 ${isRTL ? 'direction-rtl' : ''}`}>
                          {/* Card Brand */}
                          <div>
                            <label className={`block text-xs font-medium text-gray-600 mb-1 ${isRTL ? 'text-right' : ''}`}>
                              {t('splitPayment.cardBrand')}
                            </label>
                            <CmxSelectDropdown
                              value={leg.card_brand_code ?? ''}
                              onValueChange={(v) => updateLeg(idx, 'card_brand_code', v || undefined)}
                            >
                              <CmxSelectDropdownTrigger dir={isRTL ? 'rtl' : 'ltr'} className="h-8 text-xs">
                                <CmxSelectDropdownValue
                                  displayValue={
                                    leg.card_brand_code
                                      ? (cardBrands.find(b => b.card_brand_code === leg.card_brand_code)
                                          ? (isRTL
                                              ? (cardBrands.find(b => b.card_brand_code === leg.card_brand_code)?.name2 || cardBrands.find(b => b.card_brand_code === leg.card_brand_code)?.name || leg.card_brand_code)
                                              : (cardBrands.find(b => b.card_brand_code === leg.card_brand_code)?.name || leg.card_brand_code))
                                          : leg.card_brand_code)
                                      : ''
                                  }
                                  placeholder={t('splitPayment.cardBrandPlaceholder')}
                                />
                              </CmxSelectDropdownTrigger>
                              <CmxSelectDropdownContent>
                                <CmxSelectDropdownItem value="">{t('splitPayment.cardBrandPlaceholder')}</CmxSelectDropdownItem>
                                {cardBrands.map((b) => (
                                  <CmxSelectDropdownItem key={b.card_brand_code} value={b.card_brand_code}>
                                    {isRTL ? (b.name2 || b.name) : b.name}
                                  </CmxSelectDropdownItem>
                                ))}
                              </CmxSelectDropdownContent>
                            </CmxSelectDropdown>
                          </div>
                          {/* Last 4 digits */}
                          <CmxInput
                            label={t('splitPayment.cardLast4')}
                            value={leg.card_last4 ?? ''}
                            dir="ltr"
                            maxLength={4}
                            inputMode="numeric"
                            placeholder="0000"
                            onChange={(e) => updateLeg(idx, 'card_last4', e.target.value.replace(/\D/g, '').slice(0, 4) || undefined)}
                            className="text-sm"
                          />
                          {/* Auth code */}
                          <CmxInput
                            label={t('splitPayment.authCode')}
                            value={leg.auth_code ?? ''}
                            dir="ltr"
                            placeholder="—"
                            onChange={(e) => updateLeg(idx, 'auth_code', e.target.value || undefined)}
                            className="text-sm"
                          />
                        </div>
                      )}

                      {leg.method === PAYMENT_METHODS.CHECK && (
                        <div className={`grid grid-cols-3 gap-2 ${isRTL ? 'direction-rtl' : ''}`}>
                          {/* Check number — required */}
                          <CmxInput
                            label={`${t('splitPayment.checkNumber')} *`}
                            value={leg.checkNumber ?? ''}
                            dir="ltr"
                            placeholder={t('checkNumber.placeholder')}
                            onChange={(e) => updateLeg(idx, 'checkNumber', e.target.value || undefined)}
                            className="text-sm"
                          />
                          {/* Bank name */}
                          <CmxInput
                            label={t('splitPayment.checkBankName')}
                            value={leg.checkBank ?? ''}
                            dir="ltr"
                            placeholder="—"
                            onChange={(e) => updateLeg(idx, 'checkBank', e.target.value || undefined)}
                            className="text-sm"
                          />
                          {/* Due date */}
                          <CmxInput
                            type="date"
                            label={t('splitPayment.checkDueDate')}
                            value={leg.checkDate ?? ''}
                            onChange={(e) => updateLeg(idx, 'checkDate', e.target.value || undefined)}
                            className="text-sm"
                          />
                        </div>
                      )}

                      {leg.method === PAYMENT_METHODS.BANK_TRANSFER && (
                        <CmxInput
                          label={t('splitPayment.bankReference')}
                          value={leg.bank_reference ?? ''}
                          dir="ltr"
                          placeholder="—"
                          onChange={(e) => updateLeg(idx, 'bank_reference', e.target.value || undefined)}
                          className="text-sm"
                        />
                      )}

                      {GATEWAY_METHOD_CODES.includes(leg.method) && (
                        <div className={`grid grid-cols-3 gap-2 ${isRTL ? 'direction-rtl' : ''}`}>
                          {/* Gateway code */}
                          <CmxInput
                            label={t('splitPayment.gatewayCode')}
                            value={leg.gateway_code ?? ''}
                            dir="ltr"
                            placeholder="—"
                            onChange={(e) => updateLeg(idx, 'gateway_code', e.target.value || undefined)}
                            className="text-sm"
                          />
                          {/* Transaction ID */}
                          <CmxInput
                            label={t('splitPayment.gatewayTransactionId')}
                            value={leg.gateway_transaction_id ?? ''}
                            dir="ltr"
                            placeholder="—"
                            onChange={(e) => updateLeg(idx, 'gateway_transaction_id', e.target.value || undefined)}
                            className="text-sm"
                          />
                          {/* Gateway reference */}
                          <CmxInput
                            label={t('splitPayment.gatewayReference')}
                            value={leg.gateway_reference ?? ''}
                            dir="ltr"
                            placeholder="—"
                            onChange={(e) => updateLeg(idx, 'gateway_reference', e.target.value || undefined)}
                            className="text-sm"
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {!legsValid && paymentLegs.length > 1 && (
                    <p className={`text-xs font-medium text-amber-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('splitPayment.validation.sumMismatch')} ({currencyCode} {formatAmount(Math.abs(saleTotal - legSum))})
                    </p>
                  )}

                  <CmxButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPaymentLegs((prev) => [
                      ...prev,
                      { method: PAYMENT_METHODS.CASH as PaymentMethodCode, amount: parseFloat(legRemaining.toFixed(decimalPlaces)) },
                    ])}
                    className={`flex items-center gap-1.5 text-blue-600 hover:text-blue-700 px-0 ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <PlusCircle className="w-4 h-4" />
                    {t('splitPayment.addMethod')}
                  </CmxButton>
                </CmxCardContent>
              </CmxCard>
              </div>
            )}

            {/* ── I: Promotions & Gift Card (collapsible) ──────────── */}
            {!NEW_ORDER_PROMO_GIFT_DISABLED && (
              <CmxCard>
                <button
                  type="button"
                  onClick={() => setCouponOpen(!couponOpen)}
                  aria-expanded={showCouponContent}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 rounded-t-lg transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  <span className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    {t('haveCoupon')}
                    {appliedBadgeCount > 0 && (
                      <Badge variant="secondary" className="text-xs">{appliedBadgeCount}</Badge>
                    )}
                  </span>
                  {showCouponContent ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>

                {showCouponContent && (
                  <CmxCardContent className="border-t space-y-3">
                    {/* Applied summary badges */}
                    {(appliedPromoCode || appliedGiftCard) && (
                      <div className="p-2 bg-green-50 border border-green-200 rounded-lg space-y-1">
                        {appliedPromoCode && (
                          <div className={`flex items-center justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <span className="text-gray-600">{t('promoCode.label') || 'Promo Code'}</span>
                            <span className="text-green-800 font-medium">
                              {appliedPromoCode.code}: -{currencyCode} {formatAmount(appliedPromoCode.discount)}
                            </span>
                          </div>
                        )}
                        {appliedGiftCard && (
                          <div className={`flex items-center justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <span className="text-gray-600">
                              {t('giftCard.label') || 'Gift Card'} ({appliedGiftCard.number.slice(0, 12)}{appliedGiftCard.number.length > 12 ? '…' : ''})
                            </span>
                            <span className="text-purple-800 font-medium">
                              -{currencyCode} {formatAmount(appliedGiftCard.amount)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Promo code input */}
                    {!appliedPromoCode ? (
                      <div className="space-y-1">
                        <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Controller
                            name="promoCode"
                            control={control}
                            render={({ field }) => (
                              <CmxInput
                                {...field}
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleValidatePromoCode())}
                                dir="ltr"
                                placeholder={t('promoCode.placeholder')}
                                disabled={promoCodeValidating}
                                error={errors.promoCode?.message}
                                className="flex-1"
                              />
                            )}
                          />
                          <CmxButton
                            type="button"
                            onClick={handleValidatePromoCode}
                            disabled={!promoCode?.trim() || promoCodeValidating}
                            size="sm"
                            className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
                          >
                            {promoCodeValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : t('promoCode.apply')}
                          </CmxButton>
                        </div>
                        {promoCodeResult && !promoCodeResult.isValid && (
                          <div className={`flex items-center gap-2 text-red-600 text-xs ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>{promoCodeResult.error}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-900">
                            {appliedPromoCode.code} -{currencyCode} {formatAmount(appliedPromoCode.discount)}
                          </span>
                        </div>
                        <button type="button" onClick={handleClearPromoCode} className="text-xs text-red-600 hover:underline">
                          {t('promoCode.remove')}
                        </button>
                      </div>
                    )}

                    {/* Gift card input */}
                    {!appliedGiftCard ? (
                      <div className="space-y-3">
                        <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Controller
                            name="giftCardNumber"
                            control={control}
                            render={({ field }) => (
                              <CmxInput
                                {...field}
                                value={field.value || ''}
                                onChange={(e) => {
                                  field.onChange(e.target.value.toUpperCase());
                                  if (pinRequired) {
                                    setPinRequired(false); setGiftCardPin('');
                                    setPinVisible(false); setPinFieldError(null); setGiftCardResult(null);
                                  }
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleFetchGiftCardDetails())}
                                dir="ltr"
                                placeholder={t('giftCard.placeholder')}
                                disabled={giftCardValidating}
                                error={errors.giftCardNumber?.message}
                                className="flex-1"
                              />
                            )}
                          />
                          <CmxButton
                            type="button"
                            onClick={handleFetchGiftCardDetails}
                            disabled={!giftCardNumber?.trim() || giftCardValidating || (pinRequired && !giftCardPin.trim())}
                            size="sm"
                            variant="secondary"
                            className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
                          >
                            {giftCardValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : t('giftCard.fetch')}
                          </CmxButton>
                        </div>

                        {/* PIN field */}
                        {pinRequired && (
                          <div className={`rounded-lg border border-purple-300 bg-purple-50 p-3 space-y-2 ${isRTL ? 'text-right' : ''}`}>
                            <div className={`flex items-center gap-1.5 text-xs text-purple-700 font-medium ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <KeyRound className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{t('giftCard.pinPrompt')}</span>
                            </div>
                            {pinFieldError && (
                              <div className={`flex items-center gap-1.5 text-xs text-red-600 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{pinFieldError}</span>
                              </div>
                            )}
                            <div className="relative">
                              <input
                                ref={pinInputRef}
                                type={pinVisible ? 'text' : 'password'}
                                value={giftCardPin}
                                onChange={(e) => { setGiftCardPin(e.target.value); setPinFieldError(null); }}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleFetchGiftCardDetails())}
                                inputMode="numeric"
                                maxLength={20}
                                dir="ltr"
                                autoFocus
                                autoComplete="one-time-code"
                                placeholder={t('giftCard.pinPlaceholder')}
                                className={`w-full px-3 py-2 text-sm border border-purple-400 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${isRTL ? 'pr-3 pl-10 text-right' : 'pr-10'}`}
                              />
                              <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => setPinVisible((v) => !v)}
                                className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-2' : 'right-2'} text-gray-400 hover:text-gray-600 focus:outline-none`}
                              >
                                {pinVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        )}

                        {giftCardResult && !giftCardResult.isValid && (
                          <div className={`flex items-center gap-2 text-red-600 text-xs ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{resolveGiftCardError(giftCardResult)}</span>
                          </div>
                        )}

                        {giftCardDetails && (
                          <div className="space-y-3 p-3 rounded-lg border border-purple-200 bg-purple-50">
                            <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <div>
                                <p className="text-sm font-semibold text-purple-900">{t('giftCard.details')}</p>
                                <p className="text-xs text-gray-600">{t('giftCard.balance')}: {currencyCode} {formatAmount(giftCardDetails.balance)}</p>
                                {giftCardDetails.expiryDate && (
                                  <p className="text-xs text-gray-600">{t('giftCard.expiry')}: {new Date(giftCardDetails.expiryDate).toLocaleDateString()}</p>
                                )}
                              </div>
                              <button type="button" onClick={handleClearGiftCard} className="text-xs text-red-600 hover:underline">
                                {t('giftCard.remove')}
                              </button>
                            </div>
                            <div className={`flex gap-2 items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <div className="flex-1 flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                                <span className={`px-2 text-gray-500 text-sm bg-gray-50 ${isRTL ? 'order-2' : ''}`}>{currencyCode}</span>
                                <Controller
                                  name="giftCardAmount"
                                  control={control}
                                  render={({ field }) => (
                                    <input
                                      {...field}
                                      type="number"
                                      min={0}
                                      max={Math.min(giftCardDetails.balance, saleTotal)}
                                      step={Math.pow(10, -decimalPlaces)}
                                      dir="ltr"
                                      disabled={!!appliedGiftCard}
                                      className="flex-1 min-w-0 px-2 py-2 text-sm border-0 focus:ring-0 outline-none"
                                      placeholder={t('giftCard.amountPlaceholder')}
                                    />
                                  )}
                                />
                              </div>
                              <CmxButton
                                type="button"
                                onClick={handleApplyGiftCard}
                                disabled={giftCardAmount === undefined || giftCardAmount <= 0}
                                size="sm"
                                variant="secondary"
                              >
                                {t('giftCard.applyAmount')}
                              </CmxButton>
                            </div>
                            {Number(giftCardAmount) > 0 && (
                              <div className={`space-y-0.5 text-xs text-gray-600 ${isRTL ? 'text-right' : ''}`}>
                                <p>{t('giftCard.balanceAfterApply', { balance: `${currencyCode} ${formatAmount(Math.max(0, giftCardDetails.balance - Number(giftCardAmount)))}` })}</p>
                                <p>{t('giftCard.remainingDue', { amount: `${currencyCode} ${formatAmount(Math.max(0, saleTotal - Number(giftCardAmount)))}` })}</p>
                              </div>
                            )}
                            <p className="text-xs text-gray-500">{t('giftCard.amountHint')}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`flex items-center justify-between p-2 bg-purple-50 border border-purple-200 rounded-lg ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Gift className="w-4 h-4 text-purple-600" />
                          <div>
                            <p className="text-sm font-medium text-purple-900">{appliedGiftCard.number}</p>
                            <p className="text-xs text-gray-600">{t('giftCard.appliedAmount')}: {currencyCode} {formatAmount(appliedGiftCard.amount)} • {t('giftCard.locked')}</p>
                          </div>
                        </div>
                        <button type="button" onClick={handleClearGiftCard} className="text-xs text-red-600 hover:underline">
                          {t('giftCard.remove')}
                        </button>
                      </div>
                    )}
                  </CmxCardContent>
                )}
              </CmxCard>
            )}

            {/* ── J: Tax Profiles Panel (collapsible) ─────────────── */}
            <CmxCard>
              <button
                type="button"
                onClick={() => setTaxPanelOpen(!taxPanelOpen)}
                aria-expanded={taxPanelOpen}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-t-lg transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <span className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {t('tax.panelTitle')}
                  {profilesTaxAmount > 0 && (
                    <Badge variant="secondary" className="text-xs tabular-nums">
                      {currencyCode} {formatAmount(profilesTaxAmount)}
                    </Badge>
                  )}
                </span>
                {taxPanelOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {taxPanelOpen && (
                <CmxCardContent className="border-t space-y-2">
                  {displayTaxBreakdown.length === 0 ? (
                    <p className={`text-xs text-gray-500 ${isRTL ? 'text-right' : ''}`}>{t('tax.noProfiles')}</p>
                  ) : (
                    <>
                      {displayTaxBreakdown.map((entry, index) => (
                        <div key={entry.profileId ?? `${entry.taxType}-${index}`} className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium text-gray-700 truncate ${isRTL ? 'text-right' : ''}`}>
                              {isRTL ? (entry.label2 || entry.label) : entry.label}
                            </p>
                            <p className="text-xs text-gray-400">{entry.taxType}</p>
                          </div>
                          <span className="text-xs text-gray-500 tabular-nums min-w-[56px] text-right" dir="ltr">
                            {entry.rate.toFixed(2)}%
                          </span>
                          <span className="text-sm font-medium text-gray-700 tabular-nums min-w-[72px] text-right" dir="ltr">
                            {currencyCode} {formatAmount(entry.taxAmount)}
                          </span>
                        </div>
                      ))}
                      <div className={`flex justify-between items-center border-t pt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span className={`text-xs font-medium text-gray-700 ${isRTL ? 'text-right' : ''}`}>{t('tax.totalTax')}</span>
                        <span className="text-sm font-bold text-gray-900 tabular-nums" dir="ltr">
                          {currencyCode} {formatAmount(profilesTaxAmount)}
                        </span>
                      </div>
                    </>
                  )}
                </CmxCardContent>
              )}
            </CmxCard>

            {/* ── K: Payment Notes ─────────────────────────────────── */}
            <div className="space-y-1">
              <label
                htmlFor="v3-payment-notes"
                className={`block text-sm font-medium text-gray-900 ${isRTL ? 'text-right' : ''}`}
              >
                {t('paymentNotes') || 'Payment notes'}
              </label>
              <Controller
                name="paymentNotes"
                control={control}
                render={({ field }) => (
                  <CmxTextarea
                    {...field}
                    id="v3-payment-notes"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value)}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    rows={2}
                    placeholder={t('paymentNotesPlaceholder') || 'Optional payment-related notes...'}
                    aria-label={t('paymentNotes') || 'Payment notes'}
                  />
                )}
              />
            </div>
          </div>

          {/* ── L: Sticky Footer ─────────────────────────────────── */}
          <CmxDialogFooter className="flex-shrink-0 flex-col items-stretch gap-2 bg-[rgb(var(--cmx-background-rgb,255_255_255))]">
            {/* Summary rows */}
            <div className="w-full space-y-1 pb-2">
              <SummaryRow
                label={t('summary.subtotal')}
                value={`${currencyCode} ${formatAmount(totals.subtotal)}`}
                loading={totalsLoading}
              />
              {(totals.autoRuleDiscount ?? 0) > 0 && (
                <SummaryRow
                  label={t('summary.rulesDiscount')}
                  value={`−${currencyCode} ${formatAmount(totals.autoRuleDiscount ?? 0)}`}
                  loading={totalsLoading}
                  negative
                />
              )}
              {totals.manualDiscount > 0 && (
                <SummaryRow
                  label={t('summary.manualDiscount')}
                  value={`−${currencyCode} ${formatAmount(totals.manualDiscount)}`}
                  loading={totalsLoading}
                  negative
                />
              )}
              {totals.promoDiscount > 0 && (
                <SummaryRow
                  label={t('summary.promoDiscount')}
                  value={`−${currencyCode} ${formatAmount(totals.promoDiscount)}`}
                  loading={totalsLoading}
                  negative
                />
              )}
              <SummaryRow
                label={`VAT (${totals.vatTaxPercent.toFixed(0)}%)`}
                value={`${currencyCode} ${formatAmount(totals.vatValue)}`}
                loading={totalsLoading}
              />
              {(totals.taxAmount ?? 0) > 0 && (
                <SummaryRow
                  label={t('summary.taxAmount')}
                  value={`${currencyCode} ${formatAmount(totals.taxAmount ?? 0)}`}
                  loading={totalsLoading}
                />
              )}
              {totals.giftCardApplied > 0 && (
                <SummaryRow
                  label={t('summary.giftCardApplied')}
                  value={`−${currencyCode} ${formatAmount(totals.giftCardApplied)}`}
                  loading={totalsLoading}
                  negative
                />
              )}
              <SummaryRow
                label={t('summary.totalAmount')}
                value={`${currencyCode} ${formatAmount(saleTotal)}`}
                loading={totalsLoading}
                bold
              />
              {isImmediatePayment && paymentLegs.length > 1 && (
                <>
                  <SummaryRow
                    label={t('splitPayment.legSum')}
                    value={`${currencyCode} ${formatAmount(legSum)}`}
                    loading={totalsLoading}
                  />
                  {legRemaining !== 0 && (
                    <SummaryRow
                      label={t('splitPayment.outstanding')}
                      value={`${currencyCode} ${formatAmount(Math.abs(legRemaining))}`}
                      loading={totalsLoading}
                      negative={legRemaining > 0}
                    />
                  )}
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className={`flex gap-3 w-full ${isRTL ? 'flex-row-reverse' : ''}`}>
              <CmxButton
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                {tCommon('cancel')}
              </CmxButton>
              <CmxButton
                type="submit"
                loading={loading}
                disabled={
                  loading ||
                  totalsLoading ||
                  (items.length > 0 && !serverTotals) ||
                  (paymentMethod === PAYMENT_METHODS.CHECK && !isMultiLeg && !watch('checkNumber')?.trim()) ||
                  (payPartial && isImmediatePayment && !isMultiLeg && effectiveAmountToCharge <= 0) ||
                  (isMultiLeg && !legsValid) ||
                  (serverTotals?.creditLimit?.wouldExceed &&
                    (serverTotals.creditLimit.mode !== 'warn' || !creditLimitOverride))
                }
                className="flex-1 font-bold"
                size="lg"
              >
                {submitButtonLabel}
              </CmxButton>
            </div>

            {paymentMethod === PAYMENT_METHODS.CHECK && !isMultiLeg && !watch('checkNumber')?.trim() && (
              <p className={`text-xs text-red-600 w-full ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('checkNumber.required')}
              </p>
            )}
            <p className={`text-xs text-gray-500 w-full ${isRTL ? 'text-right' : 'text-center'}`}>
              {t('messages.paymentMethodNote', { method: getPaymentLabel(paymentMethod || PAYMENT_METHODS.PAY_ON_COLLECTION) })}
            </p>
          </CmxDialogFooter>
        </form>
      </div>
    </CmxDialog>
  );
}
