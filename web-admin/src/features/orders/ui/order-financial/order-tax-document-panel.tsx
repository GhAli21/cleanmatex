'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useHasPermission } from '@/lib/hooks/usePermissions';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives/cmx-button';
import type { OrderFinancialSummaryViewModel } from '@features/orders/model/order-financial-summary-view';
import { TaxDocumentLifecycleTimeline } from './tax-document-lifecycle-timeline';
import { IssueTaxDocumentDialog } from './issue-tax-document-dialog';

/**
 * Supplies the order-scoped financial facts required to guide an operator to
 * the temporary receipt while fiscal documentation is unavailable.
 */
interface OrderTaxDocumentPanelProps {
  viewModel: OrderFinancialSummaryViewModel;
}

/**
 * Keeps the tax-document status and its temporary receipt fallback together,
 * so operators can continue from the unavailable fiscal document to the
 * correct order voucher without losing context.
 *
 * @param root0 - The financial view model for the current order.
 * @param root0.viewModel - Provides the canonical order ID and tax-document state.
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
          {t.rich('taxDocumentHint', {
            vouchers: (chunks) => (
              <Link
                href={`/dashboard/orders/${orderId}?tab=vouchers`}
                className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </CmxCardContent>
      <IssueTaxDocumentDialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen} orderId={orderId} />
    </CmxCard>
  );
}
