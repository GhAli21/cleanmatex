/**
 * Payment Modal Component (Canonical)
 * Single-screen layout with fixed footer, dense grid, and collapsible promo section.
 * Promo code and gift card validation via validatePromoCodeAction / validateGiftCardAction.
 */

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  X, CreditCard, Banknote, Package, FileText, CheckSquare,
  Tag, Gift, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronUp
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
import { newOrderPaymentPayloadSchema, type NewOrderPaymentPayload } from '@/lib/validations/new-order-payment-schemas';
import { cmxMessage } from '@ui/feedback';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with form data and extended payload (amountToCharge, totals) for invoice/payment flow */
  onSubmit: (paymentData: PaymentFormData, payload: NewOrderPaymentPayload) => void;
  total: number;
  /** Items for server-side preview (productId, quantity) */
  items: { productId: string; quantity: number }[];
  isExpress?: boolean;
  tenantOrgId: string;
  customerId?: string;
  serviceCategories?: string[];
  branchId?: string;
  /** When true, PAY_ON_COLLECTION is disabled (retail orders must be paid at POS) */
  isRetailOnlyOrder?: boolean;
  loading?: boolean;
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
  serviceCategories,
  branchId,
  isRetailOnlyOrder = false,
  loading = false,
}: PaymentModalProps) {
  const t = useTranslations('newOrder.payment');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const { token: csrfToken } = useCSRFToken();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(getPaymentFormSchema(total, t('validation.discountExceedsTotal'))),
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

  const [promoCodeValidating, setPromoCodeValidating] = useState(false);
  const [promoCodeResult, setPromoCodeResult] = useState<ValidatePromoCodeResult | null>(null);
  const [appliedPromoCode, setAppliedPromoCode] = useState<{
    code: string;
    id: string;
    discount: number;
  } | null>(null);

  const [giftCardValidating, setGiftCardValidating] = useState(false);
  const [giftCardResult, setGiftCardResult] = useState<ValidateGiftCardResult | null>(null);
  const [appliedGiftCard, setAppliedGiftCard] = useState<{
    number: string;
    amount: number;
    balance: number;
  } | null>(null);

  const [couponOpen, setCouponOpen] = useState(false);
  const [taxRate, setTaxRate] = useState<number>(0.06);
  const [orderTaxRate, setOrderTaxRate] = useState<number>(0);
  const [orderTaxAmount, setOrderTaxAmount] = useState<number>(0);

  const [serverTotals, setServerTotals] = useState<{
    subtotal: number;
    manualDiscount: number;
    promoDiscount: number;
    afterDiscounts: number;
    vatValue: number;
    giftCardApplied: number;
    finalTotal: number;
    vatTaxPercent: number;
  } | null>(null);
  const [totalsLoading, setTotalsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currencyConfig, setCurrencyConfig] = useState<{
    currencyCode: string;
    decimalPlaces: number;
    currencyExRate: number;
  } | null>(null);

  useEffect(() => {
    if (open && tenantOrgId) {
      taxService.getTaxRate(tenantOrgId).then(rate => {
        setTaxRate(rate);
      }).catch(() => {
        setTaxRate(0.05);
      });
      getCurrencyConfigAction(tenantOrgId, branchId).then(config => {
        setCurrencyConfig(config);
      }).catch(() => {
        setCurrencyConfig({ currencyCode: 'USD', decimalPlaces: 3, currencyExRate: 1 });
      });
    }
  }, [open, tenantOrgId, branchId]);

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
          customerId: customerId || undefined,
          isExpress,
          percentDiscount: percentDiscount ?? 0,
          amountDiscount: amountDiscount ?? 0,
          promoCode: (appliedPromoCode?.code ?? promoCode) || undefined,
          giftCardNumber: (appliedGiftCard?.number ?? giftCardNumber) || undefined,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        setServerTotals({
          subtotal: d.subtotal,
          manualDiscount: d.manualDiscount,
          promoDiscount: d.promoDiscount,
          afterDiscounts: d.afterDiscounts,
          vatValue: d.vatValue,
          giftCardApplied: d.giftCardApplied,
          finalTotal: d.finalTotal,
          vatTaxPercent: d.vatTaxPercent ?? 0,
        });
      } else if (!res.ok && json.errorCode === 'PRODUCT_NOT_FOUND') {
        setServerTotals(null);
        cmxMessage.error(json.error ?? t('errors.productNotFound'));
      } else if (!res.ok && json.error) {
        setServerTotals(null);
        cmxMessage.error(json.error);
      }
    } catch {
      setServerTotals(null);
    } finally {
      setTotalsLoading(false);
    }
  }, [open, items, tenantOrgId, customerId, isExpress, percentDiscount, amountDiscount, appliedPromoCode?.code, appliedGiftCard?.number, promoCode, giftCardNumber, csrfToken]);

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
        payAllOrders: false,
      });
      setPromoCodeResult(null);
      setAppliedPromoCode(null);
      setGiftCardResult(null);
      setAppliedGiftCard(null); 
      setCouponOpen(false);
    }
  }, [open, reset, isRetailOnlyOrder]);

  const currencyCode = currencyConfig?.currencyCode ?? 'USD';
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
    const promoDiscount = appliedPromoCode?.discount || 0;
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
      const finalTotalWithExtra = serverTotals.finalTotal + additionalTaxAmount;
      return {
        ...serverTotals,
        taxRate: orderTaxRate,
        taxAmount: additionalTaxAmount,
        finalTotal: finalTotalWithExtra,
        totalSavings: serverTotals.subtotal + serverTotals.vatValue - finalTotalWithExtra,
      };
    }
    const subtotal = total;
    const manualDiscount =
      percentDiscount > 0
        ? Math.min((subtotal * percentDiscount) / 100, subtotal)
        : Math.min(amountDiscount, subtotal);
    const promoDiscount = appliedPromoCode?.discount || 0;
    const afterDiscounts = Math.max(0, subtotal - manualDiscount - promoDiscount);
    const taxAmount = orderTaxAmount > 0 ? orderTaxAmount : parseFloat((afterDiscounts * (orderTaxRate / 100)).toFixed(decimalPlaces));
    const afterTax = afterDiscounts + taxAmount;
    const vatValue = parseFloat((afterTax * taxRate).toFixed(3));
    const giftCardApplied = appliedGiftCard?.amount || 0;
    const finalTotal = Math.max(0, afterTax + vatValue - giftCardApplied);
    return {
      subtotal,
      manualDiscount,
      promoDiscount,
      afterDiscounts,
      taxRate: orderTaxRate,
      taxAmount,
      vatTaxPercent: taxRate * 100,
      vatValue,
      giftCardApplied,
      finalTotal,
      totalSavings: subtotal + taxAmount + vatValue - finalTotal,
    };
  }, [serverTotals, total, percentDiscount, amountDiscount, appliedPromoCode, appliedGiftCard, taxRate, orderTaxRate, orderTaxAmount, afterDiscountsForTax, decimalPlaces]);

  const handleValidatePromoCode = async () => {
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
    setValue('promoCode', '');
    setValue('promoCodeId', '');
    setValue('promoDiscount', 0);
    setPromoCodeResult(null);
    setAppliedPromoCode(null);
  };

  const handleValidateGiftCard = async () => {
    if (!giftCardNumber?.trim()) return;
    setGiftCardValidating(true);
    setGiftCardResult(null);
    try {
      const result = await validateGiftCardAction({ card_number: giftCardNumber });
      setGiftCardResult(result);
      if (result.isValid && result.giftCard && result.availableBalance) {
        const amountToApply = Math.min(result.availableBalance, totals.afterDiscounts);
        const applied = {
          number: giftCardNumber,
          amount: amountToApply,
          balance: result.availableBalance,
        };
        setAppliedGiftCard(applied);
        setValue('giftCardNumber', giftCardNumber);
        setValue('giftCardAmount', amountToApply);
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

  const handleClearGiftCard = () => {
    setValue('giftCardNumber', '');
    setValue('giftCardAmount', 0);
    setGiftCardResult(null);
    setAppliedGiftCard(null);
  };

  const onSubmitForm = (data: PaymentFormData) => {
    const payload = {
      amountToCharge: totals.finalTotal,
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
    };
    const parsed = newOrderPaymentPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      cmxMessage.error(first ? `${first.path.join('.')}: ${first.message}` : t('errors.invalidAmount'));
      return;
    }
    onSubmit(data, parsed.data);
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

  const showCouponContent = couponOpen || appliedPromoCode || appliedGiftCard;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
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
                <p className="text-4xl font-bold text-gray-900">{currencyCode} {formatAmount(totals.finalTotal)}</p>
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
                <span className="text-gray-900">{currencyCode} {formatAmount(totals.finalTotal)}</span>
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
                        {...field}
                        type="number"
                        value={field.value || ''}
                        onChange={(e) => {
                          const value = Math.max(0, parseFloat(e.target.value) || 0);
                          field.onChange(value);
                          if (value > 0) setValue('percentDiscount', 0);
                        }}
                        dir="ltr"
                        className="flex-1 min-w-0 px-2 py-2 text-sm text-center border-0 focus:ring-0"
                        placeholder={t('manualDiscount.amountPlaceholder')}
                        step="0.001"
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

            {/* Collapsible: Have a coupon? */}
            <div>
              {(appliedPromoCode || appliedGiftCard) && (
                <div className={`flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg mb-2 gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex flex-wrap gap-2 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                    {appliedPromoCode && (
                      <span className="text-green-800">
                        Promo: -{currencyCode} {formatAmount(appliedPromoCode.discount)}
                      </span>
                    )}
                    {appliedGiftCard && (
                      <span className="text-green-800">
                        Gift: -{currencyCode} {formatAmount(appliedGiftCard.amount)}
                      </span>
                    )}
                  </div>
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
                    <div className="space-y-1">
                      <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Controller
                          name="giftCardNumber"
                          control={control}
                          render={({ field }) => (
                            <input
                              {...field}
                              type="text"
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleValidateGiftCard())}
                              dir="ltr"
                              className={`flex-1 min-w-0 px-3 py-2 text-sm border ${errors.giftCardNumber ? 'border-red-500' : 'border-gray-300'} rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}
                              placeholder={t('giftCard.placeholder')}
                              disabled={giftCardValidating}
                            />
                          )}
                        />
                        <button
                          type="button"
                          onClick={handleValidateGiftCard}
                          disabled={!giftCardNumber?.trim() || giftCardValidating}
                          className={`px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
                        >
                          {giftCardValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : t('giftCard.apply')}
                        </button>
                      </div>
                      {(giftCardResult && !giftCardResult.isValid) && (
                        <div className={`flex items-center gap-2 text-red-600 text-xs ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{giftCardResult.error}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`flex items-center justify-between p-2 bg-purple-50 border border-purple-200 rounded-lg ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Gift className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-900">{appliedGiftCard.number} -{currencyCode} {formatAmount(appliedGiftCard.amount)}</span>
                      </div>
                      <button type="button" onClick={handleClearGiftCard} className="text-xs text-red-600 hover:underline">
                        {t('giftCard.remove')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <footer className="flex-shrink-0 p-4 border-t border-gray-200 bg-gray-50 space-y-3">
            {totals.totalSavings > 0 && (
              <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-center' : 'justify-center'} gap-2`}>
                <span className="text-xs text-gray-500 line-through">{currencyCode} {formatAmount(total)}</span>
                <span className="text-xs font-semibold text-green-600">
                  {t('savings')} {currencyCode} {formatAmount(totals.totalSavings)}
                </span>
              </div>
            )}
            <button
              type="submit"
              disabled={loading || totalsLoading || (paymentMethod === PAYMENT_METHODS.CHECK && !watch('checkNumber')?.trim())}
              className={`w-full min-h-[44px] px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-bold text-lg transition-all flex items-center ${isRTL ? 'flex-row-reverse' : ''} justify-center gap-2`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('actions.processing')}
                </>
              ) : (
                `${t('actions.submit')} - ${currencyCode} ${formatAmount(totals.finalTotal)}`
              )}
            </button>
            {paymentMethod === PAYMENT_METHODS.CHECK && !watch('checkNumber')?.trim() && (
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
