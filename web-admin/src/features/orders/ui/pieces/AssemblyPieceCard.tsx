'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { PieceBaseCard } from './PieceBaseCard';
import { CmxInput } from '@ui/primitives';
import { Package, ScanBarcode } from 'lucide-react';
import type { OrderItemPiece } from '@/types/order';

/**
 *
 */
export interface AssemblyPieceCardProps {
  piece: OrderItemPiece;
  onAssembleScan?: (pieceId: string, barcode: string) => void;
  isAssembled?: boolean;
  totalPiecesInItem?: number;
  readOnly?: boolean;
}

/**
 *
 * @param root0
 * @param root0.piece
 * @param root0.onAssembleScan
 * @param root0.isAssembled
 * @param root0.readOnly
 */
export function AssemblyPieceCard({
  piece,
  onAssembleScan,
  isAssembled = false,
  readOnly = false,
}: AssemblyPieceCardProps) {
  const t = useTranslations('orders.pieces');
  const [barcodeValue, setBarcodeValue] = React.useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcodeValue.trim()) {
      e.preventDefault();
      onAssembleScan?.(piece.id, barcodeValue.trim());
      setBarcodeValue(''); // clear after scan
    }
  };

  const renderDetails = () => {
    return (
      <div className="flex flex-col gap-3 mt-2 items-start">
        {/* Packing Instructions Prominent */}
        {piece.packing_pref_code && (
          <div className="bg-muted border border-border rounded-lg p-3 w-full">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 text-start">
              {t('packingInstructions')}
            </h4>
            <span className="inline-flex items-center text-sm font-bold text-foreground">
              <Package className="w-4 h-4 me-2 text-muted-foreground" />
              {piece.packing_pref_code.replace(/_/g, ' ')}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderStatus = () => {
    return (
      <div className="flex flex-col gap-2 mt-2 items-start">
        {!isAssembled && !readOnly ? (
          <div className="w-full relative mt-2">
            <ScanBarcode className="absolute top-2.5 start-3 w-4 h-4 text-muted-foreground" />
            <CmxInput
              value={barcodeValue}
              onChange={(e) => setBarcodeValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('scanToMarkAssembled')}
              className="w-full h-10 border-info-border bg-info-bg focus:ring-ring font-mono text-sm ps-9 text-start"
            />
          </div>
        ) : (
          <div className="w-full bg-success-bg border border-success-border rounded-md p-2 mt-2">
            <p className="text-sm font-semibold text-success-text text-center">
              {t('assembled')}
            </p>
          </div>
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
