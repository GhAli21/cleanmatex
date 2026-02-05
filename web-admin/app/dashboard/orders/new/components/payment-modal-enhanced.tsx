/**
 * Enhanced Payment Modal Component
 * Modal for payment options with full promo code and gift card validation
 * Refactored to use React Hook Form with Zod validation
 * Matches UI screenshots from PRD-010 Advanced Orders
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  X, CreditCard, Banknote, Package, FileText, CheckSquare,
  Tag, Gift, Loader2, CheckCircle, AlertCircle
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { PAYMENT_OPTIONS } from '@/lib/types/order-creation';
import { validatePromoCodeAction } from '@/app/actions/payments/validate-promo';
import { validateGiftCardAction } from '@/app/actions/payments/validate-gift-card';
import { getCurrencyConfigAction } from '@/app/actions/tenant/get-currency-config';
import type { ValidatePromoCodeResult, ValidateGiftCardResult } from '@/lib/types/payment';
import { paymentFormSchema, type PaymentFormData } from '@features/orders/model/payment-form-schema';
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
  tenantOrgId: string;
  customerId?: string;
  serviceCategories?: string[];
  branchId?: string;
  loading?: boolean;
}

export function PaymentModalEnhanced({
  open,
  onClose,
  onSubmit,
  total,
  tenantOrgId,
  customerId,
  serviceCategories,
  branchId,
  loading = false,
}: PaymentModalProps) {
  const t = useTranslations('newOrder.payment');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();

  // React Hook Form setup
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      paymentMethod: PAYMENT_METHODS.PAY_ON_COLLECTION,
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
    criteriaMode: 'all', // Show all validation errors
  });

  // Watch form values
  const paymentMethod = watch('paymentMethod');
  const percentDiscount = watch('percentDiscount');
  const amountDiscount = watch('amountDiscount');
  const promoCode = watch('promoCode');
  const giftCardNumber = watch('giftCardNumber');
  const payAllOrders = watch('payAllOrders');

  // Promo code state
  const [promoCodeValidating, setPromoCodeValidating] = useState(false);
  const [promoCodeResult, setPromoCodeResult] = useState<ValidatePromoCodeResult | null>(null);
  const [appliedPromoCode, setAppliedPromoCode] = useState<{
    code: string;
    id: string;
    discount: number;
  } | null>(null);

  // Gift card state
  const [giftCardValidating, setGiftCardValidating] = useState(false);
  const [giftCardResult, setGiftCardResult] = useState<ValidateGiftCardResult | null>(null);
  const [appliedGiftCard, setAppliedGiftCard] = useState<{
    number: string;
    amount: number;
    balance: number;
  } | null>(null);

  // VAT rate state (used for VAT calculation)
  const [taxRate, setTaxRate] = useState<number>(0.06); // Default 6% VAT
  // Tax (distinct from VAT): rate % and optional manual amount
  const [orderTaxRate, setOrderTaxRate] = useState<number>(0);
  const [orderTaxAmount, setOrderTaxAmount] = useState<number>(0);

  // Currency config (fetched once when modal opens)
  const [currencyConfig, setCurrencyConfig] = useState<{
    currencyCode: string;
    decimalPlaces: number;
    currencyExRate: number;
  } | null>(null);

  // Load tax rate and currency when modal opens
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
        setCurrencyConfig({ currencyCode: 'OMR', decimalPlaces: 3, currencyExRate: 1 });
      });
    }
  }, [open, tenantOrgId, branchId]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        paymentMethod: PAYMENT_METHODS.PAY_ON_COLLECTION,
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
    }
  }, [open, reset]);

  const currencyCode = currencyConfig?.currencyCode ?? 'OMR';
  const decimalPlaces = currencyConfig?.decimalPlaces ?? 3;
  const formatAmount = (n: number) => n.toFixed(decimalPlaces);

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = total;

    // Manual discount
    let manualDiscount = 0;
    if (percentDiscount > 0) {
      manualDiscount += (subtotal * percentDiscount) / 100;
    }
    if (amountDiscount > 0) {
      manualDiscount += amountDiscount;
    }

    // Promo discount
    const promoDiscount = appliedPromoCode?.discount || 0;

    // Subtotal after discounts (before tax and VAT)
    const afterDiscounts = Math.max(0, subtotal - manualDiscount - promoDiscount);

    // Tax (distinct from VAT): use manual amount or compute from rate
    const taxAmount =
      orderTaxAmount > 0
        ? orderTaxAmount
        : parseFloat((afterDiscounts * (orderTaxRate / 100)).toFixed(3));
    const afterTax = afterDiscounts + taxAmount;

    // Calculate VAT on amount after tax
    const vatValue = parseFloat((afterTax * taxRate).toFixed(3));

    // Total after VAT
    const afterVat = afterTax + vatValue;

    // Gift card
    const giftCardApplied = appliedGiftCard?.amount || 0;

    // Final total (after VAT, minus gift card)
    const finalTotal = Math.max(0, afterVat - giftCardApplied);

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
  }, [total, percentDiscount, amountDiscount, appliedPromoCode, appliedGiftCard, taxRate, orderTaxRate, orderTaxAmount]);

  // Validate promo code
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

  // Clear promo code
  const handleClearPromoCode = () => {
    setValue('promoCode', '');
    setValue('promoCodeId', '');
    setValue('promoDiscount', 0);
    setPromoCodeResult(null);
    setAppliedPromoCode(null);
  };

  // Validate gift card
  const handleValidateGiftCard = async () => {
    if (!giftCardNumber?.trim()) return;

    setGiftCardValidating(true);
    setGiftCardResult(null);

    try {
      const result = await validateGiftCardAction({
        card_number: giftCardNumber,
      });

      setGiftCardResult(result);

      if (result.isValid && result.giftCard && result.availableBalance) {
        // Calculate how much to apply (min of balance and remaining total)
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

  // Clear gift card
  const handleClearGiftCard = () => {
    setValue('giftCardNumber', '');
    setValue('giftCardAmount', 0);
    setGiftCardResult(null);
    setAppliedGiftCard(null);
  };

  // Handle form submit: validate extended payload, then pass data + payload to parent
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
    switch (id) {
      case PAYMENT_METHODS.CASH:
        return <Banknote className="w-6 h-6" />;
      case PAYMENT_METHODS.CARD:
        return <CreditCard className="w-6 h-6" />;
      case PAYMENT_METHODS.PAY_ON_COLLECTION:
        return <Package className="w-6 h-6" />;
      case PAYMENT_METHODS.CHECK:
        return <CheckSquare className="w-6 h-6" />;
      case PAYMENT_METHODS.INVOICE:
        return <FileText className="w-6 h-6" />;
      default:
        return <Banknote className="w-6 h-6" />;
    }
  };

  const getPaymentLabel = (id: string) => {
    switch (id) {
      case PAYMENT_METHODS.CASH:
        return t('methods.cash');
      case PAYMENT_METHODS.CARD:
        return t('methods.card');
      case PAYMENT_METHODS.PAY_ON_COLLECTION:
        return t('methods.payOnCollection');
      case PAYMENT_METHODS.CHECK:
        return t('methods.check');
      case PAYMENT_METHODS.INVOICE:
        return t('methods.invoice');
      default:
        return id;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} p-6 border-b border-gray-200`}>
          <h2 className={`text-2xl font-bold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>{t('title')}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={tCommon('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmitForm)}>
          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Total Display */}
            <div className={`text-center p-6 bg-gradient-to-br from-blue-50 to-green-50 rounded-xl ${isRTL ? 'text-right' : 'text-left'}`}>
              <p className="text-sm text-gray-600 mb-1">{t('totalAmount')}</p>
              <p className="text-5xl font-bold text-gray-900">{currencyCode} {formatAmount(totals.finalTotal)}</p>
              {totals.totalSavings > 0 && (
                <div className={`mt-2 flex items-center ${isRTL ? 'flex-row-reverse justify-center' : 'justify-center'} gap-2`}>
                  <span className="text-sm text-gray-500 line-through">
                    {currencyCode} {formatAmount(total)}
                  </span>
                  <span className="text-sm font-semibold text-green-600">
                    {t('savings')} {currencyCode} {formatAmount(totals.totalSavings)}
                  </span>
                </div>
              )}
            </div>

            {/* VAT/Tax Breakdown */}
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="space-y-3">
                {/* Currency info */}
                <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} text-sm pb-2 border-b border-gray-200`}>
                  <span className="text-gray-600">{t('summary.currencyCode')}</span>
                  <span className="font-medium text-gray-900">{currencyCode}</span>
                </div>
                <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} text-sm pb-2 border-b border-gray-200`}>
                  <span className="text-gray-600">{t('summary.exchangeRate')}</span>
                  <span className="font-medium text-gray-900">{(currencyConfig?.currencyExRate ?? 1).toFixed(6)}</span>
                </div>
                {/* Sub-total */}
                <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
                  <span className="text-sm font-medium text-gray-700">{t('summary.subtotal')}</span>
                  <span className="text-sm font-semibold text-gray-900">{currencyCode} {formatAmount(totals.subtotal)}</span>
                </div>

                {/* Tax rate (%) - distinct from VAT */}
                <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
                  <span className="text-sm font-medium text-gray-700">{t('summary.taxRate')}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={orderTaxRate}
                      onChange={(e) => setOrderTaxRate(parseFloat(e.target.value) || 0)}
                      className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-right"
                    />
                    <span className="text-sm">%</span>
                  </div>
                </div>

                {/* Tax amount - distinct from VAT */}
                <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
                  <span className="text-sm font-medium text-gray-700">{t('summary.taxAmount')}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step={0.001}
                      value={orderTaxAmount > 0 ? orderTaxAmount : ''}
                      onChange={(e) => setOrderTaxAmount(parseFloat(e.target.value) || 0)}
                      placeholder={formatAmount(totals.taxAmount ?? 0)}
                      className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-right"
                    />
                    <span className="text-sm font-semibold text-gray-900">{currencyCode}</span>
                  </div>
                </div>

                {/* VAT Tax % */}
                <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
                  <span className="text-sm font-medium text-gray-700">{t('summary.vatTaxPercent')}</span>
                  <span className="text-sm font-semibold text-gray-900">{totals.vatTaxPercent.toFixed(2)}%</span>
                </div>

                {/* VAT Value */}
                <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
                  <span className="text-sm font-medium text-gray-700">{t('summary.vatValue')}</span>
                  <span className="text-sm font-semibold text-gray-900">{currencyCode} {formatAmount(totals.vatValue)}</span>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-300 my-2"></div>

                {/* Total */}
                <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
                  <span className="text-base font-bold text-gray-900">{t('summary.totalAmount')}</span>
                  <span className="text-base font-bold text-gray-900">{currencyCode} {formatAmount(totals.finalTotal)}</span>
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <div>
              <h3 className={`font-semibold text-gray-900 mb-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('methods.title')}</h3>
              <Controller
                name="paymentMethod"
                control={control}
                render={({ field }) => (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Cash */}
                      <button
                        type="button"
                          onClick={() => field.onChange(PAYMENT_METHODS.CASH)}
                        className={`
                          p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-3
                          ${field.value === PAYMENT_METHODS.CASH ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                        `}
                      >
                        <Banknote className={`w-12 h-12 ${field.value === PAYMENT_METHODS.CASH ? 'text-blue-600' : 'text-gray-600'}`} />
                        <span className="font-semibold">{t('methods.cash')}</span>
                      </button>

                      {/* Card */}
                      <button
                        type="button"
                        onClick={() => field.onChange(PAYMENT_METHODS.CARD)}
                        className={`
                          p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-3
                          ${field.value === PAYMENT_METHODS.CARD ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                        `}
                      >
                        <CreditCard className={`w-12 h-12 ${field.value === PAYMENT_METHODS.CARD ? 'text-blue-600' : 'text-gray-600'}`} />
                        <span className="font-semibold">{t('methods.card')}</span>
                      </button>
                    </div>

                    {/* Secondary Payment Methods */}
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <button
                        type="button"
                        onClick={() => field.onChange(PAYMENT_METHODS.PAY_ON_COLLECTION)}
                        className={`
                          p-4 rounded-xl border transition-all ${isRTL ? 'text-right' : 'text-left'}
                          ${field.value === PAYMENT_METHODS.PAY_ON_COLLECTION ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-gray-200'}
                        `}
                      >
                        <span className="text-sm font-medium">{t('methods.payOnCollection')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => field.onChange(PAYMENT_METHODS.CHECK)}
                        className={`
                          p-4 rounded-xl border transition-all ${isRTL ? 'text-right' : 'text-left'}
                          ${field.value === PAYMENT_METHODS.CHECK ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-gray-200'}
                        `}
                      >
                        <span className="text-sm font-medium">{t('methods.check')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => field.onChange(PAYMENT_METHODS.INVOICE)}
                        className={`
                          p-4 rounded-xl border transition-all ${isRTL ? 'text-right' : 'text-left'}
                          ${field.value === PAYMENT_METHODS.INVOICE ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-gray-200'}
                        `}
                      >
                        <span className="text-sm font-medium">{t('methods.invoice')}</span>
                      </button>
                    </div>
                  </>
                )}
              />
            </div>

            {/* Check fields - shown when payment method is CHECK */}
            {paymentMethod === PAYMENT_METHODS.CHECK && (
              <div className={`bg-purple-50 p-4 rounded-xl border border-purple-200 space-y-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                <Controller
                  name="checkNumber"
                  control={control}
                  render={({ field }) => (
                    <>
                      <label className={`block text-sm font-medium text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('checkNumber.label')} *
                      </label>
                      <input
                        {...field}
                        type="text"
                        dir="ltr"
                        className={`w-full px-4 py-3 border ${errors.checkNumber ? 'border-red-500' : 'border-gray-300'
                          } rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
                        placeholder={t('checkNumber.placeholder')}
                      />
                      {errors.checkNumber && (
                        <p className="mt-1 text-sm text-red-600">{errors.checkNumber.message}</p>
                      )}
                    </>
                  )}
                />
                <Controller
                  name="checkBank"
                  control={control}
                  render={({ field }) => (
                    <>
                      <label className={`block text-sm font-medium text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('checkBank.label')}
                      </label>
                      <input
                        {...field}
                        type="text"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        dir="ltr"
                        className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
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
                      <label className={`block text-sm font-medium text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('checkDate.label')}
                      </label>
                      <input
                        {...field}
                        type="date"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || '')}
                        className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
                      />
                    </>
                  )}
                />
              </div>
            )}

            {/* Discount Section */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className={`font-semibold text-gray-900 mb-4 flex items-center ${isRTL ? 'flex-row-reverse' : ''} gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                <Tag className="w-5 h-5" />
                {t('discount')}
              </h3>

              <div className="space-y-4">
                {/* Manual Discount Row */}
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button
                    type="button"
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                    onClick={() => {/* Toggle between % and amount */ }}
                  >
                    <span className="text-gray-700">%</span>
                  </button>
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
                          // Clear amount discount when percent is set
                          if (value > 0) {
                            setValue('amountDiscount', 0);
                          }
                        }}
                        dir="ltr"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center"
                        placeholder={t('manualDiscount.percentPlaceholder')}
                      />
                    )}
                  />
                  <span className="text-gray-600 text-sm font-medium w-16">{currencyCode}</span>
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
                          // Clear percent discount when amount is set
                          if (value > 0) {
                            setValue('percentDiscount', 0);
                          }
                        }}
                        dir="ltr"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center"
                        placeholder={t('manualDiscount.amountPlaceholder')}
                        step="0.001"
                      />
                    )}
                  />
                </div>
                {(errors.percentDiscount || errors.amountDiscount) && (
                  <p className="text-sm text-red-600">
                    {errors.percentDiscount?.message || errors.amountDiscount?.message}
                  </p>
                )}

                {/* Promo Code Section */}
                <div className="border-t pt-4">
                  <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} mb-2`}>
                    <button type="button" className={`text-sm text-blue-600 font-medium hover:underline ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('promoCode.addPromo')}
                    </button>
                    <button type="button" className={`text-sm text-blue-600 font-medium hover:underline ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('giftCard.label')}
                    </button>
                  </div>

                  {/* Promo Code Input */}
                  {!appliedPromoCode ? (
                    <div className="space-y-2">
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
                              className={`flex-1 px-4 py-2 border ${errors.promoCode ? 'border-red-500' : 'border-gray-300'
                                } rounded-lg focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
                              placeholder={t('promoCode.placeholder')}
                              disabled={promoCodeValidating}
                            />
                          )}
                        />
                        <button
                          type="button"
                          onClick={handleValidatePromoCode}
                          disabled={!promoCode?.trim() || promoCodeValidating}
                          className={`px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center ${isRTL ? 'flex-row-reverse' : ''} gap-2`}
                        >
                          {promoCodeValidating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t('promoCode.validating')}
                            </>
                          ) : (
                            t('promoCode.apply')
                          )}
                        </button>
                      </div>

                      {/* Promo Code Error */}
                      {(promoCodeResult && !promoCodeResult.isValid) && (
                        <div className={`flex items-center gap-2 text-red-600 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <AlertCircle className="w-4 h-4" />
                          <span className={isRTL ? 'text-right' : 'text-left'}>{promoCodeResult.error}</span>
                        </div>
                      )}
                      {errors.promoCode && (
                        <p className="text-sm text-red-600">{errors.promoCode.message}</p>
                      )}
                    </div>
                  ) : (
                    <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} p-3 bg-green-50 border border-green-200 rounded-lg`}>
                      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <div className={isRTL ? 'text-right' : 'text-left'}>
                          <p className="font-medium text-green-900">{appliedPromoCode.code}</p>
                          <p className="text-sm text-green-700">
                            -{currencyCode} {formatAmount(appliedPromoCode.discount)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearPromoCode}
                        className={`text-sm text-red-600 hover:text-red-700 font-medium ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        {t('promoCode.remove')}
                      </button>
                    </div>
                  )}

                  {/* Gift Card Input */}
                  {!appliedGiftCard ? (
                    <div className="space-y-2 mt-3">
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
                              className={`flex-1 px-4 py-2 border ${errors.giftCardNumber ? 'border-red-500' : 'border-gray-300'
                                } rounded-lg focus:ring-2 focus:ring-purple-500 ${isRTL ? 'text-right' : 'text-left'}`}
                              placeholder={t('giftCard.placeholder')}
                              disabled={giftCardValidating}
                            />
                          )}
                        />
                        <button
                          type="button"
                          onClick={handleValidateGiftCard}
                          disabled={!giftCardNumber?.trim() || giftCardValidating}
                          className={`px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors flex items-center ${isRTL ? 'flex-row-reverse' : ''} gap-2`}
                        >
                          {giftCardValidating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t('giftCard.checking')}
                            </>
                          ) : (
                            t('giftCard.apply')
                          )}
                        </button>
                      </div>

                      {/* Gift Card Error */}
                      {(giftCardResult && !giftCardResult.isValid) && (
                        <div className={`flex items-center gap-2 text-red-600 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <AlertCircle className="w-4 h-4" />
                          <span className={isRTL ? 'text-right' : 'text-left'}>{giftCardResult.error}</span>
                        </div>
                      )}
                      {errors.giftCardNumber && (
                        <p className="text-sm text-red-600">{errors.giftCardNumber.message}</p>
                      )}
                    </div>
                  ) : (
                    <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} p-3 bg-purple-50 border border-purple-200 rounded-lg mt-3`}>
                      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Gift className="w-5 h-5 text-purple-600" />
                        <div className={isRTL ? 'text-right' : 'text-left'}>
                          <p className="font-medium text-purple-900">{appliedGiftCard.number}</p>
                          <p className="text-sm text-purple-700">
                            {t('giftCard.appliedAmount')}: -{currencyCode} {formatAmount(appliedGiftCard.amount)} | {t('giftCard.balance')}: {currencyCode} {formatAmount(appliedGiftCard.balance)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearGiftCard}
                        className={`text-sm text-red-600 hover:text-red-700 font-medium ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        {t('giftCard.remove')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Pay All Orders Toggle */}
                <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} p-3 bg-gray-50 rounded-lg border border-gray-200`}>
                  <span className={`text-sm font-medium text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>{t('payAllOrders.label')}</span>
                  <Controller
                    name="payAllOrders"
                    control={control}
                    render={({ field }) => (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          {...field}
                          type="checkbox"
                          checked={field.value}
                          className="sr-only peer"
                        />
                        <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer ${isRTL ? 'peer-checked:after:-translate-x-full' : 'peer-checked:after:translate-x-full'} peer-checked:after:border-white after:content-[''] after:absolute ${isRTL ? 'after:top-[2px] after:right-[2px]' : 'after:top-[2px] after:left-[2px]'} after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600`}></div>
                      </label>
                    )}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer - Submit Button */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <button
              type="submit"
              disabled={loading || (paymentMethod === 'check' && !watch('checkNumber')?.trim())}
              className={`w-full h-16 px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xl transition-all shadow-lg hover:shadow-xl flex items-center ${isRTL ? 'flex-row-reverse' : ''} justify-center gap-2`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  {t('actions.processing')}
                </>
              ) : (
                `${t('actions.submit')} - ${currencyCode} ${formatAmount(totals.finalTotal)}`
              )}
            </button>
            {/* Show validation errors - only if there are actual errors */}
            {(() => {
              // Check for any actual errors
              const errorEntries = Object.entries(errors).filter(([_, error]) => error);

              if (errorEntries.length === 0) return null;

              return (
                <div className={`space-y-1 mt-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <p className="text-xs font-semibold text-red-600 text-center">
                    {t('messages.validationErrors') || 'Please fix the following errors:'}
                  </p>
                  {errors.checkNumber && (
                    <p className="text-xs text-red-600 text-center">
                      {errors.checkNumber.message || t('checkNumber.required') || 'Check number is required'}
                    </p>
                  )}
                  {errors.percentDiscount && (
                    <p className="text-xs text-red-600 text-center">
                      {errors.percentDiscount.message}
                    </p>
                  )}
                  {errors.amountDiscount && (
                    <p className="text-xs text-red-600 text-center">
                      {errors.amountDiscount.message}
                    </p>
                  )}
                  {errors.promoCode && (
                    <p className="text-xs text-red-600 text-center">
                      {errors.promoCode.message}
                    </p>
                  )}
                  {errors.promoCodeId && (
                    <p className="text-xs text-red-600 text-center">
                      {errors.promoCodeId.message || 'Promo code must be validated before submitting'}
                    </p>
                  )}
                  {errors.giftCardNumber && (
                    <p className="text-xs text-red-600 text-center">
                      {errors.giftCardNumber.message}
                    </p>
                  )}
                  {errors.giftCardAmount && (
                    <p className="text-xs text-red-600 text-center">
                      {errors.giftCardAmount.message || 'Gift card must be validated before submitting'}
                    </p>
                  )}
                  {errors.paymentMethod && (
                    <p className="text-xs text-red-600 text-center">
                      {errors.paymentMethod.message}
                    </p>
                  )}
                  {/* Fallback: Show any other errors that might exist */}
                  {errorEntries.map(([field, error]: [string, any]) => {
                    // Skip if we already displayed this error above
                    if (['checkNumber', 'percentDiscount', 'amountDiscount', 'promoCode', 'promoCodeId', 'giftCardNumber', 'giftCardAmount', 'paymentMethod'].includes(field)) {
                      return null;
                    }
                    const message = error?.message || (Array.isArray(error) ? error[0]?.message : String(error));
                    if (!message) return null;
                    return (
                      <p key={field} className="text-xs text-red-600 text-center">
                        {message}
                      </p>
                    );
                  })}
                </div>
              );
            })()}
            {paymentMethod === 'check' && !watch('checkNumber')?.trim() && (
              <p className={`text-xs text-center text-red-600 mt-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('checkNumber.required') || 'Please enter a check number to continue'}
              </p>
            )}
            {!isValid && Object.keys(errors).length === 0 && paymentMethod !== 'check' && (
              <p className={`text-xs text-center text-gray-500 mt-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('messages.readyToSubmit') || 'Ready to submit'}
              </p>
            )}
            <p className={`text-xs text-center text-gray-500 mt-3 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('messages.paymentMethodNote', { method: getPaymentLabel(paymentMethod || 'pay_on_collection') })}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
