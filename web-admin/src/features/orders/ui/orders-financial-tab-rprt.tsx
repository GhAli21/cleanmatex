'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CmxCopyableCell } from '@ui/data-display/cmx-copyable-cell';
import { useRTL } from '@/lib/hooks/useRTL';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import type {
  OrderAdjustmentRow,
  OrderChargeRow,
  OrderCreditApplicationRow,
  OrderDiscountRow,
  OrderFinancialSnapshot,
  OrderFinancialTimelineRow,
  OrderPaymentRow,
  OrderRefundRow,
  OrderTaxRow,
} from '@/app/actions/orders/get-order-financial';

interface OrdersFinancialTabRprtProps {
  snapshot: OrderFinancialSnapshot | null;
  charges: OrderChargeRow[];
  discounts: OrderDiscountRow[];
  taxes: OrderTaxRow[];
  payments: OrderPaymentRow[];
  creditApplications: OrderCreditApplicationRow[];
  refunds: OrderRefundRow[];
  adjustments: OrderAdjustmentRow[];
  voucherReferences: Array<{
    voucherId: string;
    voucherLineId: string | null;
    source: 'PAYMENT' | 'REFUND' | 'CREDIT_APPLICATION';
  }>;
  auditTimeline: OrderFinancialTimelineRow[];
}

function StatusBadge({ status }: { status: string | null }) {
  const colors: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-800',
    PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    PROCESSED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    FAILED: 'bg-red-100 text-red-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
  };
  const value = status ?? '-';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        colors[value] ?? 'bg-gray-100 text-gray-700'
      }`}
    >
      {value}
    </span>
  );
}

function SectionTitle({ title, isRTL }: { title: string; isRTL: boolean }) {
  return (
    <h3 className={`mb-4 text-base font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
      {title}
    </h3>
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

/**
 *
 * @param props
 */
