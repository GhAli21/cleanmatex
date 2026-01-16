/**
 * Order Summary Panel Component - Enhanced
 * Right panel with customer, item cart, settings, and submit button
 * Re-Design: PRD-010 Advanced Orders - Section 4
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { ItemCartList } from './item-cart-list';
import { UserPlus, Edit, Trash2, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
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
  loading: boolean;
  trackByPiece?: boolean;
}

export function OrderSummaryPanel({
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
  loading,
  trackByPiece = false,
}: OrderSummaryPanelProps) {
  const t = useTranslations('newOrder.orderSummary');
  const tNewOrder = useTranslations('newOrder');
  const isRTL = useRTL();
  const [notesExpanded, setNotesExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    if (!dateString) return t('calculating');
    const date = new Date(dateString);
    return date.toLocaleString(isRTL ? 'ar-OM' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const handleDeleteItem = (itemId: string) => {
    if (onDeleteItem) {
      onDeleteItem(itemId);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header - Customer Section */}
      <div className="p-6 border-b border-gray-200">
        <div className={`flex items-center justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <label className="block text-sm font-semibold text-gray-900">{tNewOrder('customer.label')}</label>
          <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {customerName && (
              <>
                <button
                  onClick={onEditCustomer || onSelectCustomer}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  aria-label={t('editCustomer')}
                >
                  <Edit className="w-4 h-4" />
                </button>
                {/*
                <button
                  onClick={() => {
                    // TODO: Implement remove customer
                  }}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                  aria-label={t('removeCustomer')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>*/}
              </>
            )}
            {!customerName && (
              <button
                onClick={onSelectCustomer}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                aria-label={t('addCustomer')}
              >
                <UserPlus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onSelectCustomer}
          className={`w-full px-3 py-2 border-2 border-gray-300 rounded-lg ${isRTL ? 'text-right' : 'text-left'} hover:border-blue-500 hover:bg-blue-50 transition-all font-medium`}
        >
          {customerName || tNewOrder('selectCustomer')}
        </button>

        {/* Express Toggle */}
        <div className="mt-4">
          <label className={`flex items-center justify-between cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm font-semibold text-gray-900">{t('expressService')}</span>
            <input
              type="checkbox"
              checked={express}
              onChange={(e) => onExpressToggle(e.target.checked)}
              className="w-5 h-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
            />
          </label>
        </div>
      </div>

      {/* Item Cart List - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6 border-b border-gray-200">
        <ItemCartList 
          items={items} 
          onEditItem={onEditItem} 
          onDeleteItem={handleDeleteItem}
          onPiecesChange={onPiecesChange}
          trackByPiece={trackByPiece}
        />
      </div>

      {/* Notes Section - Collapsible */}
      <div className="border-b border-gray-200">
        <button
          onClick={() => setNotesExpanded(!notesExpanded)}
          className={`w-full px-6 py-3 flex items-center hover:bg-gray-50 transition-colors ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}
        >
          <span className="text-sm font-semibold text-gray-900">{t('notes')}</span>
          {notesExpanded ? (
            <ChevronUp className={`w-4 h-4 text-gray-500 ${isRTL ? 'rotate-180' : ''}`} />
          ) : (
            <ChevronDown className={`w-4 h-4 text-gray-500 ${isRTL ? 'rotate-180' : ''}`} />
          )}
        </button>
        {notesExpanded && (
          <div className="px-6 pb-4">
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={3}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
              placeholder={t('addSpecialInstructions')}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            <button className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
              {t('saveNote')}
            </button>
          </div>
        )}
      </div>

      {/* Footer Toggles */}
      <div className="px-6 py-4 space-y-2 border-b border-gray-200 bg-gray-50">
        {/* Quick Drop */}
        <label className={`flex items-center cursor-pointer ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
          <span className="text-sm font-medium text-gray-700">{t('quickDrop')}</span>
          <input
            type="checkbox"
            checked={isQuickDrop}
            onChange={(e) => onQuickDropToggle(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-gray-300"
          />
        </label>

        {/* Retail */}
        {onRetailToggle && (
          <label className={`flex items-center cursor-pointer ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
            <span className="text-sm font-medium text-gray-700">{t('retail')}</span>
            <input
              type="checkbox"
              checked={retail}
              onChange={(e) => onRetailToggle(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300"
            />
          </label>
        )}
      </div>

      {/* Sticky Footer - Submit Bar */}
      <div className="p-6 bg-white border-t-2 border-gray-200 space-y-3">
        {/* Ready By Date - Clickable */}
        <button
          onClick={onOpenReadyByModal}
          className={`w-full flex items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}
        >
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Calendar className="w-4 h-4 text-blue-600" />
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className="text-xs text-gray-600">{tNewOrder('readyBy')}</p>
              <p className="font-bold text-sm text-blue-700">{formatDate(readyByAt)}</p>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-blue-600 group-hover:translate-y-0.5 transition-transform ${isRTL ? 'rotate-180' : ''}`} />
        </button>

        {/* Submit Button with Total - Clickable for Payment */}
        <button
          onClick={onOpenPaymentModal || onSubmit}
          disabled={loading || !customerName || items.length === 0}
          className={`w-full h-16 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-xl flex items-center group ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}
        >
          <span className="text-lg">
            {loading ? t('processing') : tNewOrder('submitOrder')}
          </span>
          <div className={isRTL ? 'text-left' : 'text-right'}>
            <p className="text-xs opacity-90">{t('total')}</p>
            <p className="text-2xl font-bold">OMR {total.toFixed(3)}</p>
          </div>
        </button>

        {items.length === 0 && (
          <p className="text-xs text-center text-gray-500">{t('addItemsToContinue')}</p>
        )}
      </div>
    </div>
  );
}
