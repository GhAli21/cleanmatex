'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxCard } from '@ui/primitives/cmx-card';
import type { OrderItemPiece } from '@/types/order';
import { Shirt, Scissors } from 'lucide-react'; // Fallback icons

export interface PieceBaseCardProps {
  piece: OrderItemPiece;
  rejectColor?: string;
  className?: string;
  /** Injected slots for context-specific modes */
  actionSlot?: React.ReactNode;
  detailsSlot?: React.ReactNode;
  statusSlot?: React.ReactNode;
}

function formatPieceCodeDisplay(code: string): { short: string; full: string } {
  const full = code.trim();
  if (full.length <= 14) return { short: full, full };
  return { short: `…${full.slice(-8)}`, full };
}

export function PieceBaseCard({
  piece,
  rejectColor = '#10B981',
  className = '',
  actionSlot,
  detailsSlot,
  statusSlot,
}: PieceBaseCardProps) {
  const t = useTranslations('orders.pieces');
  const isRTL = useRTL();
  
  const codeDisplay = piece.piece_code ? formatPieceCodeDisplay(piece.piece_code) : null;
  const isRejected = piece.is_rejected || false;

  // Service category is the only stable garment hint on the typed piece model.
  const serviceCategory = piece.service_category_code?.toLowerCase() ?? '';
  const PieceIcon = serviceCategory.includes('tailor') || serviceCategory.includes('alter')
    ? Scissors
    : Shirt;

  return (
    <CmxCard
      className={`p-4 flex flex-col gap-3 ${
        isRejected ? 'border-l-4' : 'border'
      } ${className}`}
      style={{
        backgroundColor: isRejected ? `${rejectColor}15` : undefined,
        borderLeftColor: isRejected ? rejectColor : undefined,
      }}
    >
      {/* Top Header Row (Icon, ID, Actions) */}
      <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-start justify-between gap-4`}>
        {/* Identity Block */}
        <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-center gap-3 min-w-0 flex-1`}>
          <div className="flex-shrink-0 w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center text-slate-500">
            <PieceIcon className="w-5 h-5" />
          </div>
          <div className={`flex flex-col ${isRTL ? 'items-end' : 'items-start'} min-w-0`}>
            <span className="font-medium text-sm text-gray-800 shrink-0">
              {t('piece')} {piece.piece_seq}
            </span>
            {codeDisplay && (
              <span
                className="text-xs text-gray-400 truncate min-w-0"
                title={codeDisplay.full}
              >
                {codeDisplay.short}
              </span>
            )}
          </div>
        </div>

        {/* Action Slot (e.g. Edit button, Bulk Checkbox) */}
        {actionSlot && (
          <div className={`flex items-center shrink-0`}>
            {actionSlot}
          </div>
        )}
      </div>

      {/* Details Slot (e.g. Preferences Pills, Care Warnings) */}
      {detailsSlot && (
        <div className={`w-full`}>
          {detailsSlot}
        </div>
      )}

      {/* Status Slot (e.g. Notes, Rack location, Washing status) */}
      {statusSlot && (
        <div className={`w-full pt-2 mt-1 border-t border-slate-100`}>
          {statusSlot}
        </div>
      )}
    </CmxCard>
  );
}
