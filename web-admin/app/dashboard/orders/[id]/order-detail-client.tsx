'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Edit, Clock, Package, Link2, Copy } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { OrderTimeline } from '../components/order-timeline';
import { OrderItemsList } from '../components/order-items-list';
import { OrderActions } from '../components/order-actions';
import { PrintLabelButton } from '../components/print-label-button';
import { isPreparationEnabled } from '@/lib/config/features';
import type { PaymentTransaction } from '@/lib/types/payment';
import type { Invoice } from '@/lib/types/payment';
import type { PaymentMethodCode } from '@/lib/types/payment';

interface OrderDetailClientProps {
  order: any;
  unappliedPayments: PaymentTransaction[];
  orderInvoices: Invoice[];
  tenantOrgId: string;
  userId: string;
  processPaymentAction: (
    tenantOrgId: string,
    userId: string,
    input: {
      orderId: string;
      invoiceId?: string;
      customerId?: string;
      paymentKind?: 'invoice' | 'deposit' | 'advance' | 'pos';
      paymentMethod: PaymentMethodCode;
      amount: number;
      notes?: string;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  applyPaymentToInvoiceAction: (
    paymentId: string,
    invoiceId: string,
    userId?: string,
    orderId?: string
  ) => Promise<{ success: boolean; error?: string }>;
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
    retail: string;
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
    unappliedPayments: string;
    applyToInvoice: string;
    noUnappliedPayments: string;
    recordDepositPos: string;
    selectInvoiceToApply: string;
    paymentKind: string;
    kindDeposit: string;
    kindPos: string;
    recordPaymentTitle: string;
    recordPaymentAmount: string;
    recordPaymentMethod: string;
    recordPaymentCash: string;
    recordPaymentCard: string;
    recordPaymentSubmit: string;
    recordPaymentProcessing: string;
    recordPaymentCancel: string;
    recordPaymentSuccess: string;
    recordPaymentError: string;
  };
  locale: 'en' | 'ar';
  returnUrl?: string;
  returnLabel?: string;
}

export function OrderDetailClient({
  order,
  unappliedPayments,
  orderInvoices,
  tenantOrgId,
  userId,
  processPaymentAction,
  applyPaymentToInvoiceAction,
  translations: t,
  locale,
  returnUrl = '/dashboard/orders',
  returnLabel,
}: OrderDetailClientProps) {
  const isRTL = useRTL();
  const router = useRouter();
  const { currentTenant } = useAuth();
  const { trackByPiece } = useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');

  const [applyModalPaymentId, setApplyModalPaymentId] = useState<string | null>(null);
  const [applyModalInvoiceId, setApplyModalInvoiceId] = useState<string>('');
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyPending, startApplyTransition] = useTransition();

  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositMethod, setDepositMethod] = useState<PaymentMethodCode>('CASH');
  const [depositKind, setDepositKind] = useState<'deposit' | 'pos'>('deposit');
  const [depositNotes, setDepositNotes] = useState<string>('');
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState<string | null>(null);
  const [depositPending, startDepositTransition] = useTransition();

  const tenantId = currentTenant?.tenant_id;

  const handleApplyToInvoice = () => {
    if (!applyModalPaymentId || !applyModalInvoiceId) return;
    setApplyError(null);
    startApplyTransition(async () => {
      const result = await applyPaymentToInvoiceAction(
        applyModalPaymentId,
        applyModalInvoiceId,
        userId,
        order.id
      );
      if (result.success) {
        setApplyModalPaymentId(null);
        setApplyModalInvoiceId('');
        router.refresh();
      } else {
        setApplyError(result.error ?? 'Failed to apply');
      }
    });
  };

  const handleRecordDepositPos = (e: React.FormEvent) => {
    e.preventDefault();
    setDepositError(null);
    setDepositSuccess(null);
    if (depositAmount <= 0) {
      setDepositError(t.recordPaymentError);
      return;
    }
    startDepositTransition(async () => {
      const result = await processPaymentAction(tenantOrgId, userId, {
        orderId: order.id,
        paymentKind: depositKind,
        paymentMethod: depositMethod,
        amount: depositAmount,
        notes: depositNotes || undefined,
      });
      if (result.success) {
        setDepositSuccess(t.recordPaymentSuccess);
        setDepositAmount(0);
        setDepositNotes('');
        router.refresh();
      } else {
        setDepositError(result.error ?? t.recordPaymentError);
      }
    });
  };

  const publicTrackingPath =
    tenantId ? `/public/orders/${tenantId}/${order.order_no}` : '';

  const publicTrackingUrl =
    typeof window !== 'undefined' && publicTrackingPath
      ? `${window.location.origin}${publicTrackingPath}`
      : '';

  async function handleCopyPublicLink() {
    if (!publicTrackingUrl) return;
    try {
      await navigator.clipboard.writeText(publicTrackingUrl);
    } catch {
      // Silently ignore copy errors
    }
  }

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
            href={returnUrl}                      // ✅ Use dynamic returnUrl
            className={`inline-flex items-center text-sm text-gray-600 hover:text-gray-900 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <ChevronLeft className={`w-4 h-4 ${isRTL ? 'ml-1 rotate-180' : 'mr-1'}`} />
            {returnLabel || t.backToOrders}       // ✅ Use dynamic label
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
          {publicTrackingPath && (
            <button
              type="button"
              onClick={handleCopyPublicLink}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <Link2 className="w-4 h-4" />
              <span>
                {t.publicTrackingLink ?? 'Public tracking link'}
              </span>
              <Copy className="w-3 h-3 opacity-70" />
            </button>
          )}
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
              {order.is_retail && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                  {t.retail}
                </span>
              )}
            </div>
            {order.received_at && (
              <p className={`text-sm text-gray-600 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {new Date(order.received_at).toLocaleString(locale === 'ar' ? 'ar-OM' : 'en-OM', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            )}
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
            <OrderItemsList 
              items={order.org_order_items_dtl} 
              orderId={order.id}
              tenantId={currentTenant?.tenant_id}
              trackByPiece={trackByPiece}
              readOnly={true}
            />
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
              {order.payment_method_code && (
                <div className="pt-3 border-t border-gray-200">
                  <div className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.paymentMethod}</div>
                  <div className={`text-sm font-medium text-gray-900 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {order.payment_method_code.replace('_', ' ').toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Unapplied payments */}
          {unappliedPayments.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.unappliedPayments}
              </h2>
              <ul className="space-y-2">
                {unappliedPayments.map((p) => (
                  <li
                    key={p.id}
                    className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm`}
                  >
                    <span className="font-medium text-gray-900">
                      {Number(p.paid_amount).toFixed(3)} OMR
                    </span>
                    <span className="text-gray-600">
                      {p.payment_method_code}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setApplyModalPaymentId(p.id);
                        setApplyModalInvoiceId('');
                        setApplyError(null);
                      }}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {t.applyToInvoice}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Apply to invoice modal */}
          {applyModalPaymentId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="apply-invoice-title">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                <h3 id="apply-invoice-title" className="text-lg font-semibold text-gray-900 mb-4">
                  {t.selectInvoiceToApply}
                </h3>
                <select
                  value={applyModalInvoiceId}
                  onChange={(e) => setApplyModalInvoiceId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {orderInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_no} — {Number(inv.total).toFixed(3)} OMR
                    </option>
                  ))}
                </select>
                {applyError && (
                  <p className="mt-2 text-sm text-red-600">{applyError}</p>
                )}
                <div className={`flex gap-2 mt-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setApplyModalPaymentId(null);
                      setApplyModalInvoiceId('');
                      setApplyError(null);
                    }}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {t.recordPaymentCancel}
                  </button>
                  <button
                    type="button"
                    disabled={!applyModalInvoiceId || applyPending}
                    onClick={handleApplyToInvoice}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {applyPending ? t.recordPaymentProcessing : t.applyToInvoice}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Record deposit / POS */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t.recordDepositPos}
            </h2>
            <form onSubmit={handleRecordDepositPos} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t.recordPaymentAmount}</label>
                <input
                  type="number"
                  step="0.001"
                  min={0}
                  value={depositAmount || ''}
                  onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t.recordPaymentMethod}</label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDepositMethod('CASH')}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                      depositMethod === 'CASH' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700'
                    }`}
                  >
                    {t.recordPaymentCash}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositMethod('CARD')}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                      depositMethod === 'CARD' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700'
                    }`}
                  >
                    {t.recordPaymentCard}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t.paymentKind}</label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDepositKind('deposit')}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                      depositKind === 'deposit' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700'
                    }`}
                  >
                    {t.kindDeposit}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositKind('pos')}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                      depositKind === 'pos' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700'
                    }`}
                  >
                    {t.kindPos}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              {depositError && <p className="text-sm text-red-600">{depositError}</p>}
              {depositSuccess && <p className="text-sm text-green-600">{depositSuccess}</p>}
              <button
                type="submit"
                disabled={depositPending || depositAmount <= 0}
                className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {depositPending ? t.recordPaymentProcessing : t.recordPaymentSubmit}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

