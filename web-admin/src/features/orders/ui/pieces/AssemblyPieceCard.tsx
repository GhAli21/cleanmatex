'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { PieceBaseCard } from './PieceBaseCard';
import { CmxInput } from '@ui/primitives';
import { Package, ScanBarcode } from 'lucide-react';
import type { OrderItemPiece } from '@/types/order';

export interface AssemblyPieceCardProps {
  piece: OrderItemPiece;
  onAssembleScan?: (pieceId: string, barcode: string) => void;
  isAssembled?: boolean;
  totalPiecesInItem?: number;
  readOnly?: boolean;
}

export function AssemblyPieceCard({
  piece,
  onAssembleScan,
  isAssembled = false,
  readOnly = false,
}: AssemblyPieceCardProps) {
  const t = useTranslations('orders.pieces');
  const isRTL = useRTL();
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
      <div className={`flex flex-col gap-3 mt-2 ${isRTL ? 'items-end' : 'items-start'}`}>
        {/* Packing Instructions Prominent */}
        {piece.packing_pref_code && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 w-full">
            <h4 className={`text-xs font-semibold text-slate-500 uppercase mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('packingInstructions')}
            </h4>
            <span className="inline-flex items-center text-sm font-bold text-slate-800">
              <Package className="w-4 h-4 mr-2 text-slate-500" />
              {piece.packing_pref_code.replace(/_/g, ' ')}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderStatus = () => {
    return (
      <div className={`flex flex-col gap-2 mt-2 ${isRTL ? 'items-end' : 'items-start'}`}>
        {!isAssembled && !readOnly ? (
          <div className="w-full relative mt-2">
            <ScanBarcode className={`absolute top-2.5 ${isRTL ? 'right-3' : 'left-3'} w-4 h-4 text-slate-400`} />
            <CmxInput
              value={barcodeValue}
              onChange={(e) => setBarcodeValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('scanToMarkAssembled')}
              className={`w-full h-10 border-blue-200 bg-blue-50 focus:ring-blue-500 font-mono text-sm ${isRTL ? 'pr-9 text-right' : 'pl-9 text-left'}`}
            />
          </div>
        ) : (
          <div className="w-full bg-green-50 border border-green-200 rounded-md p-2 mt-2">
            <p className="text-sm font-semibold text-green-700 text-center">
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
