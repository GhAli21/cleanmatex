/**
 * Order Summary Panel Component
 * Redesigned right panel matching POS-style mockup
 * PRD-010: Advanced Order Management
 */

'use client';

import { useState, memo, useCallback, useMemo, type Ref } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import {
  PAYMENT_MODAL_VERSIONS,
  type PaymentModalVersion,
} from '../hooks/use-payment-modal-version';
import { ItemCartList, type ItemCartListQuoteProps } from './item-cart-list';
import { ServiceSpeedSelect } from './service-speed-select';
import type { SpeedOptionPreviewSource } from '../hooks/use-speed-option-previews';
import { SERVICE_SPEEDS } from '@/lib/constants/commercial';
import { CmxButton, CmxInput, CmxSwitch, CmxTextarea } from '@ui/primitives';
import { CmxSummaryMessage } from '@ui/feedback';
import { CartQuoteTotals, type CartQuoteTotalsProps } from './cart-quote-totals';
import { EditControlNotice } from '../order-change/edit-control-notice';
import { useEditControlGroup } from '../order-change/use-edit-control-capability';
import { Calendar, Calculator, AlertCircle, Clock, User, Pencil, X } from 'lucide-react';
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms';
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
  /** Order Edit: the line is priced per piece (P9-01). */
  piecePriced?: boolean;
  serviceCategoryCode?: string;
  serviceCategoryName?: string;
  serviceCategoryName2?: string;
  priceOverride?: number | null;
  overrideReason?: string | null;
  /** The line's own speed; null follows the order speed. */
  serviceSpeed?: string | null;
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
  /**
   * New Order only: the server quote of the cart (P5-03). Order Edit passes
   * nothing; its only total is the live edit card (D33).
   */
  cartQuote?: Omit<CartQuoteTotalsProps, 'currencyCode'>;
  currencyCode?: string;
  onSubmit: () => void;
  /** When set, this is the only primary action. The panel does not choose an API from edit mode. */
  primaryAction?: {
    label: string;
    disabled: boolean;
    loading?: boolean;
    onClick: () => void;
  };
  onOpenReadyByModal?: () => void;
  onOpenPaymentModal?: () => void;
  onCalculateReadyBy?: () => Promise<void>;
  loading: boolean;
  trackByPiece?: boolean;
  isRetailOnlyOrder?: boolean;
  isEditMode?: boolean;
  isDirty?: boolean;
  onSave?: () => void;
  saveButtonRef?: Ref<HTMLButtonElement>;
  isSaving?: boolean;
  hasErrors?: boolean;
  validationErrors?: string[];
  selectedPieceId?: string | null;
  onSelectPiece?: (pieceId: string | null) => void;
  canSubmit: boolean;
  colorCatalog?: ColorCatalogEntry[];
  preferenceLabelByCode?: Record<string, string>;
  packingExtraPriceByCode?: Record<string, number>;
  // Customer header props
  customerName?: string;
  onSelectCustomer?: () => void;
  onEditCustomer?: () => void;
  onClearCustomer?: () => void;
  /** The order speed code (`sys_service_speed_cd`). */
  serviceSpeed?: string;
  onServiceSpeedChange?: (serviceSpeed: string) => void;
  /** New Order only: prices each option of the order speed menu. */
  speedPreview?: SpeedOptionPreviewSource;
  /** Shown only when a line has its own speed. */
  hasLineSpeedOverrides?: boolean;
  onApplySpeedToAllLines?: () => void;
  /** New Order: quoted figures per cart line and the line speed menus (P5-03b). */
  lineQuote?: ItemCartListQuoteProps;
  /** Rule #15: the lines a speed change re-priced, until dismissed. */
  speedChangeNote?: { title: string; items: string[]; onDismiss: () => void } | null;
  // Bags
  bags?: number;
  onBagsChange?: (count: number) => void;
  // Edit item notes (navigates to pieces tab)
  onEditItemPreferences?: (itemId: string) => void;
  showPaymentModalVersionSelector?: boolean;
  paymentModalVersion?: PaymentModalVersion;
  onPaymentModalVersionChange?: (value: PaymentModalVersion) => void;
}

