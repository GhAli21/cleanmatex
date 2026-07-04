'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CreditCard, Receipt, ArrowUpRight } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { VoucherDirectionBadge } from '@features/finance/vouchers/ui/voucher-direction-badge';
import { VoucherStatusBadge } from '@features/finance/vouchers/ui/voucher-status-badge';
import { CmxButton } from '@ui/primitives';
import { CmxCopyableCell } from '@ui/data-display/cmx-copyable-cell';
import type { VoucherData } from '@/lib/types/voucher';

interface OrdersVouchersTabRprtProps {
  vouchers: VoucherData[];
  orderId: string;
  /** Base path for order detail (default: full details page) */
  orderBasePath?: string;
  filterByInvoiceId?: string | null;
  translations: {
    emptyVouchers: string;
    viewPayments: string;
    voucherNo: string;
    voucherId?: string;
    invoiceId?: string;
  };
}

function buildSourceLink(voucher: VoucherData): string | null {
  if (!voucher.source_ref_id) return null;

  if (voucher.source_module === 'ORDERS') {
    return `/dashboard/orders/${voucher.source_ref_id}/full`;
  }
  if (voucher.source_module === 'INVOICES') {
    return `/dashboard/internal_fin/invoices/${voucher.source_ref_id}`;
  }
  // PAYMENTS source refs have no screen — internal_fin/payments was retired
  // with the legacy payments ledger (dropped by migration 0395) (ADR-002).

  return null;
}

/**
 *
 * @param root0
 * @param root0.vouchers
 * @param root0.orderId
 * @param root0.orderBasePath
 * @param root0.filterByInvoiceId
 * @param root0.translations
 */
export function OrdersVouchersTabRprt({
  vouchers,
  orderId,
  orderBasePath,
  filterByInvoiceId,
  translations: t,
}: OrdersVouchersTabRprtProps) {
  const router = useRouter();
  const tDetail = useTranslations('orders.detailFull');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const moneyLocale = isRTL ? 'ar' : 'en';
  const base = orderBasePath ?? `/dashboard/orders/${orderId}/full`;

  const filtered = filterByInvoiceId
    ? vouchers.filter((voucher) => voucher.invoice_id === filterByInvoiceId)
    : vouchers;

  const goToPayments = (voucherId: string) => {
    router.replace(
      `${base}?tab=payments_credits&voucherId=${encodeURIComponent(voucherId)}`
    );
  };

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

  if (filtered.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-12 text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}
      >
        <Receipt className="mb-3 h-12 w-12 text-gray-300" />
        <p>{t.emptyVouchers}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t.voucherNo}
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              {tDetail('voucherType')}
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              {tDetail('source')}
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              {tDetail('references')}
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              {tDetail('amountSummary')}
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              {tCommon('date')}
            </th>
            <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              {tCommon('actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((voucher) => {
            const sourceLink = buildSourceLink(voucher);
            const voucherCurrency = voucher.currency_code?.trim() || currencyCode;
            const voucherDate = voucher.voucher_datetime ?? voucher.voucher_date ?? voucher.issued_at ?? voucher.created_at;

            return (
              <tr key={voucher.id} className="border-b border-gray-100 align-top hover:bg-gray-50">
                <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CopyValue value={voucher.voucher_no} className="font-medium" />
                      <Link
                        href={`/dashboard/internal_fin/vouchers/${voucher.id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted"
                      >
                        {tDetail('openVoucher')}
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                    <CopyValue value={voucher.id} maxLength={12} className="text-muted-foreground" />
                  </div>
                </td>
                <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div className="space-y-2">
                    <CopyValue value={voucher.voucher_type} className="font-medium" />
                    <div className="flex flex-wrap items-center gap-2">
                      <VoucherStatusBadge status={voucher.voucher_status ?? 'DRAFT'} />
                      {voucher.direction && <VoucherDirectionBadge direction={voucher.direction} />}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tDetail('postingStatus')}: {voucher.posting_status ?? '—'}
                    </div>
                  </div>
                </td>
                <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">
                      {voucher.source_module ?? '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {voucher.source_ref_type ?? '—'}
                    </div>
                    {voucher.source_ref_id && (
                      <div className="flex flex-wrap items-center gap-2">
                        <CopyValue value={voucher.source_ref_id} maxLength={12} />
                        {sourceLink && (
                          <Link
                            href={sourceLink}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            {tDetail('openSource')}
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">{t.invoiceId ?? 'Invoice ID'}:</span>{' '}
                      <CopyValue value={voucher.invoice_id} maxLength={12} className="inline" />
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">{tDetail('customerId')}:</span>{' '}
                      <CopyValue value={voucher.customer_id} maxLength={12} className="inline" />
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">{tDetail('party')}:</span>{' '}
                      <CopyValue value={voucher.party_name ?? voucher.party_type} className="inline" />
                    </div>
                  </div>
                </td>
                <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div className="space-y-2">
                    <CopyValue
                      value={formatMoneyAmountWithCode(Number(voucher.total_amount ?? 0), {
                        currencyCode: voucherCurrency,
                        decimalPlaces,
                        locale: moneyLocale,
                      })}
                      className="font-medium"
                    />
                    <div className="text-sm text-muted-foreground">
                      {tDetail('paidAmount')}: {' '}
                      {formatMoneyAmountWithCode(Number(voucher.paid_amount ?? 0), {
                        currencyCode: voucherCurrency,
                        decimalPlaces,
                        locale: moneyLocale,
                      })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {tDetail('outstandingAmount')}: {' '}
                      {formatMoneyAmountWithCode(Number(voucher.outstanding_amount ?? 0), {
                        currencyCode: voucherCurrency,
                        decimalPlaces,
                        locale: moneyLocale,
                      })}
                    </div>
                  </div>
                </td>
                <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div className="space-y-2">
                    <CopyValue
                      value={voucherDate ? new Date(voucherDate).toLocaleString() : null}
                    />
                    <div className="text-xs text-muted-foreground">
                      {tDetail('createdAt')}: {voucher.created_at ? new Date(voucher.created_at).toLocaleString() : '—'}
                    </div>
                  </div>
                </td>
                <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div className="flex flex-wrap gap-2">
                    <CmxButton
                      variant="outline"
                      size="sm"
                      onClick={() => goToPayments(voucher.id)}
                      className="inline-flex items-center gap-1"
                    >
                      <CreditCard className="h-3 w-3" />
                      {t.viewPayments}
                    </CmxButton>
                    <Link
                      href={`/dashboard/internal_fin/vouchers/${voucher.id}`}
                      className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted"
                    >
                      {tDetail('openVoucher')}
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
