/**
 * Pre-Submission Pieces Manager Component
 * Manages pieces in local state before order submission
 * Used when USE_TRACK_BY_PIECE is enabled
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/Button';
import { Plus, Trash2, GripVertical } from 'lucide-react';

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
}

export function PreSubmissionPiecesManager({
  pieces,
  itemId,
  onPiecesChange,
  readOnly = false,
}: PreSubmissionPiecesManagerProps) {
  const t = useTranslations('newOrder.pieces');
  const isRTL = useRTL();

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
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddPiece}
            className={isRTL ? 'flex-row-reverse' : ''}
          >
            <Plus className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
            {t('addPiece')}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {pieces.map((piece) => (
          <div
            key={piece.id}
            className="p-3 bg-gray-50 rounded-lg border border-gray-200"
          >
            <div className={`flex items-start justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <GripVertical className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">
                  {t('pieceNumber', { number: piece.pieceSeq })}
                </span>
              </div>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemovePiece(piece.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
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
                  <Input
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
                  <Input
                    value={piece.brand || ''}
                    onChange={(e) => handlePieceUpdate(piece.id, { brand: e.target.value })}
                    placeholder={t('brandPlaceholder')}
                    className="h-8 text-sm"
                  />
                )}
              </div>

              {/* Has Stain */}
              <div className="flex items-end pb-1">
                <Checkbox
                  checked={piece.hasStain || false}
                  onCheckedChange={(checked) =>
                    handlePieceUpdate(piece.id, { hasStain: checked as boolean })
                  }
                  label={t('hasStain')}
                  disabled={readOnly}
                />
              </div>

              {/* Has Damage */}
              <div className="flex items-end pb-1">
                <Checkbox
                  checked={piece.hasDamage || false}
                  onCheckedChange={(checked) =>
                    handlePieceUpdate(piece.id, { hasDamage: checked as boolean })
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
                  <Textarea
                    value={piece.notes || ''}
                    onChange={(e) => handlePieceUpdate(piece.id, { notes: e.target.value })}
                    placeholder={t('notesPlaceholder')}
                    className="h-8 resize-none text-sm"
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
                  <Input
                    value={piece.rackLocation || ''}
                    onChange={(e) => handlePieceUpdate(piece.id, { rackLocation: e.target.value })}
                    placeholder={t('rackLocationPlaceholder')}
                    className="h-8 text-sm"
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

