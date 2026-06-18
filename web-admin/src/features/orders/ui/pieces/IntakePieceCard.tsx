'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { PieceBaseCard } from './PieceBaseCard';
import { CmxButton, CmxCheckbox, CmxInput, CmxTextarea } from '@ui/primitives';
import { EditIcon, SplitSquareHorizontal } from 'lucide-react';
import type { OrderItemPiece } from '@/types/order';

/**
 *
 */
export interface IntakePieceCardProps {
  piece: OrderItemPiece;
  onUpdate?: (pieceId: string, updates: Partial<OrderItemPiece>) => void;
  onEditPreferences?: (pieceId: string) => void;
  showSplitCheckbox?: boolean;
  isSelectedForSplit?: boolean;
  onSplitToggle?: (pieceId: string, selected: boolean) => void;
  rejectColor?: string;
  readOnly?: boolean;
}

/**
 *
 * @param root0
 * @param root0.piece
 * @param root0.onUpdate
 * @param root0.onEditPreferences
 * @param root0.showSplitCheckbox
 * @param root0.isSelectedForSplit
 * @param root0.onSplitToggle
 * @param root0.rejectColor
 * @param root0.readOnly
 */
export function IntakePieceCard({
  piece,
  onUpdate,
  onEditPreferences,
  showSplitCheckbox = false,
  isSelectedForSplit = false,
  onSplitToggle,
  rejectColor = '#10B981',
  readOnly = false,
}: IntakePieceCardProps) {
  const t = useTranslations('orders.pieces');
  const isRTL = useRTL();

  const handleChange = (field: keyof OrderItemPiece, value: unknown) => {
    if (!readOnly && onUpdate) {
      onUpdate(piece.id, { [field]: value } as Partial<OrderItemPiece>);
    }
  };

  // Build the details slot: Preference Pills
  const renderPreferences = () => {
    const hasPrefs = piece.service_prefs?.length || piece.conditions?.length || piece.packing_pref_code || piece.color;
    
    if (!hasPrefs) {
      return (
        <p className={`text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('prefSummaryNone')}
        </p>
      );
    }

    return (
      <div className={`flex flex-wrap gap-1 mt-2 ${isRTL ? 'justify-end' : 'justify-start'}`}>
        {/* Packing Preference */}
        {piece.packing_pref_code && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {piece.packing_pref_code.replace(/_/g, ' ')}
          </span>
        )}
        
        {/* Service Preferences */}
        {(piece.service_prefs ?? []).map((p) => {
          // Display extra price if it exists
          const priceDisplay = p.extra_price && p.extra_price > 0 ? ` (+${p.extra_price})` : '';
          return (
            <span
              key={p.preference_code}
              className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-100"
            >
              {p.preference_code.replace(/_/g, ' ')}{priceDisplay}
            </span>
          );
        })}
        
        {/* Conditions (Stain, Damage, etc.) */}
        {(piece.conditions ?? []).map((c) => (
          <span
            key={c}
            className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-100"
          >
            {c.replace(/_/g, ' ')}
          </span>
        ))}

        {/* Color */}
        {piece.color && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-900 border border-purple-100">
            {typeof piece.color === 'object' ? (piece.color as { primary?: string })?.primary ?? '' : piece.color}
          </span>
        )}
      </div>
    );
  };

  // Build the action slot: Edit Preferences & Split
  const renderActions = () => {
    return (
      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {!readOnly && onEditPreferences && (
          <CmxButton 
            variant="outline" 
            size="sm" 
            onClick={() => onEditPreferences(piece.id)}
            className="text-xs h-8"
          >
            <EditIcon className="w-3.5 h-3.5 mr-1" />
            {t('editPreferences')}
          </CmxButton>
        )}
        
        {showSplitCheckbox && (
          <CmxCheckbox
            checked={isSelectedForSplit}
            onChange={(e) => onSplitToggle?.(piece.id, e.target.checked)}
            label={t('split')}
            disabled={readOnly}
          />
        )}
      </div>
    );
  };

  // Build the status slot: Notes and Rack Location
  const renderStatus = () => {
    return (
      <div className="grid grid-cols-12 gap-3 mt-1">
        {/* Notes Input */}
        <div className="col-span-12 sm:col-span-8 min-w-0">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            {t('notes')}
          </label>
          {readOnly ? (
            <div className="text-sm text-slate-600 min-h-[36px]">
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

        {/* Rack Location Input */}
        <div className="col-span-12 sm:col-span-4 min-w-0">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            {t('rackLocation')}
          </label>
          {readOnly ? (
            <div className="text-sm text-slate-600">
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
    );
  };

  return (
    <PieceBaseCard
      piece={piece}
      rejectColor={rejectColor}
      detailsSlot={renderPreferences()}
      actionSlot={renderActions()}
      statusSlot={renderStatus()}
    />
  );
}
