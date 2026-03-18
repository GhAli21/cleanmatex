/**
 * Order Summary Panel V2
 * Streamlined right panel without customer/express header
 * Re-Design: PRD-010 Advanced Orders - V2 Enhancement
 */

'use client';

import { useState, memo, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { ItemCartListV2 } from './item-cart-list-v2';
import { Calendar, Calculator, AlertCircle, Clock } from 'lucide-react';
import type { PreSubmissionPiece } from '../pre-submission-pieces-manager';

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
  serviceCategoryCode?: string;
  serviceCategoryName?: string;
  serviceCategoryName2?: string;
  priceOverride?: number | null;
  overrideReason?: string | null;
}

interface ColorCatalogEntry {
  code: string;
  name: string;
  name2?: string | null;
  color_hex?: string | null;
}

interface OrderSummaryPanelV2Props {
  items?: CartItem[];
  onEditItem?: (itemId: string) => void;
  onDeleteItem?: (itemId: string) => void;
  onPiecesChange?: (itemId: string, pieces: PreSubmissionPiece[]) => void;
  onCopyPieceToAll?: (itemId: string, pieceId: string) => void;
  isQuickDrop: boolean;
  onQuickDropToggle: (value: boolean) => void;
  quickDropQuantity: number;
  onQuickDropQuantityChange: (value: number) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  readyByAt: string;
  total: number;
  currencyCode?: string;
  onSubmit: () => void;
  onOpenReadyByModal?: () => void;
  onOpenPaymentModal?: () => void;
  onCalculateReadyBy?: () => Promise<void>;
  loading: boolean;
  trackByPiece?: boolean;
  isRetailOnlyOrder?: boolean;
  isEditMode?: boolean;
  isDirty?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  hasErrors?: boolean;
  validationErrors?: string[];
  selectedPieceId?: string | null;
  onSelectPiece?: (pieceId: string | null) => void;
  canSubmit: boolean;
  colorCatalog?: ColorCatalogEntry[];
}

