/**
 * Order Summary Panel Component
 * Redesigned right panel matching POS-style mockup
 * PRD-010: Advanced Order Management
 */

'use client';

import { useState, memo, useCallback, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { ItemCartList } from './item-cart-list';
import { Calendar, Calculator, AlertCircle, Clock, User, Pencil, X } from 'lucide-react';
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

interface OrderSummaryPanelProps {
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
  // Customer header props
  customerName?: string;
  onSelectCustomer?: () => void;
  onEditCustomer?: () => void;
  onClearCustomer?: () => void;
  // Express toggle
  express?: boolean;
  onExpressToggle?: (value: boolean) => void;
  // Bags
  bags?: number;
  onBagsChange?: (count: number) => void;
  // Edit item notes (navigates to pieces tab)
  onEditItemNotes?: (itemId: string) => void;
}

function OrderSummaryPanelComponent({
  items = [],
  onEditItem,
  onDeleteItem,
  onPiecesChange,
  onCopyPieceToAll,
  isQuickDrop,
  onQuickDropToggle: _onQuickDropToggle,
  quickDropQuantity,
  onQuickDropQuantityChange,
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
  customerName,
  onSelectCustomer,
  onEditCustomer,
  onClearCustomer,
  express = false,
  onExpressToggle,
  bags = 0,
  onBagsChange,
  onEditItemNotes,
}: OrderSummaryPanelProps) {
  const t = useTranslations('newOrder.orderSummary');
  const tNewOrder = useTranslations('newOrder');
  const tEdit = useTranslations('orders.edit');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const locale = useLocale();
  const { decimalPlaces } = useTenantCurrency();
  const moneyLocale = locale === 'ar' ? 'ar' : 'en';
  const fmtTotal = (n: number) =>
    formatMoneyAmountWithCode(n, {
      currencyCode: currencyCode as string,
      decimalPlaces,
      locale: moneyLocale,
    });
  const [isCalculating, setIsCalculating] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

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

  const totalPieces = useMemo(
    () => trackByPiece
      ? items.reduce((sum, item) => sum + (item.pieces?.length ?? item.quantity), 0)
      : items.reduce((sum, item) => sum + item.quantity, 0),
    [items, trackByPiece]
  );

  return (
    <div className="flex flex-col bg-white overflow-hidden" style={{ height: '100%', maxHeight: '100vh' }}>

      {/* Customer Header */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex-1 min-w-0 flex items-center gap-2 bg-white border border-gray-300 rounded px-2 py-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span className={`flex-1 text-sm font-medium truncate ${customerName ? 'text-gray-900' : 'text-gray-400'} ${isRTL ? 'text-right' : 'text-left'}`}>
            {customerName || (tNewOrder('selectCustomer') || 'Select customer')}
          </span>
          {customerName && onClearCustomer && (
            <button
              type="button"
              onClick={onClearCustomer}
              className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={tCommon('clear') || 'Clear'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onSelectCustomer}
          className="shrink-0 p-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded transition-colors"
          aria-label={tNewOrder('selectCustomer') || 'Select customer'}
        >
          <User className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onEditCustomer}
          className="shrink-0 p-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded transition-colors"
          aria-label={tCommon('edit') || 'Edit'}
        >
          <Pencil className="w-4 h-4" />
        </button>
      </div>

      {/* Express Toggle Row */}
      <div className={`flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <span className="text-sm font-medium text-gray-700">
          {tNewOrder('express.label') || t('expressService') || 'Express'}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={express}
          onClick={() => onExpressToggle?.(!express)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 ${
            express ? 'bg-orange-500' : 'bg-gray-300'
          }`}
          aria-label={express ? (tNewOrder('topBar.expressOn') || 'Express On') : (tNewOrder('topBar.expressOff') || 'Express Off')}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
              express ? (isRTL ? '-translate-x-4' : 'translate-x-4') : (isRTL ? '-translate-x-1' : 'translate-x-1')
            }`}
          />
        </button>
      </div>

      {/* Item Cart List - Scrollable */}
      <div className="flex-1 p-3 min-h-0 overflow-y-auto">
        <ItemCartList
          items={items}
          onEditItem={onEditItem}
          onEditItemNotes={onEditItemNotes}
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
      <div className="shrink-0 border-t-2 border-gray-200 bg-white">

        {/* Ready By Row (compact, above footer grid) */}
        <div className="px-3 pt-2 pb-1 space-y-1">
          <div className={`flex items-stretch gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {onCalculateReadyBy && (
              <button
                onClick={handleCalculateReadyBy}
                disabled={isCalculating || items.length === 0}
                className={`px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs rounded transition-colors flex items-center gap-1 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}
                type="button"
              >
                <Calculator className="w-3 h-3" />
              </button>
            )}
            <div
              role="button"
              tabIndex={0}
              className={`flex-1 flex items-center gap-1.5 px-2 py-1 border rounded bg-white text-xs ${readyByValidation.isTooFar ? 'border-red-500' : readyByValidation.isValid && readyByAt ? 'border-blue-300' : 'border-gray-300'} ${isRTL ? 'flex-row-reverse' : ''} cursor-pointer hover:border-blue-400 transition-colors min-w-0`}
              onClick={onOpenReadyByModal}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenReadyByModal?.(); } }}
            >
              <Calendar className="w-3 h-3 text-gray-500 shrink-0" />
              {readyByAt ? (
                <>
                  <span className={`flex-1 text-gray-900 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {(() => {
                      const d = new Date(readyByAt);
                      const day = String(d.getDate()).padStart(2, '0');
                      const month = String(d.getMonth() + 1).padStart(2, '0');
                      const year = d.getFullYear();
                      return `${day}/${month}/${year}`;
                    })()}
                  </span>
                  <Clock className="w-3 h-3 text-gray-500 shrink-0" />
                  <span className={`text-gray-900 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {new Date(readyByAt).toLocaleTimeString(isRTL ? 'ar-OM' : 'en-US', {
                      hour: '2-digit', minute: '2-digit', hour12: true,
                    })}
                  </span>
                </>
              ) : (
                <span className={`flex-1 text-gray-400 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>{tNewOrder('readyBy') || 'Ready by'}</span>
              )}
            </div>
            <button
              onClick={onOpenReadyByModal}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center justify-center shrink-0"
              type="button"
            >
              <Calendar className="w-3 h-3" aria-hidden />
            </button>
          </div>
          {readyByAt && !readyByValidation.isFuture && (
            <div role="alert" className={`flex items-center gap-1.5 p-1.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs ${isRTL ? 'flex-row-reverse' : ''}`}>
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{readyByValidation.message}</span>
            </div>
          )}
        </div>

        {/* Footer Grid — 3 rows × 2 cols */}
        <div className="border-t border-gray-200">

          {/* Row 1: Pieces | Bags */}
          <div className={`grid grid-cols-2 divide-x divide-gray-200 border-b border-gray-200 ${isRTL ? 'divide-x-reverse' : ''}`}>
            <div className={`flex items-center gap-2 px-3 py-2 bg-gray-50 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className="text-xs font-medium text-gray-600">{tCommon('pieces') || t('pieces') || 'Pieces'}</span>
              <span className="text-sm font-bold text-gray-900">{totalPieces}</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 bg-gray-50 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className="text-xs font-medium text-gray-600">{t('bags') || 'Bags'}</span>
              {onBagsChange ? (
                <input
                  type="number"
                  min={0}
                  value={bags}
                  onChange={(e) => onBagsChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-12 text-sm font-bold text-gray-900 bg-transparent border-none outline-none p-0 text-center"
                  dir="ltr"
                />
              ) : (
                <span className="text-sm font-bold text-gray-900">{bags}</span>
              )}
            </div>
          </div>

          {/* Row 2: Notes | Save toggle */}
          <div className={`grid grid-cols-2 divide-x divide-gray-200 border-b border-gray-200 ${isRTL ? 'divide-x-reverse' : ''}`}>
            <div className={`flex items-center px-3 py-2 bg-gray-50 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className="text-xs font-medium text-gray-600">{t('notes') || 'Notes'}</span>
            </div>
            <div className={`flex items-center justify-between px-3 py-2 bg-gray-50 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className="text-xs font-medium text-gray-600">{tCommon('save') || 'Save'}</span>
              <button
                type="button"
                role="switch"
                aria-checked={showNotes}
                onClick={() => setShowNotes(!showNotes)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                  showNotes ? 'bg-blue-500' : 'bg-gray-300'
                }`}
                aria-label={showNotes ? 'Hide notes' : 'Show notes'}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                    showNotes ? (isRTL ? '-translate-x-4' : 'translate-x-4') : (isRTL ? '-translate-x-1' : 'translate-x-1')
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Notes textarea — shown when Save toggle is ON */}
          {showNotes && (
            <div className="px-3 py-2 border-b border-gray-200 bg-white">
              <textarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                rows={2}
                className={`w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${isRTL ? 'text-right' : 'text-left'}`}
                placeholder={t('addSpecialInstructions') || 'Add special instructions...'}
                dir={isRTL ? 'rtl' : 'ltr'}
              />
            </div>
          )}

          {/* Row 3: Quick Drop | Retail */}
          <div className={`grid grid-cols-2 divide-x divide-gray-200 ${isRTL ? 'divide-x-reverse' : ''}`}>
            <div className={`flex items-center gap-2 px-3 py-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                type="button"
                onClick={() => {
                  const next = Math.max(0, quickDropQuantity - 1);
                  onQuickDropQuantityChange(next);
                  if (next === 0 && isQuickDrop) _onQuickDropToggle(false);
                }}
                className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded text-gray-600 hover:bg-gray-100 font-bold text-sm transition-colors"
                aria-label="Decrease quick drop"
              >
                -
              </button>
              <span className="text-xs font-medium text-gray-600 flex-1 text-center">
                {t('quickDrop') || 'Quick Drop'}
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = quickDropQuantity + 1;
                  onQuickDropQuantityChange(next);
                  if (next > 0 && !isQuickDrop) _onQuickDropToggle(true);
                }}
                className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded text-gray-600 hover:bg-gray-100 font-bold text-sm transition-colors"
                aria-label="Increase quick drop"
              >
                +
              </button>
            </div>
            <div className={`flex items-center justify-between px-3 py-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className="text-xs font-medium text-gray-600">{t('retail') || 'Retail'}</span>
              {/* Retail is auto-derived, shown as read-only indicator */}
              <div
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  isRetailOnlyOrder ? 'bg-blue-500' : 'bg-gray-300'
                }`}
                role="img"
                aria-label={isRetailOnlyOrder ? 'Retail order' : 'Not retail'}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                    isRetailOnlyOrder ? (isRTL ? '-translate-x-4' : 'translate-x-4') : (isRTL ? '-translate-x-1' : 'translate-x-1')
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="p-3 bg-white border-t border-gray-200">
          <button
            onClick={isEditMode ? (onSave ?? (() => {})) : (onOpenPaymentModal || onSubmit)}
            disabled={isEditMode ? !isDirty || isSaving || loading || hasErrors : loading || !canSubmit}
            className={`w-full min-h-11 py-2.5 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all shadow-md flex items-center group ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}
          >
            <span className="text-base">
              {loading || isSaving
                ? (isEditMode ? tEdit('saving') : t('processing'))
                : isEditMode
                  ? tEdit('saveChanges')
                  : tNewOrder('submitOrder')}
            </span>
            <div className={isRTL ? 'text-left' : 'text-right'}>
              <p className="text-xs opacity-90">{t('total')}</p>
              <p className="text-xl font-bold">{fmtTotal(total)}</p>
            </div>
          </button>

          {/* Validation hints */}
          {isEditMode ? (
            hasErrors && validationErrors.length > 0 ? (
              <p role="alert" className="text-xs text-center text-red-600 font-medium mt-1">{validationErrors[0]}</p>
            ) : isDirty && !isSaving && !loading ? (
              <p className="text-xs text-center text-green-600 font-medium mt-1">✓ {tEdit('unsavedChanges') || 'You have unsaved changes'}</p>
            ) : !isDirty ? (
              <p className="text-xs text-center text-gray-500 font-medium mt-1">{tEdit('noChangesToSave') || 'No changes to save'}</p>
            ) : null
          ) : (
            canSubmit && readyByAt && readyByValidation.isFuture ? (
              <p className="text-xs text-center text-green-600 font-medium mt-1">✓ {tNewOrder('validation.readyToSubmit') || 'Ready to submit'}</p>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

export const OrderSummaryPanel = memo(OrderSummaryPanelComponent);
