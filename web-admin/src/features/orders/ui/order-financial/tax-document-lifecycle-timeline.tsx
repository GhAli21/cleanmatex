'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { Badge } from '@ui/primitives/badge';
import type { OrderTaxDocumentView } from '@features/orders/model/order-financial-summary-view';

interface TaxDocumentLifecycleTimelineProps {
  taxDocument: OrderTaxDocumentView;
  currencyCode?: string;
}

type StatusVariant = 'success' | 'warning' | 'destructive' | 'secondary' | 'info' | 'outline';

function taxDocStatusVariant(status: string | undefined): StatusVariant {
  switch (status) {
    case 'ISSUED':
      return 'success';
    case 'DRAFT':
      return 'warning';
    case 'CANCELLED':
      return 'destructive';
    case 'SUPERSEDED':
      return 'secondary';
    default:
      return 'outline';
  }
}

function Field({ label, value, isRTL }: { label: string; value: string | number | undefined | null; isRTL: boolean }) {
  if (value == null || value === '') return null;
  return (
    <div className={`flex items-start justify-between gap-2 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={`font-medium ${isRTL ? 'text-right' : 'text-left'}`}>{value}</span>
    </div>
  );
}

/**
 * Displays the Phase 7 tax-document lifecycle state: status badge, document no,
 * sequence / fiscal-year, issued-at, and cancellation info when relevant.
 * Extracted from order-tax-document-panel so it can be independently storied.
 */
export function TaxDocumentLifecycleTimeline({
  taxDocument,
  currencyCode,
}: TaxDocumentLifecycleTimelineProps) {
  const t = useTranslations('taxDocuments');
  const isRTL = useRTL();
  const doc = taxDocument;

  const typeLabel =
    doc.documentType && (t as (key: string) => string)(`type.${doc.documentType}`) !== `type.${doc.documentType}`
      ? (t as (key: string) => string)(`type.${doc.documentType}`)
      : doc.documentType ?? '—';

  const statusLabel =
    doc.status && (t as (key: string) => string)(`status.${doc.status}`) !== `status.${doc.status}`
      ? (t as (key: string) => string)(`status.${doc.status}`)
      : doc.status ?? '—';

  const issuedAtFormatted = doc.issuedAt
    ? new Date(doc.issuedAt).toLocaleString()
    : null;
  const cancelledAtFormatted = doc.cancelledAt
    ? new Date(doc.cancelledAt).toLocaleString()
    : null;

  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Badge variant={taxDocStatusVariant(doc.status)}>{statusLabel}</Badge>
        <span className="text-sm font-medium">{typeLabel}</span>
      </div>

      <div className="space-y-1.5 rounded-md border border-border bg-muted/30 p-3">
        <Field label={t('documentNo')} value={doc.documentNo} isRTL={isRTL} />
        {doc.fiscalYear != null && doc.sequenceNumber != null && (
          <Field
            label={t('sequenceNo')}
            value={`${doc.fiscalYear} / ${String(doc.sequenceNumber).padStart(6, '0')}`}
            isRTL={isRTL}
          />
        )}
        {doc.totalAmount != null && currencyCode && (
          <Field
            label={t('totalAmount')}
            value={new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: currencyCode,
              minimumFractionDigits: 3,
            }).format(doc.totalAmount)}
            isRTL={isRTL}
          />
        )}
        {doc.taxAmount != null && currencyCode && (
          <Field
            label={t('taxAmount')}
            value={new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: currencyCode,
              minimumFractionDigits: 3,
            }).format(doc.taxAmount)}
            isRTL={isRTL}
          />
        )}
        <Field label={t('issuedAt')} value={issuedAtFormatted} isRTL={isRTL} />
        <Field label={t('issuedBy')} value={doc.issuedBy} isRTL={isRTL} />
        {cancelledAtFormatted && (
          <Field label="Cancelled at" value={cancelledAtFormatted} isRTL={isRTL} />
        )}
        {doc.cancellationReason && (
          <Field label="Cancellation reason" value={doc.cancellationReason} isRTL={isRTL} />
        )}
      </div>
    </div>
  );
}
