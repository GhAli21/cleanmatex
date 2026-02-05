'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import type { ReadyOrder } from '@features/orders/model/ready-order-types';
import type { PrintLayout } from './order-receipt-print';
 
interface OrderDetailsPrintProps {
  order: ReadyOrder;
  layout: PrintLayout;
}

export function OrderDetailsPrint({ order, layout }: OrderDetailsPrintProps) {
  const tOrders = useTranslations('orders.detail');
  const tOrdersMain = useTranslations('orders');
  const tWorkflowReady = useTranslations('workflow.ready');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();

  const containerWidthClass =
    layout === 'thermal' ? 'max-w-[80mm] w-full' : 'w-full max-w-a4';

  return (
    <div
      className={`mx-auto ${containerWidthClass} bg-white text-gray-900 print:bg-white`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <header className="print-header">
        <div className="flex justify-between print-subtitle">
          <span>CleanMateX</span>
          <span>{order.orderNo}</span>
        </div>
        <h1 className="print-title mt-1">
          {tOrdersMain('orderDetails')}
        </h1>
      </header>

      <section className="print-section">
        <h2>{tOrdersMain('customerInfo')}</h2>
        <div className="space-y-1">
          <div className="flex justify-between print-row">
            <span>{tOrders('name')}</span>
            <span>{order.customer.name}</span>
          </div>
          <div className="flex justify-between print-row">
            <span>{tOrders('phone')}</span>
            <span>{order.customer.phone}</span>
          </div>
          <div className="flex justify-between print-row">
            <span>{tWorkflowReady('rack')}</span>
            <span>{order.rackLocation || '-'}</span>
          </div>
        </div>
      </section>

      <section className="print-section">
        <h2>{tOrders('orderItems')}</h2>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-1 text-left">{tOrders('orderItems')}</th>
              <th className="py-1 text-center">{tWorkflowReady('quantity')}</th>
              <th className="py-1 text-right">{tOrders('subtotal')}</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-dashed border-gray-200">
                <td className="py-1 pr-2">
                  <div className="font-medium">{item.productName}</div>
                </td>
                <td className="py-1 text-center">{item.quantity}</td>
                <td className="py-1 text-right">
                  {item.totalPrice.toFixed(3)} OMR
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="print-section">
        <div className="flex justify-between print-row">
          <span className="font-semibold">{tOrders('total')}</span>
          <span className="font-semibold">{order.total.toFixed(3)} OMR</span>
        </div>
        {order.paymentSummary && (
          <>
            <div className="flex justify-between print-row">
              <span>{tOrders('paidAmount')}</span>
              <span className="text-green-700">
                {order.paymentSummary.paid.toFixed(3)} OMR
              </span>
            </div>
            <div className="flex justify-between print-row">
              <span>{tWorkflowReady('paymentSection.remainingDue')}</span>
              <span className="text-orange-700">
                {order.paymentSummary.remaining.toFixed(3)} OMR
              </span>
            </div>
          </>
        )}
      </section>

      <footer className="print-footer">
        <p>{tCommon('thanks') ?? 'Thank you for your business!'}</p>
      </footer>
    </div>
  );
}

