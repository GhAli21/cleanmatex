/**
 * Pre-Submission Pieces Manager Component
 * Manages pieces in local state before order submission
 * Manages pre-submission piece data for order items (pieces are always used)
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxButton, CmxInput, CmxTextarea, CmxCheckbox } from '@ui/primitives';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

export interface PreSubmissionPiece {
  id: string;
  itemId: string;
  pieceSeq: number;
  color?: string;
  brand?: string;
  hasStain?: boolean;
  hasDamage?: boolean;
  notes?: string;
  rackLocation?: string;
  metadata?: Record<string, any>;
}

interface PreSubmissionPiecesManagerProps {
  pieces: PreSubmissionPiece[];
  itemId: string;
  onPiecesChange: (pieces: PreSubmissionPiece[]) => void;
  readOnly?: boolean;
  selectedPieceId?: string | null;
  onSelectPiece?: (pieceId: string | null) => void;
}

export function PreSubmissionPiecesManager({
  pieces,
  itemId,
  onPiecesChange,
  readOnly = false,
  selectedPieceId = null,
  onSelectPiece,
}: PreSubmissionPiecesManagerProps) {
  const t = useTranslations('newOrder.pieces');
  const isRTL = useRTL();
  const [expandedPieceIds, setExpandedPieceIds] = useState<Set<string>>(() => new Set());

  const handlePieceUpdate = (pieceId: string, updates: Partial<PreSubmissionPiece>) => {
    if (readOnly) return;
    
    const updatedPieces = pieces.map(piece =>
      piece.id === pieceId ? { ...piece, ...updates } : piece
    );
    onPiecesChange(updatedPieces);
  };

  const handleAddPiece = () => {
    if (readOnly) return;
    
    const newPieceSeq = pieces.length > 0 
      ? Math.max(...pieces.map(p => p.pieceSeq)) + 1 
      : 1;
    
    const newPiece: PreSubmissionPiece = {
      id: `temp-${itemId}-${newPieceSeq}`,
      itemId,
      pieceSeq: newPieceSeq,
    };
    
    onPiecesChange([...pieces, newPiece]);
  };

  const handleRemovePiece = (pieceId: string) => {
    if (readOnly) return;
    
    const updatedPieces = pieces.filter(p => p.id !== pieceId);
    // Re-sequence pieces
    const resequencedPieces = updatedPieces.map((piece, index) => ({
      ...piece,
      pieceSeq: index + 1,
    }));
    onPiecesChange(resequencedPieces);
  };

  if (pieces.length === 0 && readOnly) {
    return (
      <div className={`text-sm text-gray-500 py-2 ${isRTL ? 'text-right' : 'text-left'}`}>
        {t('noPieces')}
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-gray-200">
      <div className={`flex items-center justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h4 className={`text-sm font-semibold text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('pieces')} ({pieces.length})
        </h4>
        {!readOnly && (
          <CmxButton
            variant="outline"
            size="sm"
            onClick={handleAddPiece}
            className={`min-h-[44px] ${isRTL ? 'flex-row-reverse' : ''}`}
            aria-label={t('addPiece') || 'Add piece'}
          >
            <Plus className={`w-4 h-4 ${isRTL ? 'ms-1' : 'me-1'}`} aria-hidden />
            {t('addPiece')}
          </CmxButton>
        )}
      </div>

      <div className="space-y-2" role="list" aria-label={t('pieces') || 'Pieces'}>
        {pieces.map((piece, index) => {
          const isSelected = selectedPieceId === piece.id;
          const isExpanded = expandedPieceIds.has(piece.id);
          const summaryText = [piece.color || piece.brand].filter(Boolean).join(' / ') || '—';
          return (
          <div
            key={piece.id}
            role="listitem"
            data-piece-index={index}
            className={`rounded-lg border transition-colors ${
              onSelectPiece ? 'cursor-pointer hover:bg-gray-100' : ''
            } ${isSelected ? 'ring-2 ring-orange-500 bg-orange-50/50 border-orange-300' : 'bg-gray-50 border-gray-200'}`}
            onClick={onSelectPiece ? () => onSelectPiece(piece.id) : undefined}
            tabIndex={onSelectPiece ? 0 : undefined}
            aria-label={onSelectPiece && isSelected ? `${t('pieceNumber', { number: piece.pieceSeq })} — ${t('selectedForPreferences') || 'Selected for preferences'}` : undefined}
            onKeyDown={(e) => {
              if (!onSelectPiece) return;
              if (e.key === 'ArrowDown' && index < pieces.length - 1) {
                e.preventDefault();
                (document.querySelector(`[data-piece-index="${index + 1}"]`) as HTMLElement)?.focus();
              } else if (e.key === 'ArrowUp' && index > 0) {
                e.preventDefault();
                (document.querySelector(`[data-piece-index="${index - 1}"]`) as HTMLElement)?.focus();
              } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                if (!readOnly) handleRemovePiece(piece.id);
              }
            }}
          >
            {/* Collapsed summary row */}
            <div className={`flex items-center justify-between p-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-2 min-w-0 flex-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                {piece.color && /^#[0-9A-Fa-f]{3,8}$/.test(piece.color) && (
                  <span className="w-3 h-3 rounded-full shrink-0 border border-gray-300" style={{ backgroundColor: piece.color }} aria-hidden />
                )}
                <span className="text-sm font-medium text-gray-700 truncate">
                  {t('pieceNumber', { number: piece.pieceSeq })}
                  <span className="text-gray-500 font-normal ms-1">({summaryText})</span>
                </span>
                {isSelected && (
                  <span className="text-xs text-orange-600 font-medium ms-1 shrink-0">
                    — {t('selectedForPreferences') || 'Selected for preferences'}
                  </span>
                )}
              </div>
              <div className={`flex items-center gap-1 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedPieceIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(piece.id)) next.delete(piece.id);
                      else next.add(piece.id);
                      return next;
                    });
                  }}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 rounded transition-colors"
                  aria-label={isExpanded ? (t('hidePieces') || 'Collapse') : (t('viewPieces') || 'Expand')}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {!readOnly && (
                  <CmxButton
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleRemovePiece(piece.id); }}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-red-600 hover:text-red-700 hover:bg-red-50"
                    aria-label={t('removePiece') || 'Remove piece'}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden />
                  </CmxButton>
                )}
              </div>
            </div>

            {/* Expanded details */}
            {isExpanded && (
            <div className="grid grid-cols-2 gap-3 px-3 pb-3 pt-0 border-t border-gray-100">
              {/* Color */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('color')}
                </label>
                {readOnly ? (
                  <div className="text-sm text-gray-600">
                    {piece.color || t('notSet')}
                  </div>
                ) : (
                  <CmxInput
                    value={piece.color || ''}
                    onChange={(e) => handlePieceUpdate(piece.id, { color: e.target.value })}
                    placeholder={t('colorPlaceholder')}
                    className="h-8 text-sm"
                  />
                )}
              </div>

              {/* Brand */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('brand')}
                </label>
                {readOnly ? (
                  <div className="text-sm text-gray-600">
                    {piece.brand || t('notSet')}
                  </div>
                ) : (
                  <CmxInput
                    value={piece.brand || ''}
                    onChange={(e) => handlePieceUpdate(piece.id, { brand: e.target.value })}
                    placeholder={t('brandPlaceholder')}
                    className="h-8 text-sm"
                  />
                )}
              </div>

              {/* Has Stain */}
              <div className="flex items-end pb-1">
                <CmxCheckbox
                  checked={piece.hasStain || false}
                  onChange={(e) =>
                    handlePieceUpdate(piece.id, { hasStain: e.target.checked })
                  }
                  label={t('hasStain')}
                  disabled={readOnly}
                />
              </div>

              {/* Has Damage */}
              <div className="flex items-end pb-1">
                <CmxCheckbox
                  checked={piece.hasDamage || false}
                  onChange={(e) =>
                    handlePieceUpdate(piece.id, { hasDamage: e.target.checked })
                  }
                  label={t('hasDamage')}
                  disabled={readOnly}
                />
              </div>

              {/* Notes */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('notes')}
                </label>
                {readOnly ? (
                  <div className="text-sm text-gray-600 min-h-[32px]">
                    {piece.notes || t('noNotes')}
                  </div>
                ) : (
                  <CmxTextarea
                    value={piece.notes || ''}
                    onChange={(e) => handlePieceUpdate(piece.id, { notes: e.target.value })}
                    placeholder={t('notesPlaceholder')}
                    className="h-8 resize-none text-sm min-h-[32px]"
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
                    {piece.rackLocation || t('notSet')}
                  </div>
                ) : (
                  <CmxInput
                    value={piece.rackLocation || ''}
                    onChange={(e) => handlePieceUpdate(piece.id, { rackLocation: e.target.value })}
                    placeholder={t('rackLocationPlaceholder')}
                    className="h-8 text-sm"
                  />
                )}
              </div>
            </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}

