'use client';

import { useInstantFormatter } from '@ui/clock';
import { useRouter } from 'next/navigation';
import { FileText, CreditCard, Receipt } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { CmxButton } from '@ui/primitives';
import { CmxCopyableCell } from '@ui/data-display/cmx-copyable-cell';
import type { Invoice } from '@/lib/types/payment';

interface OrdersInvoicesTabRprtProps {
  invoices: Invoice[];
  orderId: string;
  /** Base path for order detail (default: full details page) */
  orderBasePath?: string;
  translations: {
    emptyInvoices: string;
    viewPayments: string;
    viewReceiptVouchers: string;
    invoiceNo: string;
    invoiceId?: string;
  };
}

/**
 *
 * @param root0
 * @param root0.invoices
 * @param root0.orderId
 * @param root0.orderBasePath
 * @param root0.translations
 */
export function OrdersInvoicesTabRprt({
  invoices,
  orderId,
  orderBasePath,
  translations: t,
}: OrdersInvoicesTabRprtProps) {
  const fmtInstant = useInstantFormatter();
  const router = useRouter();
  const isRTL = useRTL();
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const moneyLocale = isRTL ? 'ar' : 'en';
  const base = orderBasePath ?? `/dashboard/orders/${orderId}/full`;

  const goToPayments = (invoiceId: string) => {
    router.replace(
      `${base}?tab=payments&invoiceId=${encodeURIComponent(invoiceId)}`
    );
  };

  const goToVouchers = (invoiceId: string) => {
    router.replace(
      `${base}?tab=vouchers&invoiceId=${encodeURIComponent(invoiceId)}`
    );
  };

  if (invoices.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-muted-foreground text-start"
      >
        <FileText className="w-12 h-12 mb-3 text-muted-foreground" />
        <p>{t.emptyInvoices}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              {t.invoiceId ?? 'ID'}
            </th>
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              {t.invoiceNo}
            </th>
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              Total
            </th>
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              Status
            </th>
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              Created
            </th>
            <th className="px-4 py-3 text-sm font-medium text-foreground text-start">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className="border-b border-border hover:bg-muted">
              <CmxCopyableCell value={inv.id} maxLength={8} />
              <CmxCopyableCell value={inv.invoice_no ?? inv.id.slice(0, 8)} />
              <CmxCopyableCell
                value={formatMoneyAmountWithCode(Number(inv.total ?? 0), {
                  currencyCode: (inv.currency_code?.trim() || currencyCode) as string,
                  decimalPlaces,
                  locale: moneyLocale,
                })}
              />
              <td className="px-4 py-3 text-start">
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-muted text-foreground">
                  {inv.status ?? '—'}
                </span>
              </td>
              <CmxCopyableCell
                value={fmtInstant(inv.created_at)}
              />
              <td className="px-4 py-3 text-start">
                <div className="flex gap-2">
                  <CmxButton
                    variant="outline"
                    size="sm"
                    onClick={() => goToPayments(inv.id)}
                    className="inline-flex items-center gap-1"
                  >
                    <CreditCard className="w-3 h-3" />
                    {t.viewPayments}
                  </CmxButton>
                  <CmxButton
                    variant="outline"
                    size="sm"
                    onClick={() => goToVouchers(inv.id)}
                    className="inline-flex items-center gap-1"
                  >
                    <Receipt className="w-3 h-3" />
                    {t.viewReceiptVouchers}
                  </CmxButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
