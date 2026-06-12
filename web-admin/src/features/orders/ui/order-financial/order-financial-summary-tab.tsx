'use client';

import { OrderValueBreakdown } from './order-value-breakdown';
import { OrderSettlementSummary } from './order-settlement-summary';
import { OrderReceivableCollectionPanel } from './order-receivable-collection-panel';
import { OrderTaxDocumentPanel } from './order-tax-document-panel';
import { OrderFinancialWarningBanner } from './order-financial-warning-banner';
import type { OrderFinancialSummaryViewModel } from '@features/orders/model/order-financial-summary-view';

interface OrderFinancialSummaryTabProps {
  viewModel: OrderFinancialSummaryViewModel;
}

export function OrderFinancialSummaryTab({ viewModel }: OrderFinancialSummaryTabProps) {
  return (
    <div className="space-y-4">
      <OrderFinancialWarningBanner warnings={viewModel.warnings} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OrderValueBreakdown viewModel={viewModel} />
        <div className="space-y-4">
          <OrderSettlementSummary viewModel={viewModel} />
          <OrderReceivableCollectionPanel
            viewModel={viewModel}
            orderId={viewModel.orderId}
            customerId={viewModel.customerId}
            branchId={viewModel.branchId}
          />
          <OrderTaxDocumentPanel viewModel={viewModel} />
        </div>
      </div>
    </div>
  );
}
