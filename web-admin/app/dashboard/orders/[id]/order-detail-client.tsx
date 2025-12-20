'use client';

import Link from 'next/link';
import { ChevronLeft, Edit, Clock, Package } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { OrderTimeline } from '../components/order-timeline';
import { OrderItemsList } from '../components/order-items-list';
import { OrderActions } from '../components/order-actions';
import { PrintLabelButton } from '../components/print-label-button';
import { isPreparationEnabled } from '@/lib/config/features';

interface OrderDetailClientProps {
  order: any;
  translations: {
    backToOrders: string;
    edit: string;
    totalAmount: string;
    paid: string;
    pendingPayment: string;
    preparationStatus: string;
    startPreparation: string;
    continuePreparation: string;
    completed: string;
    numberOfBags: string;
    qrCode: string;
    customerInformation: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    loyaltyPoints: string;
    points: string;
    orderItems: string;
    notes: string;
    customerNotes: string;
    internalNotes: string;
    photos: string;
    orderTimeline: string;
    quickActions: string;
    paymentDetails: string;
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
    paidAmount: string;
    balance: string;
    paymentMethod: string;
    received: string;
    readyBy: string;
  };
  locale: 'en' | 'ar';
}

export function OrderDetailClient({ order, translations: t, locale }: OrderDetailClientProps) {
  const isRTL = useRTL();

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
    <div className="space-y-6">
      {/* Header */}
      <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : 'justify-between'}`}>
        <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Link
            href="/dashboard/orders"
            className={`inline-flex items-center text-sm text-gray-600 hover:text-gray-900 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <ChevronLeft className={`w-4 h-4 ${isRTL ? 'ml-1 rotate-180' : 'mr-1'}`} />
            {t.backToOrders}
          </Link>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <PrintLabelButton order={order} />
          <Link
            href={`/dashboard/orders/${order.id}/edit`}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Edit className="w-4 h-4" />
            {t.edit}
          </Link>
        </div>
      </div>

      {/* Order Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className={`flex items-start ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <div className={`flex items-center gap-3 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h1 className={`text-2xl font-bold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>{order.order_no}</h1>
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
            <div className={`flex items-center gap-4 text-sm text-gray-600 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Clock className="w-4 h-4" />
                {t.received}: {new Date(order.received_at!).toLocaleString(locale === 'ar' ? 'ar-OM' : 'en-OM', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
              {order.ready_by && (
                <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Package className="w-4 h-4" />
                  {t.readyBy}: {new Date(order.ready_by).toLocaleString(locale === 'ar' ? 'ar-OM' : 'en-OM', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              )}
            </div>
          </div>
          <div className={isRTL ? 'text-left' : 'text-right'}>
            <div className={`text-sm text-gray-600 mb-1 ${isRTL ? 'text-left' : 'text-right'}`}>{t.totalAmount}</div>
            <div className={`text-3xl font-bold text-gray-900 ${isRTL ? 'text-left' : 'text-right'}`}>
              {parseFloat(order.total?.toString() || '0').toFixed(3)} OMR
            </div>
            <div className={`text-xs text-gray-500 mt-1 ${isRTL ? 'text-left' : 'text-right'}`}>
              {order.payment_status === 'paid' ? (
                <span className="text-green-600 font-medium">✓ {t.paid}</span>
              ) : (
                <span className="text-orange-600 font-medium">{t.pendingPayment}</span>
              )}
            </div>
          </div>
        </div>

        {/* Preparation Status */}
        {order.preparation_status && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.preparationStatus}:</span>
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
                  className={`text-sm font-medium text-blue-600 hover:text-blue-700 ${isRTL ? 'text-left' : 'text-right'}`}
                >
                  {isRTL ? '← ' : ''}{t.startPreparation}{isRTL ? '' : ' →'}
                </Link>
              )}
              {isPreparationEnabled() && order.preparation_status === 'in_progress' && (
                <Link
                  href={`/dashboard/preparation/${order.id}`}
                  className={`text-sm font-medium text-blue-600 hover:text-blue-700 ${isRTL ? 'text-left' : 'text-right'}`}
                >
                  {isRTL ? '← ' : ''}{t.continuePreparation}{isRTL ? '' : ' →'}
                </Link>
              )}
            </div>
            {order.prepared_at && (
              <div className={`text-xs text-gray-500 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.completed}: {new Date(order.prepared_at).toLocaleString(locale === 'ar' ? 'ar-OM' : 'en-OM')}
              </div>
            )}
          </div>
        )}

        {/* Bags & QR Code */}
        {(order.bag_count || order.qr_code) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              {order.bag_count && (
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <div className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.numberOfBags}</div>
                  <div className={`text-lg font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>{order.bag_count}</div>
                </div>
              )}
              {order.qr_code && (
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <div className={`text-sm text-gray-600 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t.qrCode}</div>
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
            <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t.customerInformation}</h2>
            <div className="space-y-3">
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <div className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.name}</div>
                <div className={`text-base font-medium text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {order.org_customers_mst.sys_customers_mst.first_name}{' '}
                  {order.org_customers_mst.sys_customers_mst.last_name || ''}
                </div>
              </div>
              {order.org_customers_mst.sys_customers_mst.phone && (
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <div className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.phone}</div>
                  <div className={`text-base font-medium text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {order.org_customers_mst.sys_customers_mst.phone}
                  </div>
                </div>
              )}
              {order.org_customers_mst.sys_customers_mst.email && (
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <div className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.email}</div>
                  <div className={`text-base font-medium text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {order.org_customers_mst.sys_customers_mst.email}
                  </div>
                </div>
              )}
              {order.org_customers_mst.sys_customers_mst.address && (
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <div className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.address}</div>
                  <div className={`text-base text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {order.org_customers_mst.sys_customers_mst.address}
                  </div>
                </div>
              )}
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <div className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.loyaltyPoints}</div>
                <div className={`text-base font-medium text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {order.org_customers_mst.loyalty_points || 0} {t.points}
                </div>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t.orderItems}</h2>
            <OrderItemsList items={order.org_order_items_dtl} />
          </div>

          {/* Notes */}
          {(order.customer_notes || order.internal_notes) && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t.notes}</h2>
              <div className="space-y-4">
                {order.customer_notes && (
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <div className={`text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>{t.customerNotes}</div>
                    <div className={`text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded p-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {order.customer_notes}
                    </div>
                  </div>
                )}
                {order.internal_notes && (
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <div className={`text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>{t.internalNotes}</div>
                    <div className={`text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded p-3 ${isRTL ? 'text-right' : 'text-left'}`}>
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
              <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t.photos}</h2>
              <div className="grid grid-cols-3 gap-4">
                {order.photo_urls.map((url: string, index: number) => (
                  <div key={index} className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={url}
                      alt={`${t.photos} ${index + 1}`}
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
            <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t.orderTimeline}</h2>
            <OrderTimeline orderId={order.id} currentStatus={order.status} />
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t.quickActions}</h2>
            <OrderActions order={order} />
          </div>

          {/* Payment Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t.paymentDetails}</h2>
            <div className="space-y-3">
              <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
                <span className="text-gray-600">{t.subtotal}</span>
                <span className="font-medium text-gray-900">
                  {parseFloat(order.subtotal?.toString() || '0').toFixed(3)} OMR
                </span>
              </div>
              {order.discount && parseFloat(order.discount.toString()) > 0 && (
                <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
                  <span className="text-gray-600">{t.discount}</span>
                  <span className="font-medium text-red-600">
                    -{parseFloat(order.discount.toString()).toFixed(3)} OMR
                  </span>
                </div>
              )}
              {order.tax && parseFloat(order.tax.toString()) > 0 && (
                <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
                  <span className="text-gray-600">{t.tax}</span>
                  <span className="font-medium text-gray-900">
                    {parseFloat(order.tax.toString()).toFixed(3)} OMR
                  </span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-200">
                <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'}`}>
                  <span className="text-base font-semibold text-gray-900">{t.total}</span>
                  <span className="text-base font-bold text-gray-900">
                    {parseFloat(order.total?.toString() || '0').toFixed(3)} OMR
                  </span>
                </div>
              </div>
              {order.paid_amount && parseFloat(order.paid_amount.toString()) > 0 && (
                <>
                  <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
                    <span className="text-gray-600">{t.paidAmount}</span>
                    <span className="font-medium text-green-600">
                      {parseFloat(order.paid_amount.toString()).toFixed(3)} OMR
                    </span>
                  </div>
                  <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
                    <span className="text-gray-600">{t.balance}</span>
                    <span className="font-medium text-orange-600">
                      {(parseFloat(order.total?.toString() || '0') - parseFloat(order.paid_amount.toString())).toFixed(3)} OMR
                    </span>
                  </div>
                </>
              )}
              {order.payment_method && (
                <div className="pt-3 border-t border-gray-200">
                  <div className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.paymentMethod}</div>
                  <div className={`text-sm font-medium text-gray-900 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
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

