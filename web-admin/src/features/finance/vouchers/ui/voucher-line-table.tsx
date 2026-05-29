'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import type { CmxDataTableSimpleColumn } from '@ui/data-display';
import { CmxButton } from '@ui/primitives/cmx-button';
import type { VoucherLineData } from '@/lib/types/voucher';
import { VOUCHER_STATUS } from '@/lib/constants/voucher';
import { VoucherDetailCopyValue, VoucherDetailDataTable } from './voucher-detail-data-table';

interface VoucherLineTableProps {
  lines: VoucherLineData[];
  voucherStatus: string;
  onDeleteLine?: (lineId: string) => void;
}

function formatDecimal(value: number | null | undefined, locale: string) {
  if (value == null) return '—';

  return new Intl.NumberFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDateTime(value: Date | string | null | undefined, locale: string) {
  if (!value) return '—';

  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function VoucherLineTable({ lines, voucherStatus, onDeleteLine }: VoucherLineTableProps) {
  const t = useTranslations('finance.vouchers');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const isDraft = voucherStatus === VOUCHER_STATUS.DRAFT;
  const textAlign = isRtl ? 'right' : 'left';

  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  const columns: CmxDataTableSimpleColumn<VoucherLineData>[] = [
    { key: 'id', header: t('id'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.id} maxLength={12} align={textAlign} /> },
    { key: 'tenant_org_id', header: t('tenantOrgId'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.tenant_org_id} maxLength={12} align={textAlign} /> },
    { key: 'voucher_id', header: t('voucherId'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.voucher_id} maxLength={12} align={textAlign} /> },
    { key: 'line_no', header: t('lineNo'), sortable: false, align: 'right', render: (line) => <VoucherDetailCopyValue value={line.line_no} align="right" /> },
    { key: 'line_type', header: t('lineType'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.line_type} align={textAlign} /> },
    { key: 'line_role', header: t('lineRole'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.line_role} align={textAlign} /> },
    { key: 'target_type', header: t('targetType'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.target_type} align={textAlign} /> },
    { key: 'target_id', header: t('targetId'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.target_id} maxLength={12} align={textAlign} /> },
    { key: 'order_id', header: t('orderId'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.order_id} maxLength={12} align={textAlign} /> },
    { key: 'customer_id', header: t('customerId'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.customer_id} maxLength={12} align={textAlign} /> },
    { key: 'supplier_id', header: t('supplierId'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.supplier_id} maxLength={12} align={textAlign} /> },
    { key: 'employee_id', header: t('employeeId'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.employee_id} maxLength={12} align={textAlign} /> },
    { key: 'payment_method_code', header: t('paymentMethod'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.payment_method_code} align={textAlign} /> },
    { key: 'amount', header: t('amount'), sortable: false, align: 'right', render: (line) => <VoucherDetailCopyValue value={line.amount} displayValue={formatDecimal(line.amount, locale)} align="right" className={line.direction === 'OUT' ? 'font-medium text-red-600' : 'font-medium text-green-700'} /> },
    { key: 'currency_code', header: t('currencyCode'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.currency_code} align={textAlign} /> },
    { key: 'direction', header: t('direction'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.direction} align={textAlign} /> },
    { key: 'tendered_amount', header: t('tenderedAmount'), sortable: false, align: 'right', render: (line) => <VoucherDetailCopyValue value={line.tendered_amount} displayValue={formatDecimal(line.tendered_amount, locale)} align="right" /> },
    { key: 'change_returned_amount', header: t('changeReturnedAmount'), sortable: false, align: 'right', render: (line) => <VoucherDetailCopyValue value={line.change_returned_amount} displayValue={formatDecimal(line.change_returned_amount, locale)} align="right" /> },
    { key: 'expense_category_code', header: t('expenseCategory'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.expense_category_code} align={textAlign} /> },
    { key: 'party_name', header: t('party'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.party_name} align={textAlign} /> },
    { key: 'description', header: t('description'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.description} align={textAlign} maxLength={32} /> },
    { key: 'notes', header: t('notes'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.notes} align={textAlign} maxLength={32} /> },
    { key: 'line_status', header: tCommon('status'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.line_status} align={textAlign} /> },
    { key: 'wiring_status', header: t('wiringStatus'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.wiring_status} align={textAlign} /> },
    { key: 'reversed_line_id', header: t('reversedLineId'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.reversed_line_id} maxLength={12} align={textAlign} /> },
    { key: 'created_at', header: t('createdAt'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.created_at ? new Date(line.created_at).toISOString() : null} displayValue={formatDateTime(line.created_at, locale)} align={textAlign} /> },
    { key: 'credit_application_type', header: t('creditApplicationType'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.credit_application_type} align={textAlign} /> },
    { key: 'order_payment_id', header: t('orderPaymentId'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.order_payment_id} maxLength={12} align={textAlign} /> },
    { key: 'cash_drawer_mvt_id', header: t('cashDrawerMovementId'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.cash_drawer_mvt_id} maxLength={12} align={textAlign} /> },
    { key: 'org_payment_method_id', header: t('orgPaymentMethodId'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.org_payment_method_id} maxLength={12} align={textAlign} /> },
    { key: 'payment_terminal_id', header: t('paymentTerminalId'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.payment_terminal_id} maxLength={12} align={textAlign} /> },
    { key: 'cash_drawer_session_id', header: t('cashDrawerSessionId'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.cash_drawer_session_id} maxLength={12} align={textAlign} /> },
    { key: 'card_brand_code', header: t('cardBrand'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.card_brand_code} align={textAlign} /> },
    { key: 'card_last4', header: t('cardLast4'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.card_last4} align={textAlign} /> },
    { key: 'auth_code', header: t('authCode'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.auth_code} align={textAlign} /> },
    { key: 'gateway_code', header: t('gatewayCode'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.gateway_code} align={textAlign} /> },
    { key: 'gateway_transaction_id', header: t('gatewayTransactionId'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.gateway_transaction_id} maxLength={12} align={textAlign} /> },
    { key: 'gateway_reference', header: t('gatewayReference'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.gateway_reference} align={textAlign} /> },
    { key: 'bank_reference', header: t('bankReference'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.bank_reference} align={textAlign} /> },
    { key: 'check_number', header: t('checkNumber'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.check_number} align={textAlign} /> },
    { key: 'check_bank', header: t('checkBank'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.check_bank} align={textAlign} /> },
    { key: 'check_date', header: t('checkDate'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.check_date ? new Date(line.check_date).toISOString() : null} displayValue={formatDateTime(line.check_date, locale)} align={textAlign} /> },
    { key: 'branch_id', header: t('branchId'), sortable: false, render: (line) => <VoucherDetailCopyValue value={line.branch_id} maxLength={12} align={textAlign} /> },
  ];

  if (isDraft) {
    columns.push({
      key: 'actions',
      header: tCommon('actions'),
      sortable: false,
      render: (line) => (
        onDeleteLine ? (
          <div className="flex justify-end">
            <CmxButton
              variant="ghost"
              size="sm"
              onClick={() => onDeleteLine(line.id)}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </CmxButton>
          </div>
        ) : null
      ),
    });
  }

  return (
    <div>
      <VoucherDetailDataTable columns={columns} data={lines} emptyStateTitle={t('noLines')} />
      {lines.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/20 px-4 py-3 text-sm">
          <span className="font-medium text-foreground">{t('totalLines', { count: lines.length })}</span>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('linesTotal')}</span>
            <VoucherDetailCopyValue
              value={total}
              displayValue={formatDecimal(total, locale)}
              align="right"
              className="font-semibold"
            />
          </div>
        </div>
      )}
    </div>
  );
}
