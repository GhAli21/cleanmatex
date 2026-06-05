'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import type { OrderFinancialSummaryViewModel } from '@features/orders/model/order-financial-summary-view';
import { TaxDocumentLifecycleTimeline } from './tax-document-lifecycle-timeline';

interface OrderTaxDocumentPanelProps {
  viewModel: OrderFinancialSummaryViewModel;
}

export function OrderTaxDocumentPanel({ viewModel }: OrderTaxDocumentPanelProps) {
  const t = useTranslations('orders.detail.financial');
  const isRTL = useRTL();
  const { taxDocument, currencyCode } = viewModel;

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{t('section.taxDocument')}</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-3 text-sm">
        {!taxDocument?.documentNo && !taxDocument?.id ? (
          <p className={`text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('taxDocumentNotAvailable')}
          </p>
        ) : (
          <TaxDocumentLifecycleTimeline
            taxDocument={taxDocument}
            currencyCode={currencyCode}
          />
        )}
        <p className={`text-xs text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('taxDocumentHint')}
        </p>
      </CmxCardContent>
    </CmxCard>
  );
}
