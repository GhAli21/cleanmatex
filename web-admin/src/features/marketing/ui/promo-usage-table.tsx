'use client';

/**
 * Promo Code Usage Table Dialog
 *
 * Shows the usage log for a single promo code.
 */

import { useLocale, useTranslations } from 'next-intl';
import { useOperationalZones } from '@/lib/hooks/use-operational-zones';
import { formatInstantOrEmpty } from '@/lib/utils/operational-time';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { CmxDataTable } from '@ui/data-display';
import { usePromoUsage } from '../hooks/use-promos';
import type { PromoCodeUsage } from '@/lib/types/payment';

interface PromoUsageTableProps {
  promoCodeId: string;
  onClose: () => void;
}

/**
 *
 * @param root0
 * @param root0.promoCodeId
 * @param root0.onClose
 */
export function PromoUsageTable({ promoCodeId, onClose }: PromoUsageTableProps) {
  const t = useTranslations('marketing.promos');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { organization } = useOperationalZones('invoice', []);

  const { usage, isLoading } = usePromoUsage(promoCodeId);

  return (
    <CmxDialog open onOpenChange={(o) => !o && onClose()}>
      <CmxDialogContent className="max-w-2xl">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('usageReport')}</CmxDialogTitle>
        </CmxDialogHeader>
        <CmxDataTable
          isLoading={isLoading}
          columns={[
            {
              key: 'used_at',
              header: tCommon('date'),
              render: (row: PromoCodeUsage) =>
                formatInstantOrEmpty(row.used_at, organization, locale === 'ar' ? 'ar' : 'en') || '—',
            },
            {
              key: 'order_id',
              header: tCommon('orders'),
              render: (row: PromoCodeUsage) => row.order_id ?? '—',
            },
            {
              key: 'discount_amount',
              header: t('fields.discountValue'),
              render: (row: PromoCodeUsage) => row.discount_amount.toFixed(3),
            },
            {
              key: 'order_total_before',
              header: 'Order Total',
              render: (row: PromoCodeUsage) => row.order_total_before.toFixed(3),
            },
            {
              key: 'used_by',
              header: 'Used By',
              render: (row: PromoCodeUsage) => row.used_by ?? '—',
            },
          ]}
          data={usage}
          totalCount={usage.length}
          currentPage={1}
          pageSize={usage.length || 10}
          onPageChange={() => {}}
        />
      </CmxDialogContent>
    </CmxDialog>
  );
}
