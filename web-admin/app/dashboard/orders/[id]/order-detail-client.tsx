'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft, Edit, Clock, Package, Link2, Copy, LayoutList } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { mapOrderFinancialSummaryView } from '@features/orders/lib/map-order-financial-summary-view';
import { OrderFinancialSummaryCards } from '@features/orders/ui/order-financial/order-financial-summary-cards';
import { OrderFinancialSummaryTab } from '@features/orders/ui/order-financial/order-financial-summary-tab';
import { OrderPaymentsCreditsTables } from '@features/orders/ui/order-financial/order-payments-credits-tables';
import { OrderInvoiceTaxTab } from '@features/orders/ui/order-financial/order-invoice-tax-tab';
import { OrderFinancialDebugPanel } from '@features/orders/ui/order-financial/order-financial-debug-panel';
import { OrderTimeline } from '@features/orders/ui/order-timeline';
import { OrderItemsList } from '@features/orders/ui/order-items-list';
import { OrderActions } from '@features/orders/ui/order-actions';
import { PrintLabelButton } from '@features/orders/ui/print-label-button';
import { OrdersFinancialTabRprt } from '@features/orders/ui/orders-financial-tab-rprt';
import { OrdersInvoicesTabRprt } from '@features/orders/ui/orders-invoices-tab-rprt';
import { OrdersVouchersTabRprt } from '@features/orders/ui/orders-vouchers-tab-rprt';
import { OrdersPreferencesTabRprt } from '@features/orders/ui/orders-preferences-tab-rprt';
import { OrdersEditHistoryTabRprt } from '@features/orders/ui/orders-edit-history-tab-rprt';
import type { OrderEditHistoryEntry } from '@features/orders/ui/orders-edit-history-tab-rprt';
import { isPreparationEnabled } from '@/lib/config/features';
import type { OrderFinancialData } from '@/app/actions/orders/get-order-financial';
import type { OrderPreferenceDtlColumn, OrderPreferenceRow } from '@/lib/orders/order-preferences-dtl';
import type { PaymentTransaction } from '@/lib/types/payment';
import type { Invoice } from '@/lib/types/payment';
import type { PaymentMethodCode } from '@/lib/types/payment';
import type { VoucherData } from '@/lib/types/voucher';
import { CmxTabsPanel } from '@ui/navigation';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { CmxTextarea } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { isOrderPaidStatus } from '@/lib/utils/order-payment-status';
import type { OrderStatus } from '@/lib/types/workflow';
import type { PrintLabelOrderInput } from '@features/orders/ui/print-label-button';

const TAB_IDS = [
  'financial_summary',
  'master',
  'items',
  'preferences',
  'financial_details',
  'payments_credits',
  'invoices',
  'vouchers',
  'history',
  'edit_history',
  'debug',
  'actions',
] as const;

type TabId = (typeof TAB_IDS)[number];

interface OrderDetailClientProps {
  order: Record<string, unknown>;
  financialData?: OrderFinancialData;
  orderPreferences: OrderPreferenceRow[];
  orderPreferenceDtlColumnLabels: Record<OrderPreferenceDtlColumn, string>;
  unappliedPayments: PaymentTransaction[];
  orderInvoices: Invoice[];
  vouchers: VoucherData[];
  editHistory: OrderEditHistoryEntry[];
  tenantOrgId: string;
  userId: string;
  canViewFinancialDebug: boolean;
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
  translations: Record<string, string>;
  locale: 'en' | 'ar';
  returnUrl?: string;
  returnLabel?: string;
}

