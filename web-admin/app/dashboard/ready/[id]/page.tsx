/**
 * Ready Screen - Detail Page
 * Delivery actions and payment collection
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { OrderPiecesManager } from '@features/orders/ui/OrderPiecesManager';
import { PiecesErrorBoundary } from '@features/orders/ui/PiecesErrorBoundary';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useMessage } from '@ui/feedback';
import { SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
import { OrderCollectPaymentModal } from '@features/orders/ui/collect-payment/order-collect-payment-modal';
import {
  mapReadyOrderFromStateResponse,
  type ReadyOrder,
  type ReadyOrderStateResponse,
} from '@features/orders/model/ready-order-types';

/**
 *
 */
export default function ReadyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations('workflow');
  const tOrders = useTranslations('orders');
  const tInvoices = useTranslations('invoices');
  const tPieces = useTranslations('newOrder.pieces');
  const { currentTenant, user } = useAuth();
  const { formatMoneyWithCode } = useTenantCurrency();
  const { showSuccess, showErrorFrom } = useMessage();
  const useNewWorkflowSystem = useWorkflowSystemMode();
  const transition = useOrderTransition();
  const { trackByPiece } = useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');

  const [order, setOrder] = useState<ReadyOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [printConfig, setPrintConfig] = useState<{
    type: 'receipt' | 'order-details' | 'invoices-payments-rprt' | 'payments-rprt' | 'history-rprt';
    layout: 'thermal' | 'a4';
    sort?: 'asc' | 'desc';
  } | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);

  const orderId = (params as any)?.id as string | undefined;

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const loadOrder = useCallback(async () => {
    if (!currentTenant || !orderId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/state`);
      const json: ReadyOrderStateResponse = await res.json();
      const mapped = mapReadyOrderFromStateResponse(json);
      if (mapped) {
        setOrder(mapped);
      } else {
        setError(json.error || t('ready.messages.loadFailed'));
      }
    } catch (err: any) {
      setError(err.message || t('ready.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [orderId, currentTenant, t]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleDeliver = async () => {
    if (!orderId) return;
    setSubmitting(true);
    setError(null);
    setBlockers([]);
    try {
      const result = await transition.mutateAsync({
        orderId,
        input: {
          screen: 'ready',
          to_status: 'delivered',
          notes: 'Delivered to customer',
          useOldWfCodeOrNew: useNewWorkflowSystem,
        },
      });

      if (result.success) {
        showSuccess(t('ready.messages.deliveredSuccess'));
        router.push('/dashboard/orders');
      } else {
        setError(result.error || t('ready.messages.deliveredFailed'));
        if (result.blockers?.length) setBlockers(result.blockers);
      }
    } catch (err) {
      showErrorFrom(err, { fallback: t('ready.messages.deliveredFailed') });
    } finally {
      setSubmitting(false);
    }
  };

  const openPrintPreview = (
    type: 'receipt' | 'order-details' | 'invoices-payments-rprt' | 'payments-rprt' | 'history-rprt',
    layout: 'thermal' | 'a4',
    sort?: 'asc' | 'desc'
  ) => {
    setPrintConfig({ type, layout, sort });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {t('ready.messages.notFound')}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/dashboard/ready" className="text-blue-600 hover:underline mb-2 inline-block">
          Ã¢â€ Â {t('ready.actions.backToReady')}
        </Link>
        <h1 className="text-3xl font-bold">
          {t('screens.ready')} - {order.orderNo}
        </h1>
        <p className="text-gray-600 mt-1">
          {order.customer.name} Ã¢â‚¬Â¢ {order.customer.phone}
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {blockers.length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-3 rounded-lg">
          <div className="font-medium mb-1">{t('ready.messages.blockersTitle')}</div>
          <ul className="list-disc list-inside text-sm space-y-1">
            {blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">{t('ready.itemsTitle')}</h3>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-gray-600">
                        {t('ready.quantity')}: {item.quantity}
                      </p>
                    </div>
                    <span className="font-bold text-blue-600">
                      {formatMoneyWithCode(item.totalPrice)}
                    </span>
                  </div>

                  {/* Pieces Section - Expandable */}
                  {trackByPiece && orderId && currentTenant?.tenant_id && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => toggleItemExpansion(item.id)}
                        className={`w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors`}
                      >
                        <span>
                          {tPieces('viewPieces') || 'View Pieces'}
                        </span>
                        {expandedItemIds.has(item.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      
                      {expandedItemIds.has(item.id) && (
                        <div className="mt-3">
                          <PiecesErrorBoundary>
                            <OrderPiecesManager
                              orderId={orderId}
                              itemId={item.id}
                              tenantId={currentTenant.tenant_id}
                              branchId={order?.branchId}
                              readOnly={true}
                              autoLoad={true}
                              pieceDensity="compact"
                            />
                          </PiecesErrorBoundary>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">{t('ready.totalAmount')}:</span>
              <span className="font-bold text-2xl text-green-600">
                {formatMoneyWithCode(order.total)}
              </span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">{t('ready.rack')}:</span>
              <span className="font-bold text-xl text-blue-600">{order.rackLocation}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Payment section */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-3">{t('ready.paymentSection.title')}</h3>
            {order.paymentSummary && (
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('ready.totalAmount')}</span>
                  <span className="font-medium">{formatMoneyWithCode(order.paymentSummary.total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{tOrders('paidAmount')}</span>
                  <span className="font-medium text-green-700">{formatMoneyWithCode(order.paymentSummary.paid)}</span>
                </div>
                {order.paymentSummary.remaining > 0 ? (
                  <>
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-orange-600">{t('ready.paymentSection.remainingDue')}</span>
                      <span className="text-orange-700">{formatMoneyWithCode(order.paymentSummary.remaining)}</span>
                    </div>
                    {currentTenant?.tenant_id && orderId && (() => {
                      const isPoc =
                        order.paymentTypeCode === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION;
                      if (isPoc) {
                        return (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <button
                              type="button"
                              onClick={() => setCollectOpen(true)}
                              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                            >
                              {tOrders('collectPayment.collectButton')}
                            </button>
                          </div>
                        );
                      }
                      // Canonical path for invoice/on-account money: the
                      // customer account receipt flow (preview → post →
                      // allocation across invoices). The legacy per-invoice
                      // record-payment form wrote the deprecated
                      // legacy payments ledger (ADR-002) and was removed.
                      return (
                        <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                          <Link
                            href="/dashboard/customers/account-receipt"
                            className="block w-full rounded-lg bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-700"
                          >
                            {t('ready.paymentSection.receiveAccountPayment')}
                          </Link>
                          <p className="text-xs text-gray-500">
                            {t('ready.paymentSection.receiveAccountPaymentHint')}
                          </p>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <p className="text-sm font-medium text-green-700">{t('ready.paymentSection.paidInFull')}</p>
                )}
              </div>
            )}

            <h3 className="font-semibold mb-3 pt-2 border-t border-gray-200">{t('ready.actions.title')}</h3>
            <button
              onClick={handleDeliver}
              disabled={
                submitting ||
                (order.paymentSummary?.remaining && order.paymentSummary.remaining > 0)
              }
              className="mb-2 w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? t('ready.actions.processing') : t('ready.actions.markDelivered')}
            </button>
            {order.paymentSummary?.remaining && order.paymentSummary.remaining > 0 && (
              <p className="text-xs text-amber-600 mb-2">{t('ready.paymentSection.collectBeforeHandover')}</p>
            )}

            <div className="mt-2 space-y-2">
              <button
                type="button"
                onClick={() => openPrintPreview('receipt', 'thermal')}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {t('ready.actions.printReceiptThermal')}
              </button>
              <button
                type="button"
                onClick={() => openPrintPreview('receipt', 'a4')}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {t('ready.actions.printReceiptA4')}
              </button>
              <button
                type="button"
                onClick={() => openPrintPreview('order-details', 'thermal')}
                className="w-full rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {t('ready.actions.printOrderDetailsThermal')}
              </button>
              <button
                type="button"
                onClick={() => openPrintPreview('order-details', 'a4')}
                className="w-full rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {t('ready.actions.printOrderDetailsA4')}
              </button>
              <div className="pt-2 mt-2 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 mb-2">{t('ready.actions.reportsA4Rprt') ?? 'A4 Reports'}</p>
                <button
                  type="button"
                  onClick={() => openPrintPreview('invoices-payments-rprt', 'a4')}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 mb-2"
                >
                  {t('ready.actions.printInvoicesPaymentsA4Rprt')}
                </button>
                <button
                  type="button"
                  onClick={() => openPrintPreview('payments-rprt', 'a4', 'desc')}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 mb-2"
                >
                  {t('ready.actions.printPaymentsA4DescRprt')}
                </button>
                <button
                  type="button"
                  onClick={() => openPrintPreview('payments-rprt', 'a4', 'asc')}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 mb-2"
                >
                  {t('ready.actions.printPaymentsA4AscRprt')}
                </button>
                <button
                  type="button"
                  onClick={() => openPrintPreview('history-rprt', 'a4')}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  {t('ready.actions.printOrderHistoryA4Rprt')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {printConfig && orderId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="relative h-[90vh] w-full max-w-4xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div>
                <h2 className="text-sm font-semibold">
                  {printConfig.type === 'receipt'
                    ? t('ready.actions.printReceipt')
                    : printConfig.type === 'order-details'
                      ? t('ready.itemsTitle')
                      : printConfig.type === 'invoices-payments-rprt'
                        ? t('ready.actions.printInvoicesPaymentsA4Rprt')
                        : printConfig.type === 'payments-rprt'
                          ? (printConfig.sort === 'asc' ? t('ready.actions.printPaymentsA4AscRprt') : t('ready.actions.printPaymentsA4DescRprt'))
                          : printConfig.type === 'history-rprt'
                            ? t('ready.actions.printOrderHistoryA4Rprt')
                            : t('ready.itemsTitle')}
                </h2>
                <p className="text-xs text-gray-500">
                  {printConfig.layout === 'thermal' ? '80mm' : 'A4'} Ã¢â‚¬Â¢ {order.orderNo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPrintConfig(null)}
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label={t('ready.actions.backToReady')}
              >
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>
            <div className="h-[calc(90vh-40px)]">
              <iframe
                title="print-preview"
                src={
                  printConfig.sort != null && printConfig.type === 'payments-rprt'
                    ? `/dashboard/ready/${orderId}/print/${printConfig.type}?layout=${printConfig.layout}&sort=${printConfig.sort}`
                    : `/dashboard/ready/${orderId}/print/${printConfig.type}?layout=${printConfig.layout}`
                }
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      )}
      {order && orderId ? (
        <OrderCollectPaymentModal
          open={collectOpen}
          onOpenChange={setCollectOpen}
          orderId={orderId}
          customerId={order.customerId}
          branchId={order.branchId}
          outstandingAmount={order.paymentSummary?.remaining ?? 0}
          currencyCode={order.currencyCode ?? 'OMR'}
          onCollected={() => loadOrder()}
        />
      ) : null}
    </div>
  );
}


