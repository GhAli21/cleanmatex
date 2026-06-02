/**
 * Payment Modal Component (Canonical)
 * Single-screen layout with fixed footer, dense grid, and collapsible promo section.
 * Promo / gift UI and preview fields are gated by `NEW_ORDER_PROMO_GIFT_DISABLED`
 * in `order-checkout-flags.ts` until gifts & promotions are fully implemented.
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
import type { ValidatePromoCodeResult, ValidateGiftCardResult } from '@/lib/types/payment';
import { getPaymentFormSchema, type PaymentFormData } from '@features/orders/model/payment-form-schema';
import { taxService } from '@/lib/services/tax.service';
import { newOrderPaymentPayloadSchema, type NewOrderPaymentPayload, type PaymentLeg } from '@/lib/validations/new-order-payment-schemas';
import { cmxMessage } from '@ui/feedback';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { NEW_ORDER_PROMO_GIFT_DISABLED } from '@/lib/constants/order-checkout-flags';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import type { Control } from 'react-hook-form';
import type { PaymentMethodCode } from '@/lib/constants/order-types';

/** B2B contract selector - fetches contracts for customer */
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

  return (
    <div>
      <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
        {t('b2b.contract') || 'Contract'}
      </label>
      <Controller
        name="b2bContractId"
        control={control}
        render={({ field }) => (
          <select
            {...field}
            value={field.value || ''}
            onChange={(e) => field.onChange(e.target.value || undefined)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">{t('b2b.contractOptional') || 'None (optional)'}</option>
            {isLoading && <option disabled>Loading...</option>}
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.contractNo}
              </option>
            ))}
          </select>
        )}
      />
    </div>
  );
}

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with form data and extended payload (amountToCharge, totals) for invoice/payment flow */
  onSubmit: (paymentData: PaymentFormData, payload: NewOrderPaymentPayload) => void;
  total: number;
  /** Items for server-side preview (base line + service + packing surcharges) */
  items: { productId: string; quantity: number; servicePrefCharge?: number; packingPrefCharge?: number }[];
  isExpress?: boolean;
  tenantOrgId: string;
  customerId?: string;
  /** When 'b2b', show contract/cost center/PO fields */
  customerType?: string;
  serviceCategories?: string[];
  branchId?: string;
  /** User ID for USER_OVERRIDE in 7-layer settings resolution. */
  userId?: string;
  /** When true, PAY_ON_COLLECTION is disabled (retail orders must be paid at POS) */
  isRetailOnlyOrder?: boolean;
  loading?: boolean;
  /** Initial payment notes (for edit mode) */
  initialPaymentNotes?: string;
}