export function OrderDetailClient({
  order,
  financialData,
  orderPreferences,
  orderPreferenceDtlColumnLabels,
  unappliedPayments,
  orderInvoices,
  vouchers,
  editHistory,
  tenantOrgId,
  userId,
  canViewFinancialDebug,
  processPaymentAction,
  applyPaymentToInvoiceAction,
  translations: t,
  locale,
  returnUrl = '/dashboard/orders',
  returnLabel,
}: OrderDetailClientProps) {
  const isRTL = useRTL();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tFin = useTranslations('orders.detail.financial');
  const tFull = useTranslations('orders.detailFull');
  const { currentTenant } = useAuth();
  const { trackByPiece } = useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');
  const { decimalPlaces, currencyCode: tenantCurrencyCode } = useTenantCurrency();
  const moneyLocale = locale === 'ar' ? 'ar' : 'en';
  const orderCurrency =
    (typeof order.currency_code === 'string' && order.currency_code.trim()) || tenantCurrencyCode;
  const fmtOrderMoney = (n: number) =>
    formatMoneyAmountWithCode(n, {
      currencyCode: orderCurrency,
      decimalPlaces,
      locale: moneyLocale,
    });

  const tabFromUrl = searchParams.get('tab');
  const activeTab: TabId = TAB_IDS.includes(tabFromUrl as TabId)
    ? (tabFromUrl as TabId)
    : 'financial_summary';

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  };

  const preferenceExtraTotal = useMemo(
    () =>
      orderPreferences.reduce((sum, row) => sum + Number(row.extra_price ?? 0), 0),
    [orderPreferences]
  );

  const primaryArInvoice = orderInvoices[0];
  const arInvoiceView = primaryArInvoice
    ? {
        id: primaryArInvoice.id,
        invoiceNo: primaryArInvoice.invoice_no,
        status: primaryArInvoice.status,
        amount: Number(primaryArInvoice.total ?? 0),
        dueDate: primaryArInvoice.due_date,
        paidAmount: Number(primaryArInvoice.paid_amount ?? 0),
        outstandingAmount: Number(primaryArInvoice.outstanding_amount ?? 0),
      }
    : null;

  const financialViewModel = useMemo(() => {
    if (!financialData?.snapshot) return null;
    const customer = order.org_customers_mst as {
      sys_customers_mst?: { first_name?: string; last_name?: string };
      customer_name?: string;
    } | undefined;
    const customerName =
      order.customer_name?.toString() ||
      [customer?.sys_customers_mst?.first_name, customer?.sys_customers_mst?.last_name]
        .filter(Boolean)
        .join(' ') ||
      undefined;
    const branch = order.branch as { branch_name?: string } | undefined;
    return mapOrderFinancialSummaryView({
      ...financialData,
      order: {
        rounding_adjustment_amount: Number(order.rounding_adjustment_amount ?? 0),
        status: String(order.status ?? ''),
        received_at: order.received_at ? String(order.received_at) : undefined,
        customer_name: customerName,
        branch_name: branch?.branch_name,
      },
      preferenceExtraTotal,
      pieceExtraTotal: 0,
      arInvoice: arInvoiceView,
      taxDocument: (() => {
        const doc = financialData.taxDocuments?.[0];
        if (doc) {
          return {
            id: doc.id,
            documentNo: doc.document_no ?? undefined,
            documentType: doc.document_type,
            status: doc.status,
            triggerEvent: doc.trigger_event,
            fiscalYear: doc.fiscal_year,
            sequenceNumber: doc.sequence_number,
            totalAmount: doc.total_amount,
            taxAmount: doc.tax_amount,
            issuedAt: doc.issued_at ?? undefined,
            issuedBy: doc.issued_by ?? undefined,
            cancelledAt: doc.cancelled_at ?? undefined,
            cancellationReason: doc.cancellation_reason ?? undefined,
            supersedesId: doc.supersedes_id ?? undefined,
          };
        }
        // fallback to legacy snapshot header fields
        const snap = financialData.snapshot;
        if (!snap.taxDocumentId && !snap.taxDocumentNo) return null;
        return {
          id: snap.taxDocumentId ?? undefined,
          documentNo: snap.taxDocumentNo ?? undefined,
          documentType: snap.taxDocumentType ?? undefined,
          status: snap.taxDocumentStatus ?? undefined,
        };
      })(),
    });
  }, [financialData, order, preferenceExtraTotal, arInvoiceView]);

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
  const displayOrderTotal = financialViewModel?.amounts.totalAmount ?? Number(order.total ?? 0);

  const tenantId = currentTenant?.tenant_id;
  const normalizedOrderPaid = isOrderPaidStatus(String(order.payment_status ?? ''), {
    paymentTypeCode: typeof order.payment_type_code === 'string' ? order.payment_type_code : null,
    payOnCollectionAmount: Number(order.pay_on_collection_amount ?? 0),
    outstandingAmount: Number(order.outstanding_amount ?? 0),
  });

  const statusColors: Record<string, string> = {
    intake: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200',
    preparation: 'bg-purple-100 text-purple-800 border-purple-200',
    processing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    ready: 'bg-green-100 text-green-800 border-green-200',
    delivered: 'bg-gray-100 text-gray-800 border-gray-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
  };

  const customer = (order.org_customers_mst as {
    sys_customers_mst?: { first_name?: string; last_name?: string; phone?: string; email?: string };
    loyalty_points?: number;
  })?.sys_customers_mst;
  const items = (order.items ?? order.org_order_items_dtl ?? []) as unknown[];

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

  const handleApplyToInvoice = () => {
    if (!applyModalPaymentId || !applyModalInvoiceId) return;
    setApplyError(null);
    startApplyTransition(async () => {
      const result = await applyPaymentToInvoiceAction(
        applyModalPaymentId,
        applyModalInvoiceId,
        userId,
        String(order.id)
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
        orderId: String(order.id),
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

  const masterFields = [
    { label: tFin('header.orderNo'), value: order.order_no },
    { label: tFin('header.customer'), value: financialViewModel?.customerName ?? '—' },
    { label: tFin('header.branch'), value: financialViewModel?.branchName ?? '—' },
    { label: tFin('header.orderStatus'), value: String(order.status ?? '—') },
    { label: tFin('header.paymentStatus'), value: String(order.payment_status ?? '—') },
    { label: tFin('header.paymentPlan'), value: String(order.payment_type_code ?? '—') },
    { label: tFin('header.currency'), value: orderCurrency },
  ];

  const tabs = [
    {
      id: 'financial_summary',
      label: tFin('tabs.financialSummary'),
      content: financialViewModel ? (
        <OrderFinancialSummaryTab viewModel={financialViewModel} />
      ) : (
        <p className="text-sm text-muted-foreground">{tFin('financialDataUnavailable')}</p>
      ),
    },
    {
      id: 'master',
      label: tFin('tabs.master'),
      content: (
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{tFin('tabs.master')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="grid gap-3 sm:grid-cols-2">
            {masterFields.map((f) => (
              <div key={f.label} className={isRTL ? 'text-right' : 'text-left'}>
                <div className="text-xs text-muted-foreground">{f.label}</div>
                <div className="text-sm font-medium">{String(f.value)}</div>
              </div>
            ))}
          </CmxCardContent>
        </CmxCard>
      ),
    },
    {
      id: 'items',
      label: tFin('tabs.items'),
      content: (
        <CmxCard>
          <CmxCardContent className="pt-6">
            <OrderItemsList
              items={items as Parameters<typeof OrderItemsList>[0]['items']}
              orderId={String(order.id)}
              tenantId={currentTenant?.tenant_id}
              branchId={order.branch_id as string | undefined}
              trackByPiece={trackByPiece}
              readOnly
            />
          </CmxCardContent>
        </CmxCard>
      ),
    },
    {
      id: 'preferences',
      label: tFin('tabs.preferences'),
      content: (
        <OrdersPreferencesTabRprt
          preferences={orderPreferences}
          currencyCode={orderCurrency}
          locale={locale}
          dtlColumnLabels={orderPreferenceDtlColumnLabels}
          translations={{
            emptyPreferences: tFull('emptyPreferences'),
            levelOrder: tFull('preferences.levelOrder'),
            levelItem: tFull('preferences.levelItem'),
            levelPiece: tFull('preferences.levelPiece'),
            kindServicePrefs: tFull('preferences.kindServicePrefs'),
            kindPackingPrefs: tFull('preferences.kindPackingPrefs'),
            kindConditionStain: tFull('preferences.kindConditionStain'),
            kindConditionDamage: tFull('preferences.kindConditionDamage'),
            kindColor: tFull('preferences.kindColor'),
            kindNote: tFull('preferences.kindNote'),
            ownerSystem: tFull('preferences.ownerSystem'),
            ownerOverride: tFull('preferences.ownerOverride'),
            sourceOrderCreate: tFull('preferences.sourceOrderCreate'),
            sourceManual: tFull('preferences.sourceManual'),
            sourceOrderUpdate: tFull('preferences.sourceOrderUpdate'),
            totalExtraCharge: tFull('preferences.totalExtraCharge'),
            orderLevelPrefs: tFull('preferences.orderLevelPrefs'),
            itemLevelPrefs: tFull('preferences.itemLevelPrefs'),
            pieceLevelPrefs: tFull('preferences.pieceLevelPrefs'),
            rowCountSuffix: tFull('preferences.rowCountSuffix'),
            paginationRowsPerPage: tFull('preferences.pagination.rowsPerPage'),
            paginationShowing: tFull('preferences.pagination.showing'),
            paginationPrevious: tFull('preferences.pagination.previous'),
            paginationNext: tFull('preferences.pagination.next'),
            paginationPageOf: tFull('preferences.pagination.pageOf'),
            paginationFirst: tFull('preferences.pagination.first'),
            paginationLast: tFull('preferences.pagination.last'),
            paginationGoToPage: tFull('preferences.pagination.goToPage'),
            paginationGo: tFull('preferences.pagination.go'),
            paginationResetFilters: tFull('preferences.pagination.resetFilters'),
            paginationFilterPlaceholder: tFull('preferences.pagination.filterPlaceholder'),
            paginationEmptyFiltered: tFull('preferences.pagination.emptyFiltered'),
            paginationGlobalSearchPlaceholder: tFull('preferences.pagination.globalSearchPlaceholder'),
            paginationExportCsv: tFull('preferences.pagination.exportCsv'),
            paginationColumnsMenu: tFull('preferences.pagination.columnsMenu'),
            paginationToggleColumns: tFull('preferences.pagination.toggleColumns'),
            paginationClearColumnFilter: tFull('preferences.pagination.clearColumnFilter'),
            paginationEmptyFilteredHint: tFull('preferences.pagination.emptyFilteredHint'),
            paginationDensity: tFull('preferences.pagination.density'),
            paginationDensityCompact: tFull('preferences.pagination.densityCompact'),
            paginationDensityStandard: tFull('preferences.pagination.densityStandard'),
            paginationDensityComfortable: tFull('preferences.pagination.densityComfortable'),
            paginationCopyToClipboard: tFull('preferences.pagination.copyToClipboard'),
            valueYes: tFull('preferences.confirmed'),
            valueNo: tFull('preferences.notConfirmed'),
          }}
        />
      ),
    },
    {
      id: 'financial_details',
      label: tFin('tabs.financialDetails'),
      content: financialData ? (
        <OrdersFinancialTabRprt {...financialData} />
      ) : (
        <p className="text-sm text-muted-foreground">{tFin('financialDataUnavailable')}</p>
      ),
    },
    {
      id: 'payments_credits',
      label: tFin('tabs.paymentsCredits'),
      content: financialViewModel ? (
        <OrderPaymentsCreditsTables viewModel={financialViewModel} />
      ) : null,
    },
    {
      id: 'invoices',
      label: tFin('tabs.invoices'),
      content: financialViewModel ? (
        <OrderInvoiceTaxTab viewModel={financialViewModel} />
      ) : (
        <OrdersInvoicesTabRprt
          invoices={orderInvoices}
          orderId={String(order.id)}
          orderBasePath={`/dashboard/orders/${order.id}`}
          translations={{
            emptyInvoices: t.emptyInvoices ?? tFull('emptyInvoices'),
            viewPayments: t.viewPayments ?? tFull('viewPayments'),
            viewReceiptVouchers: t.viewReceiptVouchers ?? tFull('viewReceiptVouchers'),
            invoiceNo: t.invoiceNo ?? 'Invoice #',
          }}
        />
      ),
    },
    {
      id: 'vouchers',
      label: tFin('tabs.vouchers'),
      content: (
        <OrdersVouchersTabRprt
          vouchers={vouchers}
          orderId={String(order.id)}
          orderBasePath={`/dashboard/orders/${order.id}`}
          translations={{
            emptyVouchers: t.emptyVouchers ?? tFull('emptyVouchers'),
            viewPayments: t.viewPayments ?? tFull('viewPayments'),
            voucherNo: t.voucherNo ?? 'Voucher #',
          }}
        />
      ),
    },
    {
      id: 'history',
      label: tFin('tabs.history'),
      content: (
        <CmxCard>
          <CmxCardContent className="pt-6">
            <OrderTimeline
              orderId={String(order.id)}
              currentStatus={String(order.status) as OrderStatus}
            />
          </CmxCardContent>
        </CmxCard>
      ),
    },
    {
      id: 'edit_history',
      label: tFin('tabs.editHistory'),
      content: (
        <OrdersEditHistoryTabRprt
          entries={editHistory}
          translations={{
            emptyEditHistory: t.emptyEditHistory ?? tFull('editHistory.empty'),
            editHistoryTitle: t.editHistoryTitle ?? tFull('editHistory.title'),
            editNo: t.editNo ?? tFull('editHistory.editNo'),
            editedBy: t.editedBy ?? tFull('editHistory.editedBy'),
            editedAt: t.editedAt ?? tFull('editHistory.editedAt'),
            changeSummary: t.changeSummary ?? tFull('editHistory.changeSummary'),
            fieldChanges: t.fieldChanges ?? tFull('editHistory.fieldChanges'),
            itemChanges: t.itemChanges ?? tFull('editHistory.itemChanges'),
            pricingChanges: t.pricingChanges ?? tFull('editHistory.pricingChanges'),
            paymentAdjustment: t.paymentAdjustment ?? tFull('editHistory.paymentAdjustment'),
            fieldName: t.fieldName ?? tFull('editHistory.fieldName'),
            oldValue: t.oldValue ?? tFull('editHistory.oldValue'),
            newValue: t.newValue ?? tFull('editHistory.newValue'),
            itemAdded: t.itemAdded ?? tFull('editHistory.itemAdded'),
            itemRemoved: t.itemRemoved ?? tFull('editHistory.itemRemoved'),
            itemModified: t.itemModified ?? tFull('editHistory.itemModified'),
            oldSubtotal: t.oldSubtotal ?? tFull('editHistory.oldSubtotal'),
            newSubtotal: t.newSubtotal ?? tFull('editHistory.newSubtotal'),
            oldTotal: t.oldTotal ?? tFull('editHistory.oldTotal'),
            newTotal: t.newTotal ?? tFull('editHistory.newTotal'),
            difference: t.difference ?? tFull('editHistory.difference'),
            noChangesRecorded: t.noChangesRecorded ?? tFull('editHistory.noChangesRecorded'),
            charge: t.charge ?? tFull('editHistory.charge'),
            refund: t.refund ?? tFull('editHistory.refund'),
            ipAddress: t.ipAddress ?? tFull('editHistory.ipAddress'),
            viewDetails: t.viewDetails ?? tFull('editHistory.viewDetails'),
            hideDetails: t.hideDetails ?? tFull('editHistory.hideDetails'),
            qty: t.qty ?? tFull('editHistory.qty'),
            price: t.price ?? tFull('editHistory.price'),
            totalPrice: t.totalPrice ?? tFull('editHistory.totalPrice'),
            notes: t.notes ?? tFull('editHistory.notes'),
            stain: t.stain ?? tFull('editHistory.stain'),
            damage: t.damage ?? tFull('editHistory.damage'),
            stainNotes: t.stainNotes ?? tFull('editHistory.stainNotes'),
            damageNotes: t.damageNotes ?? tFull('editHistory.damageNotes'),
            yes: t.commonYes ?? 'Yes',
            no: t.commonNo ?? 'No',
          }}
        />
      ),
    },
    ...(canViewFinancialDebug
      ? [
          {
            id: 'debug',
            label: tFin('tabs.debug'),
            content: financialViewModel ? (
              <OrderFinancialDebugPanel viewModel={financialViewModel} />
            ) : null,
          },
        ]
      : []),
    {
      id: 'actions',
      label: tFin('tabs.actions'),
      content: (
        <div className="grid gap-4 lg:grid-cols-2">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t.quickActions}</CmxCardTitle>
            </CmxCardHeader>
            <CmxCardContent>
              <OrderActions
                order={
                  order as {
                    id: string;
                    status: string;
                    tenant_org_id: string;
                  }
                }
              />
            </CmxCardContent>
          </CmxCard>
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t.recordDepositPos}</CmxCardTitle>
            </CmxCardHeader>
            <CmxCardContent>
              <form onSubmit={handleRecordDepositPos} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium">{t.recordPaymentAmount}</label>
                  <CmxInput
                    type="number"
                    step={10 ** -decimalPlaces}
                    min={0}
                    value={depositAmount || ''}
                    onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                    className="mt-1 text-end"
                  />
                </div>
                <div className="flex gap-2">
                  <CmxButton
                    type="button"
                    variant={depositMethod === 'CASH' ? 'primary' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setDepositMethod('CASH')}
                  >
                    {t.recordPaymentCash}
                  </CmxButton>
                  <CmxButton
                    type="button"
                    variant={depositMethod === 'CARD' ? 'primary' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setDepositMethod('CARD')}
                  >
                    {t.recordPaymentCard}
                  </CmxButton>
                </div>
                <CmxTextarea
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                  rows={2}
                  placeholder={t.notes}
                />
                {depositError && <p className="text-sm text-destructive">{depositError}</p>}
                {depositSuccess && <p className="text-sm text-emerald-600">{depositSuccess}</p>}
                <CmxButton type="submit" variant="primary" disabled={depositPending || depositAmount <= 0} className="w-full">
                  {depositPending ? t.recordPaymentProcessing : t.recordPaymentSubmit}
                </CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className={`flex flex-wrap items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'justify-between'}`}>
        <Link
          href={returnUrl}
          className={`inline-flex items-center text-sm text-muted-foreground hover:text-foreground ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <ChevronLeft className={`h-4 w-4 ${isRTL ? 'ms-1 rotate-180' : 'me-1'}`} />
          {returnLabel || t.backToOrders}
        </Link>
        <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <PrintLabelButton
            order={order as PrintLabelOrderInput}
          />
          <Link href={`/dashboard/orders/${order.id}/full?returnUrl=${encodeURIComponent(`/dashboard/orders/${order.id}`)}`}>
            <CmxButton variant="outline" size="sm" className="gap-2">
              <LayoutList className="h-4 w-4" />
              {t.viewFullDetails}
            </CmxButton>
          </Link>
          <Link href={`/dashboard/orders/${order.id}/edit`}>
            <CmxButton variant="outline" size="sm" className="gap-2">
              <Edit className="h-4 w-4" />
              {t.edit}
            </CmxButton>
          </Link>
          {publicTrackingPath && (
            <CmxButton variant="outline" size="sm" onClick={handleCopyPublicLink} className="gap-2">
              <Link2 className="h-4 w-4" />
              {t.publicTrackingLink}
              <Copy className="h-3 w-3 opacity-70" />
            </CmxButton>
          )}
        </div>
      </div>

      <CmxCard>
        <CmxCardContent className="pt-6">
          <div className={`flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
            <div className={`space-y-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h1 className="text-2xl font-bold">{String(order.order_no)}</h1>
                <span
                  className={`rounded-full border px-3 py-0.5 text-xs font-medium ${
                    statusColors[String(order.status)] ?? statusColors.intake
                  }`}
                >
                  {String(order.status).replace(/_/g, ' ').toUpperCase()}
                </span>
                {normalizedOrderPaid ? (
                  <Badge variant="success">{t.paid}</Badge>
                ) : (
                  <Badge variant="warning">{t.pendingPayment}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {tFin('header.customer')}: {financialViewModel?.customerName ?? '—'}
                {' · '}
                {tFin('header.paymentPlan')}: {String(order.payment_type_code ?? '—')}
              </p>
              {order.received_at && (
                <p className={`flex items-center gap-1 text-sm text-muted-foreground ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Clock className="h-4 w-4" />
                  {new Date(String(order.received_at)).toLocaleString(moneyLocale === 'ar' ? 'ar-OM' : 'en-OM')}
                </p>
              )}
            </div>
            <div className={isRTL ? 'text-left' : 'text-right'}>
              <div className="text-xs text-muted-foreground">{tFin('card.orderTotal')}</div>
              <div className="text-3xl font-bold tabular-nums">
                {fmtOrderMoney(displayOrderTotal)}
              </div>
            </div>
          </div>

          {order.preparation_status && (
            <div className="mt-4 border-t border-border pt-4">
              <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-sm text-muted-foreground">
                  {t.preparationStatus}: {String(order.preparation_status)}
                </span>
                {isPreparationEnabled() && order.preparation_status === 'pending' && (
                  <Link href={`/dashboard/preparation/${order.id}`} className="text-sm font-medium text-primary">
                    {t.startPreparation}
                  </Link>
                )}
              </div>
            </div>
          )}
        </CmxCardContent>
      </CmxCard>

      {financialViewModel && <OrderFinancialSummaryCards viewModel={financialViewModel} />}

      <CmxTabsPanel tabs={tabs} value={activeTab} onChange={handleTabChange} />

      {applyModalPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
          <div className="mx-4 w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{t.selectInvoiceToApply}</h3>
            <select
              value={applyModalInvoiceId}
              onChange={(e) => setApplyModalInvoiceId(e.target.value)}
              className="w-full rounded-md border border-input px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {orderInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_no} — {fmtOrderMoney(Number(inv.total))}
                </option>
              ))}
            </select>
            {applyError && <p className="mt-2 text-sm text-destructive">{applyError}</p>}
            <div className={`mt-4 flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <CmxButton
                variant="outline"
                onClick={() => {
                  setApplyModalPaymentId(null);
                  setApplyModalInvoiceId('');
                  setApplyError(null);
                }}
              >
                {t.recordPaymentCancel}
              </CmxButton>
              <CmxButton
                variant="primary"
                disabled={!applyModalInvoiceId || applyPending}
                onClick={handleApplyToInvoice}
              >
                {applyPending ? t.recordPaymentProcessing : t.applyToInvoice}
              </CmxButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
