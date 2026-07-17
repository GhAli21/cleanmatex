'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxCard } from '@ui/primitives/cmx-card';
import type { OrderItemPiece } from '@/types/order';
import { Shirt, Scissors } from 'lucide-react'; // Fallback icons

/**
 *
 */
export interface PieceBaseCardProps {
  piece: OrderItemPiece;
  rejectColor?: string;
  className?: string;
  density?: 'comfortable' | 'compact';
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

/**
 *
 * @param root0
 * @param root0.piece
 * @param root0.rejectColor
 * @param root0.className
 * @param root0.actionSlot
 * @param root0.detailsSlot
 * @param root0.statusSlot
 */
export function PieceBaseCard({
  piece,
  rejectColor = '#10B981',
  className = '',
  density = 'comfortable',
  actionSlot,
  detailsSlot,
  statusSlot,
}: PieceBaseCardProps) {
  const t = useTranslations('orders.pieces');
  const isRTL = useRTL();
  
  const codeDisplay = piece.piece_code ? formatPieceCodeDisplay(piece.piece_code) : null;
  const isRejected = piece.is_rejected || false;
  const compact = density === 'compact';

  // Service category is the only stable garment hint on the typed piece model.
  const serviceCategory = piece.service_category_code?.toLowerCase() ?? '';
  const PieceIcon = serviceCategory.includes('tailor') || serviceCategory.includes('alter')
    ? Scissors
    : Shirt;

  return (
    <CmxCard
      className={`${compact ? 'p-3 gap-2' : 'p-4 gap-3'} flex flex-col ${
        isRejected ? 'border-l-4' : 'border'
      } ${className}`}
      style={{
        backgroundColor: isRejected ? `${rejectColor}15` : undefined,
        borderLeftColor: isRejected ? rejectColor : undefined,
      }}
    >
      <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-start justify-between gap-3`}>
        <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-center gap-2.5 min-w-0 flex-1`}>
          <div
            className={`flex-shrink-0 ${compact ? 'w-8 h-8' : 'w-10 h-10'} bg-slate-100 rounded-md flex items-center justify-center text-slate-600`}
          >
            <PieceIcon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
          </div>
          <div className={`flex flex-col ${isRTL ? 'items-end' : 'items-start'} min-w-0`}>
            <span className="font-medium text-sm text-gray-900 shrink-0">
              {t('piece')} {piece.piece_seq}
            </span>
            {codeDisplay && (
              <span
                className="text-xs text-gray-600 truncate min-w-0"
                title={codeDisplay.full}
              >
                {codeDisplay.short}
              </span>
            )}
          </div>
        </div>

        {actionSlot && (
          <div className="flex items-center shrink-0">
            {actionSlot}
          </div>
        )}
      </div>

      {detailsSlot && <div className="w-full">{detailsSlot}</div>}

      {statusSlot && (
        <div className="w-full pt-2 mt-0.5 border-t border-slate-100">
          {statusSlot}
        </div>
      )}
    </CmxCard>
  );
}
