'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, ChevronDown, ChevronUp, User, AlertCircle, Copy, PlusCircle, CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useLocale } from '@/lib/hooks/useLocale';
import { createClient } from '@/lib/supabase/client';
import type { OrderStatus } from '@/lib/types/workflow';
import { STATUS_META } from '@/lib/types/workflow';

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
};

export function OrderTimeline({ orderId, currentStatus }: OrderTimelineProps) {
  const t = useTranslations('orders.timeline');
  const isRTL = useRTL();
  const locale = useLocale();
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
    return new Date(timestamp).toLocaleString(locale === 'ar' ? 'ar-OM' : 'en-OM', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const getActionColor = (actionType: string) => {
    const colors: Record<string, string> = {
      ORDER_CREATED: '#10b981',
      STATUS_CHANGE: '#3b82f6',
      FIELD_UPDATE: '#f59e0b',
      SPLIT: '#8b5cf6',
      QA_DECISION: '#ec4899',
      ITEM_STEP: '#14b8a6',
      ISSUE_CREATED: '#ef4444',
      ISSUE_SOLVED: '#22c55e',
    };
    return colors[actionType] || '#6b7280';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className={`flex items-center gap-2 text-gray-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Clock className="w-5 h-5 animate-spin" />
          <span className={isRTL ? 'text-right' : 'text-left'}>{t('loading')}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg bg-red-50 p-4 text-sm text-red-600 ${isRTL ? 'text-right' : 'text-left'}`}>
        {error}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className={`rounded-lg bg-gray-50 p-8 text-center text-sm text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
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
        const color = getActionColor(entry.action_type);
        const statusMeta = entry.to_value ? STATUS_META[entry.to_value as OrderStatus] : null;

        return (
          <div key={entry.id} className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {/* Icon and connecting line */}
            <div className="flex flex-col items-center">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
                style={{ backgroundColor: `${color}20` }}
              >
                <Icon
                  className="w-4 h-4"
                  style={{ color }}
                />
              </div>
              {index < history.length - 1 && (
                <div className="w-0.5 h-full min-h-[40px] bg-gray-200" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-6">
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                {/* Header */}
                <div className={`flex items-start ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} gap-4`}>
                  <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${color}20`,
                          color,
                        }}
                      >
                        {getActionLabel(entry.action_type)}
                      </span>
                      {entry.from_value && entry.to_value && (
                        <span className="text-xs text-gray-400">
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

                    <div className={`mt-2 flex items-center gap-2 text-sm text-gray-600 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span>
                        {entry.done_at ? formatTimestamp(entry.done_at) : 'N/A'}
                      </span>
                      {entry.payload?.done_by_name && (
                        <>
                          <span>•</span>
                          <User className="w-4 h-4 text-gray-400" />
                          <span>{entry.payload.done_by_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {(hasNotes || hasMetadata) && (
                    <button
                      onClick={() => toggleExpand(entry.id)}
                      className="p-1 rounded hover:bg-gray-100 transition-colors"
                      aria-label={isExpanded ? t('collapseDetails') : t('expandDetails')}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  )}
                </div>

                {/* Details (expandable) */}
                {isExpanded && (
                  <div className={`mt-3 pt-3 border-t border-gray-100 space-y-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {hasNotes && (
                      <div>
                        <div className={`text-xs font-medium text-gray-500 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>{t('notes')}:</div>
                        <div className={`text-sm text-gray-700 whitespace-pre-wrap ${isRTL ? 'text-right' : 'text-left'}`}>
                          {entry.payload.notes}
                        </div>
                      </div>
                    )}
                    
                    {/* Additional metadata */}
                    {entry.payload && Object.keys(entry.payload).length > (hasNotes ? 1 : 0) && (
                      <details>
                        <summary className={`text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('details')}
                        </summary>
                        <pre className={`mt-2 text-xs text-gray-500 overflow-auto ${isRTL ? 'text-right' : 'text-left'}`}>
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
