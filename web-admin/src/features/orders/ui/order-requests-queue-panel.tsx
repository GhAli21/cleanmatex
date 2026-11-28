'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { RefreshCw, Inbox, ArrowRight } from 'lucide-react';

import {
  fetchStaffOrderRequests,
  triageStaffOrderRequestApi,
  type StaffOrderRequestItem,
} from '@features/orders/api/order-requests-api';
import { CmxButton, CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle, CmxSkeleton } from '@ui/primitives';
import { CmxCodeChip, CmxEmptyState } from '@ui/data-display';
import { cmxMessage, CmxConfirmDialog, CmxStatusBadge, CmxSummaryMessage } from '@ui/feedback';

type StatusTone = 'info' | 'brand' | 'warning' | 'success' | 'danger' | 'neutral';

function mapRequestStatusTone(statusCode: string): StatusTone {
  switch (statusCode) {
    case 'SUBMITTED':
      return 'info';
    case 'IN_REVIEW':
      return 'brand';
    case 'AWAITING_CUSTOMER':
      return 'warning';
    case 'CONVERTED':
      return 'success';
    case 'DECLINED':
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
}

/**
 * Staff queue panel for reviewing customer Fast Quick Drop requests and
 * launching atomic POS New Order conversion (`/dashboard/orders/new?requestId=...`).
 */
export function OrderRequestsQueuePanel() {
  const t = useTranslations('orders.customerRequests');
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<StaffOrderRequestItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declineTarget, setDeclineTarget] = useState<StaffOrderRequestItem | null>(null);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchStaffOrderRequests({ page: 1, limit: 20 });
      setItems(res.items);
      setPendingCount(res.pendingCount);
    } catch {
      setErrorMessage(t('loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleTriage = async (
    item: StaffOrderRequestItem,
    statusCode: 'IN_REVIEW' | 'AWAITING_CUSTOMER' | 'DECLINED',
  ) => {
    setBusyId(item.id);
    try {
      await triageStaffOrderRequestApi(item.id, { statusCode });
      if (statusCode === 'IN_REVIEW') cmxMessage.success(t('messages.markedInReview'));
      if (statusCode === 'AWAITING_CUSTOMER') cmxMessage.info(t('messages.askedCustomer'));
      if (statusCode === 'DECLINED') cmxMessage.success(t('messages.declined'));
      await loadRequests();
    } catch {
      cmxMessage.error(t('messages.actionFailed'));
    } finally {
      setBusyId(null);
      setDeclineTarget(null);
    }
  };

  return (
    <CmxCard className="mb-4">
      <CmxCardHeader className="flex flex-row items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-2 text-start">
          <Inbox className="h-4 w-4 text-primary-text" />
          <CmxCardTitle className="text-sm font-semibold">
            {t('toggleQueue', { count: pendingCount })}
          </CmxCardTitle>
          {pendingCount > 0 ? (
            <CmxStatusBadge tone="warning" appearance="soft">
              {pendingCount}
            </CmxStatusBadge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <CmxButton
            variant="ghost"
            size="sm"
            onClick={() => void loadRequests()}
            disabled={isLoading}
            aria-label={t('refresh')}
          >
            <RefreshCw className="h-4 w-4" />
          </CmxButton>
          <CmxButton
            variant="outline"
            size="sm"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? '−' : '+'}
          </CmxButton>
        </div>
      </CmxCardHeader>

      {expanded ? (
        <CmxCardContent className="space-y-3 pt-0">
          <p className="text-xs text-muted-foreground text-start">{t('subtitle')}</p>

          {isLoading ? (
            <div className="space-y-2">
              <CmxSkeleton className="h-16 w-full" />
              <CmxSkeleton className="h-16 w-full" />
            </div>
          ) : errorMessage ? (
            <CmxSummaryMessage type="error" message={errorMessage} />
          ) : items.length === 0 ? (
            <CmxEmptyState
              title={t('emptyTitle')}
              description={t('emptyDescription')}
            />
          ) : (
            <div className="space-y-2.5">
              {items.map((item) => {
                const isConvertible =
                  item.requestStatusCode === 'SUBMITTED' ||
                  item.requestStatusCode === 'IN_REVIEW' ||
                  item.requestStatusCode === 'AWAITING_CUSTOMER';
                const statusKey = `status.${item.requestStatusCode}` as const;
                const colKey = `collection.${item.collectionMethodCode}` as const;
                const delKey = `delivery.${item.deliveryModeCode}` as const;

                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border bg-background p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1 text-start">
                      <div className="flex flex-wrap items-center gap-2">
                        <CmxCodeChip code={item.requestNo} />
                        <CmxStatusBadge
                          tone={mapRequestStatusTone(item.requestStatusCode)}
                          appearance="soft"
                        >
                          {t(statusKey)}
                        </CmxStatusBadge>
                        {item.customerName ? (
                          <span className="text-sm font-medium text-foreground">
                            {item.customerName}
                          </span>
                        ) : null}
                        {item.customerMobile ? (
                          <span dir="ltr" className="text-xs text-muted-foreground tabular-nums">
                            {item.customerMobile}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{t(colKey)}</span>
                        <span>•</span>
                        <span>{t(delKey)}</span>
                        <span>•</span>
                        <span>
                          {t('bagsAndPieces', {
                            bags: item.estimatedTotalBags,
                            pieces: item.estimatedTotalPieces,
                          })}
                        </span>
                        {item.lines.length > 0 ? (
                          <>
                            <span>•</span>
                            <span>{t('declaredItemsCount', { count: item.lines.length })}</span>
                          </>
                        ) : null}
                      </div>

                      {item.customerNotes ? (
                        <p className="text-xs text-muted-foreground">{item.customerNotes}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {item.linkedOrderId && item.linkedOrderNo ? (
                        <CmxButton variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/orders/${item.linkedOrderId}`}>
                            {t('actions.viewLinkedOrder', { orderNo: item.linkedOrderNo })}
                          </Link>
                        </CmxButton>
                      ) : isConvertible ? (
                        <>
                          {item.requestStatusCode === 'SUBMITTED' ? (
                            <CmxButton
                              variant="outline"
                              size="sm"
                              disabled={busyId === item.id}
                              onClick={() => void handleTriage(item, 'IN_REVIEW')}
                            >
                              {t('actions.markInReview')}
                            </CmxButton>
                          ) : null}
                          <CmxButton
                            variant="ghost"
                            size="sm"
                            disabled={busyId === item.id}
                            onClick={() => void handleTriage(item, 'AWAITING_CUSTOMER')}
                          >
                            {t('actions.askCustomer')}
                          </CmxButton>
                          <CmxButton
                            variant="ghost"
                            size="sm"
                            disabled={busyId === item.id}
                            onClick={() => setDeclineTarget(item)}
                          >
                            {t('actions.decline')}
                          </CmxButton>
                          <CmxButton variant="primary" size="sm" asChild>
                            <Link href={`/dashboard/orders/new?requestId=${item.id}`}>
                              <span>{t('actions.convertInPos')}</span>
                              <ArrowRight className="ms-1 h-3.5 w-3.5 rtl:rotate-180" />
                            </Link>
                          </CmxButton>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CmxCardContent>
      ) : null}

      <CmxConfirmDialog
        open={Boolean(declineTarget)}
        onCancel={() => setDeclineTarget(null)}
        title={t('confirmDeclineTitle')}
        description={t('confirmDeclineDescription')}
        onConfirm={() => {
          if (declineTarget) {
            void handleTriage(declineTarget, 'DECLINED');
          }
        }}
      />
    </CmxCard>
  );
}
