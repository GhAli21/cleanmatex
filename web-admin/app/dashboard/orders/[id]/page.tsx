import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Printer, Edit, Clock, Package, AlertCircle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getLocale } from 'next-intl/server';
import { getOrder } from '@/app/actions/orders/get-order';
import { getAuthContext } from '@/lib/auth/server-auth';
import { isPreparationEnabled } from '@/lib/config/features';
import { OrderTimeline } from '../components/order-timeline';
import { OrderItemsList } from '../components/order-items-list';
import { OrderActions } from '../components/order-actions';
import { PrintLabelButton } from '../components/print-label-button';
import { OrderDetailClient } from './order-detail-client';

interface OrderDetailPageProps {
  params: {
    id: string;
  };
}

async function OrderDetailContent({ orderId }: { orderId: string }) {
  // Get authenticated user and tenant context
  const { tenantId } = await getAuthContext();
  const t = await getTranslations('orders.detail');
  const locale = await getLocale();

  // Fetch order with tenant context
  const result = await getOrder(tenantId, orderId);

  if (!result.success || !result.data) {
    notFound();
  }

  const order = result.data;

  // Status badge colors
  const statusColors = {
    intake: 'bg-blue-100 text-blue-800 border-blue-200',
    preparation: 'bg-purple-100 text-purple-800 border-purple-200',
    processing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    ready: 'bg-green-100 text-green-800 border-green-200',
    delivered: 'bg-gray-100 text-gray-800 border-gray-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
  };

  const priorityColors = {
    normal: 'bg-gray-100 text-gray-700',
    urgent: 'bg-orange-100 text-orange-700',
    express: 'bg-red-100 text-red-700',
  };

  const preparationStatusColors = {
    pending: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
  };

  return (
    <OrderDetailClient 
      order={order} 
      translations={{
        backToOrders: t('backToOrders'),
        edit: t('edit'),
        totalAmount: t('totalAmount'),
        paid: t('paid'),
        pendingPayment: t('pendingPayment'),
        preparationStatus: t('preparationStatus'),
        startPreparation: t('startPreparation'),
        continuePreparation: t('continuePreparation'),
        completed: t('completed'),
        numberOfBags: t('numberOfBags'),
        qrCode: t('qrCode'),
        customerInformation: t('customerInformation'),
        name: t('name'),
        phone: t('phone'),
        email: t('email'),
        address: t('address'),
        loyaltyPoints: t('loyaltyPoints'),
        points: t('points'),
        orderItems: t('orderItems'),
        notes: t('notes'),
        customerNotes: t('customerNotes'),
        internalNotes: t('internalNotes'),
        photos: t('photos'),
        orderTimeline: t('orderTimeline'),
        quickActions: t('quickActions'),
        paymentDetails: t('paymentDetails'),
        subtotal: t('subtotal'),
        discount: t('discount'),
        tax: t('tax'),
        total: t('total'),
        paidAmount: t('paidAmount'),
        balance: t('balance'),
        paymentMethod: t('paymentMethod'),
        received: t('received'),
        readyBy: t('readyBy'),
      }}
      locale={locale as 'en' | 'ar'}
    />
  );

      {/* Order Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{order.order_no}</h1>
              <span
                className={`px-3 py-1 text-xs font-medium rounded-full border ${
                  statusColors[order.status as keyof typeof statusColors] || statusColors.intake
                }`}
              >
                {order.status.replace('_', ' ').toUpperCase()}
              </span>
              <span
                className={`px-3 py-1 text-xs font-medium rounded-full ${
                  priorityColors[order.priority as keyof typeof priorityColors] || priorityColors.normal
                }`}
              >
                {order.priority?.toUpperCase() || 'NORMAL'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Received: {new Date(order.received_at!).toLocaleString('en-OM', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
              {order.ready_by && (
                <span className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  Ready By: {new Date(order.ready_by).toLocaleString('en-OM', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600 mb-1">Total Amount</div>
            <div className="text-3xl font-bold text-gray-900">
              {parseFloat(order.total?.toString() || '0').toFixed(3)} OMR
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {order.payment_status === 'paid' ? (
                <span className="text-green-600 font-medium">✓ Paid</span>
              ) : (
                <span className="text-orange-600 font-medium">Pending Payment</span>
              )}
            </div>
          </div>
        </div>

        {/* Preparation Status */}
        {order.preparation_status && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Preparation Status:</span>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    preparationStatusColors[order.preparation_status as keyof typeof preparationStatusColors] ||
                    preparationStatusColors.pending
                  }`}
                >
                  {order.preparation_status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              {isPreparationEnabled() && order.preparation_status === 'pending' && (
                <Link
                  href={`/dashboard/preparation/${order.id}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Start Preparation →
                </Link>
              )}
              {isPreparationEnabled() && order.preparation_status === 'in_progress' && (
                <Link
                  href={`/dashboard/preparation/${order.id}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Continue Preparation →
                </Link>
              )}
            </div>
            {order.prepared_at && (
              <div className="text-xs text-gray-500 mt-1">
                Completed: {new Date(order.prepared_at).toLocaleString('en-OM')}
              </div>
            )}
          </div>
        )}

        {/* Bags & QR Code */}
        {(order.bag_count || order.qr_code) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              {order.bag_count && (
                <div>
                  <div className="text-sm text-gray-600">Number of Bags</div>
                  <div className="text-lg font-semibold text-gray-900">{order.bag_count}</div>
                </div>
              )}
              {order.qr_code && (
                <div>
                  <div className="text-sm text-gray-600 mb-2">QR Code</div>
                  <div
                    className="w-24 h-24 border border-gray-200 rounded"
                    dangerouslySetInnerHTML={{ __html: order.qr_code }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-600">Name</div>
                <div className="text-base font-medium text-gray-900">
                  {order.org_customers_mst.sys_customers_mst.first_name}{' '}
                  {order.org_customers_mst.sys_customers_mst.last_name || ''}
                </div>
              </div>
              {order.org_customers_mst.sys_customers_mst.phone && (
                <div>
                  <div className="text-sm text-gray-600">Phone</div>
                  <div className="text-base font-medium text-gray-900">
                    {order.org_customers_mst.sys_customers_mst.phone}
                  </div>
                </div>
              )}
              {order.org_customers_mst.sys_customers_mst.email && (
                <div>
                  <div className="text-sm text-gray-600">Email</div>
                  <div className="text-base font-medium text-gray-900">
                    {order.org_customers_mst.sys_customers_mst.email}
                  </div>
                </div>
              )}
              {order.org_customers_mst.sys_customers_mst.address && (
                <div>
                  <div className="text-sm text-gray-600">Address</div>
                  <div className="text-base text-gray-900">
                    {order.org_customers_mst.sys_customers_mst.address}
                  </div>
                </div>
              )}
              <div>
                <div className="text-sm text-gray-600">Loyalty Points</div>
                <div className="text-base font-medium text-gray-900">
                  {order.org_customers_mst.loyalty_points || 0} points
                </div>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h2>
            <OrderItemsList items={order.org_order_items_dtl} />
          </div>

          {/* Notes */}
          {(order.customer_notes || order.internal_notes) && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
              <div className="space-y-4">
                {order.customer_notes && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Customer Notes</div>
                    <div className="text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded p-3">
                      {order.customer_notes}
                    </div>
                  </div>
                )}
                {order.internal_notes && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Internal Notes</div>
                    <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded p-3">
                      {order.internal_notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Photos */}
          {order.photo_urls && Array.isArray(order.photo_urls) && order.photo_urls.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Photos</h2>
              <div className="grid grid-cols-3 gap-4">
                {order.photo_urls.map((url: string, index: number) => (
                  <div key={index} className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={url}
                      alt={`Order photo ${index + 1}`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Timeline & Actions */}
        <div className="space-y-6">
          {/* Order Timeline */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Timeline</h2>
            <OrderTimeline order={order} />
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <OrderActions order={order} />
          </div>

          {/* Payment Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">
                  {parseFloat(order.subtotal?.toString() || '0').toFixed(3)} OMR
                </span>
              </div>
              {order.discount && parseFloat(order.discount.toString()) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount</span>
                  <span className="font-medium text-red-600">
                    -{parseFloat(order.discount.toString()).toFixed(3)} OMR
                  </span>
                </div>
              )}
              {order.tax && parseFloat(order.tax.toString()) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax (VAT)</span>
                  <span className="font-medium text-gray-900">
                    {parseFloat(order.tax.toString()).toFixed(3)} OMR
                  </span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between">
                  <span className="text-base font-semibold text-gray-900">Total</span>
                  <span className="text-base font-bold text-gray-900">
                    {parseFloat(order.total?.toString() || '0').toFixed(3)} OMR
                  </span>
                </div>
              </div>
              {order.paid_amount && parseFloat(order.paid_amount.toString()) > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Paid Amount</span>
                    <span className="font-medium text-green-600">
                      {parseFloat(order.paid_amount.toString()).toFixed(3)} OMR
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Balance</span>
                    <span className="font-medium text-orange-600">
                      {(parseFloat(order.total?.toString() || '0') - parseFloat(order.paid_amount.toString())).toFixed(3)} OMR
                    </span>
                  </div>
                </>
              )}
              {order.payment_method && (
                <div className="pt-3 border-t border-gray-200">
                  <div className="text-sm text-gray-600">Payment Method</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">
                    {order.payment_method.replace('_', ' ').toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <OrderDetailContent orderId={params.id} />
    </Suspense>
  );
}
