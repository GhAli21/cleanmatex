'use client';

import { useState, useTransition } from 'react';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Edit, Clock, Package, Link2, Copy } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { CREDIT_APPLICATION_TYPES, TAX_TYPES } from '@/lib/constants/order-financial';
import { OrderTimeline } from '@features/orders/ui/order-timeline';
import { OrderItemsList } from '@features/orders/ui/order-items-list';
import { OrderDiscountBreakdown } from '@features/orders/ui/order-discount-breakdown';
import { OrderActions } from '@features/orders/ui/order-actions';
import { PrintLabelButton } from '@features/orders/ui/print-label-button';
import { CmxTabsPanel } from '@ui/navigation/cmx-tabs-panel';
import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxInput } from '@ui/primitives/cmx-input';
import { CmxTextarea } from '@ui/primitives/cmx-textarea';
import { CmxCopyableCell } from '@ui/data-display/cmx-copyable-cell';
import { isPreparationEnabled } from '@/lib/config/features';
import { OrdersInvoicesTabRprt } from '@features/orders/ui/orders-invoices-tab-rprt';
import { OrdersVouchersTabRprt } from '@features/orders/ui/orders-vouchers-tab-rprt';
import { OrdersPaymentsTabRprt } from '@features/orders/ui/orders-payments-tab-rprt';
import { OrdersStockTabRprt } from '@features/orders/ui/orders-stock-tab-rprt';
import { OrdersReceiptsTabRprt } from '@features/orders/ui/orders-receipts-tab-rprt';
import { OrdersEditHistoryTabRprt } from '@features/orders/ui/orders-edit-history-tab-rprt';
import type { OrderEditHistoryEntry } from '@features/orders/ui/orders-edit-history-tab-rprt';
import { OrdersPreferencesTabRprt } from '@features/orders/ui/orders-preferences-tab-rprt';
import { OrdersFinancialTabRprt } from '@features/orders/ui/orders-financial-tab-rprt';
import type { OrderPreferenceDtlColumn, OrderPreferenceRow } from '@/lib/orders/order-preferences-dtl';
import type {
  OrderAdjustmentRow,
  OrderChargeRow,
  OrderCreditApplicationRow,
  OrderDiscountRow,
  OrderFinancialSnapshot,
  OrderFinancialTimelineRow,
  OrderTaxRow,
  OrderPaymentRow,
  OrderRefundRow,
} from '@/app/actions/orders/get-order-financial';
import type { PaymentTransaction } from '@/lib/types/payment';
import type { Invoice } from '@/lib/types/payment';
import type { PaymentMethodCode } from '@/lib/types/payment';
import type { VoucherData } from '@/lib/types/voucher';
import type { StockTransactionWithProduct } from '@/lib/services/inventory-service';
import type { OrderDiscountLine } from '@/lib/db/order-discounts-types';
import type { OrderItem } from '@/types/order';
import type { OrderStatus } from '@/lib/types/workflow';
import type { PrintLabelOrderInput } from '@features/orders/ui/print-label-button';
import { isOrderPaidStatus } from '@/lib/utils/order-payment-status';

const TAB_IDS = ['master', 'items', 'preferences', 'history', 'edit_history', 'invoices', 'vouchers', 'payments', 'actions', 'stock', 'receipts', 'financial', 'customer', 'notes'] as const;

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
  editHistory: OrderEditHistoryEntry[];
  orderPreferences: OrderPreferenceRow[];
  discountLines?: OrderDiscountLine[];
  financialData?: {
    snapshot: OrderFinancialSnapshot;
    charges: OrderChargeRow[];
    discounts: OrderDiscountRow[];
    taxes: OrderTaxRow[];
    payments: OrderPaymentRow[];
    creditApplications: OrderCreditApplicationRow[];
    refunds: OrderRefundRow[];
    adjustments: OrderAdjustmentRow[];
    voucherReferences: Array<{ voucherId: string; voucherLineId: string | null; source: 'PAYMENT' | 'REFUND' | 'CREDIT_APPLICATION' }>;
    auditTimeline: OrderFinancialTimelineRow[];
  };
  /** Localized headers for org_order_preferences_dtl columns (Preferences tab) */
  orderPreferenceDtlColumnLabels: Record<OrderPreferenceDtlColumn, string>;
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

/**
 *
 * @param root0
 * @param root0.order
 * @param root0.allPayments
 * @param root0.unappliedPayments
 * @param root0.orderInvoices
 * @param root0.vouchers
 * @param root0.stockTransactions
 * @param root0.receipts
 * @param root0.editHistory
 * @param root0.orderPreferences
 * @param root0.discountLines
 * @param root0.financialData
 * @param root0.orderPreferenceDtlColumnLabels
 * @param root0.tenantOrgId
 * @param root0.userId
 * @param root0.processPaymentAction
 * @param root0.applyPaymentToInvoiceAction
 * @param root0.initialTab
 * @param root0.initialInvoiceId
 * @param root0.initialVoucherId
 * @param root0.returnUrl
 * @param root0.returnLabel
 * @param root0.translations
 * @param root0.locale
 */
