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
import { CmxInput } from '@ui/primitives/cmx-input';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { OrderItemPiece } from '@/types/order';
import {
  isHighlightedPiece,
  matchesPieceCodeFilter,
  PIECE_FILTER_MIN_PIECES,
} from '@features/orders/lib/piece-highlight';

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
  /** Piece id or piece code from `?piece=` (HFC T3.9): opens its page, scrolls to it and highlights it. */
  highlightPiece?: string | null;
  /** Show the filter by piece code or tag (HFC T3.9b) once the list has `PIECE_FILTER_MIN_PIECES` pieces. Default true. */
  enableCodeFilter?: boolean;
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
 * @param root0.highlightPiece
 * @param root0.enableCodeFilter
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
  highlightPiece = null,
  enableCodeFilter = true,
}: PieceListProps) {
  const t = useTranslations('orders.pieces');
  const tCodes = useTranslations('codes');
  const isRTL = useRTL();
  const [codeFilter, setCodeFilter] = React.useState('');
  const showCodeFilter = enableCodeFilter && pieces.length >= PIECE_FILTER_MIN_PIECES;
  const visiblePieces = React.useMemo(
    () => (showCodeFilter && codeFilter ? pieces.filter((p) => matchesPieceCodeFilter(p, codeFilter)) : pieces),
    [pieces, codeFilter, showCodeFilter]
  );
  const highlightIndex = highlightPiece
    ? visiblePieces.findIndex((p) => isHighlightedPiece(p, highlightPiece))
    : -1;
  // Start on the page that holds the highlighted piece (the list mounts after its pieces load).
  const [currentPage, setCurrentPage] = React.useState(() =>
    highlightIndex >= 0 && enablePagination ? Math.floor(highlightIndex / pageSize) + 1 : 1
  );
  const highlightRef = React.useRef<HTMLDivElement | null>(null);
  const highlightedId = highlightIndex >= 0 ? visiblePieces[highlightIndex].id : null;

  React.useEffect(() => {
    if (!highlightedId) return;
    const el = highlightRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedId]);
  const [prefsPieceId, setPrefsPieceId] = React.useState<string | null>(null);

  const totalPages = Math.ceil(visiblePieces.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedPieces = enablePagination && visiblePieces.length > pageSize
    ? visiblePieces.slice(startIndex, endIndex)
    : visiblePieces;

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
      {showCodeFilter ? (
        <div className="space-y-1">
          <CmxInput
            type="search"
            dir="ltr"
            value={codeFilter}
            onChange={(e) => {
              setCodeFilter(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={tCodes('filterPiecesPlaceholder')}
            aria-label={tCodes('filterPieces')}
            leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
          {codeFilter ? (
            <p className="text-xs text-gray-600" aria-live="polite">
              {tCodes('filterCount', { shown: visiblePieces.length, total: pieces.length })}
            </p>
          ) : null}
        </div>
      ) : null}
      {visiblePieces.length === 0 ? (
        <p className={`py-4 text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
          {tCodes('filterNoMatch')}
        </p>
      ) : null}
      <div className={density === 'compact' ? 'space-y-2' : 'space-y-3'}>
        {paginatedPieces.map((piece) => {
          const highlighted = piece.id === highlightedId;
          const card = (() => {
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
          })();
          return (
            <div
              key={piece.id}
              ref={highlighted ? highlightRef : undefined}
              data-piece-id={piece.id}
              data-piece-code={piece.piece_code || undefined}
              data-highlighted={highlighted ? 'true' : undefined}
              aria-current={highlighted ? 'true' : undefined}
              className={
                highlighted
                  ? 'rounded-lg ring-2 ring-[rgb(var(--cmx-primary-rgb,37_99_235))] ring-offset-2 scroll-mt-24'
                  : undefined
              }
            >
              {highlighted ? <span className="sr-only">{tCodes('openedFromScan')}</span> : null}
              {card}
            </div>
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
      {enablePagination && visiblePieces.length > pageSize && (
        <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-center justify-between pt-4 border-t`}>
          <div className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('showing', { 
              start: startIndex + 1, 
              end: Math.min(endIndex, visiblePieces.length), 
              total: visiblePieces.length 
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

