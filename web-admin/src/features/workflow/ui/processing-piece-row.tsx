/**
 * Processing Piece Row Component
 * Compact piece card inside ProcessingModal: step timeline, 4-column input grid,
 * service category/speed/timestamp metadata, notes, Ready, Split, and Confirm Prefs.
 */

'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Package, Tag, X } from 'lucide-react';
import {
  CmxButton,
  CmxCard,
  CmxCheckbox,
  CmxInput,
  CmxTextarea,
  Label,
} from '@ui/primitives';
import { CmxProcessingStepTimeline } from '@/src/ui/data-display/cmx-processing-step-timeline';
import { CmxStatusBadge } from '@/src/ui/feedback/cmx-status-badge';
import { ORDER_ISSUE_SCOPE } from '@/lib/constants/order-issues';
import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { readableTextOn } from '@/lib/theme/brand-palette';
import { useBilingual } from '@/lib/utils/bilingual';
import { cn } from '@/lib/utils';
import { OrderIssueRowActions } from '@features/orders/ui/issues/order-issue-row-actions';
import { PiecePreferenceReadonlyChips } from '@/src/features/orders/ui/piece-preferences/piece-preference-readonly-chips';
import type { ItemPiece, ProcessingStep, ProcessingStepConfig } from '@/types/order';

interface ProcessingPieceRowProps {
  piece: ItemPiece;
  onChange: (updates: Partial<ItemPiece>) => void;
  onSplitToggle: (selected: boolean) => void;
  isSelectedForSplit: boolean;
  splitOrderEnabled: boolean;
  rejectEnabled: boolean;
  rejectColor: string;
  processingSteps?: ProcessingStepConfig[];
  itemDefaultPacking?: string | null;
  colorHexByCode?: Map<string, string | null> | null;
  nameByCode?: Map<string, string> | null;
  categoryLabel?: string | null;
  processingConfirmationEnabled?: boolean;
  orderId?: string;
  itemId?: string;
  tenantId?: string;
  onConfirmSuccess?: () => void;
  issueOpenCount?: number;
  issueTotalCount?: number;
}

const KNOWN_PIECE_STATUS_KEYS = new Set([
  'processing',
  'sorting',
  'pretreatment',
  'washing',
  'drying',
  'finishing',
  'qc',
  'qa',
  'assembly',
]);

function formatShortDate(value: string | Date | null | undefined, locale: string): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

/**
 * Compact piece editor card used inside `ProcessingItemRow`.
 */
