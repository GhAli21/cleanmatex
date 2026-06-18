'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { PieceBaseCard } from './PieceBaseCard';
import { CmxButton, CmxInput } from '@ui/primitives';
import { Printer, ScanBarcode } from 'lucide-react';
import type { OrderItemPiece } from '@/types/order';

/**
 *
 */
export interface SortingPieceCardProps {
  piece: OrderItemPiece;
  onBarcodeScan?: (pieceId: string, barcode: string) => void;
  onPrintTag?: (pieceId: string) => void;
  readOnly?: boolean;
}

/**
 *
 * @param root0
 * @param root0.piece
 * @param root0.onBarcodeScan
 * @param root0.onPrintTag
 * @param root0.readOnly
 */
export function SortingPieceCard({
  piece,
  onBarcodeScan,
  onPrintTag,
  readOnly = false,
}: SortingPieceCardProps) {
  const t = useTranslations('orders.pieces');
  const isRTL = useRTL();
  const [barcodeValue, setBarcodeValue] = React.useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcodeValue.trim()) {
      e.preventDefault();
      onBarcodeScan?.(piece.id, barcodeValue.trim());
      setBarcodeValue(''); // clear after scan
    }
  };

  const renderDetails = () => {
    return (
      <div className={`flex flex-col gap-3 mt-2 w-full ${isRTL ? 'items-end' : 'items-start'}`}>
        <div className={`flex items-center w-full gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          
          {/* Scanner Input field */}
          <div className="flex-1 relative">
            <ScanBarcode className={`absolute top-2.5 ${isRTL ? 'right-3' : 'left-3'} w-4 h-4 text-slate-400`} />
            <CmxInput
              value={barcodeValue}
              onChange={(e) => setBarcodeValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={readOnly}
              placeholder={t('scanToAssign')}
              className={`w-full h-10 bg-slate-50 border-slate-300 font-mono text-sm ${isRTL ? 'pr-9 text-right' : 'pl-9 text-left'}`}
            />
          </div>

          {/* Print Tag Button */}
          {!readOnly && onPrintTag && (
            <CmxButton 
              variant="outline"
              className="h-10 shrink-0"
              onClick={() => onPrintTag(piece.id)}
            >
              <Printer className="w-4 h-4 mr-2" />
              {t('printTag')}
            </CmxButton>
          )}

        </div>
      </div>
    );
  };

  const renderStatus = () => {
    const hasTag = Boolean(piece.piece_code);
    return (
      <div className={`flex items-center gap-2 mt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <span className="text-xs font-semibold text-slate-500 uppercase">
          {t('tagAssignment')}:
        </span>
        {hasTag ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {t('assigned')}
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            {t('pending')}
          </span>
        )}
      </div>
    );
  };

  return (
    <PieceBaseCard
      piece={piece}
      detailsSlot={renderDetails()}
      statusSlot={renderStatus()}
    />
  );
}
