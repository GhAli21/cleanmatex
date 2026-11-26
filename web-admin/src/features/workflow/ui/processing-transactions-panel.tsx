'use client';

/**
 * ProcessingTransactionsPanel
 * Displays chronological processing batch & operator transactions (`org_prc_trx_mst`
 * + `org_prc_trx_dtl`) for an order with target-level filtering and expandable lines.
 */

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, History, RefreshCw } from 'lucide-react';
import {
  CmxButton,
  CmxCard,
  CmxCardContent,
  CmxSpinner,
} from '@ui/primitives';
import {
  CmxCodeChip,
  CmxCollapsibleSection,
  CmxEmptyState,
} from '@ui/data-display';
import { CmxStatusBadge, useMessage } from '@ui/feedback';
import {
  PRC_TRX_TARGET_LEVELS,
  type PrcTrxTargetLevel,
} from '@/lib/constants/processing-trx';
import type { ProcessingTrxHeader } from '@/lib/types/processing-trx';
import { formatDateTime } from '@/lib/utils/rtl';
import { cn } from '@/lib/utils';

export interface ProcessingTransactionsPanelProps {
  orderId: string;
  /** Increment to force refetch after a batch save or tag link. */
  refreshKey?: number;
  className?: string;
}

type FilterValue = 'ALL' | PrcTrxTargetLevel;

const FILTER_OPTIONS: FilterValue[] = [
  'ALL',
  PRC_TRX_TARGET_LEVELS.ORDER,
  PRC_TRX_TARGET_LEVELS.ITEM,
  PRC_TRX_TARGET_LEVELS.PIECE,
  PRC_TRX_TARGET_LEVELS.PREFERENCE,
  PRC_TRX_TARGET_LEVELS.OTHERS,
];

function getTrxTone(
  transType: string
): 'brand' | 'info' | 'success' | 'warning' | 'neutral' {
  if (transType === 'PROCESSING_BATCH' || transType === 'SIMPLE_PROCESSING') return 'brand';
  if (transType === 'ITEM_COMPLETE') return 'success';
  if (transType === 'TAG_LINK' || transType === 'RACK_ASSIGN') return 'info';
  if (transType === 'NOTE_ADD') return 'warning';
  return 'neutral';
}