/** Adaptive 44px targets on touch screens, or forced 44px everywhere when POS_STEPPER_MIN_TARGET = ALWAYS_TOUCH_44. */
const TOUCH_MIN =
  'pointer-coarse:min-h-[var(--cmx-touch-min)] pointer-coarse:min-w-[var(--cmx-touch-min)] cmx-pos-touch-target';

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
  cartQuote,
  currencyCode = '',
  onSubmit,
  primaryAction,
  onOpenReadyByModal,
  onOpenPaymentModal,
  onCalculateReadyBy,
  loading,
  trackByPiece = false,
  isRetailOnlyOrder = false,
  isEditMode = false,
  isDirty = false,
  saveButtonRef,
  isSaving = false,
  hasErrors = false,
  validationErrors = [],
  selectedPieceId = null,
  onSelectPiece,
  canSubmit,
  colorCatalog,
  preferenceLabelByCode,
  packingExtraPriceByCode,
  customerName,
  onSelectCustomer,
  onEditCustomer,
  onClearCustomer,
  serviceSpeed = SERVICE_SPEEDS.STANDARD,
  onServiceSpeedChange,
  speedPreview,
  hasLineSpeedOverrides = false,
  onApplySpeedToAllLines,
  lineQuote,
  speedChangeNote,
  bags = 0,
  onBagsChange,
  onEditItemPreferences,
  showPaymentModalVersionSelector = false,
  paymentModalVersion = PAYMENT_MODAL_VERSIONS.V4,
  onPaymentModalVersionChange,
}: OrderSummaryPanelProps) {
  const t = useTranslations('newOrder.orderSummary');
  const tNewOrder = useTranslations('newOrder');
  const tEdit = useTranslations('orders.edit');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const speedCapability = useEditControlGroup(['CHANGE_SERVICE_SPEED'], 'ORDER');
  const readyByCapability = useEditControlGroup(['CHANGE_READY_BY']);
  const lineCapability = useEditControlGroup(['ADD_ITEM', 'REMOVE_ITEM', 'CHANGE_ITEM_QUANTITY', 'ADD_PIECE', 'REMOVE_PIECE']);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  // V02_ENHANCED and V3 variants were retired; V4 is the only maintained modal.
  const paymentModalVersionLabel = useMemo(
    () => t('paymentModalVersionOptions.v4'),
    [t]
  );

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
    <div className="flex flex-1 min-h-0 flex-col bg-card overflow-hidden">

      {/* Customer Header */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border bg-muted">
        <div className="flex-1 min-w-0 flex items-center gap-2 bg-card border border-border rounded px-2 py-1.5">
          <span className={`flex-1 text-sm font-medium truncate text-start ${customerName ? 'text-foreground' : 'text-muted-foreground'}`}>
            {customerName || (tNewOrder('selectCustomer') || 'Select customer')}
          </span>
          {customerName && onClearCustomer && (
            <CmxButton
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClearCustomer}
              className={`shrink-0 h-6 w-6 ${TOUCH_MIN}`}
              aria-label={tCommon('clear') || 'Clear'}
            >
              <X className="w-3.5 h-3.5" aria-hidden />
            </CmxButton>
          )}
        </div>
        <CmxButton
          type="button"
          size="icon"
          onClick={onSelectCustomer}
          className={`shrink-0 h-8 w-8 ${TOUCH_MIN}`}
          aria-label={tNewOrder('selectCustomer') || 'Select customer'}
        >
          <User className="w-4 h-4" aria-hidden />
        </CmxButton>
        <CmxButton
          type="button"
          size="icon"
          onClick={onEditCustomer}
          className={`shrink-0 h-8 w-8 ${TOUCH_MIN}`}
          aria-label={tCommon('edit') || 'Edit'}
        >
          <Pencil className="w-4 h-4" aria-hidden />
        </CmxButton>
      </div>

      {/* Order speed (§5.4): new lines follow it; "Apply to all lines" resets line overrides */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border bg-muted">
        <span className="shrink-0 text-sm font-medium text-foreground">{tNewOrder('serviceSpeed.label')}</span>
        <ServiceSpeedSelect
          className="flex-1 min-w-0"
          value={serviceSpeed}
          onChange={(code) => { if (code) onServiceSpeedChange?.(code); }}
          disabled={!speedCapability.interactive || !onServiceSpeedChange}
          disabledReason={tNewOrder('serviceSpeed.locked')}
          ariaLabel={tNewOrder('serviceSpeed.orderAria')}
          preview={speedPreview}
        />
        {hasLineSpeedOverrides && onApplySpeedToAllLines ? (
          <CmxButton
            type="button"
            size="xs"
            variant="outline"
            onClick={onApplySpeedToAllLines}
            disabled={!speedCapability.interactive}
          >
            {tNewOrder('serviceSpeed.applyToAll')}
          </CmxButton>
        ) : null}
      </div>
      <div className="px-3 pb-2">
        <EditControlNotice codes={['CHANGE_SERVICE_SPEED']} />
      </div>

      {/* Scrollable Middle: Cart Items + Order Options (keeps Totals + Submit pinned above fold) */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-3 pt-2">
          <EditControlNotice codes={['ADD_ITEM', 'REMOVE_ITEM', 'CHANGE_ITEM_QUANTITY', 'ADD_PIECE', 'REMOVE_PIECE']} />
        </div>
        <div className={`p-3 ${lineCapability.interactive ? '' : 'pointer-events-none opacity-60'}`}>
          <ItemCartList
            items={items}
            onEditItem={onEditItem}
            onEditItemPreferences={onEditItemPreferences}
            onDeleteItem={handleDeleteItem}
            onPiecesChange={onPiecesChange}
            onCopyPieceToAll={onCopyPieceToAll}
            trackByPiece={trackByPiece}
            currencyCode={currencyCode}
            selectedPieceId={selectedPieceId}
            onSelectPiece={onSelectPiece}
            colorCatalog={colorCatalog}
            preferenceLabelByCode={preferenceLabelByCode}
            packingExtraPriceByCode={packingExtraPriceByCode}
            orderSpeed={serviceSpeed}
            quote={lineQuote}
          />
        </div>

        {speedChangeNote ? (
          <div className="px-3 pb-2">
            <CmxSummaryMessage
              type="info"
              title={speedChangeNote.title}
              items={speedChangeNote.items}
              onDismiss={speedChangeNote.onDismiss}
            />
          </div>
        ) : null}

        {/* Order Options (Ready By, Pieces/Bags, Notes, Quick Drop/Retail) */}
        <div className="border-t border-border bg-card">

        {/* Ready By Row (compact, above footer grid) */}
        <div className="px-3 pt-2 pb-1 space-y-1">
          <EditControlNotice codes={['CHANGE_READY_BY']} />
          <div className="flex items-stretch gap-2">
            {onCalculateReadyBy && (
              <CmxButton
                type="button"
                size="icon"
                onClick={handleCalculateReadyBy}
                disabled={!readyByCapability.interactive || isCalculating || items.length === 0}
                className={`shrink-0 h-auto min-h-7 w-8 ${TOUCH_MIN}`}
                aria-label={tNewOrder('calculateReadyBy')}
              >
                <Calculator className="w-3 h-3" aria-hidden />
              </CmxButton>
            )}
            <div
              role="button"
              tabIndex={readyByCapability.interactive ? 0 : -1}
              aria-disabled={!readyByCapability.interactive}
              className={`flex-1 flex items-center gap-1.5 px-2 py-1 border rounded bg-card text-xs ${readyByValidation.isTooFar ? 'border-destructive' : readyByValidation.isValid && readyByAt ? 'border-info-border' : 'border-border'} ${readyByCapability.interactive ? 'cursor-pointer hover:border-primary' : 'cursor-not-allowed opacity-60'} transition-colors min-w-0`}
              onClick={(e) => {
                if (!readyByCapability.interactive) return;
                (e.currentTarget as HTMLElement).focus();
                onOpenReadyByModal?.();
              }}
              onKeyDown={(e) => {
                if (!readyByCapability.interactive) return;
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenReadyByModal?.(); }
              }}
            >
              <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
              {readyByAt ? (
                <>
                  <span className="flex-1 text-foreground min-w-0 text-start">
                    <bdi className="tabular-nums">
                      {(() => {
                        const d = new Date(readyByAt);
                        const day = String(d.getDate()).padStart(2, '0');
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const year = d.getFullYear();
                        return `${day}/${month}/${year}`;
                      })()}
                    </bdi>
                  </span>
                  <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-foreground min-w-0 text-start">
                    <bdi className="tabular-nums">
                      {new Date(readyByAt).toLocaleTimeString(isRTL ? 'ar' : 'en-US', {
                        hour: '2-digit', minute: '2-digit', hour12: true,
                      })}
                    </bdi>
                  </span>
                </>
              ) : (
                <span className="flex-1 text-muted-foreground min-w-0 text-start">{tNewOrder('readyBy') || 'Ready by'}</span>
              )}
            </div>
            <CmxButton
              type="button"
              size="icon"
              onClick={(e) => {
                (e.currentTarget as HTMLElement).focus();
                onOpenReadyByModal?.();
              }}
              className={`shrink-0 h-auto min-h-7 w-8 ${TOUCH_MIN}`}
              aria-label={t('openReadyBy')}
            >
              <Calendar className="w-3 h-3" aria-hidden />
            </CmxButton>
          </div>
          {readyByAt && !readyByValidation.isFuture && (
            <div role="alert" className="flex items-center gap-1.5 p-1.5 bg-danger-bg border border-danger-border rounded text-danger-text text-xs">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{readyByValidation.message}</span>
            </div>
          )}
        </div>

        {/* Footer Grid — 3 rows × 2 cols */}
        <div className="border-t border-border">

          {/* Row 1: Pieces | Bags */}
          <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted">
              <span className="text-xs font-medium text-muted-foreground">{tCommon('pieces') || t('pieces') || 'Pieces'}</span>
              <bdi className="text-sm font-bold text-foreground tabular-nums">{totalPieces}</bdi>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-muted">
              <span className="text-xs font-medium text-muted-foreground">{t('bags') || 'Bags'}</span>
              {onBagsChange ? (
                <CmxInput
                  type="number"
                  min={0}
                  fullWidth={false}
                  value={bags}
                  onChange={(e) => onBagsChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="h-8 w-16 px-1.5 py-0 text-center text-sm font-bold tabular-nums"
                  aria-label={t('bags') || 'Bags'}
                  dir="ltr"
                />
              ) : (
                <bdi className="text-sm font-bold text-foreground tabular-nums">{bags}</bdi>
              )}
            </div>
          </div>

          <div className="px-3 pt-2">
            <EditControlNotice codes={['CHANGE_ORDER_NOTES']} />
          </div>
          {/* Row 2: Notes | Save toggle */}
          <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
            <div className="flex items-center px-3 py-2 bg-muted">
              <span className="text-xs font-medium text-muted-foreground">{t('notes') || 'Notes'}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-muted">
              <span className="text-xs font-medium text-muted-foreground">{tCommon('save') || 'Save'}</span>
              <CmxSwitch
                size="sm"
                checked={showNotes}
                onCheckedChange={setShowNotes}
                aria-label={t('showNotes')}
              />
            </div>
          </div>

          {/* Notes textarea — shown when Save toggle is ON */}
          {showNotes && (
            <div className="px-3 py-2 border-b border-border bg-card">
              <CmxTextarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                rows={2}
                className="w-full text-xs resize-none text-start"
                placeholder={t('addSpecialInstructions') || 'Add special instructions...'}
                dir={isRTL ? 'rtl' : 'ltr'}
              />
            </div>
          )}

          {/* Row 3: Quick Drop | Retail */}
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className="flex items-center gap-2 px-3 py-2">
              <CmxButton
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  const next = Math.max(0, quickDropQuantity - 1);
                  onQuickDropQuantityChange(next);
                  if (next === 0 && isQuickDrop) _onQuickDropToggle(false);
                }}
                className={`h-8 w-8 font-bold text-sm ${TOUCH_MIN}`}
                aria-label={t('quickDropDecrease')}
              >
                -
              </CmxButton>
              <span className="text-xs font-medium text-muted-foreground flex-1 text-center">
                {t('quickDrop') || 'Quick Drop'}
              </span>
              <CmxButton
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  const next = quickDropQuantity + 1;
                  onQuickDropQuantityChange(next);
                  if (next > 0 && !isQuickDrop) _onQuickDropToggle(true);
                }}
                className={`h-8 w-8 font-bold text-sm ${TOUCH_MIN}`}
                aria-label={t('quickDropIncrease')}
              >
                +
              </CmxButton>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">{t('retail') || 'Retail'}</span>
              {/* Retail is auto-derived, shown as read-only indicator */}
              <div
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  isRetailOnlyOrder ? 'bg-primary' : 'bg-border'
                }`}
                role="img"
                aria-label={isRetailOnlyOrder ? t('retailOrder') : t('notRetail')}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-card shadow-sm transition-transform ${
                    isRetailOnlyOrder ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-1 rtl:-translate-x-1'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {showPaymentModalVersionSelector && onPaymentModalVersionChange && (
          <div className="px-3 pt-3">
            <div className="rounded-lg border border-info-border bg-info-bg p-3">
              <div className="space-y-2 text-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-text">
                    {t('paymentModalVersionLabel')}
                  </p>
                  <p className="text-xs text-primary-text/90">
                    {t('paymentModalVersionHint')}
                  </p>
                </div>
                <CmxSelectDropdown
                  value={paymentModalVersion}
                  onValueChange={(value) => onPaymentModalVersionChange(value as PaymentModalVersion)}
                >
                  <CmxSelectDropdownTrigger className="h-11 bg-card" dir={isRTL ? 'rtl' : 'ltr'}>
                    <CmxSelectDropdownValue
                      displayValue={paymentModalVersionLabel}
                      placeholder={paymentModalVersionLabel}
                    />
                  </CmxSelectDropdownTrigger>
                  <CmxSelectDropdownContent>
                    {/* V02_ENHANCED and V3 variants were retired; V4 is the only maintained modal. */}
                    <CmxSelectDropdownItem value={PAYMENT_MODAL_VERSIONS.V4}>
                      {t('paymentModalVersionOptions.v4')}
                    </CmxSelectDropdownItem>
                  </CmxSelectDropdownContent>
                </CmxSelectDropdown>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Pinned Checkout Footer — Totals + Submit Order always visible above fold */}
      <div className="shrink-0 border-t-2 border-border bg-card">
        {cartQuote ? <CartQuoteTotals {...cartQuote} currencyCode={currencyCode} /> : null}

        {/* Submit Button — carries no money (D33); the only total is the server one above */}
        <div className="p-3 bg-card border-t border-border">
          {/* Ruling 7 (PR-04): primary follows the Organization theme, no fixed green. */}
          <CmxButton
            ref={saveButtonRef}
            type="button"
            size="lg"
            onClick={primaryAction ? primaryAction.onClick : (onOpenPaymentModal || onSubmit)}
            disabled={primaryAction ? primaryAction.disabled : (loading || !canSubmit)}
            className="w-full min-h-11 font-semibold shadow-md"
          >
            <span className="text-base">
              {primaryAction
                ? (primaryAction.loading ? tEdit('workspace.reviewing') : primaryAction.label)
                : ((loading || isSaving)
                  ? t('processing')
                  : tNewOrder('submitOrder'))}
            </span>
          </CmxButton>

          {/* Validation hints */}
          {isEditMode && !primaryAction ? (
            hasErrors && validationErrors.length > 0 ? (
              <p role="alert" className="text-xs text-center text-danger-text font-medium mt-1">{validationErrors[0]}</p>
            ) : isDirty && !isSaving && !loading ? (
              <p className="text-xs text-center text-success-text font-medium mt-1">✓ {tEdit('unsavedChanges') || 'You have unsaved changes'}</p>
            ) : !isDirty ? (
              <p className="text-xs text-center text-muted-foreground font-medium mt-1">{tEdit('noChangesToSave') || 'No changes to save'}</p>
            ) : null
          ) : (
            canSubmit && readyByAt && readyByValidation.isFuture ? (
              <p className="text-xs text-center text-success-text font-medium mt-1">✓ {tNewOrder('validation.readyToSubmit') || 'Ready to submit'}</p>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

export const OrderSummaryPanel = memo(OrderSummaryPanelComponent);
