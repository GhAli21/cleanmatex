'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import type { OrderFinancialSummaryViewModel } from '@features/orders/model/order-financial-summary-view';

interface OrderTaxDocumentPanelProps {
  viewModel: OrderFinancialSummaryViewModel;
}

export function OrderTaxDocumentPanel({ viewModel }: OrderTaxDocumentPanelProps) {
  const t = useTranslations('orders.detail.financial');
  const isRTL = useRTL();
  const tax = viewModel.taxDocument;

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{t('section.taxDocument')}</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-2 text-sm">
        {!tax?.documentNo ? (
          <p className={`text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('taxDocumentNotAvailable')}
          </p>
        ) : (
          <>
            <p className={isRTL ? 'text-right' : 'text-left'}>
              <span className="text-muted-foreground">{t('taxDocumentType')}: </span>
              {tax.documentType ?? '—'}
            </p>
            <p className={isRTL ? 'text-right' : 'text-left'}>
              <span className="text-muted-foreground">{t('taxDocumentNo')}: </span>
              {tax.documentNo}
            </p>
            <p className={isRTL ? 'text-right' : 'text-left'}>
              <span className="text-muted-foreground">{t('authorityStatus')}: </span>
              {tax.authorityStatus ?? tax.status ?? '—'}
            </p>
          </>
        )}
        <p className={`text-xs text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('taxDocumentHint')}
        </p>
      </CmxCardContent>
    </CmxCard>
  );
}