export const ProcessingPieceRow = React.memo(function ProcessingPieceRow(
  props: ProcessingPieceRowProps
) {
  const {
    piece,
    onChange,
    onSplitToggle,
    isSelectedForSplit,
    splitOrderEnabled,
    rejectEnabled,
    rejectColor,
    processingSteps = [],
    itemDefaultPacking,
    colorHexByCode = null,
    nameByCode = null,
    categoryLabel = null,
    processingConfirmationEnabled = false,
    orderId,
    itemId,
    tenantId,
    onConfirmSuccess,
    issueOpenCount,
    issueTotalCount,
  } = props;

  const t = useTranslations('processing');
  const tStatus = useTranslations('processing.status');
  const tTable = useTranslations('processing.table');
  const locale = useLocale();
  const getBilingual = useBilingual();
  const queryClient = useQueryClient();

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!orderId || !itemId || !piece.id || !tenantId) return;
      const res = await fetch(
        `/api/v1/orders/${orderId}/items/${itemId}/pieces/${piece.id}/service-prefs/confirm`,
        { method: 'POST', headers: { ...getCSRFHeader() } }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to confirm');
      }
    },
    onSuccess: () => {
      onConfirmSuccess?.();
      if (orderId) {
        queryClient.invalidateQueries({ queryKey: ['order-pieces', orderId] });
      }
    },
  });

  const hasServicePrefs = (piece.servicePrefs?.length ?? 0) > 0;
  const showConfirmButton =
    processingConfirmationEnabled && hasServicePrefs && orderId && itemId && tenantId;

  const localizedSteps = React.useMemo(() => {
    return processingSteps
      .filter((step) => step.is_active)
      .slice()
      .sort((a, b) => a.step_seq - b.step_seq)
      .map((step) => ({
        ...step,
        step_name: getBilingual(step.step_name, step.step_name2) || step.step_name,
      }));
  }, [getBilingual, processingSteps]);

  const stepCodes = React.useMemo(
    () => localizedSteps.map((step) => step.step_code),
    [localizedSteps]
  );

  const currentStepLabel = React.useMemo(() => {
    if (!piece.currentStep) return null;
    const match = localizedSteps.find((s) => s.step_code === piece.currentStep);
    if (match) return match.step_name;
    const lower = piece.currentStep.toLowerCase();
    if (KNOWN_PIECE_STATUS_KEYS.has(lower)) return tStatus(lower);
    return piece.currentStep.replace(/[_-]+/g, ' ');
  }, [localizedSteps, piece.currentStep, tStatus]);

  const pieceStatusLabel = React.useMemo(() => {
    const raw = (piece.piece_status || 'processing').toLowerCase();
    if (raw === 'ready') return t('modal.ready');
    if (KNOWN_PIECE_STATUS_KEYS.has(raw)) return tStatus(raw);
    return raw.replace(/[_-]+/g, ' ');
  }, [piece.piece_status, t, tStatus]);

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

  const hasPrefTags =
    (piece.colorPrefs?.length ?? 0) > 0 ||
    Boolean(piece.packingPrefCode) ||
    (piece.servicePrefs?.length ?? 0) > 0 ||
    Boolean(piece.has_stain) ||
    Boolean(piece.has_damage);

  const pieceCategory = piece.serviceCategoryCode || categoryLabel;
  const isExpress =
    typeof piece.serviceSpeed === 'string' &&
    piece.serviceSpeed.trim().length > 0 &&
    piece.serviceSpeed.toLowerCase() !== 'standard';
  const lastStepFormatted = formatShortDate(piece.lastStepAt, locale);
  const readyByFormatted = formatShortDate(piece.readyByAt, locale);

  return (
    <CmxCard
      className={cn(
        'p-3 transition-all',
        piece.isRejected && 'border-s-4',
        piece.isRejected && rejectEnabled && 'bg-danger-bg/50'
      )}
      style={{
        borderInlineStartColor: piece.isRejected && rejectEnabled ? rejectColor : undefined,
      }}
      role="article"
      aria-label={`${t('modal.piece')} ${piece.pieceNumber}`}
    >
      {/* Compact Header */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-semibold text-foreground">
            {t('modal.piece')} {piece.pieceNumber}
          </span>
          {piece.piece_code && (
            <CmxStatusBadge
              label={<bdi dir="ltr">{piece.piece_code}</bdi>}
              tone="info"
              size="sm"
              className="font-mono"
            />
          )}
          {pieceCategory && (
            <CmxStatusBadge label={pieceCategory} tone="neutral" size="sm" icon={Tag} />
          )}
          {isExpress && (
            <CmxStatusBadge
              label={
                piece.serviceSpeed?.toLowerCase() === 'express'
                  ? t('modal.speedExpress')
                  : piece.serviceSpeed || ''
              }
              tone="warning"
              size="sm"
            />
          )}
          {orderId && itemId && (
            <OrderIssueRowActions
              orderId={orderId}
              scopeLevel={ORDER_ISSUE_SCOPE.PIECE}
              orderItemId={itemId}
              orderItemPieceId={piece.id}
              openCount={issueOpenCount}
              totalCount={issueTotalCount}
              hasOpenIssue={Boolean(piece.issue_id)}
              onChanged={onConfirmSuccess}
            />
          )}
          {piece.scan_state && piece.scan_state !== 'expected' && (
            <CmxStatusBadge
              label={
                piece.scan_state === 'scanned'
                  ? t('modal.scanned')
                  : piece.scan_state === 'missing'
                    ? t('modal.missing')
                    : t('modal.wrong')
              }
              tone={
                piece.scan_state === 'scanned'
                  ? 'success'
                  : piece.scan_state === 'missing'
                    ? 'warning'
                    : 'danger'
              }
              size="sm"
            />
          )}
          {piece.tagReleasedAt && (
            <CmxStatusBadge label={t('modal.tagReleased')} tone="neutral" size="sm" />
          )}
          {piece.isRejected && rejectEnabled && (
            <div className="flex items-center gap-1">
              <CmxStatusBadge
                label={t('modal.rejected')}
                tone="danger"
                size="sm"
                style={{
                  backgroundColor: rejectColor,
                  color: readableTextOn(rejectColor),
                  borderColor: rejectColor,
                }}
              />
              <CmxButton
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onChange({ isRejected: false })}
                aria-label={t('modal.unReject')}
              >
                <X className="me-1 h-3 w-3" aria-hidden />
                {t('modal.unReject')}
              </CmxButton>
            </div>
          )}
        </div>

        {(hasPrefTags || piece.barcode) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <PiecePreferenceReadonlyChips
              piece={piece}
              colorHexByCode={colorHexByCode}
              nameByCode={nameByCode}
              itemDefaultPacking={itemDefaultPacking}
              maxVisible={0}
              size="sm"
            />
            {piece.barcode && (
              <CmxStatusBadge
                label={
                  <bdi dir="ltr">
                    {t('modal.barcode')}: {piece.barcode}
                  </bdi>
                }
                tone="neutral"
                appearance="outline"
                size="sm"
                className="font-mono"
              />
            )}
          </div>
        )}
      </div>

      {/* Step Timeline */}
      <div className="mb-2.5 border-b border-border pb-2.5">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-muted-foreground">
            {t('modal.step')}
            {currentStepLabel ? `: ` : ''}
            {currentStepLabel && (
              <span className="font-semibold text-foreground">{currentStepLabel}</span>
            )}
          </span>
          {(lastStepFormatted || readyByFormatted) && (
            <span className="text-muted-foreground tabular-nums">
              {lastStepFormatted ? `${t('modal.lastStepAt')}: ${lastStepFormatted}` : ''}
              {lastStepFormatted && readyByFormatted ? ' · ' : ''}
              {readyByFormatted ? `${t('modal.readyBy')}: ${readyByFormatted}` : ''}
            </span>
          )}
        </div>
        <CmxProcessingStepTimeline
          currentStep={piece.currentStep}
          completedSteps={completedSteps}
          processingSteps={localizedSteps}
          onStepClick={(value) => onChange({ currentStep: value as ProcessingStep })}
          size="sm"
          showLabels
          className="w-full"
        />
      </div>

      {/* Compact 4-Column Inputs Grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="mb-1 block text-xs">{t('modal.barcode')}</Label>
          <CmxInput
            value={piece.barcode || ''}
            onChange={(e) => onChange({ barcode: e.target.value })}
            placeholder={t('modal.barcode')}
            className="h-9 font-mono text-xs"
          />
        </div>

        <div>
          <Label className="mb-1 block text-xs">{t('modal.pieceStatus')}</Label>
          <div className="flex h-9 items-center rounded-md border border-border bg-muted px-2.5">
            <CmxStatusBadge
              label={pieceStatusLabel}
              tone={
                piece.piece_status === 'ready'
                  ? 'success'
                  : piece.piece_status === 'qa'
                    ? 'info'
                    : 'neutral'
              }
              size="sm"
            />
          </div>
        </div>

        <div>
          <Label className="mb-1 block text-xs">{t('modal.pieceStage')}</Label>
          <CmxInput
            value={piece.piece_stage || ''}
            onChange={(e) => onChange({ piece_stage: e.target.value })}
            placeholder={t('modal.pieceStage')}
            className="h-9 text-xs"
          />
        </div>

        <div>
          <Label className="mb-1 block text-xs">{t('modal.rackLocation')}</Label>
          <CmxInput
            value={piece.rackLocation || ''}
            onChange={(e) => onChange({ rackLocation: e.target.value })}
            placeholder={t('modal.rackLocation')}
            className="h-9 text-xs"
          />
        </div>
      </div>

      {/* Notes & Bottom Action Strip */}
      <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Label className="mb-1 block text-xs">{t('modal.notes')}</Label>
          <CmxTextarea
            value={piece.notes || ''}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder={t('modal.notes')}
            className="min-h-[44px] resize-none py-1.5 text-xs"
            rows={2}
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 pb-1">
          <CmxCheckbox
            checked={piece.is_ready ?? false}
            onChange={(e) => onChange({ is_ready: e.target.checked })}
            label={t('modal.ready')}
          />

          {splitOrderEnabled && (
            <CmxCheckbox
              checked={isSelectedForSplit}
              onChange={(e) => onSplitToggle(e.target.checked)}
              label={t('modal.split')}
            />
          )}

          {showConfirmButton && (
            <CmxButton
              type="button"
              variant="outline"
              size="xs"
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
            >
              <Check className="me-1 h-3 w-3" aria-hidden />
              {confirmMutation.isPending ? t('modal.confirming') : t('modal.confirmPrefs')}
            </CmxButton>
          )}
        </div>
      </div>

      {confirmMutation.isError && (
        <p className="mt-1.5 text-xs text-danger-text" role="alert">
          {confirmMutation.error instanceof Error
            ? confirmMutation.error.message
            : tTable('markReadyError')}
        </p>
      )}
    </CmxCard>
  );
});
