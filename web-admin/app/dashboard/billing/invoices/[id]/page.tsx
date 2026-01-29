/**
 * Invoice Detail Page
 *
 * Shows invoice summary, payment history, and a small form
 * to record additional cash / POS payments.
 * Route: /dashboard/billing/invoices/[id]
 */

import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { getInvoice } from '@/lib/services/invoice-service';
import { getPaymentHistory } from '@/lib/services/payment-service';
import { getOrder } from '@/app/actions/orders/get-order';
import { processPayment } from '@/app/actions/payments/process-payment';
import { RecordPaymentClient } from './record-payment-client';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations('invoices');
  const tOrders = await getTranslations('orders.detail');

  const auth = await getAuthContext();
  const tenantOrgId = auth.tenantId;
  const userId = auth.userId;

  const invoice = await getInvoice(id);
  if (!invoice) {
    notFound();
  }

  const [paymentHistoryResult, orderResult] = await Promise.all([
    getPaymentHistory(id),
    invoice.order_id ? getOrder(invoice.order_id) : Promise.resolve(null),
  ]);

  const payments = paymentHistoryResult ?? [];
  const remainingBalance =
    Number(invoice.total) - Number(invoice.paid_amount || 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('detail.title', { invoiceNo: invoice.invoice_no })}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {invoice.order_id
              ? t('detail.forOrder', { orderId: invoice.order_id })
              : t('detail.noOrder')}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Invoice summary */}
        <div className="space-y-4 md:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {t('detail.summary')}
            </h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-gray-500">{tOrders('subtotal')}</dt>
                <dd className="font-medium text-gray-900">
                  {Number(invoice.subtotal).toFixed(3)} OMR
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">{tOrders('discount')}</dt>
                <dd className="font-medium text-red-600">
                  {Number(invoice.discount).toFixed(3)} OMR
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">{tOrders('tax')}</dt>
                <dd className="font-medium text-gray-900">
                  {Number(invoice.tax).toFixed(3)} OMR
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">{tOrders('total')}</dt>
                <dd className="font-semibold text-gray-900">
                  {Number(invoice.total).toFixed(3)} OMR
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">{tOrders('paidAmount')}</dt>
                <dd className="font-medium text-green-700">
                  {Number(invoice.paid_amount).toFixed(3)} OMR
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">{tOrders('balance')}</dt>
                <dd className="font-medium text-orange-700">
                  {remainingBalance.toFixed(3)} OMR
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">{t('detail.status')}</dt>
                <dd className="font-medium text-gray-900">{invoice.status}</dd>
              </div>
              {invoice.payment_method && (
                <div>
                  <dt className="text-gray-500">
                    {tOrders('paymentMethod')}
                  </dt>
                  <dd className="font-medium text-gray-900">
                    {invoice.payment_method}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Payment history */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {t('detail.paymentHistory')}
            </h2>
            <div className="overflow-hidden rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      {t('history.date')}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      {t('history.amount')}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      {t('history.method')}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">
                      {t('history.status')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {payments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-4 text-center text-gray-500"
                      >
                        {t('history.empty')}
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap px-3 py-2">
                          {p.paid_at
                            ? new Date(p.paid_at).toLocaleString()
                            : ''}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">
                          {Number(p.paid_amount).toFixed(3)} OMR
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {p.payment_method}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Record payment + order snippet */}
        <div className="space-y-4">
          {invoice.order_id && orderResult?.success && orderResult.data && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">
                {t('detail.orderSummary')}
              </h2>
              <div className="space-y-1 text-sm text-gray-700">
                <div>
                  <span className="font-medium">
                    {tOrders('orderItems')}:
                  </span>{' '}
                  {orderResult.data.total_items}
                </div>
                <div>
                  <span className="font-medium">
                    {tOrders('totalAmount')}:
                  </span>{' '}
                  {Number(orderResult.data.total).toFixed(3)} OMR
                </div>
              </div>
            </div>
          )}

          <RecordPaymentClient
            tenantOrgId={tenantOrgId}
            userId={userId}
            invoiceId={invoice.id}
            orderId={invoice.order_id}
            remainingBalance={remainingBalance}
            processPaymentAction={async (
              tenant,
              user,
              input,
            ) => {
              const result = await processPayment(tenant, user, {
                orderId: input.orderId,
                invoiceId: input.invoiceId,
                paymentMethod: input.paymentMethod,
                amount: input.amount,
                notes: input.notes,
              });

              return {
                success: result.success,
                error: result.error,
              };
            }}
            t={{
              recordPayment: t('recordPayment.title'),
              amount: t('recordPayment.amount'),
              paymentMethod: t('recordPayment.paymentMethod'),
              cash: t('recordPayment.cash'),
              card: t('recordPayment.card'),
              submit: t('recordPayment.submit'),
              cancelling: t('recordPayment.processing'),
              cancel: t('recordPayment.cancel'),
              success: t('recordPayment.success'),
              error: t('recordPayment.error'),
            }}
          />
        </div>
      </div>
    </div>
  );
}
