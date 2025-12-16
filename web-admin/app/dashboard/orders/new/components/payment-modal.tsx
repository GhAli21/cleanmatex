/**
 * Payment Modal Component
 * Modal for payment options, discounts, and order submission
 * Re-Design: PRD-010 Advanced Orders - Section 5C
 */

'use client';

import { useState, useEffect } from 'react';
import { X, CreditCard, Banknote, Package, FileText, CheckSquare, Tag, Gift } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { PAYMENT_OPTIONS } from '@/lib/types/order-creation';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (paymentData: {
    paymentMethod: string;
    percentDiscount: number;
    amountDiscount: number;
    promoCode: string;
    giftCard: string;
  }) => void;
  total: number;
  loading?: boolean;
}

export function PaymentModal({
  open,
  onClose,
  onSubmit,
  total,
  loading = false,
}: PaymentModalProps) {
  const t = useTranslations('newOrder.payment');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const [selectedPayment, setSelectedPayment] = useState('pay_on_collection');
  const [percentDiscount, setPercentDiscount] = useState(0);
  const [amountDiscount, setAmountDiscount] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [giftCard, setGiftCard] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedPayment('pay_on_collection');
      setPercentDiscount(0);
      setAmountDiscount(0);
      setPromoCode('');
      setGiftCard('');
    }
  }, [open]);

  const calculateFinalTotal = () => {
    let finalTotal = total;

    // Apply percent discount
    if (percentDiscount > 0) {
      finalTotal -= (finalTotal * percentDiscount) / 100;
    }

    // Apply amount discount
    if (amountDiscount > 0) {
      finalTotal -= amountDiscount;
    }

    return Math.max(0, finalTotal);
  };

  const finalTotal = calculateFinalTotal();
  const totalDiscount = total - finalTotal;

  const handleSubmit = () => {
    onSubmit({
      paymentMethod: selectedPayment,
      percentDiscount,
      amountDiscount,
      promoCode,
      giftCard,
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
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
            <p className="text-5xl font-bold text-gray-900">OMR {finalTotal.toFixed(3)}</p>
            {totalDiscount > 0 && (
              <div className={`mt-2 flex items-center ${isRTL ? 'flex-row-reverse justify-center' : 'justify-center'} gap-2`}>
                <span className="text-sm text-gray-500 line-through">
                  OMR {total.toFixed(3)}
                </span>
                <span className="text-sm font-semibold text-green-600">
                  {t('savings')} OMR {totalDiscount.toFixed(3)}
                </span>
              </div>
            )}
          </div>

          {/* Payment Options */}
          <div>
            <h3 className={`font-semibold text-gray-900 mb-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('methods.title')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {PAYMENT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedPayment(option.id)}
                  className={`
                    p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 min-h-[100px]
                    ${
                      selectedPayment === option.id
                        ? 'border-blue-600 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <div
                    className={`
                    ${selectedPayment === option.id ? 'text-blue-600' : 'text-gray-600'}
                  `}
                  >
                    {getPaymentIcon(option.id)}
                  </div>
                  <span className="text-sm font-semibold text-center">
                    {getPaymentLabel(option.id)}
                  </span>
                  {option.isDefault && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      {tCommon('defaultAddress')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Discount Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className={`font-semibold text-gray-900 mb-4 flex items-center ${isRTL ? 'flex-row-reverse' : ''} gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              <Tag className="w-5 h-5" />
              {t('manualDiscount.title')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Percent Discount */}
              <div>
                <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('manualDiscount.percent')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={percentDiscount}
                    onChange={(e) =>
                      setPercentDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))
                    }
                    min="0"
                    max="100"
                    step="1"
                    dir="ltr"
                    className={`w-full px-4 py-3 ${isRTL ? 'pl-10 pr-4' : 'pr-10 pl-4'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    placeholder={t('manualDiscount.percentPlaceholder')}
                  />
                  <span className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-gray-500`}>
                    %
                  </span>
                </div>
              </div>

              {/* Amount Discount */}
              <div>
                <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('manualDiscount.amount')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amountDiscount}
                    onChange={(e) =>
                      setAmountDiscount(Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    min="0"
                    step="0.001"
                    dir="ltr"
                    className={`w-full px-4 py-3 ${isRTL ? 'pl-16 pr-4' : 'pr-16 pl-4'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    placeholder={t('manualDiscount.amountPlaceholder')}
                  />
                  <span className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-gray-500`}>
                    OMR
                  </span>
                </div>
              </div>

              {/* Promo Code */}
              <div>
                <label className={`block text-sm font-medium text-gray-700 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('promoCode.label')}
                </label>
                <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    dir="ltr"
                    className={`flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
                    placeholder={t('promoCode.placeholder')}
                  />
                  <button
                    onClick={() => {
                      // TODO: Validate promo code
                      alert(t('promoCode.errors.validationFailed'));
                    }}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    {t('promoCode.apply')}
                  </button>
                </div>
              </div>

              {/* Gift Card */}
              <div>
                <label className={`block text-sm font-medium text-gray-700 mb-2 flex items-center ${isRTL ? 'flex-row-reverse' : ''} gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <Gift className="w-4 h-4" />
                  {t('giftCard.label')}
                </label>
                <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input
                    type="text"
                    value={giftCard}
                    onChange={(e) => setGiftCard(e.target.value)}
                    dir="ltr"
                    className={`flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
                    placeholder={t('giftCard.placeholder')}
                  />
                  <button
                    onClick={() => {
                      // TODO: Validate gift card
                      alert(t('giftCard.errors.validationFailed'));
                    }}
                    className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                  >
                    {t('giftCard.apply')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Submit Button */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-16 px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xl transition-all shadow-lg hover:shadow-xl"
          >
            {loading ? t('actions.processing') : `${t('actions.submitPayment')} - OMR ${finalTotal.toFixed(3)}`}
          </button>
          <p className={`text-xs text-center text-gray-500 mt-3 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('messages.paymentMethodNote', { method: getPaymentLabel(selectedPayment) })}
          </p>
        </div>
      </div>
    </div>
  );
}
