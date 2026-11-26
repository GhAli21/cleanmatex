/**
 * Processing Item Row Component
 * Displays a single order item with bilingual service category, condition/speed metadata,
 * per-item bulk ready toggle, and expandable piece details.
 */

'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Package,
  Tag,
} from 'lucide-react';
import { CmxButton, CmxCard, CmxCardContent, CmxCardHeader } from '@ui/primitives';
import { CmxProgressIndicator } from '@/src/ui/feedback/cmx-progress-indicator';
import { CmxStatusBadge } from '@/src/ui/feedback/cmx-status-badge';
import { ORDER_ISSUE_SCOPE } from '@/lib/constants/order-issues';
import { useBilingual } from '@/lib/utils/bilingual';
import { cn } from '@/lib/utils';
import { OrderIssueRowActions } from '@features/orders/ui/issues/order-issue-row-actions';
import type { ItemPiece, OrderItem, ProcessingStepConfig } from '@/types/order';
import type { PrefsFollowupNote } from '@/lib/utils/notes-followup';
import type { PieceTagSaved } from '@/src/features/scan/api/scan-api';
import {
  NOTES_FOLLOWUP_TARGET_LEVELS,
  PRC_TRX_SOURCE_SCREENS,
} from '@/lib/constants/processing-trx';
import { PREFS_SOURCE_STAGE } from '@/lib/constants/order-preferences';
import { CmxFollowupNotesFeed } from './cmx-followup-notes-feed';
import { ProcessingPieceRow } from './processing-piece-row';

interface ProcessingItemRowProps {
  item: OrderItem;
  pieces: ItemPiece[];
  isExpanded: boolean;
  onToggleExpand: (itemId: string) => void;
  onPieceChange: (pieceId: string, updates: Partial<ItemPiece>) => void;
  onBulkReadyChange?: (itemId: string, ready: boolean) => void;
  onSplitToggle: (pieceId: string, selected: boolean) => void;
  selectedForSplit: Set<string>;
  splitOrderEnabled: boolean;
  rejectEnabled: boolean;
  trackByPiece: boolean;
  rejectColor: string;
  orderId?: string;
  tenantId?: string;
  processingSteps: ProcessingStepConfig[];
  processingConfirmationEnabled?: boolean;
  onConfirmSuccess?: () => void;
  colorHexByCode?: Map<string, string | null> | null;
  nameByCode?: Map<string, string> | null;
  issueOpenCount?: number;
  issueTotalCount?: number;
  issueByPiece?: Record<string, { open: number; total: number }>;
  isCommercialLocked?: boolean;
  onItemNotesUpdated?: (itemId: string, notes: PrefsFollowupNote[], trxCode?: string) => void;
  onPieceNotesUpdated?: (pieceId: string, notes: PrefsFollowupNote[], trxCode?: string) => void;
  onTagSaved?: (pieceId: string, saved: PieceTagSaved) => void;
}

