/**
 * Processing Piece Row Component
 *
 * Individual piece within an order item.
 * Shows controls for ready status, processing step, notes, rack location, and split selection.
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CmxCheckbox, CmxInput, CmxTextarea, CmxButton, CmxCard } from '@ui/primitives';
import { X, Package, AlertTriangle } from 'lucide-react';
import type { ItemPiece, ProcessingStep, ProcessingStepConfig } from '@/types/order';
import { CmxProcessingStepTimeline } from '@/src/ui/data-display/cmx-processing-step-timeline';
import { CmxStatusBadge } from '@/src/ui/feedback/cmx-status-badge';
import { cn } from '@/lib/utils';

interface ProcessingPieceRowProps {
  piece: ItemPiece;
  onChange: (updates: Partial<ItemPiece>) => void;
  onSplitToggle: (selected: boolean) => void;
  isSelectedForSplit: boolean;
  splitOrderEnabled: boolean;
  rejectEnabled: boolean;
  rejectColor: string;
  processingSteps?: ProcessingStepConfig[]; // Dynamic steps from service category
}

export const ProcessingPieceRow = React.memo(function ProcessingPieceRow({
  piece,
  onChange,
  onSplitToggle,
  isSelectedForSplit,
  splitOrderEnabled,
  rejectEnabled,
  rejectColor,
  processingSteps = [], // Default to empty array if not provided
}: ProcessingPieceRowProps) {
  const t = useTranslations('processing');

  // Get step codes from processingSteps config
  const stepCodes = React.useMemo(() => {
    return processingSteps
      .filter(step => step.is_active)
      .sort((a, b) => a.step_seq - b.step_seq)
      .map(step => step.step_code);
  }, [processingSteps]);

  // Step labels map
  const stepLabels = React.useMemo(() => {
    const labels: Record<string, string> = {};
    processingSteps.forEach(step => {
      labels[step.step_code] = step.step_name;
    });
    return labels;
  }, [processingSteps]);

  const handleStepChange = (value: string) => {
    onChange({ currentStep: value as ProcessingStep });
  };

  const handleSplitChange = (checked: boolean) => {
    onSplitToggle(checked);
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    console.log('[ProcessingPieceRow] Notes change:', { pieceId: piece.id, value });
    onChange({ notes: value });
  };

  const handleRackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ rackLocation: e.target.value });
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ color: e.target.value });
  };

  const handleBrandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ brand: e.target.value });
  };

  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ barcode: e.target.value });
  };

  const handleUnReject = () => {
    onChange({ isRejected: false });
  };

  const handleIsReadyChange = (checked: boolean) => {
    onChange({ is_ready: checked });
  };

  const handlePieceStageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ piece_stage: e.target.value });
  };

  // Determine completed steps
  const completedSteps = React.useMemo(() => {
    const steps = new Set<ProcessingStep>();
    if (!piece.currentStep || stepCodes.length === 0) return steps;

    const currentIndex = stepCodes.indexOf(piece.currentStep);
    if (currentIndex > 0) {
      for (let i = 0; i < currentIndex; i++) {
        steps.add(stepCodes[i]);
      }
    }
    return steps;
  }, [piece.currentStep, stepCodes]);

  return (
    <CmxCard
      className={cn(
        'p-3 sm:p-4 transition-all hover:shadow-md',
        piece.isRejected && 'border-l-4',
        piece.isRejected && rejectEnabled && 'bg-red-50/50'
      )}
      style={{
        borderLeftColor: piece.isRejected && rejectEnabled ? rejectColor : undefined,
      }}
      role="article"
      aria-label={`Piece ${piece.pieceNumber} details`}
    >
      {/* Piece Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-gray-400" />
            <span className="font-semibold text-base text-gray-900">
              {t('modal.piece')} {piece.pieceNumber}
            </span>
            {piece.piece_code && (
              <CmxStatusBadge
                label={piece.piece_code}
                variant="info"
                size="sm"
                className="font-mono"
              />
            )}
          </div>

          {/* Piece Details: Color, Brand, Barcode - Display only if set */}
          {(piece.color || piece.brand || piece.barcode) && (
            <div className="flex items-center gap-2 flex-wrap">
              {piece.color && (
                <CmxStatusBadge
                  label={`${t('modal.color') || 'Color'}: ${piece.color}`}
                  variant="outline"
                  size="sm"
                />
              )}
              {piece.brand && (
                <CmxStatusBadge
                  label={`${t('modal.brand') || 'Brand'}: ${piece.brand}`}
                  variant="outline"
                  size="sm"
                />
              )}
              {piece.barcode && (
                <CmxStatusBadge
                  label={`${t('modal.barcode') || 'Barcode'}: ${piece.barcode}`}
                  variant="outline"
                  size="sm"
                  className="font-mono"
                />
              )}
            </div>
          )}

          {/* Condition Flags: Stain, Damage */}
          {(piece.has_stain || piece.has_damage) && (
            <div className="flex items-center gap-2">
              {piece.has_stain && (
                <CmxStatusBadge
                  label={t('modal.hasStain') || 'Stain'}
                  variant="warning"
                  size="sm"
                  icon={AlertTriangle}
                  showIcon
                />
              )}
              {piece.has_damage && (
                <CmxStatusBadge
                  label={t('modal.hasDamage') || 'Damage'}
                  variant="error"
                  size="sm"
                  icon={AlertTriangle}
                  showIcon
                />
              )}
            </div>
          )}

          {/* Scan State */}
          {piece.scan_state && piece.scan_state !== 'expected' && (
            <CmxStatusBadge
              label={
                piece.scan_state === 'scanned'
                  ? t('modal.scanned') || 'Scanned'
                  : piece.scan_state === 'missing'
                    ? t('modal.missing') || 'Missing'
                    : t('modal.wrong') || 'Wrong'
              }
              variant={
                piece.scan_state === 'scanned'
                  ? 'success'
                  : piece.scan_state === 'missing'
                    ? 'warning'
                    : 'error'
              }
              size="sm"
            />
          )}

          {piece.isRejected && rejectEnabled && (
            <div className="flex items-center gap-2">
              <CmxStatusBadge
                label={t('modal.rejected')}
                variant="error"
                size="sm"
                className="font-medium"
                style={{
                  backgroundColor: rejectColor,
                  color: 'white',
                  borderColor: rejectColor,
                }}
              />
              <CmxButton
                variant="ghost"
                size="sm"
                onClick={handleUnReject}
                className="h-7 px-2 text-xs"
                aria-label={t('modal.unReject')}
              >
                <X className="h-3 w-3 mr-1" />
                {t('modal.unReject')}
              </CmxButton>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Step Timeline */}
      <div className="mb-4 pb-4 border-b">
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('modal.step')} / {t('modal.lastStep') || 'Last Step'}
          </label>
          <p className="text-xs text-gray-500 mb-3">
            {t('modal.clickStepToChange') || 'Click on a step to change the processing stage'}
          </p>
        </div>
        <CmxProcessingStepTimeline
          currentStep={piece.currentStep}
          completedSteps={completedSteps}
          processingSteps={processingSteps}
          onStepClick={handleStepChange}
          size="sm"
          showLabels={true}
          className="w-full"
        />
        {/* Display current step as text */}
        {piece.currentStep && (
          <div className="mt-2 text-sm text-gray-600">
            <span className="font-medium">{t('modal.currentStep') || 'Current Step'}:</span>{' '}
            <span className="capitalize">{piece.currentStep.replace('_', ' ')}</span>
          </div>
        )}
      </div>

      {/* Piece Details Section - Color, Brand, Barcode */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('modal.color') || 'Color'}
          </label>
          <CmxInput
            value={piece.color || ''}
            onChange={handleColorChange}
            placeholder={t('modal.color') || 'Color'}
            className="h-10 text-sm"
          />
        </div>

        {/* Brand */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('modal.brand') || 'Brand'}
          </label>
          <CmxInput
            value={piece.brand || ''}
            onChange={handleBrandChange}
            placeholder={t('modal.brand') || 'Brand'}
            className="h-10 text-sm"
          />
        </div>

        {/* Barcode */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('modal.barcode') || 'Barcode'}
          </label>
          <CmxInput
            value={piece.barcode || ''}
            onChange={handleBarcodeChange}
            placeholder={t('modal.barcode') || 'Barcode'}
            className="h-10 text-sm font-mono"
          />
        </div>
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Piece Status Display */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('modal.pieceStatus') || 'Status'}
          </label>
          <div className="h-10 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded flex items-center">
            <CmxStatusBadge
              label={piece.piece_status || 'processing'}
              variant={
                piece.piece_status === 'ready'
                  ? 'success'
                  : piece.piece_status === 'qa'
                    ? 'info'
                    : 'default'
              }
              size="sm"
              className="capitalize"
            />
          </div>
        </div>

        {/* Piece Stage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('modal.pieceStage') || 'Piece Stage'}
          </label>
          <CmxInput
            value={piece.piece_stage || ''}
            onChange={handlePieceStageChange}
            placeholder={t('modal.pieceStage') || 'Piece Stage'}
            className="h-10 text-sm"
          />
        </div>

        {/* Rack Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('modal.rackLocation')}
          </label>
          <CmxInput
            value={piece.rackLocation || ''}
            onChange={handleRackChange}
            placeholder={t('modal.rackLocation')}
            className="h-10 text-sm"
          />
        </div>

        {/* Notes */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('modal.notes')}
          </label>
          <CmxTextarea
            value={piece.notes || ''}
            onChange={handleNotesChange}
            placeholder={t('modal.notes')}
            className="h-10 resize-none text-sm min-h-[40px]"
            rows={2}
          />
        </div>
      </div>

      {/* Checkboxes Row */}
      <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t">
        <CmxCheckbox
          checked={piece.is_ready ?? false}
          onChange={(e) => handleIsReadyChange(e.target.checked)}
          label={t('modal.ready') || 'Ready'}
        />
        {splitOrderEnabled && (
          <CmxCheckbox
            checked={isSelectedForSplit}
            onChange={(e) => handleSplitChange(e.target.checked)}
            label={t('modal.split')}
          />
        )}
      </div>
    </CmxCard>
  );
});
