'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Edit, Clock, Package, Link2, Copy } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { OrderTimeline } from '@features/orders/ui/order-timeline';
import { OrderItemsList } from '@features/orders/ui/order-items-list';
import { OrderActions } from '@features/orders/ui/order-actions';
import { PrintLabelButton } from '@features/orders/ui/print-label-button';
import { CmxTabsPanel } from '@ui/navigation/cmx-tabs-panel';
import { isPreparationEnabled } from '@/lib/config/features';
import { OrdersInvoicesTabRprt } from '@features/orders/ui/orders-invoices-tab-rprt';
import { OrdersVouchersTabRprt } from '@features/orders/ui/orders-vouchers-tab-rprt';
import { OrdersPaymentsTabRprt } from '@features/orders/ui/orders-payments-tab-rprt';
import { OrdersStockTabRprt } from '@features/orders/ui/orders-stock-tab-rprt';
import { OrdersReceiptsTabRprt } from '@features/orders/ui/orders-receipts-tab-rprt';
import type { PaymentTransaction } from '@/lib/types/payment';
import type { Invoice } from '@/lib/types/payment';
import type { PaymentMethodCode } from '@/lib/types/payment';
import type { VoucherData } from '@/lib/types/voucher';
import type { StockTransactionWithProduct } from '@/lib/services/inventory-service';

const TAB_IDS = ['items', 'history', 'invoices', 'vouchers', 'payments', 'actions', 'stock', 'receipts'] as const;

interface OrderDetailsFullClientProps {
  order: Record<string, unknown>;
  allPayments: PaymentTransaction[];
  unappliedPayments: PaymentTransaction[];
  orderInvoices: Invoice[];
  vouchers: VoucherData[];
  stockTransactions: StockTransactionWithProduct[];
  receipts: Array<{
    id: string;
    receiptTypeCode: string;
    deliveryChannelCode: string;
    deliveryStatusCode: string;
    sentAt?: string;
    deliveredAt?: string;
    retryCount: number;
  }>;
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
  initialTab?: string;
  initialInvoiceId?: string;
  initialVoucherId?: string;
  returnUrl?: string;
  returnLabel?: string;
  translations: Record<string, string>;
  locale: 'en' | 'ar';
}

