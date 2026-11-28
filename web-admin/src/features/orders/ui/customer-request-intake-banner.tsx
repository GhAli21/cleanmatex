'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import {
  fetchStaffOrderRequestById,
  type StaffOrderRequestItem,
} from '@features/orders/api/order-requests-api';
import { CmxButton, CmxCard, CmxCardContent, CmxSkeleton } from '@ui/primitives';
import { CmxCodeChip } from '@ui/data-display';
import { CmxStatusBadge, CmxSummaryMessage } from '@ui/feedback';

/**
 * Customer Quick Drop intake context strip rendered at the top of POS New Order
 * when launched via `/dashboard/orders/new?requestId=<uuid>`.
 * Surfaces customer-declared items (both catalog-linked and free-text hints),
 * pickup/delivery address snapshots, and already-converted safety guards.
 */
export function CustomerRequestIntakeBanner() {
  const t = useTranslations('orders.customerRequests');
  const searchParams = useSearchParams();
  const requestId = searchParams.get('requestId');
  const [state, setState] = useState<{
    loadedId: string | null;
    request: StaffOrderRequestItem | null;
    error: string | null;
  }>({ loadedId: null, request: null, error: null });

  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;

    fetchStaffOrderRequestById(requestId)
      .then((detail) => {
        if (!cancelled) setState({ loadedId: requestId, request: detail, error: null });
      })
      .catch(() => {
        if (!cancelled) setState({ loadedId: requestId, request: null, error: t('loadError') });
      });

    return () => {
      cancelled = true;
    };
  }, [requestId, t]);

  if (!requestId) return null;

  const loading = state.loadedId !== requestId;
  const request = state.loadedId === requestId ? state.request : null;
  const error = state.loadedId === requestId ? state.error : null;

  if (loading) {
    return (
      <div className="px-4 pt-3">
        <CmxSkeleton className="h-20 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 pt-3">
        <CmxSummaryMessage type="error" message={error} />
      </div>
    );
  }

  if (!request) return null;

  if (request.requestStatusCode === 'CONVERTED' && request.linkedOrderId && request.linkedOrderNo) {
    return (
      <div className="px-4 pt-3">
        <CmxSummaryMessage
          type="warning"
          message={t('intakeBanner.alreadyConverted', { orderNo: request.linkedOrderNo })}
        />
        <div className="mt-2">
          <CmxButton variant="outline" size="sm" asChild>
            <Link href={`/dashboard/orders/${request.linkedOrderId}`}>
              {t('actions.viewLinkedOrder', { orderNo: request.linkedOrderNo })}
            </Link>
          </CmxButton>
        </div>
      </div>
    );
  }

  if (request.requestStatusCode === 'DECLINED' || request.requestStatusCode === 'CANCELLED') {
    return (
      <div className="px-4 pt-3">
        <CmxSummaryMessage
          type="warning"
          message={t('intakeBanner.closedWarning', { status: request.requestStatusCode })}
        />
      </div>
    );
  }

  const pickupDesc =
    typeof request.collectionAddressSnapshot?.description === 'string'
      ? request.collectionAddressSnapshot.description
      : null;
  const deliveryDesc =
    typeof request.deliveryAddressSnapshot?.description === 'string'
      ? request.deliveryAddressSnapshot.description
      : null;

  return (
    <div className="px-4 pt-3">
      <CmxCard className="border-info-border bg-info-bg/40">
        <CmxCardContent className="p-3.5 space-y-2 text-start">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {t('intakeBanner.title')}
              </span>
              <CmxCodeChip code={request.requestNo} />
              <CmxStatusBadge tone="info" appearance="soft">
                {t('bagsAndPieces', {
                  bags: request.estimatedTotalBags,
                  pieces: request.estimatedTotalPieces,
                })}
              </CmxStatusBadge>
            </div>
            {request.customerName ? (
              <span className="text-xs font-medium text-foreground">
                {request.customerName}
                {request.customerMobile ? (
                  <span dir="ltr" className="ms-2 text-muted-foreground tabular-nums">
                    {request.customerMobile}
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">{t('intakeBanner.verifyHint')}</p>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {pickupDesc ? (
              <span>
                <strong className="text-foreground">{t('intakeBanner.pickupAddress')}:</strong>{' '}
                {pickupDesc}
              </span>
            ) : null}
            {deliveryDesc ? (
              <span>
                <strong className="text-foreground">{t('intakeBanner.deliveryAddress')}:</strong>{' '}
                {deliveryDesc}
              </span>
            ) : null}
            {request.customerNotes ? (
              <span>
                <strong className="text-foreground">{t('intakeBanner.customerNotes')}:</strong>{' '}
                {request.customerNotes}
              </span>
            ) : null}
          </div>

          {request.lines.length > 0 ? (
            <div className="pt-1 space-y-1">
              <div className="text-xs font-semibold text-foreground">
                {t('intakeBanner.declaredHintsTitle')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {request.lines.map((line) => (
                  <CmxStatusBadge
                    key={line.id}
                    tone={line.productId ? 'brand' : 'neutral'}
                    appearance="soft"
                  >
                    {line.quantity}× {line.itemName} (
                    {line.productId
                      ? t('intakeBanner.catalogMatched')
                      : t('intakeBanner.freeTextHint')}
                    )
                  </CmxStatusBadge>
                ))}
              </div>
            </div>
          ) : null}
        </CmxCardContent>
      </CmxCard>
    </div>
  );
}