export function PaymentModalEnhanced02({
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
  /** Used for per-code gift card error messages (EXPIRED, SUSPENDED, etc.) */
  const tGiftCardErrors = useTranslations('marketing.giftCards.errors');
  const isRTL = useRTL();

  /**
   * Resolves a ValidateGiftCardResult to a localised error message.
   * Maps specific errorCodes to distinct keys in giftCards.errors so each
   * error condition gets its own translated message (not a generic fallback).
   */
  const resolveGiftCardError = useCallback(
    (result: ValidateGiftCardResult): string => {
      if (!result.errorCode) {
        return result.error ?? t('giftCard.errors.validationFailed');
      }
      switch (result.errorCode) {
        case 'EXPIRED':             return tGiftCardErrors('EXPIRED');
        case 'INSUFFICIENT_BALANCE':return tGiftCardErrors('INSUFFICIENT_BALANCE');
        case 'INVALID_PIN':         return tGiftCardErrors('INVALID_PIN');
        // Service returns CARD_SUSPENDED for both suspended and voided cards;
        // VOIDED is kept here in case the service is updated to emit it directly.
        case 'CARD_SUSPENDED':      return tGiftCardErrors('SUSPENDED');
        case 'VOIDED':              return tGiftCardErrors('VOIDED');
        case 'NOT_FOUND':           return tGiftCardErrors('INVALID_CODE');
        default:                    return result.error ?? t('giftCard.errors.validationFailed');
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
    formState: { errors, isValid },
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

  const paymentMethod = watch('paymentMethod');
  const percentDiscount = watch('percentDiscount');
  const amountDiscount = watch('amountDiscount');
  const promoCode = watch('promoCode');
  const giftCardNumber = watch('giftCardNumber');
  const giftCardAmount = watch('giftCardAmount');

  const [promoCodeValidating, setPromoCodeValidating] = useState(false);
  const [promoCodeResult, setPromoCodeResult] = useState<ValidatePromoCodeResult | null>(null);
  const [appliedPromoCode, setAppliedPromoCode] = useState<{
    code: string;
    id: string;
    discount: number;
  } | null>(null);

  const [giftCardValidating, setGiftCardValidating] = useState(false);
  const [giftCardResult, setGiftCardResult] = useState<ValidateGiftCardResult | null>(null);
  const [giftCardDetails, setGiftCardDetails] = useState<{
    number: string;
    balance: number;
    status: string;
    expiryDate?: string;
    id?: string;
    searchStr?: string;
  } | null>(null);
  const [appliedGiftCard, setAppliedGiftCard] = useState<{
    number: string;
    amount: number;
    balance: number;
    id: string;
  } | null>(null);
  // PIN state — local only, not in form schema (PIN is verified at Fetch, not at Submit)
  const [giftCardPin, setGiftCardPin]     = useState('');
  const [pinRequired, setPinRequired]     = useState(false);
  const [pinVisible, setPinVisible]       = useState(false);
  const [pinFieldError, setPinFieldError] = useState<string | null>(null);

  /** Manual amount discount: text field so values like `.5` normalize to `0.5` while typing. */
  const [amountDiscountFocused, setAmountDiscountFocused] = useState(false);
  const [amountDiscountDraft, setAmountDiscountDraft] = useState('');

  const [couponOpen, setCouponOpen] = useState(false);
  const [taxRate, setTaxRate] = useState<number>(0.06);
  const [orderTaxRate, setOrderTaxRate] = useState<number>(0);
  const [orderTaxAmount, setOrderTaxAmount] = useState<number>(0);

  const isImmediatePayment = paymentMethod === PAYMENT_METHODS.CASH ||
    paymentMethod === PAYMENT_METHODS.CARD ||
    paymentMethod === PAYMENT_METHODS.CHECK ||
    paymentMethod === PAYMENT_METHODS.BANK_TRANSFER ||
    paymentMethod === PAYMENT_METHODS.MOBILE_PAYMENT;
  const [payPartial, setPayPartial] = useState(false);
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [creditLimitOverride, setCreditLimitOverride] = useState(false);

  /** Unique id prefix for split-leg inputs (stable across renders) */
  const legIdPrefix = useId();

  /**
   * Split-payment legs state.
   * Initialised to a single leg matching the selected payment method and full total.
   * Only shown when isImmediatePayment is true.
   */
  const [paymentLegs, setPaymentLegs] = useState<PaymentLeg[]>([
    { method: PAYMENT_METHODS.CASH as PaymentMethodCode, amount: 0 },
  ]);

  const [serverTotals, setServerTotals] = useState<{
    subtotal: number;
    manualDiscount: number;
    /** Automatic discount rule (server-calculated). */
    autoRuleDiscount: number;
    promoDiscount: number;
    afterDiscounts: number;
    vatValue: number;
    giftCardApplied: number;
    saleTotal: number;
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
  const focusTrapRef = useFocusTrap(open, { returnFocus: true });

  const [currencyConfig, setCurrencyConfig] = useState<{
    currencyCode: string;
    decimalPlaces: number;
    currencyExRate: number;
  } | null>(null);

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
    }
  }, [open, tenantOrgId, branchId, userId]);

  useEffect(() => {
    if (!giftCardNumber || appliedGiftCard) return;
    if (giftCardDetails?.number && giftCardDetails.number !== giftCardNumber && giftCardDetails.searchStr !== giftCardNumber) {
      setGiftCardDetails(null);
      setGiftCardResult(null);
      setValue('giftCardAmount', 0);
      setValue('giftCardId', '');
    }
  }, [giftCardNumber, giftCardDetails, appliedGiftCard, setValue]);

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
          saleTotal: d.saleTotal,
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
            ? details
                .map((d) => {
                  const path = (d.path ?? []).join('.');
                  return path ? `${path}: ${d.message ?? ''}` : (d.message ?? '');
                })
                .join('. ')
            : (json.error as string);
        cmxMessage.error(msg);
      }
    } catch {
      setServerTotals(null);
    } finally {
      setTotalsLoading(false);
    }
  }, [open, items, tenantOrgId, branchId, customerId, isExpress, percentDiscount, amountDiscount, appliedPromoCode?.code, appliedGiftCard?.number, appliedGiftCard?.amount, appliedGiftCard?.id, csrfToken]);

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
      setCouponOpen(false);
      setPayPartial(false);
      setPartialAmount(0);
      setCreditLimitOverride(false);
      setAmountDiscountFocused(false);
      setAmountDiscountDraft('');
      const initialMethod = (isRetailOnlyOrder ? PAYMENT_METHODS.CASH : PAYMENT_METHODS.PAY_ON_COLLECTION) as PaymentMethodCode;
      setPaymentLegs([{ method: initialMethod, amount: 0 }]);
    }
  }, [open, reset, isRetailOnlyOrder, initialPaymentNotes]);

  useEffect(() => {
    if (!isImmediatePayment) {
      setPayPartial(false);
      setPartialAmount(0);
      // Reset legs to a single deferred leg when switching to a deferred method
      setPaymentLegs([{ method: paymentMethod as PaymentMethodCode, amount: 0 }]);
    } else {
      // When switching to an immediate method, reset to single leg with full total
      setPaymentLegs([{ method: paymentMethod as PaymentMethodCode, amount: 0 }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod]);

  const currencyCode = currencyConfig?.currencyCode ?? ORDER_DEFAULTS.CURRENCY;
  const decimalPlaces = currencyConfig?.decimalPlaces ?? 3;
  const formatAmount = (n: number) => n.toFixed(decimalPlaces);

  /** Base amount for additional tax (after discounts, before VAT). Used for rate⇄amount sync. */
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

  const handleOrderTaxRateChange = useCallback(
    (newRate: number) => {
      setOrderTaxRate(newRate);
      const amount = parseFloat((afterDiscountsForTax * (newRate / 100)).toFixed(decimalPlaces));
      setOrderTaxAmount(amount);
    },
    [afterDiscountsForTax, decimalPlaces]
  );

  const handleOrderTaxAmountChange = useCallback(
    (newAmount: number) => {
      setOrderTaxAmount(newAmount);
      if (afterDiscountsForTax > 0) {
        const rate = parseFloat(((newAmount / afterDiscountsForTax) * 100).toFixed(2));
        setOrderTaxRate(rate);
      }
    },
    [afterDiscountsForTax]
  );

  const totals = useMemo(() => {
    if (serverTotals) {
      const additionalTaxAmount =
        orderTaxAmount > 0
          ? orderTaxAmount
          : parseFloat((afterDiscountsForTax * (orderTaxRate / 100)).toFixed(decimalPlaces));
      // Subtract any gift card the server hasn't reflected yet (race between
      // setAppliedGiftCard and the debounced re-fetch of serverTotals).
      const clientGiftCard = NEW_ORDER_PROMO_GIFT_DISABLED ? 0 : (appliedGiftCard?.amount || 0);
      const serverGiftCard = serverTotals.giftCardApplied || 0;
      const pendingGiftCard = Math.max(0, clientGiftCard - serverGiftCard);
      const saleTotalWithExtra = Math.max(0, serverTotals.saleTotal + additionalTaxAmount - pendingGiftCard);
      return {
        ...serverTotals,
        taxRate: orderTaxRate,
        taxAmount: additionalTaxAmount,
        giftCardApplied: serverGiftCard + pendingGiftCard,
        saleTotal: saleTotalWithExtra,
        totalSavings: serverTotals.subtotal + serverTotals.vatValue - saleTotalWithExtra,
      };
    }
    const subtotal = total; 
    const manualDiscount =
      percentDiscount > 0
        ? Math.min((subtotal * percentDiscount) / 100, subtotal)
        : Math.min(amountDiscount, subtotal);
    const promoDiscount = NEW_ORDER_PROMO_GIFT_DISABLED ? 0 : (appliedPromoCode?.discount || 0);
    const afterDiscounts = Math.max(0, subtotal - manualDiscount - promoDiscount);
    const taxAmount = orderTaxAmount > 0 ? orderTaxAmount : parseFloat((afterDiscounts * (orderTaxRate / 100)).toFixed(decimalPlaces));
    const afterTax = afterDiscounts + taxAmount;
    const vatValue = parseFloat((afterTax * taxRate).toFixed(decimalPlaces));
    const giftCardApplied = NEW_ORDER_PROMO_GIFT_DISABLED ? 0 : (appliedGiftCard?.amount || 0);
    const saleTotal = Math.max(0, afterTax + vatValue);
    return {
      subtotal,
      manualDiscount,
      autoRuleDiscount: 0,
      promoDiscount,
      afterDiscounts,
      taxRate: orderTaxRate,
      taxAmount,
      vatTaxPercent: taxRate * 100,
      vatValue,
      giftCardApplied,
      saleTotal,
      totalSavings: subtotal + taxAmount + vatValue - saleTotal,
    };
  }, [serverTotals, total, percentDiscount, amountDiscount, appliedPromoCode, appliedGiftCard, taxRate, orderTaxRate, orderTaxAmount, afterDiscountsForTax, decimalPlaces]);

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

  /** Sum of all split-payment leg amounts */
  const legSum = useMemo(
    () => paymentLegs.reduce((s, l) => s + (l.amount || 0), 0),
    [paymentLegs]
  );

  /** Remaining amount not yet allocated across legs */
  const legRemaining = useMemo(
    () => parseFloat(Math.max(0, saleTotal - legSum).toFixed(decimalPlaces)),
    [saleTotal, legSum, decimalPlaces]
  );

  /** Whether the multi-leg section has a valid sum matching the total */
  const legsValid = useMemo(
    () => Math.abs(legSum - saleTotal) <= 0.001,
    [legSum, saleTotal]
  );

  /** Immediate-only payment method codes allowed as split-payment legs */
  const IMMEDIATE_METHOD_CODES = [
    PAYMENT_METHODS.CASH,
    PAYMENT_METHODS.CARD,
    PAYMENT_METHODS.CHECK,
    PAYMENT_METHODS.BANK_TRANSFER,
    PAYMENT_METHODS.MOBILE_PAYMENT,
  ] as const;

  /** True when multi-leg mode is active (more than one leg or leg differs from primary method) */
  const isMultiLeg = isImmediatePayment && paymentLegs.length > 1;

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
  }, [
    t,
    currencyCode,
    decimalPlaces,
    isImmediatePayment,
    payPartial,
    remainingAfterThisPayment,
    effectiveAmountToCharge,
  ]);

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
        const applied = {
          code: promoCode,
          id: result.promoCode.id,
          discount: result.discountAmount,
        };
        setAppliedPromoCode(applied);
        setValue('promoCode', promoCode);
        setValue('promoCodeId', result.promoCode.id);
        setValue('promoDiscount', result.discountAmount);
      }
    } catch (error) {
      setPromoCodeResult({
        isValid: false,
        error: t('promoCode.errors.validationFailed'),
      });
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

  const handleFetchGiftCardDetails = async () => {
    if (NEW_ORDER_PROMO_GIFT_DISABLED) return;
    if (!giftCardNumber?.trim()) return;
    // When PIN field is shown, require a PIN before re-fetching
    if (pinRequired && !giftCardPin.trim()) return;

    setGiftCardValidating(true);
    setGiftCardResult(null);
    setGiftCardDetails(null);
    try {
      const result = await validateGiftCardAction({
        gift_card_code: giftCardNumber,
        ...(giftCardPin.trim() ? { card_pin: giftCardPin.trim() } : {}),
      });

      // Card has a PIN but none was supplied yet → reveal PIN field, no error banner
      if (!result.isValid && result.errorCode === 'INVALID_PIN' && !giftCardPin.trim()) {
        setPinRequired(true);
        return;
      }

      // Wrong PIN was entered → show error inline above the PIN field, not in general banner
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
    } catch (error) {
      setGiftCardResult({
        isValid: false,
        error: t('giftCard.errors.validationFailed'),
      });
    } finally {
      setGiftCardValidating(false);
    }
  };

  const handleApplyGiftCard = () => {
    if (NEW_ORDER_PROMO_GIFT_DISABLED || !giftCardDetails) return;
    const amountToUse = Number(giftCardAmount) || 0;
    const maxAmount = Math.min(giftCardDetails.balance, saleTotal);
    if (amountToUse <= 0) {
      cmxMessage.error(t('giftCard.errors.amountRequired'));
      return;
    }
    if (amountToUse > maxAmount) {
      cmxMessage.error(t('giftCard.errors.maxAmountExceeded'));
      setValue('giftCardAmount', maxAmount);
      return;
    }
    setAppliedGiftCard({
      number: giftCardDetails.number,
      amount: amountToUse,
      balance: giftCardDetails.balance,
      id: giftCardDetails.id ?? '',
    });
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

  const onSubmitForm = (data: PaymentFormData) => {
    // Block submission while PIN verification is pending
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

    // Client-side validation for multi-leg mode
    if (isImmediatePayment && paymentLegs.length > 1) {
      if (!legsValid) {
        cmxMessage.error(t('splitPayment.validation.sumMismatch'));
        return;
      }
      for (const leg of paymentLegs) {
        if (!leg.amount || leg.amount <= 0) {
          cmxMessage.error(t('splitPayment.validation.amountMustBePositive'));
          return;
        }
      }
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
      creditLimitOverride: creditLimitOverride || undefined,
      // Include legs only for actual multi-leg payment (>1 leg)
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

  const getPaymentIcon = (id: string) => {
    const iconClass = 'w-5 h-5';
    switch (id) {
      case PAYMENT_METHODS.CASH: return <Banknote className={iconClass} />;
      case PAYMENT_METHODS.CARD: return <CreditCard className={iconClass} />;
      case PAYMENT_METHODS.PAY_ON_COLLECTION: return <Package className={iconClass} />;
      case PAYMENT_METHODS.CHECK: return <CheckSquare className={iconClass} />;
      case PAYMENT_METHODS.INVOICE: return <FileText className={iconClass} />;
      default: return <Banknote className={iconClass} />;
    }
  };

  const getPaymentLabel = (id: string) => {
    switch (id) {
      case PAYMENT_METHODS.CASH: return t('methods.cash');
      case PAYMENT_METHODS.CARD: return t('methods.card');
      case PAYMENT_METHODS.PAY_ON_COLLECTION: return t('methods.payOnCollection');
      case PAYMENT_METHODS.CHECK: return t('methods.check');
      case PAYMENT_METHODS.INVOICE: return t('methods.invoice');
      default: return id;
    }
  };

  const showCouponContent = NEW_ORDER_PROMO_GIFT_DISABLED
    ? false
    : couponOpen || !!appliedPromoCode || !!appliedGiftCard;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={focusTrapRef}
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <header className={`flex flex-shrink-0 items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} p-4 border-b border-gray-200`}>
          <h2 className={`text-xl font-bold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>{t('title')}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={tCommon('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit(onSubmitForm)} className="flex flex-1 flex-col min-h-0">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {/* Hero: Large Total + Savings */}
            <div className={`text-center p-4 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}>
              <p className="text-xs text-gray-600 mb-0.5">{t('subtotal')}</p>
              <div className={`flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                {totalsLoading && <Loader2 className="w-6 h-6 animate-spin text-gray-400" />}
                <p className="text-4xl font-bold text-gray-900">{currencyCode} {formatAmount(saleTotal)}</p>
              </div>
              {totals.totalSavings > 0 && (
                <div className={`mt-1.5 flex items-center ${isRTL ? 'flex-row-reverse justify-center' : 'justify-center'} gap-2`}>
                  <span className="text-xs text-gray-500 line-through">
                    {currencyCode} {formatAmount(total)}
                  </span>
                  <span className="text-xs font-semibold text-green-600">
                    {t('savings')} {currencyCode} {formatAmount(totals.totalSavings)}
                  </span>
                </div>
              )}
            </div>

            {/* Dense Summary Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} justify-between`}>
                <span className="text-gray-600">{t('summary.subtotal')}</span>
                <span className="font-semibold text-gray-900">{currencyCode} {formatAmount(totals.subtotal)}</span>
              </div>
              <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} justify-between`}>
                <span className="text-gray-600">VAT ({totals.vatTaxPercent.toFixed(0)}%)</span>
                <span className="font-semibold text-gray-900">{currencyCode} {formatAmount(totals.vatValue)}</span>
              </div>
              <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} justify-between items-center`}>
                <span className="text-gray-600">{t('summary.taxRate')}</span>
                <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={orderTaxRate}
                    onChange={(e) => handleOrderTaxRateChange(parseFloat(e.target.value) || 0)}
                    className="w-14 rounded border border-gray-300 px-1.5 py-0.5 text-sm text-right"
                  />
                  <span className="text-xs">%</span>
                </div>
              </div>
              <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} justify-between items-center`}>
                <span className="text-gray-600">{t('summary.taxAmount')}</span>
                <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input
                    type="number"
                    min={0}
                    step={0.001}
                    value={orderTaxAmount > 0 ? orderTaxAmount : ''}
                    onChange={(e) => handleOrderTaxAmountChange(parseFloat(e.target.value) || 0)}
                    placeholder={formatAmount(totals.taxAmount ?? 0)}
                    className="w-20 rounded border border-gray-300 px-1.5 py-0.5 text-sm text-right"
                  />
                  <span className="text-xs text-gray-500">{currencyCode}</span>
                </div>
              </div>
              <div className="col-span-2 flex justify-between items-center text-lg font-bold bg-gray-100 p-2 rounded mt-1">
                <span className="text-gray-900">{t('summary.totalAmount')}</span>
                <span className="text-gray-900">{currencyCode} {formatAmount(saleTotal)}</span>
              </div>
            </div>

            {/* Compact Payment Methods */}
            <div>
              <h3 className={`font-semibold text-gray-900 mb-2 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>{t('methods.title')}</h3>
              <Controller
                name="paymentMethod"
                control={control}
                render={({ field }) => (
                  <>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => field.onChange(PAYMENT_METHODS.CASH)}
                        className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] p-3 rounded-lg border-2 transition-all
                          ${field.value === PAYMENT_METHODS.CASH ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        {getPaymentIcon(PAYMENT_METHODS.CASH)}
                        <span className={`text-sm font-medium ${field.value === PAYMENT_METHODS.CASH ? 'text-blue-700' : 'text-gray-700'}`}>{t('methods.cash')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange(PAYMENT_METHODS.CARD)}
                        className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] p-3 rounded-lg border-2 transition-all
                          ${field.value === PAYMENT_METHODS.CARD ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        {getPaymentIcon(PAYMENT_METHODS.CARD)}
                        <span className={`text-sm font-medium ${field.value === PAYMENT_METHODS.CARD ? 'text-blue-700' : 'text-gray-700'}`}>{t('methods.card')}</span>
                      </button>
                    </div>
                    <div className={`grid gap-2 mt-2 ${isRetailOnlyOrder ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {!isRetailOnlyOrder && (
                        <button
                          type="button"
                          onClick={() => field.onChange(PAYMENT_METHODS.PAY_ON_COLLECTION)}
                          className={`min-h-[44px] p-2 rounded-lg border flex items-center justify-center transition-all ${isRTL ? 'text-right' : 'text-left'}
                            ${field.value === PAYMENT_METHODS.PAY_ON_COLLECTION ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-gray-200'}`}
                        >
                          <span className="text-sm font-medium">{t('methods.payOnCollection')}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => field.onChange(PAYMENT_METHODS.CHECK)}
                        className={`min-h-[44px] p-2 rounded-lg border flex items-center justify-center transition-all ${isRTL ? 'text-right' : 'text-left'}
                          ${field.value === PAYMENT_METHODS.CHECK ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-gray-200'}`}
                      >
                        <span className="text-sm font-medium">{t('methods.check')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange(PAYMENT_METHODS.INVOICE)}
                        className={`min-h-[44px] p-2 rounded-lg border flex items-center justify-center transition-all ${isRTL ? 'text-right' : 'text-left'}
                          ${field.value === PAYMENT_METHODS.INVOICE ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-gray-200'}`}
                      >
                        <span className="text-sm font-medium">{t('methods.invoice')}</span>
                      </button>
                    </div>
                  </>
                )}
              />
            </div>

            {/* B2B: Contract, Cost Center, PO (when customer is B2B) */}
            {customerType === 'b2b' && customerId && (
              <div className={`space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200 ${isRTL ? 'text-right' : 'text-left'}`}>
                <h3 className="font-semibold text-gray-900 text-sm">{t('b2b.title') || 'B2B Details'}</h3>
                <B2BContractsSelect
                  customerId={customerId}
                  control={control}
                  isRTL={isRTL}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('b2b.costCenter') || 'Cost Center'}
                    </label>
                    <Controller
                      name="costCenterCode"
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="text"
                          dir="ltr"
                          placeholder={t('b2b.costCenterPlaceholder') || 'Optional'}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('b2b.poNumber') || 'PO Number'}
                    </label>
                    <Controller
                      name="poNumber"
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="text"
                          dir="ltr"
                          placeholder={t('b2b.poNumberPlaceholder') || 'Optional'}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      )}
                    />
                  </div>
                </div>
                {/* Credit limit (when INVOICE or PAY_ON_COLLECTION) */}
                {(paymentMethod === PAYMENT_METHODS.INVOICE || paymentMethod === PAYMENT_METHODS.PAY_ON_COLLECTION) &&
                  serverTotals?.creditLimit &&
                  serverTotals.creditLimit.creditLimit > 0 && (
                    <div className={`p-3 rounded-lg border ${serverTotals.creditLimit.wouldExceed ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'} ${isRTL ? 'text-right' : 'text-left'}`}>
                      <p className="text-sm font-medium text-gray-900">
                        {t('b2b.creditLimit') || 'Credit Limit'}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {t('b2b.creditUsed') || 'Used'}: {currencyCode} {formatAmount(serverTotals.creditLimit.currentBalance)} • {t('b2b.creditAvailable') || 'Available'}: {currencyCode} {formatAmount(serverTotals.creditLimit.available)}
                      </p>
                      {serverTotals.creditLimit.wouldExceed && (
                        <>
                          <p className="text-xs font-medium text-amber-800 mt-1">
                            {serverTotals.creditLimit.mode === 'warn'
                              ? (t('b2b.creditExceededWarn') || 'Order exceeds available credit. You may override with confirmation below.')
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
              </div>
            )}

            {/* Partial Payment Section - only for CASH/CARD/CHECK */}
            {isImmediatePayment && (
              <div className={`bg-amber-50 p-3 rounded-lg border border-amber-200 space-y-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                <p className="text-xs text-amber-800 mb-2">{t('partialPayment.hint')}</p>
                <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setPayPartial(false)}
                    className={`flex-1 min-h-[36px] px-3 py-2 rounded-lg border text-sm font-medium transition-all ${!payPartial ? 'border-amber-600 bg-amber-100 text-amber-900' : 'border-amber-200 bg-white text-gray-700 hover:border-amber-300'}`}
                  >
                    {t('partialPayment.payInFull')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPayPartial(true);
                      setPartialAmount(saleTotal);
                    }}
                    className={`flex-1 min-h-[36px] px-3 py-2 rounded-lg border text-sm font-medium transition-all ${payPartial ? 'border-amber-600 bg-amber-100 text-amber-900' : 'border-amber-200 bg-white text-gray-700 hover:border-amber-300'}`}
                  >
                    {t('partialPayment.payPartial')}
                  </button>
                </div>
                {payPartial && (
                  <div className="mt-2 space-y-1">
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
                          if (!Number.isNaN(val)) {
                            setPartialAmount(Math.max(0, Math.min(saleTotal, val)));
                          } else {
                            setPartialAmount(0);
                          }
                        }}
                        placeholder={formatAmount(saleTotal)}
                        dir="ltr"
                        className="flex-1 min-w-0 px-3 py-2 text-sm border-0 focus:ring-0"
                      />
                    </div>
                    {effectiveAmountToCharge < saleTotal && effectiveAmountToCharge > 0 && (
                      <p className={`text-sm font-medium text-amber-800 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('partialPayment.remainingDue')}: {currencyCode} {formatAmount(saleTotal - effectiveAmountToCharge)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Split Payment Legs — visible only for immediate payment methods */}
            {isImmediatePayment && (
              <div className={`bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <h3 className="font-semibold text-gray-900 text-sm">{t('splitPayment.title')}</h3>
                  {paymentLegs.length > 1 && (
                    <span className={`text-xs font-medium ${legsValid ? 'text-green-700' : 'text-amber-700'}`}>
                      {t('splitPayment.remaining')}: {currencyCode} {formatAmount(legRemaining)}
                    </span>
                  )}
                </div>

                {/* Leg rows */}
                {paymentLegs.map((leg, idx) => (
                  <div key={`${legIdPrefix}-leg-${idx}`} className={`flex gap-2 items-start ${isRTL ? 'flex-row-reverse' : ''}`}>
                    {/* Method selector */}
                    <select
                      value={leg.method}
                      onChange={(e) => {
                        const updated = [...paymentLegs];
                        updated[idx] = { ...updated[idx], method: e.target.value as PaymentMethodCode };
                        setPaymentLegs(updated);
                      }}
                      className="flex-shrink-0 w-36 px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                      aria-label={t('splitPayment.method')}
                    >
                      {IMMEDIATE_METHOD_CODES.map((code) => (
                        <option key={code} value={code}>
                          {getPaymentLabel(code)}
                        </option>
                      ))}
                    </select>

                    {/* Amount input */}
                    <div className="flex-1 flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                      <span className={`px-2 text-gray-500 text-sm bg-gray-50 ${isRTL ? 'order-2' : ''}`}>{currencyCode}</span>
                      <input
                        type="number"
                        min={0}
                        step={Math.pow(10, -decimalPlaces)}
                        value={leg.amount > 0 ? leg.amount : ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          const updated = [...paymentLegs];
                          updated[idx] = { ...updated[idx], amount: Number.isFinite(val) ? Math.max(0, val) : 0 };
                          setPaymentLegs(updated);
                        }}
                        placeholder={formatAmount(0)}
                        dir="ltr"
                        className="flex-1 min-w-0 px-3 py-2 text-sm border-0 focus:ring-0"
                        aria-label={t('splitPayment.amount')}
                      />
                    </div>

                    {/* Check fields for this leg */}
                    {leg.method === PAYMENT_METHODS.CHECK && (
                      <input
                        type="text"
                        dir="ltr"
                        value={leg.checkNumber ?? ''}
                        onChange={(e) => {
                          const updated = [...paymentLegs];
                          updated[idx] = { ...updated[idx], checkNumber: e.target.value };
                          setPaymentLegs(updated);
                        }}
                        placeholder={t('checkNumber.placeholder')}
                        className="w-28 px-2 py-2 text-sm border border-gray-300 rounded-lg"
                        aria-label={t('checkNumber.label')}
                      />
                    )}

                    {/* Remove button (only when >1 legs) */}
                    {paymentLegs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPaymentLegs((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                        aria-label={t('splitPayment.remove')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Remaining indicator when multiple legs */}
                {paymentLegs.length > 1 && !legsValid && (
                  <p className={`text-xs font-medium text-amber-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('splitPayment.validation.sumMismatch')} ({currencyCode} {formatAmount(Math.abs(saleTotal - legSum))})
                  </p>
                )}

                {/* Add another method */}
                <button
                  type="button"
                  onClick={() => setPaymentLegs((prev) => [
                    ...prev,
                    { method: PAYMENT_METHODS.CASH as PaymentMethodCode, amount: parseFloat(legRemaining.toFixed(decimalPlaces)) },
                  ])}
                  className={`flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:underline ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  <PlusCircle className="w-4 h-4" />
                  {t('splitPayment.addMethod')}
                </button>
              </div>
            )}

            {/* Inline Discount Row */}
            <div>
              <h3 className={`font-semibold text-gray-900 mb-2 text-sm flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''} ${isRTL ? 'text-right' : 'text-left'}`}>
                <Tag className="w-4 h-4" />
                {t('discount')}
              </h3>
              <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="flex-1 flex items-center border border-gray-300 rounded-lg overflow-hidden">
                  <span className={`px-2 text-gray-500 text-sm bg-gray-50 ${isRTL ? 'order-2' : ''}`}>%</span>
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
                        className="flex-1 min-w-0 px-2 py-2 text-sm text-center border-0 focus:ring-0"
                        placeholder={t('manualDiscount.percentPlaceholder')}
                      />
                    )}
                  />
                </div>
                <div className="flex-1 flex items-center border border-gray-300 rounded-lg overflow-hidden">
                  <span className={`px-2 text-gray-500 text-sm bg-gray-50 ${isRTL ? 'order-2' : ''}`}>{currencyCode}</span>
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
                            : field.value && field.value > 0
                              ? String(field.value)
                              : ''
                        }
                        onFocus={() => {
                          setAmountDiscountFocused(true);
                          const v = Number(field.value) || 0;
                          setAmountDiscountDraft(v > 0 ? String(v) : '');
                        }}
                        onBlur={() => {
                          setAmountDiscountFocused(false);
                          const raw = sanitizeAmountDiscountDraft(amountDiscountDraft.trim());
                          const n = raw === '' || raw === '.' ? 0 : parseFloat(raw);
                          const value = Number.isFinite(n) ? Math.max(0, Math.min(n, total)) : 0;
                          field.onChange(value);
                          if (value > 0) setValue('percentDiscount', 0);
                          setAmountDiscountDraft('');
                        }}
                        onChange={(e) => {
                          const s = sanitizeAmountDiscountDraft(e.target.value);
                          setAmountDiscountDraft(s);
                          if (s === '' || s === '.') {
                            field.onChange(0);
                            return;
                          }
                          const n = parseFloat(s);
                          if (Number.isFinite(n)) {
                            const value = Math.max(0, Math.min(n, total));
                            field.onChange(value);
                            if (value > 0) setValue('percentDiscount', 0);
                          }
                        }}
                        dir="ltr"
                        className="flex-1 min-w-0 px-2 py-2 text-sm text-center border-0 focus:ring-0"
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
            </div>

            {/* Check fields */}
            {paymentMethod === PAYMENT_METHODS.CHECK && (
              <div className={`bg-purple-50 p-3 rounded-lg border border-purple-200 space-y-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                <Controller
                  name="checkNumber"
                  control={control}
                  render={({ field }) => (
                    <>
                      <label className={`block text-sm font-medium text-gray-900 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('checkNumber.label')} *
                      </label>
                      <input
                        {...field}
                        type="text"
                        dir="ltr"
                        className={`w-full px-3 py-2 text-sm border ${errors.checkNumber ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-purple-500 ${isRTL ? 'text-right' : 'text-left'}`}
                        placeholder={t('checkNumber.placeholder')}
                      />
                      {errors.checkNumber && (
                        <p className="mt-1 text-xs text-red-600">{errors.checkNumber.message}</p>
                      )}
                    </>
                  )}
                />
                <Controller
                  name="checkBank"
                  control={control}
                  render={({ field }) => (
                    <>
                      <label className={`block text-sm font-medium text-gray-900 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('checkBank.label')}
                      </label>
                      <input
                        {...field}
                        type="text"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        dir="ltr"
                        className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 ${isRTL ? 'text-right' : 'text-left'}`}
                        placeholder={t('checkBank.placeholder')}
                      />
                    </>
                  )}
                />
                <Controller
                  name="checkDate"
                  control={control}
                  render={({ field }) => (
                    <>
                      <label className={`block text-sm font-medium text-gray-900 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('checkDate.label')}
                      </label>
                      <input
                        {...field}
                        type="date"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || '')}
                        className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 ${isRTL ? 'text-right' : 'text-left'}`}
                      />
                    </>
                  )}
                />
              </div>
            )}

            {/* Payment notes */}
            <div>
              <Controller
                name="paymentNotes"
                control={control}
                render={({ field }) => (
                  <>
                    <label htmlFor="payment-notes" className={`block text-sm font-medium text-gray-900 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('paymentNotes') || 'Payment notes'}
                    </label>
                    <textarea
                      {...field}
                      id="payment-notes"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value)}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      rows={2}
                      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${isRTL ? 'text-right' : 'text-left'}`}
                      placeholder={t('paymentNotesPlaceholder') || 'Optional payment-related notes...'}
                      aria-label={t('paymentNotes') || 'Payment notes'}
                    />
                  </>
                )}
              />
            </div>

            {/* Collapsible: Have a coupon? — hidden while NEW_ORDER_PROMO_GIFT_DISABLED */}
            {!NEW_ORDER_PROMO_GIFT_DISABLED && (
            <div>
              {(appliedPromoCode || appliedGiftCard) && (
                <div className={`p-2 bg-green-50 border border-green-200 rounded-lg mb-2 space-y-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {appliedPromoCode && (
                    <div className={`flex items-center justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-gray-600">{t('promoCode.label') || 'Promo Code'}</span>
                      <span className="text-green-800 font-medium">
                        {appliedPromoCode.code}: -{currencyCode} {formatAmount(appliedPromoCode.discount)}
                      </span>
                    </div>
                  )}
                  {appliedGiftCard && (
                    <>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {t('giftCard.settlements') || 'Settlements'}
                      </p>
                      <div className={`flex items-center justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span className="text-gray-600">
                          {/* Truncate code to first 12 chars for tight spaces */}
                          {`${t('giftCard.label') || 'Gift Card'} (${appliedGiftCard.number.slice(0, 12)}${appliedGiftCard.number.length > 12 ? '…' : ''})`}
                        </span>
                        <span className="text-purple-800 font-medium">
                          -{currencyCode} {formatAmount(appliedGiftCard.amount)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => setCouponOpen(!couponOpen)}
                aria-expanded={showCouponContent}
                aria-controls="coupon-section"
                className={`flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:underline ${isRTL ? 'flex-row-reverse' : ''} ${(appliedPromoCode || appliedGiftCard) ? 'mt-0' : ''}`}
              >
                {showCouponContent ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {t('haveCoupon')}
              </button>

              {showCouponContent && (
                <div id="coupon-section" className="mt-2 space-y-2 border-t pt-2">
                  {!appliedPromoCode ? (
                    <div className="space-y-1">
                      <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Controller
                          name="promoCode"
                          control={control}
                          render={({ field }) => (
                            <input
                              {...field}
                              type="text"
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleValidatePromoCode())}
                              dir="ltr"
                              className={`flex-1 min-w-0 px-3 py-2 text-sm border ${errors.promoCode ? 'border-red-500' : 'border-gray-300'} rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}
                              placeholder={t('promoCode.placeholder')}
                              disabled={promoCodeValidating}
                            />
                          )}
                        />
                        <button
                          type="button"
                          onClick={handleValidatePromoCode}
                          disabled={!promoCode?.trim() || promoCodeValidating}
                          className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
                        >
                          {promoCodeValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : t('promoCode.apply')}
                        </button>
                      </div>
                      {(promoCodeResult && !promoCodeResult.isValid) && (
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
                        <span className="text-sm font-medium text-green-900">{appliedPromoCode.code} -{currencyCode} {formatAmount(appliedPromoCode.discount)}</span>
                      </div>
                      <button type="button" onClick={handleClearPromoCode} className="text-xs text-red-600 hover:underline">
                        {t('promoCode.remove')}
                      </button>
                    </div>
                  )}

                  {!appliedGiftCard ? (
                    <div className="space-y-3">
                      {/* Card code row */}
                      <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Controller
                          name="giftCardNumber"
                          control={control}
                          render={({ field }) => (
                            <input
                              {...field}
                              type="text"
                              value={field.value || ''}
                              onChange={(e) => {
                                field.onChange(e.target.value.toUpperCase());
                                // Reset PIN state whenever the code changes
                                if (pinRequired) {
                                  setPinRequired(false);
                                  setGiftCardPin('');
                                  setPinVisible(false);
                                  setPinFieldError(null);
                                  setGiftCardResult(null);
                                }
                              }}
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleFetchGiftCardDetails())}
                              dir="ltr"
                              className={`flex-1 min-w-0 px-3 py-2 text-sm border ${errors.giftCardNumber ? 'border-red-500' : 'border-gray-300'} rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}
                              placeholder={t('giftCard.placeholder')}
                              disabled={giftCardValidating}
                            />
                          )}
                        />
                        <button
                          type="button"
                          onClick={handleFetchGiftCardDetails}
                          disabled={
                            !giftCardNumber?.trim() ||
                            giftCardValidating ||
                            (pinRequired && !giftCardPin.trim())
                          }
                          className={`px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
                        >
                          {giftCardValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : t('giftCard.fetch')}
                        </button>
                      </div>

                      {/* PIN field — revealed when backend signals PIN is required */}
                      {pinRequired && (
                        <div className={`rounded-lg border border-purple-300 bg-purple-50 p-3 space-y-2 ${isRTL ? 'text-right' : ''}`}>
                          <div className={`flex items-center gap-1.5 text-xs text-purple-700 font-medium ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <KeyRound className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{t('giftCard.pinPrompt')}</span>
                          </div>
                          {pinFieldError && (
                            <div className={`flex items-center gap-1.5 text-xs text-red-600 font-medium ${isRTL ? 'flex-row-reverse' : ''}`}>
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
                              // eslint-disable-next-line jsx-a11y/no-autofocus
                              autoFocus
                              autoComplete="one-time-code"
                              placeholder={t('giftCard.pinPlaceholder')}
                              className={`w-full px-3 py-2 text-sm border border-purple-400 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${isRTL ? 'pr-3 pl-10 text-right' : 'pr-10'}`}
                            />
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => setPinVisible((v) => !v)}
                              className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-2' : 'right-2'} text-gray-400 hover:text-gray-600 focus:outline-none`}
                            >
                              {pinVisible
                                ? <EyeOff className="w-4 h-4" />
                                : <Eye className="w-4 h-4" />
                              }
                            </button>
                          </div>
                          <p className={`text-xs text-purple-600 font-medium ${isRTL ? 'text-right' : ''}`}>
                            {t('giftCard.pinLabel')}
                          </p>
                        </div>
                      )}

                      {/* Error banner (shown for wrong PIN or other errors — NOT for "PIN required" trigger) */}
                      {(giftCardResult && !giftCardResult.isValid) && (
                        <div className={`flex items-center gap-2 text-red-600 text-xs ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{resolveGiftCardError(giftCardResult)}</span>
                        </div>
                      )}
                      {giftCardDetails && (
                        <div className={`space-y-3 p-3 rounded-lg border border-purple-200 bg-purple-50 ${isRTL ? 'text-right' : 'text-left'}`}>
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
                          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
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
                                    className="flex-1 min-w-0 px-2 py-2 text-sm border-0 focus:ring-0"
                                    placeholder={t('giftCard.amountPlaceholder')}
                                  />
                                )}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleApplyGiftCard}
                              disabled={giftCardAmount === undefined || giftCardAmount <= 0}
                              className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium text-white ${giftCardAmount && giftCardAmount > 0 ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-300 cursor-not-allowed'}`}
                            >
                              {t('giftCard.applyAmount')}
                            </button>
                          </div>
                          {/* Live preview: balance after apply + remaining due */}
                          {giftCardDetails && Number(giftCardAmount) > 0 && (
                            <div className={`space-y-0.5 text-xs text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                              <p>
                                {t('giftCard.balanceAfterApply', {
                                  balance: `${currencyCode} ${formatAmount(Math.max(0, giftCardDetails.balance - Number(giftCardAmount)))}`
                                })}
                              </p>
                              <p>
                                {t('giftCard.remainingDue', {
                                  amount: `${currencyCode} ${formatAmount(Math.max(0, saleTotal - Number(giftCardAmount)))}`
                                })}
                              </p>
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
                </div>
              )}
            </div>
            )}
          </div>

          {/* Fixed Footer */}
          <footer className="flex-shrink-0 p-4 border-t border-gray-200 bg-gray-50 space-y-3">
            <div
              className={`rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800 space-y-1 ${isRTL ? 'text-right' : 'text-left'}`}
            >
              <p className="font-semibold text-gray-900 mb-1">{t('summary.title')}</p>
              <div className={`flex justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-gray-600">{t('summary.subtotal')}</span>
                <span className="font-medium tabular-nums">{currencyCode} {formatAmount(totals.subtotal)}</span>
              </div>
              {(totals.autoRuleDiscount ?? 0) > 0 && (
                <div className={`flex justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-gray-600">{t('summary.rulesDiscount')}</span>
                  <span className="font-medium text-red-700 tabular-nums">−{currencyCode} {formatAmount(totals.autoRuleDiscount ?? 0)}</span>
                </div>
              )}
              {totals.manualDiscount > 0 && (
                <div className={`flex justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-gray-600">{t('summary.manualDiscount')}</span>
                  <span className="font-medium text-red-700 tabular-nums">−{currencyCode} {formatAmount(totals.manualDiscount)}</span>
                </div>
              )}
              {totals.promoDiscount > 0 && (
                <div className={`flex justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-gray-600">{t('summary.promoDiscount')}</span>
                  <span className="font-medium text-red-700 tabular-nums">−{currencyCode} {formatAmount(totals.promoDiscount)}</span>
                </div>
              )}
              <div className={`flex justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-gray-600">{t('summary.vatValue')} ({totals.vatTaxPercent.toFixed(0)}%)</span>
                <span className="font-medium tabular-nums">{currencyCode} {formatAmount(totals.vatValue)}</span>
              </div>
              {(totals.taxAmount ?? 0) > 0 && (
                <div className={`flex justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-gray-600">{t('summary.taxAmount')}</span>
                  <span className="font-medium tabular-nums">{currencyCode} {formatAmount(totals.taxAmount ?? 0)}</span>
                </div>
              )}
              {totals.giftCardApplied > 0 && (
                <div className={`flex justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-gray-600">{t('summary.giftCardApplied')}</span>
                  <span className="font-medium text-red-700 tabular-nums">−{currencyCode} {formatAmount(totals.giftCardApplied)}</span>
                </div>
              )}
              <div className={`flex justify-between gap-2 border-t border-gray-100 pt-1.5 mt-1 font-bold ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span>{t('summary.totalAmount')}</span>
                <span className="tabular-nums">{currencyCode} {formatAmount(saleTotal)}</span>
              </div>
              {totals.totalSavings > 0 && (
                <div className={`flex justify-between gap-2 text-green-700 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span>{t('summary.totalSavings')}</span>
                  <span className="font-semibold tabular-nums">{currencyCode} {formatAmount(totals.totalSavings)}</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2 mt-1 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('summary.settlementSection')}</p>
                <div className={`flex justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-gray-600">{t('summary.paidCash')}</span>
                  <span className="font-medium tabular-nums">
                    {paymentMethod === PAYMENT_METHODS.CASH && isImmediatePayment
                      ? `${currencyCode} ${formatAmount(effectiveAmountToCharge)}`
                      : `${currencyCode} ${formatAmount(0)}`}
                  </span>
                </div>
                <div className={`flex justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-gray-600">{t('summary.paidCard')}</span>
                  <span className="font-medium tabular-nums">
                    {paymentMethod === PAYMENT_METHODS.CARD && isImmediatePayment
                      ? `${currencyCode} ${formatAmount(effectiveAmountToCharge)}`
                      : `${currencyCode} ${formatAmount(0)}`}
                  </span>
                </div>
                <div className={`flex justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-gray-600">{t('summary.paidCheck')}</span>
                  <span className="font-medium tabular-nums">
                    {paymentMethod === PAYMENT_METHODS.CHECK && isImmediatePayment
                      ? `${currencyCode} ${formatAmount(effectiveAmountToCharge)}`
                      : `${currencyCode} ${formatAmount(0)}`}
                  </span>
                </div>
                <div className={`flex justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-gray-600">{t('summary.deferredPayOnCollection')}</span>
                  <span className="font-medium tabular-nums">
                    {paymentMethod === PAYMENT_METHODS.PAY_ON_COLLECTION
                      ? `${currencyCode} ${formatAmount(saleTotal)}`
                      : `${currencyCode} ${formatAmount(0)}`}
                  </span>
                </div>
                <div className={`flex justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-gray-600">{t('summary.deferredInvoice')}</span>
                  <span className="font-medium tabular-nums">
                    {paymentMethod === PAYMENT_METHODS.INVOICE
                      ? `${currencyCode} ${formatAmount(saleTotal)}`
                      : `${currencyCode} ${formatAmount(0)}`}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={
                loading ||
                totalsLoading ||
                (paymentMethod === PAYMENT_METHODS.CHECK && !isMultiLeg && !watch('checkNumber')?.trim()) ||
                (payPartial && isImmediatePayment && !isMultiLeg && effectiveAmountToCharge <= 0) ||
                (isMultiLeg && !legsValid) ||
                (serverTotals?.creditLimit?.wouldExceed &&
                  (serverTotals.creditLimit.mode !== 'warn' || !creditLimitOverride))
              }
              className={`w-full min-h-[44px] px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-bold text-lg transition-all flex items-center ${isRTL ? 'flex-row-reverse' : ''} justify-center gap-2`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('actions.processing')}
                </>
              ) : (
                submitButtonLabel
              )}
            </button>
            {paymentMethod === PAYMENT_METHODS.CHECK && !isMultiLeg && !watch('checkNumber')?.trim() && (
              <p className={`text-xs text-center text-red-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('checkNumber.required')}
              </p>
            )}
            <p className={`text-xs text-center text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('messages.paymentMethodNote', { method: getPaymentLabel(paymentMethod || PAYMENT_METHODS.PAY_ON_COLLECTION) })}
            </p>
          </footer>
        </form>
      </div>
    </div>
  );
}