export function OrderDetailsFullClient({
  order,
  allPayments,
  unappliedPayments,
  orderInvoices,
  vouchers,
  stockTransactions,
  receipts,
  editHistory,
  orderPreferences,
  discountLines = [],
  financialData,
  orderPreferenceDtlColumnLabels,
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

  // Component-level financial derived values (shared between sidebar and financial section)
  const _o = order as Record<string, unknown>;
  const orderTotal = Number(financialData?.snapshot.totalAmount ?? _o.total ?? 0);
  const orderPaidAmount = Number(financialData?.snapshot.totalPaidAmount ?? _o.paid_amount ?? 0);
  const orderBalanceDue = orderTotal - orderPaidAmount;
  const orderBalanceDueAbs = Math.abs(orderBalanceDue);
  const normalizedOrderPaid = isOrderPaidStatus(String(order.payment_status ?? ''), {
    paymentTypeCode: typeof order.payment_type_code === 'string' ? order.payment_type_code : null,
    payOnCollectionAmount: Number(order.pay_on_collection_amount ?? 0),
    outstandingAmount: Number(order.outstanding_amount ?? 0),
  });
  const balanceColorClass =
    orderBalanceDue < 0
      ? 'text-blue-700'
      : orderBalanceDue === 0
        ? 'text-green-700'
        : 'text-orange-600';
  const balanceBadgeClass =
    orderBalanceDue < 0
      ? 'bg-blue-100 text-blue-700'
      : orderBalanceDue === 0
        ? 'bg-green-100 text-green-700'
        : 'bg-orange-100 text-orange-700';
  const balanceStatusLabel =
    orderBalanceDue < 0
      ? (t.overpaid ?? 'Overpaid')
      : orderBalanceDue === 0
        ? (t.fullyPaid ?? 'Fully Paid')
        : (t.balanceOwing ?? 'Balance Owing');

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
  const { token: csrfToken } = useCSRFToken();
  const [intakeConfirming, setIntakeConfirming] = useState(false);

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
  const items = (order.items ?? order.org_order_items_dtl ?? []) as OrderItem[];

  const editHistoryTranslations = {
    emptyEditHistory: t.emptyEditHistory ?? 'No edit history',
    editHistoryTitle: t.editHistoryTitle ?? 'Edit History',
    editNo: t.editNo ?? 'Edit #',
    editedBy: t.editedBy ?? 'Edited by',
    editedAt: t.editedAt ?? 'Edited at',
    changeSummary: t.changeSummary ?? 'Summary',
    fieldChanges: t.fieldChanges ?? 'Field Changes',
    itemChanges: t.itemChanges ?? 'Item Changes',
    pricingChanges: t.pricingChanges ?? 'Pricing Changes',
    paymentAdjustment: t.paymentAdjustment ?? 'Payment Adjustment',
    fieldName: t.fieldName ?? 'Field',
    oldValue: t.oldValue ?? 'Old Value',
    newValue: t.newValue ?? 'New Value',
    itemAdded: t.itemAdded ?? 'Added',
    itemRemoved: t.itemRemoved ?? 'Removed',
    itemModified: t.itemModified ?? 'Modified',
    oldSubtotal: t.oldSubtotal ?? 'Old Subtotal',
    newSubtotal: t.newSubtotal ?? 'New Subtotal',
    oldTotal: t.oldTotal ?? 'Old Total',
    newTotal: t.newTotal ?? 'New Total',
    difference: t.difference ?? 'Difference',
    noChangesRecorded: t.noChangesRecorded ?? 'No changes recorded',
    charge: t.charge ?? 'Charge',
    refund: t.refund ?? 'Refund',
    ipAddress: t.ipAddress ?? 'IP Address',
    viewDetails: t.viewDetails ?? 'Details',
    hideDetails: t.hideDetails ?? 'Hide',
    qty: t.qty ?? 'Qty',
    price: t.price ?? 'Price',
    totalPrice: t.totalPrice ?? 'Total Price',
    notes: t.notes ?? 'Notes',
    stain: t.stain ?? 'Has Stain',
    damage: t.damage ?? 'Has Damage',
    stainNotes: t.stainNotes ?? 'Stain Notes',
    damageNotes: t.damageNotes ?? 'Damage Notes',
    yes: t.commonYes ?? 'Yes',
    no: t.commonNo ?? 'No',
  };

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

  /** Order master field categories for UI grouping (keys that exist on order are shown) */
  const MASTER_CATEGORIES: { sectionKey: string; keys: string[] }[] = [
    {
      sectionKey: 'orderIdentity',
      keys: [
        'id',
        'order_no',
        'tenant_org_id',
        'branch_id',
        'order_type_id',
        'service_category_code',
        'status',
        'priority',
        'total_items',
        'rec_status',
      ],
    },
    {
      sectionKey: 'customerReference',
      keys: ['customer_id'],
    },
    {
      sectionKey: 'financial',
      keys: [
        'subtotal',
        'discount',
        'tax',
        'total',
        'vat_rate',
        'discount_rate',
        'discount_type',
        'promo_discount_amount',
        'service_charge',
        'currency_code',
        'currency_ex_rate',
      ],
    },
    {
      sectionKey: 'payment',
      keys: [
        'payment_status',
        'payment_method_code',
        'paid_amount',
        'paid_at',
        'paid_by',
        'payment_notes',
        'payment_type_code',
        'payment_terms',
        'payment_due_date',
      ],
    },
    {
      sectionKey: 'datesAndTimeline',
      keys: [
        'received_at',
        'ready_by',
        'ready_by_override',
        'ready_at',
        'delivered_at',
        'created_at',
        'updated_at',
        'prepared_at',
        'last_transition_at',
      ],
    },
    {
      sectionKey: 'preparationAndWorkflow',
      keys: [
        'preparation_status',
        'prepared_by',
        'priority_multiplier',
        'workflow_template_id',
        'current_status',
        'current_stage',
        'parent_order_id',
        'order_subtype',
        'has_split',
        'is_rejected',
        'rejected_from_stage',
        'issue_id',
        'has_issue',
        'ready_by_at_new',
        'last_transition_by',
        'is_order_quick_drop',
        'quick_drop_quantity',
        'rack_location',
        'is_retail',
      ],
    },
    {
      sectionKey: 'notes',
      keys: ['customer_notes', 'internal_notes', 'payment_notes'],
    },
    {
      sectionKey: 'cancellationReturn',
      keys: ['cancelled_at', 'cancelled_by', 'cancelled_note', 'returned_at', 'returned_by', 'return_reason', 'return_reason_code'],
    },
    {
      sectionKey: 'other',
      keys: [
        'bag_count',
        'created_by',
        'updated_by',
        'created_info',
        'updated_info',
        'promo_code_id',
      ],
    },
  ];

  const formatMasterValue = (key: string, value: unknown): string => {
    if (value == null) return '—';
    if (typeof value === 'boolean') return value ? (t.commonYes ?? 'Yes') : (t.commonNo ?? 'No');
    if (value instanceof Date) return value.toLocaleString(locale === 'ar' ? 'ar-OM' : 'en-OM');
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T?\d{0,2}/.test(value)) {
      try {
        return new Date(value).toLocaleString(locale === 'ar' ? 'ar-OM' : 'en-OM');
      } catch {
        return String(value);
      }
    }
    const tRecord = t as Record<string, string>;
    if (key === 'status' && typeof value === 'string') return tRecord[`status_${value}`] ?? String(value);
    if (key === 'priority' && typeof value === 'string') return tRecord[`priority_${value}`] ?? String(value);
    if (key === 'preparation_status' && typeof value === 'string') return tRecord[`prepStatus_${value}`] ?? String(value);
    const amountKeys = [
      'subtotal',
      'discount',
      'tax',
      'total',
      'paid_amount',
      'promo_discount_amount',
      'service_charge',
    ];
    if (amountKeys.includes(key) && (typeof value === 'number' || (typeof value === 'string' && /^-?\d*\.?\d+$/.test(value)))) {
      const num = typeof value === 'number' ? value : parseFloat(value as string);
      if (Number.isNaN(num)) return String(value);
      return fmtOrderMoney(num);
    }
    return String(value);
  };

  const renderMasterSection = (sectionKey: string, title: string, keys: string[]) => {
    const o = order as Record<string, unknown>;
    const presentKeys = keys.filter((k) => k in o && typeof o[k] !== 'object');
    if (presentKeys.length === 0) return null;
    return (
      <CmxCard key={sectionKey}>
        <CmxCardHeader>
          <CmxCardTitle className={`text-base font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{title}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="pt-0">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {presentKeys.map((key) => {
              const val = o[key];
              const displayKey = (t as Record<string, string>)[`masterField_${key}`] ?? key.replace(/_/g, ' ');
              return (
                <div key={key} className={`flex ${isRTL ? 'flex-row-reverse' : ''} gap-2 border-b border-gray-100 pb-2 last:border-0`}>
                  <dt className="text-sm font-medium text-gray-500 shrink-0 min-w-[7rem]">{displayKey}</dt>
                  <dd className="min-w-0 break-all">
                    <CmxCopyableCell
                      as="span"
                      value={formatMasterValue(key, val)}
                      align={isRTL ? 'right' : 'left'}
                      className="px-0 py-0 text-sm text-gray-900"
                    />
                  </dd>
                </div>
              );
            })}
          </dl>
        </CmxCardContent>
      </CmxCard>
    );
  };

  const renderFinancialSection = () => {
    const o = order as Record<string, unknown>;

    const subtotal = Number(o.subtotal ?? 0);
    const activeDiscountLines = discountLines.filter((line) => !line.is_voided);
    const hasDiscountLineBreakdown = activeDiscountLines.length > 0;
    const discountLineTotalFor = (sourceTypes: string[]) =>
      activeDiscountLines
        .filter((line) => sourceTypes.includes(line.source_type))
        .reduce((sum, line) => sum + Number(line.discount_amount ?? 0), 0);
    const manualDiscount = hasDiscountLineBreakdown
      ? discountLineTotalFor(['MANUAL'])
      : Number(o.discount ?? 0);
    const ruleDiscount = hasDiscountLineBreakdown
      ? discountLineTotalFor(['DISCOUNT_RULE'])
      : 0;
    const promoDiscount = hasDiscountLineBreakdown
      ? discountLineTotalFor(['PROMO_CODE'])
      : Number(o.promo_discount_amount ?? 0);
    const canonicalGiftCardApplied = financialData?.creditApplications
      ?.filter((row) => row.credit_type === CREDIT_APPLICATION_TYPES.GIFT_CARD)
      .reduce((sum, row) => sum + Number(row.applied_amount ?? 0), 0);
    /**
     * Gift card is a SETTLEMENT (not a commercial discount).
     * Prefer canonical credit-application rows and fall back to historical
     * discount-line rendering only for transition-era snapshots.
     */
    const giftCardApplied = canonicalGiftCardApplied
      ?? (hasDiscountLineBreakdown ? discountLineTotalFor(['GIFT_CARD']) : 0);
    const preTaxDiscounts = manualDiscount + ruleDiscount + promoDiscount;
    const totalDiscounts = preTaxDiscounts;
    const serviceCharge = Number(o.service_charge ?? 0);
    const vatAmount = financialData?.taxes
      ?.filter((row) => row.tax_type === TAX_TYPES.VAT)
      .reduce((sum, row) => sum + Number(row.tax_amount ?? 0), 0)
      ?? 0;
    const tax = Number(o.tax ?? 0);
    const total = Number(o.total ?? 0);
    const paidAmount = Number(o.paid_amount ?? 0);
    const netAfterDiscounts = Math.max(0, subtotal - preTaxDiscounts);

    const vatRate = o.vat_rate != null ? Number(o.vat_rate) : null;
    const discountRateVal = o.discount_rate != null ? Number(o.discount_rate) : null;
    const discountTypeVal = o.discount_type != null ? String(o.discount_type) : null;
    const currencyCode = typeof o.currency_code === 'string' ? o.currency_code : '';
    const exchangeRate = o.currency_ex_rate != null ? Number(o.currency_ex_rate) : null;

    const giftCardId = typeof o.gift_card_id === 'string' ? o.gift_card_id : null;
    /**
     * Prefer the human-readable gift_card_code (CMX-XXXX) for display.
     * Fall back to masking the UUID when only the ID is available.
     */
    const giftCardCode = typeof o.gift_card_code === 'string' && o.gift_card_code.trim()
      ? o.gift_card_code.trim()
      : null;
    const giftCardMasked = giftCardCode
      ? giftCardCode.slice(0, 12) + (giftCardCode.length > 12 ? '…' : '')
      : giftCardId
        ? `····${giftCardId.replace(/-/g, '').slice(-4)}`
        : null;
    const promoCodeId = typeof o.promo_code_id === 'string' && o.promo_code_id.trim().length > 0
      ? o.promo_code_id
      : null;

    const vatLabel =
      vatRate != null
        ? (t.vatWithRate ?? 'VAT ({rate}%)').replace('{rate}', String(vatRate))
        : (t.vat ?? 'VAT');

    const WRow = ({
      label,
      value,
      isDeduction = false,
      isBold = false,
      valueColor,
      chip,
      meta,
    }: {
      label: string;
      value: string;
      isDeduction?: boolean;
      isBold?: boolean;
      valueColor?: string;
      chip?: string;
      meta?: string;
    }) => (
      <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : 'justify-between'} gap-2 py-1.5`}>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''} min-w-0`}>
          <span className={`shrink-0 text-sm ${isBold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{label}</span>
          {chip && (
            <span className="shrink-0 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
              {chip}
            </span>
          )}
          {meta && (
            <span className="shrink-0 text-xs text-gray-400">({meta})</span>
          )}
        </div>
        <span
          className={`shrink-0 text-sm tabular-nums ${isBold ? 'font-semibold' : ''} ${valueColor ?? (isDeduction ? 'text-green-700' : 'text-gray-900')}`}
        >
          {value}
        </span>
      </div>
    );

    return (
      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle className={`text-base font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>
            {t.masterSectionFinancial ?? 'Amounts & totals'}
          </CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="pt-0">
          <div className="space-y-3">

            {/* Zone 1: Price Calculation Waterfall */}
            <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
              <p className={`text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3 ${isRTL ? 'text-right' : ''}`}>
                {t.priceBreakdown ?? 'Price Breakdown'}
              </p>
              <div>
                {/* Starting amounts */}
                <div className="pb-2 border-b border-gray-200 space-y-0">
                  <WRow label={t.masterField_subtotal ?? 'Subtotal'} value={fmtOrderMoney(subtotal)} isBold />
                  <WRow
                    label={t.lineDiscount ?? 'Line Discount'}
                    value={manualDiscount > 0 ? `− ${fmtOrderMoney(manualDiscount)}` : fmtOrderMoney(manualDiscount)}
                    isDeduction={manualDiscount > 0}
                    meta={discountTypeVal && discountTypeVal !== '—' ? discountTypeVal : undefined}
                  />
                  <WRow
                    label={t.discountRule ?? 'Rule Discount'}
                    value={ruleDiscount > 0 ? `− ${fmtOrderMoney(ruleDiscount)}` : fmtOrderMoney(ruleDiscount)}
                    isDeduction={ruleDiscount > 0}
                  />
                  <WRow
                    label={t.discountRate ?? 'Discount Rate'}
                    value={discountRateVal != null ? `${discountRateVal}%` : '—'}
                  />
                  <WRow
                    label={t.promoDiscount ?? 'Promo Discount'}
                    value={promoDiscount > 0 ? `− ${fmtOrderMoney(promoDiscount)}` : fmtOrderMoney(promoDiscount)}
                    isDeduction={promoDiscount > 0}
                  />
                </div>

                {/* Net subtotal */}
                <div className="py-2 border-b border-gray-200">
                  <WRow
                    label={t.netAfterDiscounts ?? 'Net after discounts'}
                    value={fmtOrderMoney(netAfterDiscounts)}
                    isBold
                  />
                </div>

                {/* Charges and tax */}
                <div className="py-2 border-b border-gray-200 space-y-0">
                  <WRow
                    label={t.masterField_service_charge ?? 'Service Charge'}
                    value={fmtOrderMoney(serviceCharge)}
                  />
                  <WRow label={vatLabel} value={fmtOrderMoney(vatAmount)} />
                  <WRow label={t.masterField_tax ?? 'Tax'} value={fmtOrderMoney(tax)} />
                </div>

                {/* Order total */}
                <div className="py-2 border-b-2 border-gray-400">
                  <WRow label={t.masterField_total ?? 'Total'} value={fmtOrderMoney(total)} isBold />
                </div>

                {/* Settlements — gift card is a settlement, not a commercial discount */}
                {giftCardApplied > 0 && (
                  <div className="py-2 border-b border-gray-200 space-y-0">
                    <p className={`text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1 ${isRTL ? 'text-right' : ''}`}>
                      {t.settlements ?? 'Settlements'}
                    </p>
                    <WRow
                      label={`${t.giftCardApplied ?? 'Gift Card Applied'}${giftCardMasked ? ` (${giftCardMasked})` : ''}`}
                      value={`− ${fmtOrderMoney(giftCardApplied)}`}
                      isDeduction
                      chip={giftCardMasked ?? undefined}
                    />
                  </div>
                )}

                {/* Paid amount */}
                <div className="py-2 border-b border-gray-200">
                  <WRow
                    label={t.paidAmount ?? 'Paid Amount'}
                    value={paidAmount > 0 ? `− ${fmtOrderMoney(paidAmount)}` : fmtOrderMoney(paidAmount)}
                    isDeduction={paidAmount > 0}
                    valueColor={paidAmount > 0 ? 'text-green-700' : 'text-gray-500'}
                  />
                </div>

                {/* Balance Due — highlighted row */}
                <div className="pt-3">
                  <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : 'justify-between'} gap-2`}>
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-sm font-bold text-gray-900">{t.balanceDue ?? 'Balance Due'}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${balanceBadgeClass}`}>
                        {balanceStatusLabel}
                      </span>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${balanceColorClass}`}>
                      {fmtOrderMoney(orderBalanceDueAbs)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Zone 2: Applied Discounts detail */}
            <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
              <p className={`text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3 ${isRTL ? 'text-right' : ''}`}>
                {t.appliedDiscounts ?? 'Applied Discounts'}
              </p>
              <div className="space-y-0">
                <WRow
                  label={t.lineDiscount ?? 'Line Discount'}
                  value={manualDiscount > 0 ? `− ${fmtOrderMoney(manualDiscount)}` : fmtOrderMoney(manualDiscount)}
                  isDeduction={manualDiscount > 0}
                />
                <WRow
                  label={t.discountRule ?? 'Rule Discount'}
                  value={ruleDiscount > 0 ? `− ${fmtOrderMoney(ruleDiscount)}` : fmtOrderMoney(ruleDiscount)}
                  isDeduction={ruleDiscount > 0}
                />
                <WRow
                  label={t.promoDiscount ?? 'Promo Discount'}
                  value={promoDiscount > 0 ? `− ${fmtOrderMoney(promoDiscount)}` : fmtOrderMoney(promoDiscount)}
                  isDeduction={promoDiscount > 0}
                  meta={promoCodeId ?? undefined}
                />
                <WRow label={t.discountType ?? 'Discount Type'} value={discountTypeVal && discountTypeVal !== '—' ? discountTypeVal : '—'} />
                <WRow label={t.discountRate ?? 'Discount Rate'} value={discountRateVal != null ? `${discountRateVal}%` : '—'} />
                {discountLines.length > 0 && (
                  <OrderDiscountBreakdown lines={discountLines} locale={locale} />
                )}
                <div className="pt-2 mt-2 border-t border-gray-200">
                  <WRow
                    label={t.totalDiscounts ?? 'Total Discounts'}
                    value={totalDiscounts > 0 ? `− ${fmtOrderMoney(totalDiscounts)}` : fmtOrderMoney(totalDiscounts)}
                    isDeduction={totalDiscounts > 0}
                    isBold
                  />
                </div>
              </div>
            </div>

            {/* Zone 3: Currency */}
            <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
              <p className={`text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3 ${isRTL ? 'text-right' : ''}`}>
                {t.currencyInfo ?? 'Currency'}
              </p>
              <div className="space-y-0">
                <WRow label={t.masterField_currency_code ?? 'Currency'} value={currencyCode || '—'} />
                <WRow label={t.masterField_currency_ex_rate ?? 'Exchange Rate'} value={exchangeRate != null ? String(exchangeRate) : '—'} />
              </div>
            </div>

            {/* Zone 4: Payment Status & Settlement */}
            {(() => {
              const outstandingAmount = Number(o.outstanding_amount ?? 0);
              const totalCreditApplied = Number(o.total_credit_applied_amount ?? 0);
              const payOnCollectionAmount = Number(o.pay_on_collection_amount ?? 0);
              const paymentTypeCode = typeof o.payment_type_code === 'string' ? o.payment_type_code : null;
              const paymentStatus = typeof o.payment_status === 'string' ? o.payment_status : null;
              const paymentTerms = typeof o.payment_terms === 'string' ? o.payment_terms : null;
              const paymentDueDate = typeof o.payment_due_date === 'string' ? o.payment_due_date : null;
              const hasSettlementData = outstandingAmount !== 0 || totalCreditApplied !== 0 || payOnCollectionAmount !== 0 || paymentTypeCode || paymentStatus;
              if (!hasSettlementData) return null;
              return (
                <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <p className={`text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3 ${isRTL ? 'text-right' : ''}`}>
                    {t.paymentSettlement ?? 'Payment & Settlement'}
                  </p>
                  <div className="space-y-0">
                    {paymentStatus && (
                      <WRow label={t.masterField_payment_status ?? 'Payment Status'} value={paymentStatus} />
                    )}
                    {paymentTypeCode && (
                      <WRow label={t.masterField_payment_type_code ?? 'Payment Type'} value={paymentTypeCode} />
                    )}
                    {paymentTerms && (
                      <WRow label={t.paymentTerms ?? 'Payment Terms'} value={paymentTerms} />
                    )}
                    {paymentDueDate && (
                      <WRow label={t.paymentDueDate ?? 'Payment Due Date'} value={
                        (() => { try { return new Date(paymentDueDate).toLocaleDateString(locale === 'ar' ? 'ar-OM' : 'en-OM'); } catch { return paymentDueDate; } })()
                      } />
                    )}
                    {totalCreditApplied > 0 && (
                      <WRow
                        label={t.totalCreditApplied ?? 'Credit Applied'}
                        value={`− ${fmtOrderMoney(totalCreditApplied)}`}
                        isDeduction
                      />
                    )}
                    {outstandingAmount !== 0 && (
                      <WRow
                        label={t.outstandingAmount ?? 'Outstanding Amount'}
                        value={fmtOrderMoney(Math.abs(outstandingAmount))}
                        isBold
                        valueColor={outstandingAmount > 0 ? 'text-orange-600' : 'text-green-700'}
                      />
                    )}
                    {payOnCollectionAmount > 0 && (
                      <WRow
                        label={t.payOnCollectionAmount ?? 'Pay on Collection'}
                        value={fmtOrderMoney(payOnCollectionAmount)}
                        valueColor="text-amber-600"
                      />
                    )}
                  </div>
                </div>
              );
            })()}

          </div>
        </CmxCardContent>
      </CmxCard>
    );
  };

  const tabs = [
    {
      id: 'master',
      label: t.tabsMaster ?? 'Order Master Data',
      content: (
        <div className="space-y-6">
          {/* Top row: Order identity + Customer reference (two columns) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderMasterSection(
              'orderIdentity',
              t.masterSectionOrderIdentity ?? 'Order identity',
              MASTER_CATEGORIES[0].keys
            )}
            {renderMasterSection(
              'customerReference',
              t.masterSectionCustomerReference ?? 'Customer & reference',
              MASTER_CATEGORIES[1].keys
            )}
          </div>
          {/* Full width: Amounts & totals — grouped sub-cards */}
          {renderFinancialSection()}
          {/* Full width: Payment */}
          {renderMasterSection(
            'payment',
            t.masterSectionPayment ?? 'Payment',
            MASTER_CATEGORIES[3].keys
          )}
          {/* Full width: Dates & timeline */}
          {renderMasterSection(
            'datesAndTimeline',
            t.masterSectionDatesAndTimeline ?? 'Dates & timeline',
            MASTER_CATEGORIES[4].keys
          )}
          {/* Full width: Preparation & workflow */}
          {renderMasterSection(
            'preparationAndWorkflow',
            t.masterSectionPreparationAndWorkflow ?? 'Preparation & workflow',
            MASTER_CATEGORIES[5].keys
          )}
          {/* Notes + Other: two columns on large screens */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderMasterSection('notes', t.masterSectionNotes ?? 'Notes', MASTER_CATEGORIES[6].keys)}
            {renderMasterSection('other', t.masterSectionOther ?? 'Other', MASTER_CATEGORIES[7].keys)}
          </div>
          {/* Customer data (nested object) — structured display */}
          {order.org_customers_mst != null && (
            <CmxCard>
              <CmxCardHeader>
                <CmxCardTitle className={`text-base font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t.masterCustomerData ?? 'Customer data'}
                </CmxCardTitle>
              </CmxCardHeader>
              <CmxCardContent className="pt-0">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  {[
                    { label: t.customerFirstName ?? 'First Name', value: (customer as Record<string, unknown>).first_name },
                    { label: t.customerLastName ?? 'Last Name', value: (customer as Record<string, unknown>).last_name },
                    { label: t.customerPhone ?? 'Phone', value: (customer as Record<string, unknown>).phone },
                    { label: t.customerEmail ?? 'Email', value: (customer as Record<string, unknown>).email },
                    { label: t.customerAddress ?? 'Address', value: (customer as Record<string, unknown>).address },
                    {
                      label: t.customerLoyaltyPoints ?? 'Loyalty Points',
                      value: (order.org_customers_mst as Record<string, unknown>).loyalty_points,
                    },
                    { label: t.masterField_customer_id ?? 'Customer ID', value: order.customer_id },
                  ]
                    .filter((row) => row.value != null && row.value !== '')
                    .map((row) => (
                      <div key={row.label} className={`flex ${isRTL ? 'flex-row-reverse' : ''} gap-2 border-b border-gray-100 pb-2 last:border-0`}>
                        <dt className="text-sm font-medium text-gray-500 shrink-0 min-w-[7rem]">{row.label}</dt>
                        <dd className="min-w-0 break-all">
                          <CmxCopyableCell
                            as="span"
                            value={String(row.value)}
                            align={isRTL ? 'right' : 'left'}
                            className="px-0 py-0 text-sm text-gray-900"
                          />
                        </dd>
                      </div>
                    ))}
                </dl>
              </CmxCardContent>
            </CmxCard>
          )}
          {/* Items count */}
          {(order.items ?? order.org_order_items_dtl) != null && (
            <p className={`text-sm text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t.masterItemsCount ?? 'Items count'}:{' '}
              {Array.isArray(order.items) ? order.items.length : Array.isArray(order.org_order_items_dtl) ? order.org_order_items_dtl.length : 0}{' '}
              line(s)
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'items',
      label: t.tabsItems ?? 'Items & Pieces',
      content: (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <OrderItemsList
            items={items}
            orderId={order.id as string}
            tenantId={tenantId}
            branchId={(order as { branch_id?: string | null }).branch_id}
            trackByPiece={trackByPiece}
            readOnly
          />
        </div>
      ),
    },
    {
      id: 'preferences',
      label: t.tabsPreferences ?? 'Preferences',
      content: (
        <div className="bg-white rounded-lg border border-gray-200 p-6 min-h-0 max-h-[min(82vh,36rem)] flex flex-col overflow-hidden">
          <div className="min-h-0 flex-1 flex flex-col">
            <OrdersPreferencesTabRprt
              preferences={orderPreferences}
              currencyCode={orderCurrency}
              locale={locale}
              dtlColumnLabels={orderPreferenceDtlColumnLabels}
              translations={{
                emptyPreferences: t.emptyPreferences ?? 'No preferences for this order',
                levelOrder: t.prefLevelOrder ?? 'Order',
                levelItem: t.prefLevelItem ?? 'Item',
                levelPiece: t.prefLevelPiece ?? 'Piece',
                kindServicePrefs: t.prefKindServicePrefs ?? 'Service',
                kindPackingPrefs: t.prefKindPackingPrefs ?? 'Packing',
                kindConditionStain: t.prefKindConditionStain ?? 'Stain',
                kindConditionDamage: t.prefKindConditionDamage ?? 'Damage',
                kindColor: t.prefKindColor ?? 'Color',
                kindNote: t.prefKindNote ?? 'Note',
                ownerSystem: t.prefOwnerSystem ?? 'System',
                ownerOverride: t.prefOwnerOverride ?? 'Override',
                sourceOrderCreate: t.prefSourceOrderCreate ?? 'Order Create',
                sourceManual: t.prefSourceManual ?? 'Manual',
                sourceOrderUpdate: t.prefSourceOrderUpdate ?? 'Order Update',
                totalExtraCharge: t.prefTotalExtraCharge ?? 'Total extra charge',
                orderLevelPrefs: t.prefOrderLevel ?? 'Order-level preferences',
                itemLevelPrefs: t.prefItemLevel ?? 'Item-level preferences',
                pieceLevelPrefs: t.prefPieceLevel ?? 'Piece-level preferences',
                rowCountSuffix: t.prefRowCountSuffix ?? 'preferences',
                paginationRowsPerPage: t.prefPaginationRowsPerPage ?? 'Rows per page',
                paginationShowing: t.prefPaginationShowing ?? '{from}–{to} of {total}',
                paginationPrevious: t.prefPaginationPrevious ?? 'Previous',
                paginationNext: t.prefPaginationNext ?? 'Next',
                paginationPageOf: t.prefPaginationPageOf ?? 'Page {current} of {totalPages}',
                paginationFirst: t.prefPaginationFirst ?? 'First page',
                paginationLast: t.prefPaginationLast ?? 'Last page',
                paginationGoToPage: t.prefPaginationGoToPage ?? 'Go to page',
                paginationGo: t.prefPaginationGo ?? 'Go',
                paginationResetFilters: t.prefPaginationResetFilters ?? 'Reset filters',
                paginationFilterPlaceholder: t.prefPaginationFilterPlaceholder ?? 'Filter…',
                paginationEmptyFiltered: t.prefPaginationEmptyFiltered ?? 'No rows match filters',
                paginationGlobalSearchPlaceholder: t.prefPaginationGlobalSearch ?? 'Search all columns…',
                paginationExportCsv: t.prefPaginationExportCsv ?? 'Export CSV',
                paginationColumnsMenu: t.prefPaginationColumnsMenu ?? 'Columns',
                paginationToggleColumns: t.prefPaginationToggleColumns ?? 'Toggle visible columns',
                paginationClearColumnFilter: t.prefPaginationClearColumnFilter ?? 'Clear column filter',
                paginationEmptyFilteredHint: t.prefPaginationEmptyFilteredHint ?? 'Try checking your spelling or loosening your filters.',
                paginationDensity: t.prefPaginationDensity ?? 'Density',
                paginationDensityCompact: t.prefPaginationDensityCompact ?? 'Compact',
                paginationDensityStandard: t.prefPaginationDensityStandard ?? 'Standard',
                paginationDensityComfortable: t.prefPaginationDensityComfortable ?? 'Comfortable',
                paginationCopyToClipboard: t.prefPaginationCopyToClipboard ?? 'Copy to clipboard',
                valueYes: t.commonYes ?? 'Yes',
                valueNo: t.commonNo ?? 'No',
              }}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'history',
      label: t.tabsHistory ?? 'Order History',
      content: (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <OrderTimeline orderId={order.id as string} currentStatus={order.status as OrderStatus} />
        </div>
      ),
    },
    {
      id: 'edit_history',
      label: t.tabsEditHistory ?? 'Edit History',
      content: (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <OrdersEditHistoryTabRprt
            entries={editHistory}
            currencyCode={(order.currency_code as string) ?? ORDER_DEFAULTS.CURRENCY}
            translations={editHistoryTranslations}
          />
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
                <span className="font-medium">{fmtOrderMoney(parseFloat(String(order.subtotal ?? 0)))}</span>
              </div>
              {order.discount && parseFloat(String(order.discount)) > 0 && (
                <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
                  <span className="text-gray-600">{t.discount}</span>
                  <span className="font-medium text-red-600">-{fmtOrderMoney(parseFloat(String(order.discount)))}</span>
                </div>
              )}
              {order.tax && parseFloat(String(order.tax)) > 0 && (
                <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
                  <span className="text-gray-600">{t.tax}</span>
                  <span className="font-medium">{fmtOrderMoney(parseFloat(String(order.tax)))}</span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-200">
                <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'}`}>
                  <span className="text-base font-semibold">{t.total}</span>
                  <span className="text-base font-bold">{fmtOrderMoney(parseFloat(String(order.total ?? 0)))}</span>
                </div>
              </div>
              {order.paid_amount != null && parseFloat(String(order.paid_amount)) > 0 && (
                <>
                  <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
                    <span className="text-gray-600">{t.paidAmount}</span>
                    <span className="font-medium text-green-600">
                      {fmtOrderMoney(parseFloat(String(order.paid_amount)))}
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
                      {fmtOrderMoney(
                        parseFloat(String(order.total ?? 0)) - parseFloat(String(order.paid_amount ?? 0))
                      )}
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
                        <span className="font-medium">{fmtOrderMoney(Number(p.paid_amount))}</span>
                        <span className="text-gray-600">{p.payment_method_code}</span>
                        <CmxButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setApplyModalPaymentId(p.id);
                            setApplyModalInvoiceId('');
                            setApplyError(null);
                          }}
                        >
                          {t.applyToInvoice}
                        </CmxButton>
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
                  <CmxInput
                    type="number"
                    label={t.recordPaymentAmount}
                    step={10 ** -decimalPlaces}
                    min={0}
                    value={depositAmount || ''}
                    onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">{t.recordPaymentMethod}</p>
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
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">{t.paymentKind}</p>
                    <div className="flex gap-2">
                      <CmxButton
                        type="button"
                        variant={depositKind === 'deposit' ? 'primary' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => setDepositKind('deposit')}
                      >
                        {t.kindDeposit}
                      </CmxButton>
                      <CmxButton
                        type="button"
                        variant={depositKind === 'pos' ? 'primary' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => setDepositKind('pos')}
                      >
                        {t.kindPos}
                      </CmxButton>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">{t.notes}</p>
                    <CmxTextarea
                      value={depositNotes}
                      onChange={(e) => setDepositNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                  {depositError && <p className="text-sm text-red-600">{depositError}</p>}
                  {depositSuccess && <p className="text-sm text-green-600">{depositSuccess}</p>}
                  <CmxButton
                    type="submit"
                    variant="primary"
                    size="md"
                    className="w-full"
                    disabled={depositPending || depositAmount <= 0}
                    loading={depositPending}
                  >
                    {depositPending ? t.recordPaymentProcessing : t.recordPaymentSubmit}
                  </CmxButton>
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
    {
      id: 'financial',
      label: t.tabsFinancial ?? 'Financial',
      content: (
        <OrdersFinancialTabRprt
          snapshot={financialData?.snapshot ?? null}
          charges={financialData?.charges ?? []}
          discounts={financialData?.discounts ?? []}
          taxes={financialData?.taxes ?? []}
          payments={financialData?.payments ?? []}
          creditApplications={financialData?.creditApplications ?? []}
          refunds={financialData?.refunds ?? []}
          adjustments={financialData?.adjustments ?? []}
          voucherReferences={financialData?.voucherReferences ?? []}
          auditTimeline={financialData?.auditTimeline ?? []}
        />
      ),
    },
    {
      id: 'customer',
      label: t.tabsCustomer ?? 'Customer',
      content: (
        <div className="space-y-6">
          {/* Customer identity card */}
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle className={`text-base font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.customerProfile ?? 'Customer Profile'}
              </CmxCardTitle>
            </CmxCardHeader>
            <CmxCardContent className="pt-0">
              {order.org_customers_mst == null && !order.customer_id ? (
                <p className="text-sm text-gray-500">{t.noCustomerData ?? 'No customer linked to this order'}</p>
              ) : (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {[
                    { label: t.customerFirstName ?? 'First Name', value: (customer as Record<string, unknown>).first_name },
                    { label: t.customerLastName ?? 'Last Name', value: (customer as Record<string, unknown>).last_name },
                    { label: t.customerPhone ?? 'Phone', value: (customer as Record<string, unknown>).phone },
                    { label: t.customerEmail ?? 'Email', value: (customer as Record<string, unknown>).email },
                    { label: t.customerAddress ?? 'Address', value: (customer as Record<string, unknown>).address },
                    { label: t.masterField_customer_id ?? 'Customer ID', value: order.customer_id },
                  ]
                    .filter((row) => row.value != null && row.value !== '')
                    .map((row) => (
                      <div key={row.label} className={`flex ${isRTL ? 'flex-row-reverse' : ''} gap-2 border-b border-gray-100 pb-3 last:border-0`}>
                        <dt className="text-sm font-medium text-gray-500 shrink-0 min-w-[8rem]">{row.label}</dt>
                        <dd className="min-w-0 break-all">
                          <CmxCopyableCell
                            as="span"
                            value={String(row.value)}
                            align={isRTL ? 'right' : 'left'}
                            className="px-0 py-0 text-sm text-gray-900"
                          />
                        </dd>
                      </div>
                    ))}
                </dl>
              )}
            </CmxCardContent>
          </CmxCard>

          {/* Loyalty & membership */}
          {(order.org_customers_mst as Record<string, unknown> | null)?.loyalty_points != null && (
            <CmxCard>
              <CmxCardHeader>
                <CmxCardTitle className={`text-base font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t.customerLoyalty ?? 'Loyalty & Membership'}
                </CmxCardTitle>
              </CmxCardHeader>
              <CmxCardContent className="pt-0">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} gap-2 border-b border-gray-100 pb-3 last:border-0`}>
                    <dt className="text-sm font-medium text-gray-500 shrink-0 min-w-[8rem]">
                      {t.customerLoyaltyPoints ?? 'Loyalty Points'}
                    </dt>
                    <dd>
                      <CmxCopyableCell
                        as="span"
                        value={String((order.org_customers_mst as Record<string, unknown>).loyalty_points ?? 0)}
                        align={isRTL ? 'right' : 'left'}
                        className="px-0 py-0 text-sm text-gray-900"
                      />
                    </dd>
                  </div>
                </dl>
              </CmxCardContent>
            </CmxCard>
          )}

          {/* Order-level customer notes visible here too */}
          {(order.customer_notes || order.payment_notes) && (
            <CmxCard>
              <CmxCardHeader>
                <CmxCardTitle className={`text-base font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t.masterSectionNotes ?? 'Notes'}
                </CmxCardTitle>
              </CmxCardHeader>
              <CmxCardContent className="pt-0 space-y-3">
                {order.customer_notes && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      {t.masterField_customer_notes ?? 'Customer Notes'}
                    </p>
                    <CmxCopyableCell
                      as="span"
                      value={String(order.customer_notes)}
                      align={isRTL ? 'right' : 'left'}
                      className={`px-0 py-0 text-sm text-gray-800 whitespace-pre-wrap ${isRTL ? 'text-right' : 'text-left'}`}
                    />
                  </div>
                )}
                {order.payment_notes && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      {t.masterField_payment_notes ?? 'Payment Notes'}
                    </p>
                    <CmxCopyableCell
                      as="span"
                      value={String(order.payment_notes)}
                      align={isRTL ? 'right' : 'left'}
                      className={`px-0 py-0 text-sm text-gray-800 whitespace-pre-wrap ${isRTL ? 'text-right' : 'text-left'}`}
                    />
                  </div>
                )}
              </CmxCardContent>
            </CmxCard>
          )}
        </div>
      ),
    },
    {
      id: 'notes',
      label: t.tabsNotes ?? 'Notes',
      content: (
        <div className="space-y-6">
          {/* Customer notes */}
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle className={`text-base font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.masterField_customer_notes ?? 'Customer Notes'}
              </CmxCardTitle>
            </CmxCardHeader>
            <CmxCardContent className="pt-0">
              {order.customer_notes ? (
                <CmxCopyableCell
                  as="span"
                  value={String(order.customer_notes)}
                  align={isRTL ? 'right' : 'left'}
                  className={`px-0 py-0 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}
                />
              ) : (
                <p className="text-sm text-gray-400 italic">{t.noNotes ?? 'No customer notes'}</p>
              )}
            </CmxCardContent>
          </CmxCard>

          {/* Internal notes */}
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle className={`text-base font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.masterField_internal_notes ?? 'Internal Notes'}
              </CmxCardTitle>
            </CmxCardHeader>
            <CmxCardContent className="pt-0">
              {order.internal_notes ? (
                <CmxCopyableCell
                  as="span"
                  value={String(order.internal_notes)}
                  align={isRTL ? 'right' : 'left'}
                  className={`px-0 py-0 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}
                />
              ) : (
                <p className="text-sm text-gray-400 italic">{t.noInternalNotes ?? 'No internal notes'}</p>
              )}
            </CmxCardContent>
          </CmxCard>

          {/* Payment notes */}
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle className={`text-base font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.masterField_payment_notes ?? 'Payment Notes'}
              </CmxCardTitle>
            </CmxCardHeader>
            <CmxCardContent className="pt-0">
              {order.payment_notes ? (
                <CmxCopyableCell
                  as="span"
                  value={String(order.payment_notes)}
                  align={isRTL ? 'right' : 'left'}
                  className={`px-0 py-0 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}
                />
              ) : (
                <p className="text-sm text-gray-400 italic">{t.noPaymentNotes ?? 'No payment notes'}</p>
              )}
            </CmxCardContent>
          </CmxCard>

          {/* Cancellation / return reason */}
          {(order.cancelled_note || order.return_reason) && (
            <CmxCard>
              <CmxCardHeader>
                <CmxCardTitle className={`text-base font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t.masterSectionCancellationReturn ?? 'Cancellation / Return'}
                </CmxCardTitle>
              </CmxCardHeader>
              <CmxCardContent className="pt-0 space-y-3">
                {order.cancelled_note && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      {t.masterField_cancelled_note ?? 'Cancellation Note'}
                    </p>
                    <CmxCopyableCell
                      as="span"
                      value={String(order.cancelled_note)}
                      align={isRTL ? 'right' : 'left'}
                      className={`px-0 py-0 text-sm text-gray-800 whitespace-pre-wrap ${isRTL ? 'text-right' : 'text-left'}`}
                    />
                  </div>
                )}
                {order.return_reason && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      {t.masterField_return_reason ?? 'Return Reason'}
                    </p>
                    <CmxCopyableCell
                      as="span"
                      value={String(order.return_reason)}
                      align={isRTL ? 'right' : 'left'}
                      className={`px-0 py-0 text-sm text-gray-800 whitespace-pre-wrap ${isRTL ? 'text-right' : 'text-left'}`}
                    />
                  </div>
                )}
              </CmxCardContent>
            </CmxCard>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {String(order.physical_intake_status ?? '') === 'pending_dropoff' &&
        String(order.current_status ?? order.status ?? '') === 'draft' && (
          <div
            className={`rounded-lg border border-amber-200 bg-amber-50 p-4 ${isRTL ? 'text-right' : 'text-left'}`}
            role="status"
          >
            <p className="mb-3 text-sm text-amber-900">
              {t.awaitingDropoffHint ??
                'Customer booked remotely; confirm when garments arrive at this branch.'}
            </p>
            <button
              type="button"
              disabled={intakeConfirming}
              onClick={async (e) => {
                e.stopPropagation();
                setIntakeConfirming(true);
                try {
                  const res = await fetch(`/api/v1/orders/${order.id}/confirm-physical-intake`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(csrfToken ? getCSRFHeader(csrfToken) : {}),
                    },
                    body: JSON.stringify({}),
                  });
                  if (res.ok) {
                    router.refresh();
                  }
                } finally {
                  setIntakeConfirming(false);
                }
              }}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {intakeConfirming
                ? (t.confirmIntakeWorking ?? 'Saving…')
                : (t.confirmIntakeCta ?? 'Mark received at branch')}
            </button>
          </div>
        )}
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
          <PrintLabelButton order={order as unknown as PrintLabelOrderInput} />
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
                {t[`status_${String(order.status)}` as keyof typeof t] ?? String(order.status).replace(/_/g, ' ')}
              </span>
              <span
                className={`px-3 py-1 text-xs font-medium rounded-full ${
                  priorityColors[String(order.priority)] ?? priorityColors.normal
                }`}
              >
                {t[`priority_${String(order.priority ?? 'normal')}` as keyof typeof t] ?? String(order.priority ?? 'normal')}
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
              {fmtOrderMoney(parseFloat(String(order.total ?? 0)))}
            </div>
            <div className={`text-xs text-gray-500 mt-1 ${isRTL ? 'text-left' : 'text-right'}`}>
              {normalizedOrderPaid ? (
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
                  {t[`prepStatus_${String(order.preparation_status)}` as keyof typeof t] ?? String(order.preparation_status).replace(/_/g, ' ')}
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

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t.notes}
            </h2>
            <div className="space-y-4">
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <div className={`text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t.customerNotes}
                </div>
                <div className={`text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded p-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {order.customer_notes ? String(order.customer_notes) : '—'}
                </div>
              </div>
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <div className={`text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t.internalNotes}
                </div>
                <div className={`text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded p-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {order.internal_notes ? String(order.internal_notes) : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Financial Summary card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t.financialSummary ?? 'Financial Summary'}
            </h2>
            <div className="space-y-2">
              {/* Subtotal line */}
              <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
                <span className="text-gray-600">{t.masterField_subtotal ?? 'Subtotal'}</span>
                <span className="font-medium text-gray-900 tabular-nums">
                  {fmtOrderMoney(Number(_o.subtotal ?? 0))}
                </span>
              </div>
              {/* Total line */}
              <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : 'justify-between'}`}>
                <span className="text-sm text-gray-600">{t.masterField_total ?? 'Total'}</span>
                <span className="text-xl font-bold text-gray-900 tabular-nums">
                  {fmtOrderMoney(orderTotal)}
                </span>
              </div>
              {/* Paid amount */}
              <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
                <span className="text-gray-600">{t.paidAmount ?? 'Paid Amount'}</span>
                <span className={`font-semibold tabular-nums ${orderPaidAmount > 0 ? 'text-green-700' : 'text-gray-500'}`}>
                  {fmtOrderMoney(orderPaidAmount)}
                </span>
              </div>
              {/* Balance Due — highlighted */}
              <div className="pt-2 border-t border-gray-200">
                <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : 'justify-between'}`}>
                  <span className="text-sm font-semibold text-gray-800">{t.balanceDue ?? 'Balance Due'}</span>
                  <span className={`text-lg font-bold tabular-nums ${balanceColorClass}`}>
                    {fmtOrderMoney(orderBalanceDueAbs)}
                  </span>
                </div>
                <div className={`mt-1 flex ${isRTL ? 'justify-start' : 'justify-end'}`}>
                  <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${balanceBadgeClass}`}>
                    {balanceStatusLabel}
                  </span>
                </div>
              </div>
              {/* Payment method */}
              {_o.payment_method_code && (
                <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm pt-1`}>
                  <span className="text-gray-600">{t.paymentMethod ?? 'Payment Method'}</span>
                  <span className="font-medium text-gray-900">{String(_o.payment_method_code)}</span>
                </div>
              )}
            </div>

            {/* Quick navigation links */}
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
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

          {/* Dates & preparation compact card */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="space-y-2">
              <div className={`flex items-start gap-2 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Clock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-gray-500">{t.received}: </span>
                  <span className="font-medium text-gray-900">
                    {new Date((order.received_at ?? order.created_at) as string).toLocaleString(
                      locale === 'ar' ? 'ar-OM' : 'en-OM',
                      { dateStyle: 'medium', timeStyle: 'short' }
                    )}
                  </span>
                </div>
              </div>
              {order.ready_by && (
                <div className={`flex items-start gap-2 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Package className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-gray-500">{t.readyBy}: </span>
                    <span className="font-medium text-gray-900">
                      {new Date(order.ready_by as string).toLocaleString(locale === 'ar' ? 'ar-OM' : 'en-OM', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                </div>
              )}
              {order.preparation_status && (
                <div className={`flex items-center justify-between pt-2 border-t border-gray-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-sm text-gray-500">{t.preparationStatus}:</span>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      preparationStatusColors[String(order.preparation_status)] ?? preparationStatusColors.pending
                    }`}
                  >
                    {t[`prepStatus_${String(order.preparation_status)}` as keyof typeof t] ?? String(order.preparation_status).replace(/_/g, ' ')}
                  </span>
                </div>
              )}
              {isPreparationEnabled() &&
                order.preparation_status &&
                (order.preparation_status === 'pending' || order.preparation_status === 'in_progress') && (
                  <Link
                    href={`/dashboard/preparation/${order.id}`}
                    className={`block text-sm font-medium text-blue-600 hover:text-blue-700 ${isRTL ? 'text-right' : ''}`}
                  >
                    {isRTL ? '← ' : ''}
                    {order.preparation_status === 'pending' ? t.startPreparation : t.continuePreparation}
                    {isRTL ? '' : ' →'}
                  </Link>
                )}
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
          aria-labelledby="apply-invoice-dialog-title"
        >
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 id="apply-invoice-dialog-title" className="text-lg font-semibold text-gray-900 mb-4">{t.selectInvoiceToApply}</h3>
            <select
              value={applyModalInvoiceId}
              onChange={(e) => setApplyModalInvoiceId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              aria-label={t.selectInvoiceToApply}
            >
              <option value="">—</option>
              {orderInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_no ?? inv.id} — {fmtOrderMoney(Number(inv.total ?? 0))}
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