export function OrdersFinancialTabRprt(props: OrdersFinancialTabRprtProps) {
  const {
    snapshot,
    charges,
    discounts,
    taxes,
    payments,
    creditApplications,
    refunds,
    adjustments,
    voucherReferences,
    auditTimeline,
  } = props;
  const isRTL = useRTL();
  const t = useTranslations('orders.detailFull.financialTab');
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const emptyValue = '—';
  const tableHead = `text-xs font-semibold uppercase tracking-wider text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`;
  const tableCell = `px-4 py-3 align-top text-sm text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`;

  const fmt = (value: number, forcedCurrency?: string | null) =>
    formatMoneyAmountWithCode(value, {
      currencyCode: forcedCurrency ?? snapshot?.currencyCode ?? currencyCode ?? 'OMR',
      decimalPlaces: decimalPlaces ?? 3,
      locale: isRTL ? 'ar' : 'en',
    });

  const CopyValue = ({
    value,
    maxLength,
    className = '',
  }: {
    value: string | number | null | undefined;
    maxLength?: number;
    className?: string;
  }) => (
    <CmxCopyableCell
      as="span"
      value={value}
      maxLength={maxLength}
      align={isRTL ? 'right' : 'left'}
      className={`px-0 py-0 text-sm text-foreground ${className}`}
    />
  );

  const TextCell = ({
    value,
    maxLength,
    className = '',
  }: {
    value: string | number | null | undefined;
    maxLength?: number;
    className?: string;
  }) => (
    <td className={tableCell}>
      <CopyValue value={value} maxLength={maxLength} className={className} />
    </td>
  );

  const MoneyCell = ({
    amount,
    currency,
    className = '',
  }: {
    amount: number;
    currency?: string | null;
    className?: string;
  }) => (
    <td className={`px-4 py-3 text-sm tabular-nums ${isRTL ? 'text-left' : 'text-right'} ${className}`}>
      <CopyValue value={fmt(amount, currency)} className="font-medium" />
    </td>
  );

  const VoucherLink = ({ voucherId }: { voucherId: string }) => (
    <Link href={`/dashboard/internal_fin/vouchers/${voucherId}`} className="text-xs font-medium text-primary hover:underline">
      {t('actions.openVoucher')}
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t('summary.total'), value: snapshot?.totalAmount ?? 0, tone: 'text-gray-900' },
          { label: t('summary.paid'), value: snapshot?.totalPaidAmount ?? 0, tone: 'text-green-700' },
          { label: t('summary.credits'), value: snapshot?.totalCreditAppliedAmount ?? 0, tone: 'text-blue-700' },
          { label: t('summary.outstanding'), value: snapshot?.outstandingAmount ?? 0, tone: 'text-orange-700' },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-5">
            <p className={`text-sm font-medium text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>{card.label}</p>
            <p className={`mt-2 text-2xl font-semibold tabular-nums ${card.tone} ${isRTL ? 'text-right' : 'text-left'}`}>
              {fmt(card.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <SectionTitle title={t('sections.charges')} isRTL={isRTL} />
        {charges.length === 0 ? (
          <p className="text-sm text-gray-500">{t('empty.charges')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.type')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.label')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.currency')}</th>
                  <th className={`px-4 py-3 ${tableHead} ${isRTL ? 'text-left' : 'text-right'}`}>{t('columns.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {charges.map((row) => (
                  <tr key={row.id}>
                    <TextCell value={row.charge_type} />
                    <TextCell value={row.label ?? emptyValue} />
                    <TextCell value={row.currency_code ?? snapshot?.currencyCode ?? emptyValue} />
                    <MoneyCell amount={row.amount} currency={row.currency_code} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <SectionTitle title={t('sections.discounts')} isRTL={isRTL} />
        {discounts.length === 0 ? (
          <p className="text-sm text-gray-500">{t('empty.discounts')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.source')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.type')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.rate')}</th>
                  <th className={`px-4 py-3 ${tableHead} ${isRTL ? 'text-left' : 'text-right'}`}>{t('columns.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {discounts.map((row) => (
                  <tr key={row.id}>
                    <TextCell value={row.source_name ?? row.source_type} />
                    <TextCell value={row.discount_type} />
                    <TextCell value={row.discount_rate != null ? `${row.discount_rate}%` : emptyValue} />
                    <MoneyCell amount={row.discount_amount} className="text-red-600" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <SectionTitle title={t('sections.taxes')} isRTL={isRTL} />
        {taxes.length === 0 ? (
          <p className="text-sm text-gray-500">{t('empty.taxes')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.taxType')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.label')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.rate')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.currency')}</th>
                  <th className={`px-4 py-3 ${tableHead} ${isRTL ? 'text-left' : 'text-right'}`}>{t('columns.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {taxes.map((row) => (
                  <tr key={row.id}>
                    <TextCell value={row.tax_type} />
                    <TextCell value={row.label} />
                    <TextCell value={`${row.rate}%`} />
                    <TextCell value={row.currency_code} />
                    <MoneyCell amount={row.tax_amount} currency={row.currency_code} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <SectionTitle title={t('sections.paymentLegs')} isRTL={isRTL} />
        {payments.length === 0 ? (
          <p className="text-sm text-gray-500">{t('empty.paymentLegs')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.method')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.nature')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.status')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.receivedBy')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.gateway')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.gatewayReference')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.createdAt')}</th>
                  <th className={`px-4 py-3 ${tableHead} ${isRTL ? 'text-left' : 'text-right'}`}>{t('columns.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((row) => (
                  <tr key={row.id}>
                    <TextCell value={row.payment_method_code ?? emptyValue} />
                    <TextCell value={row.payment_nature_snapshot ?? emptyValue} />
                    <td className={tableCell}><StatusBadge status={row.payment_status} /></td>
                    <TextCell value={row.received_by ?? emptyValue} />
                    <TextCell value={row.gateway_code ?? emptyValue} />
                    <td className={tableCell}>
                      <div className="space-y-1">
                        <CopyValue value={row.gateway_reference ?? emptyValue} />
                        <CopyValue value={row.branch_payment_method_id ?? emptyValue} maxLength={12} className="text-muted-foreground" />
                      </div>
                    </td>
                    <TextCell value={formatDateTime(row.created_at)} />
                    <MoneyCell amount={row.amount} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <SectionTitle title={t('sections.creditApplications')} isRTL={isRTL} />
        {creditApplications.length === 0 ? (
          <p className="text-sm text-gray-500">{t('empty.creditApplications')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.type')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.reference')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.appliedBy')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.appliedAt')}</th>
                  <th className={`px-4 py-3 ${tableHead} ${isRTL ? 'text-left' : 'text-right'}`}>{t('columns.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {creditApplications.map((row) => (
                  <tr key={row.id}>
                    <TextCell value={row.credit_type} />
                    <td className={tableCell}>
                      <div className="space-y-1">
                        <CopyValue value={row.reference_no ?? row.credit_source_id ?? emptyValue} />
                        <CopyValue value={row.credit_source_id ?? emptyValue} maxLength={12} className="text-muted-foreground" />
                      </div>
                    </td>
                    <TextCell value={row.applied_by ?? emptyValue} />
                    <TextCell value={formatDateTime(row.applied_at)} />
                    <MoneyCell amount={row.applied_amount} currency={row.currency_code} className="text-blue-700" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <SectionTitle title={t('sections.refunds')} isRTL={isRTL} />
        {refunds.length === 0 ? (
          <p className="text-sm text-gray-500">{t('empty.refunds')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.refundNo')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.reason')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.method')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.originalPayment')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.status')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.createdAt')}</th>
                  <th className={`px-4 py-3 ${tableHead} ${isRTL ? 'text-left' : 'text-right'}`}>{t('columns.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {refunds.map((row) => (
                  <tr key={row.id}>
                    <TextCell value={row.refund_no ?? row.id.slice(0, 8)} />
                    <TextCell value={row.reason_code ?? emptyValue} />
                    <TextCell value={row.refund_method_code ?? emptyValue} />
                    <td className={tableCell}>
                      {row.original_payment_id ? (
                        <div className="space-y-1">
                          <CopyValue value={row.original_payment_id} maxLength={12} />
                          <Link href={`/dashboard/internal_fin/payments/${row.original_payment_id}`} className="text-xs font-medium text-primary hover:underline">
                            {t('actions.openPayment')}
                          </Link>
                        </div>
                      ) : (
                        emptyValue
                      )}
                    </td>
                    <td className={tableCell}><StatusBadge status={row.refund_status} /></td>
                    <TextCell value={formatDateTime(row.created_at)} />
                    <MoneyCell amount={row.refund_amount} currency={row.currency_code} className="text-red-600" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <SectionTitle title={t('sections.adjustments')} isRTL={isRTL} />
        {adjustments.length === 0 ? (
          <p className="text-sm text-gray-500">{t('empty.adjustments')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.type')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.reason')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.status')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.createdBy')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.approvedBy')}</th>
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.createdAt')}</th>
                  <th className={`px-4 py-3 ${tableHead} ${isRTL ? 'text-left' : 'text-right'}`}>{t('columns.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {adjustments.map((row) => (
                  <tr key={row.id}>
                    <TextCell value={row.adjustment_type} />
                    <TextCell value={row.reason ?? emptyValue} />
                    <td className={tableCell}><StatusBadge status={row.status} /></td>
                    <TextCell value={row.created_by ?? emptyValue} />
                    <TextCell value={row.approved_by ?? emptyValue} />
                    <TextCell value={formatDateTime(row.created_at)} />
                    <MoneyCell amount={row.amount} currency={row.currency_code} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <SectionTitle title={t('sections.voucherReferences')} isRTL={isRTL} />
          {voucherReferences.length === 0 ? (
            <p className="text-sm text-gray-500">{t('empty.voucherReferences')}</p>
          ) : (
            <div className="space-y-3">
              {voucherReferences.map((row, index) => (
                <div
                  key={`${row.source}-${row.voucherId}-${index}`}
                  className="rounded-md border border-gray-200 bg-gray-50 p-3"
                >
                  <div className={`flex items-start justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={isRTL ? 'text-right' : 'text-left'}>
                      <p className="text-xs font-medium text-gray-500">{row.source}</p>
                      <div className="mt-1">
                        <CopyValue value={row.voucherId || emptyValue} className="font-medium" />
                      </div>
                      {row.voucherLineId && (
                        <p className="mt-1 text-xs text-gray-600">
                          {t('misc.line')}: <CopyValue value={row.voucherLineId} maxLength={12} className="inline" />
                        </p>
                      )}
                    </div>
                    {row.voucherId && <VoucherLink voucherId={row.voucherId} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <SectionTitle title={t('sections.auditTimeline')} isRTL={isRTL} />
          {auditTimeline.length === 0 ? (
            <p className="text-sm text-gray-500">{t('empty.auditTimeline')}</p>
          ) : (
            <div className="space-y-3">
              {auditTimeline.map((row) => (
                <div key={`${row.eventType}-${row.id}`} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className={`flex items-start justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={isRTL ? 'text-right' : 'text-left'}>
                      <p className="text-sm font-medium text-gray-900">{row.eventType}</p>
                      <p className="text-xs text-gray-500">{row.status ?? emptyValue}</p>
                      <div className="mt-1">
                        <CopyValue value={row.id} maxLength={12} className="text-xs text-muted-foreground" />
                      </div>
                    </div>
                    <div className={isRTL ? 'text-left' : 'text-right'}>
                      <p className="text-sm font-medium text-gray-900">
                        {row.amount == null ? emptyValue : fmt(row.amount)}
                      </p>
                      <p className="text-xs text-gray-500">{formatDateTime(row.happenedAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
