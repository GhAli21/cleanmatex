'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useHasPermission } from '@/lib/hooks/usePermissions';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives/cmx-button';
import type { OrderFinancialSummaryViewModel } from '@features/orders/model/order-financial-summary-view';
import { TaxDocumentLifecycleTimeline } from './tax-document-lifecycle-timeline';
import { IssueTaxDocumentDialog } from './issue-tax-document-dialog';

interface OrderTaxDocumentPanelProps {
  viewModel: OrderFinancialSummaryViewModel;
}

/**
 *
 * @param root0
 * @param root0.viewModel
 */
export function OrderTaxDocumentPanel({ viewModel }: OrderTaxDocumentPanelProps) {
  const t = useTranslations('orders.detail.financial');
  const tTax = useTranslations('taxDocuments');
  const isRTL = useRTL();
  const { taxDocument, currencyCode, orderId } = viewModel;
  const canIssue = useHasPermission('tax_document', 'issue');
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const hasDocument = Boolean(taxDocument?.documentNo || taxDocument?.id);

  return (
    <CmxCard>
      <CmxCardHeader className="flex-row items-center justify-between space-y-0">
        <CmxCardTitle>{t('section.taxDocument')}</CmxCardTitle>
        {!hasDocument && canIssue && (
          <CmxButton size="sm" variant="outline" onClick={() => setIssueDialogOpen(true)}>
            {tTax('actions.issue')}
          </CmxButton>
        )}
      </CmxCardHeader>
      <CmxCardContent className="space-y-3 text-sm">
        {!hasDocument ? (
          <p className={`text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('taxDocumentNotAvailable')}
          </p>
        ) : (
          <TaxDocumentLifecycleTimeline
            taxDocument={taxDocument}
            currencyCode={currencyCode}
            orderId={orderId}
          />
        )}
        <p className={`text-xs text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('taxDocumentHint')}
        </p>
      </CmxCardContent>
      <IssueTaxDocumentDialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen} orderId={orderId} />
    </CmxCard>
  );
}