export function ProcessingTransactionsPanel({
  orderId,
  refreshKey = 0,
  className,
}: ProcessingTransactionsPanelProps) {
  const t = useTranslations('processing');
  const locale = useLocale();
  const { showError } = useMessage();

  const [filterLevel, setFilterLevel] = React.useState<FilterValue>('ALL');
  const [loading, setLoading] = React.useState(true);
  const [transactions, setTransactions] = React.useState<ProcessingTrxHeader[]>([]);

  const fetchTransactions = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '50' });
      if (filterLevel !== 'ALL') {
        qs.set('targetLevel', filterLevel);
      }
      const res = await fetch(
        `/api/v1/orders/${encodeURIComponent(orderId)}/processing-transactions?${qs.toString()}`
      );
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        data?: ProcessingTrxHeader[];
      };

      if (!res.ok || !json.success) {
        showError(json.error || t('trx.loadError'));
        return;
      }

      setTransactions(json.data ?? []);
    } catch {
      showError(t('trx.loadError'));
    } finally {
      setLoading(false);
    }
  }, [orderId, filterLevel, showError, t]);

  React.useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions, refreshKey]);

  return (
    <CmxCard className={cn('border-border bg-card', className)}>
      <CmxCardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary-text" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">{t('trx.title')}</h3>
            <CmxStatusBadge tone="neutral" size="sm" label={String(transactions.length)} />
          </div>
          <CmxButton
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void fetchTransactions()}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
              aria-hidden="true"
            />
            {t('trx.refresh')}
          </CmxButton>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('trx.filterLabel')}>
          {FILTER_OPTIONS.map((opt) => (
            <CmxButton
              key={opt}
              type="button"
              size="sm"
              variant={filterLevel === opt ? 'primary' : 'outline'}
              onClick={() => setFilterLevel(opt)}
            >
              {t(`trx.targets.${opt}`, { defaultValue: opt })}
            </CmxButton>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <CmxSpinner size="md" />
          </div>
        ) : transactions.length === 0 ? (
          <CmxEmptyState
            icon={<History className="h-8 w-8 text-muted-foreground" />}
            title={t('trx.emptyTitle')}
            description={t('trx.emptyDescription')}
          />
        ) : (
          <div className="space-y-2">
            {transactions.map((trx, index) => (
              <CmxCollapsibleSection
                key={trx.id}
                defaultOpen={index === 0}
                className="rounded-md border border-border bg-background"
                headerClassName="px-3 py-2.5"
                bodyClassName="px-3 pb-3"
                title={
                  <div className="flex flex-wrap items-center gap-2">
                    <CmxCodeChip code={trx.trx_code} kind="order" size="sm" />
                    <CmxStatusBadge
                      tone={getTrxTone(trx.trans_type)}
                      size="sm"
                      label={t(`trx.types.${trx.trans_type}`, {
                        defaultValue: trx.trans_type,
                      })}
                    />
                    <span className="text-xs font-medium text-foreground">
                      {trx.trx_description || trx.trans_type}
                    </span>
                  </div>
                }
                trailing={
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{trx.actor_name || t('notes.operatorFallback')}</span>
                    <CmxStatusBadge
                      tone="neutral"
                      size="sm"
                      label={t('trx.lineCount', { count: trx.details.length })}
                    />
                    <time dateTime={trx.occurred_at} className="tabular-nums">
                      {formatDateTime(trx.occurred_at, locale === 'ar' ? 'ar' : 'en')}
                    </time>
                  </div>
                }
              >
                <div className="space-y-2 border-t border-border pt-2.5">
                  {trx.notes && (
                    <div className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-foreground">
                      <span className="font-medium text-muted-foreground me-1.5">
                        {t('trx.batchNoteLabel')}:
                      </span>
                      <span>{trx.notes}</span>
                    </div>
                  )}

                  {trx.details.length > 0 && (
                    <div className="space-y-1.5">
                      {trx.details.map((line) => (
                        <div
                          key={line.id}
                          className="flex flex-wrap items-start justify-between gap-2 rounded border border-border bg-card px-2.5 py-1.5 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <CmxStatusBadge
                                tone="neutral"
                                size="sm"
                                label={
                                  line.target_level === PRC_TRX_TARGET_LEVELS.OTHERS &&
                                  line.target_level_text
                                    ? `${t('trx.targets.OTHERS')}: ${line.target_level_text}`
                                    : t(`trx.targets.${line.target_level}`, {
                                        defaultValue: line.target_level,
                                      })
                                }
                              />
                              <CmxStatusBadge
                                tone="info"
                                size="sm"
                                label={t(`trx.dtlTypes.${line.trans_dtl_type}`, {
                                  defaultValue: line.trans_dtl_type,
                                })}
                              />
                              <span className="font-medium text-foreground">
                                {line.trans_dtl_description || line.trans_dtl_type}
                              </span>
                            </div>
                            {line.notes && (
                              <p className="text-muted-foreground">{line.notes}</p>
                            )}
                          </div>

                          {(line.from_value !== null || line.to_value !== null) && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <bdi dir="ltr" className="font-mono">
                                {line.from_value ?? '—'}
                              </bdi>
                              <ArrowRight
                                className="h-3 w-3 shrink-0 rtl:rotate-180"
                                aria-hidden="true"
                              />
                              <bdi dir="ltr" className="font-mono text-foreground font-medium">
                                {line.to_value ?? '—'}
                              </bdi>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CmxCollapsibleSection>
            ))}
          </div>
        )}
      </CmxCardContent>
    </CmxCard>
  );
}
