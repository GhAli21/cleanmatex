'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { PieceBaseCard } from './PieceBaseCard';
import { CmxCheckbox } from '@ui/primitives';
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms';
import { PieceStatusBadge } from '../PieceStatusBadge';
import { AlertTriangle } from 'lucide-react';
import type { OrderItemPiece } from '@/types/order';

const PROCESSING_STEPS = [
  { value: 'sorting', labelKey: 'steps.sorting' },
  { value: 'pretreatment', labelKey: 'steps.pretreatment' },
  { value: 'washing', labelKey: 'steps.washing' },
  { value: 'drying', labelKey: 'steps.drying' },
  { value: 'finishing', labelKey: 'steps.finishing' },
];

export interface ProcessingPieceCardProps {
  piece: OrderItemPiece;
  onUpdate?: (pieceId: string, updates: Partial<OrderItemPiece>) => void;
  isBulkSelected?: boolean;
  onBulkSelectToggle?: (pieceId: string, selected: boolean) => void;
  readOnly?: boolean;
}

export function ProcessingPieceCard({
  piece,
  onUpdate,
  isBulkSelected = false,
  onBulkSelectToggle,
  readOnly = false,
}: ProcessingPieceCardProps) {
  const t = useTranslations('orders.pieces');
  const isRTL = useRTL();

  const handleChange = (field: keyof OrderItemPiece, value: unknown) => {
    if (!readOnly && onUpdate) {
      onUpdate(piece.id, { [field]: value } as Partial<OrderItemPiece>);
    }
  };

  // Extract only critical conditions (damages, specials) - ignore standard service prefs
  const criticalConditions = (piece.conditions ?? []).filter(c => 
    c.toLowerCase().includes('damage') || c.toLowerCase().includes('special')
  );

  const renderDetails = () => {
    return (
      <div className={`flex flex-col gap-2 mt-2 ${isRTL ? 'items-end' : 'items-start'}`}>
        
        {/* Critical Warnings */}
        {criticalConditions.length > 0 && (
          <div className={`flex flex-wrap gap-1 ${isRTL ? 'justify-end' : 'justify-start'}`}>
            {criticalConditions.map((c) => (
              <span
                key={c}
                className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-sm bg-red-50 text-red-700 border border-red-200 font-semibold"
              >
                <AlertTriangle className="w-3 h-3 mr-1" />
                {c.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Processing Step Dropdown */}
        <div className="w-full sm:w-1/2 min-w-0 mt-2">
          <label className="block text-xs font-medium text-slate-700 mb-1">
            {t('step')}
          </label>
          {readOnly ? (
            <div className="text-sm text-slate-600 font-medium">
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
      </div>
    );
  };

  const renderActions = () => {
    return (
      <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <PieceStatusBadge
          status={piece.piece_status}
          isRejected={piece.is_rejected || false}
        />
        {!readOnly && (
          <div className="flex items-center justify-center bg-slate-50 p-2 rounded-lg border border-slate-200">
            {/* Massive checkbox for touch screens */}
            <CmxCheckbox
              checked={isBulkSelected}
              onChange={(e) => onBulkSelectToggle?.(piece.id, e.target.checked)}
              label=""
              className="w-6 h-6 sm:w-8 sm:h-8" 
              aria-label={t('bulkSelectPiece', { seq: piece.piece_seq })}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <PieceBaseCard
      piece={piece}
      detailsSlot={renderDetails()}
      actionSlot={renderActions()}
      // Intentionally omitting statusSlot to keep the card compact and focused
    />
  );
}
