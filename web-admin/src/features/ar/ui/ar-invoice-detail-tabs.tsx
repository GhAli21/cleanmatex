'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { CmxDataTableSimpleColumn } from '@ui/data-display';
import { CmxTabsPanel } from '@ui/navigation';
import type {
  ArCustomerLedgerEntry,
  ArInvoiceAdjustment,
  ArInvoiceDetail,
  ArInvoiceLine,
  ArInvoiceOrderLink,
  ArInvoicePaymentAllocation,
  ArInvoiceStatusHistoryEntry,
} from '@/lib/types/ar-invoice';
import {
  ArInvoiceDetailCopyValue,
  ArInvoiceDetailDataTable,
} from './ar-invoice-detail-data-table';

interface ArInvoiceDetailTabsProps {
  detail: ArInvoiceDetail;
}

function formatCurrency(amount: number, currencyCode: string, locale: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

function formatDateTime(value: string | undefined, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatNumber(value: number | undefined, locale: string) {
  if (value == null) return '—';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatJson(value: Record<string, unknown> | undefined) {
  if (!value || Object.keys(value).length === 0) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 *
 * @param root0
 * @param root0.detail
 */
export function ArInvoiceDetailTabs({ detail }: ArInvoiceDetailTabsProps) {
  const t = useTranslations('invoices.ar.detailTabs');
  const locale = useLocale();
  const currencyCode = detail.invoice.currency_code;
  const textAlign = locale === 'ar' ? 'right' : 'left';

  const lineColumns: CmxDataTableSimpleColumn<ArInvoiceLine>[] = [
    { key: 'id', header: t('columns.id'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.id} maxLength={12} align={textAlign} /> },
    { key: 'invoice_id', header: t('columns.invoiceId'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.invoice_id} maxLength={12} align={textAlign} /> },
    { key: 'tenant_org_id', header: t('columns.tenantOrgId'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.tenant_org_id} maxLength={12} align={textAlign} /> },
    { key: 'line_no', header: t('columns.lineNo'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.line_no} align="right" /> },
    { key: 'line_type', header: t('columns.lineType'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.line_type} align={textAlign} /> },
    { key: 'source_type', header: t('columns.sourceType'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.source_type} align={textAlign} /> },
    { key: 'source_order_id', header: t('columns.sourceOrderId'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.source_order_id} maxLength={12} align={textAlign} /> },
    { key: 'source_order_item_id', header: t('columns.sourceOrderItemId'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.source_order_item_id} maxLength={12} align={textAlign} /> },
    { key: 'description', header: t('columns.description'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.description} maxLength={32} align={textAlign} /> },
    { key: 'description2', header: t('columns.description2'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.description2} maxLength={32} align={textAlign} /> },
    { key: 'quantity', header: t('columns.quantity'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.quantity} displayValue={formatNumber(row.quantity, locale)} align="right" /> },
    { key: 'unit_price', header: t('columns.unitPrice'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.unit_price} displayValue={formatCurrency(row.unit_price, row.currency_code, locale)} align="right" /> },
    { key: 'subtotal_amount', header: t('columns.subtotalAmount'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.subtotal_amount} displayValue={formatCurrency(row.subtotal_amount, row.currency_code, locale)} align="right" /> },
    { key: 'discount_amount', header: t('columns.discountAmount'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.discount_amount} displayValue={formatCurrency(row.discount_amount, row.currency_code, locale)} align="right" /> },
    { key: 'taxable_amount', header: t('columns.taxableAmount'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.taxable_amount} displayValue={formatCurrency(row.taxable_amount, row.currency_code, locale)} align="right" /> },
    { key: 'tax_rate', header: t('columns.taxRate'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.tax_rate} displayValue={formatNumber(row.tax_rate, locale)} align="right" /> },
    { key: 'tax_amount', header: t('columns.taxAmount'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.tax_amount} displayValue={formatCurrency(row.tax_amount, row.currency_code, locale)} align="right" /> },
    { key: 'total_amount', header: t('columns.total'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.total_amount} displayValue={formatCurrency(row.total_amount, row.currency_code, locale)} align="right" className="font-medium" /> },
    { key: 'currency_code', header: t('columns.currencyCode'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.currency_code} align={textAlign} /> },
    { key: 'currency_ex_rate', header: t('columns.currencyExRate'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.currency_ex_rate} displayValue={formatNumber(row.currency_ex_rate, locale)} align="right" /> },
    { key: 'metadata', header: t('columns.metadata'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={formatJson(row.metadata)} maxLength={32} align={textAlign} /> },
  ];

  const orderColumns: CmxDataTableSimpleColumn<ArInvoiceOrderLink>[] = [
    { key: 'id', header: t('columns.id'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.id} maxLength={12} align={textAlign} /> },
    { key: 'invoice_id', header: t('columns.invoiceId'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.invoice_id} maxLength={12} align={textAlign} /> },
    { key: 'order_id', header: t('columns.orderId'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.order_id} maxLength={12} align={textAlign} /> },
    { key: 'order_total_amount', header: t('columns.orderTotal'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.order_total_amount} displayValue={formatCurrency(row.order_total_amount, currencyCode, locale)} align="right" /> },
    { key: 'invoiced_amount', header: t('columns.invoicedAmount'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.invoiced_amount} displayValue={formatCurrency(row.invoiced_amount, currencyCode, locale)} align="right" /> },
    { key: 'paid_before_amount', header: t('columns.paidBeforeAmount'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.paid_before_amount} displayValue={formatCurrency(row.paid_before_amount, currencyCode, locale)} align="right" /> },
    { key: 'credit_before_amount', header: t('columns.creditBeforeAmount'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.credit_before_amount} displayValue={formatCurrency(row.credit_before_amount, currencyCode, locale)} align="right" /> },
    { key: 'outstanding_amount', header: t('columns.outstandingAmount'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.outstanding_amount} displayValue={formatCurrency(row.outstanding_amount, currencyCode, locale)} align="right" /> },
    { key: 'allocation_policy', header: t('columns.allocationPolicy'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.allocation_policy} align={textAlign} /> },
  ];

  const allocationColumns: CmxDataTableSimpleColumn<ArInvoicePaymentAllocation>[] = [
    { key: 'id', header: t('columns.id'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.id} maxLength={12} align={textAlign} /> },
    { key: 'invoice_id', header: t('columns.invoiceId'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.invoice_id} maxLength={12} align={textAlign} /> },
    { key: 'voucher_id', header: t('columns.voucherId'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.voucher_id} maxLength={12} align={textAlign} /> },
    { key: 'allocation_no', header: t('columns.allocationNo'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.allocation_no} align="right" /> },
    { key: 'allocation_outcome', header: t('columns.outcome'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.allocation_outcome} align={textAlign} /> },
    { key: 'allocated_amount', header: t('columns.allocatedAmount'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.allocated_amount} displayValue={formatCurrency(row.allocated_amount, currencyCode, locale)} align="right" /> },
    { key: 'unapplied_credit_amount', header: t('columns.unappliedCredit'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.unapplied_credit_amount} displayValue={formatCurrency(row.unapplied_credit_amount, currencyCode, locale)} align="right" /> },
    { key: 'applied_at', header: t('columns.appliedAt'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.applied_at} displayValue={formatDateTime(row.applied_at, locale)} align={textAlign} /> },
    { key: 'reversed_at', header: t('columns.reversedAt'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.reversed_at} displayValue={formatDateTime(row.reversed_at, locale)} align={textAlign} /> },
    { key: 'reversed_by', header: t('columns.reversedBy'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.reversed_by} align={textAlign} /> },
    { key: 'reversal_reason', header: t('columns.reversalReason'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.reversal_reason} maxLength={32} align={textAlign} /> },
    { key: 'metadata', header: t('columns.metadata'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={formatJson(row.metadata)} maxLength={32} align={textAlign} /> },
  ];

  const adjustmentColumns: CmxDataTableSimpleColumn<ArInvoiceAdjustment>[] = [
    { key: 'id', header: t('columns.id'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.id} maxLength={12} align={textAlign} /> },
    { key: 'invoice_id', header: t('columns.invoiceId'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.invoice_id} maxLength={12} align={textAlign} /> },
    { key: 'adjustment_no', header: t('columns.adjustmentNo'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.adjustment_no} align="right" /> },
    { key: 'adjustment_type_cd', header: t('columns.type'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.adjustment_type_cd} align={textAlign} /> },
    { key: 'adjustment_amount', header: t('columns.amount'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.adjustment_amount} displayValue={formatCurrency(row.adjustment_amount, currencyCode, locale)} align="right" /> },
    { key: 'status_cd', header: t('columns.status'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.status_cd} align={textAlign} /> },
    { key: 'approval_action_cd', header: t('columns.approvalAction'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.approval_action_cd} align={textAlign} /> },
    { key: 'approved_at', header: t('columns.approvedAt'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.approved_at} displayValue={formatDateTime(row.approved_at, locale)} align={textAlign} /> },
    { key: 'approved_by', header: t('columns.approvedBy'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.approved_by} align={textAlign} /> },
    { key: 'reason', header: t('columns.reason'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.reason} maxLength={32} align={textAlign} /> },
    { key: 'metadata', header: t('columns.metadata'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={formatJson(row.metadata)} maxLength={32} align={textAlign} /> },
  ];

  const historyColumns: CmxDataTableSimpleColumn<ArInvoiceStatusHistoryEntry>[] = [
    { key: 'id', header: t('columns.id'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.id} maxLength={12} align={textAlign} /> },
    { key: 'invoice_id', header: t('columns.invoiceId'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.invoice_id} maxLength={12} align={textAlign} /> },
    { key: 'created_at', header: t('columns.changedAt'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.created_at} displayValue={formatDateTime(row.created_at, locale)} align={textAlign} /> },
    { key: 'from_status', header: t('columns.fromStatus'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.from_status} align={textAlign} /> },
    { key: 'to_status', header: t('columns.toStatus'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.to_status} align={textAlign} /> },
    { key: 'action_cd', header: t('columns.action'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.action_cd} align={textAlign} /> },
    { key: 'reason', header: t('columns.reason'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.reason} maxLength={32} align={textAlign} /> },
    { key: 'created_by', header: t('columns.createdBy'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.created_by} align={textAlign} /> },
    { key: 'metadata', header: t('columns.metadata'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={formatJson(row.metadata)} maxLength={32} align={textAlign} /> },
  ];

  const ledgerColumns: CmxDataTableSimpleColumn<ArCustomerLedgerEntry>[] = [
    { key: 'id', header: t('columns.id'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.id} maxLength={12} align={textAlign} /> },
    { key: 'customer_id', header: t('columns.customerId'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.customer_id} maxLength={12} align={textAlign} /> },
    { key: 'invoice_id', header: t('columns.invoiceId'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.invoice_id} maxLength={12} align={textAlign} /> },
    { key: 'payment_alloc_id', header: t('columns.paymentAllocId'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.payment_alloc_id} maxLength={12} align={textAlign} /> },
    { key: 'adjustment_id', header: t('columns.adjustmentId'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.adjustment_id} maxLength={12} align={textAlign} /> },
    { key: 'voucher_id', header: t('columns.voucherId'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.voucher_id} maxLength={12} align={textAlign} /> },
    { key: 'entry_no', header: t('columns.entryNo'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.entry_no} align="right" /> },
    { key: 'movement_cd', header: t('columns.movement'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.movement_cd} align={textAlign} /> },
    { key: 'entry_side', header: t('columns.side'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.entry_side} align={textAlign} /> },
    { key: 'amount', header: t('columns.amount'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.amount} displayValue={formatCurrency(row.amount, row.currency_code, locale)} align="right" /> },
    { key: 'running_balance', header: t('columns.runningBalance'), sortable: false, align: 'right', render: (row) => <ArInvoiceDetailCopyValue value={row.running_balance} displayValue={formatCurrency(row.running_balance, row.currency_code, locale)} align="right" /> },
    { key: 'currency_code', header: t('columns.currencyCode'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.currency_code} align={textAlign} /> },
    { key: 'event_at', header: t('columns.changedAt'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.event_at} displayValue={formatDateTime(row.event_at, locale)} align={textAlign} /> },
    { key: 'ref_doc_no', header: t('columns.refDocNo'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={row.ref_doc_no} align={textAlign} /> },
    { key: 'metadata', header: t('columns.metadata'), sortable: false, render: (row) => <ArInvoiceDetailCopyValue value={formatJson(row.metadata)} maxLength={32} align={textAlign} /> },
  ];

  return (
    <CmxTabsPanel
      className="min-w-0 overflow-x-hidden"
      defaultTab="lines"
      tabs={[
        {
          id: 'lines',
          label: t('lines'),
          content: (
            <ArInvoiceDetailDataTable
              columns={lineColumns}
              data={detail.lines}
              emptyStateTitle={t('emptyLinesTitle')}
              emptyStateDescription={t('emptyLinesDescription')}
            />
          ),
        },
        {
          id: 'orders',
          label: t('orders'),
          content: (
            <ArInvoiceDetailDataTable
              columns={orderColumns}
              data={detail.orders}
              emptyStateTitle={t('emptyOrdersTitle')}
              emptyStateDescription={t('emptyOrdersDescription')}
            />
          ),
        },
        {
          id: 'allocations',
          label: t('allocations'),
          content: (
            <ArInvoiceDetailDataTable
              columns={allocationColumns}
              data={detail.allocations}
              emptyStateTitle={t('emptyAllocationsTitle')}
              emptyStateDescription={t('emptyAllocationsDescription')}
            />
          ),
        },
        {
          id: 'adjustments',
          label: t('adjustments'),
          content: (
            <ArInvoiceDetailDataTable
              columns={adjustmentColumns}
              data={detail.adjustments}
              emptyStateTitle={t('emptyAdjustmentsTitle')}
              emptyStateDescription={t('emptyAdjustmentsDescription')}
            />
          ),
        },
        {
          id: 'history',
          label: t('history'),
          content: (
            <ArInvoiceDetailDataTable
              columns={historyColumns}
              data={detail.history}
              emptyStateTitle={t('emptyHistoryTitle')}
              emptyStateDescription={t('emptyHistoryDescription')}
            />
          ),
        },
        {
          id: 'ledger',
          label: t('ledger'),
          content: (
            <ArInvoiceDetailDataTable
              columns={ledgerColumns}
              data={detail.ledger}
              emptyStateTitle={t('emptyLedgerTitle')}
              emptyStateDescription={t('emptyLedgerDescription')}
            />
          ),
        },
      ]}
    />
  );
}
