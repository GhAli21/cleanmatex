/**
 * Processing Item Row Component
 *
 * Displays a single order item with expandable piece details.
 * Shows aggregate status and "Pieces" button to expand/collapse.
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { CmxButton } from '@ui/primitives';
import { ChevronDown, ChevronUp, Package, AlertTriangle } from 'lucide-react';
import type { OrderItem, ItemPiece, ProcessingStepConfig } from '@/types/order';
import { ProcessingPieceRow } from './processing-piece-row';
import { Card, CardHeader, CardContent } from '@/src/ui/primitives/card';
import { CmxProgressIndicator } from '@/src/ui/feedback/cmx-progress-indicator';
import { CmxStatusBadge } from '@/src/ui/feedback/cmx-status-badge';
import { cn } from '@/lib/utils';

interface ProcessingItemRowProps {
  item: OrderItem;
  pieces: ItemPiece[];
  isExpanded: boolean;
  onToggleExpand: (itemId: string) => void;
  onPieceChange: (pieceId: string, updates: Partial<ItemPiece>) => void;
  onSplitToggle: (pieceId: string, selected: boolean) => void;
  selectedForSplit: Set<string>;
  splitOrderEnabled: boolean;
  rejectEnabled: boolean;
  trackByPiece: boolean;
  rejectColor: string;
  orderId?: string;
  tenantId?: string;
}

export const ProcessingItemRow = React.memo(function ProcessingItemRow({
  item,
  pieces,
  isExpanded,
  onToggleExpand,
  onPieceChange,
  onSplitToggle,
  selectedForSplit,
  splitOrderEnabled,
  rejectEnabled,
  trackByPiece,
  rejectColor,
  orderId,
  tenantId,
}: ProcessingItemRowProps) {
  const t = useTranslations('processing.modal');

  const isRejected = item.item_is_rejected || pieces.some(p => p.isRejected);
  const readyCount = pieces.filter(p => p.is_ready === true).length;
  const totalCount = item.quantity;
  const progressPercentage = totalCount > 0 ? (readyCount / totalCount) * 100 : 0;

  // Fetch processing steps for this item's service category
  const serviceCategoryCode = item.service_category_code;
  const { data: processingStepsData } = useQuery<{ success: boolean; data?: ProcessingStepConfig[] }>({
    queryKey: ['processing-steps', tenantId, serviceCategoryCode],
    queryFn: async () => {
      if (!tenantId || !serviceCategoryCode) return { success: false };
      const response = await fetch(`/api/v1/processing-steps/${encodeURIComponent(serviceCategoryCode)}`);
      if (!response.ok) {
        console.error('[ProcessingItemRow] Failed to fetch processing steps:', response.statusText);
        return { success: false };
      }
      return response.json();
    },
    enabled: !!tenantId && !!serviceCategoryCode,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const processingSteps: ProcessingStepConfig[] = processingStepsData?.data || [];

  // Debug logging
  React.useEffect(() => {
    console.log('[ProcessingItemRow] Props:', {
      itemId: item.id,
      trackByPiece,
      splitOrderEnabled,
      rejectEnabled,
      piecesCount: pieces.length,
      serviceCategoryCode,
      processingStepsCount: processingSteps.length,
    });
  }, [item.id, trackByPiece, splitOrderEnabled, rejectEnabled, pieces.length, serviceCategoryCode, processingSteps.length]);

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all hover:shadow-md',
        isRejected && rejectEnabled && 'border-l-4 bg-red-50/30'
      )}
      style={{
        borderLeftColor: isRejected && rejectEnabled ? rejectColor : undefined,
      }}
      role="article"
      aria-label={`Item: ${item.org_product_data_mst?.product_name || item.product_name || 'Unknown Item'}`}
    >
      <CardHeader className="pb-3 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 mb-2">
              <Package className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg text-gray-900 truncate">
                  {item.org_product_data_mst?.product_name || item.product_name || 'Unknown Item'}
                </h3>
                {(item.org_product_data_mst?.product_name2 || item.product_name2) && (
                  <p className="text-sm text-gray-600 mt-0.5">
                    {item.org_product_data_mst?.product_name2 || item.product_name2}
                  </p>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {trackByPiece && totalCount > 0 && (
              <div className="mb-3">
                <CmxProgressIndicator
                  value={progressPercentage}
                  size="sm"
                  variant={progressPercentage === 100 ? 'success' : 'default'}
                  showPercentage={true}
                  label={t('quantityReady', { ready: readyCount, total: totalCount })}
                />
              </div>
            )}

            {/* Status Info */}
            <div className="flex items-center gap-3 flex-wrap">
              {item.item_last_step && (
                <CmxStatusBadge
                  label={`Step: ${item.item_last_step.replace('_', ' ')}`}
                  variant="info"
                  size="sm"
                  className="capitalize"
                />
              )}
              {isRejected && rejectEnabled && (
                <CmxStatusBadge
                  label={t('rejected')}
                  variant="error"
                  size="sm"
                  icon={AlertTriangle}
                  showIcon
                  style={{
                    backgroundColor: `${rejectColor}40`,
                    color: rejectColor,
                    borderColor: rejectColor,
                  }}
                />
              )}
              {!trackByPiece && (
                <CmxStatusBadge
                  label={`Status: ${item.status}`}
                  variant="default"
                  size="sm"
                  className="capitalize"
                />
              )}
            </div>
          </div>

          {/* Pieces Button - Only show if trackByPiece is enabled */}
          {trackByPiece && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleExpand(item.id)}
              className="shrink-0 min-h-[44px] min-w-[44px] touch-manipulation"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? `${t('collapsePieces') || 'Collapse'} ${pieces.length} ${t('pieces')}` : `${t('expandPieces') || 'Expand'} ${pieces.length} ${t('pieces')}`}
              aria-controls={`pieces-${item.id}`}
            >
              {t('pieces')} ({pieces.length})
              {isExpanded ? (
                <ChevronUp className="ml-2 h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="ml-2 h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      {/* Pieces Detail - Only show if trackByPiece is enabled AND expanded */}
      {trackByPiece && isExpanded && (
        <CardContent className="pt-0" id={`pieces-${item.id}`} role="region" aria-label={`Pieces for ${item.org_product_data_mst?.product_name || item.product_name || 'item'}`}>
          <div className="space-y-3">
            {pieces.map(piece => (
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
              />
            ))}
          </div>
        </CardContent>
      )}

      {/* Item-Level View - Show if trackByPiece is disabled */}
      {!trackByPiece && (
        <CardContent>
          <div className="text-sm text-gray-600 space-y-2">
            <p className="font-medium">Item-level tracking active</p>
            <div className="flex items-center gap-2">
              <span>Status:</span>
              <CmxStatusBadge
                label={item.status}
                variant="default"
                size="sm"
                className="capitalize"
              />
            </div>
            {item.notes && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                <span className="font-medium text-gray-700">Notes:</span>
                <p className="mt-1 text-gray-600">{item.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
});
