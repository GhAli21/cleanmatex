/**
 * Piece Card Component
 * Individual piece display/edit card
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { PieceStatusBadge } from './PieceStatusBadge';
import { PiecePreferencesEditorDialog } from './piece-preferences-editor-dialog';
import { CmxCard, CmxInput, CmxTextarea, CmxCheckbox, CmxButton } from '@ui/primitives';
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms';
import type { OrderItemPiece } from '@/types/order';

export interface PieceCardProps {
  piece: OrderItemPiece;
  onUpdate?: (pieceId: string, updates: Partial<OrderItemPiece>) => void;
  readOnly?: boolean;
  showSplitCheckbox?: boolean;
  isSelectedForSplit?: boolean;
  onSplitToggle?: (pieceId: string, selected: boolean) => void;
  rejectColor?: string;
  /** Bulk rack/step toolbar: show selection checkbox */
  bulkSelectMode?: boolean;
  isBulkSelected?: boolean;
  onBulkSelectToggle?: (pieceId: string, selected: boolean) => void;
  /** For preferences dialog */
  orderId?: string;
  orderItemId?: string;
  branchId?: string | null;
  /** Called after preferences save (reload pieces + price preview) */
  onPreferencesSaved?: () => void | Promise<void>;
  /** Tighter layout for long piece lists */
  density?: 'comfortable' | 'compact';
}

const PROCESSING_STEPS = [
  { value: 'sorting', labelKey: 'steps.sorting' },
  { value: 'pretreatment', labelKey: 'steps.pretreatment' },
  { value: 'washing', labelKey: 'steps.washing' },
  { value: 'drying', labelKey: 'steps.drying' },
  { value: 'finishing', labelKey: 'steps.finishing' },
];

function formatPieceCodeDisplay(code: string): { short: string; full: string } {
  const full = code.trim();
  if (full.length <= 14) return { short: full, full };
  return { short: `…${full.slice(-8)}`, full };
}

