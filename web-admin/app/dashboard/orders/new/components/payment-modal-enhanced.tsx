/**
 * Enhanced Payment Modal Component
 * Modal for payment options with full promo code and gift card validation
 * Matches UI screenshots from PRD-010 Advanced Orders
 */

'use client';

import { useState, useEffect } from 'react';
import {
  X, CreditCard, Banknote, Package, FileText, CheckSquare,
  Tag, Gift, Loader2, CheckCircle, AlertCircle
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { PAYMENT_OPTIONS } from '@/lib/types/order-creation';
import { validatePromoCodeAction } from '@/app/actions/payments/validate-promo';
import { validateGiftCardAction } from '@/app/actions/payments/validate-gift-card';
import type { ValidatePromoCodeResult, ValidateGiftCardResult } from '@/lib/types/payment';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (paymentData: {
    paymentMethod: string;
    checkNumber?: string;
    percentDiscount: number;
    amountDiscount: number;
    promoCode?: string;
    promoCodeId?: string;
    promoDiscount?: number;
    giftCardNumber?: string;
    giftCardAmount?: number;
    payAllOrders: boolean;
  }) => void;
  total: number;
  tenantOrgId: string;
  customerId?: string;
  serviceCategories?: string[];
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
  loading = false,
}: PaymentModalProps) {
  const t = useTranslations('newOrder.payment');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  
  // Payment method state
  const [selectedPayment, setSelectedPayment] = useState('pay_on_collection');
  const [checkNumber, setCheckNumber] = useState('');

  // Discount state
  const [percentDiscount, setPercentDiscount] = useState(0);
  const [amountDiscount, setAmountDiscount] = useState(0);

  // Promo code state
  const [promoCode, setPromoCode] = useState('');
  const [promoCodeValidating, setPromoCodeValidating] = useState(false);
  const [promoCodeResult, setPromoCodeResult] = useState<ValidatePromoCodeResult | null>(null);
  const [appliedPromoCode, setAppliedPromoCode] = useState<{
    code: string;
    id: string;
    discount: number;
  } | null>(null);

  // Gift card state
  const [giftCardNumber, setGiftCardNumber] = useState('');
  const [giftCardValidating, setGiftCardValidating] = useState(false);
  const [giftCardResult, setGiftCardResult] = useState<ValidateGiftCardResult | null>(null);
  const [appliedGiftCard, setAppliedGiftCard] = useState<{
    number: string;
    amount: number;
    balance: number;
  } | null>(null);

  // Pay all orders toggle
  const [payAllOrders, setPayAllOrders] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedPayment('pay_on_collection');
      setCheckNumber('');
      setPercentDiscount(0);
      setAmountDiscount(0);
      setPromoCode('');
      setPromoCodeResult(null);
      setAppliedPromoCode(null);
      setGiftCardNumber('');
      setGiftCardResult(null);
      setAppliedGiftCard(null);
      setPayAllOrders(false);
    }
  }, [open]);

  // Calculate totals
  const calculateTotals = () => {
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

    // Total after discounts
    const afterDiscounts = Math.max(0, subtotal - manualDiscount - promoDiscount);

    // Gift card
    const giftCardApplied = appliedGiftCard?.amount || 0;

    // Final total
    const finalTotal = Math.max(0, afterDiscounts - giftCardApplied);

    return {
      subtotal,
      manualDiscount,
      promoDiscount,
      giftCardApplied,
      afterDiscounts,
      finalTotal,
      totalSavings: subtotal - finalTotal,
    };
  };

  const totals = calculateTotals();

  // Validate promo code
  const handleValidatePromoCode = async () => {
    if (!promoCode.trim()) return;

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
        setAppliedPromoCode({
          code: promoCode,
          id: result.promoCode.id,
          discount: result.discountAmount,
        });
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
    setPromoCode('');
    setPromoCodeResult(null);
    setAppliedPromoCode(null);
  };

  // Validate gift card
  const handleValidateGiftCard = async () => {
    if (!giftCardNumber.trim()) return;

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
        setAppliedGiftCard({
          number: giftCardNumber,
          amount: amountToApply,
          balance: result.availableBalance,
        });
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
    setGiftCardNumber('');
    setGiftCardResult(null);
    setAppliedGiftCard(null);
  };

  // Handle submit
  const handleSubmit = () => {
    // Validate check number if check payment
    if (selectedPayment === 'check' && !checkNumber.trim()) {
      alert(t('messages.checkNumberRequired'));
      return;
    }

    onSubmit({
      paymentMethod: selectedPayment,
      checkNumber: selectedPayment === 'check' ? checkNumber : undefined,
      percentDiscount,
      amountDiscount,
      promoCode: appliedPromoCode?.code,
      promoCodeId: appliedPromoCode?.id,
      promoDiscount: appliedPromoCode?.discount,
      giftCardNumber: appliedGiftCard?.number,
      giftCardAmount: appliedGiftCard?.amount,
      payAllOrders,
    });
  };

  const getPaymentIcon = (id: string) => {
    switch (id) {
      case 'cash':
        return <Banknote className="w-6 h-6" />;
      case 'card':
        return <CreditCard className="w-6 h-6" />;
      case 'pay_on_collection':
        return <Package className="w-6 h-6" />;
      case 'check':
        return <CheckSquare className="w-6 h-6" />;
      case 'invoice':
        return <FileText className="w-6 h-6" />;
      default:
        return <Banknote className="w-6 h-6" />;
    }
  };

  const getPaymentLabel = (id: string) => {
    switch (id) {
      case 'cash':
        return t('methods.cash');
      case 'card':
        return t('methods.card');
      case 'pay_on_collection':
        return t('methods.payOnCollection');
      case 'check':
        return t('methods.check');
      case 'invoice':
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

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Total Display */}
          <div className={`text-center p-6 bg-gradient-to-br from-blue-50 to-green-50 rounded-xl ${isRTL ? 'text-right' : 'text-left'}`}>
            <p className="text-sm text-gray-600 mb-1">{t('totalAmount')}</p>
            <p className="text-5xl font-bold text-gray-900">OMR {totals.finalTotal.toFixed(3)}</p>
            {totals.totalSavings > 0 && (
              <div className={`mt-2 flex items-center ${isRTL ? 'flex-row-reverse justify-center' : 'justify-center'} gap-2`}>
                <span className="text-sm text-gray-500 line-through">
                  OMR {total.toFixed(3)}
                </span>
                <span className="text-sm font-semibold text-green-600">
                  {t('savings')} OMR {totals.totalSavings.toFixed(3)}
                </span>
              </div>
            )}
          </div>

          {/* Payment Methods - Matching Screenshots */}
          <div>
            <h3 className={`font-semibold text-gray-900 mb-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('methods.title')}</h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Cash */}
              <button
                onClick={() => setSelectedPayment('cash')}
                className={`
                  p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-3
                  ${selectedPayment === 'cash' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                `}
              >
                <Banknote className={`w-12 h-12 ${selectedPayment === 'cash' ? 'text-blue-600' : 'text-gray-600'}`} />
                <span className="font-semibold">{t('methods.cash')}</span>
              </button>

              {/* Card */}
              <button
                onClick={() => setSelectedPayment('card')}
                className={`
                  p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-3
                  ${selectedPayment === 'card' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                `}
              >
                <CreditCard className={`w-12 h-12 ${selectedPayment === 'card' ? 'text-blue-600' : 'text-gray-600'}`} />
                <span className="font-semibold">{t('methods.card')}</span>
              </button>
            </div>

            {/* Secondary Payment Methods */}
            <div className="grid grid-cols-3 gap-3 mt-3">
              <button
                onClick={() => setSelectedPayment('pay_on_collection')}
                className={`
                  p-4 rounded-xl border transition-all ${isRTL ? 'text-right' : 'text-left'}
                  ${selectedPayment === 'pay_on_collection' ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-gray-200'}
                `}
              >
                <span className="text-sm font-medium">{t('methods.payOnCollection')}</span>
              </button>

              <button
                onClick={() => setSelectedPayment('check')}
                className={`
                  p-4 rounded-xl border transition-all ${isRTL ? 'text-right' : 'text-left'}
                  ${selectedPayment === 'check' ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-gray-200'}
                `}
              >
                <span className="text-sm font-medium">{t('methods.check')}</span>
              </button>

              <button
                onClick={() => setSelectedPayment('invoice')}
                className={`
                  p-4 rounded-xl border transition-all ${isRTL ? 'text-right' : 'text-left'}
                  ${selectedPayment === 'invoice' ? 'bg-blue-500 text-white border-blue-600' : 'bg-white border-gray-200'}
                `}
              >
                <span className="text-sm font-medium">{t('methods.invoice')}</span>
              </button>
            </div>
          </div>

          {/* Check Number Field - Conditional */}
          {selectedPayment === 'check' && (
            <div className={`bg-purple-50 p-4 rounded-xl border border-purple-200 ${isRTL ? 'text-right' : 'text-left'}`}>
              <label className={`block text-sm font-medium text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('checkNumber.label')} *
              </label>
              <input
                type="text"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                dir="ltr"
                className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
                placeholder={t('checkNumber.placeholder')}
                required
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
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                  onClick={() => {/* Toggle between % and amount */}}
                >
                  <span className="text-gray-700">%</span>
                </button>
                <input
                  type="number"
                  value={percentDiscount || ''}
                  onChange={(e) => setPercentDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                  dir="ltr"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center"
                  placeholder={t('manualDiscount.percentPlaceholder')}
                />
                <span className="text-gray-600 text-sm font-medium w-16">OMR</span>
                <input
                  type="number"
                  value={amountDiscount || ''}
                  onChange={(e) => setAmountDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  dir="ltr"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center"
                  placeholder={t('manualDiscount.amountPlaceholder')}
                  step="0.001"
                />
              </div>

              {/* Promo Code Section */}
              <div className="border-t pt-4">
                <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} mb-2`}>
                  <button className={`text-sm text-blue-600 font-medium hover:underline ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('promoCode.addPromo')}
                  </button>
                  <button className={`text-sm text-blue-600 font-medium hover:underline ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('giftCard.label')}
                  </button>
                </div>

                {/* Promo Code Input */}
                {!appliedPromoCode ? (
                  <div className="space-y-2">
                    <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleValidatePromoCode()}
                        dir="ltr"
                        className={`flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
                        placeholder={t('promoCode.placeholder')}
                        disabled={promoCodeValidating}
                      />
                      <button
                        onClick={handleValidatePromoCode}
                        disabled={!promoCode.trim() || promoCodeValidating}
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
                    {promoCodeResult && !promoCodeResult.isValid && (
                      <div className={`flex items-center gap-2 text-red-600 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <AlertCircle className="w-4 h-4" />
                        <span className={isRTL ? 'text-right' : 'text-left'}>{promoCodeResult.error}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} p-3 bg-green-50 border border-green-200 rounded-lg`}>
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div className={isRTL ? 'text-right' : 'text-left'}>
                        <p className="font-medium text-green-900">{appliedPromoCode.code}</p>
                        <p className="text-sm text-green-700">
                          -OMR {appliedPromoCode.discount.toFixed(3)}
                        </p>
                      </div>
                    </div>
                    <button
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
                      <input
                        type="text"
                        value={giftCardNumber}
                        onChange={(e) => setGiftCardNumber(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleValidateGiftCard()}
                        dir="ltr"
                        className={`flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 ${isRTL ? 'text-right' : 'text-left'}`}
                        placeholder={t('giftCard.placeholder')}
                        disabled={giftCardValidating}
                      />
                      <button
                        onClick={handleValidateGiftCard}
                        disabled={!giftCardNumber.trim() || giftCardValidating}
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
                    {giftCardResult && !giftCardResult.isValid && (
                      <div className={`flex items-center gap-2 text-red-600 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <AlertCircle className="w-4 h-4" />
                        <span className={isRTL ? 'text-right' : 'text-left'}>{giftCardResult.error}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} p-3 bg-purple-50 border border-purple-200 rounded-lg mt-3`}>
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Gift className="w-5 h-5 text-purple-600" />
                      <div className={isRTL ? 'text-right' : 'text-left'}>
                        <p className="font-medium text-purple-900">{appliedGiftCard.number}</p>
                        <p className="text-sm text-purple-700">
                          {t('giftCard.appliedAmount')}: -OMR {appliedGiftCard.amount.toFixed(3)} | {t('giftCard.balance')}: OMR {appliedGiftCard.balance.toFixed(3)}
                        </p>
                      </div>
                    </div>
                    <button
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
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={payAllOrders}
                    onChange={(e) => setPayAllOrders(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer ${isRTL ? 'peer-checked:after:-translate-x-full' : 'peer-checked:after:translate-x-full'} peer-checked:after:border-white after:content-[''] after:absolute ${isRTL ? 'after:top-[2px] after:right-[2px]' : 'after:top-[2px] after:left-[2px]'} after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600`}></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Submit Button */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full h-16 px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xl transition-all shadow-lg hover:shadow-xl flex items-center ${isRTL ? 'flex-row-reverse' : ''} justify-center gap-2`}
          >
            {loading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                {t('actions.processing')}
              </>
            ) : (
              `${t('actions.submit')} - OMR ${totals.finalTotal.toFixed(3)}`
            )}
          </button>
          <p className={`text-xs text-center text-gray-500 mt-3 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('messages.paymentMethodNote', { method: getPaymentLabel(selectedPayment) })}
          </p>
        </div>
      </div>
    </div>
  );
}
