'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ExternalLink, FileCheck2, MapPin, ShieldCheck, WalletCards } from 'lucide-react';
import { Alert, CmxButton } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { CmxStatusBadge } from '@ui/feedback';
import type { DeliveryStopView } from '@/lib/services/delivery/delivery-route-query.service';

interface DeliveryStopDetailProps {
  stop: DeliveryStopView;
}

function mapHref(stop: DeliveryStopView): string {
  const query = stop.latitude !== null && stop.longitude !== null
    ? `${stop.latitude},${stop.longitude}`
    : stop.address;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Shows all delivery completion gates before a staff member reaches the
 * command. The command remains server-controlled and is never a screen-local
 * status write.
 */
export function DeliveryStopDetail({ stop }: DeliveryStopDetailProps) {
  const t = useTranslations('workflow.delivery');
  const hasBalance = stop.order.outstandingAmount > 0.001;
  const isDelivered = stop.statusCode === 'delivered';

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-5">
        <CmxCard>
          <CmxCardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{t('stopDetail.stopNumber', { sequence: stop.sequence })}</p>
                <CmxCardTitle className="mt-1 text-xl">{stop.order.orderNo}</CmxCardTitle>
              </div>
              <CmxStatusBadge
                label={t(`stopStatus.${stop.statusCode}`, { default: stop.statusCode })}
                variant={isDelivered ? 'success' : 'processing'}
              />
            </div>
          </CmxCardHeader>
          <CmxCardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('stopDetail.customer')}</p>
                <p className="mt-1 font-medium">{stop.contactName ?? stop.order.customerName ?? t('fallbacks.unknownCustomer')}</p>
                <p className="text-sm text-muted-foreground">{stop.contactPhone ?? stop.order.customerPhone ?? t('fallbacks.noPhone')}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('stopDetail.orderState')}</p>
                <p className="mt-1 font-medium">{stop.order.currentStatus ?? t('stopDetail.unknownState')}</p>
                <p className="text-sm text-muted-foreground">{t('stopDetail.items', { count: stop.order.totalItems })}</p>
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="flex items-start gap-2 text-sm font-medium">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {stop.address}
              </p>
              {stop.notes ? <p className="mt-2 text-sm text-muted-foreground">{stop.notes}</p> : null}
              <CmxButton className="mt-3" size="sm" variant="outline" asChild>
                <Link href={mapHref(stop)} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('manifest.openNavigation')}
                </Link>
              </CmxButton>
            </div>
          </CmxCardContent>
        </CmxCard>

        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle className="flex items-center gap-2 text-base">
              <FileCheck2 className="h-5 w-5 text-primary" aria-hidden="true" />
              {t('proof.title')}
            </CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent>
            {stop.proof ? (
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">{t('proof.method')}:</span> {stop.proof.methodCode}</p>
                <p><span className="text-muted-foreground">{t('proof.verifiedAt')}:</span> {stop.proof.verifiedAt ? new Date(stop.proof.verifiedAt).toLocaleString() : t('proof.notVerified')}</p>
                <p><span className="text-muted-foreground">{t('proof.photos')}:</span> {stop.proof.photoUrls.length}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('proof.none')}</p>
            )}
          </CmxCardContent>
        </CmxCard>
      </div>

      <aside className="space-y-5">
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle className="flex items-center gap-2 text-base">
              <WalletCards className="h-5 w-5 text-primary" aria-hidden="true" />
              {t('completion.paymentGate')}
            </CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="space-y-3">
            <p className={hasBalance ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>
              {hasBalance
                ? t('completion.balanceDue', { amount: `${stop.order.outstandingAmount.toFixed(3)} ${stop.order.currencyCode ?? ''}`.trim() })
                : t('completion.paymentClear')}
            </p>
            {hasBalance ? (
              <CmxButton className="w-full" asChild>
                <Link href={`/dashboard/orders/${stop.order.id}?tab=payments-credits`}>
                  {t('completion.collectPayment')}
                </Link>
              </CmxButton>
            ) : null}
          </CmxCardContent>
        </CmxCard>

        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
              {t('completion.title')}
            </CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="space-y-3">
            <Alert variant="info" title={t('completion.holdTitle')} message={t('completion.holdDescription')} />
            <CmxButton className="w-full" disabled>
              {isDelivered ? t('completion.delivered') : t('completion.confirm')}
            </CmxButton>
          </CmxCardContent>
        </CmxCard>
      </aside>
    </div>
  );
}
