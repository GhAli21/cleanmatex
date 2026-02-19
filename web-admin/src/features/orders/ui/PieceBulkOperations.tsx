/**
 * Bulk Operations Component for Pieces
 * Allows selecting multiple pieces and performing bulk actions
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxButton, CmxCheckbox, CmxInput } from '@ui/primitives';
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms';
import { CheckSquare, XSquare, MapPin, FileDown } from 'lucide-react';
import type { OrderItemPiece } from '@/types/order';

export interface PieceBulkOperationsProps {
  pieces: OrderItemPiece[];
  selectedPieces: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  onBulkUpdate: (updates: Array<{ pieceId: string; updates: Partial<OrderItemPiece> }>) => Promise<void>;
  onBulkStatusChange?: (pieceIds: string[], status: string) => void;
  onBulkRackLocation?: (pieceIds: string[], location: string) => void;
  onExport?: (pieceIds: string[]) => void;
}

export function PieceBulkOperations({
  pieces,
  selectedPieces,
  onSelectionChange,
  onBulkUpdate,
  onBulkStatusChange,
  onBulkRackLocation,
  onExport,
}: PieceBulkOperationsProps) {
  const t = useTranslations('orders.pieces');
  const isRTL = useRTL();
  const [bulkStatus, setBulkStatus] = React.useState<string>('');
  const [bulkRackLocation, setBulkRackLocation] = React.useState('');
  const [applying, setApplying] = React.useState(false);

  const handleSelectAll = () => {
    if (selectedPieces.size === pieces.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(pieces.map(p => p.id)));
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedPieces.size === 0) return;

    setApplying(true);
    try {
      const updates = Array.from(selectedPieces).map(pieceId => ({
        pieceId,
        updates: {
          piece_status: bulkStatus as any,
        },
      }));

      await onBulkUpdate(updates);
      onBulkStatusChange?.(Array.from(selectedPieces), bulkStatus);
      setBulkStatus('');
    } catch (error) {
      console.error('Bulk status update failed:', error);
    } finally {
      setApplying(false);
    }
  };

  const handleBulkRackLocationUpdate = async () => {
    if (!bulkRackLocation.trim() || selectedPieces.size === 0) return;

    setApplying(true);
    try {
      const updates = Array.from(selectedPieces).map(pieceId => ({
        pieceId,
        updates: {
          rack_location: bulkRackLocation.trim(),
        },
      }));

      await onBulkUpdate(updates);
      onBulkRackLocation?.(Array.from(selectedPieces), bulkRackLocation.trim());
      setBulkRackLocation('');
    } catch (error) {
      console.error('Bulk rack location update failed:', error);
    } finally {
      setApplying(false);
    }
  };

  const handleExport = () => {
    if (onExport && selectedPieces.size > 0) {
      onExport(Array.from(selectedPieces));
    }
  };

  if (selectedPieces.size === 0) {
    return (
      <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-center gap-2 p-3 bg-gray-50 rounded-lg`}>
        <CmxCheckbox
          checked={false}
          onChange={() => handleSelectAll()}
          label={t('selectAll') || 'Select All'}
        />
      </div>
    );
  }

  return (
    <div className={`space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-center justify-between`}>
        <span className="text-sm font-semibold text-blue-900">
          {t('selectedCount', { count: selectedPieces.size }) || `${selectedPieces.size} pieces selected`}
        </span>
        <CmxButton
          variant="ghost"
          size="sm"
          onClick={() => onSelectionChange(new Set())}
          className={isRTL ? 'flex-row-reverse' : ''}
        >
          <XSquare className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
          {t('clearSelection') || 'Clear'}
        </CmxButton>
      </div>

      <div className={`grid grid-cols-12 gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {/* Bulk Status */}
        <div className="col-span-4">
          <CmxSelectDropdown value={bulkStatus} onValueChange={setBulkStatus}>
            <CmxSelectDropdownTrigger className="h-9">
              <CmxSelectDropdownValue
                placeholder={t('bulkStatus') || 'Bulk Status'}
                displayValue={
                  bulkStatus ? t(`status.${bulkStatus}`) || bulkStatus : undefined
                }
              />
            </CmxSelectDropdownTrigger>
            <CmxSelectDropdownContent>
              <CmxSelectDropdownItem value="intake">{t('status.intake')}</CmxSelectDropdownItem>
              <CmxSelectDropdownItem value="processing">{t('status.processing')}</CmxSelectDropdownItem>
              <CmxSelectDropdownItem value="qa">{t('status.qa')}</CmxSelectDropdownItem>
              <CmxSelectDropdownItem value="ready">{t('status.ready')}</CmxSelectDropdownItem>
            </CmxSelectDropdownContent>
          </CmxSelectDropdown>
        </div>

        <div className="col-span-2">
          <CmxButton
            onClick={handleBulkStatusUpdate}
            disabled={!bulkStatus || applying}
            size="sm"
            className="w-full"
          >
            {t('apply') || 'Apply'}
          </CmxButton>
        </div>

        {/* Bulk Rack Location */}
        <div className="col-span-4">
          <CmxInput
            value={bulkRackLocation}
            onChange={(e) => setBulkRackLocation(e.target.value)}
            placeholder={t('bulkRackLocation') || 'Bulk Rack Location'}
            className="h-9"
          />
        </div>

        <div className="col-span-2">
          <CmxButton
            onClick={handleBulkRackLocationUpdate}
            disabled={!bulkRackLocation.trim() || applying}
            size="sm"
            variant="outline"
            className="w-full"
          >
            <MapPin className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
            {t('apply')}
          </CmxButton>
        </div>
      </div>

      {/* Export */}
      {onExport && (
        <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} justify-end`}>
          <CmxButton
            onClick={handleExport}
            variant="outline"
            size="sm"
            className={isRTL ? 'flex-row-reverse' : ''}
          >
            <FileDown className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
            {t('exportSelected') || 'Export Selected'}
          </CmxButton>
        </div>
      )}
    </div>
  );
}

