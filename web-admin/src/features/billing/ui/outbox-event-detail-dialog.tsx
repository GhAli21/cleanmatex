'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxStatusBadge } from '@ui/feedback/cmx-status-badge';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import type { OutboxMonitorEventDetail, OutboxRelatedKind, OutboxStatus } from '../model/outbox-types';

const STATUS_VARIANT: Record<string, 'info' | 'processing' | 'success' | 'warning' | 'error' | 'default'> = {
  PENDING: 'info',
  PROCESSING: 'processing',
  PROCESSED: 'success',
  FAILED: 'warning',
  DEAD_LETTERED: 'error',
};

function formatDate(iso: string | null, locale: string) {
  if (!iso) return '—';
  const localeTag = locale.startsWith('ar') ? 'ar' : 'en-GB';
  return new Date(iso).toLocaleString(localeTag, { dateStyle: 'short', timeStyle: 'short' });
}

function relatedKindKey(kind: OutboxRelatedKind): string {
  switch (kind) {
    case 'order':
      return 'links.order';
    case 'invoice':
      return 'links.invoice';
    case 'voucher':
      return 'links.voucher';
    case 'pending_payments':
      return 'links.pendingPayments';
    case 'refunds':
      return 'links.refunds';
    case 'customer':
      return 'links.customer';
    default:
      return 'links.record';
  }
}

interface OutboxEventDetailDialogProps {
  event: OutboxMonitorEventDetail | null;
  loading: boolean;
  retrying: boolean;
  canRetry: boolean;
  onClose: () => void;
  onRetry: (eventId: string) => void;
  onOpenRelated: (eventId: string) => void;
  onCopyId: (id: string) => void;
}

export function OutboxEventDetailDialog({
  event,
  loading,
  retrying,
  canRetry,
  onClose,
  onRetry,
  onOpenRelated,
  onCopyId,
}: OutboxEventDetailDialogProps) {
  const t = useTranslations('billing.outboxMonitor');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const payloadText = useMemo(() => {
    if (!event) return '';
    try {
      return JSON.stringify(event.payload, null, 2);
    } catch {
      return String(event.payload);
    }
  }, [event]);

  return (
    <CmxDialog open={event !== null || loading} onOpenChange={(open) => { if (!open) onClose(); }}>
      <CmxDialogContent className="max-w-3xl" scrollBody>
        <CmxDialogHeader>
          <CmxDialogTitle>{t('detail.title')}</CmxDialogTitle>
          <CmxDialogDescription>
            {event ? event.event_type : t('detail.loading')}
          </CmxDialogDescription>
        </CmxDialogHeader>

        {loading && !event ? (
          <p className="text-sm text-muted-foreground">{t('detail.loading')}</p>
        ) : event ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <CmxStatusBadge
                label={t(`statusLabels.${event.status as OutboxStatus}`)}
                variant={STATUS_VARIANT[event.status] ?? 'default'}
                size="sm"
                pulse={event.status === 'PROCESSING'}
              />
              {event.isStuck ? (
                <CmxStatusBadge label={t('stuckBadge')} variant="warning" size="sm" />
              ) : null}
              {!event.hasConsumer ? (
                <CmxStatusBadge label={t('handlers.none')} variant="outline" size="sm" />
              ) : null}
            </div>

            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">{t('columns.eventType')}</dt>
                <dd className="font-mono text-xs">{event.event_type}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('columns.handlers')}</dt>
                <dd className="text-xs">
                  {event.handlers.length > 0
                    ? event.handlers.map((handler) => t(`handlers.${handler}`)).join(', ')
                    : t('handlers.none')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('columns.aggregate')}</dt>
                <dd className="font-mono text-xs break-all">
                  {event.aggregate_type} / {event.relatedLabel ?? event.aggregate_id}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('detail.eventId')}</dt>
                <dd className="flex items-center gap-2">
                  <span className="font-mono text-xs break-all">{event.id}</span>
                  <CmxButton type="button" variant="ghost" size="xs" onClick={() => onCopyId(event.id)}>
                    {t('copyId')}
                  </CmxButton>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('columns.attempts')}</dt>
                <dd className="tabular-nums">{event.attempts}/{event.max_attempts}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('columns.age')}</dt>
                <dd>{t('ageMinutes', { count: event.ageMinutes })}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('columns.createdAt')}</dt>
                <dd>{formatDate(event.created_at, locale)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('columns.nextRetryAt')}</dt>
                <dd>{formatDate(event.next_retry_at, locale)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('columns.processedAt')}</dt>
                <dd>{formatDate(event.processed_at, locale)}</dd>
              </div>
            </dl>

            {event.relatedLinks.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{t('detail.relatedRecords')}</p>
                <div className="flex flex-wrap gap-2">
                  {event.relatedLinks.map((link) => (
                    <CmxButton key={`${link.kind}-${link.href}`} asChild variant="outline" size="sm">
                      <Link href={link.href}>
                        {t(relatedKindKey(link.kind))}
                        {link.kind === 'order' || link.kind === 'invoice' || link.kind === 'voucher'
                          ? ` · ${link.label}`
                          : ''}
                      </Link>
                    </CmxButton>
                  ))}
                </div>
              </div>
            ) : null}

            {event.error_message ? (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t('columns.error')}</p>
                <p className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-3 text-xs">
                  {event.error_message}
                </p>
              </div>
            ) : null}

            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t('detail.payload')}</p>
              <pre className="max-h-56 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-[11px] leading-5">
                {payloadText || '—'}
              </pre>
            </div>

            {event.relatedEvents.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{t('detail.siblingEvents')}</p>
                <ul className="space-y-1">
                  {event.relatedEvents.map((sibling) => (
                    <li key={sibling.id}>
                      <CmxButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto w-full justify-start gap-2 py-1 text-start"
                        onClick={() => onOpenRelated(sibling.id)}
                      >
                        <span className="font-mono text-xs">{sibling.event_type}</span>
                        <CmxStatusBadge
                          label={t(`statusLabels.${sibling.status as OutboxStatus}`)}
                          variant={STATUS_VARIANT[sibling.status] ?? 'default'}
                          size="sm"
                        />
                        <span className="text-xs text-muted-foreground">{formatDate(sibling.created_at, locale)}</span>
                      </CmxButton>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <CmxDialogFooter>
          <CmxButton type="button" variant="outline" onClick={onClose}>
            {tCommon('close')}
          </CmxButton>
          {event?.retryable && canRetry ? (
            <CmxButton
              type="button"
              variant="primary"
              disabled={retrying}
              onClick={() => onRetry(event.id)}
            >
              {retrying ? t('retrying') : t('retry')}
            </CmxButton>
          ) : null}
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
