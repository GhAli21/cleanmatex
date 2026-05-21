'use client';

import { useTranslations } from 'next-intl';
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

/**
 * Props for the order-detail financial tab renderer.
 */
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

/**
 * Render a compact status badge for finance lifecycle rows.
 *
 * @param root0 badge props wrapper
 * @param root0.status status value to visualize
 * @returns badge element with semantic color treatment
 */
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

/**
 * Order detail financial tab read-model renderer.
 *
 * Why:
 * Separates discounts, stored value, payment legs, refunds, adjustments,
 * voucher links, and timeline events so finance users can trace balance
 * changes without cross-referencing multiple screens.
 *
 * @param props financial tab render payload
 * @param props.snapshot order-level financial header snapshot
 * @param props.charges persisted charge rows
 * @param props.discounts persisted commercial discount rows
 * @param props.taxes persisted tax rows
 * @param props.payments persisted payment legs
 * @param props.creditApplications persisted stored-value applications
 * @param props.refunds persisted refund rows
 * @param props.adjustments persisted adjustment rows
 * @param props.voucherReferences linked voucher references
 * @param props.auditTimeline merged financial activity timeline
 * @returns structured order finance tab content
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
  const emptyValue = '-';

  const fmt = (n: number) =>
    formatMoneyAmountWithCode(n, {
      currencyCode: snapshot?.currencyCode ?? currencyCode ?? 'OMR',
      decimalPlaces: decimalPlaces ?? 3,
    });

  const tableHead = `text-xs font-semibold text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`;
  const tableCell = `px-4 py-3 text-sm text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`;

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
            <p className={`text-sm font-medium text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
              {card.label}
            </p>
            <p className={`mt-2 text-2xl font-semibold tabular-nums ${card.tone} ${isRTL ? 'text-right' : 'text-left'}`}>
              {fmt(card.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
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
                  <th className={`px-4 py-3 text-right ${tableHead}`}>{t('columns.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {charges.map((row) => (
                  <tr key={row.id}>
                    <td className={tableCell}>{row.charge_type}</td>
                    <td className={tableCell}>{row.label ?? emptyValue}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-900">{fmt(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
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
                  <th className={`px-4 py-3 text-right ${tableHead}`}>{t('columns.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {discounts.map((row) => (
                  <tr key={row.id}>
                    <td className={tableCell}>{row.source_name ?? row.source_type}</td>
                    <td className={tableCell}>{row.discount_type}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-red-600">-{fmt(row.discount_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
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
                  <th className={`px-4 py-3 text-right ${tableHead}`}>{t('columns.rate')}</th>
                  <th className={`px-4 py-3 text-right ${tableHead}`}>{t('columns.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {taxes.map((row) => (
                  <tr key={row.id}>
                    <td className={tableCell}>{row.tax_type}</td>
                    <td className={tableCell}>{row.label}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-900">{row.rate}%</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-900">{fmt(row.tax_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
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
                  <th className={`px-4 py-3 text-right ${tableHead}`}>{t('columns.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((row) => (
                  <tr key={row.id}>
                    <td className={tableCell}>{row.payment_method_code ?? emptyValue}</td>
                    <td className={tableCell}>{row.payment_nature_snapshot ?? emptyValue}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.payment_status} /></td>
                    <td className={tableCell}>{row.received_by ?? emptyValue}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-gray-900">{fmt(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
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
                  <th className={`px-4 py-3 text-right ${tableHead}`}>{t('columns.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {creditApplications.map((row) => (
                  <tr key={row.id}>
                    <td className={tableCell}>{row.credit_type}</td>
                    <td className={tableCell}>{row.reference_no ?? row.credit_source_id ?? emptyValue}</td>
                    <td className={tableCell}>{row.applied_by ?? emptyValue}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-blue-700">{fmt(row.applied_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
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
                  <th className={`px-4 py-3 ${tableHead}`}>{t('columns.status')}</th>
                  <th className={`px-4 py-3 text-right ${tableHead}`}>{t('columns.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {refunds.map((row) => (
                  <tr key={row.id}>
                    <td className={tableCell}>{row.refund_no ?? row.id.slice(0, 8)}</td>
                    <td className={tableCell}>{row.reason_code ?? emptyValue}</td>
                    <td className={tableCell}>{row.refund_method_code ?? emptyValue}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.refund_status} /></td>
                    <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-red-600">-{fmt(row.refund_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
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
                  <th className={`px-4 py-3 text-right ${tableHead}`}>{t('columns.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {adjustments.map((row) => (
                  <tr key={row.id}>
                    <td className={tableCell}>{row.adjustment_type}</td>
                    <td className={tableCell}>{row.reason ?? emptyValue}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-gray-900">{fmt(row.amount)}</td>
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
                  <p className={`text-xs font-medium text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {row.source}
                  </p>
                  <p className={`mt-1 break-all text-sm font-medium text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {row.voucherId || emptyValue}
                  </p>
                  {row.voucherLineId && (
                    <p className={`mt-1 break-all text-xs text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('misc.line')}: {row.voucherLineId}
                    </p>
                  )}
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
                <div
                  key={`${row.eventType}-${row.id}`}
                  className="rounded-md border border-gray-200 bg-gray-50 p-3"
                >
                  <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={isRTL ? 'text-right' : 'text-left'}>
                      <p className="text-sm font-medium text-gray-900">{row.eventType}</p>
                      <p className="text-xs text-gray-500">{row.status ?? emptyValue}</p>
                    </div>
                    <div className={isRTL ? 'text-left' : 'text-right'}>
                      <p className="text-sm font-medium text-gray-900">
                        {row.amount == null ? emptyValue : fmt(row.amount)}
                      </p>
                      <p className="text-xs text-gray-500">{row.happenedAt}</p>
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
