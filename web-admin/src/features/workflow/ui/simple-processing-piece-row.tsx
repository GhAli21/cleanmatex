/**
 * Lightweight piece row for Simple Processing dialog.
 * Ready (disabled when rejected), optional rack when ready, Split, Notes, Un-reject.
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxCheckbox, CmxInput, Tooltip } from '@ui/primitives';
import { CmxStatusBadge } from '@ui/feedback';
import { X } from 'lucide-react';
import type { ItemPiece } from '@/types/order';
import { cn } from '@/lib/utils';

export interface SimpleProcessingPieceRowProps {
  piece: ItemPiece;
  itemLabel: string;
  splitOrderEnabled: boolean;
  isSelectedForSplit: boolean;
  onChange: (updates: Partial<ItemPiece>) => void;
  onSplitToggle: (selected: boolean) => void;
}

/**
 * One piece row in the Simple Processing table.
 */
export const SimpleProcessingPieceRow = React.memo(function SimpleProcessingPieceRow({
  piece,
  itemLabel,
  splitOrderEnabled,
  isSelectedForSplit,
  onChange,
  onSplitToggle,
}: SimpleProcessingPieceRowProps) {
  const t = useTranslations('processing.simpleModal');
  const tModal = useTranslations('processing.modal');

  const isRejected = Boolean(piece.isRejected);
  const isReady = piece.is_ready === true;
  const displayName = `${itemLabel} #${piece.pieceNumber}`;

  const readyCheckbox = (
    <CmxCheckbox
      checked={isReady}
      disabled={isRejected}
      onChange={(e) => {
        if (isRejected) return;
        const checked = e.target.checked;
        onChange({ is_ready: checked, isReady: checked });
      }}
      aria-label={t('columns.ready')}
    />
  );

  return (
    <div
      className={cn(
        'grid gap-3 border-b border-border py-3 last:border-b-0',
        splitOrderEnabled
          ? 'grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto_auto]'
          : 'grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto]',
        isRejected && 'bg-destructive/5'
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{displayName}</span>
          {isRejected && (
            <CmxStatusBadge label={tModal('rejected')} variant="error" size="sm" />
          )}
          {isRejected && (
            <CmxButton
              type="button"
              variant="ghost"
              size="xs"
              className="h-7 px-2 text-xs"
              onClick={() => onChange({ isRejected: false })}
              aria-label={tModal('unReject')}
            >
              <X className="me-1 h-3 w-3" />
              {tModal('unReject')}
            </CmxButton>
          )}
        </div>
        {isReady && !isRejected && (
          <div className="max-w-xs">
            <CmxInput
              value={piece.rackLocation || ''}
              onChange={(e) => onChange({ rackLocation: e.target.value })}
              placeholder={t('rackOptionalPlaceholder')}
              aria-label={t('rackOptional')}
              className="h-8 text-xs"
            />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <CmxInput
          value={piece.notes || ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder={t('notesPlaceholder')}
          aria-label={t('columns.notes')}
          className="h-8 text-sm"
        />
      </div>

      <div className="flex items-center justify-center gap-2 sm:justify-center">
        <span className="text-xs text-muted-foreground sm:hidden">{t('columns.ready')}</span>
        {isRejected ? (
          <Tooltip content={t('readyDisabledRejected')}>
            <span className="inline-flex">{readyCheckbox}</span>
          </Tooltip>
        ) : (
          readyCheckbox
        )}
      </div>

      {splitOrderEnabled && (
        <div className="flex items-center justify-center gap-2 sm:justify-center">
          <span className="text-xs text-muted-foreground sm:hidden">{t('columns.split')}</span>
          <CmxCheckbox
            checked={isSelectedForSplit}
            onChange={(e) => onSplitToggle(e.target.checked)}
            aria-label={t('columns.split')}
          />
        </div>
      )}
    </div>
  );
});
