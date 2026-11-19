/**
 * Processing Header Component
 * Full-width operational header with New Order CTA, Refresh control, and Barcode Scan bar.
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { CmxButton } from '@ui/primitives';
import { CmxScanInput, type CmxScanStatus } from '@ui/forms';
import { cn } from '@/lib/utils';

interface ProcessingHeaderProps {
  onRefresh: () => void | Promise<void>;
  isRefreshing?: boolean;
  totalOrders?: number;
  onScanSearch?: (value: string) => void | Promise<unknown>;
  scanStatus?: CmxScanStatus | null;
}

/**
 * Top header bar for `/dashboard/processing` with quick scan/search and primary actions.
 * @param props Header actions and optional scan handler.
 */
export function ProcessingHeader(props: ProcessingHeaderProps) {
  const {
    onRefresh,
    isRefreshing = false,
    totalOrders,
    onScanSearch,
    scanStatus,
  } = props;
  const t = useTranslations('processing');
  const tOrders = useTranslations('orders');
  const [localScanStatus, setLocalScanStatus] = useState<CmxScanStatus | null>(null);

  const handleRefresh = async () => {
    await onRefresh();
  };

  const handleScan = async (value: string) => {
    setLocalScanStatus({
      tone: 'info',
      message: t('scan.matched', { query: value }),
    });
    await onScanSearch?.(value);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t('title')}
            </h1>
            {typeof totalOrders === 'number' && (
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                {totalOrders}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <CmxButton variant="primary" size="md" asChild>
            <Link href="/dashboard/orders/new">
              <Plus className="me-1.5 h-4 w-4" aria-hidden />
              {tOrders('newOrder')}
            </Link>
          </CmxButton>

          <CmxButton
            type="button"
            variant="outline"
            size="md"
            onClick={handleRefresh}
            loading={isRefreshing}
            aria-label={t('refresh')}
            title={t('refresh')}
          >
            {!isRefreshing && (
              <RefreshCw
                className={cn('me-1.5 h-4 w-4', isRefreshing && 'animate-spin')}
                aria-hidden
              />
            )}
            <span className="hidden sm:inline">{t('refresh')}</span>
          </CmxButton>
        </div>
      </div>

      {onScanSearch && (
        <div className="rounded-lg border border-border bg-card p-3">
          <CmxScanInput
            label={t('scan.label')}
            placeholder={t('scan.placeholder')}
            submitLabel={t('scan.submit')}
            emptyMessage={t('scan.empty')}
            status={scanStatus ?? localScanStatus}
            onScan={handleScan}
          />
        </div>
      )}
    </div>
  );
}
