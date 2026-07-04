'use client';

import { useRTL } from '@/lib/hooks/useRTL';
import { useLocale } from '@/lib/hooks/useLocale';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';

interface SessionData {
  id: string;
  session_no: string;
  status: string;
  currency_code: string;
  opening_balance: number;
  closing_balance: number;
  physical_count: number;
  opened_at: string | null;
  closed_at: string | null;
  opened_by: string | null;
  closed_by: string | null;
  notes: string | null;
}

interface MovementRow {
  id: string;
  direction: string;
  movement_type: string;
  amount: number;
  reason: string | null;
  performed_by: string | null;
  performed_at: string;
}

interface PaymentRow {
  id: string;
  payment_method_code: string;
  amount: number;
  payment_status: string | null;
  created_at: string;
}

interface Totals {
  totalCashIn: number;
  totalCashOut: number;
  totalPayments: number;
  expectedBalance: number;
  variance: number | null;
}

interface CashDrawerSessionPrintRprtProps {
  session: SessionData;
  movements: MovementRow[];
  payments: PaymentRow[];
  totals: Totals;
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale === 'ar' ? 'ar' : 'en', {
    year:   'numeric',
    month:  'short',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

/**
 *
 * @param root0
 * @param root0.session
 * @param root0.movements
 * @param root0.payments
 * @param root0.totals
 */
export function CashDrawerSessionPrintRprt({
  session,
  movements,
  payments,
  totals,
}: CashDrawerSessionPrintRprtProps) {
  const isRTL = useRTL();
  const locale = useLocale();
  const { currencyCode: tenantCurrency, decimalPlaces } = useTenantCurrency();
  const currency = session.currency_code || tenantCurrency || 'OMR';
  const fmt = (n: number) =>
    formatMoneyAmountWithCode(n, { currencyCode: currency, decimalPlaces: decimalPlaces ?? 3 });

  const varianceColor =
    totals.variance === null
      ? 'text-gray-500'
      : totals.variance === 0
        ? 'text-green-700'
        : totals.variance > 0
          ? 'text-blue-700'
          : 'text-red-700';

  const printStyles = `
    @page { size: A4; margin: 12mm; }
    @media print {
      html, body { margin: 0; padding: 0; background: white; }
      .print-hidden { display: none !important; }
    }
  `;

  const dir = isRTL ? 'rtl' : 'ltr';

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0" dir={dir}>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      {/* Screen-only controls */}
      <div className="print-hidden mb-4 flex items-center justify-between px-4">
        <div>
          <h1 className="text-lg font-semibold">Cash Drawer Session Report</h1>
          <p className="text-sm text-gray-500">{session.session_no} · A4</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Print
        </button>
      </div>

      {/* Print document */}
      <div className="mx-auto w-full max-w-[210mm] bg-white px-8 py-6 shadow print:shadow-none">
        {/* Header */}
        <div className={`mb-6 border-b border-gray-300 pb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
          <h2 className="text-2xl font-bold text-gray-900">Cash Drawer Session Report</h2>
          <p className="mt-1 text-sm text-gray-500">{session.session_no}</p>
        </div>

        {/* Session info grid */}
        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <InfoRow label="Status" value={session.status} isRTL={isRTL} />
          <InfoRow label="Currency" value={session.currency_code} isRTL={isRTL} />
          <InfoRow label="Opened By" value={session.opened_by ?? '—'} isRTL={isRTL} />
          <InfoRow label="Opened At" value={formatDate(session.opened_at, locale)} isRTL={isRTL} />
          <InfoRow label="Closed By" value={session.closed_by ?? '—'} isRTL={isRTL} />
          <InfoRow label="Closed At" value={formatDate(session.closed_at, locale)} isRTL={isRTL} />
          {session.notes && (
            <div className="col-span-2">
              <InfoRow label="Notes" value={session.notes} isRTL={isRTL} />
            </div>
          )}
        </div>

        {/* Financial summary */}
        <div className="mb-6 rounded-lg border border-gray-200 p-4">
          <h3 className={`mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
            Financial Summary
          </h3>
          <div className="space-y-2 text-sm">
            <SummaryRow label="Opening Float" value={fmt(session.opening_balance)} isRTL={isRTL} />
            <SummaryRow label="Cash In (movements)" value={fmt(totals.totalCashIn)} isRTL={isRTL} valueClass="text-green-700" />
            <SummaryRow label="Cash Out (movements)" value={`−${fmt(totals.totalCashOut)}`} isRTL={isRTL} valueClass="text-red-600" />
            <SummaryRow label="Payments Received" value={fmt(totals.totalPayments)} isRTL={isRTL} />
            <div className="border-t border-gray-200 pt-2">
              <SummaryRow label="Expected Balance" value={fmt(totals.expectedBalance)} isRTL={isRTL} bold />
            </div>
            {session.physical_count > 0 && (
              <>
                <SummaryRow label="Physical Count" value={fmt(session.physical_count)} isRTL={isRTL} />
                <SummaryRow
                  label="Variance"
                  value={totals.variance !== null ? fmt(Math.abs(totals.variance)) : '—'}
                  isRTL={isRTL}
                  valueClass={varianceColor}
                  bold
                />
              </>
            )}
          </div>
        </div>

        {/* Movements */}
        <div className="mb-6">
          <h3 className={`mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
            Cash Movements ({movements.length})
          </h3>
          {movements.length === 0 ? (
            <p className="text-sm text-gray-400">No movements recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <Th isRTL={isRTL}>Time</Th>
                  <Th isRTL={isRTL}>Type</Th>
                  <Th isRTL={isRTL}>Direction</Th>
                  <Th isRTL={isRTL}>Reason</Th>
                  <Th isRTL={isRTL} right>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100">
                    <Td isRTL={isRTL}>{formatDate(m.performed_at, locale)}</Td>
                    <Td isRTL={isRTL}>{m.movement_type}</Td>
                    <Td isRTL={isRTL}>
                      <span className={m.direction === 'IN' ? 'text-green-700' : 'text-red-600'}>{m.direction}</span>
                    </Td>
                    <Td isRTL={isRTL}>{m.reason ?? '—'}</Td>
                    <Td isRTL={isRTL} right>{fmt(m.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Payments by method */}
        <div className="mb-6">
          <h3 className={`mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
            Payments Received ({payments.length})
          </h3>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-400">No payments recorded for this session.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <Th isRTL={isRTL}>Time</Th>
                  <Th isRTL={isRTL}>Method</Th>
                  <Th isRTL={isRTL}>Status</Th>
                  <Th isRTL={isRTL} right>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <Td isRTL={isRTL}>{formatDate(p.created_at, locale)}</Td>
                    <Td isRTL={isRTL}>{p.payment_method_code}</Td>
                    <Td isRTL={isRTL}>{p.payment_status ?? '—'}</Td>
                    <Td isRTL={isRTL} right>{fmt(p.amount)}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300">
                  <td colSpan={3} className={`py-2 text-sm font-semibold ${isRTL ? 'text-right pr-2' : 'text-left'}`}>Total</td>
                  <td className="py-2 text-right text-sm font-bold tabular-nums">{fmt(totals.totalPayments)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-dashed border-gray-300 pt-4 text-center text-xs text-gray-400">
          Generated on {formatDate(new Date().toISOString(), locale)}
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function InfoRow({ label, value, isRTL }: { label: string; value: string; isRTL: boolean }) {
  return (
    <div className={isRTL ? 'text-right' : 'text-left'}>
      <span className="text-gray-500">{label}: </span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function SummaryRow({
  label, value, isRTL, bold = false, valueClass = 'text-gray-900',
}: {
  label: string; value: string; isRTL: boolean; bold?: boolean; valueClass?: string;
}) {
  return (
    <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'}`}>
      <span className="text-gray-600">{label}</span>
      <span className={`tabular-nums ${bold ? 'font-bold' : 'font-medium'} ${valueClass}`}>{value}</span>
    </div>
  );
}

function Th({ children, isRTL, right }: { children: React.ReactNode; isRTL: boolean; right?: boolean }) {
  return (
    <th className={`py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 ${right ? 'text-right' : isRTL ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, isRTL, right }: { children: React.ReactNode; isRTL: boolean; right?: boolean }) {
  return (
    <td className={`py-2 text-gray-800 ${right ? 'text-right tabular-nums' : isRTL ? 'text-right' : 'text-left'}`}>
      {children}
    </td>
  );
}
