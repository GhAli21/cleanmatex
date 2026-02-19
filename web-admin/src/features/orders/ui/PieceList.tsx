/**
 * Piece List Component with Pagination
 * Displays a list of pieces for an order item with pagination support
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { PieceCard } from './PieceCard';
import { CmxButton } from '@ui/primitives';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  pageSize?: number;
  enablePagination?: boolean;
}

const DEFAULT_PAGE_SIZE = 20;

export function PieceList({
  pieces,
  onPieceUpdate,
  readOnly = false,
  showSplitCheckbox = false,
  selectedForSplit = new Set(),
  onSplitToggle,
  rejectColor = '#10B981',
  emptyMessage,
  pageSize = DEFAULT_PAGE_SIZE,
  enablePagination = true,
}: PieceListProps) {
  const t = useTranslations('orders.pieces');
  const isRTL = useRTL();
  const [currentPage, setCurrentPage] = React.useState(1);

  const totalPages = Math.ceil(pieces.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedPieces = enablePagination && pieces.length > pageSize
    ? pieces.slice(startIndex, endIndex)
    : pieces;

  React.useEffect(() => {
    // Reset to page 1 when pieces change significantly
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [pieces.length, totalPages, currentPage]);

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
    <div className="space-y-4">
      {/* Pieces List */}
      <div className="space-y-3">
        {paginatedPieces.map((piece) => (
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

      {/* Pagination */}
      {enablePagination && pieces.length > pageSize && (
        <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-center justify-between pt-4 border-t`}>
          <div className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('showing', { 
              start: startIndex + 1, 
              end: Math.min(endIndex, pieces.length), 
              total: pieces.length 
            })}
          </div>
          <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-center gap-2`}>
            <CmxButton
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={isRTL ? 'flex-row-reverse' : ''}
            >
              <ChevronLeft className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              {t('previous')}
            </CmxButton>
            <span className="text-sm text-gray-600">
              {t('page', { current: currentPage, total: totalPages })}
            </span>
            <CmxButton
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={isRTL ? 'flex-row-reverse' : ''}
            >
              {t('next')}
              <ChevronRight className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
            </CmxButton>
          </div>
        </div>
      )}
    </div>
  );
}

