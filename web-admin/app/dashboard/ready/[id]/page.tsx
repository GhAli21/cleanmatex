/**
 * Ready Screen - Detail Page
 * Delivery actions and payment collection
 */

'use client';

import { OrderFinancialView } from '@features/orders/order-fin-view/ui/order-financial-view';
import { CmxCodeChip } from '@ui/data-display/cmx-code-chip';
import { CmxButton } from '@ui/primitives';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { OrderStageFiles } from '@features/orders/ui/order-stage-files';
import { FILE_REF_TYPES, FILE_SOURCES } from '@/lib/constants/file-util';
import { PiecePhotosControl } from '@features/orders/ui/pieces/piece-photos';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { OrderPiecesManager } from '@features/orders/ui/OrderPiecesManager';
import { PiecesErrorBoundary } from '@features/orders/ui/PiecesErrorBoundary';
import { SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
import { OrderCollectPaymentModal } from '@features/orders/ui/collect-payment/order-collect-payment-modal';
import { CollectPaymentButton } from '@features/orders/ui/collect-payment/collect-payment-button';
import {
  mapReadyOrderFromStateResponse,
  type ReadyOrder,
  type ReadyOrderStateResponse,
} from '@features/orders/model/ready-order-types';
import { WorkflowActionBar } from '@features/workflow/ui/WorkflowActionBar';
import { PickupReleaseStatus } from '@features/pickup/ui/pickup-release-status';
import { useOperationalZones } from '@/lib/hooks/use-operational-zones';
import { ReadyFulfilmentPanel } from '@features/pickup/ui/ready-fulfilment-panel';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import { resolveSafeDashboardReturnUrl } from '@/lib/utils/safe-dashboard-return-url';
import { OrderLineNetNote } from '@features/orders/ui/order-line-net-note';

/**
 *
 */
export default function ReadyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('workflow');
  const tOrders = useTranslations('orders');
  const tInvoices = useTranslations('invoices');
  const tPieces = useTranslations('newOrder.pieces');
  const { currentTenant, user } = useAuth();
  const { formatMoneyWithCode, currencyCode: tenantCurrencyCode } = useTenantCurrency();
  const { trackByPiece } = useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');

  const [order, setOrder] = useState<ReadyOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [printConfig, setPrintConfig] = useState<{
    type: 'receipt' | 'order-details' | 'invoices-payments-rprt' | 'payments-rprt' | 'history-rprt';
    layout: 'thermal' | 'a4';
    sort?: 'asc' | 'desc';
  } | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);
  /** Which control opened the collect dialog — the pickup card's CTA collects in
   *  order to release the handover, the payment card's is a plain collection. */
  const [collectIntent, setCollectIntent] = useState<'payment' | 'handover'>('payment');
  const [actionBarKey, setActionBarKey] = useState(0);

  const orderId = (params as any)?.id as string | undefined;
  const returnUrl = resolveSafeDashboardReturnUrl(searchParams.get('returnUrl'), '/dashboard/ready');

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

  const openPrintPreview = (
    type: 'receipt' | 'order-details' | 'invoices-payments-rprt' | 'payments-rprt' | 'history-rprt',
    layout: 'thermal' | 'a4',
    sort?: 'asc' | 'desc'
  ) => {
    setPrintConfig({ type, layout, sort });
  };

  const isReadyForPickup = order?.currentStatus === 'ready_for_pickup';
  const { zoneFor } = useOperationalZones('ready_by', [order?.branchId]);
  const opsZone = zoneFor(order?.branchId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-danger-bg border border-danger-border text-danger-text px-4 py-3 rounded-lg">
        {t('ready.messages.notFound')}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Link href={returnUrl} className="text-primary-text hover:underline mb-2 inline-block">
          &laquo; {t('ready.actions.backToReady')}
        </Link>
        <h1 className="text-3xl font-bold">
          {t('screens.ready')}{' '}
          <CmxCodeChip code={order.orderNo} kind="order" size="md" />
        </h1>
        <p className="text-muted-foreground mt-1">
          {order.customer.name} &nbsp;&bull;&nbsp; {order.customer.phone}
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-danger-bg border border-danger-border text-danger-text px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="font-semibold mb-4">{t('ready.itemsTitle')}</h3>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('ready.quantity')}: {item.quantity}
                      </p>
                    </div>
                    <div className="text-end">
                      <span className="font-bold text-primary-text">
                        {formatMoneyWithCode(item.totalPrice)}
                      </span>
                      <OrderLineNetNote gross={item.totalPrice} net={item.netAmount} format={formatMoneyWithCode} />
                    </div>
                  </div>

                  {/* Pieces Section - Expandable */}
                  {!trackByPiece && orderId && (
                    <PiecePhotosControl
                      orderId={orderId}
                      refType={FILE_REF_TYPES.ORDER_ITEM}
                      refId={item.id}
                      label={item.productName}
                      source={FILE_SOURCES.ORDER_READY}
                    />
                  )}
                  {trackByPiece && orderId && currentTenant?.tenant_id && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <CmxButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleItemExpansion(item.id)}
                        className="w-full justify-between px-0 text-sm font-medium text-foreground hover:text-foreground/80"
                      >
                        <span>
                          {tPieces('viewPieces') || 'View Pieces'}
                        </span>
                        {expandedItemIds.has(item.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </CmxButton>
                      
                      {expandedItemIds.has(item.id) && (
                        <div className="mt-3">
                          <PiecesErrorBoundary>
                            <OrderPiecesManager
                              orderId={orderId}
                              itemId={item.id}
                              fileSource={FILE_SOURCES.ORDER_READY}
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

          <div className="bg-success-bg border border-success-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{t('ready.totalAmount')}:</span>
              <span className="font-bold text-2xl text-success-text">
                {formatMoneyWithCode(order.total)}
              </span>
            </div>
          </div>

          <div className="bg-info-bg border border-info-border rounded-lg p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{t('ready.rack')}:</span>
              <span className="font-bold text-xl text-primary-text">
                {order.rackLocation?.trim() || '—'}
              </span>
            </div>
          </div>
          {orderId && <OrderStageFiles orderId={orderId} source={FILE_SOURCES.ORDER_READY} />}
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4 space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              {t('ready.pickupRelease.title')}
            </h2>
            <PickupReleaseStatus
              release={order.pickupRelease}
              workflowStatus={order.currentStatus}
              showTimestamp
              opsZone={opsZone}
            />
            <p className="text-xs text-muted-foreground">
              {isReadyForPickup
                ? t('ready.pickupRelease.availableHelp')
                : t('ready.pickupRelease.notReleasedHelp')}
            </p>
          </section>
          {orderId ? (
            <>
              {(order.currentStatus === 'ready' || isReadyForPickup) ? (
                <ReadyFulfilmentPanel
                  key={`ready-fulfilment-${actionBarKey}`}
                  orderId={orderId}
                  orderNo={order.orderNo}
                  customerId={order.customerId}
                  customerName={order.customer.name}
                  paymentTypeCode={order.paymentTypeCode}
                  outstandingAmount={order.paymentSummary?.remaining ?? 0}
                  formattedOutstandingAmount={formatMoneyWithCode(order.paymentSummary?.remaining ?? 0)}
                  rackLocation={order.rackLocation}
                  onCollectPayment={() => {
                    setCollectIntent('handover');
                    setCollectOpen(true);
                  }}
                  onCompleted={() => {
                    setActionBarKey((key) => key + 1);
                    router.replace(returnUrl);
                  }}
                  onReleaseSuccess={() => {
                    void loadOrder();
                    setActionBarKey((key) => key + 1);
                  }}
                />
              ) : null}
              <WorkflowActionBar
                key={`ready-actions-${actionBarKey}-${order.rackLocation ?? ''}`}
                orderId={orderId}
                screen="ready_release"
                hideWhenEmpty
                hiddenActionCodes={[
                  WORKFLOW_ACTIONS.RELEASE_FOR_PICKUP,
                  ...(isReadyForPickup ? [WORKFLOW_ACTIONS.RELEASE_FOR_DELIVERY] : []),
                ]}
                onActionSuccess={() => {
                  void loadOrder();
                }}
              />
            </>
          ) : null}
          {/* Payment section */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="font-semibold mb-3">{t('ready.paymentSection.title')}</h3>
            {order.paymentSummary && (
              <div className="space-y-2 mb-4">
                {/* P6-04: total, paid, credits and the balance word from the read model. */}
                {orderId && <OrderFinancialView source={{ kind: 'order', orderId }} config={{ preset: 'totals', layout: 'plain', density: 'compact', columns: 1 }} />}
                {order.paymentSummary.remaining > 0 ? (
                  <>
                    {currentTenant?.tenant_id && orderId && (() => {
                      const isPoc =
                        order.paymentTypeCode === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION;
                      if (isPoc) {
                        return (
                          <div className="mt-3 pt-3 border-t border-border">
                            <CollectPaymentButton
                              onCollect={() => {
                                setCollectIntent('payment');
                                setCollectOpen(true);
                              }}
                              className="w-full bg-success text-on-solid hover:bg-success/90"
                            />
                          </div>
                        );
                      }
                      // Canonical path for invoice/on-account money: the
                      // customer account receipt flow (preview → post →
                      // allocation across invoices). The legacy per-invoice
                      // record-payment form wrote the deprecated
                      // legacy payments ledger (ADR-002) and was removed.
                      return (
                        <div className="mt-3 pt-3 border-t border-border space-y-2">
                          <Link
                            href="/dashboard/customers/account-receipt"
                            className="block w-full rounded-lg bg-success px-4 py-2 text-center text-sm font-semibold text-on-solid hover:bg-success/90"
                          >
                            {t('ready.paymentSection.receiveAccountPayment')}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {t('ready.paymentSection.receiveAccountPaymentHint')}
                          </p>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <p className="text-sm font-medium text-success-text">{t('ready.paymentSection.paidInFull')}</p>
                )}
              </div>
            )}

            <div className="mt-2 space-y-2">
              <CmxButton
                type="button"
                variant="primary"
                size="sm"
                onClick={() => openPrintPreview('receipt', 'thermal')}
                className="w-full"
              >
                {t('ready.actions.printReceiptThermal')}
              </CmxButton>
              <CmxButton
                type="button"
                variant="primary"
                size="sm"
                onClick={() => openPrintPreview('receipt', 'a4')}
                className="w-full"
              >
                {t('ready.actions.printReceiptA4')}
              </CmxButton>
              <CmxButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => openPrintPreview('order-details', 'thermal')}
                className="w-full bg-foreground text-background hover:bg-foreground/90"
              >
                {t('ready.actions.printOrderDetailsThermal')}
              </CmxButton>
              <CmxButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => openPrintPreview('order-details', 'a4')}
                className="w-full bg-foreground text-background hover:bg-foreground/90"
              >
                {t('ready.actions.printOrderDetailsA4')}
              </CmxButton>
              <div className="pt-2 mt-2 border-t border-border space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t('ready.actions.reportsA4Rprt') ?? 'A4 Reports'}</p>
                <CmxButton
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => openPrintPreview('invoices-payments-rprt', 'a4')}
                  className="w-full"
                >
                  {t('ready.actions.printInvoicesPaymentsA4Rprt')}
                </CmxButton>
                <CmxButton
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => openPrintPreview('payments-rprt', 'a4', 'desc')}
                  className="w-full"
                >
                  {t('ready.actions.printPaymentsA4DescRprt')}
                </CmxButton>
                <CmxButton
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => openPrintPreview('payments-rprt', 'a4', 'asc')}
                  className="w-full"
                >
                  {t('ready.actions.printPaymentsA4AscRprt')}
                </CmxButton>
                <CmxButton
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => openPrintPreview('history-rprt', 'a4')}
                  className="w-full"
                >
                  {t('ready.actions.printOrderHistoryA4Rprt')}
                </CmxButton>
              </div>
            </div>
          </div>
        </div>
      </div>
      <CmxDialog
        open={Boolean(printConfig && orderId)}
        onOpenChange={(next) => { if (!next) setPrintConfig(null); }}
      >
        <CmxDialogContent className="h-[90vh] max-w-4xl w-full p-0 flex flex-col">
          {printConfig && orderId && (
            <>
              <CmxDialogHeader className="border-b px-4 py-2">
                <CmxDialogTitle className="text-sm font-semibold">
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
                </CmxDialogTitle>
                <CmxDialogDescription className="text-xs tabular-nums">
                  {printConfig.layout === 'thermal' ? '80mm' : 'A4'} · <bdi dir="ltr">{order.orderNo}</bdi>
                </CmxDialogDescription>
              </CmxDialogHeader>
              <div className="flex-1 min-h-0">
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
            </>
          )}
        </CmxDialogContent>
      </CmxDialog>
      {order && orderId ? (
        <OrderCollectPaymentModal
          open={collectOpen}
          onOpenChange={setCollectOpen}
          orderId={orderId}
          customerId={order.customerId}
          branchId={order.branchId}
          outstandingAmount={order.paymentSummary?.remaining ?? 0}
          // Falls back to the resolved tenant currency, never a literal: a
          // hardcoded 'OMR' silently mislabels money for every other GCC tenant
          // (no-default rule for currency_code / locale fields).
          currencyCode={order.currencyCode ?? tenantCurrencyCode}
          onCollected={() => {
            void loadOrder();
            setActionBarKey((key) => key + 1);
          }}
          // Ready is the only surface with print infrastructure, so it is the
          // only one that passes this. Closes B04's deferred receipt gap.
          onPrintReceipt={() => openPrintPreview('receipt', 'thermal')}
          handoverIntent={collectIntent === 'handover'}
        />
      ) : null}
    </div>
  );
}
