'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useLocale } from '@/lib/hooks/useLocale';
import type { ReadyOrder } from '@features/orders/model/ready-order-types';

export type PrintLayout = 'thermal' | 'a4';

interface OrderReceiptPrintProps {
  order: ReadyOrder;
  layout: PrintLayout; 
}

export function OrderReceiptPrint({ order, layout }: OrderReceiptPrintProps) {
  const tOrders = useTranslations('orders');
  const tOrderDetail = useTranslations('orders.detail');
  const tWorkflowReady = useTranslations('workflow.ready');
  const tWorkflowLabels = useTranslations('workflow.labels');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const locale = useLocale();

  const formattedReadyBy = useMemo(() => {
    if (!order.readyBy) return '';
    const date = new Date(order.readyBy);
    return date.toLocaleString(locale === 'ar' ? 'ar-OM' : 'en-OM', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [order.readyBy, locale]);

  const containerWidthClass =
    layout === 'thermal' ? 'max-w-[80mm] w-full' : 'w-full max-w-a4';

  return (
    <div
      className={`mx-auto ${containerWidthClass} bg-white text-gray-900 print:bg-white`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <header className="print-header text-center">
        <h1 className="print-title">CleanMateX</h1>
        <p className="print-subtitle">
          {tWorkflowReady('description')}
        </p>
      </header>

      <section className="print-section">
        <div className="flex justify-between print-row">
          <span className="font-semibold">{tOrders('orderNumber')}</span>
          <span>{order.orderNo}</span>
        </div>
        <div className="flex justify-between print-row">
          <span className="font-semibold">{tWorkflowLabels('customer')}</span>
          <span>{order.customer.name}</span>
        </div> 
        <div className="flex justify-between print-row">
          <span className="font-semibold">{tWorkflowLabels('phone')}</span>
          <span>{order.customer.phone}</span>
        </div>
        {formattedReadyBy && (
          <div className="flex justify-between print-row">
            <span className="font-semibold">{tOrderDetail('readyBy')}</span>
            <span>{formattedReadyBy}</span>
          </div>
        )}
        <div className="flex justify-between print-row">
          <span className="font-semibold">{tWorkflowReady('rack')}</span>
          <span>{order.rackLocation || '-'}</span>
        </div>
      </section>

      <section className="print-section border-t border-b border-gray-200 py-2">
        <h2>{tWorkflowReady('itemsTitle')}</h2>
        <div className="space-y-1">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <div className="flex-1">
                <div className="font-medium">{item.productName}</div>
                <div className="text-[11px] text-gray-500">
                  {tWorkflowReady('quantity')}: {item.quantity}
                </div>
              </div>
              <div className="text-right text-[11px]">
                {item.totalPrice.toFixed(3)} OMR
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="print-section">
        <div className="flex justify-between print-row">
          <span className="font-semibold">{tWorkflowReady('totalAmount')}</span>
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

