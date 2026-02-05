/**
 * Invoice Detail Page
 *
 * Shows invoice summary, payment history, and a small form
 * to record additional cash / POS payments.
 * Route: /dashboard/billing/invoices/[id]
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { FileText, Receipt, History, Package, Banknote } from 'lucide-react';
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
  const tCommon = await getTranslations('common');
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
    invoice.order_id ? getOrder(tenantOrgId, invoice.order_id) : Promise.resolve(null),
  ]);

  const payments = paymentHistoryResult ?? [];
  const remainingBalance =
    Number(invoice.total) - Number(invoice.paid_amount || 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header - Hero style with accent */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white">
            <FileText className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {t('detail.title', { invoiceNo: invoice.invoice_no })}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              {invoice.order_id ? (
                <Link
                  href={`/dashboard/orders/${invoice.order_id}`}
                  className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  <Receipt className="h-4 w-4" />
                  {t('detail.forOrder', { orderId: invoice.order_no || invoice.order_id })}
                </Link>
              ) : (
                <span>{t('detail.noOrder')}</span>
              )}
              {invoice.customer_id && invoice.customerName && (
                <Link
                  href={`/dashboard/customers/${invoice.customer_id}`}
                  className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  <Package className="h-4 w-4" />
                  {invoice.customerName}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Invoice summary - Blue accent card */}
        <div className="space-y-4 md:col-span-2">
          <div className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm ring-1 ring-blue-50">
            <div className="border-b border-blue-100 bg-blue-50/50 px-5 py-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Receipt className="h-5 w-5 text-blue-600" />
                {t('detail.summary')}
              </h2>
            </div>
            <dl className="grid grid-cols-2 gap-4 p-5 text-sm">
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
              {invoice.payment_method_code && (
                <div>
                  <dt className="text-gray-500">
                    {tOrders('paymentMethod')}
                  </dt>
                  <dd className="font-medium text-gray-900">
                    {invoice.payment_method_code}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Payment history - Amber/warm card */}
          <div className="overflow-hidden rounded-xl border border-amber-100 bg-white shadow-sm ring-1 ring-amber-50">
            <div className="border-b border-amber-100 bg-amber-50/50 px-5 py-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <History className="h-5 w-5 text-amber-600" />
                {t('detail.paymentHistory')}
              </h2>
            </div>
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-amber-100/50 text-sm">
                <thead className="bg-amber-50/70">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-amber-900/80">
                      {t('history.date')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-amber-900/80">
                      {t('history.amount')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-amber-900/80">
                      {t('history.method')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-amber-900/80">
                      {t('history.status')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-amber-900/80">
                      {tCommon('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100/50 bg-white">
                  {payments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        {t('history.empty')}
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {p.paid_at
                            ? new Date(p.paid_at).toLocaleString()
                            : ''}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                          {Number(p.paid_amount).toFixed(3)} OMR
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {p.payment_method_code}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              p.status === 'completed' ? 'bg-green-100 text-green-800' :
                              p.status === 'cancelled' ? 'bg-slate-100 text-slate-600' :
                              p.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Link
                            href={`/dashboard/billing/payments/${p.id}?from=invoice&invoiceId=${invoice.id}`}
                            className="inline-flex items-center font-medium text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            {tCommon('view')}
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right sidebar - Order summary + Record payment */}
        <div className="space-y-4">
          {invoice.order_id && orderResult?.success && orderResult.data && (
            <div className="overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm ring-1 ring-indigo-50">
              <div className="border-b border-indigo-100 bg-indigo-50/50 px-4 py-3">
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                  <Package className="h-5 w-5 text-indigo-600" />
                  {t('detail.orderSummary')}
                </h2>
              </div>
              <div className="space-y-3 p-4 text-sm text-slate-700">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">{tOrders('orderItems')}</span>
                  <span className="font-semibold">{orderResult.data.total_items}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">{tOrders('totalAmount')}</span>
                  <span className="font-semibold">{Number(orderResult.data.total).toFixed(3)} OMR</span>
                </div>
              </div>
            </div>
          )}

          <RecordPaymentClient
            tenantOrgId={tenantOrgId}
            userId={userId}
            invoiceId={invoice.id}
            orderId={invoice.order_id ?? undefined}
            customerId={invoice.customer_id ?? undefined}
            paymentKind="invoice"
            paymentTypeCode={orderResult?.success && orderResult.data?.payment_type_code ? orderResult.data.payment_type_code : undefined}
            currencyCode={invoice.currency_code ?? undefined}
            currencyExRate={invoice.currency_ex_rate != null ? Number(invoice.currency_ex_rate) : undefined}
            branchId={orderResult?.success && orderResult.data?.branch_id ? orderResult.data.branch_id : undefined}
            /*
            subtotal={invoice.subtotal != null ? Number(invoice.subtotal) : undefined}
            discountAmount={invoice.discount != null ? Number(invoice.discount) : undefined}
            vatRate={invoice.vat_rate != null ? Number(invoice.vat_rate) : undefined}
            vatAmount={invoice.vat_amount != null ? Number(invoice.vat_amount) : undefined}
            taxAmount={invoice.tax != null ? Number(invoice.tax) : undefined}
            finalTotal={invoice.total != null ? Number(invoice.total) : undefined}
            */
            remainingBalance={remainingBalance}
            processPaymentAction={processPayment}
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