const PieceCardComponent = function PieceCard({
  piece,
  onUpdate,
  readOnly = false,
  showSplitCheckbox = false,
  isSelectedForSplit = false,
  onSplitToggle,
  rejectColor = '#10B981',
  bulkSelectMode = false,
  isBulkSelected = false,
  onBulkSelectToggle,
  orderId,
  orderItemId,
  branchId,
  onPreferencesSaved,
  density = 'comfortable',
}: PieceCardProps) {
  const t = useTranslations('orders.pieces');
  const isRTL = useRTL();
  const [prefsOpen, setPrefsOpen] = React.useState(false);
  const pad = density === 'compact' ? 'p-3' : 'p-4';

  const handleChange = (field: keyof OrderItemPiece, value: unknown) => {
    if (!readOnly && onUpdate) {
      onUpdate(piece.id, { [field]: value } as Partial<OrderItemPiece>);
    }
  };

  const handleSplitChange = (checked: boolean) => {
    if (onSplitToggle) {
      onSplitToggle(piece.id, checked);
    }
  };

  const codeDisplay = piece.piece_code ? formatPieceCodeDisplay(piece.piece_code) : null;

  return (
    <CmxCard
      className={`${pad} ${
        piece.is_rejected
          ? 'border-l-4'
          : 'border'
      }`}
      style={{
        backgroundColor: piece.is_rejected ? `${rejectColor}15` : undefined,
        borderLeftColor: piece.is_rejected ? rejectColor : undefined,
      }}
    >
      {/* Header */}
      <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-center justify-between mb-3 gap-2`}>
        <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-center gap-2 min-w-0 flex-1`}>
          {bulkSelectMode && !readOnly && (
            <CmxCheckbox
              checked={isBulkSelected}
              onChange={(e) => onBulkSelectToggle?.(piece.id, e.target.checked)}
              label=""
              aria-label={t('bulkSelectPiece', { seq: piece.piece_seq })}
            />
          )}
          <span className="font-medium text-sm text-gray-700 shrink-0">
            {t('piece')} {piece.piece_seq}
          </span>
          {codeDisplay && (
            <span
              className="text-xs text-gray-500 truncate min-w-0"
              title={codeDisplay.full}
            >
              ({codeDisplay.short})
            </span>
          )}
        </div>
        <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-center gap-2 shrink-0`}>
          {!readOnly && orderId && orderItemId && onPreferencesSaved && (
            <>
              <CmxButton type="button" variant="outline" size="sm" onClick={() => setPrefsOpen(true)}>
                {t('editPreferences')}
              </CmxButton>
              <PiecePreferencesEditorDialog
                open={prefsOpen}
                onOpenChange={setPrefsOpen}
                orderId={orderId}
                orderItemId={orderItemId}
                piece={piece}
                branchId={branchId}
                onSaved={() => onPreferencesSaved()}
              />
            </>
          )}
          <PieceStatusBadge
            status={piece.piece_status}
            isRejected={piece.is_rejected || false}
          />
        </div>
      </div>

      {(piece.service_prefs?.length || piece.conditions?.length || piece.packing_pref_code) ? (
        <div
          className={`flex flex-wrap gap-1 mb-3 ${isRTL ? 'justify-end' : 'justify-start'}`}
          aria-label={t('prefSummaryAria')}
        >
          {piece.packing_pref_code && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {piece.packing_pref_code.replace(/_/g, ' ')}
            </span>
          )}
          {(piece.service_prefs ?? []).map((p) => (
            <span
              key={p.preference_code}
              className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-100"
            >
              {p.preference_code.replace(/_/g, ' ')}
            </span>
          ))}
          {(piece.conditions ?? []).map((c) => (
            <span
              key={c}
              className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-100"
            >
              {c.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      ) : null}

      {/* Content Grid */}
      <div className="grid grid-cols-12 gap-3">
        {/* Processing Step */}
        <div className="col-span-12 sm:col-span-3 min-w-0">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {t('step')}
          </label>
          {readOnly ? (
            <div className="text-sm text-gray-600">
              {piece.last_step
                ? t(`steps.${piece.last_step}`) || piece.last_step
                : t('notSet')}
            </div>
          ) : (
            <CmxSelectDropdown
              value={piece.last_step || ''}
              onValueChange={(value) => handleChange('last_step', value)}
            >
              <CmxSelectDropdownTrigger className="h-9 w-full min-w-0">
                <CmxSelectDropdownValue
                  placeholder={t('selectStep')}
                  displayValue={piece.last_step ? t(`steps.${piece.last_step}`) || piece.last_step : undefined}
                />
              </CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {PROCESSING_STEPS.map((step) => (
                  <CmxSelectDropdownItem key={step.value} value={step.value}>
                    {t(step.labelKey)}
                  </CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          )}
        </div>

        {/* Ready Status */}
        <div className="col-span-12 sm:col-span-2 flex items-end pb-1">
          <CmxCheckbox
            checked={piece.piece_status === 'ready'}
            onChange={(e) =>
              handleChange('piece_status', e.target.checked ? 'ready' : 'processing')
            }
            label={t('ready')}
            disabled={readOnly}
          />
        </div>

        {/* Split Checkbox */}
        {showSplitCheckbox && (
          <div className="col-span-12 sm:col-span-2 flex items-end pb-1">
            <CmxCheckbox
              checked={isSelectedForSplit}
              onChange={(e) => handleSplitChange(e.target.checked)}
              label={t('split')}
              disabled={readOnly}
            />
          </div>
        )}

        {/* Notes */}
        <div className={`col-span-12 ${showSplitCheckbox ? 'sm:col-span-3' : 'sm:col-span-5'} min-w-0`}>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {t('notes')}
          </label>
          {readOnly ? (
            <div className="text-sm text-gray-600 min-h-[36px]">
              {piece.notes || t('noNotes')}
            </div>
          ) : (
            <CmxTextarea
              value={piece.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder={t('notesPlaceholder')}
              className="h-9 resize-none text-sm w-full min-w-0"
              rows={1}
            />
          )}
        </div>

        {/* Rack Location */}
        <div className="col-span-12 sm:col-span-2 min-w-0">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {t('rackLocation')}
          </label>
          {readOnly ? (
            <div className="text-sm text-gray-600">
              {piece.rack_location || t('notSet')}
            </div>
          ) : (
            <CmxInput
              value={piece.rack_location || ''}
              onChange={(e) => handleChange('rack_location', e.target.value)}
              placeholder={t('rackLocationPlaceholder')}
              className="h-9 text-sm w-full min-w-0"
            />
          )}
        </div>
      </div>

      {/* Additional Info */}
      {(piece.color || piece.brand || piece.has_stain || piece.has_damage) && (
        <div className="mt-3 pt-3 border-t text-xs text-gray-500">
          {piece.color && <span>{t('color')}: {typeof piece.color === 'object' ? (piece.color as { primary?: string })?.primary ?? '' : piece.color}</span>}
          {piece.brand && <span className="ms-2">{t('brand')}: {piece.brand}</span>}
          {piece.has_stain && <span className="ms-2">{t('hasStain')}</span>}
          {piece.has_damage && <span className="ms-2">{t('hasDamage')}</span>}
        </div>
      )}
    </CmxCard>
  );
};

function prefsSignature(piece: OrderItemPiece): string {
  return JSON.stringify({
    s: piece.service_prefs,
    c: piece.conditions,
    p: piece.packing_pref_code,
  });
}

export const PieceCard = React.memo(PieceCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.piece.id === nextProps.piece.id &&
    prevProps.piece.piece_status === nextProps.piece.piece_status &&
    prevProps.piece.is_rejected === nextProps.piece.is_rejected &&
    prevProps.piece.rack_location === nextProps.piece.rack_location &&
    prevProps.piece.last_step === nextProps.piece.last_step &&
    prevProps.piece.notes === nextProps.piece.notes &&
    prevProps.piece.piece_code === nextProps.piece.piece_code &&
    prevProps.piece.packing_pref_code === nextProps.piece.packing_pref_code &&
    prefsSignature(prevProps.piece) === prefsSignature(nextProps.piece) &&
    prevProps.isSelectedForSplit === nextProps.isSelectedForSplit &&
    prevProps.isBulkSelected === nextProps.isBulkSelected &&
    prevProps.bulkSelectMode === nextProps.bulkSelectMode &&
    prevProps.readOnly === nextProps.readOnly &&
    prevProps.density === nextProps.density &&
    prevProps.orderId === nextProps.orderId &&
    prevProps.orderItemId === nextProps.orderItemId
  );
});
