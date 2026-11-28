'use client';

/**
 * Customer Audit History Tab
 * Displays tenant-scoped change history from org_customer_audit_dtl.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getCustomerAuditHistory } from '@/lib/api/customers';
import type { CustomerAuditEntry, OrgCustomerAuditActionType } from '@/lib/types/customer';
import { CmxButton, CmxSkeleton } from '@ui/primitives';
import { useMessage } from '@ui/feedback';
import { History, RefreshCw } from 'lucide-react';

interface CustomerAuditHistoryTabProps {
  customerId: string;
}

const ACTION_BADGE_STYLES: Record<OrgCustomerAuditActionType, string> = {
  CREATED: 'bg-success-bg text-success-text',
  LINKED_FROM_SYS: 'bg-info-bg text-info-text',
  REACTIVATED: 'bg-success-bg text-success-text',
  PROFILE_UPDATED: 'bg-warning-bg text-warning-text',
  COMMERCIAL_UPDATED: 'bg-info-bg text-info-text',
  DEACTIVATED: 'bg-danger-bg text-danger-text',
};

function formatAuditValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

export function CustomerAuditHistoryTab({ customerId }: CustomerAuditHistoryTabProps) {
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { showErrorFrom } = useMessage();

  const [entries, setEntries] = useState<CustomerAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCustomerAuditHistory(customerId, 50);
      setEntries(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('audit.loadFailed');
      setError(msg);
      showErrorFrom(err, { fallback: t('audit.loadFailed') });
    } finally {
      setLoading(false);
    }
  }, [customerId, showErrorFrom, t]);

  useEffect(() => {
    if (customerId) {
      loadHistory();
    }
  }, [customerId, loadHistory]);

  const formatTimestamp = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const getActionLabel = (action: OrgCustomerAuditActionType): string => {
    const key = `audit.actions.${action}` as const;
    return t(key);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-start">
          <h3 className="text-lg font-semibold text-foreground">{t('audit.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('audit.subtitle')}</p>
        </div>
        <CmxButton
          type="button"
          variant="outline"
          size="sm"
          onClick={loadHistory}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 me-2 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          {tCommon('refresh')}
        </CmxButton>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-lg border border-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <CmxSkeleton className="h-5 w-32" />
                <CmxSkeleton className="h-4 w-28" />
              </div>
              <CmxSkeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-danger-border bg-danger-bg p-4 text-sm text-danger-text text-start">
          {error}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
          <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" aria-hidden />
          <p className="text-sm font-medium text-foreground">{t('audit.emptyTitle')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('audit.emptyDescription')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const diffKeys = Array.from(
              new Set([
                ...(entry.changedFields ?? []),
                ...Object.keys(entry.oldValues ?? {}),
                ...Object.keys(entry.newValues ?? {}),
              ])
            ).filter((k) => k !== 'commercial_fields');

            return (
              <div
                key={entry.id}
                className="rounded-lg border border-border bg-card p-4 space-y-3 text-start"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        ACTION_BADGE_STYLES[entry.actionType] ?? 'bg-muted text-foreground'
                      }`}
                    >
                      {getActionLabel(entry.actionType)}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono" dir="ltr">
                      {entry.sourceChannel}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    <bdi dir="ltr">{formatTimestamp(entry.changedAt)}</bdi>
                  </span>
                </div>

                {entry.notes && (
                  <p className="text-xs text-muted-foreground">{entry.notes}</p>
                )}

                {diffKeys.length > 0 && (
                  <div className="rounded-md border border-border bg-muted/30 divide-y divide-border text-xs">
                    {diffKeys.map((field) => {
                      const hasOld = entry.oldValues && field in entry.oldValues;
                      const oldVal = hasOld ? formatAuditValue(entry.oldValues?.[field]) : null;
                      const newVal = formatAuditValue(entry.newValues?.[field]);
                      return (
                        <div
                          key={field}
                          className="px-3 py-2 grid grid-cols-1 sm:grid-cols-3 gap-2 items-center"
                        >
                          <span className="font-mono text-muted-foreground truncate" dir="ltr">
                            {field}
                          </span>
                          <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                            {hasOld && (
                              <>
                                <span className="line-through text-muted-foreground break-all">
                                  {oldVal}
                                </span>
                                <span className="text-muted-foreground" aria-hidden>
                                  →
                                </span>
                              </>
                            )}
                            <span className="font-medium text-foreground break-all">
                              {newVal}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