export function OrderDetailsFullClient({
  order,
  allPayments,
  unappliedPayments,
  orderInvoices,
  vouchers,
  stockTransactions,
  receipts,
  tenantOrgId,
  userId,
  processPaymentAction,
  applyPaymentToInvoiceAction,
  initialTab,
  initialInvoiceId,
  initialVoucherId,
  returnUrl = '/dashboard/orders',
  returnLabel,
  translations: t,
  locale,
}: OrderDetailsFullClientProps) {
  const isRTL = useRTL();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentTenant } = useAuth();
  const { trackByPiece } = useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');

  const tabFromUrl = searchParams.get('tab') ?? initialTab;
  const activeTab = TAB_IDS.includes(tabFromUrl as (typeof TAB_IDS)[number]) ? tabFromUrl : 'items';
  const invoiceIdFromUrl = searchParams.get('invoiceId') ?? initialInvoiceId;
  const voucherIdFromUrl = searchParams.get('voucherId') ?? initialVoucherId;

  const isTerminalStatus =
    order.status === 'closed' || order.status === 'cancelled';

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

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  };

  const handleApplyToInvoice = () => {
    if (!applyModalPaymentId || !applyModalInvoiceId) return;
    setApplyError(null);
    startApplyTransition(async () => {
      const result = await applyPaymentToInvoiceAction(
        applyModalPaymentId,
        applyModalInvoiceId,
        userId,
        order.id as string
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
      setDepositError(t.recordPaymentError ?? 'Error');
      return;
    }
    startDepositTransition(async () => {
      const result = await processPaymentAction(tenantOrgId, userId, {
        orderId: order.id as string,
        paymentKind: depositKind,
        paymentMethod: depositMethod,
        amount: depositAmount,
        notes: depositNotes || undefined,
      });
      if (result.success) {
        setDepositSuccess(t.recordPaymentSuccess ?? 'Success');
        setDepositAmount(0);
        setDepositNotes('');
        router.refresh();
      } else {
        setDepositError(result.error ?? t.recordPaymentError ?? 'Error');
      }
    });
  };

  const publicTrackingPath = tenantId ? `/public/orders/${tenantId}/${order.order_no}` : '';
  const publicTrackingUrl =
    typeof window !== 'undefined' && publicTrackingPath
      ? `${window.location.origin}${publicTrackingPath}`
      : '';

  async function handleCopyPublicLink() {
    if (!publicTrackingUrl) return;
    try {
      await navigator.clipboard.writeText(publicTrackingUrl);
    } catch {
      // ignore
    }
  }

  const statusColors: Record<string, string> = {
    intake: 'bg-blue-100 text-blue-800 border-blue-200',
    preparation: 'bg-purple-100 text-purple-800 border-purple-200',
    processing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    ready: 'bg-green-100 text-green-800 border-green-200',
    delivered: 'bg-gray-100 text-gray-800 border-gray-200',
    closed: 'bg-gray-100 text-gray-800 border-gray-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
  };
  const priorityColors: Record<string, string> = {
    normal: 'bg-gray-100 text-gray-700',
    urgent: 'bg-orange-100 text-orange-700',
    express: 'bg-red-100 text-red-700',
  };
  const preparationStatusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
  };

  const customer = (order.org_customers_mst as { sys_customers_mst?: { first_name?: string; last_name?: string; phone?: string; email?: string; address?: string }; loyalty_points?: number })?.sys_customers_mst ?? order.org_customers_mst ?? {};
  const items = (order.items ?? order.org_order_items_dtl ?? []) as Array<Record<string, unknown>>;

  const tabTranslations = {
    emptyInvoices: t.emptyInvoices ?? 'No invoices',
    emptyVouchers: t.emptyVouchers ?? 'No vouchers',
    emptyPayments: t.emptyPayments ?? 'No payments',
    emptyStock: t.emptyStock ?? 'No stock transactions',
    emptyReceipts: t.emptyReceipts ?? 'No receipts',
    viewPayments: t.viewPayments ?? 'View payments',
    viewReceiptVouchers: t.viewReceiptVouchers ?? 'View receipt vouchers',
    searchByInvoiceId: t.searchByInvoiceId ?? 'Invoice ID',
    searchByVoucherId: t.searchByVoucherId ?? 'Voucher ID',
    invoiceNo: t.invoiceNo ?? 'Invoice #',
    voucherNo: t.voucherNo ?? 'Voucher #',
    paymentId: t.paymentId ?? 'ID',
    invoiceId: t.invoiceId ?? 'Invoice ID',
    voucherId: t.voucherId ?? 'Voucher ID',
    transactionId: t.transactionId ?? 'Transaction ID',
    gateway: t.gateway ?? 'Gateway',
    notes: t.notes ?? 'Notes',
  };

  const tabs = [
    {
      id: 'items',
      label: t.tabsItems ?? 'Items & Pieces',
      content: (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <OrderItemsList
            items={items}
            orderId={order.id as string}
            tenantId={tenantId}
            trackByPiece={trackByPiece}
            readOnly
          />
        </div>
      ),
    },
    {
      id: 'history',
      label: t.tabsHistory ?? 'Order History',
      content: (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <OrderTimeline orderId={order.id as string} currentStatus={order.status as string} />
        </div>
      ),
    },
    {
      id: 'invoices',
      label: t.tabsInvoices ?? 'Invoices',
      content: (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <OrdersInvoicesTabRprt
            invoices={orderInvoices}
            orderId={order.id as string}
            translations={tabTranslations}
          />
        </div>
      ),
    },
    {
      id: 'vouchers',
      label: t.tabsVouchers ?? 'Receipt Vouchers',
      content: (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <OrdersVouchersTabRprt
            vouchers={vouchers}
            orderId={order.id as string}
            filterByInvoiceId={invoiceIdFromUrl ?? undefined}
            translations={tabTranslations}
          />
        </div>
      ),
    },
    {
      id: 'payments',
      label: t.tabsPayments ?? 'Payments',
      content: (
        <div className="space-y-6">
          {/* Payment Summary - moved from sidebar for better UX */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <h3 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t.paymentDetails}
            </h3>
            <div className="space-y-3">
              <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
                <span className="text-gray-600">{t.subtotal}</span>
                <span className="font-medium">{parseFloat(String(order.subtotal ?? 0)).toFixed(3)} OMR</span>
              </div>
              {order.discount && parseFloat(String(order.discount)) > 0 && (
                <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
                  <span className="text-gray-600">{t.discount}</span>
                  <span className="font-medium text-red-600">-{parseFloat(String(order.discount)).toFixed(3)} OMR</span>
                </div>
              )}
              {order.tax && parseFloat(String(order.tax)) > 0 && (
                <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
                  <span className="text-gray-600">{t.tax}</span>
                  <span className="font-medium">{parseFloat(String(order.tax)).toFixed(3)} OMR</span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-200">
                <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'}`}>
                  <span className="text-base font-semibold">{t.total}</span>
                  <span className="text-base font-bold">{parseFloat(String(order.total ?? 0)).toFixed(3)} OMR</span>
                </div>
              </div>
              {order.paid_amount != null && parseFloat(String(order.paid_amount)) > 0 && (
                <>
                  <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
                    <span className="text-gray-600">{t.paidAmount}</span>
                    <span className="font-medium text-green-600">
                      {parseFloat(String(order.paid_amount)).toFixed(3)} OMR
                    </span>
                  </div>
                  <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
                    <span className="text-gray-600">{t.balance}</span>
                    <span
                      className={`font-medium ${
                        parseFloat(String(order.total ?? 0)) - parseFloat(String(order.paid_amount ?? 0)) >= 0
                          ? 'text-orange-600'
                          : 'text-green-600'
                      }`}
                    >
                      {(
                        parseFloat(String(order.total ?? 0)) - parseFloat(String(order.paid_amount ?? 0))
                      ).toFixed(3)}{' '}
                      OMR
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* Unapplied payments + Record deposit - only when not closed */}
          {!isTerminalStatus && (
            <>
              {unappliedPayments.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className={`text-lg font-semibold mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t.unappliedPayments}
                  </h3>
                  <ul className="space-y-2">
                    {unappliedPayments.map((p) => (
                      <li key={p.id} className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-center justify-between rounded-md border bg-gray-50 px-3 py-2 text-sm`}>
                        <span className="font-medium">{Number(p.paid_amount).toFixed(3)} OMR</span>
                        <span className="text-gray-600">{p.payment_method_code}</span>
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
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className={`text-lg font-semibold mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t.recordDepositPos}
                </h3>
                <form onSubmit={handleRecordDepositPos} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t.recordPaymentAmount}</label>
                    <input
                      type="number"
                      step="0.001"
                      min={0}
                      value={depositAmount || ''}
                      onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
            </>
          )}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <OrdersPaymentsTabRprt
              payments={allPayments}
              filterInvoiceId={invoiceIdFromUrl}
              filterVoucherId={voucherIdFromUrl}
              translations={tabTranslations}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'actions',
      label: t.tabsActions ?? 'Actions',
      content: (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t.quickActions}
          </h3>
          {isTerminalStatus ? (
            <p className="text-sm text-gray-500">{t.noActionsForClosedOrder}</p>
          ) : (
            <OrderActions order={order as { id: string; status: string; tenant_org_id: string }} />
          )}
        </div>
      ),
    },
    {
      id: 'stock',
      label: t.tabsStock ?? 'Stock',
      content: (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <OrdersStockTabRprt transactions={stockTransactions} translations={tabTranslations} />
        </div>
      ),
    },
    {
      id: 'receipts',
      label: t.tabsReceipts ?? 'Receipt Sending',
      content: (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <OrdersReceiptsTabRprt receipts={receipts} translations={tabTranslations} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : 'justify-between'}`}>
        <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Link
            href={returnUrl}
            className={`inline-flex items-center text-sm text-gray-600 hover:text-gray-900 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <ChevronLeft className={`w-4 h-4 ${isRTL ? 'ml-1 rotate-180' : 'mr-1'}`} />
            {returnLabel ?? t.backToSimpleView ?? t.backToOrders}
          </Link>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <PrintLabelButton order={order} />
          {!isTerminalStatus && (
            <Link
              href={`/dashboard/orders/${order.id}/edit`}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <Edit className="w-4 h-4" />
              {t.edit}
            </Link>
          )}
          {publicTrackingPath && (
            <button
              type="button"
              onClick={handleCopyPublicLink}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <Link2 className="w-4 h-4" />
              <span>{t.publicTrackingLink ?? 'Public tracking link'}</span>
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
              <h1 className={`text-2xl font-bold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                {String(order.order_no)}
              </h1>
              <span
                className={`px-3 py-1 text-xs font-medium rounded-full border ${
                  statusColors[String(order.status)] ?? statusColors.intake
                }`}
              >
                {String(order.status).replace('_', ' ').toUpperCase()}
              </span>
              <span
                className={`px-3 py-1 text-xs font-medium rounded-full ${
                  priorityColors[String(order.priority)] ?? priorityColors.normal
                }`}
              >
                {String(order.priority ?? 'normal').toUpperCase()}
              </span>
              {order.is_retail && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                  {t.retail}
                </span>
              )}
            </div>
            {order.received_at && (
              <p className={`text-sm text-gray-600 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {new Date(order.received_at as string).toLocaleString(locale === 'ar' ? 'ar-OM' : 'en-OM', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            )}
            <div className={`flex items-center gap-4 text-sm text-gray-600 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Clock className="w-4 h-4" />
                {t.received}:{' '}
                {new Date((order.received_at ?? order.created_at) as string).toLocaleString(
                  locale === 'ar' ? 'ar-OM' : 'en-OM',
                  { dateStyle: 'medium', timeStyle: 'short' }
                )}
              </span>
              {order.ready_by && (
                <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Package className="w-4 h-4" />
                  {t.readyBy}:{' '}
                  {new Date(order.ready_by as string).toLocaleString(locale === 'ar' ? 'ar-OM' : 'en-OM', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              )}
            </div>
          </div>
          <div className={isRTL ? 'text-left' : 'text-right'}>
            <div className={`text-sm text-gray-600 mb-1 ${isRTL ? 'text-left' : 'text-right'}`}>
              {t.totalAmount}
            </div>
            <div className={`text-3xl font-bold text-gray-900 ${isRTL ? 'text-left' : 'text-right'}`}>
              {parseFloat(String(order.total ?? 0)).toFixed(3)} OMR
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

        {order.preparation_status && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t.preparationStatus}:
                </span>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    preparationStatusColors[String(order.preparation_status)] ?? preparationStatusColors.pending
                  }`}
                >
                  {String(order.preparation_status).replace('_', ' ').toUpperCase()}
                </span>
              </div>
              {isPreparationEnabled() &&
                order.preparation_status === 'pending' && (
                  <Link
                    href={`/dashboard/preparation/${order.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    {isRTL ? '← ' : ''}{t.startPreparation}{isRTL ? '' : ' →'}
                  </Link>
                )}
              {isPreparationEnabled() &&
                order.preparation_status === 'in_progress' && (
                  <Link
                    href={`/dashboard/preparation/${order.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    {isRTL ? '← ' : ''}{t.continuePreparation}{isRTL ? '' : ' →'}
                  </Link>
                )}
            </div>
          </div>
        )}
      </div>

      {/* Customer + Notes compact */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t.customerInformation}
            </h2>
            <div className="space-y-3">
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <div className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.name}</div>
                <div className={`text-base font-medium text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {(customer as { first_name?: string }).first_name} {(customer as { last_name?: string }).last_name ?? ''}
                </div>
              </div>
              {(customer as { phone?: string }).phone && (
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <div className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.phone}</div>
                  <div className={`text-base font-medium ${isRTL ? 'text-right' : 'text-left'}`}>
                    {(customer as { phone?: string }).phone}
                  </div>
                </div>
              )}
              {(customer as { email?: string }).email && (
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <div className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.email}</div>
                  <div className={`text-base font-medium ${isRTL ? 'text-right' : 'text-left'}`}>
                    {(customer as { email?: string }).email}
                  </div>
                </div>
              )}
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <div className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.loyaltyPoints}</div>
                <div className={`text-base font-medium ${isRTL ? 'text-right' : 'text-left'}`}>
                  {(order.org_customers_mst as { loyalty_points?: number })?.loyalty_points ?? 0} {t.points}
                </div>
              </div>
            </div>
          </div>

          {(order.customer_notes || order.internal_notes) && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.notes}
              </h2>
              <div className="space-y-4">
                {order.customer_notes && (
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <div className={`text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t.customerNotes}
                    </div>
                    <div className={`text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded p-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {String(order.customer_notes)}
                    </div>
                  </div>
                )}
                {order.internal_notes && (
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <div className={`text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t.internalNotes}
                    </div>
                    <div className={`text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded p-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {String(order.internal_notes)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Order Summary - compact card with key dates and preparation status */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t.orderSummary ?? 'Order Summary'}
            </h2>
            <div className="space-y-3">
              <div className={`flex items-center gap-2 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Clock className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="text-gray-600">{t.received}:</span>
                <span className="font-medium text-gray-900">
                  {new Date((order.received_at ?? order.created_at) as string).toLocaleString(
                    locale === 'ar' ? 'ar-OM' : 'en-OM',
                    { dateStyle: 'medium', timeStyle: 'short' }
                  )}
                </span>
              </div>
              {order.ready_by && (
                <div className={`flex items-center gap-2 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Package className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-gray-600">{t.readyBy}:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(order.ready_by as string).toLocaleString(locale === 'ar' ? 'ar-OM' : 'en-OM', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              )}
              {order.preparation_status && (
                <div className="pt-3 border-t border-gray-200">
                  <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
                    <span className="text-sm text-gray-600">{t.preparationStatus}:</span>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        preparationStatusColors[String(order.preparation_status)] ?? preparationStatusColors.pending
                      }`}
                    >
                      {String(order.preparation_status).replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  {isPreparationEnabled() &&
                    (order.preparation_status === 'pending' || order.preparation_status === 'in_progress') && (
                    <Link
                      href={`/dashboard/preparation/${order.id}`}
                      className={`inline-block mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {isRTL ? '← ' : ''}
                      {order.preparation_status === 'pending' ? t.startPreparation : t.continuePreparation}
                      {isRTL ? '' : ' →'}
                    </Link>
                  )}
                </div>
              )}
              <div className="pt-3 border-t border-gray-200 space-y-2">
                <p className={`text-xs text-gray-500 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t.viewFullDetails}
                </p>
                <div className={`flex flex-col gap-2 ${isRTL ? 'items-end' : 'items-start'}`}>
                  <button
                    type="button"
                    onClick={() => handleTabChange('payments')}
                    className={`inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    {t.paymentDetails}
                    <ChevronLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange('history')}
                    className={`inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    {t.tabsHistory ?? 'Order History'}
                    <ChevronLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                  </button>
                  {!isTerminalStatus && (
                    <button
                      type="button"
                      onClick={() => handleTabChange('actions')}
                      className={`inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 ${isRTL ? 'flex-row-reverse' : ''}`}
                    >
                      {t.quickActions}
                      <ChevronLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <CmxTabsPanel tabs={tabs} value={activeTab} onChange={handleTabChange} />
      </div>

      {/* Apply to invoice modal */}
      {applyModalPaymentId && !isTerminalStatus && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.selectInvoiceToApply}</h3>
            <select
              value={applyModalInvoiceId}
              onChange={(e) => setApplyModalInvoiceId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {orderInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_no ?? inv.id} — {Number(inv.total ?? 0).toFixed(3)} OMR
                </option>
              ))}
            </select>
            {applyError && <p className="mt-2 text-sm text-red-600">{applyError}</p>}
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
    </div>
  );
}
