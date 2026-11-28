/**
 * Pre-Submission Pieces Manager Component
 * Manages pieces in local state before order submission
 * Manages pre-submission piece data for order items (pieces are always used)
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxInput, CmxTextarea, CmxCheckbox, Label } from '@ui/primitives';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useEditControlGroup } from '../order-change/use-edit-control-capability';
import { EditControlNotice } from '../order-change/edit-control-notice';
import { nextPieceId } from '../model/cart-line-key';

/**
 *
 */
export interface PreSubmissionPiece {
  id: string;
  itemId: string;
  pieceSeq: number;
  color?: string;
  colorCodes?: string[];
  colorCfIds?: (string | null)[];
  brand?: string;
  hasStain?: boolean;
  hasDamage?: boolean;
  notes?: string;
  rackLocation?: string;
  metadata?: Record<string, any>;
  /** Piece-level condition codes (preferences) */
  conditions?: string[];
}

interface PreSubmissionPiecesManagerProps {
  pieces: PreSubmissionPiece[];
  itemId: string;
  onPiecesChange: (pieces: PreSubmissionPiece[]) => void;
  readOnly?: boolean;
  selectedPieceId?: string | null;
  onSelectPiece?: (pieceId: string | null) => void;
}

/**
 *
 * @param root0
 * @param root0.pieces
 * @param root0.itemId
 * @param root0.onPiecesChange
 * @param root0.readOnly
 * @param root0.selectedPieceId
 * @param root0.onSelectPiece
 */
export function PreSubmissionPiecesManager({
  pieces,
  itemId,
  onPiecesChange,
  readOnly = false,
  selectedPieceId = null,
  onSelectPiece,
}: PreSubmissionPiecesManagerProps) {
  const t = useTranslations('newOrder.pieces');
  // Create has no Edit session and remains interactive; a policy cell cannot
  // enable a persisted-piece operation whose writer has not shipped.
  const brandCapability = useEditControlGroup(['CHANGE_PIECE_BRAND']);
  const rackCapability = useEditControlGroup(['CHANGE_PIECE_RACK']);
  const [expandedPieceIds, setExpandedPieceIds] = useState<Set<string>>(() => new Set());

  const handlePieceUpdate = (pieceId: string, updates: Partial<PreSubmissionPiece>) => {
    if (readOnly) return;
    if (('brand' in updates && !brandCapability.interactive) || ('rackLocation' in updates && !rackCapability.interactive)) return;
    
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
      id: nextPieceId(itemId, pieces, newPieceSeq),
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
      <div className="text-sm text-muted-foreground py-2 text-start">
        {t('noPieces')}
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-foreground text-start">
          {t('pieces')} ({pieces.length})
        </h4>
        {!readOnly && (
          <CmxButton
            variant="outline"
            size="sm"
            onClick={handleAddPiece}
            className="min-h-[44px]"
            aria-label={t('addPiece') || 'Add piece'}
          >
            <Plus className="w-4 h-4 me-1" aria-hidden />
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
              onSelectPiece ? 'cursor-pointer hover:bg-muted' : ''
            } ${isSelected ? 'ring-2 ring-warning bg-warning-bg/50 border-warning-border' : 'bg-muted border-border'}`}
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
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {piece.color && /^#[0-9A-Fa-f]{3,8}$/.test(piece.color) && (
                  <span className="w-3 h-3 rounded-full shrink-0 border border-border" style={{ backgroundColor: piece.color }} aria-hidden />
                )}
                <span className="text-sm font-medium text-foreground truncate">
                  {t('pieceNumber', { number: piece.pieceSeq })}
                  <span className="text-muted-foreground font-normal ms-1">({summaryText})</span>
                </span>
                {isSelected && (
                  <span className="text-xs text-warning-text font-medium ms-1 shrink-0">
                    — {t('selectedForPreferences') || 'Selected for preferences'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
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
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors"
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
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-danger-text hover:text-danger-text/80 hover:bg-danger-bg"
                    aria-label={t('removePiece') || 'Remove piece'}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden />
                  </CmxButton>
                )}
              </div>
            </div>

            {/* Expanded details */}
            {isExpanded && (
            <div className="grid grid-cols-2 gap-3 px-3 pb-3 pt-0 border-t border-border">
              {/* Color */}
              <div>
                <Label className="block text-xs mb-1">
                  {t('color')}
                </Label>
                {readOnly ? (
                  <div className="text-sm text-muted-foreground">
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
                <Label className="block text-xs mb-1">
                  {t('brand')}
                </Label>
                {readOnly ? (
                  <div className="text-sm text-muted-foreground">
                    {piece.brand || t('notSet')}
                  </div>
                ) : (
                  <CmxInput
                    value={piece.brand || ''}
                    disabled={!brandCapability.interactive}
                    onChange={(e) => handlePieceUpdate(piece.id, { brand: e.target.value })}
                    placeholder={t('brandPlaceholder')}
                    className="h-8 text-sm"
                  />
                )}
              </div>

              <EditControlNotice codes={['CHANGE_PIECE_BRAND']} />

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
                <Label className="block text-xs mb-1">
                  {t('notes')}
                </Label>
                {readOnly ? (
                  <div className="text-sm text-muted-foreground min-h-[32px]">
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
                <Label className="block text-xs mb-1">
                  {t('rackLocation')}
                </Label>
                {readOnly ? (
                  <div className="text-sm text-muted-foreground">
                    {piece.rackLocation || t('notSet')}
                  </div>
                ) : (
                  <CmxInput
                    value={piece.rackLocation || ''}
                    disabled={!rackCapability.interactive}
                    onChange={(e) => handlePieceUpdate(piece.id, { rackLocation: e.target.value })}
                    placeholder={t('rackLocationPlaceholder')}
                    className="h-8 text-sm"
                  />
                )}
                <EditControlNotice codes={['CHANGE_PIECE_RACK']} />
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

