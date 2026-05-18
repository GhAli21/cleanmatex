'use client';

import { useRTL } from '@/lib/hooks/useRTL';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import type {
  OrderChargeRow,
  OrderTaxRow,
  OrderPaymentRow,
  OrderRefundRow,
} from '@/app/actions/orders/get-order-financial';

interface OrdersFinancialTabRprtProps {
  charges: OrderChargeRow[];
  taxes: OrderTaxRow[];
  payments: OrderPaymentRow[];
  refunds: OrderRefundRow[];
}

function StatusBadge({ status }: { status: string | null }) {
  const colors: Record<string, string> = {
    COMPLETED:         'bg-green-100 text-green-800',
    PENDING_APPROVAL:  'bg-yellow-100 text-yellow-800',
    APPROVED:          'bg-blue-100 text-blue-800',
    PROCESSED:         'bg-green-100 text-green-800',
    REJECTED:          'bg-red-100 text-red-800',
    FAILED:            'bg-red-100 text-red-800',
  };
  const s = status ?? '—';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[s] ?? 'bg-gray-100 text-gray-700'}`}>
      {s}
    </span>
  );
}

export function OrdersFinancialTabRprt({
  charges,
  taxes,
  payments,
  refunds,
}: OrdersFinancialTabRprtProps) {
  const isRTL = useRTL();
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const fmt = (n: number) => formatMoneyAmountWithCode(n, { currencyCode: currencyCode ?? 'OMR', decimalPlaces: decimalPlaces ?? 3 });

  const tableHead = `text-xs font-semibold text-gray-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`;
  const tableCell = `px-4 py-3 text-sm text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`;

  return (
    <div className="space-y-6">
      {/* ── Charges ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className={`text-base font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
          Charges
        </h3>
        {charges.length === 0 ? (
          <p className="text-sm text-gray-500">No charges recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className={`px-4 py-3 ${tableHead}`}>Type</th>
                  <th className={`px-4 py-3 ${tableHead}`}>Label</th>
                  <th className={`px-4 py-3 ${tableHead} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {charges.map((c) => (
                  <tr key={c.id}>
                    <td className={tableCell}>{c.charge_type}</td>
                    <td className={tableCell}>{c.label ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">{fmt(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Taxes ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className={`text-base font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
          Taxes
        </h3>
        {taxes.length === 0 ? (
          <p className="text-sm text-gray-500">No tax lines recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className={`px-4 py-3 ${tableHead}`}>Tax Type</th>
                  <th className={`px-4 py-3 ${tableHead}`}>Label</th>
                  <th className={`px-4 py-3 ${tableHead} text-right`}>Rate</th>
                  <th className={`px-4 py-3 ${tableHead} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {taxes.map((t) => (
                  <tr key={t.id}>
                    <td className={tableCell}>{t.tax_type}</td>
                    <td className={tableCell}>{t.label}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">{t.rate}%</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">{fmt(t.tax_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Multi-leg Payments ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className={`text-base font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
          Payment Legs
        </h3>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-500">No payment legs recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className={`px-4 py-3 ${tableHead}`}>Method</th>
                  <th className={`px-4 py-3 ${tableHead}`}>Nature</th>
                  <th className={`px-4 py-3 ${tableHead}`}>Status</th>
                  <th className={`px-4 py-3 ${tableHead}`}>Received By</th>
                  <th className={`px-4 py-3 ${tableHead} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className={tableCell}>{p.payment_method_code ?? '—'}</td>
                    <td className={tableCell}>
                      <span className="text-xs text-gray-500">{p.payment_nature_snapshot ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.payment_status} />
                    </td>
                    <td className={tableCell}>{p.received_by ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums font-medium">{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Refunds ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className={`text-base font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
          Refunds
        </h3>
        {refunds.length === 0 ? (
          <p className="text-sm text-gray-500">No refunds recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className={`px-4 py-3 ${tableHead}`}>Refund No.</th>
                  <th className={`px-4 py-3 ${tableHead}`}>Reason</th>
                  <th className={`px-4 py-3 ${tableHead}`}>Method</th>
                  <th className={`px-4 py-3 ${tableHead}`}>Status</th>
                  <th className={`px-4 py-3 ${tableHead} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {refunds.map((r) => (
                  <tr key={r.id}>
                    <td className={tableCell}>{r.refund_no ?? r.id.slice(0, 8)}</td>
                    <td className={tableCell}>{r.reason_code ?? '—'}</td>
                    <td className={tableCell}>{r.refund_method_code ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.refund_status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 text-right tabular-nums font-medium">-{fmt(r.refund_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
