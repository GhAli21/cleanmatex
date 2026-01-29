/**
 * Order Summary Panel Component - Enhanced
 * Right panel with customer, item cart, settings, and submit button
 * Re-Design: PRD-010 Advanced Orders - Section 4
 */

'use client';

import { useState, memo, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { ItemCartList } from './item-cart-list';
import { UserPlus, Edit, Trash2, Calendar, Calculator, AlertCircle, Clock } from 'lucide-react';
import type { PreSubmissionPiece } from './pre-submission-pieces-manager';

interface CartItem {
  id: string;
  productId: string;
  productName: string;
  productName2?: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  conditions?: string[];
  hasStain?: boolean;
  hasDamage?: boolean;
  notes?: string;
  pieces?: PreSubmissionPiece[];
  priceOverride?: number | null;
  overrideReason?: string | null;
}

interface OrderSummaryPanelProps {
  customerName: string;
  onSelectCustomer: () => void;
  onEditCustomer?: () => void;
  items?: CartItem[];
  onEditItem?: (itemId: string) => void;
  onDeleteItem?: (itemId: string) => void;
  onPiecesChange?: (itemId: string, pieces: PreSubmissionPiece[]) => void;
  isQuickDrop: boolean;
  onQuickDropToggle: (value: boolean) => void;
  quickDropQuantity: number;
  onQuickDropQuantityChange: (value: number) => void;
  express: boolean;
  onExpressToggle: (value: boolean) => void;
  retail?: boolean;
  onRetailToggle?: (value: boolean) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  readyByAt: string;
  total: number;
  onSubmit: () => void;
  onOpenReadyByModal?: () => void;
  onOpenPaymentModal?: () => void;
  onCalculateReadyBy?: () => Promise<void>;
  loading: boolean;
  trackByPiece?: boolean;
}

function OrderSummaryPanelComponent({
  customerName,
  onSelectCustomer,
  onEditCustomer,
  items = [],
  onEditItem,
  onDeleteItem,
  onPiecesChange,
  isQuickDrop,
  onQuickDropToggle,
  quickDropQuantity,
  onQuickDropQuantityChange,
  express,
  onExpressToggle,
  retail = false,
  onRetailToggle,
  notes,
  onNotesChange,
  readyByAt,
  total,
  onSubmit,
  onOpenReadyByModal,
  onOpenPaymentModal,
  onCalculateReadyBy,
  loading,
  trackByPiece = false,
}: OrderSummaryPanelProps) {
  const t = useTranslations('newOrder.orderSummary');
  const tNewOrder = useTranslations('newOrder');
  const isRTL = useRTL();
  const [isCalculating, setIsCalculating] = useState(false);

  // Validate ready_by date
  const readyByValidation = useMemo(() => {
    if (!readyByAt) {
      return { isValid: false, isFuture: false, isTooFar: false, message: '' };
    }

    const readyByDate = new Date(readyByAt);
    const now = new Date();
    const daysDiff = Math.ceil((readyByDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const isFuture = readyByDate > now;
    const isTooFar = daysDiff > 30;

    return {
      isValid: isFuture,
      isFuture,
      isTooFar,
      message: !isFuture
        ? tNewOrder('validation.readyByMustBeFuture') || 'Ready by date must be in the future'
        : isTooFar
          ? tNewOrder('validation.readyByTooFar') || 'Ready by date is more than 30 days away'
          : '',
    };
  }, [readyByAt, tNewOrder]);

  const handleCalculateReadyBy = useCallback(async () => {
    if (!onCalculateReadyBy) return;
    setIsCalculating(true);
    try {
      await onCalculateReadyBy();
    } finally {
      setIsCalculating(false);
    }
  }, [onCalculateReadyBy]);

  const formatDate = (dateString: string) => {
    if (!dateString) return t('notSet');
    const date = new Date(dateString);
    return date.toLocaleString(isRTL ? 'ar-OM' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString(isRTL ? 'ar-OM' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const timeStr = date.toLocaleTimeString(isRTL ? 'ar-OM' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateStr} ${timeStr}`;
  };

  const formatDateInput = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const formatTimeInput = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toTimeString().slice(0, 5);
  };

  const handleDeleteItem = useCallback((itemId: string) => {
    if (onDeleteItem) {
      onDeleteItem(itemId);
    }
  }, [onDeleteItem]);

  return (
    <div className="flex flex-col bg-white overflow-y-auto" style={{ height: '100%', maxHeight: '100vh' }}>
      {/* Header - Customer Section - Compact */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className={`flex items-center justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <label className="block text-xs font-semibold text-gray-900">{tNewOrder('customer.label')}</label>
          <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {customerName && (
              <>
                <button
                  onClick={onEditCustomer || onSelectCustomer}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                  aria-label={t('editCustomer')}
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            {!customerName && (
              <button
                onClick={onSelectCustomer}
                className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
                aria-label={t('addCustomer')}
              >
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onSelectCustomer}
          className={`w-full px-2.5 py-1.5 text-sm border-2 border-gray-300 rounded-lg ${isRTL ? 'text-right' : 'text-left'} hover:border-blue-500 hover:bg-blue-50 transition-all font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:border-blue-500`}
        >
          {customerName || tNewOrder('selectCustomer')}
        </button>

        {/* Express Toggle - Compact */}
        <div className="mt-2">
          <label className={`flex items-center justify-between cursor-pointer p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-xs font-semibold text-gray-900">{t('expressService')}</span>
            <input
              type="checkbox"
              checked={express}
              onChange={(e) => onExpressToggle(e.target.checked)}
              className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
            />
          </label>
        </div>
      </div>

      {/* Item Cart List - Scrollable */}
      <div className="flex-1 p-4 border-b border-gray-200 min-h-0">
        <ItemCartList
          items={items}
          onEditItem={onEditItem}
          onDeleteItem={handleDeleteItem}
          onPiecesChange={onPiecesChange}
          trackByPiece={trackByPiece}
        />
      </div>

      {/* Footer Toggles - Compact */}
      {/* NOTE: Quick Drop section is hidden for now. To re-enable, uncomment the Quick Drop label below and set SHOW_QUICK_DROP to true */}
      {/* TODO: Add feature flag SHOW_QUICK_DROP when needed in the future */}
      {false && (
        <div className="px-4 py-2 space-y-1.5 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          {/* Quick Drop - Hidden for now, can be re-enabled by changing the condition above */}
          <label className={`flex items-center cursor-pointer ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
            <span className="text-xs font-medium text-gray-700">{t('quickDrop')}</span>
            <input
              type="checkbox"
              checked={isQuickDrop}
              onChange={(e) => onQuickDropToggle(e.target.checked)}
              className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300"
            />
          </label>

          {/* Retail */}
          {onRetailToggle && (
            <label className={`flex items-center cursor-pointer ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
              <span className="text-xs font-medium text-gray-700">{t('retail')}</span>
              <input
                type="checkbox"
                checked={retail}
                onChange={(e) => onRetailToggle(e.target.checked)}
                className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300"
              />
            </label>
          )}
        </div>
      )}

      {/* Footer - Submit Bar */}
      <div className="p-4 bg-white border-t-2 border-gray-200 space-y-2 flex-shrink-0">
        {/* Notes Section - Simple Text Input - Moved to footer area */}
        <div className="space-y-1.5">
          <label className={`block text-xs font-semibold text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('notes')}
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
            placeholder={t('addSpecialInstructions') || 'Add special instructions...'}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
        </div>

        {/* Ready By Date - Date/Time Input with Calendar Button */}
        <div className="space-y-2">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <label className={`block text-xs font-semibold text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              {tNewOrder('readyBy')}
            </label>
            {onCalculateReadyBy && (
              <button
                onClick={handleCalculateReadyBy}
                disabled={isCalculating || items.length === 0}
                className={`px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 text-white text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}
                title={tNewOrder('calculateReadyBy') || 'Calculate Ready By'}
                type="button"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>{tNewOrder('calculateReadyBy') || 'Calculate'}</span>
              </button>
            )}
          </div>
          <div className={`flex items-stretch gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div
              className={`flex-1 flex items-center gap-2 px-3 py-2.5 border rounded-lg bg-white ${readyByValidation.isTooFar ? 'border-red-500' : readyByValidation.isValid && readyByAt ? 'border-blue-300' : 'border-gray-300'} ${isRTL ? 'flex-row-reverse' : ''} cursor-pointer hover:border-blue-400 transition-colors min-w-0`}
              onClick={onOpenReadyByModal}
            >
              <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
              {readyByAt ? (
                <>
                  <span className={`flex-1 text-sm text-gray-900 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {new Date(readyByAt).toLocaleDateString(isRTL ? 'ar-OM' : 'en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    })}
                  </span>
                  <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className={`flex-1 text-sm text-gray-900 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {new Date(readyByAt).toLocaleTimeString(isRTL ? 'ar-OM' : 'en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </span>
                </>
              ) : (
                <span className={`flex-1 text-sm text-gray-400 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>{t('notSet')}</span>
              )}
            </div>
            <button
              onClick={onOpenReadyByModal}
              className={`px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center flex-shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}
              title={tNewOrder('schedule.selectReadyDateTime') || 'Select Date & Time'}
              type="button"
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>
          {/* Validation Messages */}
          {readyByAt && !readyByValidation.isFuture && (
            <div className={`flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs ${isRTL ? 'flex-row-reverse' : ''}`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{readyByValidation.message}</span>
            </div>
          )}
          {readyByAt && readyByValidation.isTooFar && (
            <div className={`flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-xs ${isRTL ? 'flex-row-reverse' : ''}`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{readyByValidation.message}</span>
            </div>
          )}
        </div>

        {/* Submit Button with Total - Clickable for Payment */}
        <button
          onClick={onOpenPaymentModal || onSubmit}
          disabled={loading || !customerName || items.length === 0 || !readyByAt || !readyByValidation.isFuture}
          className={`w-full h-12 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-xl flex items-center group ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}
        >
          <span className="text-lg">
            {loading ? t('processing') : tNewOrder('submitOrder')}
          </span>
          <div className={isRTL ? 'text-left' : 'text-right'}>
            <p className="text-xs opacity-90">{t('total')}</p>
            <p className="text-2xl font-bold">OMR {total.toFixed(3)}</p>
            <p className="text-xs opacity-75 mt-1">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </p>
          </div>
        </button>

        {/* Validation Messages for Submit Button */}
        {!customerName && (
          <p className="text-xs text-center text-red-600 font-medium">
            {tNewOrder('errors.selectCustomer') || 'Please select a customer'}
          </p>
        )}
        {customerName && items.length === 0 && (
          <p className="text-xs text-center text-red-600 font-medium">
            {tNewOrder('errors.addItems') || 'Please add at least one item'}
          </p>
        )}
        {customerName && items.length > 0 && !readyByAt && (
          <p className="text-xs text-center text-red-600 font-medium">
            {tNewOrder('validation.readyByRequired') || 'Please set a ready-by date'}
          </p>
        )}
        {customerName && items.length > 0 && readyByAt && !readyByValidation.isFuture && (
          <p className="text-xs text-center text-red-600 font-medium">
            {readyByValidation.message || tNewOrder('validation.readyByMustBeFuture') || 'Ready-by date must be in the future'}
          </p>
        )}
        {customerName && items.length > 0 && readyByAt && readyByValidation.isFuture && (
          <p className="text-xs text-center text-green-600 font-medium">
            ✓ {tNewOrder('validation.readyToSubmit') || 'Ready to submit'}
          </p>
        )}
      </div>
    </div>
  );
}

export const OrderSummaryPanel = memo(OrderSummaryPanelComponent);
