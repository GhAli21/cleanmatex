/**
 * Piece List Component
 * Displays a list of pieces for an order item
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { PieceCard } from './PieceCard';
import type { OrderItemPiece } from '@/types/order';

export interface PieceListProps {
  pieces: OrderItemPiece[];
  onPieceUpdate?: (pieceId: string, updates: Partial<OrderItemPiece>) => void;
  readOnly?: boolean;
  showSplitCheckbox?: boolean;
  selectedForSplit?: Set<string>;
  onSplitToggle?: (pieceId: string, selected: boolean) => void;
  rejectColor?: string;
  emptyMessage?: string;
}

export function PieceList({
  pieces,
  onPieceUpdate,
  readOnly = false,
  showSplitCheckbox = false,
  selectedForSplit = new Set(),
  onSplitToggle,
  rejectColor = '#10B981',
  emptyMessage,
}: PieceListProps) {
  const t = useTranslations('orders.pieces');
  const isRTL = useRTL();

  if (pieces.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
        <p className="text-sm">
          {emptyMessage || t('noPieces')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pieces.map((piece) => (
        <PieceCard
          key={piece.id}
          piece={piece}
          onUpdate={onPieceUpdate}
          readOnly={readOnly}
          showSplitCheckbox={showSplitCheckbox}
          isSelectedForSplit={selectedForSplit.has(piece.id)}
          onSplitToggle={onSplitToggle}
          rejectColor={rejectColor}
        />
      ))}
    </div>
  );
}