const KNOWN_STATUS_KEYS = new Set([
  'processing',
  'sorting',
  'pretreatment',
  'washing',
  'drying',
  'finishing',
  'in_wash',
  'in_dry',
  'in_finish',
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
 * Item card inside `ProcessingModal` with expandable piece cards and item metadata.
 */
export const ProcessingItemRow = React.memo(function ProcessingItemRow(
  props: ProcessingItemRowProps
) {
  const {
    item,
    pieces,
    isExpanded,
    onToggleExpand,
    onPieceChange,
    onBulkReadyChange,
    onSplitToggle,
    selectedForSplit,
    splitOrderEnabled,
    rejectEnabled,
    trackByPiece,
    rejectColor,
    orderId,
    tenantId,
    processingSteps,
    processingConfirmationEnabled = false,
    onConfirmSuccess,
    colorHexByCode = null,
    nameByCode = null,
    issueOpenCount,
    issueTotalCount,
    issueByPiece = {},
    isCommercialLocked = false,
    onItemNotesUpdated,
    onPieceNotesUpdated,
    onTagSaved,
  } = props;

  const t = useTranslations('processing.modal');
  const tTable = useTranslations('processing.table');
  const tStatus = useTranslations('processing.status');
  const locale = useLocale();
  const getBilingual = useBilingual();

  const primaryName =
    getBilingual(
      item.org_product_data_mst?.product_name || item.product_name,
      item.org_product_data_mst?.product_name2 || item.product_name2
    ) || t('unknownItem');

  const categoryLabel =
    getBilingual(item.service_category_name, item.service_category_name2) ||
    item.service_category_code ||
    null;

  const stepDisplay = React.useMemo(() => {
    if (!item.item_last_step) return null;
    const match = processingSteps.find((s) => s.step_code === item.item_last_step);
    if (match) {
      return getBilingual(match.step_name, match.step_name2) || match.step_name;
    }
    const lower = item.item_last_step.toLowerCase();
    if (KNOWN_STATUS_KEYS.has(lower)) return tStatus(lower);
    return item.item_last_step.replace(/[_-]+/g, ' ');
  }, [getBilingual, item.item_last_step, processingSteps, tStatus]);

  const itemStatusLabel = React.useMemo(() => {
    const raw = (item.item_status || item.status || 'processing').toLowerCase();
    if (KNOWN_STATUS_KEYS.has(raw)) return tStatus(raw);
    return raw.replace(/[_-]+/g, ' ');
  }, [item.item_status, item.status, tStatus]);

  const isRejected = Boolean(item.item_is_rejected) || pieces.some((p) => p.isRejected);
  const readyCount = pieces.filter((p) => p.is_ready === true).length;
  const totalCount = pieces.length || item.quantity;
  const progressPercentage = totalCount > 0 ? (readyCount / totalCount) * 100 : 0;
  const allPiecesReady = pieces.length > 0 && pieces.every((p) => p.is_ready === true);
  const isExpressSpeed =
    typeof item.service_speed === 'string' &&
    item.service_speed.trim().length > 0 &&
    item.service_speed.toLowerCase() !== 'standard';
  const itemReadyByFormatted = formatShortDate(item.ready_by_at, locale);
  const itemStepAtFormatted = formatShortDate(item.item_last_step_at, locale);

  return (
    <CmxCard
      className={cn(
        'overflow-hidden transition-all hover:shadow-sm',
        isRejected && rejectEnabled && 'border-s-4 bg-danger-bg/30'
      )}
      style={{
        borderInlineStartColor: isRejected && rejectEnabled ? rejectColor : undefined,
      }}
      role="article"
      aria-label={t('itemAriaLabel', { name: primaryName })}
    >
      <CmxCardHeader className="p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Package className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <h3 className="truncate text-base font-semibold text-foreground">{primaryName}</h3>

              {categoryLabel && (
                <CmxStatusBadge
                  label={categoryLabel}
                  tone="brand"
                  size="sm"
                  icon={Tag}
                />
              )}

              {isExpressSpeed && (
                <CmxStatusBadge
                  label={
                    item.service_speed?.toLowerCase() === 'express'
                      ? t('speedExpress')
                      : item.service_speed || ''
                  }
                  tone="warning"
                  size="sm"
                />
              )}

              {orderId && (
                <OrderIssueRowActions
                  orderId={orderId}
                  scopeLevel={ORDER_ISSUE_SCOPE.ITEM}
                  orderItemId={item.id}
                  openCount={issueOpenCount}
                  totalCount={issueTotalCount}
                  hasOpenIssue={Boolean(item.item_issue_id)}
                  onChanged={onConfirmSuccess}
                />
              )}
            </div>

            {trackByPiece && totalCount > 0 && (
              <CmxProgressIndicator
                value={progressPercentage}
                size="sm"
                variant={progressPercentage === 100 ? 'success' : 'default'}
                showPercentage
                label={t('quantityReady', { ready: readyCount, total: totalCount })}
              />
            )}

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {stepDisplay && (
                <CmxStatusBadge
                  label={t('stepBadge', { step: stepDisplay })}
                  tone="info"
                  size="sm"
                />
              )}
              {itemStepAtFormatted && (
                <span className="text-muted-foreground tabular-nums">
                  {t('lastStepAt')}: {itemStepAtFormatted}
                </span>
              )}
              {itemReadyByFormatted && (
                <span className="text-muted-foreground tabular-nums">
                  · {t('readyBy')}: {itemReadyByFormatted}
                </span>
              )}
              {item.packing_pref_code && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                  {t('packing')}: {nameByCode?.get(item.packing_pref_code) || item.packing_pref_code}
                </span>
              )}
              {item.color && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                  {t('color')}: {item.color}
                </span>
              )}
              {item.brand && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                  {t('brand')}: {item.brand}
                </span>
              )}
              {item.has_stain && (
                <CmxStatusBadge
                  label={item.stain_notes ? `${t('stainNotes')}: ${item.stain_notes}` : t('hasStain')}
                  tone="warning"
                  size="sm"
                />
              )}
              {item.has_damage && (
                <CmxStatusBadge
                  label={item.damage_notes ? `${t('damageNotes')}: ${item.damage_notes}` : t('hasDamage')}
                  tone="danger"
                  size="sm"
                />
              )}
              {isRejected && rejectEnabled && (
                <CmxStatusBadge
                  label={t('rejected')}
                  tone="danger"
                  size="sm"
                  icon={AlertTriangle}
                  style={{
                    backgroundColor: `${rejectColor}40`,
                    color: rejectColor,
                    borderColor: rejectColor,
                  }}
                />
              )}
              {!trackByPiece && (
                <CmxStatusBadge
                  label={t('statusBadge', { status: itemStatusLabel })}
                  tone="neutral"
                  size="sm"
                />
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {trackByPiece && onBulkReadyChange && pieces.length > 0 && (
              <CmxButton
                type="button"
                variant={allPiecesReady ? 'outline' : 'secondary'}
                size="xs"
                onClick={() => onBulkReadyChange(item.id, !allPiecesReady)}
                className="h-8"
              >
                <CheckCheck className="me-1 h-3.5 w-3.5" aria-hidden />
                {allPiecesReady ? t('unmarkAllReady') : t('markAllReady')}
              </CmxButton>
            )}

            {trackByPiece && (
              <CmxButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onToggleExpand(item.id)}
                className="h-8 shrink-0 px-2.5"
                aria-expanded={isExpanded}
                aria-label={
                  isExpanded
                    ? `${t('collapsePieces')} ${pieces.length} ${t('pieces')}`
                    : `${t('expandPieces')} ${pieces.length} ${t('pieces')}`
                }
                aria-controls={`pieces-${item.id}`}
              >
                {t('pieces')} ({pieces.length})
                {isExpanded ? (
                  <ChevronUp className="ms-1.5 h-4 w-4" aria-hidden />
                ) : (
                  <ChevronDown className="ms-1.5 h-4 w-4" aria-hidden />
                )}
              </CmxButton>
            )}
          </div>
        </div>
      </CmxCardHeader>

      {trackByPiece && isExpanded && (
        <CmxCardContent
          className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4"
          id={`pieces-${item.id}`}
          role="region"
          aria-label={`${primaryName} - ${t('pieces')}`}
        >
          <div className="space-y-2.5">
            {pieces.map((piece) => (
              <ProcessingPieceRow
                key={piece.id}
                piece={piece}
                onChange={(updates) => onPieceChange(piece.id, updates)}
                onSplitToggle={(selected) => onSplitToggle(piece.id, selected)}
                isSelectedForSplit={selectedForSplit.has(piece.id)}
                splitOrderEnabled={splitOrderEnabled}
                rejectEnabled={rejectEnabled}
                rejectColor={rejectColor}
                processingSteps={processingSteps}
                itemDefaultPacking={item.packing_pref_code}
                colorHexByCode={colorHexByCode}
                nameByCode={nameByCode}
                categoryLabel={categoryLabel}
                processingConfirmationEnabled={processingConfirmationEnabled}
                orderId={orderId}
                itemId={item.id}
                tenantId={tenantId}
                onConfirmSuccess={onConfirmSuccess}
                issueOpenCount={issueByPiece[piece.id]?.open}
                issueTotalCount={issueByPiece[piece.id]?.total}
                isCommercialLocked={isCommercialLocked}
                onPieceNotesUpdated={onPieceNotesUpdated}
                onTagSaved={onTagSaved}
              />
            ))}
          </div>

          {orderId && (
            <div className="mt-2.5">
              <CmxFollowupNotesFeed
                orderId={orderId}
                targetLevel={NOTES_FOLLOWUP_TARGET_LEVELS.ITEM}
                targetId={item.id}
                notes={item.notes_followup}
                intakeNote={item.notes}
                intakeNoteLocked={isCommercialLocked}
                noteSource={PREFS_SOURCE_STAGE.ORDER_PROCESSING}
                sourceScreen={PRC_TRX_SOURCE_SCREENS.PROCESSING_MODAL}
                onNotesUpdated={(updatedNotes, trxCode) =>
                  onItemNotesUpdated?.(item.id, updatedNotes, trxCode)
                }
                compact
              />
            </div>
          )}
        </CmxCardContent>
      )}

      {!trackByPiece && (
        <CmxCardContent className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium">{t('itemLevelTracking')}</p>
            <div className="flex items-center gap-2">
              <span>{t('status')}:</span>
              <CmxStatusBadge label={itemStatusLabel} tone="neutral" size="sm" />
              {item.barcode && (
                <span className="font-mono text-xs text-muted-foreground">
                  <bdi dir="ltr">{tTable('id')}: {item.barcode}</bdi>
                </span>
              )}
            </div>
            {orderId ? (
              <CmxFollowupNotesFeed
                orderId={orderId}
                targetLevel={NOTES_FOLLOWUP_TARGET_LEVELS.ITEM}
                targetId={item.id}
                notes={item.notes_followup}
                intakeNote={item.notes}
                intakeNoteLocked={isCommercialLocked}
                noteSource={PREFS_SOURCE_STAGE.ORDER_PROCESSING}
                sourceScreen={PRC_TRX_SOURCE_SCREENS.PROCESSING_MODAL}
                onNotesUpdated={(updatedNotes, trxCode) =>
                  onItemNotesUpdated?.(item.id, updatedNotes, trxCode)
                }
                compact
              />
            ) : (
              item.notes && (
                <div className="rounded-md bg-muted p-2.5">
                  <span className="font-medium text-foreground">{t('notesLabel')}</span>
                  <p className="mt-1 text-muted-foreground">{item.notes}</p>
                </div>
              )
            )}
          </div>
        </CmxCardContent>
      )}
    </CmxCard>
  );
});
