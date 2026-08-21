'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink, FileCheck2, ImageIcon, ReceiptText, UserRound } from 'lucide-react';
import { CmxButton, CmxSpinner } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { CmxStatusBadge } from '@ui/feedback';
import { useDeliveryProofAudit } from '@features/delivery/hooks/use-delivery-proof-audit';
import type { DeliveryProofEvidenceLink } from '@features/delivery/model/delivery-proof-audit';

interface DeliveryProofAuditCardProps {
  orderId: string;
}

function formatAuditDate(value: string | null, locale: string): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function EvidenceLink({
  evidence,
  children,
}: {
  evidence: DeliveryProofEvidenceLink;
  children: ReactNode;
}) {
  return (
    <CmxButton asChild size="sm" variant="outline">
      <Link href={evidence.url} target="_blank" rel="noreferrer">
        <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
        {children}
      </Link>
    </CmxButton>
  );
}

/**
 * Reusable audit surface for authorized delivery staff. Evidence links are
 * short-lived API output and are deliberately not persisted in client state.
 */
export function DeliveryProofAuditCard({ orderId }: DeliveryProofAuditCardProps) {
  const t = useTranslations('workflow.delivery.audit');
  const locale = useLocale();
  const { data: audit, error, isFetching, isLoading, refetch } = useDeliveryProofAudit(orderId);

  return (
    <CmxCard>
      <CmxCardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CmxCardTitle className="flex items-center gap-2 text-base">
              <FileCheck2 className="h-5 w-5 text-primary" aria-hidden="true" />
              {t('title')}
            </CmxCardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
          </div>
          {audit ? (
            <div className="flex items-center gap-2">
              <CmxStatusBadge
                label={t(`payment.${audit.order.paymentState}`)}
                variant={audit.order.paymentState === 'settled' ? 'success' : 'warning'}
              />
              <CmxButton size="sm" variant="outline" loading={isFetching} onClick={() => { void refetch(); }}>
                {t('refreshEvidence')}
              </CmxButton>
            </div>
          ) : null}
        </div>
      </CmxCardHeader>
      <CmxCardContent>
        {isLoading ? (
          <div className="flex min-h-24 items-center justify-center"><CmxSpinner /></div>
        ) : error instanceof Error ? (
          <p className="text-sm text-destructive">{t('loadFailed')}</p>
        ) : !audit || audit.entries.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t('emptyTitle')}</p>
            <p className="mt-1">{audit?.deliveryStopCount ? t('emptyPending') : t('emptyNoDelivery')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('workflowOutcome')}</p>
                <p className="mt-1 font-semibold">{audit.order.workflowOutcome ?? t('unknown')}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('payment.balance')}</p>
                <p className="mt-1 font-semibold">
                  {audit.order.outstandingAmount.toFixed(3)} {audit.order.currencyCode ?? ''}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('handoverCount')}</p>
                <p className="mt-1 font-semibold">{audit.entries.length}</p>
              </div>
            </div>

            {audit.entries.map((entry) => (
              <div key={entry.podId} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{t('handover', { sequence: entry.stopSequence })}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('method')}: {entry.podMethodCode}
                    </p>
                  </div>
                  <CmxStatusBadge
                    label={t(`stopStatus.${entry.stopStatus}`, { default: entry.stopStatus })}
                    variant={entry.stopStatus === 'delivered' ? 'success' : 'processing'}
                  />
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">{t('deliveredAt')}</dt>
                    <dd className="mt-1 font-medium">{formatAuditDate(entry.deliveredAt ?? entry.verifiedAt, locale) ?? t('notRecorded')}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-muted-foreground"><UserRound className="h-4 w-4" aria-hidden="true" />{t('deliveredBy')}</dt>
                    <dd className="mt-1 font-medium">{entry.deliveredBy ?? t('notRecorded')}</dd>
                  </div>
                </dl>
                {entry.notes ? (
                  <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm">
                    <p className="font-medium">{t('notes')}</p>
                    <p className="mt-1 text-muted-foreground">{entry.notes}</p>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {entry.signature ? <EvidenceLink evidence={entry.signature}>{t('openSignature')}</EvidenceLink> : null}
                  {entry.photos.map((photo, index) => (
                    <EvidenceLink key={`${entry.podId}-${index}`} evidence={photo}>
                      <ImageIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t('openPhoto', { count: index + 1 })}
                    </EvidenceLink>
                  ))}
                  {!entry.signature && entry.photos.length === 0 ? (
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <ReceiptText className="h-4 w-4" aria-hidden="true" />
                      {t('noEvidenceLink')}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CmxCardContent>
    </CmxCard>
  );
}
