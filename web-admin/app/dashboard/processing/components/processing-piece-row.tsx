/**
 * Processing Piece Row Component
 *
 * Individual piece within an order item.
 * Shows controls for ready status, processing step, notes, rack location, and split selection.
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select-dropdown';
import { Button } from '@/components/ui/Button';
import { X } from 'lucide-react';
import type { ItemPiece, ProcessingStep } from '@/types/order';

interface ProcessingPieceRowProps {
  piece: ItemPiece;
  onChange: (updates: Partial<ItemPiece>) => void;
  onSplitToggle: (selected: boolean) => void;
  isSelectedForSplit: boolean;
  splitOrderEnabled: boolean;
  rejectEnabled: boolean;
  rejectColor: string;
}

const PROCESSING_STEPS: ProcessingStep[] = [
  'sorting',
  'pretreatment',
  'washing',
  'drying',
  'finishing',
];

export function ProcessingPieceRow({
  piece,
  onChange,
  onSplitToggle,
  isSelectedForSplit,
  splitOrderEnabled,
  rejectEnabled,
  rejectColor,
}: ProcessingPieceRowProps) {
  const t = useTranslations('processing');

  const handleStepChange = (value: string) => {
    onChange({ currentStep: value as ProcessingStep });
  };

  const handleReadyChange = (checked: boolean) => {
    onChange({ isReady: checked });
  };

  const handleSplitChange = (checked: boolean) => {
    onSplitToggle(checked);
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ notes: e.target.value });
  };

  const handleRackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ rackLocation: e.target.value });
  };

  const handleUnReject = () => {
    onChange({ isRejected: false });
  };

  return (
    <div
      className="p-3 rounded border"
      style={{
        backgroundColor: piece.isRejected ? `${rejectColor}20` : 'transparent',
        borderLeftWidth: piece.isRejected ? '4px' : '1px',
        borderLeftColor: piece.isRejected ? rejectColor : undefined,
      }}
    >
      {/* Piece Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="font-medium text-sm text-gray-700">
          {t('modal.piece')} {piece.pieceNumber}
        </span>

        {piece.isRejected && rejectEnabled && (
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: rejectColor,
                color: 'white',
              }}
            >
              {t('modal.rejected')}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnReject}
              className="h-6 px-2 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              {t('modal.unReject')}
            </Button>
          </div>
        )}
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-12 gap-3 items-start">
        {/* Processing Step Dropdown */}
        <div className="col-span-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {t('modal.step')}
          </label>
          <Select
            value={piece.currentStep || ''}
            onValueChange={handleStepChange}
          >
            <SelectTrigger className="h-9">
              <SelectValue 
                placeholder={t('modal.step')}
                displayValue={piece.currentStep ? t(`steps.${piece.currentStep}`) : undefined}
              />
            </SelectTrigger>
            <SelectContent>
              {PROCESSING_STEPS.map(step => (
                <SelectItem key={step} value={step}>
                  {t(`steps.${step}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ready Checkbox */}
        <div className="col-span-2 flex items-end pb-1">
          <Checkbox
            checked={piece.isReady}
            onCheckedChange={handleReadyChange}
            label={t('modal.ready')}
          />
        </div>

        {/* Split Checkbox - Conditional */}
        {splitOrderEnabled && (
          <div className="col-span-2 flex items-end pb-1">
            <Checkbox
              checked={isSelectedForSplit}
              onCheckedChange={handleSplitChange}
              label={t('modal.split')}
            />
          </div>
        )}

        {/* Notes */}
        <div className={splitOrderEnabled ? 'col-span-3' : 'col-span-5'}>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {t('modal.notes')}
          </label>
          <Textarea
            value={piece.notes || ''}
            onChange={handleNotesChange}
            placeholder={t('modal.notes')}
            className="h-9 resize-none text-sm"
            rows={1}
          />
        </div>

        {/* Rack Location */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {t('modal.rackLocation')}
          </label>
          <Input
            value={piece.rackLocation || ''}
            onChange={handleRackChange}
            placeholder={t('modal.rackLocation')}
            className="h-9 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
