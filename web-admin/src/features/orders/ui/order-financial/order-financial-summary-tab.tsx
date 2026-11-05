'use client';

import { OrderFinancialView } from '@features/orders/order-fin-view/ui/order-financial-view';
import { OrderReceivableCollectionPanel } from './order-receivable-collection-panel';
import { OrderTaxDocumentPanel } from './order-tax-document-panel';
import type { OrderFinancialSummaryViewModel } from '@features/orders/model/order-financial-summary-view';

interface OrderFinancialSummaryTabProps {
  viewModel: OrderFinancialSummaryViewModel;
}

/**
 * Order detail → Financial summary (Reusable View P6-01): the figures come from
 * the Order Financial View (statement, warnings, reconciliation badge); the
 * action panels beside it (collect on the AR invoice, issue a tax document)
 * keep their own data until they move onto the view in Release 2.
 * @param props - the legacy summary view model, still used by the action panels
 * @param props.viewModel - order ids and the panels' facts
 */
export function OrderFinancialSummaryTab({ viewModel }: OrderFinancialSummaryTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <OrderFinancialView
        source={{ kind: 'order', orderId: viewModel.orderId }}
        config={{ preset: 'detailed', layout: 'card', presetSwitcher: ['detailed', 'full'] }}
      />
      <div className="space-y-4">
        <OrderReceivableCollectionPanel
          viewModel={viewModel}
          orderId={viewModel.orderId}
          customerId={viewModel.customerId}
          branchId={viewModel.branchId}
        />
        <OrderTaxDocumentPanel viewModel={viewModel} />
      </div>
    </div>
  );
}