function OrderSummaryPanelV2Component({
  items = [],
  onEditItem,
  onDeleteItem,
  onPiecesChange,
  onCopyPieceToAll,
  isQuickDrop: _isQuickDrop,
  onQuickDropToggle: _onQuickDropToggle,
  quickDropQuantity: _quickDropQuantity,
  onQuickDropQuantityChange: _onQuickDropQuantityChange,
  notes,
  onNotesChange,
  readyByAt,
  total,
  currencyCode = ORDER_DEFAULTS.CURRENCY,
  onSubmit,
  onOpenReadyByModal,
  onOpenPaymentModal,
  onCalculateReadyBy,
  loading,
  trackByPiece = false,
  isRetailOnlyOrder = false,
  isEditMode = false,
  isDirty = false,
  onSave,
  isSaving = false,
  hasErrors = false,
  validationErrors = [],
  selectedPieceId = null,
  onSelectPiece,
  canSubmit,
  colorCatalog,
}: OrderSummaryPanelV2Props) {
  const t = useTranslations('newOrder.orderSummary');
  const tNewOrder = useTranslations('newOrder');
  const tEdit = useTranslations('orders.edit');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const [isCalculating, setIsCalculating] = useState(false);

  const readyByValidation = useMemo(() => {
    if (!readyByAt) {
      return { isValid: false, isFuture: false, isTooFar: false, message: '' };
    }
    const readyByDate = new Date(readyByAt);
    const now = new Date();
    const daysDiff = Math.ceil((readyByDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const threshold = isRetailOnlyOrder ? now.getTime() - 60000 : now.getTime();
    const isFuture = isRetailOnlyOrder
      ? readyByDate.getTime() >= threshold
      : readyByDate > now;
    const isTooFar = daysDiff > 30;
    return {
      isValid: isFuture && !isTooFar,
      isFuture,
      isTooFar,
      message: !isFuture
        ? tNewOrder('validation.readyByMustBeFuture') || 'Ready by date must be in the future'
        : isTooFar
          ? tNewOrder('validation.readyByTooFar') || 'Ready by date is more than 30 days away'
          : '',
    };
  }, [readyByAt, tNewOrder, isRetailOnlyOrder]);

  const handleCalculateReadyBy = useCallback(async () => {
    if (!onCalculateReadyBy) return;
    setIsCalculating(true);
    try {
      await onCalculateReadyBy();
    } finally {
      setIsCalculating(false);
    }
  }, [onCalculateReadyBy]);

  const handleDeleteItem = useCallback((itemId: string) => {
    if (onDeleteItem) onDeleteItem(itemId);
  }, [onDeleteItem]);

  return (
    <div className="flex flex-col bg-white overflow-y-auto" style={{ height: '100%', maxHeight: '100vh' }}>
      {/* Item Cart List V2 - Scrollable */}
      <div className="flex-1 p-4 border-b border-gray-200 min-h-0 overflow-y-auto">
        <ItemCartListV2
          items={items}
          onEditItem={onEditItem}
          onDeleteItem={handleDeleteItem}
          onPiecesChange={onPiecesChange}
          onCopyPieceToAll={onCopyPieceToAll}
          trackByPiece={trackByPiece}
          currencyCode={currencyCode}
          selectedPieceId={selectedPieceId}
          onSelectPiece={onSelectPiece}
          colorCatalog={colorCatalog}
        />
      </div>

      {/* Footer */}
      <div className="p-4 bg-white border-t-2 border-gray-200 space-y-2 shrink-0">
        {/* Notes as textarea */}
        <div className="space-y-1.5">
          <label className={`block text-xs font-semibold text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('notes')}
          </label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={2}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${isRTL ? 'text-right' : 'text-left'}`}
            placeholder={t('addSpecialInstructions') || 'Add special instructions...'}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
        </div>

        {/* Ready By */}
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
                type="button"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>{tNewOrder('calculateReadyBy') || 'Calculate'}</span>
              </button>
            )}
          </div>
          <div className={`flex items-stretch gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div
              role="button"
              tabIndex={0}
              className={`flex-1 flex items-center gap-2 px-3 py-2.5 border rounded-lg bg-white ${readyByValidation.isTooFar ? 'border-red-500' : readyByValidation.isValid && readyByAt ? 'border-blue-300' : 'border-gray-300'} ${isRTL ? 'flex-row-reverse' : ''} cursor-pointer hover:border-blue-400 transition-colors min-w-0`}
              onClick={onOpenReadyByModal}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenReadyByModal?.(); } }}
            >
              <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
              {readyByAt ? (
                <>
                  <span className={`flex-1 text-sm text-gray-900 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {(() => {
                      const d = new Date(readyByAt);
                      const day = String(d.getDate()).padStart(2, '0');
                      const month = String(d.getMonth() + 1).padStart(2, '0');
                      const year = d.getFullYear();
                      return `${day}/${month}/${year}`;
                    })()}
                  </span>
                  <Clock className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className={`flex-1 text-sm text-gray-900 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {new Date(readyByAt).toLocaleTimeString(isRTL ? 'ar-OM' : 'en-US', {
                      hour: '2-digit', minute: '2-digit', hour12: true,
                    })}
                  </span>
                </>
              ) : (
                <span className={`flex-1 text-sm text-gray-400 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>{t('notSet')}</span>
              )}
            </div>
            <button
              onClick={onOpenReadyByModal}
              className="px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center shrink-0"
              type="button"
            >
              <Calendar className="w-4 h-4" aria-hidden />
            </button>
          </div>
          {readyByAt && !readyByValidation.isFuture && (
            <div role="alert" className={`flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs ${isRTL ? 'flex-row-reverse' : ''}`}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{readyByValidation.message}</span>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={isEditMode ? (onSave ?? (() => {})) : (onOpenPaymentModal || onSubmit)}
          disabled={isEditMode ? !isDirty || isSaving || loading || hasErrors : loading || !canSubmit}
          className={`w-full min-h-[48px] py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl flex items-center group ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}
        >
          <span className="text-lg">
            {loading || isSaving
              ? (isEditMode ? tEdit('saving') : t('processing'))
              : isEditMode
                ? tEdit('saveChanges')
                : tNewOrder('submitOrder')}
          </span>
          <div className={isRTL ? 'text-left' : 'text-right'}>
            <p className="text-xs opacity-90">{t('total')}</p>
            <p className="text-2xl font-bold">{currencyCode} {total.toFixed(3)}</p>
            <p className="text-xs opacity-75 mt-1">
              {tCommon('itemCount', { count: items.length })}
            </p>
          </div>
        </button>

        {/* Validation hints */}
        {isEditMode ? (
          hasErrors && validationErrors.length > 0 ? (
            <p role="alert" className="text-xs text-center text-red-600 font-medium">{validationErrors[0]}</p>
          ) : isDirty && !isSaving && !loading ? (
            <p className="text-xs text-center text-green-600 font-medium">✓ {tEdit('unsavedChanges') || 'You have unsaved changes'}</p>
          ) : !isDirty ? (
            <p className="text-xs text-center text-gray-500 font-medium">{tEdit('noChangesToSave') || 'No changes to save'}</p>
          ) : null
        ) : (
          canSubmit && readyByAt && readyByValidation.isFuture ? (
            <p className="text-xs text-center text-green-600 font-medium">✓ {tNewOrder('validation.readyToSubmit') || 'Ready to submit'}</p>
          ) : null
        )}
      </div>
    </div>
  );
}

export const OrderSummaryPanelV2 = memo(OrderSummaryPanelV2Component);
