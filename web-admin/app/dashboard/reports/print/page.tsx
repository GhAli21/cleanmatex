'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { civilDateInZone, civilRangeQuery, formatCivilDate, formatInstant } from '@/lib/utils/operational-time';
import { useReportsClock } from '@features/reports/ui/reports-clock';
import {
  fetchOrdersReport,
  fetchPaymentsReport,
  fetchInvoicesReport,
  fetchCustomerReport,
} from '@/app/actions/reports/report-actions';
import type {
  OrdersReportData,
  PaymentsReportData,
  InvoicesReportData,
  CustomerReportData,
} from '@/lib/types/report-types';

type ReportData = OrdersReportData | PaymentsReportData | InvoicesReportData | CustomerReportData;

/**
 *
 */
export default function ReportPrintPage() {
  const searchParams = useSearchParams();
  const t = useTranslations('reports');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { zone } = useReportsClock();
  const reportType = searchParams.get('type') || 'orders';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const query = civilRangeQuery(startDate, endDate, zone);
  const queryStart = query?.start ?? '';
  const queryEnd = query?.end ?? '';

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!queryStart || !queryEnd) {
        setLoading(false);
        return;
      }

      const params = {
        startDate: queryStart,
        endDate: queryEnd,
        limit: 1000,
      };

      let result;
      switch (reportType) {
        case 'payments':
          result = await fetchPaymentsReport(params);
          break;
        case 'invoices':
          result = await fetchInvoicesReport(params);
          break;
        case 'customers':
          result = await fetchCustomerReport(params);
          break;
        default:
          result = await fetchOrdersReport(params);
      }

      if (result.success && result.data) {
        setData(result.data);
      }
      setLoading(false);
    }
    load();
  }, [reportType, queryStart, queryEnd]);

  useEffect(() => {
    if (data && !loading) {
      setTimeout(() => window.print(), 500);
    }
  }, [data, loading]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <p className="text-muted-foreground">{tCommon('noData')}</p>
      </div>
    );
  }

  const dateRangeLabel = startDate && endDate
    ? `${formatCivilDate(startDate, locale)} - ${formatCivilDate(endDate, locale)}`
    : '';

  const reportTitle: Record<string, string> = {
    orders: 'Orders & Sales Report',
    payments: 'Payments Report',
    invoices: 'Invoices Report',
    customers: 'Customers Report',
  };

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page { size: A4 landscape; margin: 10mm; }
            @media print {
              .print-hidden { display: none !important; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          `,
        }}
      />

      <div data-mode="LIGHT" className="min-h-screen bg-card p-8 print:p-4">
        {/* Print button */}
        <div className="print-hidden mb-6 flex gap-2">
          <button
            onClick={() => window.print()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary-hover"
          >
            {t('print')}
          </button>
          <button
            onClick={() => window.close()}
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            {tCommon('close')}
          </button>
        </div>

        {/* Report Header */}
        <div className="mb-6 border-b pb-4">
          <h1 className="text-xl font-bold text-foreground">
            {reportTitle[reportType] ?? 'Report'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{dateRangeLabel}</p>
          <p className="text-xs text-muted-foreground">
            Generated: {zone ? formatInstant(new Date(), zone, locale) : '—'}
          </p>
        </div>

        {/* Report Content based on type */}
        {reportType === 'orders' && <OrdersPrintContent data={data as OrdersReportData} t={t} zone={zone} />}
        {reportType === 'payments' && <PaymentsPrintContent data={data as PaymentsReportData} t={t} zone={zone} />}
        {reportType === 'invoices' && <InvoicesPrintContent data={data as InvoicesReportData} t={t} zone={zone} />}
        {reportType === 'customers' && <CustomersPrintContent data={data as CustomerReportData} t={t} zone={zone} />}
      </div>
    </>
  );
}

function OrdersPrintContent({ data, t, zone }: { data: OrdersReportData; t: ReturnType<typeof useTranslations<'reports'>>; zone: string | null }) {
  const { kpis } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <KPIBox label={t('kpi.totalRevenue')} value={`${kpis.currencyCode} ${kpis.totalRevenue.toLocaleString()}`} />
        <KPIBox label={t('kpi.totalOrders')} value={String(kpis.totalOrders)} />
        <KPIBox label={t('kpi.avgOrderValue')} value={`${kpis.currencyCode} ${kpis.avgOrderValue.toLocaleString()}`} />
        <KPIBox label={t('kpi.activeCustomers')} value={String(kpis.activeCustomers)} />
      </div>
      <PrintTable
        headers={[t('table.orderNo'), t('table.customer'), t('table.status'), t('table.items'), t('table.total'), t('table.payment'), t('table.date')]}
        rows={data.orders.map((o) => [
          o.orderNo,
          o.customerName,
          o.status,
          String(o.totalItems),
          `${kpis.currencyCode} ${o.total.toLocaleString()}`,
          o.paymentStatus,
          o.createdAt && zone ? civilDateInZone(o.createdAt, zone) : '',
        ])}
      />
    </div>
  );
}

function PaymentsPrintContent({ data, t, zone }: { data: PaymentsReportData; t: ReturnType<typeof useTranslations<'reports'>>; zone: string | null }) {
  const { kpis } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <KPIBox label={t('kpi.totalPayments')} value={String(kpis.totalPayments)} />
        <KPIBox label={t('kpi.totalAmount')} value={`${kpis.currencyCode} ${kpis.totalAmount.toLocaleString()}`} />
        <KPIBox label={t('kpi.avgAmount')} value={`${kpis.currencyCode} ${kpis.avgAmount.toLocaleString()}`} />
        <KPIBox label={t('kpi.refundedPayments')} value={String(kpis.refundedPayments)} />
      </div>
      <PrintTable
        headers={[t('table.orderNo'), t('table.invoiceNo'), t('table.customer'), t('table.amount'), t('table.method'), t('table.status'), t('table.date')]}
        rows={data.payments.map((p) => [
          p.orderNo ?? '-',
          p.invoiceNo ?? '-',
          p.customerName ?? '-',
          `${p.currencyCode} ${p.amount.toLocaleString()}`,
          p.methodName ?? p.methodCode,
          p.status,
          p.paidAt && zone ? civilDateInZone(p.paidAt, zone) : '',
        ])}
      />
    </div>
  );
}

function InvoicesPrintContent({ data, t, zone }: { data: InvoicesReportData; t: ReturnType<typeof useTranslations<'reports'>>; zone: string | null }) {
  const { kpis } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <KPIBox label={t('kpi.totalInvoices')} value={String(kpis.totalInvoices)} />
        <KPIBox label={t('kpi.totalOutstanding')} value={`${kpis.currencyCode} ${kpis.totalOutstanding.toLocaleString()}`} />
        <KPIBox label={t('kpi.collectionRate')} value={`${kpis.collectionRate}%`} />
        <KPIBox label={t('kpi.overdueCount')} value={String(kpis.overdueCount)} />
      </div>
      <PrintTable
        headers={[t('table.invoiceNo'), t('table.customer'), t('table.total'), t('table.paid'), t('table.balance'), t('table.status'), t('table.dueDate')]}
        rows={data.invoices.map((inv) => [
          inv.invoiceNo,
          inv.customerName ?? '-',
          `${kpis.currencyCode} ${inv.total.toLocaleString()}`,
          `${kpis.currencyCode} ${inv.paidAmount.toLocaleString()}`,
          `${kpis.currencyCode} ${inv.balance.toLocaleString()}`,
          inv.status + (inv.isOverdue ? ' (Overdue)' : ''),
          inv.dueDate && zone ? civilDateInZone(inv.dueDate, zone) : '-',
        ])}
      />
    </div>
  );
}

function CustomersPrintContent({ data, t, zone }: { data: CustomerReportData; t: ReturnType<typeof useTranslations<'reports'>>; zone: string | null }) {
  const { kpis } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <KPIBox label={t('kpi.totalCustomers')} value={String(kpis.totalCustomers)} />
        <KPIBox label={t('kpi.newCustomers')} value={String(kpis.newCustomers)} />
        <KPIBox label={t('kpi.returningCustomers')} value={String(kpis.returningCustomers)} />
        <KPIBox label={t('kpi.avgLTV')} value={`${kpis.currencyCode} ${kpis.avgLTV.toLocaleString()}`} />
      </div>
      <PrintTable
        headers={[t('table.customer'), t('table.phone'), t('table.orders'), t('table.revenue'), t('table.avgValue'), t('table.lastOrder'), t('table.firstOrder')]}
        rows={data.customers.map((c) => [
          c.name,
          c.phone ?? '-',
          String(c.totalOrders),
          `${kpis.currencyCode} ${c.totalRevenue.toLocaleString()}`,
          `${kpis.currencyCode} ${c.avgOrderValue.toLocaleString()}`,
          c.lastOrderDate && zone ? civilDateInZone(c.lastOrderDate, zone) : '-',
          c.firstOrderDate && zone ? civilDateInZone(c.firstOrderDate, zone) : '-',
        ])}
      />
    </div>
  );
}

function KPIBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold text-foreground">{value}</div>
    </div>
  );
}

function PrintTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th
              key={i}
              className="border border-border bg-muted px-2 py-1.5 text-start font-medium text-foreground"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rIdx) => (
          <tr key={rIdx}>
            {row.map((cell, cIdx) => (
              <td key={cIdx} className="border border-border px-2 py-1 text-foreground">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
