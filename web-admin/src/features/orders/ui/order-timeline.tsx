'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, ChevronDown, ChevronUp, User, AlertCircle, Copy, PlusCircle, CheckCircle, FileText, Receipt, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { createClient } from '@/lib/supabase/client';
import type { OrderStatus } from '@/lib/types/workflow';
import { STATUS_META } from '@/lib/types/workflow';
import { useInstantFormatter } from '@ui/clock';

interface HistoryEntry {
  id: string;
  action_type: string;
  from_value: string | null;
  to_value: string | null;
  payload: any;
  done_by: string | null;
  done_at: string | null;
}

interface OrderTimelineProps {
  orderId: string;
  currentStatus: OrderStatus;
}

const ACTION_ICONS: Record<string, any> = {
  ORDER_CREATED: PlusCircle,
  STATUS_CHANGE: Circle,
  FIELD_UPDATE: CheckCircle2,
  SPLIT: Copy,
  QA_DECISION: CheckCircle,
  ITEM_STEP: CheckCircle2,
  ISSUE_CREATED: AlertCircle,
  ISSUE_SOLVED: CheckCircle2,
  // BVM Phase 5 — outbox-driven order timeline events
  ORDER_SUBMITTED: ShieldCheck,
  VOUCHER_POSTED_AND_WIRED: FileText,
  AR_INVOICE_ISSUED: Receipt,
};

/**
 *
 * @param root0
 * @param root0.orderId
 * @param root0.currentStatus
 */
export function OrderTimeline({ orderId, currentStatus }: OrderTimelineProps) {
  const t = useTranslations('orders.timeline');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const fmtInstant = useInstantFormatter();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const getActionLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      ORDER_CREATED: t('actions.orderCreated'),
      STATUS_CHANGE: t('actions.statusChanged'),
      FIELD_UPDATE: t('actions.fieldUpdated'),
      SPLIT: t('actions.orderSplit'),
      QA_DECISION: t('actions.qaDecision'),
      ITEM_STEP: t('actions.processingStep'),
      ISSUE_CREATED: t('actions.issueCreated'),
      ISSUE_SOLVED: t('actions.issueResolved'),
      // BVM Phase 5 — outbox-driven labels
      ORDER_SUBMITTED: t('actions.orderSubmitted'),
      VOUCHER_POSTED_AND_WIRED: t('actions.voucherPostedAndWired'),
      AR_INVOICE_ISSUED: t('actions.arInvoiceIssued'),
    };
    return labels[actionType] || actionType;
  };

  useEffect(() => {
    fetchHistory();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchHistory = async () => {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('org_order_history')
        .select('*')
        .eq('order_id', orderId)
        .order('done_at', { ascending: false });

      if (fetchError) {
        console.warn('Order history table may not exist yet:', fetchError);
        setHistory([]);
        setError(null);
        return;
      }

      setHistory(data || []);
      setError(null);
    } catch (err) {
      console.warn('Error fetching order history:', err);
      setHistory([]);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const formatTimestamp = (timestamp: string) => {
    return fmtInstant(timestamp) ?? '—';
  };

  /**
   * Tone classes per history action. Each pairs a tone background with its text token,
   * so contrast holds in light and dark themes (the icon inherits the text colour).
   */
  const getActionToneClass = (actionType: string): string => {
    const tones: Record<string, string> = {
      ORDER_CREATED: 'bg-success-bg text-success-text',
      STATUS_CHANGE: 'bg-info-bg text-info-text',
      FIELD_UPDATE: 'bg-warning-bg text-warning-text',
      SPLIT: 'bg-primary-bg text-primary-text',
      QA_DECISION: 'bg-primary-bg text-primary-text',
      ITEM_STEP: 'bg-info-bg text-info-text',
      ISSUE_CREATED: 'bg-danger-bg text-danger-text',
      ISSUE_SOLVED: 'bg-success-bg text-success-text',
      // Financial events from the outbox consumer.
      ORDER_SUBMITTED: 'bg-success-bg text-success-text',
      VOUCHER_POSTED_AND_WIRED: 'bg-primary-bg text-primary-text',
      AR_INVOICE_ISSUED: 'bg-info-bg text-info-text',
    };
    return tones[actionType] || 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-5 h-5 animate-spin" />
          <span className="text-start">{tCommon('loading')}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-danger-bg p-4 text-sm text-danger-text text-start">
        {error}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-lg bg-muted p-8 text-center text-sm text-muted-foreground text-start">
        {t('noHistory')}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {history.map((entry, index) => {
        const isExpanded = expandedItems.has(entry.id);
        const hasNotes = !!entry.payload?.notes;
        const hasMetadata = entry.payload && Object.keys(entry.payload).length > 0;
        const Icon = ACTION_ICONS[entry.action_type] || Circle;
        const toneClass = getActionToneClass(entry.action_type);
        const statusMeta = entry.to_value ? STATUS_META[entry.to_value as OrderStatus] : null;

        return (
          <div key={entry.id} className="flex gap-3">
            {/* Icon and connecting line */}
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${toneClass}`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
              </div>
              {index < history.length - 1 && (
                <div className="w-0.5 h-full min-h-[40px] bg-muted" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-6">
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 text-start">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${toneClass}`}
                      >
                        {getActionLabel(entry.action_type)}
                      </span>
                      {entry.from_value && entry.to_value && (
                        <span className="text-xs text-muted-foreground">
                          {entry.from_value} {isRTL ? '←' : '→'} {entry.to_value}
                        </span>
                      )}
                      {statusMeta && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `${statusMeta.color}20`,
                            color: statusMeta.color,
                          }}
                        >
                          {statusMeta.label}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        {entry.done_at ? formatTimestamp(entry.done_at) : 'N/A'}
                      </span>
                      {entry.payload?.done_by_name && (
                        <>
                          <span>•</span>
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span>{entry.payload.done_by_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {(hasNotes || hasMetadata) && (
                    <button
                      onClick={() => toggleExpand(entry.id)}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      aria-label={isExpanded ? t('collapseDetails') : t('expandDetails')}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  )}
                </div>

                {/* Details (expandable) */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border space-y-3 text-start">
                    {hasNotes && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1 text-start">{t('notes')}:</div>
                        <div className="text-sm text-foreground whitespace-pre-wrap text-start">
                          {entry.payload.notes}
                        </div>
                      </div>
                    )}
                    
                    {/* Additional metadata */}
                    {entry.payload && Object.keys(entry.payload).length > (hasNotes ? 1 : 0) && (
                      <details>
                        <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground text-start">
                          {t('details')}
                        </summary>
                        <pre className="mt-2 text-xs text-muted-foreground overflow-auto text-start">
                          {JSON.stringify(entry.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
