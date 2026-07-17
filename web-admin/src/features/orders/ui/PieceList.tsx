/**
 * Piece List Component with Pagination
 * Displays a list of pieces for an order item with pagination support
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { IntakePieceCard } from './pieces/IntakePieceCard';
import { ProcessingPieceCard } from './pieces/ProcessingPieceCard';
import { SortingPieceCard } from './pieces/SortingPieceCard';
import { AssemblyPieceCard } from './pieces/AssemblyPieceCard';
import { QCPieceCard } from './pieces/QCPieceCard';
import { PiecePreferencesEditorDialog } from './piece-preferences-editor-dialog';
import { CmxButton } from '@ui/primitives';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { OrderItemPiece } from '@/types/order';

/**
 *
 */
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
  /** Preparation / bulk toolbar */
  bulkSelectMode?: boolean;
  selectedBulkIds?: Set<string>;
  onBulkSelectToggle?: (pieceId: string, selected: boolean) => void;
  orderId?: string;
  orderItemId?: string;
  branchId?: string | null;
  onPreferencesSaved?: () => void | Promise<void>;
  density?: 'comfortable' | 'compact';
  mode?: 'intake' | 'processing' | 'sorting' | 'assembly' | 'qc';
}

const DEFAULT_PAGE_SIZE = 20;

/**
 *
 * @param root0
 * @param root0.pieces
 * @param root0.onPieceUpdate
 * @param root0.readOnly
 * @param root0.showSplitCheckbox
 * @param root0.selectedForSplit
 * @param root0.onSplitToggle
 * @param root0.rejectColor
 * @param root0.emptyMessage
 * @param root0.pageSize
 * @param root0.enablePagination
 * @param root0.bulkSelectMode
 * @param root0.selectedBulkIds
 * @param root0.onBulkSelectToggle
 * @param root0.orderId
 * @param root0.orderItemId
 * @param root0.branchId
 * @param root0.onPreferencesSaved
 * @param root0.density
 * @param root0.mode
 */
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
  bulkSelectMode = false,
  selectedBulkIds = new Set(),
  onBulkSelectToggle,
  orderId,
  orderItemId,
  branchId,
  onPreferencesSaved,
  density = 'comfortable',
  mode = 'intake',
}: PieceListProps) {
  const t = useTranslations('orders.pieces');
  const isRTL = useRTL();
  const [currentPage, setCurrentPage] = React.useState(1);
  const [prefsPieceId, setPrefsPieceId] = React.useState<string | null>(null);

  const totalPages = Math.ceil(pieces.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedPieces = enablePagination && pieces.length > pageSize
    ? pieces.slice(startIndex, endIndex)
    : pieces;

  const prefsPiece = prefsPieceId
    ? pieces.find((p) => p.id === prefsPieceId) ?? null
    : null;
  const canEditPreferences = Boolean(orderId && orderItemId && !readOnly);

  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }

  if (pieces.length === 0) {
    return (
      <div className={`text-center py-6 text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
        <p className="text-sm">
          {emptyMessage || t('noPieces')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={density === 'compact' ? 'space-y-2' : 'space-y-3'}>
        {paginatedPieces.map((piece) => {
          if (mode === 'processing') {
            return (
              <ProcessingPieceCard
                key={piece.id}
                piece={piece}
                onUpdate={onPieceUpdate}
                isBulkSelected={selectedBulkIds.has(piece.id)}
                onBulkSelectToggle={onBulkSelectToggle}
                readOnly={readOnly}
              />
            );
          }
          if (mode === 'sorting') {
            return (
              <SortingPieceCard
                key={piece.id}
                piece={piece}
                readOnly={readOnly}
              />
            );
          }
          if (mode === 'assembly') {
            return (
              <AssemblyPieceCard
                key={piece.id}
                piece={piece}
                readOnly={readOnly}
              />
            );
          }
          if (mode === 'qc') {
            return (
              <QCPieceCard
                key={piece.id}
                piece={piece}
                readOnly={readOnly}
              />
            );
          }
          return (
            <IntakePieceCard
              key={piece.id}
              piece={piece}
              onUpdate={onPieceUpdate}
              onEditPreferences={
                canEditPreferences
                  ? (pieceId) => setPrefsPieceId(pieceId)
                  : undefined
              }
              readOnly={readOnly}
              showSplitCheckbox={showSplitCheckbox}
              isSelectedForSplit={selectedForSplit.has(piece.id)}
              onSplitToggle={onSplitToggle}
              rejectColor={rejectColor}
              density={density}
            />
          );
        })}
      </div>

      {prefsPiece && orderId && orderItemId && (
        <PiecePreferencesEditorDialog
          open={Boolean(prefsPiece)}
          onOpenChange={(open) => {
            if (!open) setPrefsPieceId(null);
          }}
          orderId={orderId}
          orderItemId={orderItemId}
          piece={prefsPiece}
          branchId={branchId}
          onSaved={async () => {
            await onPreferencesSaved?.();
            setPrefsPieceId(null);
          }}
        />
      )}

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

