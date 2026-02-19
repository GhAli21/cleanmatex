/**
 * Piece Card Component
 * Individual piece display/edit card
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { PieceStatusBadge } from './PieceStatusBadge';
import { CmxCard, CmxInput, CmxTextarea, CmxCheckbox } from '@ui/primitives';
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
}

const PROCESSING_STEPS = [
  { value: 'sorting', labelKey: 'steps.sorting' },
  { value: 'pretreatment', labelKey: 'steps.pretreatment' },
  { value: 'washing', labelKey: 'steps.washing' },
  { value: 'drying', labelKey: 'steps.drying' },
  { value: 'finishing', labelKey: 'steps.finishing' },
];

const PieceCardComponent = function PieceCard({
  piece,
  onUpdate,
  readOnly = false,
  showSplitCheckbox = false,
  isSelectedForSplit = false,
  onSplitToggle,
  rejectColor = '#10B981',
}: PieceCardProps) {
  const t = useTranslations('orders.pieces');
  const isRTL = useRTL();

  const handleChange = (field: keyof OrderItemPiece, value: any) => {
    if (!readOnly && onUpdate) {
      onUpdate(piece.id, { [field]: value } as Partial<OrderItemPiece>);
    }
  };

  const handleSplitChange = (checked: boolean) => {
    if (onSplitToggle) {
      onSplitToggle(piece.id, checked);
    }
  };

  return (
    <CmxCard
      className={`p-4 ${
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
      <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-center justify-between mb-3`}>
        <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-center gap-2`}>
          <span className="font-medium text-sm text-gray-700">
            {t('piece')} {piece.piece_seq}
          </span>
          {piece.piece_code && (
            <span className="text-xs text-gray-500">({piece.piece_code})</span>
          )}
        </div>
        <PieceStatusBadge
          status={piece.piece_status}
          isRejected={piece.is_rejected || false}
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-12 gap-3">
        {/* Processing Step */}
        <div className="col-span-3">
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
              <CmxSelectDropdownTrigger className="h-9">
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
        <div className="col-span-2 flex items-end pb-1">
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
          <div className="col-span-2 flex items-end pb-1">
            <CmxCheckbox
              checked={isSelectedForSplit}
              onChange={(e) => handleSplitChange(e.target.checked)}
              label={t('split')}
              disabled={readOnly}
            />
          </div>
        )}

        {/* Notes */}
        <div className={showSplitCheckbox ? 'col-span-3' : 'col-span-5'}>
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
              className="h-9 resize-none text-sm"
              rows={1}
            />
          )}
        </div>

        {/* Rack Location */}
        <div className="col-span-2">
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
              className="h-9 text-sm"
            />
          )}
        </div>
      </div>

      {/* Additional Info */}
      {(piece.color || piece.brand || piece.has_stain || piece.has_damage) && (
        <div className="mt-3 pt-3 border-t text-xs text-gray-500">
          {piece.color && <span>{t('color')}: {piece.color}</span>}
          {piece.brand && <span className="ml-2">{t('brand')}: {piece.brand}</span>}
          {piece.has_stain && <span className="ml-2">{t('hasStain')}</span>}
          {piece.has_damage && <span className="ml-2">{t('hasDamage')}</span>}
        </div>
      )}
    </CmxCard>
  );
};

export const PieceCard = React.memo(PieceCardComponent, (prevProps, nextProps) => {
  // Custom comparison function for performance
  return (
    prevProps.piece.id === nextProps.piece.id &&
    prevProps.piece.piece_status === nextProps.piece.piece_status &&
    prevProps.piece.is_rejected === nextProps.piece.is_rejected &&
    prevProps.piece.rack_location === nextProps.piece.rack_location &&
    prevProps.piece.last_step === nextProps.piece.last_step &&
    prevProps.isSelectedForSplit === nextProps.isSelectedForSplit &&
    prevProps.readOnly === nextProps.readOnly
  );
});

