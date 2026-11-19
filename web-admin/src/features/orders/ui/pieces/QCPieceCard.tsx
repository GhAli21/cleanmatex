'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { PieceBaseCard } from './PieceBaseCard';
import { CmxButton } from '@ui/primitives';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import type { OrderItemPiece } from '@/types/order';

/**
 *
 */
export interface QCPieceCardProps {
  piece: OrderItemPiece;
  onPass?: (pieceId: string) => void;
  onRewash?: (pieceId: string) => void;
  readOnly?: boolean;
}

/**
 *
 * @param root0
 * @param root0.piece
 * @param root0.onPass
 * @param root0.onRewash
 * @param root0.readOnly
 */
export function QCPieceCard({
  piece,
  onPass,
  onRewash,
  readOnly = false,
}: QCPieceCardProps) {
  const t = useTranslations('orders.pieces');

  // Extract damages and stains that the inspector needs to verify
  const qcConditions = (piece.conditions ?? []).filter(c => 
    c.toLowerCase().includes('damage') || c.toLowerCase().includes('stain')
  );

  const renderDetails = () => {
    return (
      <div className="flex flex-col gap-3 mt-2 items-start">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase text-start">
          {t('inspectionCriteria')}
        </h4>
        
        {qcConditions.length > 0 ? (
          <ul className="space-y-2 w-full text-start">
            {qcConditions.map(c => (
              <li key={c} className="flex items-start bg-muted p-2 rounded-md border border-border">
                <AlertCircle className="w-4 h-4 text-warning-text mt-0.5 shrink-0 me-2" />
                <span className="text-sm font-medium text-foreground">
                  {c.replace(/_/g, ' ')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            {t('noSpecialConditions')}
          </p>
        )}
      </div>
    );
  };

  const renderActions = () => {
    if (readOnly) return null;

    return (
      <div className="flex items-center gap-2 mt-4">
        <CmxButton
          variant="outline"
          className="flex-1 h-12 bg-danger-bg hover:bg-danger-border/50 text-danger-text border-danger-border"
          onClick={() => onRewash?.(piece.id)}
        >
          <XCircle className="w-5 h-5 me-2" />
          {t('rewash')}
        </CmxButton>
        
        <CmxButton
          variant="primary"
          className="flex-1 h-12 bg-success hover:bg-success/90 text-on-solid"
          onClick={() => onPass?.(piece.id)}
        >
          <CheckCircle className="w-5 h-5 me-2" />
          {t('pass')}
        </CmxButton>
      </div>
    );
  };

  return (
    <PieceBaseCard
      piece={piece}
      detailsSlot={renderDetails()}
      statusSlot={renderActions()} // We use the status slot for the full-width action buttons
    />
  );
}
